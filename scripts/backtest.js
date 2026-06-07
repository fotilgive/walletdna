// Real signal backtest crawler.
// For each token tracked wallets bought in the last 180 days, fetch real historical
// OHLCV from GeckoTerminal (free, no key) and compute what would have happened.
// Stores results in `signal_backtest` so the API can serve instantly.

import Database from 'better-sqlite3';

const db = new Database('./alpha_engine.db');

db.exec(`
  CREATE TABLE IF NOT EXISTS signal_backtest (
    token_address   TEXT PRIMARY KEY,
    token_symbol    TEXT,
    token_name      TEXT,
    wallet_count    INTEGER,
    total_inflow    REAL,
    signal_ts       INTEGER,
    entry_price     REAL,
    peak_price_30d  REAL,
    peak_gain_pct   REAL,
    current_price   REAL,
    current_pct     REAL,
    candle_days     INTEGER,
    computed_at     INTEGER
  )
`);

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// GeckoTerminal free tier = 30 calls/min. Stay under it with a 2.5s pacing
// plus exponential backoff on 429.
const PACE_MS = 2500;

async function fetchJson(url, attempt = 0) {
  try {
    const r = await fetch(url, { headers: { accept: 'application/json' } });
    if (r.status === 429) {
      if (attempt >= 4) return null;
      const wait = 5000 * (attempt + 1);
      console.log(`     …rate limited, waiting ${wait / 1000}s`);
      await sleep(wait);
      return fetchJson(url, attempt + 1);
    }
    if (!r.ok) return null;
    return await r.json();
  } catch {
    if (attempt >= 2) return null;
    await sleep(2000);
    return fetchJson(url, attempt + 1);
  }
}

async function getTopPool(tokenAddr) {
  const d = await fetchJson(`https://api.geckoterminal.com/api/v2/networks/base/tokens/${tokenAddr}/pools`);
  return d?.data?.[0]?.attributes?.address || null;
}

async function getDailyCandles(pool) {
  const d = await fetchJson(`https://api.geckoterminal.com/api/v2/networks/base/pools/${pool}/ohlcv/day?aggregate=1&limit=180&currency=usd`);
  return d?.data?.attributes?.ohlcv_list || []; // [ts, o, h, l, c, v] newest first
}

async function main() {
  const sinceDays = parseInt(process.argv[2] || '180');
  const since = Date.now() - sinceDays * 86400000;

  const signals = db.prepare(`
    SELECT token_address, token_symbol, token_name,
           COUNT(DISTINCT address) as wallet_count,
           SUM(usd_value) as total_inflow,
           MIN(timestamp) as signal_ts,
           SUM(usd_value) / NULLIF(SUM(token_amount), 0) as entry_price
    FROM wallet_trades
    WHERE type = 'BUY' AND timestamp > ? AND usd_value > 1 AND token_amount > 0
    GROUP BY token_address
    HAVING entry_price > 0
    ORDER BY total_inflow DESC
  `).all(since);

  console.log(`[BACKTEST] ${signals.length} signals to evaluate (last ${sinceDays}d)\n`);

  const upsert = db.prepare(`
    INSERT INTO signal_backtest
      (token_address, token_symbol, token_name, wallet_count, total_inflow,
       signal_ts, entry_price, peak_price_30d, peak_gain_pct, current_price, current_pct, candle_days, computed_at)
    VALUES (@token_address, @token_symbol, @token_name, @wallet_count, @total_inflow,
            @signal_ts, @entry_price, @peak_price_30d, @peak_gain_pct, @current_price, @current_pct, @candle_days, @computed_at)
    ON CONFLICT(token_address) DO UPDATE SET
      peak_price_30d=@peak_price_30d, peak_gain_pct=@peak_gain_pct,
      current_price=@current_price, current_pct=@current_pct,
      candle_days=@candle_days, computed_at=@computed_at
  `);

  let ok = 0, skip = 0, cachedCount = 0;
  const checkCache = db.prepare('SELECT computed_at FROM signal_backtest WHERE token_address = ?');

  for (const s of signals) {
    const cached = checkCache.get(s.token_address);
    if (cached && cached.computed_at > Date.now() - 24 * 3600 * 1000) {
      cachedCount++;
      continue;
    }

    const pool = await getTopPool(s.token_address);
    await sleep(PACE_MS);
    if (!pool) {
      skip++;
      console.log(`  ⏭  ${s.token_symbol} — no pool`);
      upsert.run({
        token_address: s.token_address,
        token_symbol: s.token_symbol,
        token_name: s.token_name,
        wallet_count: s.wallet_count,
        total_inflow: s.total_inflow,
        signal_ts: s.signal_ts,
        entry_price: -1,
        peak_price_30d: -1,
        peak_gain_pct: -100,
        current_price: -1,
        current_pct: -100,
        candle_days: 0,
        computed_at: Date.now(),
      });
      continue;
    }

    const candles = await getDailyCandles(pool);
    await sleep(PACE_MS);
    if (!candles.length) {
      skip++;
      console.log(`  ⏭  ${s.token_symbol} — no candles`);
      upsert.run({
        token_address: s.token_address,
        token_symbol: s.token_symbol,
        token_name: s.token_name,
        wallet_count: s.wallet_count,
        total_inflow: s.total_inflow,
        signal_ts: s.signal_ts,
        entry_price: -1,
        peak_price_30d: -1,
        peak_gain_pct: -100,
        current_price: -1,
        current_pct: -100,
        candle_days: 0,
        computed_at: Date.now(),
      });
      continue;
    }

    const within30 = candles.filter(c => c[0] * 1000 >= s.signal_ts && c[0] * 1000 <= s.signal_ts + 30 * 86400000);
    if (!within30.length) {
      skip++;
      console.log(`  ⏭  ${s.token_symbol} — no post-signal candles`);
      upsert.run({
        token_address: s.token_address,
        token_symbol: s.token_symbol,
        token_name: s.token_name,
        wallet_count: s.wallet_count,
        total_inflow: s.total_inflow,
        signal_ts: s.signal_ts,
        entry_price: -1,
        peak_price_30d: -1,
        peak_gain_pct: -100,
        current_price: -1,
        current_pct: -100,
        candle_days: 0,
        computed_at: Date.now(),
      });
      continue;
    }

    const peakHigh = Math.max(...within30.map(c => c[2]));
    const peakGain = ((peakHigh - s.entry_price) / s.entry_price) * 100;
    const currentPrice = candles[0][4];
    const currentPct = ((currentPrice - s.entry_price) / s.entry_price) * 100;

    upsert.run({
      token_address: s.token_address,
      token_symbol: s.token_symbol,
      token_name: s.token_name,
      wallet_count: s.wallet_count,
      total_inflow: s.total_inflow,
      signal_ts: s.signal_ts,
      entry_price: s.entry_price,
      peak_price_30d: peakHigh,
      peak_gain_pct: parseFloat(peakGain.toFixed(2)),
      current_price: currentPrice,
      current_pct: parseFloat(currentPct.toFixed(2)),
      candle_days: within30.length,
      computed_at: Date.now(),
    });
    ok++;
    console.log(`  ✅ ${s.token_symbol.padEnd(12)} peak +${peakGain.toFixed(1)}%  now ${currentPct >= 0 ? '+' : ''}${currentPct.toFixed(1)}%  (${within30.length}d)`);
  }

  console.log(`\n[BACKTEST] Done. ${ok} computed, ${cachedCount} cached, ${skip} skipped.`);
  db.close();
}

main();
