/**
 * ══════════════════════════════════════════════════════════
 * AI ALPHA TERMINAL — On-Chain Heuristic Indexer (ESM)
 * ══════════════════════════════════════════════════════════
 *
 * v2 — Production data accuracy upgrade:
 *   • Full pagination (no 50-tx limit)
 *   • FIFO cost basis tracking
 *   • Live unrealized PnL via DexScreener
 * ══════════════════════════════════════════════════════════
 */

import {
  upsertWallet, insertTrade, updateWalletMetrics, updateWalletFirstSeen, upsertPosition,
  getWalletTrades, getWalletPositions, logSync, getLastSyncTime,
  db
} from './database.js';
import {
  initPriceHistoryTable, fetchHistoricalPrices, getPriceForTimestamp,
} from './utils/historicalPrice.js';

const BLOCKSCOUT_BASE = 'https://base.blockscout.com/api';
const DEXSCREENER_BASE = 'https://api.dexscreener.com/latest/dex';

// Pagination settings
const PAGE_SIZE   = 100;   // Max per Blockscout free tier
const MAX_PAGES   = 5;     // Hard cap: 5 × 100 = 500 transfers max (keeps sync fast & rate-limit friendly)
const PAGE_DELAY  = 500;   // ms between pages (rate-limit respect)

// Known base-asset addresses on Base (all lowercase)
const BASE_ASSETS = new Set([
  '0x4200000000000000000000000000000000000006', // WETH
  '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913', // USDC
  '0xd9aaec86b65d86f6a7b5b1b0c42ffa531710b6ca', // USDbC
  '0x50c5725949a6f0c72e6c4a641f24049a917db0cb', // DAI on Base
]);

// ETH price cache (60s TTL)
let _ethPriceCache = { price: 3200, updatedAt: 0 };

export async function getEthPrice() {
  if (Date.now() - _ethPriceCache.updatedAt < 60_000) return _ethPriceCache.price;
  try {
    const res = await fetch('https://api.coinbase.com/v2/prices/ETH-USD/spot');
    const data = await res.json();
    const price = parseFloat(data?.data?.amount || 0);
    if (price > 100) { _ethPriceCache = { price, updatedAt: Date.now() }; return price; }
  } catch (_) {}
  return _ethPriceCache.price;
}

// ──────────────────────────────────────────────
// TOKEN PRICE CACHE (DexScreener)
// ──────────────────────────────────────────────

const _priceCache = new Map(); // token_address → { priceUsd, updatedAt }
const PRICE_TTL = 60_000;      // 60s cache

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

/**
 * Fetch current USD prices for a batch of token addresses.
 * DexScreener supports comma-separated addresses.
 * Returns Map<tokenAddress_lowercase, priceUSD | null>
 */
export async function fetchCurrentPrices(tokenAddresses) {
  const result = new Map();
  if (!tokenAddresses || tokenAddresses.length === 0) return result;

  // Separate cached vs stale
  const now = Date.now();
  const toFetch = [];
  for (const addr of tokenAddresses) {
    const key = addr.toLowerCase();
    const cached = _priceCache.get(key);
    if (cached && now - cached.updatedAt < PRICE_TTL) {
      result.set(key, cached.priceUsd);
    } else {
      toFetch.push(key);
    }
  }

  if (toFetch.length === 0) return result;

  // DexScreener batch lookup (up to 30 per request)
  const BATCH = 30;
  for (let i = 0; i < toFetch.length; i += BATCH) {
    const batch = toFetch.slice(i, i + BATCH);
    const url = `${DEXSCREENER_BASE}/tokens/${batch.join(',')}`;
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'AlphaEngine/2.0', Accept: 'application/json' }
      });
      const data = await res.json();
      const pairs = data?.pairs || [];

      // Build best-price map (highest liquidity pair per token)
      const bestByToken = new Map();
      for (const pair of pairs) {
        if (pair.chainId !== 'base') continue;
        const tAddr = pair.baseToken?.address?.toLowerCase();
        if (!tAddr) continue;
        const priceUsd = parseFloat(pair.priceUsd || 0);
        const liq = parseFloat(pair.liquidity?.usd || 0);
        const existing = bestByToken.get(tAddr);
        if (!existing || liq > existing.liq) {
          bestByToken.set(tAddr, { priceUsd, liq });
        }
      }

      for (const addr of batch) {
        const found = bestByToken.get(addr);
        const price = found?.priceUsd ?? null;
        _priceCache.set(addr, { priceUsd: price, updatedAt: now });
        result.set(addr, price);
      }
    } catch (e) {
      console.warn(`[PRICE] DexScreener batch failed:`, e.message);
      for (const addr of batch) result.set(addr, null);
    }

    if (i + BATCH < toFetch.length) await sleep(200);
  }

  return result;
}

// ──────────────────────────────────────────────
// BLOCKSCOUT PAGINATED FETCHER
// ──────────────────────────────────────────────

/**
 * Fetch ERC-20 transfers for a wallet via paginated Blockscout API using sort=desc (incremental sync).
 * Stops when already synced transactions are reached or MAX_PAGES is hit.
 * Returns { transfers, pagesFetched, fullHistory }
 */
async function fetchAllTokenTransfers(address) {
  const allTransfers = [];
  let page = 1;
  let fullHistory = true;

  console.log(`[INDEXER] 📄 Fetching paginated transfer history for ${address}...`);

  // Query database for the latest trade timestamp we already have
  let maxTxTimestamp = 0;
  try {
    const maxTxRow = db.prepare('SELECT MAX(timestamp) as max_ts FROM wallet_trades WHERE address = ?').get(address.toLowerCase());
    maxTxTimestamp = maxTxRow?.max_ts || 0;
  } catch (err) {
    console.warn(`[INDEXER] Could not fetch max trade timestamp:`, err.message);
  }

  if (maxTxTimestamp > 0) {
    console.log(`[INDEXER]   -> Increment sync: scanning new transfers since ${new Date(maxTxTimestamp).toISOString()}`);
  } else {
    console.log(`[INDEXER]   -> Full sync: fetching up to ${MAX_PAGES * PAGE_SIZE} latest transfers`);
  }

  while (page <= MAX_PAGES) {
    const url = `${BLOCKSCOUT_BASE}?module=account&action=tokentx&address=${address}&sort=desc&offset=${PAGE_SIZE}&page=${page}`;
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'AlphaEngine/2.0', Accept: 'application/json' },
      });
      const data = await res.json();

      if (data.status !== '1') {
        if (page === 1) {
          console.warn(`[INDEXER] No ERC-20 transfers for ${address}: ${data.message}`);
        }
        break; // No more data
      }

      const results = data.result || [];
      if (results.length === 0) break;

      allTransfers.push(...results);

      // Check if we can stop: if the oldest transfer on this page is older than maxTxTimestamp
      // Since it is sorted desc, the last element in results is the oldest on this page.
      if (maxTxTimestamp > 0) {
        const oldestOnPageMs = parseInt(results[results.length - 1].timeStamp) * 1000;
        if (oldestOnPageMs < maxTxTimestamp - 5 * 60 * 1000) { // 5-minute buffer
          console.log(`[INDEXER] ⏭ Stopped fetch for ${address} — reached already synced transactions`);
          break;
        }
      }

      const gotFull = results.length >= PAGE_SIZE;
      if (!gotFull) {
        // Last page
        break;
      }

      page++;

      if (page > MAX_PAGES) {
        fullHistory = false; // Hit the cap
        console.warn(`[INDEXER] ⚠ ${address} — hit ${MAX_PAGES}-page cap (${allTransfers.length} transfers). History may be incomplete.`);
        break;
      }

      // Rate limit between pages
      await sleep(PAGE_DELAY);

    } catch (e) {
      console.error(`[INDEXER] fetchAllTokenTransfers page ${page} failed for ${address}:`, e.message);
      fullHistory = false;
      break;
    }
  }

  console.log(`[INDEXER] 📦 ${address}: ${allTransfers.length} transfers across ${page} page(s) (full: ${fullHistory})`);
  return { transfers: allTransfers, pagesFetched: page, fullHistory };
}

// ──────────────────────────────────────────────
// TRADE RECONSTRUCTION
// ──────────────────────────────────────────────
//
// HIGH   → ≤3 transfers, direct 1-base-asset ↔ 1-token swap
// MEDIUM → 4-6 transfers, clear base-asset flow still identifiable
// LOW    → 7+ transfers, multi-hop / aggregator / ambiguous
//

export async function assessWalletTradeSignals(address) {
  const addr = String(address || '').toLowerCase();
  const { transfers } = await fetchAllTokenTransfers(addr);
  const txGroups = {};

  for (const t of transfers) {
    if (!t?.hash) continue;
    if (!txGroups[t.hash]) txGroups[t.hash] = [];
    txGroups[t.hash].push(t);
  }

  const recognized = [];
  for (const hash of Object.keys(txGroups)) {
    const trade = determineTrade(addr, hash, txGroups[hash]);
    if (trade) recognized.push(trade);
  }

  const buyCount = recognized.filter(t => t.type === 'BUY').length;
  const sellCount = recognized.filter(t => t.type === 'SELL').length;
  const uniqueTokens = new Set(recognized.map(t => t.token_address.toLowerCase())).size;
  const totalUsd = recognized.reduce((sum, t) => sum + Number(t.usd_value || 0), 0);

  return {
    recognizedCount: recognized.length,
    buyCount,
    sellCount,
    uniqueTokens,
    totalUsd,
    recognizedTrades: recognized,
  };
}

function determineTrade(walletAddress, hash, txTransfers) {
  const addr     = walletAddress.toLowerCase();
  const incoming = txTransfers.filter(t => t.to.toLowerCase()   === addr);
  const outgoing = txTransfers.filter(t => t.from.toLowerCase() === addr);

  const inBase   = incoming.filter(t => BASE_ASSETS.has(t.contractAddress.toLowerCase()));
  const outBase  = outgoing.filter(t => BASE_ASSETS.has(t.contractAddress.toLowerCase()));
  const inToken  = incoming.filter(t => !BASE_ASSETS.has(t.contractAddress.toLowerCase()));
  const outToken = outgoing.filter(t => !BASE_ASSETS.has(t.contractAddress.toLowerCase()));

  const totalTransfers = txTransfers.length;

  function confidence(n) {
    if (n <= 3) return ['HIGH',   `Direct swap: ${n} transfers total.`];
    if (n <= 6) return ['MEDIUM', `Router swap: ${n} transfers, base-asset flow clear.`];
    return         ['LOW',    `Complex route: ${n} transfers. Multi-hop/aggregator likely.`];
  }

  function safeTokenAmount(transfer) {
    try {
      const dec = parseInt(transfer.tokenDecimal) || 18;
      return Number(BigInt(transfer.value)) / Math.pow(10, dec);
    } catch { return 0; }
  }

  // ── BUY: spent base-asset, received a token ─────────────────────────
  if (outBase.length >= 1 && inToken.length === 1 && inBase.length === 0) {
    const baseOut  = outBase[0];
    const tokenIn  = inToken[0];
    const isStable = baseOut.contractAddress.toLowerCase() !== '0x4200000000000000000000000000000000000006';
    const baseAmt  = safeTokenAmount(baseOut);
    const [conf, reason] = confidence(totalTransfers);

    return {
      type: 'BUY',
      token_address: tokenIn.contractAddress,
      token_symbol:  tokenIn.tokenSymbol || 'UNKNOWN',
      token_name:    tokenIn.tokenName   || 'Unknown Token',
      token_amount:  safeTokenAmount(tokenIn),
      eth_value:     isStable ? 0 : baseAmt,
      usd_value:     0,
      _baseAmount:   baseAmt,
      _isStable:     isStable,
      timestamp:     parseInt(tokenIn.timeStamp) * 1000,
      tx_hash:       hash,
      confidence:    conf,
      confidence_reason: reason,
      raw_transfer_count: totalTransfers,
    };
  }

  // ── SELL: sent a token, received base-asset ──────────────────────────
  if (outToken.length === 1 && inBase.length >= 1 && outBase.length === 0) {
    const tokenOut = outToken[0];
    const baseIn   = inBase[0];
    const isStable = baseIn.contractAddress.toLowerCase() !== '0x4200000000000000000000000000000000000006';
    const baseAmt  = safeTokenAmount(baseIn);
    const [conf, reason] = confidence(totalTransfers);

    return {
      type: 'SELL',
      token_address: tokenOut.contractAddress,
      token_symbol:  tokenOut.tokenSymbol || 'UNKNOWN',
      token_name:    tokenOut.tokenName   || 'Unknown Token',
      token_amount:  safeTokenAmount(tokenOut),
      eth_value:     isStable ? 0 : baseAmt,
      usd_value:     0,
      _baseAmount:   baseAmt,
      _isStable:     isStable,
      timestamp:     parseInt(tokenOut.timeStamp) * 1000,
      tx_hash:       hash,
      confidence:    conf,
      confidence_reason: reason,
      raw_transfer_count: totalTransfers,
    };
  }

  return null; // Not a recognizable DEX swap pattern
}

// ──────────────────────────────────────────────
// MAIN SYNC
// ──────────────────────────────────────────────

export async function syncWallet(address, label = 'Tracked Wallet', force = false) {
  const addr = address.toLowerCase();
  console.log(`\n[INDEXER] ▶ Syncing ${addr} (${label})`);
  upsertWallet(addr, label);

  if (!force) {
    const msSinceSync = Date.now() - getLastSyncTime(addr);
    if (msSinceSync < 30 * 60 * 1000 && getLastSyncTime(addr) > 0) {
      console.log(`[INDEXER] ⏭ Skipping — synced ${Math.round(msSinceSync / 60000)}m ago`);
      return;
    }
  }

  const { transfers, pagesFetched, fullHistory } = await fetchAllTokenTransfers(addr);
  if (transfers.length === 0) {
    logSync(addr, 0, 'NO_DATA', { transfersFetched: 0, pagesFetched, fullHistory });
    return;
  }

  // Ensure price history table exists and cache is warm
  initPriceHistoryTable();

  // Collect all unique calendar dates from this batch of transfers
  const uniqueDates = [
    ...new Set(transfers.map(t => new Date(parseInt(t.timeStamp) * 1000).toISOString().slice(0, 10))),
  ];
  // Pre-fetch all historical prices needed (batched — typically 1–3 API calls)
  await fetchHistoricalPrices(uniqueDates);

  // Spot price for any trades from today (candles lag ~1 day)
  const ethSpotPrice = await getEthPrice();

  // Group transfers by tx hash
  const txGroups = {};
  for (const t of transfers) {
    if (!txGroups[t.hash]) txGroups[t.hash] = [];
    txGroups[t.hash].push(t);
  }

  let added = 0, skipped = 0;
  for (const hash in txGroups) {
    const trade = determineTrade(addr, hash, txGroups[hash]);
    if (!trade) { skipped++; continue; }

    // Use historical price for the trade's date; fall back to spot for today's trades
    const historicalPrice = getPriceForTimestamp(trade.timestamp) ?? ethSpotPrice;

    trade.usd_value     = trade._isStable ? trade._baseAmount : trade._baseAmount * historicalPrice;
    trade.eth_price_usd = trade._isStable ? 0 : historicalPrice;
    delete trade._baseAmount;
    delete trade._isStable;
    trade.address = addr;

    insertTrade(trade);
    added++;
  }

  const earliestTradeTs = db.prepare(`
    SELECT MIN(timestamp) AS first_ts FROM wallet_trades WHERE address = ?
  `).get(addr)?.first_ts || 0;
  if (earliestTradeTs > 0) updateWalletFirstSeen(addr, earliestTradeTs);

  logSync(addr, added, 'OK', { transfersFetched: transfers.length, pagesFetched, fullHistory });
  console.log(`[INDEXER] ✓ ${added} trades added, ${skipped} txs skipped | ${transfers.length} transfers, ${pagesFetched} pages, full=${fullHistory}`);
  await recalculateMetrics(addr, ethSpotPrice);
}

// ──────────────────────────────────────────────
// FIFO COST BASIS ENGINE
// ──────────────────────────────────────────────

/**
 * Build FIFO positions for all tokens traded by a wallet.
 * Returns Map<tokenAddress, PositionState>
 *
 * PositionState = {
 *   symbol, name,
 *   lots: [{amount, costPerUnit}],   ← remaining open lots (FIFO queue)
 *   totalBoughtAmt, totalBoughtUsd,
 *   totalSoldAmt, totalSoldUsd,
 *   realizedPnl,
 *   completedCycles,  ← NUMBER OF COMPLETED BUY→SELL CYCLES (fixed metric!)
 *   remainingAmt, avgCostUsd,
 *   status: 'OPEN' | 'CLOSED'
 * }
 */
function buildFifoPositions(trades) {
  const positions = new Map();

  // trades must be sorted ASC by timestamp (already done in getWalletTrades)
  for (const trade of trades) {
    const key = trade.token_address.toLowerCase();
    if (!positions.has(key)) {
      positions.set(key, {
        symbol: trade.token_symbol,
        name:   trade.token_name,
        lots:   [],               // FIFO queue of open buy lots
        totalBoughtAmt: 0,
        totalBoughtUsd: 0,
        totalSoldAmt:   0,
        totalSoldUsd:   0,
        realizedPnl:    0,
        completedCycles: 0,       // ← NEW: Count completed buy→sell matches
      });
    }

    const pos = positions.get(key);

    if (trade.type === 'BUY') {
      pos.totalBoughtAmt += trade.token_amount;
      pos.totalBoughtUsd += trade.usd_value;

      // Push lot onto the FIFO queue
      if (trade.token_amount > 0 && trade.usd_value > 0) {
        pos.lots.push({
          amount:      trade.token_amount,
          costPerUnit: trade.usd_value / trade.token_amount,
        });
      }
    } else if (trade.type === 'SELL') {
      pos.totalSoldAmt += trade.token_amount;
      pos.totalSoldUsd += trade.usd_value;

      // Consume lots from FIFO queue
      let remainingToSell = trade.token_amount;
      const sellPricePerUnit = trade.token_amount > 0 ? trade.usd_value / trade.token_amount : 0;

      while (remainingToSell > 1e-12 && pos.lots.length > 0) {
        const lot = pos.lots[0];

        if (lot.amount <= remainingToSell + 1e-12) {
          // Consume entire lot — this completes one cycle
          const pnl = lot.amount * (sellPricePerUnit - lot.costPerUnit);
          pos.realizedPnl += pnl;
          remainingToSell -= lot.amount;
          pos.lots.shift();
          pos.completedCycles++;  // ← Increment for each completed lot
        } else {
          // Partially consume lot — counts as partial cycle
          const pnl = remainingToSell * (sellPricePerUnit - lot.costPerUnit);
          pos.realizedPnl += pnl;
          lot.amount -= remainingToSell;
          remainingToSell = 0;
          pos.completedCycles++;  // ← Increment for partial completion
        }
      }
      // If sells exceed buys in window (incomplete history), remaining goes to zero
    }
  }

  // Compute derived fields for each position
  for (const [, pos] of positions) {
    pos.remainingAmt = pos.lots.reduce((s, l) => s + l.amount, 0);

    // Average cost of remaining open lots (weighted)
    if (pos.remainingAmt > 1e-12 && pos.lots.length > 0) {
      const totalCost = pos.lots.reduce((s, l) => s + l.amount * l.costPerUnit, 0);
      pos.avgCostUsd = totalCost / pos.remainingAmt;
    } else {
      pos.avgCostUsd = 0;
    }

    pos.status = pos.remainingAmt > 1e-9 ? 'OPEN' : 'CLOSED';
  }

  return positions;
}

// ──────────────────────────────────────────────
// SCORING ENGINE
// ──────────────────────────────────────────────

export async function recalculateMetrics(address, ethPriceOverride = null) {
  const addr   = address.toLowerCase();
  const trades = getWalletTrades(addr); // sorted ASC by timestamp
  if (trades.length === 0) return;

  const ethPrice = ethPriceOverride ?? await getEthPrice();

  // Only score on HIGH + MEDIUM confidence trades
  const reliable = trades.filter(t => t.confidence === 'HIGH' || t.confidence === 'MEDIUM');

  if (reliable.length === 0) {
    updateWalletMetrics(addr, {
      data_quality: 'LOW',
      alpha_score: 0, hidden_gem_score: 0,
      alpha_breakdown: { note: 'Insufficient HIGH/MEDIUM confidence trades for reliable scoring.' },
      hidden_gem_breakdown: {},
      unrealized_pnl: 0, open_positions: 0, total_unrealized_roi: 0,
    });
    console.log(`[ENGINE] ⚠ ${addr} — only LOW confidence trades → returning uncertainty`);
    return;
  }

  // ── FIFO position building ───────────────────────────────────────────
  const fifoPositions = buildFifoPositions(reliable);

  // ── Live price lookup for open positions ─────────────────────────────
  const openTokens = [];
  for (const [tokenAddr, pos] of fifoPositions) {
    if (pos.status === 'OPEN' && pos.remainingAmt > 1e-9) {
      openTokens.push(tokenAddr);
    }
  }

  let priceMap = new Map();
  if (openTokens.length > 0) {
    try {
      priceMap = await fetchCurrentPrices(openTokens);
    } catch (e) {
      console.warn(`[ENGINE] Price fetch failed for ${addr}:`, e.message);
    }
  }

  // ── Persist positions to DB ───────────────────────────────────────────
  let totalUnrealizedPnl = 0;
  let openPositionsCount = 0;
  let totalOpenCost = 0;

  for (const [tokenAddr, pos] of fifoPositions) {
    let currentPrice = null;
    let unrealizedPnl = null;
    let unrealizedRoi = null;

    if (pos.status === 'OPEN' && pos.remainingAmt > 1e-9) {
      currentPrice = priceMap.get(tokenAddr) ?? null;
      if (currentPrice !== null) {
        const openCost = pos.remainingAmt * pos.avgCostUsd;
        const currentValue = pos.remainingAmt * currentPrice;
        unrealizedPnl = currentValue - openCost;
        unrealizedRoi = openCost > 0 ? (unrealizedPnl / openCost) * 100 : null;
        totalUnrealizedPnl += unrealizedPnl;
        totalOpenCost      += openCost;
      }
      openPositionsCount++;
    }

    upsertPosition({
      address:          addr,
      token_address:    tokenAddr,
      token_symbol:     pos.symbol,
      token_name:       pos.name,
      total_bought_amt: pos.totalBoughtAmt,
      total_bought_usd: pos.totalBoughtUsd,
      total_sold_amt:   pos.totalSoldAmt,
      total_sold_usd:   pos.totalSoldUsd,
      realized_pnl_usd: pos.realizedPnl,
      avg_cost_usd:     pos.avgCostUsd,
      remaining_amt:    pos.remainingAmt,
      status:           pos.status,
      current_price_usd:  currentPrice,
      unrealized_pnl_usd: unrealizedPnl,
      unrealized_roi_pct: unrealizedRoi,
      price_updated_at:   currentPrice !== null ? Date.now() : 0,
    });
  }

  const totalUnrealizedRoi = totalOpenCost > 0 ? (totalUnrealizedPnl / totalOpenCost) * 100 : 0;

  // ── Scoring metrics from FIFO data ───────────────────────────────────
  let realizedPnL = 0, totalCapital = 0, closed = 0, profitable = 0;
  let peakEquity = 0, maxDrawdown = 0, runningEquity = 0;
  const monthlyPnL = {};

  for (const [tokenAddr, pos] of fifoPositions) {
    totalCapital += pos.totalBoughtUsd;
    closed += pos.completedCycles;  // ← NOW: Sum of all completed cycles across all tokens
    
    if (pos.realizedPnl > 0) profitable += pos.completedCycles;  // ← Profitable cycles
    
    realizedPnL += pos.realizedPnl;

    runningEquity += pos.realizedPnl;
    if (runningEquity > peakEquity) {
      peakEquity = runningEquity;
    } else if (peakEquity > 0) {
      const dd = (peakEquity - runningEquity) / peakEquity;
      if (dd > maxDrawdown) maxDrawdown = dd;
    }

    // Monthly realized PnL bucketing via FIFO
    const lastSell = reliable
      .filter(t => t.type === 'SELL' && t.token_address.toLowerCase() === tokenAddr.toLowerCase())
      .sort((a, b) => b.timestamp - a.timestamp)[0];
    if (lastSell) {
      const d = new Date(lastSell.timestamp);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthlyPnL[key] = (monthlyPnL[key] || 0) + pos.realizedPnl;
    }
  }

  const winRate = closed > 0 ? profitable / closed : 0;
  const roi     = totalCapital > 0 ? realizedPnL / totalCapital : 0;

  // Consistency score from FIFO realized PnL per month
  const mv = Object.values(monthlyPnL);
  let consistencyScore = 0;
  if (mv.length >= 2) {
    const mean   = mv.reduce((a, b) => a + b, 0) / mv.length;
    const stddev = Math.sqrt(mv.map(v => (v - mean) ** 2).reduce((a, b) => a + b, 0) / mv.length);
    const cv     = mean !== 0 ? stddev / Math.abs(mean) : 1;
    consistencyScore = Math.max(0, Math.min(1, 1 - Math.min(cv, 2) / 2));
  } else if (mv.length === 1) {
    consistencyScore = 0.5;
  }

  // Drawdown penalty — correct: measures peak-to-trough equity drawdown only
  const drawdownPenalty = maxDrawdown;

  // Activity score
  const activityScore = Math.min(13, closed);

  // Growth trend — recent-window ROI vs prior-window ROI, naive first-buy match.
  const now = Date.now();
  let r30cap = 0, r30pnl = 0, p60cap = 0, p60pnl = 0;
  const buysByToken = new Map();
  for (const b of reliable) {
    if (b.type !== 'BUY') continue;
    if (!buysByToken.has(b.token_address)) buysByToken.set(b.token_address, b);
  }
  for (const sell of reliable) {
    if (sell.type !== 'SELL') continue;
    const matchBuy = buysByToken.get(sell.token_address);
    if (!matchBuy) continue;
    const pnl = sell.usd_value - matchBuy.usd_value;
    if (sell.timestamp >= now - 30 * 86400000) {
      r30cap += matchBuy.usd_value; r30pnl += pnl;
    } else if (sell.timestamp >= now - 90 * 86400000) {
      p60cap += matchBuy.usd_value; p60pnl += pnl;
    }
  }
  const recentRoi = r30cap > 0 ? r30pnl / r30cap : null;
  const priorRoi  = p60cap > 0 ? p60pnl / p60cap : null;
  let growthTrend = 0;
  if (recentRoi !== null && priorRoi !== null) growthTrend = Math.max(-1, Math.min(1, recentRoi - priorRoi));
  else if (recentRoi !== null) growthTrend = Math.max(-1, Math.min(1, recentRoi));

  // Visibility penalty
  let visibilityPenalty = 0;
  if      (totalCapital > 1_000_000) visibilityPenalty = 40;
  else if (totalCapital > 500_000)   visibilityPenalty = 30;
  else if (totalCapital > 100_000)   visibilityPenalty = 15;
  else if (totalCapital > 50_000)    visibilityPenalty = 5;

  // ── Alpha Score ──────────────────────────────────────────────────────
  // Weights sum to 100: ROI 37 + WinRate 30 + Consistency 20 + Activity 13 = 100
  // ROI cap: 50% (was 500% — calibrated to actual dataset range)
  const normRoi    = Math.max(-1, Math.min(roi, 0.5)) / 0.5;
  const roiPts     = Math.round(normRoi * 37);
  const winPts     = Math.round(winRate * 30);
  const consPts    = Math.round(consistencyScore * 20);
  const actPts     = activityScore;
  const ddDeduct   = Math.round(drawdownPenalty * 8);
  const alphaScore = Math.max(0, Math.min(100, roiPts + winPts + consPts + actPts - ddDeduct));

  const alphaBreakdown = {
    roi_pts: roiPts, win_rate_pts: winPts, consistency_pts: consPts,
    activity_pts: actPts, drawdown_deduct: -ddDeduct, total: alphaScore,
    formulas: {
      roi:         `Normalized ROI (${(roi * 100).toFixed(1)}%, cap 50%) × 37 = ${roiPts} pts`,
      win_rate:    `Win Rate (${(winRate * 100).toFixed(1)}%) × 30 = ${winPts} pts`,
      consistency: `Consistency (${(consistencyScore * 100).toFixed(1)}%) × 20 = ${consPts} pts`,
      activity:    `${closed} closed positions → ${actPts} pts (max 13)`,
      drawdown:    `Max Drawdown (${(drawdownPenalty * 100).toFixed(1)}%) × 8 = -${ddDeduct} pts`,
    },
    cost_basis_method:    'FIFO',
    data_source:          'Blockscout ERC-20 transfers (full history) + ETH/USD price from Coinbase API',
    confidence_filter:    `Scored on ${reliable.length}/${trades.length} HIGH+MEDIUM confidence trades`,
    total_transfers_fetched: trades.length,
    scored_at:            new Date().toISOString(),
  };

  // ── Hidden Gem Score ─────────────────────────────────────────────────
  const growthPts      = Math.round(Math.max(0, growthTrend) * 15);
  const hgConsPts      = Math.round(consistencyScore * 10);
  const hiddenGemScore = Math.max(0, Math.min(100, alphaScore + growthPts + hgConsPts - visibilityPenalty));

  const hiddenGemBreakdown = {
    alpha_score: alphaScore, growth_trend_pts: growthPts,
    consistency_pts: hgConsPts, visibility_penalty: -visibilityPenalty, total: hiddenGemScore,
    formulas: {
      base:        `Alpha Score = ${alphaScore}`,
      growth:      `Growth Trend (${(growthTrend * 100).toFixed(1)}% delta) × 15 = ${growthPts} pts`,
      consistency: `Consistency × 10 = ${hgConsPts} pts`,
      visibility:  `Capital $${totalCapital.toFixed(0)} → -${visibilityPenalty} pts`,
    },
    unrealized_pnl: totalUnrealizedPnl,
    open_positions: openPositionsCount,
    scored_at:      new Date().toISOString(),
  };

  // ── Data quality ─────────────────────────────────────────────────────
  const walletRow = db.prepare('SELECT first_seen FROM tracked_wallets WHERE address = ?').get(addr);
  const earliestTradeTs = trades.length > 0 ? trades[0].timestamp : 0;
  const walletFirstSeen = (walletRow?.first_seen && walletRow.first_seen > 0)
    ? Math.min(walletRow.first_seen, earliestTradeTs || walletRow.first_seen)
    : (earliestTradeTs || Date.now());
  const daysActive = Math.max(1, Math.round((Date.now() - walletFirstSeen) / 86400000));

  const dataQuality = (closed >= 5 && daysActive >= 7 && totalCapital >= 500)
    ? (closed >= 10 && totalCapital >= 2000 ? 'HIGH' : 'MEDIUM')
    : 'LOW';

  const finalAlphaScore = dataQuality === 'LOW' ? 0 : alphaScore;
  const finalHiddenGemScore = dataQuality === 'LOW' ? 0 : hiddenGemScore;

  // Compute canonical archetype once — stored in DB as single source of truth
  const archetypeObj = computeArchetype(finalAlphaScore, daysActive, totalCapital, closed, consistencyScore, drawdownPenalty, dataQuality);

  updateWalletMetrics(addr, {
    win_rate: dataQuality === 'LOW' ? 0 : winRate * 100,
    roi_30d: dataQuality === 'LOW' ? 0 : roi * 100,
    total_pnl: realizedPnL,
    total_capital: totalCapital,
    closed_positions: closed,
    profitable_positions: profitable,
    consistency_score: consistencyScore * 100,
    drawdown_penalty: drawdownPenalty * 100,
    growth_trend: growthTrend * 100,
    visibility_penalty: visibilityPenalty,
    activity_score: activityScore,
    alpha_score: finalAlphaScore,
    hidden_gem_score: finalHiddenGemScore,
    alpha_breakdown: alphaBreakdown,
    hidden_gem_breakdown: hiddenGemBreakdown,
    data_quality: dataQuality,
    unrealized_pnl: totalUnrealizedPnl,
    open_positions: openPositionsCount,
    total_unrealized_roi: totalUnrealizedRoi,
    days_active: daysActive,
    archetype: archetypeObj,
  });

  const unrealStr = totalUnrealizedPnl !== 0
    ? ` | Unrealized: $${totalUnrealizedPnl.toFixed(2)} (${openPositionsCount} open)`
    : '';

  console.log(
    `[ENGINE] ✓ ${addr} — Alpha: ${finalAlphaScore} | Quality: ${dataQuality} | ` +
    `ROI: ${(dataQuality==='LOW'?0:roi*100).toFixed(1)}% | WinRate: ${(dataQuality==='LOW'?0:winRate*100).toFixed(1)}% | Archetype: ${archetypeObj.id}${unrealStr}`
  );
}

// ── Canonical Archetype Classifier ────────────────────────────────────
// Single source of truth: called by recalculateMetrics, result stored in DB.
// All API routes (leaderboard, clusters, profile, discovery) read from DB.

// Single source of truth for DNA dimensions. Used by archetype classifier and /api/wallet.
// Inputs come either from raw recalculate (0–1 scaled) or stored metrics (0–100 scaled).
export function deriveDnaScores({ alphaScore, consistencyScore, drawdownPenalty, totalCapital, closedPositions }) {
  return {
    diamondHands:    Math.min(100, Math.max(0, Math.round(consistencyScore * 100))),
    whaleInfluence:  Math.min(100, Math.round((totalCapital / 50000) * 100)),
    tradingActivity: Math.min(100, closedPositions * 10),
    sybilRisk:       Math.max(0, Math.min(100, Math.round(100 - drawdownPenalty * 100))),
    alphaRate:       alphaScore,
    smartMoney:      alphaScore,
  };
}

export function computeArchetype(alphaScore, daysActive, totalCapital, closedPositions, consistencyScore, drawdownPenalty, dataQuality) {
  if (dataQuality === 'LOW' || closedPositions < 5) {
    return { id: 'unknown', name: 'Insufficient Data', emoji: '📊', color: '#4A5568',
      desc: 'Insufficient history for reliable classification.' };
  }
  const { diamondHands, whaleInfluence, tradingActivity, sybilRisk } =
    deriveDnaScores({ alphaScore, consistencyScore, drawdownPenalty, totalCapital, closedPositions });
  const totalTxns = closedPositions * 3; // conservative proxy

  const archetypes = [
    { id: 'oracle',        name: 'The Oracle',      emoji: '🔮', color: '#B54AFF',
      desc: 'Consistently enters positions before major price moves. Rare. Follow closely.',
      condition: () => alphaScore > 75 },
    { id: 'diamond_whale', name: 'Diamond Whale',   emoji: '💎', color: '#00E5FF',
      desc: 'Large holdings, minimal trading, extreme patience. The market moves around them.',
      condition: () => diamondHands > 80 && whaleInfluence > 60 },
    { id: 'degen_sniper',  name: 'Degen Sniper',    emoji: '🎯', color: '#FF6B35',
      desc: 'First in, first out. High risk, high reward.',
      condition: () => alphaScore > 60 && tradingActivity > 60 && totalTxns > 150 },
    { id: 'farmer',        name: 'The Farmer',      emoji: '🌾', color: '#FFB800',
      desc: 'Airdrop farming patterns detected. Multiple coordinated wallet behaviors.',
      condition: () => sybilRisk < 40 && totalTxns > 300 },
    { id: 'copy_cat',      name: 'The Shadow',      emoji: '👤', color: '#8899AA',
      desc: 'Mirrors smart money 24-48h later. Good instincts, needs more conviction.',
      condition: () => alphaScore > 50 && alphaScore < 65 },
    { id: 'paper_hands',   name: 'Paper Hands',     emoji: '📄', color: '#FF3B6B',
      desc: 'Sells at the first sign of volatility. Misses most major moves.',
      condition: () => diamondHands < 35 && totalTxns > 80 },
    { id: 'accumulator',   name: 'The Accumulator', emoji: '📦', color: '#6B8AFF',
      desc: 'Systematic DCA strategy. Consistent small buys, long time horizon.',
      condition: () => diamondHands > 60 && daysActive > 120 && totalTxns > 30 },
    // Fallback for solid alpha that doesn't fit a niche pattern. Real traders,
    // just not extreme in any one dimension. alpha_score > 40 means the wallet
    // already cleared ROI+winRate+consistency+activity bar, so this is not a
    // threshold relaxation — it's a name for "good trader, no specialty".
    { id: 'alpha_trader',  name: 'Alpha Trader',    emoji: '⚡', color: '#00FFB2',
      desc: 'Solid all-around alpha across ROI, win rate and consistency. No single specialty.',
      condition: () => alphaScore >= 30 && closedPositions >= 5 },
  ];
  for (const a of archetypes) if (a.condition()) return a;
  return { id: 'unclassified', name: 'Unclassified', emoji: '❓', color: '#4A5568',
    desc: 'Trading history present but no dominant archetype detected yet.' };
}
