/**
 * Historical ETH/USD price oracle.
 *
 * Source:   Coinbase candles API — free, no auth, covers 2020+
 * Cache:    In-memory Map keyed by 'YYYY-MM-DD' + persistent eth_price_history table
 * Strategy: Batch requests by date-cluster → typically 5 requests for full DB history
 */

import { db } from '../database.js';

const _cache = new Map(); // 'YYYY-MM-DD' → priceUsd (number)

// ─────────────────────────────────────────────────────
// INIT — load persisted prices into memory
// ─────────────────────────────────────────────────────

export function initPriceHistoryTable() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS eth_price_history (
      date       TEXT PRIMARY KEY,
      price_usd  REAL NOT NULL,
      source     TEXT DEFAULT 'coinbase_candles',
      fetched_at INTEGER
    )
  `);

  // Warm in-memory cache from DB
  const rows = db.prepare('SELECT date, price_usd FROM eth_price_history').all();
  for (const row of rows) _cache.set(row.date, row.price_usd);
  if (rows.length > 0) {
    console.log(`[PRICE_HISTORY] Loaded ${rows.length} cached dates from DB`);
  }
}

// ─────────────────────────────────────────────────────
// COINBASE CANDLES FETCH
// ─────────────────────────────────────────────────────

function isoToUnix(dateStr) {
  return Math.floor(new Date(dateStr + 'T00:00:00Z').getTime() / 1000);
}

function unixToDate(unixSec) {
  return new Date(parseInt(unixSec) * 1000).toISOString().slice(0, 10);
}

async function fetchCoinbaseCandles(startDate, endDate) {
  // Add 1 day buffer to endDate so candles endpoint includes it
  const start = isoToUnix(startDate);
  const end   = isoToUnix(endDate) + 86400;
  const url   = `https://api.coinbase.com/api/v3/brokerage/market/products/ETH-USD/candles` +
                `?start=${start}&end=${end}&granularity=ONE_DAY`;

  const res  = await fetch(url, {
    headers: { 'User-Agent': 'AlphaEngine/2.0', Accept: 'application/json' },
  });
  const data = await res.json();
  const candles = data?.candles || [];

  const result = new Map();
  for (const c of candles) {
    const date = unixToDate(c.start);
    // Use (high + low) / 2 as representative daily price
    const mid = (parseFloat(c.high) + parseFloat(c.low)) / 2;
    if (mid > 0) result.set(date, mid);
  }
  return result;
}

// ─────────────────────────────────────────────────────
// CLUSTER BUILDER — minimize API calls
// ─────────────────────────────────────────────────────

// Groups sorted dates into clusters where gap between consecutive dates ≤ maxGapDays.
// Each cluster fetched as one Coinbase request.
function buildClusters(sortedDates, maxGapDays = 14) {
  if (sortedDates.length === 0) return [];

  const clusters = [];
  let start = sortedDates[0];
  let end   = sortedDates[0];

  for (let i = 1; i < sortedDates.length; i++) {
    const gapMs  = new Date(sortedDates[i]) - new Date(end);
    const gapDays = gapMs / 86400000;
    if (gapDays <= maxGapDays) {
      end = sortedDates[i];
    } else {
      clusters.push([start, end]);
      start = sortedDates[i];
      end   = sortedDates[i];
    }
  }
  clusters.push([start, end]);
  return clusters;
}

// ─────────────────────────────────────────────────────
// MAIN FETCH — populate cache for requested dates
// ─────────────────────────────────────────────────────

export async function fetchHistoricalPrices(dates) {
  const needed = [...new Set(dates)].filter(d => !_cache.has(d)).sort();
  if (needed.length === 0) return;

  const clusters = buildClusters(needed);
  console.log(
    `[PRICE_HISTORY] Fetching ${needed.length} date(s) via ` +
    `${clusters.length} Coinbase candle request(s)`,
  );

  const insert = db.prepare(`
    INSERT OR REPLACE INTO eth_price_history (date, price_usd, source, fetched_at)
    VALUES (?, ?, 'coinbase_candles', ?)
  `);

  for (const [clusterStart, clusterEnd] of clusters) {
    try {
      const prices = await fetchCoinbaseCandles(clusterStart, clusterEnd);
      const now    = Date.now();
      const store  = db.transaction(() => {
        for (const [date, price] of prices) {
          _cache.set(date, price);
          insert.run(date, price, now);
        }
      });
      store();
      console.log(
        `[PRICE_HISTORY] ${clusterStart}→${clusterEnd}: ${prices.size} candles cached`,
      );
    } catch (e) {
      console.error(`[PRICE_HISTORY] Cluster ${clusterStart}→${clusterEnd} failed:`, e.message);
    }
    // Small delay — Coinbase is generous but be polite
    await new Promise(r => setTimeout(r, 300));
  }

  // Fill any remaining gaps with nearest available date price
  for (const date of needed) {
    if (!_cache.has(date)) {
      const nearest = findNearest(date);
      if (nearest) {
        const fallback = _cache.get(nearest);
        _cache.set(date, fallback);
        console.warn(
          `[PRICE_HISTORY] No candle for ${date}, using nearest (${nearest} = $${fallback.toFixed(2)})`,
        );
      }
    }
  }
}

function findNearest(targetDate) {
  const t = new Date(targetDate).getTime();
  let nearest = null;
  let minDiff  = Infinity;
  for (const date of _cache.keys()) {
    const diff = Math.abs(new Date(date).getTime() - t);
    if (diff < minDiff) { minDiff = diff; nearest = date; }
  }
  return nearest;
}

// ─────────────────────────────────────────────────────
// GETTERS
// ─────────────────────────────────────────────────────

/** Returns historical mid-price for a 'YYYY-MM-DD' string, or null. */
export function getHistoricalPrice(dateStr) {
  return _cache.get(dateStr) ?? null;
}

/** Returns historical mid-price for a ms timestamp, or null. */
export function getPriceForTimestamp(timestampMs) {
  const date = new Date(timestampMs).toISOString().slice(0, 10);
  return getHistoricalPrice(date);
}

/** How many dates are in the cache. */
export function cachedDateCount() {
  return _cache.size;
}
