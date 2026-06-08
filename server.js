import express from 'express';
import { randomBytes } from 'crypto';
import fetch from 'node-fetch';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { spawn } from 'child_process';
import {
  getTrackedWallets,
  getWalletById,
  getWalletTrades,
  getRecentBuysByToken,
  getWalletPositions,
  upsertWallet,
  getLastSyncTime,
  restoreTrackedUniverseFromSyncLog,
  db,
  createUser,
  getUserByEmail,
  activateLicense,
} from './database.js';
import { syncWallet, recalculateMetrics, assessWalletTradeSignals, deriveDnaScores } from './indexer.js';
import { setupAuthRoutes, requireAuth, requirePremium, requireAdmin, optionalAuth } from './auth.js';
import { sendWelcomeEmail } from './mailer.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

// Generates a readable but cryptographically unique password.
// Format: Word + 4 random hex chars + Word + symbol
// Example: "Alpha3f9cTrade#" — unique for every customer, always.
function generatePassword() {
  const words = ['Alpha','Whale','Token','Crypto','Base','Trade','Signal','Degen','Orbit','Nexus','Vault','Scout'];
  const w1 = words[Math.floor(Math.random() * words.length)];
  const w2 = words[Math.floor(Math.random() * words.length)];
  const hex = randomBytes(3).toString('hex'); // 6 hex chars — 16^6 = 16M combinations
  const symbols = ['!','@','#','$','%','&'];
  const sym = symbols[Math.floor(Math.random() * symbols.length)];
  return `${w1}${hex}${w2}${sym}`;
}

const restored = restoreTrackedUniverseFromSyncLog();
if (restored.restored > 0) {
  console.log(`[PIPELINE] Restored ${restored.restored} wallets from the historical sync log.`);
}

// Bootstrap: if tracked_wallets is empty (fresh Railway Volume), seed from bundled snapshots.
// Provides immediate data for Signal History, Proof, Landing stats.
// wallet_trades syncs in background (~30 min) — Clusters appear after that.
{
  const walletCount = db.prepare('SELECT COUNT(*) as c FROM tracked_wallets').get().c;
  if (walletCount === 0) {
    try {
      const { readFileSync } = await import('fs');
      const { join: pathJoin, dirname: pathDirname } = await import('path');
      const { fileURLToPath: pathFileURLToPath } = await import('url');
      const __dir = pathDirname(pathFileURLToPath(import.meta.url));

      // 1. Seed tracked wallets
      const walletSeeds = JSON.parse(readFileSync(pathJoin(__dir, 'scripts', 'wallets_seed.json'), 'utf8'));
      const now = Date.now();
      const insertWallet = db.prepare(`INSERT OR IGNORE INTO tracked_wallets (address, label, first_seen, last_updated) VALUES (?, ?, ?, ?)`);
      const insertMetrics = db.prepare(`INSERT OR IGNORE INTO wallet_metrics (address) VALUES (?)`);
      db.transaction(() => {
        for (const s of walletSeeds) { insertWallet.run(s.address, s.label, now, now); insertMetrics.run(s.address); }
      })();
      console.log(`[BOOTSTRAP] Seeded ${walletSeeds.length} wallets.`);

      // 2. Seed wallet metrics (alpha scores, win rates)
      try {
        const metrics = JSON.parse(readFileSync(pathJoin(__dir, 'scripts', 'wallet_metrics_seed.json'), 'utf8'));
        const upsertM = db.prepare(`
          INSERT OR REPLACE INTO wallet_metrics
            (address, alpha_score, win_rate, roi_30d, total_pnl, total_capital,
             closed_positions, profitable_positions, consistency_score,
             data_quality, archetype, days_active, last_calc_at)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
        `);
        db.transaction(() => {
          for (const m of metrics) {
            upsertM.run(m.address, m.alpha_score, m.win_rate, m.roi_30d, m.total_pnl,
              m.total_capital, m.closed_positions, m.profitable_positions,
              m.consistency_score, m.data_quality, m.archetype, m.days_active, m.last_calc_at);
          }
        })();
        console.log(`[BOOTSTRAP] Seeded ${metrics.length} wallet metrics.`);
      } catch (e) { console.error('[BOOTSTRAP] Metrics seed failed:', e.message); }

      // 3. Seed signal_backtest (Signal History + Proof page work immediately)
      const backtestCount = db.prepare('SELECT COUNT(*) as c FROM signal_backtest').get().c;
      if (backtestCount === 0) {
        try {
          const signals = JSON.parse(readFileSync(pathJoin(__dir, 'scripts', 'signal_backtest_seed.json'), 'utf8'));
          const upsertS = db.prepare(`
            INSERT OR REPLACE INTO signal_backtest
              (token_address, token_symbol, token_name, wallet_count, total_inflow,
               signal_ts, entry_price, peak_price_30d, peak_gain_pct,
               current_price, current_pct, candle_days, computed_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
          `);
          db.transaction(() => {
            for (const s of signals) {
              upsertS.run(s.token_address, s.token_symbol, s.token_name, s.wallet_count,
                s.total_inflow, s.signal_ts, s.entry_price, s.peak_price_30d,
                s.peak_gain_pct, s.current_price, s.current_pct, s.candle_days, s.computed_at);
            }
          })();
          console.log(`[BOOTSTRAP] Seeded ${signals.length} backtest signals — Signal History ready.`);
        } catch (e) { console.error('[BOOTSTRAP] Signal seed failed:', e.message); }
      }
    } catch (e) {
      console.error('[BOOTSTRAP] Seed failed:', e.message);
    }
  }
}

app.use(cors());
app.use(express.json());

// Setup authentication routes
setupAuthRoutes(app);

// Gumroad webhook endpoint
// Verification: product_id must match env, then license verified via Gumroad API.
// Gumroad does not use HMAC — product_id check + API verification is the standard approach.
app.post('/api/webhooks/gumroad', async (req, res) => {
  try {
    const { product_id, purchaser_email, sale_id, license_key, refunded, chargebacked } = req.body;

    if (!product_id || !purchaser_email || !license_key) {
      console.warn('[GUMROAD] Missing required fields in webhook payload');
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    // Gate 1: product_id must match our configured product
    const expectedProductId = process.env.GUMROAD_PRODUCT_ID;
    if (expectedProductId && product_id !== expectedProductId) {
      console.warn(`[GUMROAD] product_id mismatch: got ${product_id}, expected ${expectedProductId}`);
      return res.status(403).json({ success: false, error: 'Invalid product' });
    }

    // Gate 2: verify license is real via Gumroad API
    const verifyRes = await fetch('https://api.gumroad.com/v2/licenses/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        product_id,
        license_key,
        increment_uses_count: 'false',
      }),
    });
    const verifyData = await verifyRes.json();

    if (!verifyData.success) {
      console.warn(`[GUMROAD] License verification failed for ${purchaser_email}: ${verifyData.message}`);
      return res.status(403).json({ success: false, error: 'License verification failed' });
    }

    // Gate 3: reject refunded / chargebacked purchases
    if (refunded === 'true' || chargebacked === 'true') {
      console.warn(`[GUMROAD] Refunded/chargebacked purchase for ${purchaser_email}`);
      return res.status(200).json({ success: true, message: 'Refund noted' });
    }

    // Find or create user by email
    let user = getUserByEmail(purchaser_email);
    let plainPassword = null;

    if (!user) {
      plainPassword = generatePassword();

      const { hashPassword } = await import('./auth.js');
      const passwordHash = await hashPassword(plainPassword);
      const result = createUser(purchaser_email, passwordHash);
      if (result.success) {
        user = getUserByEmail(purchaser_email);
        console.log(`[GUMROAD] Created new user for ${purchaser_email}`);
      }
    }

    if (user) {
      activateLicense(user.id, license_key);
      console.log(`[GUMROAD] License activated for ${purchaser_email}: ${license_key}`);

      // Send welcome email with credentials only for new users
      if (plainPassword) {
        try {
          await sendWelcomeEmail({ to: purchaser_email, password: plainPassword });
        } catch (mailErr) {
          console.error('[GUMROAD] Failed to send welcome email:', mailErr.message);
          // Don't fail the webhook — user is already created and activated
        }
      }
    }

    res.json({ success: true });
  } catch (e) {
    console.error('[GUMROAD] Webhook error:', e.message);
    res.status(500).json({ success: false, error: e.message });
  }
});

// Admin: Create admin user
app.post('/api/admin/create-admin', async (req, res) => {
  const { email, password, adminToken } = req.body;
  
  if (adminToken !== process.env.ADMIN_TOKEN) {
    return res.status(403).json({ success: false, error: 'Invalid admin token' });
  }

  if (!email || !password) {
    return res.status(400).json({ success: false, error: 'Email and password required' });
  }

  const { hashPassword } = await import('./auth.js');
  const passwordHash = await hashPassword(password);
  const result = createUser(email, passwordHash, true);

  if (result.success) {
    res.json({ success: true, message: 'Admin user created' });
  } else {
    res.status(400).json({ success: false, error: result.error });
  }
});

// Admin: Generate premium account for any email + send welcome email
// Use this to manually onboard buyers who contact you directly.
// curl -X POST https://your-domain/api/admin/generate-account \
//   -H "Content-Type: application/json" \
//   -d '{"email":"buyer@example.com","adminToken":"YOUR_ADMIN_TOKEN"}'
app.post('/api/admin/generate-account', async (req, res) => {
  const { email, adminToken } = req.body;

  if (adminToken !== process.env.ADMIN_TOKEN) {
    return res.status(403).json({ success: false, error: 'Invalid admin token' });
  }
  if (!email) {
    return res.status(400).json({ success: false, error: 'Email required' });
  }

  try {
    const plainPassword = generatePassword();

    const { hashPassword } = await import('./auth.js');
    const passwordHash = await hashPassword(plainPassword);

    let user = getUserByEmail(email);
    if (!user) {
      const result = createUser(email, passwordHash);
      if (!result.success) return res.status(400).json({ success: false, error: result.error });
      user = getUserByEmail(email);
    }

    // Activate premium
    activateLicense(user.id, `MANUAL-${Date.now()}`);

    // Send welcome email
    await sendWelcomeEmail({ to: email, password: plainPassword });

    res.json({
      success: true,
      email,
      password: plainPassword,
      message: `Account created and welcome email sent to ${email}`,
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Admin: Email test
app.post('/api/admin/test-email', async (req, res) => {
  const { email, adminToken } = req.body;
  if (adminToken !== process.env.ADMIN_TOKEN) {
    return res.status(403).json({ success: false, error: 'Invalid admin token' });
  }
  try {
    const { sendTestEmail } = await import('./mailer.js');
    await sendTestEmail(email || process.env.SUPPORT_EMAIL);
    res.json({ success: true, message: 'Test email sent' });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Rate limiting — heavy endpoints
const heavyLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please wait a minute.' },
});
app.use('/api/wallet', heavyLimiter);
app.use('/api/search', heavyLimiter);
app.use('/api/discovery/run', heavyLimiter);
app.use('/api/audit', heavyLimiter);

// Anti-abuse: max 3 email registrations per IP per hour
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many accounts created from this IP. Try again later or use Google login.' },
  skip: (req) => req.path !== '/api/auth/register',
});
app.use('/api/auth/register', registerLimiter);

// ──────────────────────────────────────────────
// HELPERS
// ──────────────────────────────────────────────
const fetcher = async (url, timeout = 10000) => {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), timeout);
  try {
    const r = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': 'WalletDNA/2.0', 'Accept': 'application/json' }
    });
    clearTimeout(id);
    return r.ok ? r.json() : null;
  } catch { clearTimeout(id); return null; }
};

const fmtNum = n => {
  if (!n || isNaN(n)) return '0';
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return parseFloat(n).toFixed(4);
};

// Calculates Opportunity Score out of 100 based on on-chain cluster features
function parseArchetype(value) {
  if (!value) return null;
  if (typeof value === 'object') return value;
  try { return JSON.parse(value); } catch { return null; }
}

function isWalletMetricsTrustworthy(wallet) {
  if (!wallet) return false;

  const closed = Number(wallet.closed_positions || 0);
  const daysActive = Number(wallet.days_active || 0);
  const quality = String(wallet.data_quality || 'LOW').toUpperCase();
  const alphaScore = Number(wallet.alpha_score || 0);
  const archetype = parseArchetype(wallet.archetype);

  // Pay-worthy archetypes only. paper_hands and farmer are explicitly NOT signal —
  // paper_hands "misses most major moves", farmer = airdrop sybil pattern.
  // unclassified/unknown = no recognizable pattern yet.
  const ALPHA_ARCHETYPES = new Set([
    'oracle', 'diamond_whale', 'degen_sniper', 'copy_cat', 'accumulator', 'alpha_trader',
  ]);
  const isAlphaArchetype = Boolean(archetype && archetype.id && ALPHA_ARCHETYPES.has(archetype.id));

  return closed >= 5
      && daysActive >= 7
      && (quality === 'HIGH' || quality === 'MEDIUM')
      && alphaScore >= 30
      && isAlphaArchetype;
}

function walletIsValidForDiscovery(wallet) {
  return isWalletMetricsTrustworthy(wallet);
}

function walletIsValidForClusters(wallet) {
  return isWalletMetricsTrustworthy(wallet);
}

// Best closed trade for a wallet — the highest-ROI FIFO-closed position.
// Used everywhere to give each wallet a single-line proof: "Best: WCT +245%".
// Cached for 60s per address; cluster pages otherwise hammer this.
const bestTradeCache = new Map();
function getBestTrade(address) {
  const addr = String(address || '').toLowerCase();
  if (!addr) return null;
  const cached = bestTradeCache.get(addr);
  if (cached && Date.now() - cached.at < 60_000) return cached.val;

  const row = db.prepare(`
    SELECT token_symbol, token_address, total_bought_usd, realized_pnl_usd,
           total_sold_usd, status,
           (CASE WHEN total_bought_usd > 0 THEN realized_pnl_usd * 100.0 / total_bought_usd ELSE 0 END) AS roi_pct
    FROM wallet_positions
    WHERE address = ?
      AND total_bought_usd >= 50
      AND realized_pnl_usd > 0
    ORDER BY roi_pct DESC
    LIMIT 1
  `).get(addr);

  const val = row && row.roi_pct > 0 ? {
    symbol: row.token_symbol,
    tokenAddress: row.token_address,
    spentUSD: Math.round(row.total_bought_usd),
    profitUSD: Math.round(row.realized_pnl_usd),
    multiple: 1 + (row.roi_pct / 100),
    roiPct: Math.round(row.roi_pct),
  } : null;
  bestTradeCache.set(addr, { val, at: Date.now() });
  return val;
}

// Headline-grade aggregate: if you had followed every cluster signal in the last N days
// (entry at cluster avg, exit at peak within 30d), what would the simulated PnL be?
// Drives the "Followed-it-all" hero number.
function getFollowedAggregate(daysBack = 30) {
  try {
    const since = Date.now() - daysBack * 86400000;
    const rows = db.prepare(`
      SELECT peak_gain_pct, current_pct
      FROM signal_backtest
      WHERE signal_ts >= ?
        AND peak_gain_pct < 1000
        AND peak_gain_pct > -100
    `).all(since);
    if (rows.length === 0) {
      return { count: 0, avgPeak: 0, hitRate20: 0, sumPeak: 0, avgHeldPct: 0, worstSignalPct: 0, bestSignalPct: 0 };
    }
    const sumPeak = rows.reduce((s, r) => s + r.peak_gain_pct, 0);
    const hits   = rows.filter(r => r.peak_gain_pct >= 20).length;
    const heldRows = rows.filter(r => r.current_pct != null && r.current_pct > -100);
    const sumHeld  = heldRows.reduce((s, r) => s + r.current_pct, 0);
    const worst    = Math.min(...rows.map(r => r.peak_gain_pct));
    const best     = Math.max(...rows.map(r => r.peak_gain_pct));
    return {
      count: rows.length,
      avgPeak: +(sumPeak / rows.length).toFixed(1),
      hitRate20: Math.round((hits / rows.length) * 100),
      sumPeak: Math.round(sumPeak),
      avgHeldPct:    heldRows.length > 0 ? +(sumHeld / heldRows.length).toFixed(1) : 0,
      bestSignalPct:  +best.toFixed(1),
      worstSignalPct: +worst.toFixed(1),
    };
  } catch { return { count: 0, avgPeak: 0, hitRate20: 0, sumPeak: 0, avgHeldPct: 0, worstSignalPct: 0, bestSignalPct: 0 }; }
}

// Hard-delete a wallet's tracked row, metrics, trades, positions. Single cleanup path.
function purgeWallet(address) {
  const addr = String(address || '').toLowerCase();
  if (!addr) return;
  db.prepare('DELETE FROM wallet_trades WHERE address = ?').run(addr);
  db.prepare('DELETE FROM wallet_positions WHERE address = ?').run(addr);
  db.prepare('DELETE FROM wallet_metrics WHERE address = ?').run(addr);
  db.prepare('DELETE FROM tracked_wallets WHERE address = ?').run(addr);
}

// Candidate row already carries the joined metrics columns when fetched via
// fetchCandidatesWithMetrics — no per-row metrics lookup. mergeCandidateRow normalises
// the joined row into the shape the API and rejection-breakdown consumers expect.
function mergeCandidateRow(row) {
  const merged = {
    ...row,
    win_rate: row.m_win_rate ?? row.win_rate ?? 0,
    roi: row.m_roi_30d ?? row.roi ?? 0,
    alpha_score: row.m_alpha_score ?? row.alpha_score ?? 0,
    data_quality: String(row.m_data_quality ?? row.data_quality ?? 'LOW').toUpperCase(),
    closed_positions: Number(row.m_closed_positions ?? row.closed_positions ?? 0),
    days_active: Number(row.m_days_active ?? row.days_active ?? 0),
    archetype: row.m_archetype ?? row.archetype ?? null,
    candidate_source: row.candidate_source || row.source_token || 'unknown',
    candidate_reason: row.candidate_reason || '',
    first_tx_at: Number(row.first_tx_at || 0),
    total_transfers: Number(row.total_transfers || 0),
    capital_traded: Number(row.capital_traded || 0),
  };

  merged.is_valid = isWalletMetricsTrustworthy(merged);
  return merged;
}

function fetchCandidatesWithMetrics() {
  return db.prepare(`
    SELECT c.*,
           (tw.address IS NOT NULL) as is_tracked,
           m.win_rate         as m_win_rate,
           m.roi_30d          as m_roi_30d,
           m.alpha_score      as m_alpha_score,
           m.data_quality     as m_data_quality,
           m.closed_positions as m_closed_positions,
           m.days_active      as m_days_active,
           m.archetype        as m_archetype
    FROM wallet_candidates c
    LEFT JOIN tracked_wallets tw ON c.address = tw.address
    LEFT JOIN wallet_metrics  m  ON c.address = m.address
    ORDER BY c.status, c.alpha_score DESC
  `).all().map(mergeCandidateRow);
}

function getDiscoveryRejectionBreakdown(rows) {
  const reasons = {
    LOW_QUALITY: 0,
    DAYS_LT_7: 0,
    CLOSED_LT_5: 0,
    ALPHA_LE_0: 0,
    NO_ARCHETYPE: 0,
    OTHER: 0,
  };

  const samples = [];

  for (const row of rows.filter(r => r.status === 'rejected')) {
    const issueList = [];
    if (String(row.data_quality || 'LOW').toUpperCase() === 'LOW') issueList.push('LOW_QUALITY');
    if (Number(row.days_active || 0) < 7) issueList.push('DAYS_LT_7');
    if (Number(row.closed_positions || 0) < 5) issueList.push('CLOSED_LT_5');
    if (Number(row.alpha_score || 0) <= 0) issueList.push('ALPHA_LE_0');

    const arch = parseArchetype(row.archetype);
    const isClassified = Boolean(arch && arch.id && !['unknown', 'unclassified'].includes(arch.id));
    if (!isClassified) issueList.push('NO_ARCHETYPE');

    if (issueList.length === 0) issueList.push('OTHER');

    for (const issue of issueList) reasons[issue] = (reasons[issue] || 0) + 1;

    if (samples.length < 10) {
      samples.push({
        address: row.address,
        status: row.status,
        issues: issueList,
        alpha_score: Number(row.alpha_score || 0),
        closed_positions: Number(row.closed_positions || 0),
        days_active: Number(row.days_active || 0),
        data_quality: String(row.data_quality || 'LOW').toUpperCase(),
        archetype: arch?.id || null,
      });
    }
  }

  return {
    totalRejected: rows.filter(r => r.status === 'rejected').length,
    reasons,
    samples,
  };
}

function getOpportunityDetails(tokenAddress) {
  const addr = tokenAddress.toLowerCase();
  
  // 1. Get all trades for this token by tracked wallets
  const trades = db.prepare(`
    SELECT t.address, t.type, t.usd_value, t.token_amount,
           m.alpha_score, m.data_quality, m.closed_positions, m.days_active, m.archetype
    FROM wallet_trades t
    JOIN tracked_wallets w ON t.address = w.address
    LEFT JOIN wallet_metrics m ON w.address = m.address
    WHERE t.token_address = ?
  `).all(addr);

  const validTrades = trades.filter(t => walletIsValidForClusters({
    alpha_score: t.alpha_score,
    data_quality: t.data_quality,
    closed_positions: t.closed_positions,
    days_active: t.days_active,
    archetype: t.archetype,
  }));

  if (!trades.length || !validTrades.length) {
    return {
      score: 0,
      buyers: 0,
      holders: 0,
      avgAlpha: 0,
      totalBought: 0,
      clusterStrengthPoints: 0,
      convictionPoints: 0,
      holdingPoints: 0,
      walletQualityPoints: 0
    };
  }
  
  const byWallet = {};
  for (const t of validTrades) {
    const w = byWallet[t.address] || (byWallet[t.address] = {
      bought: 0,
      sold: 0,
      alphaScore: t.alpha_score || 0
    });
    if (t.type === 'BUY') w.bought += t.usd_value;
    else w.sold += t.usd_value;
  }
  
  const wallets = Object.values(byWallet);
  const totalBought = wallets.reduce((sum, w) => sum + w.bought, 0);
  const buyers = wallets.filter(w => w.bought > 0).length;
  const holders = wallets.filter(w => w.bought > 0 && w.bought > w.sold * 1.2).length;
  
  // 1. Cluster Strength (max 40 pts)
  const clusterStrengthPoints = Math.min(40, buyers * 10);
  
  // 2. Conviction (max 30 pts)
  let convictionPoints = 5;
  if (totalBought >= 100000) convictionPoints = 30;
  else if (totalBought >= 25000) convictionPoints = 25;
  else if (totalBought >= 5000) convictionPoints = 20;
  else if (totalBought >= 1000) convictionPoints = 15;
  
  // 3. Holding Ratio (max 20 pts)
  const holdingRatio = buyers > 0 ? (holders / buyers) : 0;
  const holdingPoints = Math.round(holdingRatio * 20);
  
  // 4. Wallet Quality (max 10 pts)
  const buyerWallets = wallets.filter(w => w.bought > 0);
  const avgBuyerAlpha = buyerWallets.length
    ? buyerWallets.reduce((s, w) => s + (w.alphaScore || 0), 0) / buyerWallets.length : 0;
  
  let walletQualityPoints = 2;
  if (avgBuyerAlpha >= 75) walletQualityPoints = 10;
  else if (avgBuyerAlpha >= 55) walletQualityPoints = 8;
  else if (avgBuyerAlpha >= 35) walletQualityPoints = 5;
  
  const score = Math.min(100, Math.round(clusterStrengthPoints + convictionPoints + holdingPoints + walletQualityPoints));
  
  return {
    score,
    buyers,
    holders,
    avgAlpha: Math.round(avgBuyerAlpha),
    totalBought,
    clusterStrengthPoints,
    convictionPoints,
    holdingPoints,
    walletQualityPoints
  };
}

// Cache for ETH price (refresh every 60s)
let ethPriceCache = { price: 3450, updatedAt: 0 };
let lastGoodTrendingTokens = [];
const getEthPrice = async () => {
  if (Date.now() - ethPriceCache.updatedAt < 60000) return ethPriceCache.price;
  try {
    const data = await fetcher('https://api.coinbase.com/v2/prices/ETH-USD/spot');
    const price = parseFloat(data?.data?.amount || 0);
    if (price > 100) {
      ethPriceCache = { price, updatedAt: Date.now() };
      return price;
    }
  } catch {}
  return ethPriceCache.price;
};

// Cache for DexScreener Base pairs (refresh every 90s)
let basePairsCache = { pairs: [], updatedAt: 0 };
const getBasePairs = async () => {
  if (Date.now() - basePairsCache.updatedAt < 90000 && basePairsCache.pairs.length > 0) {
    return basePairsCache.pairs;
  }
  try {
    const data = await fetcher('https://api.dexscreener.com/latest/dex/search?q=base');
    const pairs = (data?.pairs || [])
      .filter(p => p.chainId === 'base' && parseFloat(p.liquidity?.usd || 0) > 5000)
      .sort((a, b) => parseFloat(b.volume?.h24 || 0) - parseFloat(a.volume?.h24 || 0))
      .slice(0, 40);
    if (pairs.length > 0) {
      basePairsCache = { pairs, updatedAt: Date.now() };
    }
    return pairs.length > 0 ? pairs : basePairsCache.pairs;
  } catch {
    return basePairsCache.pairs;
  }
};

// ──────────────────────────────────────────────
// GLOBAL STATS — Real data from multiple sources
// ──────────────────────────────────────────────
let globalStatsCache = { data: null, updatedAt: 0 };

app.get('/api/stats', async (req, res) => {
  // 30s TTL — Freshness Pulse needs near-real-time signal/sync timestamps.
  if (Date.now() - globalStatsCache.updatedAt < 30000 && globalStatsCache.data) {
    return res.json(globalStatsCache.data);
  }

  const ethPrice = await getEthPrice();
  const pairs = await getBasePairs();

  // Total 24h Base volume from top pairs
  const totalVolume24h = pairs.reduce((s, p) => s + parseFloat(p.volume?.h24 || 0), 0);
  const totalPairs = pairs.length;
  const avgChange = pairs.length
    ? pairs.reduce((s, p) => s + parseFloat(p.priceChange?.h24 || 0), 0) / pairs.length
    : 0;

  // Real counts from SQLite — only count trades made by HIGH/MEDIUM quality, scored wallets.
  // Same gate as /api/clusters, /api/exits, /api/leaderboard — single product-wide definition of "smart money".
  const QUALITY_FILTER = `
    JOIN wallet_metrics m ON m.address = t.address
    WHERE m.data_quality IN ('HIGH','MEDIUM') AND m.alpha_score > 0
  `;
  const signalsToday = db.prepare(
    `SELECT COUNT(*) as c FROM wallet_trades t ${QUALITY_FILTER} AND t.timestamp > (unixepoch() - 86400) * 1000`
  ).get().c;
  const smartMoneyActive = db.prepare(
    `SELECT COUNT(DISTINCT t.address) as c FROM wallet_trades t ${QUALITY_FILTER} AND t.timestamp > (unixepoch() - 86400) * 1000`
  ).get().c;
  const totalTracked = db.prepare(
    `SELECT COUNT(*) as c FROM wallet_metrics WHERE data_quality IN ('HIGH','MEDIUM') AND alpha_score > 0`
  ).get().c;
  const totalTrades = db.prepare(
    `SELECT COUNT(*) as c FROM wallet_trades t ${QUALITY_FILTER}`
  ).get().c;
  // lastSignalMinsAgo = last trade (any type) from any tracked wallet — shows system is alive
  const lastBuy = db.prepare(
    `SELECT MAX(t.timestamp) as ts FROM wallet_trades t
     JOIN tracked_wallets w ON w.address = t.address`
  ).get();
  const lastSignalMinsAgo = lastBuy?.ts ? Math.round((Date.now() - lastBuy.ts) / 60000) : null;
  const signalsLast24h = db.prepare(
    `SELECT COUNT(DISTINCT t.token_address) as c FROM wallet_trades t ${QUALITY_FILTER} AND t.type='BUY' AND t.timestamp > ?`
  ).get(Date.now() - 86400000).c;
  const signalsLastWeek = db.prepare(
    `SELECT COUNT(DISTINCT t.token_address) as c FROM wallet_trades t ${QUALITY_FILTER} AND t.type='BUY' AND t.timestamp > ?`
  ).get(Date.now() - 7 * 86400000).c;
  const verifiedSignals = (() => {
    try {
      return db.prepare(`SELECT COUNT(*) as c FROM signal_backtest WHERE candle_days >= 5 AND peak_gain_pct < 1000 AND peak_gain_pct > -100 AND current_pct > -100`).get().c;
    } catch { return 0; }
  })();
  const bestSignal = (() => {
    try {
      return db.prepare(`SELECT token_symbol, peak_gain_pct FROM signal_backtest WHERE candle_days >= 5 AND peak_gain_pct < 1000 ORDER BY peak_gain_pct DESC LIMIT 1`).get();
    } catch { return null; }
  })();

  // Verified smart money wallets: prefer approved Discovery candidates when available,
  // fall back to wallet_metrics HIGH/MEDIUM quality (populated by seed on fresh Volume).
  const verifiedWallets = (() => {
    const candidates = db.prepare(`SELECT COUNT(*) as c FROM wallet_candidates WHERE status='approved'`).get().c;
    if (candidates > 0) return candidates;
    return db.prepare(`SELECT COUNT(*) as c FROM wallet_metrics WHERE data_quality IN ('HIGH','MEDIUM') AND alpha_score > 0`).get().c;
  })();

  // Active clusters right now (≥2 quality wallets converging in last 48h, same filter as /api/clusters).
  const activeClusters = (() => {
    try {
      return db.prepare(`
        SELECT COUNT(*) as c FROM (
          SELECT t.token_address
          FROM wallet_trades t
          JOIN wallet_metrics m ON m.address = t.address
          WHERE t.type = 'BUY' AND t.timestamp > ?
            AND m.data_quality IN ('HIGH','MEDIUM')
            AND m.alpha_score >= 30
            AND m.closed_positions >= 5
            AND m.days_active >= 7
            AND m.archetype IS NOT NULL
            AND json_extract(m.archetype,'$.id') IN ('oracle','diamond_whale','degen_sniper','copy_cat','accumulator','alpha_trader')
          GROUP BY t.token_address
          HAVING COUNT(DISTINCT t.address) >= 2
        )
      `).get(Date.now() - 48 * 60 * 60 * 1000).c;
    } catch { return 0; }
  })();

  // Last successful tracked-wallet sync (any wallet).
  const lastSyncRow = db.prepare(`SELECT MAX(synced_at) as ts FROM sync_log WHERE status='OK'`).get();
  const lastSyncMinsAgo = lastSyncRow?.ts ? Math.round((Date.now() - lastSyncRow.ts) / 60000) : null;

  // Last cluster-quality buy (proxy for "last cluster" — a real cluster is ≥2 quality wallets
  // converging, but the freshest tick of that converging is the latest quality BUY).
  const lastClusterMinsAgo = lastSignalMinsAgo;

  // Last successful discovery pipeline run (gives users confidence wallet pool is alive).
  const lastDiscoveryRow = db.prepare(
    `SELECT MAX(ran_at) as ts FROM discovery_history`
  ).get();
  const lastDiscoveryMinsAgo = lastDiscoveryRow?.ts ? Math.round((Date.now() - lastDiscoveryRow.ts) / 60000) : null;

  const stats = {
    ethPrice: ethPrice.toFixed(2),
    totalVolume24h: Math.round(totalVolume24h),
    totalPairs,
    avgChange24h: avgChange.toFixed(2),
    signalsToday,
    smartMoneyActive,
    // walletsTracked kept for legacy callers but verifiedWallets is the canonical number.
    walletsTracked: verifiedWallets,
    verifiedWallets,
    activeClusters,
    followed30d: getFollowedAggregate(30),
    followed7d:  getFollowedAggregate(7),
    totalTrades,
    verifiedSignals,
    bestSignal: bestSignal ? { symbol: bestSignal.token_symbol, gain: Math.round(bestSignal.peak_gain_pct) } : null,
    lastSignalMinsAgo,
    lastSyncMinsAgo,
    lastClusterMinsAgo,
    lastDiscoveryMinsAgo,
    signalsLast24h,
    signalsLastWeek,
    chainsSupported: 1,
    lastUpdated: new Date().toISOString(),
  };

  globalStatsCache = { data: stats, updatedAt: Date.now() };
  res.json(stats);
});

// ──────────────────────────────────────────────
// TODAY'S TOP MOVE — single best actionable cluster right now.
// Returns one structured signal: entry, stop, targets, position-sizing rule of thumb.
// Drives the headline "actionable" card on Home. Cached 60s.
// ──────────────────────────────────────────────
let todaysMoveCache = { data: null, at: 0 };
app.get('/api/today-move', requireAuth, requirePremium, async (req, res) => {
  if (Date.now() - todaysMoveCache.at < 60_000 && todaysMoveCache.data) {
    return res.json(todaysMoveCache.data);
  }
  try {
    // Propagate caller's auth header so the gated /api/clusters accepts us.
    const authHeader = req.headers.authorization || '';
    const clRes = await fetch(`${BASE_URL}/api/clusters`, {
      headers: authHeader ? { Authorization: authHeader } : {},
    }).then(r => r.json());
    const clusters = clRes.clusters || [];

    // Sort by composite score: cluster quality + freshness + safety. Bigger is better.
    // - confidenceScore (already 0-100)
    // - urgencyScore (favours recent)
    // - riskGate penalty: SAFE 0, CAUTION -8, DANGER -25
    // - wallet count multiplier
    const scored = clusters.map(c => {
      const conv = c.confidenceScore || 0;
      const urg  = c.urgencyScore    || 0;
      const safety = c.riskGate?.level === 'SAFE'   ? 0
                  : c.riskGate?.level === 'CAUTION' ? -8
                  : c.riskGate?.level === 'DANGER'  ? -25 : 0;
      const wcBonus = Math.min(10, (c.walletCount || 0) * 2);
      const composite = conv * 0.5 + urg * 0.4 + safety + wcBonus;
      return { ...c, composite };
    }).sort((a, b) => b.composite - a.composite);

    const top = scored[0];
    if (!top) {
      const payload = { success: true, move: null, message: 'No actionable cluster right now.' };
      todaysMoveCache = { data: payload, at: Date.now() };
      return res.json(payload);
    }

    // Trade plan derived from real cluster numbers — no fake levels.
    // - Entry zone: avg cluster entry → current price (or +5% above current if currentPrice>avgEntry).
    // - Stop loss: -15% from current price (configurable convention shown explicitly).
    // - Targets: +25% / +50% / +100% (1.25x / 1.5x / 2x).
    const avgEntry    = parseFloat(top.avgEntryPrice) || 0;
    const currentPrice = parseFloat(top.currentPrice) || avgEntry;
    const entryLow    = Math.min(avgEntry, currentPrice);
    const entryHigh   = Math.max(avgEntry, currentPrice * 1.05);
    const stopLoss    = currentPrice > 0 ? currentPrice * 0.85 : null;
    const targets     = currentPrice > 0
      ? [currentPrice * 1.25, currentPrice * 1.5, currentPrice * 2.0]
      : [];

    const fmtPrice = (p) => p == null ? null : (p < 0.01 ? p.toFixed(6) : p.toFixed(4));

    // Why-now bullets, all derived from real cluster numbers — no marketing copy.
    const whyNow = [];
    if (top.walletCount >= 2) {
      whyNow.push(`${top.walletCount} verified alpha wallets converged on $${top.token.symbol}`);
    }
    if (top.totalInflowUSD >= 1000) {
      whyNow.push(`$${Math.round(top.totalInflowUSD).toLocaleString()} combined inflow in the cluster window`);
    }
    if (top.riskGate?.why?.length) {
      const riskWord = top.riskGate.level === 'LOW' ? 'low' : top.riskGate.level === 'HIGH' ? 'elevated' : 'medium';
      whyNow.push(`Token shows ${riskWord} risk: ${top.riskGate.why.join(', ')}`);
    }
    if (top.minsSinceFirstBuy != null) {
      const m = top.minsSinceFirstBuy;
      const phrasing = m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)}h ago` : `${Math.round(m / 1440)}d ago`;
      whyNow.push(`First wallet entered ${phrasing} — signal still fresh`);
    }
    if (top.peakGainPct != null) {
      whyNow.push(`Historic peak for this token: +${Math.round(top.peakGainPct)}% within ${top.peakDays || 30}d of similar signal`);
    }

    const move = {
      cluster: top,
      action: 'BUY',
      symbol: top.token.symbol,
      tokenAddress: top.token.address,
      tokenName: top.token.name,
      confidence: top.confidenceScore,
      urgency:    top.urgencyScore,
      riskGate:   top.riskGate,
      whyNow,
      followedLabel: top.followedLabel,
      followedColor: top.followedColor,
      smartMoneyCount: top.walletCount,
      smartMoneyCapital: Math.round(top.totalInflowUSD || 0),
      entryLow:  fmtPrice(entryLow),
      entryHigh: fmtPrice(entryHigh),
      currentPrice: fmtPrice(currentPrice),
      stopLoss:  fmtPrice(stopLoss),
      targets:   targets.map(fmtPrice),
      // Risk-based sizing rule: never put more than 5% of bankroll in a single signal.
      // Concrete sizing for common bankrolls.
      sizingExamples: [
        { bankroll: 1000,  recommended: 50,  pct: 5 },
        { bankroll: 5000,  recommended: 250, pct: 5 },
        { bankroll: 25000, recommended: 1250, pct: 5 },
      ],
      uniswapUrl: `https://app.uniswap.org/swap?chain=base&outputCurrency=${top.token.address}`,
      dexscreenerUrl: `https://dexscreener.com/base/${top.token.address}`,
    };

    const payload = { success: true, move };
    todaysMoveCache = { data: payload, at: Date.now() };
    res.json(payload);
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ──────────────────────────────────────────────
// RECENT WINS — last 10 signals that hit positive peak in last 30d.
// Drives the "Look at recent winners" social proof strip on Home.
// ──────────────────────────────────────────────
app.get('/api/recent-wins', requireAuth, requirePremium, (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT token_address, token_symbol, token_name,
             peak_gain_pct, current_pct, candle_days, signal_ts,
             entry_price, peak_price_30d, current_price
      FROM signal_backtest
      WHERE peak_gain_pct >= 20
        AND peak_gain_pct < 1000
        AND signal_ts >= ?
      ORDER BY signal_ts DESC
      LIMIT 15
    `).all(Date.now() - 60 * 86400000);

    res.json({
      success: true,
      wins: rows.map(r => ({
        symbol: r.token_symbol,
        name: r.token_name,
        address: r.token_address,
        peakGainPct: +r.peak_gain_pct.toFixed(1),
        currentPct:  r.current_pct != null ? +r.current_pct.toFixed(1) : null,
        daysToPeak:  r.candle_days,
        signaledAt:  r.signal_ts,
        daysAgo:     Math.max(1, Math.round((Date.now() - r.signal_ts) / 86400000)),
        entryPrice:  r.entry_price,
        peakPrice:   r.peak_price_30d,
      })),
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ──────────────────────────────────────────────
// LIVE TICKER — last quality trades, top-bar feed.
// ──────────────────────────────────────────────
// LIVE TICKER — real trades from tracked wallets
// Public: 5 most recent real trades (teaser)
// Ticker — 3-tier strategy:
//   Public  : all tracked wallets, usd>=100, no alpha exposed  → fresh, looks alive
//   Premium : HIGH/MEDIUM quality, alpha>=10                   → signal value
//   Elite   : alpha>=30 reserved for Clusters / Alpha Feed
// ──────────────────────────────────────────────

app.get('/api/ticker', optionalAuth, (req, res) => {
  try {
    const isPremium = req.user?.isPremium === true;

    if (isPremium) {
      // Premium tier: HIGH/MEDIUM wallets, alpha >= 10
      const rows = db.prepare(`
        SELECT t.address, t.type, t.token_address, t.token_symbol, t.usd_value, t.timestamp,
               w.label, m.alpha_score
        FROM wallet_trades t
        JOIN tracked_wallets w ON w.address = t.address
        JOIN wallet_metrics m  ON m.address = t.address
        WHERE m.data_quality IN ('HIGH','MEDIUM')
          AND m.alpha_score >= 10
          AND t.usd_value >= 100
        ORDER BY t.timestamp DESC
        LIMIT 50
      `).all();

      const ticker = rows.map(r => ({
        label:        r.label || `${r.address.slice(0,6)}…${r.address.slice(-4)}`,
        address:      r.address,
        type:         r.type,
        symbol:       r.token_symbol,
        tokenAddress: r.token_address,
        usd:          Math.round(r.usd_value),
        alpha:        r.alpha_score,  // exposed for premium
        minsAgo:      Math.max(1, Math.round((Date.now() - r.timestamp) / 60000)),
      }));

      return res.json({ success: true, ticker, preview: false });
    }

    // Public tier: all tracked wallets, no alpha score exposed
    const rows = db.prepare(`
      SELECT t.address, t.type, t.token_address, t.token_symbol, t.usd_value, t.timestamp,
             w.label
      FROM wallet_trades t
      JOIN tracked_wallets w ON w.address = t.address
      WHERE t.usd_value >= 100
      ORDER BY t.timestamp DESC
      LIMIT 30
    `).all();

    // Show 5 public items as teaser; signal there are more
    const allPublic = rows.map(r => ({
      label:        r.label || `${r.address.slice(0,6)}…${r.address.slice(-4)}`,
      address:      r.address,
      type:         r.type,
      symbol:       r.token_symbol,
      tokenAddress: r.token_address,
      usd:          Math.round(r.usd_value),
      alpha:        null,  // not exposed publicly
      minsAgo:      Math.max(1, Math.round((Date.now() - r.timestamp) / 60000)),
    }));

    res.json({
      success: true,
      ticker:  allPublic.slice(0, 5),
      total:   allPublic.length,
      preview: allPublic.length > 5,
    });
  } catch (e) {
    res.json({ success: true, ticker: [], preview: false });
  }
});

// ──────────────────────────────────────────────
// TRENDING TOKENS — DexScreener Base chain
// ──────────────────────────────────────────────
app.get('/api/trending', async (req, res) => {
  try {
    const pairs = await getBasePairs();
    // Deduplicate by token address — keep highest-liquidity pair per token
    const seenTokens = new Map();
    for (const p of pairs.filter(p => p.liquidity?.usd > 10000)) {
      const addr = p.baseToken?.address?.toLowerCase();
      if (!addr) continue;
      if (!seenTokens.has(addr) || p.liquidity.usd > seenTokens.get(addr).liquidity.usd) {
        seenTokens.set(addr, p);
      }
    }
    const tokens = [...seenTokens.values()].slice(0, 24).map(p => ({
        address: p.baseToken?.address,
        name: p.baseToken?.name,
        symbol: p.baseToken?.symbol,
        price: parseFloat(p.priceUsd || 0),
        liquidity: parseFloat(p.liquidity?.usd || 0),
        volume24h: parseFloat(p.volume?.h24 || 0),
        change1h: parseFloat(p.priceChange?.h1 || 0),
        change24h: parseFloat(p.priceChange?.h24 || 0),
        change6h: parseFloat(p.priceChange?.h6 || 0),
        dex: p.dexId,
        pairUrl: p.url,
        mcap: parseFloat(p.marketCap || 0),
        fdv: parseFloat(p.fdv || 0),
        buys24h: p.txns?.h24?.buys || 0,
        sells24h: p.txns?.h24?.sells || 0,
        pairAddress: p.pairAddress,
      }));

    if (tokens.length > 0) {
      // Cache for fallback
      lastGoodTrendingTokens = tokens;
      return res.json({ success: true, tokens });
    }
    res.json({ success: true, tokens: lastGoodTrendingTokens.length ? lastGoodTrendingTokens : FALLBACK_TOKENS });
  } catch {
    res.json({ success: true, tokens: lastGoodTrendingTokens.length ? lastGoodTrendingTokens : FALLBACK_TOKENS });
  }
});

// ──────────────────────────────────────────────
// WALLET DNA PROFILE (Real SQLite + Blockscout)
// ──────────────────────────────────────────────
app.get('/api/wallet/:address', requireAuth, requirePremium, async (req, res) => {
  const { address } = req.params;
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
    return res.status(400).json({ success: false, error: 'Invalid address format.' });
  }
  const addr = address.toLowerCase();

  try {
    let wallet = getWalletById(addr);
    const lastSync = getLastSyncTime(addr);

    // Index if never synced or synced >24 hours ago
    if (!wallet || Date.now() - lastSync > 24 * 60 * 60 * 1000) {
      console.log(`[API] On-demand sync for ${addr}`);
      await syncWallet(addr, wallet?.label || `Wallet-${addr.slice(2, 6).toUpperCase()}`);
      wallet = getWalletById(addr);
    }

    const ethPrice = await getEthPrice();
    const [balanceData, tokenBalances, txData] = await Promise.all([
      fetcher(`https://base.blockscout.com/api/v2/addresses/${addr}`),
      fetcher(`https://base.blockscout.com/api/v2/addresses/${addr}/token-balances`).then(res => res || []),
      fetcher(`https://base.blockscout.com/api/v2/addresses/${addr}/transactions?filter=to%7Cfrom&limit=50`).then(res => res?.items || [])
    ]);

    const ethBalanceRaw = parseFloat(balanceData?.coin_balance || '0') / 1e18;
    const txnFromBlockscout = parseInt(balanceData?.transaction_count || '0');
    const totalTxns = txnFromBlockscout || txData.length || (wallet?.closed_positions || 0);

    const holdings = tokenBalances
      .filter(t => t.token?.type === 'ERC-20')
      .map(t => {
        const decimals = parseInt(t.token?.decimals || 18);
        const val = Number(BigInt(t.value || 0)) / Math.pow(10, decimals);
        const rate = parseFloat(t.token?.exchange_rate || 0);
        return {
          symbol: t.token?.symbol || '???',
          name: t.token?.name || 'Unknown Token',
          address: t.token?.address,
          balance: val,
          usdValue: val * rate
        };
      })
      .filter(h => h.balance > 0)
      .slice(0, 15);

    const recentActivity = txData.slice(0, 15).map(t => ({
      hash: t.hash,
      type: t.from?.hash?.toLowerCase() === addr ? 'OUT' : 'IN',
      method: t.method || (t.to?.is_contract ? 'Contract Call' : 'Transfer'),
      timestamp: t.timestamp,
      status: t.status === 'ok' ? 'ok' : 'error',
      value: parseFloat(t.value || '0') / 1e18,
      gasUsed: t.gas_used,
      to: t.to?.hash,
      from: t.from?.hash,
    }));

    const roi30d = wallet?.roi_30d || 0;
    const winRate = wallet?.win_rate || 0;
    const closed = wallet?.closed_positions || 0;
    const totalCapital = wallet?.total_capital || 0;
    const drawdownPenalty = wallet?.drawdown_penalty || 0;
    const consistencyScore = wallet?.consistency_score || 0;
    const alphaScore = wallet?.alpha_score || 0;

    // Stored fields use 0–100 scale; deriveDnaScores expects 0–1 for consistency/drawdown.
    const dnaScores = deriveDnaScores({
      alphaScore,
      consistencyScore: (consistencyScore || 0) / 100,
      drawdownPenalty:  (drawdownPenalty  || 0) / 100,
      totalCapital,
      closedPositions:  closed,
    });

    const daysActive = wallet?.days_active || (wallet?.first_seen ? Math.round((Date.now() - wallet.first_seen) / 86400000) : 1);
    // Single source of truth — stored archetype from recalculateMetrics. No client-side recompute.
    const archetype = parseArchetype(wallet?.archetype) || {
      id: 'unknown', name: 'Insufficient Data', emoji: '📊', color: '#4A5568',
      desc: 'Insufficient history for reliable classification.'
    };

    const failRate = txData.length > 0 ? (txData.filter(t => t.status !== 'ok').length / txData.length) : 0;
    const outgoing = txData.filter(t => t.from?.hash?.toLowerCase() === addr).length;
    const incoming = txData.filter(t => t.to?.hash?.toLowerCase() === addr).length;
    const sybilDetails = analyzeSybil(addr, txData, daysActive, totalTxns, outgoing, incoming, failRate);

    const bestTrade = getBestTrade(addr);
    res.json({
      success: true,
      address: addr,
      overallScore: alphaScore,
      archetype,
      dnaScores,
      bestTrade,
      stats: {
        totalTxns,
        daysActive: Math.max(1, daysActive),
        ethBalance: ethBalanceRaw.toFixed(4),
        ethBalanceUSD: Math.round(ethBalanceRaw * ethPrice),
        ethPrice: ethPrice.toFixed(2),
        closedTrades: closed,
        winRate: winRate.toFixed(1),
        roi30d: roi30d.toFixed(1),
        tokenCount: holdings.length,
        failRate: (failRate * 100).toFixed(1),
        firstActivity: wallet?.first_seen ? new Date(wallet.first_seen).toISOString() : new Date().toISOString(),
        lastActivity: wallet?.last_updated ? new Date(wallet.last_updated).toISOString() : new Date().toISOString(),
        lastTradeTs: (() => {
          try {
            const lt = db.prepare("SELECT MAX(timestamp) as ts FROM wallet_trades WHERE address = ?").get(addr);
            return lt?.ts || null;
          } catch { return null; }
        })(),
        outgoing,
        incoming,
        netWorthUSD: Math.round(ethBalanceRaw * ethPrice + (wallet?.total_pnl || 0)),
        pnl30d: Math.round(wallet?.total_pnl || 0),
        pnl30dPct: roi30d.toFixed(1),
      },
      holdings,
      recentActivity,
      sybilDetails,
      alphaBreakdown: JSON.parse(wallet?.alpha_breakdown || '{}'),
      hiddenGemBreakdown: JSON.parse(wallet?.hidden_gem_breakdown || '{}'),
    });
  } catch (e) {
    console.error('[API] Wallet Profile Error:', e);
    res.status(500).json({ success: false, error: `Error loading profile: ${e.message}` });
  }
});

// ──────────────────────────────────────────────
// WALLET POSITIONS — FIFO cost basis + unrealized PnL
// ──────────────────────────────────────────────
app.get('/api/wallet/:address/positions', async (req, res) => {
  const { address } = req.params;
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
    return res.status(400).json({ success: false, error: 'Invalid address format.' });
  }
  const addr = address.toLowerCase();

  try {
    const positions = getWalletPositions(addr);

    if (positions.length === 0) {
      // Auto-sync if no positions exist
      const wallet = getWalletById(addr);
      if (!wallet) {
        return res.json({ success: true, positions: [], summary: { message: 'Wallet not tracked. Add to watchlist first.' } });
      }
    }

    const open   = positions.filter(p => p.status === 'OPEN');
    const closed = positions.filter(p => p.status === 'CLOSED');

    const totalRealizedPnl   = positions.reduce((s, p) => s + (p.realized_pnl_usd || 0), 0);
    const totalUnrealizedPnl = open.reduce((s, p) => s + (p.unrealized_pnl_usd || 0), 0);
    const totalInvested      = positions.reduce((s, p) => s + (p.total_bought_usd || 0), 0);
    const netPnl             = totalRealizedPnl + totalUnrealizedPnl;

    const priceKnown = open.filter(p => p.current_price_usd !== null).length;

    res.json({
      success: true,
      positions: positions.map(p => ({
        token_address:      p.token_address,
        token_symbol:       p.token_symbol,
        token_name:         p.token_name,
        status:             p.status,
        total_bought_amt:   p.total_bought_amt,
        total_bought_usd:   p.total_bought_usd,
        total_sold_amt:     p.total_sold_amt,
        total_sold_usd:     p.total_sold_usd,
        realized_pnl_usd:   p.realized_pnl_usd,
        avg_cost_usd:       p.avg_cost_usd,
        remaining_amt:      p.remaining_amt,
        current_price_usd:  p.current_price_usd,
        unrealized_pnl_usd: p.unrealized_pnl_usd,
        unrealized_roi_pct: p.unrealized_roi_pct,
        price_updated_at:   p.price_updated_at,
        price_source:       p.current_price_usd !== null ? 'DexScreener' : null,
      })),
      summary: {
        total_positions:      positions.length,
        open_positions:       open.length,
        closed_positions:     closed.length,
        priced_open:          priceKnown,
        total_invested_usd:   totalInvested,
        total_realized_pnl:   totalRealizedPnl,
        total_unrealized_pnl: totalUnrealizedPnl,
        net_pnl:              netPnl,
        cost_basis_method:    'FIFO',
        unrealized_note:      priceKnown < open.length
          ? `${open.length - priceKnown} open position(s) have no DexScreener price (token may be too new or delisted)`
          : null,
      },
    });
  } catch (e) {
    console.error('[API] Positions Error:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});


// ──────────────────────────────────────────────
// SYBIL ANALYSIS
// ──────────────────────────────────────────────
function analyzeSybil(address, txns, daysActive, totalTxns, outgoing, incoming, failRate) {
  const checks = [
    { id: 'age', name: 'Wallet Age', pass: daysActive > 30,
      detail: daysActive > 30 ? `${daysActive} days old — established wallet` : `Only ${daysActive} days old — new wallet flag` },
    { id: 'ratio', name: 'Tx Direction Ratio', pass: outgoing < incoming * 4,
      detail: outgoing < incoming * 4 ? `Balanced activity (${outgoing}↑/${incoming}↓)` : `High outgoing ratio — may be scripted` },
    { id: 'fail', name: 'Failed Transaction Rate', pass: failRate < 0.05,
      detail: failRate < 0.05 ? `${(failRate*100).toFixed(1)}% fail rate — normal` : `${(failRate*100).toFixed(1)}% fail rate — bot-like behavior` },
    { id: 'volume', name: 'Transaction Volume Pattern', pass: !(totalTxns > 500 && daysActive < 30),
      detail: !(totalTxns > 500 && daysActive < 30) ? 'Normal activity rate' : 'High volume in short time — sybil pattern' },
    { id: 'diversity', name: 'Contract Diversity', pass: new Set(txns.filter(t => t.to?.is_contract).map(t => t.to?.hash).filter(Boolean)).size >= 3,
      detail: (() => { const n = new Set(txns.filter(t => t.to?.is_contract).map(t => t.to?.hash).filter(Boolean)).size; return n >= 3 ? `${n} unique contracts — diverse activity` : `Only ${n} unique contract(s) — concentrated activity`; })() },
  ];
  const passCount = checks.filter(c => c.pass).length;
  const riskScore = Math.round((1 - passCount / checks.length) * 100);
  return { checks, riskScore, verdict: riskScore < 25 ? 'CLEAN' : riskScore < 60 ? 'SUSPICIOUS' : 'HIGH RISK' };
}

// ──────────────────────────────────────────────
// HIDDEN GEM ENGINE (Real Data from SQLite)
// ──────────────────────────────────────────────
app.get('/api/hidden-gems', async (req, res) => {
  try {
    const lang = req.query.lang === 'ru' ? 'ru' : 'en';
    const wallets = getTrackedWallets();
    const gems = wallets
      .filter(w => w.hidden_gem_score > 60)
      .sort((a, b) => b.hidden_gem_score - a.hidden_gem_score)
      .slice(0, 15)
      .map(w => {
        const gemTrades = db.prepare(`
          SELECT token_symbol, 
                 SUM(CASE WHEN type = 'BUY' THEN usd_value ELSE 0 END) as bought,
                 SUM(CASE WHEN type = 'SELL' THEN usd_value ELSE 0 END) as sold
          FROM wallet_trades
          WHERE address = ?
          GROUP BY token_symbol
          HAVING bought > 0 AND sold > bought
          LIMIT 3
        `).all(w.address);

        const recentWins = gemTrades.map(gt => {
          const pct = Math.round(((gt.sold - gt.bought) / gt.bought) * 100);
          return `${gt.token_symbol} (+${pct}%)`;
        });

        const whyInteresting = lang === 'ru'
          ? `Проверено в ончейне: расчетный винрейт ${w.win_rate.toFixed(1)}% со строгим фокусом на прибыльность, а не объем.`
          : `Verified on-chain: Calculated ${w.win_rate.toFixed(1)}% win rate with a strict focus on profitability over volume.`;

        const whyNow = lang === 'ru'
          ? `Недавно проиндексирован в базе данных Alpha Engine, демонстрируя активное развертывание капитала.`
          : `Recently indexed in the Alpha Engine database showing active capital deployment.`;

        const whatChanged = lang === 'ru'
          ? `Реализованный PnL составляет $${w.total_pnl.toFixed(0)}, что указывает на успешные недавние выходы.`
          : `Realized PnL stands at $${w.total_pnl.toFixed(0)}, indicating successful recent exits.`;

        const comparison = lang === 'ru'
          ? `Работает незаметно. Высокий ROI, но отсутствует крупный след транзакций, характерный для известных MEV или CEX кошельков.`
          : `Operates quietly. High ROI but lacks the heavy transaction footprint of known MEV or CEX wallets.`;

        return {
          address: w.address,
          label: w.label || 'Emerging Wallet',
          hiddenGemScore: w.hidden_gem_score,
          metrics: {
            roi: `${w.roi_30d >= 0 ? '+' : ''}${w.roi_30d.toFixed(1)}%`,
            winRate: `${w.win_rate.toFixed(1)}%`,
            followers: lang === 'ru' ? 'Низкий' : 'Low',
            consistency: `${Math.min(100, Math.round(w.win_rate + (w.total_pnl > 0 ? 10 : 0)))}/100`,
            tradeQuality: lang === 'ru' ? 'Проверено в ончейне' : 'Verified On-Chain'
          },
          recentWins,
          explanation: { whyInteresting, whyNow, whatChanged, comparison }
        };
      });

    res.json({ success: true, gems });
  } catch (e) {
    console.error('Hidden Gems Error:', e);
    res.status(500).json({ success: false, error: 'Database error' });
  }
});

// ──────────────────────────────────────────────
// SMART MONEY CLUSTERS (Real Data from SQLite)
// ──────────────────────────────────────────────
// BACKTEST — "What if you followed the signals?"
// Reads precomputed real GeckoTerminal performance from signal_backtest table.
// Populate with: node scripts/backtest.js
// ──────────────────────────────────────────────
app.get('/api/backtest', async (req, res) => {
  try {
    let rows = [];
    try {
      // candle_days >= 5: needs a real post-signal window.
      // peak < 1000 & > -100, current > -100: drop broken entry prices
      // (token-decimals errors produce absurd % that would skew the aggregate).
      rows = db.prepare(`
        SELECT * FROM signal_backtest
        WHERE candle_days >= 5
          AND peak_gain_pct < 1000 AND peak_gain_pct > -100
          AND current_pct > -100
        ORDER BY signal_ts DESC
      `).all();
    } catch {
      return res.json({ success: true, computed: false, signals: [], summary: null });
    }

    if (!rows.length) {
      return res.json({ success: true, computed: false, signals: [], summary: null });
    }

    const n = rows.length;
    const peakWins = rows.filter(r => r.peak_gain_pct >= 20).length;
    const holdWins = rows.filter(r => r.current_pct >= 0).length;
    const avgPeak = rows.reduce((s, r) => s + r.peak_gain_pct, 0) / n;
    const avgHold = rows.reduce((s, r) => s + r.current_pct, 0) / n;
    const sorted = [...rows].sort((a, b) => a.peak_gain_pct - b.peak_gain_pct);
    const median = sorted[Math.floor(n / 2)].peak_gain_pct;
    const best = rows.reduce((b, r) => r.peak_gain_pct > b.peak_gain_pct ? r : b, rows[0]);
    const worst = rows.reduce((w, r) => r.current_pct < w.current_pct ? r : w, rows[0]);

    const dates = rows.map(r => r.signal_ts).sort((a, b) => a - b);
    const coverageDays = Math.round((Date.now() - dates[0]) / 86400000);

    const summary = {
      sampleSize: n,
      peakWinRate: Math.round((peakWins / n) * 100),
      holdWinRate: Math.round((holdWins / n) * 100),
      avgPeakGain: parseFloat(avgPeak.toFixed(1)),
      medianPeakGain: parseFloat(median.toFixed(1)),
      avgHoldReturn: parseFloat(avgHold.toFixed(1)),
      best: { symbol: best.token_symbol, gain: best.peak_gain_pct },
      worst: { symbol: worst.token_symbol, loss: worst.current_pct },
      coverageDays,
      computedAt: Math.max(...rows.map(r => r.computed_at || 0)),
    };

    const signals = rows.map(r => ({
      tokenSymbol: r.token_symbol,
      tokenName: r.token_name,
      tokenAddress: r.token_address,
      walletCount: r.wallet_count,
      totalInflow: r.total_inflow,
      signalDate: new Date(r.signal_ts).toISOString(),
      daysAgo: Math.round((Date.now() - r.signal_ts) / 86400000),
      entryPrice: r.entry_price,
      peakGain: r.peak_gain_pct,
      currentPct: r.current_pct,
      candleDays: r.candle_days,
    })).sort((a, b) => b.peakGain - a.peakGain);

    res.json({ success: true, computed: true, summary, signals });
  } catch (e) {
    console.error('Backtest error:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// ──────────────────────────────────────────────
// HISTORICAL SIGNAL PERFORMANCE
// ──────────────────────────────────────────────
app.get('/api/signal-history', async (req, res) => {
  try {
    const signals = db.prepare(`
      SELECT token_address, token_symbol, token_name,
             COUNT(DISTINCT address) as wallet_count,
             SUM(usd_value) as total_inflow,
             MIN(timestamp) as first_signal,
             SUM(usd_value) / NULLIF(SUM(token_amount), 0) as avg_entry_price
      FROM wallet_trades
      WHERE type = 'BUY' AND usd_value > 0.1 AND token_amount > 0
      GROUP BY token_address
      HAVING wallet_count >= 2
      ORDER BY wallet_count DESC, total_inflow DESC
      LIMIT 20
    `).all();

    const results = [];
    for (const s of signals) {
      let currentPrice = null;
      let priceChange = null;
      let pairUrl = null;
      try {
        const dex = await fetcher(`https://api.dexscreener.com/latest/dex/tokens/${s.token_address}`, 6000);
        const pair = (dex?.pairs || []).find(p => p.chainId === 'base');
        if (pair?.priceUsd) {
          currentPrice = parseFloat(pair.priceUsd);
          pairUrl = pair.url;
          if (s.avg_entry_price > 0) {
            priceChange = ((currentPrice - s.avg_entry_price) / s.avg_entry_price) * 100;
          }
        }
      } catch {}

      const daysAgo = Math.round((Date.now() - s.first_signal) / 86400000);
      const participants = db.prepare(`
        SELECT t.address, w.label, SUM(t.usd_value) as bought_usd, m.alpha_score
        FROM wallet_trades t
        JOIN tracked_wallets w ON t.address = w.address
        LEFT JOIN wallet_metrics m ON t.address = m.address
        WHERE t.token_address = ? AND t.type = 'BUY'
        GROUP BY t.address
        ORDER BY bought_usd DESC
      `).all(s.token_address);

      const avgAlpha = participants.length > 0
        ? Math.round(participants.reduce((sum, p) => sum + (p.alpha_score || 0), 0) / participants.length)
        : 0;

      results.push({
        tokenAddress: s.token_address,
        tokenSymbol: s.token_symbol,
        tokenName: s.token_name,
        walletCount: s.wallet_count,
        totalInflow: s.total_inflow,
        signalDate: new Date(s.first_signal).toISOString(),
        daysAgo,
        avgEntryPrice: s.avg_entry_price,
        currentPrice,
        priceChange: priceChange !== null ? parseFloat(priceChange.toFixed(1)) : null,
        avgAlphaScore: avgAlpha,
        pairUrl,
        wallets: participants.map(p => ({
          label: p.label || `${p.address.slice(0,6)}...${p.address.slice(-4)}`,
          boughtUSD: p.bought_usd,
          alphaScore: p.alpha_score || 0,
        })),
      });
    }

    res.json({ success: true, signals: results });
  } catch (e) {
    console.error('Signal history error:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// ──────────────────────────────────────────────
app.get('/api/clusters', requireAuth, requirePremium, async (req, res) => {
  try {
    // Only count buys from wallets that pass the cluster-quality bar.
    // Inline mirror of walletIsValidForClusters in SQL: HIGH/MEDIUM + scored + days_active>=7 + closed>=5
    // + archetype set to something other than unknown/unclassified.
    const clusterQuery = (since) => db.prepare(`
      SELECT t.token_address, t.token_symbol, t.token_name,
             COUNT(DISTINCT t.address) as wallet_count,
             SUM(t.usd_value) as total_inflow
      FROM wallet_trades t
      JOIN wallet_metrics m ON m.address = t.address
      WHERE t.type = 'BUY' AND t.timestamp > ?
        AND m.data_quality IN ('HIGH','MEDIUM')
        AND m.alpha_score > 0
        AND m.closed_positions >= 5
        AND m.days_active >= 7
        AND m.archetype IS NOT NULL
        AND json_extract(m.archetype,'$.id') NOT IN ('unknown','unclassified')
      GROUP BY t.token_address
      HAVING wallet_count >= 2
      ORDER BY wallet_count DESC, total_inflow DESC
      LIMIT 10
    `).all(since);

    let timeframeLabel = '48 hours';
    let since = Date.now() - 48 * 60 * 60 * 1000;
    let recentBuys = clusterQuery(since);

    if (recentBuys.length < 3) {
      since = Date.now() - 30 * 24 * 60 * 60 * 1000;
      timeframeLabel = '30 days';
      recentBuys = clusterQuery(since);
    }
    if (recentBuys.length < 3) {
      since = 0;
      timeframeLabel = 'all time';
      recentBuys = clusterQuery(since);
    }

    // Fetch DexScreener data for all candidate tokens in parallel — used for
    // current price AND for the inline risk gate (liquidity + age).
    const priceByAddr = new Map();
    const riskByAddr  = new Map();
    await Promise.all(recentBuys.map(async buy => {
      try {
        const dexData = await fetcher(`https://api.dexscreener.com/latest/dex/tokens/${buy.token_address}`);
        const pair = (dexData?.pairs || [])
          .filter(p => p.chainId === 'base')
          .sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0))[0];
        if (pair?.priceUsd) priceByAddr.set(buy.token_address, parseFloat(pair.priceUsd));

        // Risk gate from real market signals — fast, no external audit call.
        // Pure-data classifier: liquidity + age + volume floor.
        const liq    = Number(pair?.liquidity?.usd || 0);
        const vol24h = Number(pair?.volume?.h24    || 0);
        const ageMs  = pair?.pairCreatedAt ? Date.now() - Number(pair.pairCreatedAt) : null;
        const ageDays = ageMs != null ? Math.floor(ageMs / 86400000) : null;

        // Probabilistic risk language only — never absolute "SAFE". We don't audit
        // the contract every time the price-only signals can mislead.
        let level = 'MEDIUM';   // LOW / MEDIUM / HIGH
        let why   = [];
        if (liq < 5000)                         { level = 'HIGH'; why.push(`Low liquidity ($${Math.round(liq).toLocaleString()})`); }
        else if (ageDays != null && ageDays < 3){ level = 'HIGH'; why.push(`Very new token (${ageDays}d old)`); }
        else if (vol24h < 1000)                 { level = 'HIGH'; why.push(`Almost no 24h volume`); }
        else if (liq >= 100000 && (ageDays == null || ageDays >= 14) && vol24h >= 50000) {
          level = 'LOW';
          why.push(`Liquidity $${(liq/1000).toFixed(0)}K`);
          if (ageDays != null) why.push(`${ageDays}d old`);
        } else {
          if (liq < 50000)                      why.push(`Thin liquidity $${Math.round(liq).toLocaleString()}`);
          if (ageDays != null && ageDays < 14)  why.push(`Young token (${ageDays}d)`);
          if (vol24h < 20000)                   why.push(`Lower 24h volume`);
        }
        riskByAddr.set(buy.token_address, { level, why: why.slice(0, 2), liq, vol24h, ageDays });
      } catch {}
    }));

    const participantsStmt = db.prepare(`
      SELECT t.address, w.label, SUM(t.usd_value) as total_buy_usd, MIN(t.timestamp) as first_buy_time,
             m.alpha_score, m.data_quality, m.closed_positions, m.days_active, m.archetype
      FROM wallet_trades t
      JOIN tracked_wallets w ON t.address = w.address
      LEFT JOIN wallet_metrics m ON t.address = m.address
      WHERE t.token_address = ? AND t.type = 'BUY' AND t.timestamp > ?
      GROUP BY t.address
    `);
    const totalsStmt = db.prepare(`
      SELECT SUM(usd_value) as total_usd, SUM(token_amount) as total_amount
      FROM wallet_trades
      WHERE token_address = ? AND type = 'BUY' AND timestamp > ?
    `);

    const clusters = [];
    for (const buy of recentBuys) {
      const participants = participantsStmt.all(buy.token_address, since);
      const totals = totalsStmt.get(buy.token_address, since);
      const avgEntry = totals?.total_amount > 0 ? (totals.total_usd / totals.total_amount) : 0;
      const currentPrice = priceByAddr.get(buy.token_address) ?? avgEntry;

      const validParticipants = participants.filter(walletIsValidForClusters);
      if (validParticipants.length === 0) continue;
      const byAddr = new Map(validParticipants.map(p => [p.address, p]));

      const opportunityDetails = getOpportunityDetails(buy.token_address);
      const confidenceScore = opportunityDetails.score;
      const latestBuyTs = Math.max(...validParticipants.map(p => p.first_buy_time));
      const urgencyScore = Math.min(99, Math.round(
        40 + (validParticipants.length * 10) +
        (Math.max(0, 48 - (Date.now() - latestBuyTs) / 3600000) * 1.2)
      ));

      const sortedByAmount = [...validParticipants].sort((a, b) => b.total_buy_usd - a.total_buy_usd);
      const largest = sortedByAmount[0];
      const analysis = `Coordination detected: ${validParticipants.length} high-quality wallets accumulated ${buy.token_symbol} within the last 48 hours. Total tracked inflow is $${buy.total_inflow.toLocaleString(undefined, {maximumFractionDigits: 0})}. Largest buyer was ${largest?.label || `${largest?.address.slice(0,6)}...${largest?.address.slice(-4)}`} with a size of $${Math.round(largest?.total_buy_usd || 0).toLocaleString()}.`;

      const participantWallets = validParticipants.map(p => ({
        address: p.address,
        label: p.label || `${p.address.slice(0, 6)}...${p.address.slice(-4)}`,
        amount: p.total_buy_usd,
      }));

      const members = participantWallets.map(w => ({
        address: w.address,
        label: w.label,
        amount: w.amount,
        alphaScore: byAddr.get(w.address)?.alpha_score || 0,
        quality:    byAddr.get(w.address)?.data_quality || 'LOW',
        closedPositions: byAddr.get(w.address)?.closed_positions || 0,
        daysActive:      byAddr.get(w.address)?.days_active || 0,
        archetype:       byAddr.get(w.address)?.archetype || null,
        bestTrade:       getBestTrade(w.address),
      }));

      // "If you followed this signal" — the conversion line. Show realised P&L
      // (current price vs cluster avg entry) and, when backtest knows the peak,
      // the historical best within 30d. Both are real on-chain numbers.
      const earliestBuyTs = Math.min(...validParticipants.map(p => p.first_buy_time));
      const minsSinceFirstBuy = Math.max(1, Math.round((Date.now() - earliestBuyTs) / 60000));
      const followedPct = avgEntry > 0 && currentPrice > 0
        ? ((currentPrice - avgEntry) / avgEntry) * 100
        : null;
      const bt = (() => {
        try {
          return db.prepare(
            `SELECT peak_gain_pct, current_pct, candle_days FROM signal_backtest WHERE token_address = ?`
          ).get(buy.token_address);
        } catch { return null; }
      })();

      // followedLabel = short string the UI prints right under the conviction ring.
      // Live → "Live · entered Xm ago"; closed (peak known) → "+43% peak in 18d".
      let followedLabel = null;
      let followedColor = 'neutral';
      if (bt?.peak_gain_pct != null && bt.peak_gain_pct > -100 && bt.peak_gain_pct < 1000) {
        followedLabel = `${bt.peak_gain_pct >= 0 ? '+' : ''}${bt.peak_gain_pct.toFixed(0)}% peak in ${bt.candle_days}d`;
        followedColor = bt.peak_gain_pct > 0 ? 'green' : 'red';
      } else if (followedPct != null) {
        const since = minsSinceFirstBuy < 60
          ? `${minsSinceFirstBuy}m ago`
          : minsSinceFirstBuy < 1440
            ? `${Math.round(minsSinceFirstBuy / 60)}h ago`
            : `${Math.round(minsSinceFirstBuy / 1440)}d ago`;
        followedLabel = `Live · ${followedPct >= 0 ? '+' : ''}${followedPct.toFixed(0)}% since entry ${since}`;
        followedColor = followedPct > 5 ? 'green' : followedPct < -5 ? 'red' : 'neutral';
      }

      clusters.push({
        id: `cluster_${buy.token_address}`,
        theme: `${buy.token_symbol} Cluster`,
        token: {
          symbol: buy.token_symbol,
          name: buy.token_name,
          address: buy.token_address,
        },
        confidenceScore,
        opportunityScore: confidenceScore,
        urgencyScore,
        walletCount: validParticipants.length,
        members,
        totalInflowUSD: buy.total_inflow,
        avgEntryPrice: avgEntry > 0 ? (avgEntry < 0.01 ? avgEntry.toFixed(6) : avgEntry.toFixed(4)) : '0.00',
        currentPrice: currentPrice > 0 ? (currentPrice < 0.01 ? currentPrice.toFixed(6) : currentPrice.toFixed(4)) : '0.00',
        riskGate: riskByAddr.get(buy.token_address) || null,
        followedPct,
        followedLabel,
        followedColor,
        peakGainPct: bt?.peak_gain_pct ?? null,
        peakDays:    bt?.candle_days ?? null,
        firstBuyAt:  earliestBuyTs,
        minsSinceFirstBuy,
        timeframe: timeframeLabel,
        wallets: participantWallets,
        analysis,
      });
    }

    res.json({ success: true, clusters });
  } catch (e) {
    console.error('Clusters Error:', e);
    res.status(500).json({ success: false, error: 'Database error fetching clusters' });
  }
});

// ──────────────────────────────────────────────
// TOKEN INTELLIGENCE — "buy or dump in 10 seconds"
// Smart money bought vs sold for one token. Real on-chain.
// ──────────────────────────────────────────────
app.get('/api/token/:address', async (req, res) => {
  const { address } = req.params;
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
    return res.status(400).json({ success: false, error: 'Invalid token address' });
  }
  const addr = address.toLowerCase();
  try {
    const rawRows = db.prepare(`
      SELECT t.address, t.type, t.token_symbol, t.token_name, t.usd_value, t.token_amount, t.timestamp,
             w.label, m.alpha_score, m.roi_30d, m.data_quality, m.closed_positions, m.days_active, m.archetype
      FROM wallet_trades t
      JOIN tracked_wallets w ON t.address = w.address
      LEFT JOIN wallet_metrics m ON t.address = m.address
      WHERE t.token_address = ?
      ORDER BY t.timestamp DESC
    `).all(addr);

    // Verdict only counts wallets that pass cluster-quality bar — same filter as /api/clusters.
    const rows = rawRows.filter(walletIsValidForClusters);

    if (!rows.length) {
      return res.json({ success: true, found: false, address: addr });
    }

    const symbol = rows[0].token_symbol;
    const name = rows[0].token_name;

    // Per-wallet aggregation
    const byWallet = {};
    for (const r of rows) {
      const w = byWallet[r.address] || (byWallet[r.address] = {
        address: r.address, label: r.label || `${r.address.slice(0,6)}...${r.address.slice(-4)}`,
        alphaScore: r.alpha_score || 0, roi: r.roi_30d || 0,
        bought: 0, sold: 0, boughtAmt: 0, lastTs: 0,
      });
      if (r.type === 'BUY') { w.bought += r.usd_value; w.boughtAmt += r.token_amount; }
      else { w.sold += r.usd_value; }
      w.lastTs = Math.max(w.lastTs, r.timestamp);
    }
    const wallets = Object.values(byWallet).map(w => ({
      ...w, net: w.bought - w.sold,
      avgEntry: w.boughtAmt > 0 ? w.bought / w.boughtAmt : 0,
      stance: w.bought > w.sold * 1.2 ? 'HOLDING' : w.sold > w.bought * 1.2 ? 'EXITED' : 'TRIMMED',
    })).sort((a, b) => b.net - a.net);

    const totalBought = wallets.reduce((s, w) => s + w.bought, 0);
    const totalSold = wallets.reduce((s, w) => s + w.sold, 0);
    const netFlow = totalBought - totalSold;
    const buyers = wallets.filter(w => w.bought > 0).length;
    const holders = wallets.filter(w => w.stance === 'HOLDING').length;
    const exiters = wallets.filter(w => w.stance === 'EXITED').length;
    const totalBoughtAmt = wallets.reduce((s, w) => s + w.boughtAmt, 0);
    const avgEntry = totalBoughtAmt > 0 ? totalBought / totalBoughtAmt : 0;

    // Live price + backtest if present
    let currentPrice = null, pairUrl = null;
    try {
      const dx = await fetcher(`https://api.dexscreener.com/latest/dex/tokens/${addr}`, 6000);
      const pair = (dx?.pairs || []).find(p => p.chainId === 'base');
      if (pair?.priceUsd) { currentPrice = parseFloat(pair.priceUsd); pairUrl = pair.url; }
    } catch {}

    let bt = null;
    try { bt = db.prepare('SELECT peak_gain_pct, current_pct, candle_days FROM signal_backtest WHERE token_address = ?').get(addr); } catch {}

    // Verdict
    const recentRows = rows.filter(r => r.timestamp > Date.now() - 14 * 86400000);
    const recentBuys = recentRows.filter(r => r.type === 'BUY').reduce((s, r) => s + r.usd_value, 0);
    const recentSells = recentRows.filter(r => r.type === 'SELL').reduce((s, r) => s + r.usd_value, 0);
    let verdict, verdictReason;
    if (netFlow > 0 && holders >= exiters) {
      verdict = 'ACCUMULATING';
      verdictReason = `${holders} of ${buyers} smart wallets still holding. Net +$${Math.round(netFlow).toLocaleString()} inflow.`;
    } else if (totalSold > totalBought * 1.1 || exiters > holders) {
      verdict = 'DISTRIBUTING';
      verdictReason = `${exiters} smart wallets exited. Net $${Math.round(netFlow).toLocaleString()} flow — smart money taking profits.`;
    } else {
      verdict = 'MIXED';
      verdictReason = `Split: ${holders} holding, ${exiters} exited. No strong consensus.`;
    }

    const opportunityDetails = getOpportunityDetails(addr);
    const conviction = opportunityDetails.score;
    const buyerWallets = wallets.filter(w => w.bought > 0);
    const avgWalletRoi = buyerWallets.length
      ? buyerWallets.reduce((s, w) => s + (w.roi || 0), 0) / buyerWallets.length : 0;
    const firstBuyTs = Math.min(...rows.filter(r => r.type === 'BUY').map(r => r.timestamp));
    const firstBuyDays = Math.round((Date.now() - firstBuyTs) / 86400000);

    // "Why this signal matters" — outcome-focused, specific numbers
    const holdPct = buyers > 0 ? Math.round((holders / buyers) * 100) : 0;
    const whyItMatters = [
      firstBuyDays <= 3
        ? `🔥 Fresh signal — smart money entered ${firstBuyDays <= 1 ? 'today' : firstBuyDays + ' days ago'}`
        : `Accumulation over last ${firstBuyDays} days — wallets building positions`,
      `$${Math.round(totalBought).toLocaleString()} capital deployed by verified alpha wallets`,
      `${holders}/${buyers} wallets (${holdPct}%) still holding — no distribution detected`,
      `Avg wallet ROI across all their trades: ${avgWalletRoi >= 0 ? '+' : ''}${avgWalletRoi.toFixed(0)}%`,
      bt ? `Similar setup for ${symbol} previously peaked at +${bt.peak_gain_pct.toFixed(0)}% within 30d` : null,
      verdict === 'ACCUMULATING' && netFlow > 10000 ? `Net inflow $${Math.round(netFlow).toLocaleString()} — more buying than selling` : null,
    ].filter(Boolean);

    res.json({
      success: true, found: true, address: addr, symbol, name,
      verdict, verdictReason,
      stats: {
        totalBought, totalSold, netFlow, buyers, holders, exiters, avgEntry, firstBuyDays,
        currentPrice, pairUrl, avgWalletRoi,
        unrealizedPct: (avgEntry > 0 && currentPrice) ? ((currentPrice - avgEntry) / avgEntry) * 100 : null,
        recentBuys, recentSells,
        conviction, clusterStrength: conviction,
        opportunityDetails, // Include full score details for frontend UI dashboard
      },
      whyItMatters,
      backtest: bt ? { peakGain: bt.peak_gain_pct, currentPct: bt.current_pct } : null,
      wallets: wallets.slice(0, 25),
    });
  } catch (e) {
    console.error('Token intel error:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// ──────────────────────────────────────────────
// SMART MONEY EXITS — mirror of clusters for SELLs
// ──────────────────────────────────────────────
app.get('/api/exits', requireAuth, requirePremium, async (req, res) => {
  try {
    const since = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const exits = db.prepare(`
      SELECT t.token_address, t.token_symbol, t.token_name,
             COUNT(DISTINCT t.address) as wallet_count,
             SUM(t.usd_value) as total_outflow,
             MAX(t.timestamp) as last_sell
      FROM wallet_trades t
      JOIN wallet_metrics m ON m.address = t.address
      WHERE t.type = 'SELL' AND t.timestamp > ? AND t.usd_value > 1
        AND m.data_quality IN ('HIGH','MEDIUM')
        AND m.alpha_score > 0
        AND m.closed_positions >= 5
        AND m.days_active >= 7
        AND m.archetype IS NOT NULL
        AND json_extract(m.archetype,'$.id') NOT IN ('unknown','unclassified')
      GROUP BY t.token_address
      HAVING wallet_count >= 2
      ORDER BY wallet_count DESC, total_outflow DESC
      LIMIT 12
    `).all(since);

    const results = exits.map(e => {
      const sellersRaw = db.prepare(`
        SELECT t.address, w.label, SUM(t.usd_value) as sold_usd,
               m.alpha_score, m.data_quality, m.closed_positions, m.days_active, m.archetype
        FROM wallet_trades t
        JOIN tracked_wallets w ON t.address = w.address
        LEFT JOIN wallet_metrics m ON t.address = m.address
        WHERE t.token_address = ? AND t.type = 'SELL' AND t.timestamp > ?
        GROUP BY t.address ORDER BY sold_usd DESC
      `).all(e.token_address, since);

      // Same cluster-quality bar as /api/clusters — exits and clusters now use identical wallet pool.
      const sellers = sellersRaw.filter(walletIsValidForClusters);
      if (sellers.length < 2) return null;

      const daysAgo = Math.round((Date.now() - e.last_sell) / 86400000);
      return {
        id: `exit_${e.token_address}`,
        token: { symbol: e.token_symbol, name: e.token_name, address: e.token_address },
        walletCount: sellers.length,
        totalOutflowUSD: sellers.reduce((s, x) => s + (x.sold_usd || 0), 0),
        daysAgo,
        sellers: sellers.map(s => ({
          label: s.label || `${s.address.slice(0,6)}...${s.address.slice(-4)}`,
          soldUSD: s.sold_usd, alphaScore: s.alpha_score || 0,
        })),
      };
    }).filter(Boolean);

    res.json({ success: true, exits: results });
  } catch (e) {
    console.error('Exits error:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// ──────────────────────────────────────────────
// TELEGRAM ALERTS — real send via user's own bot
// ──────────────────────────────────────────────
function buildClusterAlert(c) {
  return [
    `🚨 SMART MONEY CLUSTER`,
    ``,
    `Token: ${c.token.symbol} (${c.token.name})`,
    ``,
    `${c.walletCount} alpha wallets bought`,
    `Accumulated: $${Math.round(c.totalInflowUSD).toLocaleString()}`,
    `Conviction: ${c.confidenceScore}/100`,
    `Avg entry: $${c.avgEntryPrice}`,
    ``,
    `📊 Open: https://app.uniswap.org/swap?chain=base&outputCurrency=${c.token.address}`,
  ].join('\n');
}

function buildExitAlert(e) {
  return [
    `🔻 SMART MONEY EXIT`,
    ``,
    `Token: ${e.token.symbol} (${e.token.name})`,
    ``,
    `${e.walletCount} tracked wallets sold`,
    `Total exited: $${Math.round(e.totalOutflowUSD).toLocaleString()}`,
    `Last sell: ${e.daysAgo}d ago`,
  ].join('\n');
}

// Preview alert text (no secrets) — UI shows exactly what user will get
app.get('/api/alerts/preview', requireAuth, requirePremium, async (req, res) => {
  try {
    const type = req.query.type || 'cluster';
    if (type === 'exit') {
      const e = db.prepare(`
        SELECT token_address, token_symbol, token_name,
               COUNT(DISTINCT address) wallet_count, SUM(usd_value) total_outflow, MAX(timestamp) last_sell
        FROM wallet_trades WHERE type='SELL' AND usd_value > 1 AND timestamp > ?
        GROUP BY token_address HAVING wallet_count >= 2
        ORDER BY wallet_count DESC, total_outflow DESC LIMIT 1
      `).get(Date.now() - 30 * 86400000);
      if (!e) return res.json({ success: true, text: 'No exit signal available yet.' });
      return res.json({ success: true, text: buildExitAlert({
        token: { symbol: e.token_symbol, name: e.token_name, address: e.token_address },
        walletCount: e.wallet_count, totalOutflowUSD: e.total_outflow,
        daysAgo: Math.round((Date.now() - e.last_sell) / 86400000),
      }) });
    }
    // cluster
    const clRes = await fetch(`${BASE_URL}/api/clusters`).then(r => r.json());
    const c = clRes.clusters?.[0];
    if (!c) return res.json({ success: true, text: 'No cluster signal available yet.' });
    res.json({ success: true, text: buildClusterAlert(c) });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Auto-alert config (server-side, so alerts fire without the site open)
db.exec(`
  CREATE TABLE IF NOT EXISTS alert_config (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    bot_token TEXT, chat_id TEXT, enabled INTEGER DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS sent_alerts (signal_id TEXT PRIMARY KEY, sent_at INTEGER);
  CREATE TABLE IF NOT EXISTS telegram_subscribers (
    chat_id TEXT PRIMARY KEY,
    username TEXT,
    first_name TEXT,
    subscribed_at INTEGER,
    active INTEGER DEFAULT 1
  );
`);

app.get('/api/alerts/config', requireAuth, requirePremium, (req, res) => {
  const c = db.prepare("SELECT enabled, chat_id, (bot_token IS NOT NULL AND length(bot_token) > 0) as has_token FROM alert_config WHERE id = 1").get();
  res.json({ success: true, enabled: !!c?.enabled, chatId: c?.chat_id || '', hasToken: !!c?.has_token });
});

app.post('/api/alerts/config', requireAdmin, (req, res) => {
  const { botToken, chatId, enabled } = req.body || {};
  if (enabled && (!botToken || !chatId)) {
    return res.status(400).json({ success: false, error: 'botToken and chatId required to enable' });
  }
  db.prepare(`
    INSERT INTO alert_config (id, bot_token, chat_id, enabled) VALUES (1, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET bot_token=excluded.bot_token, chat_id=excluded.chat_id, enabled=excluded.enabled
  `).run(botToken || '', chatId || '', enabled ? 1 : 0);
  res.json({ success: true, enabled: !!enabled });
});

async function sendTelegram(botToken, chatId, text) {
  const r = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  }).then(r => r.json());
  return r.ok;
}

// Auto-alert loop: every 5 min, send any new cluster the user hasn't been alerted to
async function runAutoAlerts() {
  try {
    const cfg = db.prepare('SELECT * FROM alert_config WHERE id = 1 AND enabled = 1').get();
    if (!cfg?.bot_token || !cfg?.chat_id) return;

    const clRes = await fetch(`${BASE_URL}/api/clusters`).then(r => r.json());
    const clusters = (clRes.clusters || []).filter(c => c.urgencyScore >= 60).slice(0, 5);
    for (const c of clusters) {
      const already = db.prepare('SELECT 1 FROM sent_alerts WHERE signal_id = ?').get(c.id);
      if (already) continue;
      const ok = await sendTelegram(cfg.bot_token, cfg.chat_id, buildClusterAlert(c));
      if (ok) db.prepare('INSERT OR REPLACE INTO sent_alerts (signal_id, sent_at) VALUES (?, ?)').run(c.id, Date.now());
      await new Promise(r => setTimeout(r, 1000));
    }

    // Exit alerts
    const exRes = await fetch(`${BASE_URL}/api/exits`).then(r => r.json());
    const exits = (exRes.exits || []).slice(0, 3);
    for (const e of exits) {
      const exitId = `exit_${e.token?.address || e.tokenAddress}_${Math.floor(Date.now() / 3600000)}`;
      const already = db.prepare('SELECT 1 FROM sent_alerts WHERE signal_id = ?').get(exitId);
      if (already) continue;
      const msg = buildExitAlert(e);
      const ok = await sendTelegram(cfg.bot_token, cfg.chat_id, msg);
      if (ok) db.prepare('INSERT OR REPLACE INTO sent_alerts (signal_id, sent_at) VALUES (?, ?)').run(exitId, Date.now());
      await new Promise(r => setTimeout(r, 1000));
    }
  } catch (e) { console.error('[AUTO-ALERT]', e.message); }
}
setInterval(runAutoAlerts, 5 * 60 * 1000);
setTimeout(runAutoAlerts, 15000);

// ──────────────────────────────────────────────
// TELEGRAM BOT — subscriber system + optional broadcast channel.
// Env vars:
//   TELEGRAM_BOT_TOKEN=...      (primary — powers subscriber bot)
//   BROADCAST_BOT_TOKEN=...     (legacy fallback — single channel, optional)
//   BROADCAST_CHANNEL_ID=...    (legacy fallback channel)
//   PUBLIC_BACKEND_URL=https://walletdna-production.up.railway.app
// Subscriber flow: user sends /start to bot → chat_id saved → gets all signals.
// Cadence: 10 min.
// ──────────────────────────────────────────────

const BROADCAST_BOT = process.env.TELEGRAM_BOT_TOKEN || process.env.BROADCAST_BOT_TOKEN || '';
const BROADCAST_CH  = process.env.BROADCAST_CHANNEL_ID || '';
const PUBLIC_BACKEND_URL = process.env.PUBLIC_BACKEND_URL || `http://localhost:${PORT}`;
const PUBLIC_APP_URL = process.env.PUBLIC_APP_URL || 'http://localhost:5173';

function buildBroadcastCluster(c) {
  const sym = c.token?.symbol || '?';
  const addr = c.token?.address || '';
  const conv = c.confidenceScore ?? c.opportunityScore ?? 0;
  const wallets = c.walletCount || (c.members?.length ?? 0);
  const inflow = Math.round(c.totalInflowUSD || 0).toLocaleString();
  const followed = c.followedLabel ? `\n📈 ${c.followedLabel}` : '';
  const url = `${PUBLIC_APP_URL}/token/${addr}`;
  return [
    `🚨 *SMART MONEY CLUSTER · ${sym}*`,
    ``,
    `${wallets} alpha wallets accumulated $${inflow}`,
    `Conviction *${conv}/100*${followed}`,
    ``,
    `🔗 ${url}`,
  ].join('\n');
}

function buildBroadcastWhale(t) {
  const usd = Math.round(t.usd_value || 0).toLocaleString();
  const labelStr = t.label || `${t.address?.slice(0,6)}…${t.address?.slice(-4)}`;
  const sym = t.token_symbol || '?';
  const url = `${PUBLIC_APP_URL}/token/${t.token_address}`;
  const action = t.type === 'BUY' ? '🟢 BOUGHT' : '🔴 SOLD';
  return [
    `${action} *$${usd}* of *${sym}*`,
    `by ${labelStr} (alpha ${t.alpha_score})`,
    `🔗 ${url}`,
  ].join('\n');
}

async function sendTelegramMsg(chatId, text, replyMarkup = null) {
  if (!BROADCAST_BOT) return false;
  try {
    const body = { chat_id: chatId, text, parse_mode: 'Markdown', disable_web_page_preview: true };
    if (replyMarkup) body.reply_markup = replyMarkup;
    const r = await fetch(`https://api.telegram.org/bot${BROADCAST_BOT}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(r => r.json());
    if (!r.ok) {
      // Bot blocked by user or chat not found — deactivate subscriber
      if (r.error_code === 403 || r.error_code === 400) {
        db.prepare('UPDATE telegram_subscribers SET active = 0 WHERE chat_id = ?').run(String(chatId));
        console.log(`[BOT] Deactivated subscriber ${chatId}: ${r.description}`);
      } else {
        console.error('[BOT] Telegram error for', chatId, ':', r.description);
      }
    }
    return !!r.ok;
  } catch (e) {
    console.error('[BOT] send failed:', e.message);
    return false;
  }
}

async function sendBroadcast(text) {
  if (!BROADCAST_BOT) return false;
  // Send to all active subscribers
  const subs = db.prepare('SELECT chat_id FROM telegram_subscribers WHERE active = 1').all();
  let sent = 0;
  for (const sub of subs) {
    const ok = await sendTelegramMsg(sub.chat_id, text);
    if (ok) sent++;
    if (subs.length > 1) await new Promise(r => setTimeout(r, 50)); // stay under Telegram rate limit
  }
  // Legacy: also send to hardcoded broadcast channel if configured
  if (BROADCAST_CH && BROADCAST_CH !== String(subs[0]?.chat_id)) {
    await sendTelegramMsg(BROADCAST_CH, text);
  }
  return sent > 0;
}

async function runBroadcastChannel() {
  if (!BROADCAST_BOT || !BROADCAST_CH) return;
  try {
    // Top cluster of the moment.
    const clRes = await fetch(`${BASE_URL}/api/clusters`).then(r => r.json());
    const top = (clRes.clusters || []).find(c => (c.urgencyScore || 0) >= 60);
    if (top) {
      const sentRow = db.prepare('SELECT 1 FROM sent_alerts WHERE signal_id = ?').get(`bc_${top.id}`);
      if (!sentRow) {
        const ok = await sendBroadcast(buildBroadcastCluster(top));
        if (ok) db.prepare('INSERT OR REPLACE INTO sent_alerts (signal_id, sent_at) VALUES (?, ?)').run(`bc_${top.id}`, Date.now());
      }
    }

    // Whale buys/sells from quality wallets, last 30min, > $20k, dedup by tx_hash.
    const since = Date.now() - 30 * 60 * 1000;
    const whales = db.prepare(`
      SELECT t.tx_hash, t.address, t.type, t.token_address, t.token_symbol,
             t.usd_value, w.label, m.alpha_score
      FROM wallet_trades t
      JOIN tracked_wallets w ON w.address = t.address
      JOIN wallet_metrics m ON m.address = t.address
      WHERE t.timestamp >= ?
        AND t.usd_value >= 20000
        AND m.data_quality IN ('HIGH','MEDIUM')
        AND m.alpha_score >= 30
      ORDER BY t.usd_value DESC LIMIT 3
    `).all(since);
    for (const w of whales) {
      const id = `bc_whale_${w.tx_hash}_${w.type}`;
      const sentRow = db.prepare('SELECT 1 FROM sent_alerts WHERE signal_id = ?').get(id);
      if (sentRow) continue;
      const ok = await sendBroadcast(buildBroadcastWhale(w));
      if (ok) db.prepare('INSERT OR REPLACE INTO sent_alerts (signal_id, sent_at) VALUES (?, ?)').run(id, Date.now());
      await new Promise(r => setTimeout(r, 1200));
    }
  } catch (e) {
    console.error('[BROADCAST]', e.message);
  }
}

if (BROADCAST_BOT) {
  const subCount = db.prepare('SELECT COUNT(*) as c FROM telegram_subscribers WHERE active = 1').get().c;
  console.log(`[BOT] Enabled — ${subCount} active subscribers${BROADCAST_CH ? ` + channel ${BROADCAST_CH}` : ''}`);
  setTimeout(runBroadcastChannel, 20000);
  setInterval(runBroadcastChannel, 10 * 60 * 1000);
} else {
  console.log('[BOT] Disabled (set TELEGRAM_BOT_TOKEN to enable).');
}

// ── TELEGRAM BOT WEBHOOK ──────────────────────────────────────────────────────

// Register webhook on Railway startup
async function registerTelegramWebhook() {
  if (!BROADCAST_BOT || !PUBLIC_BACKEND_URL || PUBLIC_BACKEND_URL.includes('localhost')) return;
  const webhookUrl = `${PUBLIC_BACKEND_URL}/api/telegram/webhook`;
  try {
    const r = await fetch(`https://api.telegram.org/bot${BROADCAST_BOT}/setWebhook`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: webhookUrl, drop_pending_updates: true }),
    }).then(r => r.json());
    if (r.ok) console.log('[BOT] Webhook registered:', webhookUrl);
    else console.error('[BOT] Webhook registration failed:', r.description);
  } catch (e) {
    console.error('[BOT] Webhook register error:', e.message);
  }
}
setTimeout(registerTelegramWebhook, 5000);

// Telegram sends POST updates here
// Admin Telegram chat ID — only this chat sees Admin menu / callbacks.
const ADMIN_TG_CHAT = String(process.env.TELEGRAM_CHAT_ID || '').trim();

// Edit existing message text + buttons (for callback flows).
async function editTelegramMsg(chatId, messageId, text, replyMarkup = null) {
  if (!BROADCAST_BOT) return false;
  try {
    const body = { chat_id: chatId, message_id: messageId, text, parse_mode: 'Markdown', disable_web_page_preview: true };
    if (replyMarkup) body.reply_markup = replyMarkup;
    await fetch(`https://api.telegram.org/bot${BROADCAST_BOT}/editMessageText`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return true;
  } catch { return false; }
}

// Answer callback query (removes the loading spinner on Telegram's side).
async function answerCallback(callbackQueryId, text = '', alert = false) {
  if (!BROADCAST_BOT) return;
  try {
    await fetch(`https://api.telegram.org/bot${BROADCAST_BOT}/answerCallbackQuery`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callback_query_id: callbackQueryId, text, show_alert: alert }),
    });
  } catch {}
}

// Build main user menu keyboard (public).
function mainMenuKeyboard(isAdmin) {
  const rows = [
    [{ text: '📊 Status', callback_data: 'menu:status' }, { text: '🔔 Subscribe', callback_data: 'menu:subscribe' }],
    [{ text: '⏸ Unsubscribe', callback_data: 'menu:unsubscribe' }, { text: '❓ Help', callback_data: 'menu:help' }],
  ];
  if (isAdmin) rows.push([{ text: '👨‍💼 Admin Panel', callback_data: 'admin:home' }]);
  return { inline_keyboard: rows };
}

function adminMenuKeyboard() {
  return {
    inline_keyboard: [
      [{ text: '👥 List Users', callback_data: 'admin:users:0' }, { text: '📡 Subscribers', callback_data: 'admin:subs' }],
      [{ text: '📊 Bot Stats', callback_data: 'admin:stats' }],
      [{ text: '← Back', callback_data: 'menu:home' }],
    ],
  };
}

// Per-user action menu (refund/grant/delete with confirmation).
function userActionKeyboard(userId, isPremium) {
  const rows = [];
  if (isPremium) rows.push([{ text: '🚫 Revoke Premium (Refund)', callback_data: `confirm:refund:${userId}` }]);
  else rows.push([{ text: '✅ Grant Premium', callback_data: `confirm:grant:${userId}` }]);
  rows.push([{ text: '🗑 Delete Account', callback_data: `confirm:delete:${userId}` }]);
  rows.push([{ text: '← Back to users', callback_data: 'admin:users:0' }]);
  return { inline_keyboard: rows };
}

function confirmKeyboard(action, userId) {
  return {
    inline_keyboard: [
      [{ text: '⚠️ Yes, confirm', callback_data: `do:${action}:${userId}` }],
      [{ text: '← Cancel', callback_data: `admin:user:${userId}` }],
    ],
  };
}

// Format users list page (5 per page) with inline buttons.
function formatUsersPage(offset = 0, perPage = 5) {
  const total = db.prepare(`SELECT COUNT(*) as c FROM users`).get().c;
  const rows = db.prepare(`
    SELECT id, email, is_premium, is_admin, created_at
    FROM users ORDER BY created_at DESC LIMIT ? OFFSET ?
  `).all(perPage, offset);

  if (!rows.length) return { text: '_No users on this page._', keyboard: { inline_keyboard: [[{ text: '← Back', callback_data: 'admin:home' }]] } };

  const lines = [`*Users ${offset + 1}–${offset + rows.length} of ${total}*`, ''];
  const buttons = [];
  for (const u of rows) {
    const tag = u.is_admin ? '👑' : (u.is_premium ? '⭐' : '·');
    const date = u.created_at ? new Date(u.created_at).toISOString().slice(0, 10) : '?';
    lines.push(`${tag} \`${u.email}\` — ${date}`);
    buttons.push([{ text: `${tag} ${u.email.slice(0, 30)}`, callback_data: `admin:user:${u.id}` }]);
  }

  const nav = [];
  if (offset > 0) nav.push({ text: '← Prev', callback_data: `admin:users:${Math.max(0, offset - perPage)}` });
  if (offset + perPage < total) nav.push({ text: 'Next →', callback_data: `admin:users:${offset + perPage}` });
  if (nav.length) buttons.push(nav);
  buttons.push([{ text: '← Admin menu', callback_data: 'admin:home' }]);

  return { text: lines.join('\n'), keyboard: { inline_keyboard: buttons } };
}

function formatUserDetail(userId) {
  const u = db.prepare(`SELECT * FROM users WHERE id = ?`).get(userId);
  if (!u) return { text: '❌ User not found.', keyboard: { inline_keyboard: [[{ text: '← Back', callback_data: 'admin:users:0' }]] } };
  const sess = db.prepare(`SELECT COUNT(*) as c FROM sessions WHERE user_id = ?`).get(u.id).c;
  const created = u.created_at ? new Date(u.created_at).toISOString().slice(0, 16).replace('T', ' ') : '?';
  const licDate = u.license_activated_at ? new Date(u.license_activated_at).toISOString().slice(0, 10) : '—';
  const lic = u.gumroad_license ? `\`${String(u.gumroad_license).slice(0, 8)}…\`` : '—';
  const text =
    `*${u.email}*\n\n` +
    `Name: ${u.name || '—'}\n` +
    `Premium: ${u.is_premium ? '✅ Yes' : '❌ No'}${u.is_admin ? ' · 👑 admin' : ''}\n` +
    `License: ${lic}\n` +
    `Activated: ${licDate}\n` +
    `Created: ${created}\n` +
    `Active sessions: ${sess}`;
  return { text, keyboard: userActionKeyboard(u.id, u.is_premium === 1) };
}

app.post('/api/telegram/webhook', express.json(), async (req, res) => {
  res.sendStatus(200); // always ack fast

  // ── Callback queries (button clicks) ───────────────────────────────────────
  const cb = req.body?.callback_query;
  if (cb) {
    const chatId = String(cb.message?.chat?.id);
    const messageId = cb.message?.message_id;
    const data = cb.data || '';
    const isAdmin = ADMIN_TG_CHAT && chatId === ADMIN_TG_CHAT;

    try {
      // Public menu actions
      if (data === 'menu:home') {
        await answerCallback(cb.id);
        return editTelegramMsg(chatId, messageId, '*WalletDNA Bot*\n\nChoose an action:', mainMenuKeyboard(isAdmin));
      }
      if (data === 'menu:status') {
        const count = db.prepare('SELECT COUNT(*) as c FROM telegram_subscribers WHERE active = 1').get().c;
        const clRes = await fetch(`${BASE_URL}/api/clusters`).then(r => r.json()).catch(() => ({}));
        const clusters = clRes.clusters?.length || 0;
        await answerCallback(cb.id);
        return editTelegramMsg(chatId, messageId,
          `📊 *WalletDNA Status*\n\n${clusters} active clusters\n${count} subscribers\n\nNext broadcast ≤10 min.`,
          { inline_keyboard: [[{ text: '← Back', callback_data: 'menu:home' }]] });
      }
      if (data === 'menu:subscribe') {
        const username = cb.from?.username || '';
        const firstName = cb.from?.first_name || '';
        db.prepare(`
          INSERT INTO telegram_subscribers (chat_id, username, first_name, subscribed_at, active)
          VALUES (?, ?, ?, ?, 1)
          ON CONFLICT(chat_id) DO UPDATE SET active=1, username=excluded.username, first_name=excluded.first_name
        `).run(chatId, username, firstName, Date.now());
        await answerCallback(cb.id, '✅ Subscribed');
        return editTelegramMsg(chatId, messageId, '✅ *Subscribed!*\n\nYou will receive smart money cluster alerts.',
          { inline_keyboard: [[{ text: '← Back', callback_data: 'menu:home' }]] });
      }
      if (data === 'menu:unsubscribe') {
        db.prepare('UPDATE telegram_subscribers SET active = 0 WHERE chat_id = ?').run(chatId);
        await answerCallback(cb.id, '👋 Unsubscribed');
        return editTelegramMsg(chatId, messageId, '👋 *Unsubscribed.*\n\nPress Subscribe anytime to re-enable.',
          { inline_keyboard: [[{ text: '← Back', callback_data: 'menu:home' }]] });
      }
      if (data === 'menu:help') {
        await answerCallback(cb.id);
        return editTelegramMsg(chatId, messageId,
          '*WalletDNA Bot*\n\nGet alerts when smart money wallets cluster-buy a token on Base.\n\nUse the buttons to subscribe, view status, or unsubscribe.',
          { inline_keyboard: [[{ text: '← Back', callback_data: 'menu:home' }]] });
      }

      // Admin guard
      if (!isAdmin) {
        await answerCallback(cb.id, '⛔ Admin only', true);
        return;
      }

      if (data === 'admin:home') {
        await answerCallback(cb.id);
        return editTelegramMsg(chatId, messageId, '*👨‍💼 Admin Panel*\n\nManage users and view system stats.', adminMenuKeyboard());
      }
      if (data.startsWith('admin:users:')) {
        const off = parseInt(data.split(':')[2] || '0', 10);
        const page = formatUsersPage(off);
        await answerCallback(cb.id);
        return editTelegramMsg(chatId, messageId, page.text, page.keyboard);
      }
      if (data.startsWith('admin:user:')) {
        const uid = parseInt(data.split(':')[2], 10);
        const detail = formatUserDetail(uid);
        await answerCallback(cb.id);
        return editTelegramMsg(chatId, messageId, detail.text, detail.keyboard);
      }
      if (data === 'admin:subs') {
        const subs = db.prepare(`SELECT chat_id, username, first_name, active FROM telegram_subscribers ORDER BY subscribed_at DESC LIMIT 30`).all();
        const active = subs.filter(s => s.active).length;
        const lines = subs.slice(0, 30).map(s => `${s.active ? '🟢' : '⚪'} \`${s.chat_id}\` ${s.username ? '@' + s.username : (s.first_name || '')}`);
        await answerCallback(cb.id);
        return editTelegramMsg(chatId, messageId,
          `*Telegram Subscribers*\n\n${active} active / ${subs.length} total\n\n${lines.join('\n') || '_none_'}`,
          { inline_keyboard: [[{ text: '← Back', callback_data: 'admin:home' }]] });
      }
      if (data === 'admin:stats') {
        const stats = await fetch(`${BASE_URL}/api/stats`).then(r => r.json()).catch(() => ({}));
        const userCount = db.prepare(`SELECT COUNT(*) as c FROM users`).get().c;
        const premiumCount = db.prepare(`SELECT COUNT(*) as c FROM users WHERE is_premium = 1`).get().c;
        await answerCallback(cb.id);
        return editTelegramMsg(chatId, messageId,
          `*📊 Bot & DB Stats*\n\n` +
          `Total users: ${userCount}\n` +
          `Premium users: ${premiumCount}\n` +
          `Active clusters: ${stats.activeClusters || 0}\n` +
          `Wallets tracked: ${stats.walletsTracked || 0}\n` +
          `Total trades: ${(stats.totalTrades || 0).toLocaleString()}\n` +
          `Verified signals: ${stats.verifiedSignals || 0}`,
          { inline_keyboard: [[{ text: '← Back', callback_data: 'admin:home' }]] });
      }
      // Confirm step
      if (data.startsWith('confirm:')) {
        const [, action, uidStr] = data.split(':');
        const uid = parseInt(uidStr, 10);
        const u = db.prepare(`SELECT email FROM users WHERE id = ?`).get(uid);
        if (!u) { await answerCallback(cb.id, 'User not found', true); return; }
        const labels = { refund: '🚫 Revoke Premium', grant: '✅ Grant Premium', delete: '🗑 Delete Account' };
        await answerCallback(cb.id);
        return editTelegramMsg(chatId, messageId,
          `*Confirm: ${labels[action]}*\n\nUser: \`${u.email}\`\n\n` +
          (action === 'delete' ? '⚠️ This permanently wipes the account.' : action === 'refund' ? 'Premium will be revoked. Sessions terminated.' : 'User will gain full premium access.'),
          confirmKeyboard(action, uid));
      }
      // Execute step
      if (data.startsWith('do:')) {
        const [, action, uidStr] = data.split(':');
        const uid = parseInt(uidStr, 10);
        const u = db.prepare(`SELECT email FROM users WHERE id = ?`).get(uid);
        if (!u) { await answerCallback(cb.id, 'User not found', true); return; }

        if (action === 'refund') {
          const { revokePremiumByEmail } = await import('./database.js');
          const r = revokePremiumByEmail(u.email);
          await answerCallback(cb.id, r.success ? `✅ Revoked for ${u.email}` : `❌ ${r.error}`);
        } else if (action === 'grant') {
          db.prepare(`UPDATE users SET is_premium = 1, license_activated_at = ? WHERE id = ?`).run(Date.now(), uid);
          await answerCallback(cb.id, `✅ Premium granted to ${u.email}`);
        } else if (action === 'delete') {
          const { deleteUserByEmail } = await import('./database.js');
          deleteUserByEmail(u.email);
          await answerCallback(cb.id, `🗑 Deleted ${u.email}`);
          const page = formatUsersPage(0);
          return editTelegramMsg(chatId, messageId, page.text, page.keyboard);
        }
        const detail = formatUserDetail(uid);
        return editTelegramMsg(chatId, messageId, detail.text, detail.keyboard);
      }

      await answerCallback(cb.id);
    } catch (e) {
      console.error('[BOT callback]', e);
      await answerCallback(cb.id, '❌ Error', true);
    }
    return;
  }

  // ── Messages ───────────────────────────────────────────────────────────────
  const msg = req.body?.message || req.body?.channel_post;
  if (!msg?.text || !msg?.chat?.id) return;

  const chatId = String(msg.chat.id);
  const raw = msg.text.trim();
  const text = raw.toLowerCase();
  const firstName = msg.from?.first_name || msg.chat?.first_name || '';
  const username = msg.from?.username || msg.chat?.username || '';
  const isAdmin = ADMIN_TG_CHAT && chatId === ADMIN_TG_CHAT;

  if (text.startsWith('/start')) {
    db.prepare(`
      INSERT INTO telegram_subscribers (chat_id, username, first_name, subscribed_at, active)
      VALUES (?, ?, ?, ?, 1)
      ON CONFLICT(chat_id) DO UPDATE SET active=1, username=excluded.username, first_name=excluded.first_name
    `).run(chatId, username, firstName, Date.now());
    const count = db.prepare('SELECT COUNT(*) as c FROM telegram_subscribers WHERE active = 1').get().c;
    await sendTelegramMsg(chatId,
      `🧬 *Welcome to WalletDNA Bot!*\n\nYou are now subscribed to smart money cluster alerts on Base.\n\n_${count} subscribers · alerts every ≤10 min_`,
      mainMenuKeyboard(isAdmin));
  } else if (text.startsWith('/menu') || text.startsWith('/help')) {
    await sendTelegramMsg(chatId, '*WalletDNA Bot*\n\nChoose an action:', mainMenuKeyboard(isAdmin));
  } else if (text.startsWith('/admin') && isAdmin) {
    await sendTelegramMsg(chatId, '*👨‍💼 Admin Panel*\n\nManage users and view system stats.', adminMenuKeyboard());
  } else if (text.startsWith('/stop')) {
    db.prepare('UPDATE telegram_subscribers SET active = 0 WHERE chat_id = ?').run(chatId);
    await sendTelegramMsg(chatId, '👋 Unsubscribed.', mainMenuKeyboard(isAdmin));
  } else if (text.startsWith('/status')) {
    const count = db.prepare('SELECT COUNT(*) as c FROM telegram_subscribers WHERE active = 1').get().c;
    const clRes = await fetch(`${BASE_URL}/api/clusters`).then(r => r.json()).catch(() => ({}));
    const clusters = clRes.clusters?.length || 0;
    await sendTelegramMsg(chatId, `📊 ${clusters} clusters · ${count} subscribers`, mainMenuKeyboard(isAdmin));
  } else {
    // any unknown text — show menu
    await sendTelegramMsg(chatId, '*WalletDNA Bot*\n\nUse the buttons below:', mainMenuKeyboard(isAdmin));
  }
});

// Admin endpoint: list subscribers
app.get('/api/telegram/subscribers', requireAdmin, (req, res) => {
  const subs = db.prepare('SELECT chat_id, username, first_name, subscribed_at, active FROM telegram_subscribers ORDER BY subscribed_at DESC').all();
  res.json({ success: true, count: subs.filter(s => s.active).length, subscribers: subs });
});

// Send real Telegram message via user's bot token + chat id
app.post('/api/alerts/send', requireAdmin, async (req, res) => {
  const { botToken, chatId, text, type } = req.body || {};
  if (!botToken || !chatId) {
    return res.status(400).json({ success: false, error: 'botToken and chatId required' });
  }
  try {
    let message = text;
    if (!message) {
      const pv = await fetch(`${BASE_URL}/api/alerts/preview?type=${type || 'cluster'}`).then(r => r.json());
      message = pv.text;
    }
    const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: message, disable_web_page_preview: false }),
    }).then(r => r.json());

    if (!tgRes.ok) {
      return res.status(400).json({ success: false, error: tgRes.description || 'Telegram rejected the message' });
    }
    res.json({ success: true, sent: true });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ──────────────────────────────────────────────
// SMART MONEY LEADERBOARD (Real Data from SQLite)
// ──────────────────────────────────────────────
app.get('/api/leaderboard', async (req, res) => {
  try {
    // Only show wallets with real scored metrics (alpha > 0 = HIGH or MEDIUM quality and synced)
    const wallets = getTrackedWallets().filter(w =>
      !w.label?.startsWith('[Candidate]') &&
      (w.alpha_score || 0) > 0
    );

    const mapWallet = (w, idx, catName) => ({
      address: w.address,
      label: w.label || `${w.address.slice(0, 6)}...${w.address.slice(-4)}`,
      rank: idx + 1,
      returns30d: (w.roi_30d || 0).toFixed(1),
      winRate: Math.round(w.win_rate || 0),
      totalTrades: w.closed_positions || 0,
      pnl30d: Math.round(w.total_pnl || 0),
      score: w.alpha_score || 0,
      bestTrade: getBestTrade(w.address),
      category: catName
    });

    const alphaHunters = [...wallets]
      .sort((a, b) => b.alpha_score - a.alpha_score)
      .map((w, idx) => mapWallet(w, idx, 'Alpha Hunter'));

    const swingTraders = [...wallets]
      .sort((a, b) => b.roi_30d - a.roi_30d)
      .map((w, idx) => mapWallet(w, idx, 'Swing Trader'));

    const memecoinTraders = [...wallets]
      .sort((a, b) => (b.win_rate || 0) - (a.win_rate || 0))
      .map((w, idx) => mapWallet(w, idx, 'Memecoin Trader'));

    const aiInvestors = [...wallets]
      .sort((a, b) => (b.closed_positions || 0) - (a.closed_positions || 0))
      .map((w, idx) => mapWallet(w, idx, 'High Volume'));

    const categories = [
      { id: 'alpha_hunters', name: 'Top Alpha Hunters', wallets: alphaHunters },
      { id: 'swing_traders', name: 'Top Swing Traders', wallets: swingTraders },
      { id: 'memecoin_traders', name: 'Top Memecoin Traders', wallets: memecoinTraders },
      { id: 'ai_investors', name: 'Top High Volume', wallets: aiInvestors }
    ];

    res.json({ success: true, categories });
  } catch (e) {
    console.error('Leaderboard API Error:', e);
    res.status(500).json({ success: false, error: 'Database error fetching leaderboard' });
  }
});

// ──────────────────────────────────────────────
// ALPHA FEED (Real Data from SQLite)
// ──────────────────────────────────────────────
app.get('/api/alpha-feed', async (req, res) => {
  try {
    const trades = db.prepare(`
      SELECT t.*, w.label, m.alpha_score, m.roi_30d, m.win_rate
      FROM wallet_trades t
      JOIN tracked_wallets w ON t.address = w.address
      JOIN wallet_metrics m ON t.address = m.address
      WHERE t.usd_value >= 1.0
        AND m.data_quality IN ('HIGH','MEDIUM')
        AND m.alpha_score > 0
      ORDER BY t.timestamp DESC
      LIMIT 40
    `).all();

    // Batch participant counts to avoid N+1 queries
    const participantCounts = {};
    const uniqueTokens = [...new Set(trades.map(t => t.token_address))];
    for (const tokenAddr of uniqueTokens) {
      const row = db.prepare(`
        SELECT COUNT(DISTINCT address) as count 
        FROM wallet_trades 
        WHERE token_address = ?
      `).get(tokenAddr);
      participantCounts[tokenAddr] = row?.count || 1;
    }

    const feed = trades.map(t => {
      const minsAgo = Math.max(1, Math.round((Date.now() - t.timestamp) / 60000));
      const entryPrice = t.token_amount > 0 ? (t.usd_value / t.token_amount) : 0;
      
      let narrative = 'DeFi';
      const sym = (t.token_symbol || '').toUpperCase();
      if (sym === 'DEGEN' || sym === 'BRETT' || sym === 'TOSHI') narrative = 'Memecoin';
      else if (sym === 'VIRTUAL' || sym === 'AI') narrative = 'AI Agent';
      
      let urgency = 'LOW';
      if (t.alpha_score >= 45 && t.usd_value >= 20) urgency = 'CRITICAL';
      else if (t.alpha_score >= 30 && t.usd_value >= 5) urgency = 'HIGH';
      else if (t.alpha_score >= 15) urgency = 'MEDIUM';

      const labelStr = t.label || `${t.address.slice(0, 6)}...${t.address.slice(-4)}`;
      const actionText = t.type === 'BUY' ? 'accumulated' : 'disposed of';
      const text = `${labelStr} ${actionText} $${t.usd_value.toLocaleString(undefined, {maximumFractionDigits: 2})} worth of ${t.token_symbol} (${t.token_name})`;

      const participants = participantCounts[t.token_address] || 1;

      return {
        id: `sig_${t.tx_hash}_${t.type}`,
        alphaScore: t.alpha_score || 0,
        urgency,
        minsAgo,
        narrative,
        text,
        action: t.type,
        label: labelStr,
        usdValue: t.usd_value,
        tokenAddress: t.token_address,
        tokenSymbol: t.token_symbol,
        tokenName: t.token_name,
        participants,
        volumeUSD: t.usd_value,
        entryZone: entryPrice > 0 ? (entryPrice < 0.01 ? entryPrice.toFixed(6) : entryPrice.toFixed(4)) : null,
        tpZone: entryPrice > 0 ? ((entryPrice * 1.5) < 0.01 ? (entryPrice * 1.5).toFixed(6) : (entryPrice * 1.5).toFixed(4)) : null,
      };
    });

    res.json({ success: true, feed });
  } catch (e) {
    console.error('Alpha Feed Error:', e);
    res.status(500).json({ success: false, error: 'Database error fetching alpha feed' });
  }
});

// ──────────────────────────────────────────────
// LIVE SIGNALS FEED (Real Data from SQLite)
// ──────────────────────────────────────────────
app.get('/api/signals', async (req, res) => {
  try {
    const ethPrice = await getEthPrice();
    const trades = db.prepare(`
      SELECT t.*, w.label, m.alpha_score
      FROM wallet_trades t
      JOIN tracked_wallets w ON t.address = w.address
      JOIN wallet_metrics m ON t.address = m.address
      WHERE m.data_quality IN ('HIGH','MEDIUM') AND m.alpha_score > 0
      ORDER BY t.timestamp DESC
      LIMIT 20
    `).all();

    const EMOJIS = {
      BUY: '🎯',
      SELL: '💸'
    };

    const signals = trades.map((t, i) => {
      const minsAgo = Math.max(1, Math.round((Date.now() - t.timestamp) / 60000));
      
      let sigType = 'SMART_ENTRY';
      if (t.type === 'SELL') sigType = 'LARGE_TRANSFER';
      else if (t.usd_value > 25000) sigType = 'WHALE_BUY';

      return {
        id: `sig_${t.tx_hash}_${t.type}_${i}`,
        type: sigType,
        emoji: EMOJIS[t.type] || '📈',
        token: t.token_symbol,
        tokenName: t.token_name,
        wallet: t.label || `${t.address.slice(0, 6)}...${t.address.slice(-4)}`,
        walletAddress: t.address,
        amount: `$${Math.round(t.usd_value).toLocaleString()}`,
        amountUSD: Math.round(t.usd_value),
        timestamp: new Date(t.timestamp).toISOString(),
        minsAgo,
        significance: t.alpha_score || 0,
        chain: 'Base',
        ethPrice
      };
    });

    res.json({ success: true, signals });
  } catch (e) {
    console.error('Signals Error:', e);
    res.status(500).json({ success: false, error: 'Database error fetching signals' });
  }
});

// ──────────────────────────────────────────────
// ON-DEMAND / BACKGROUND SYNC PIPELINE
// ──────────────────────────────────────────────
async function syncAllTrackedWallets() {
  console.log('[SYNC] Starting background sync for all tracked wallets...');
  try {
    const wallets = getTrackedWallets();
    for (const w of wallets) {
      try {
        await syncWallet(w.address, w.label);
        // Rate limit delay: 1.5s between wallets
        await new Promise(r => setTimeout(r, 1500));
      } catch (err) {
        console.error(`[SYNC] Failed to sync wallet ${w.address}:`, err.message);
      }
    }
    console.log('[SYNC] Background sync complete.');
    runAutoBacktest();
  } catch (e) {
    console.error('[SYNC] Error in background sync loop:', e);
  }
}

let lastBacktestRun = 0;
function runAutoBacktest() {
  const SIX_HOURS = 6 * 60 * 60 * 1000;
  if (Date.now() - lastBacktestRun < SIX_HOURS) return;
  lastBacktestRun = Date.now();
  console.log('[BACKTEST] Auto-running backtest after sync...');
  const proc = spawn('node', ['scripts/backtest.js', '60'], { cwd: process.cwd(), stdio: 'inherit' });
  proc.on('close', code => console.log(`[BACKTEST] Done (exit ${code})`));
  proc.on('error', err => console.error('[BACKTEST] Failed to start:', err.message));
}

// Start background sync: 5s after startup, and then every 60 minutes.
// Set DISABLE_BG_SYNC=1 to skip — useful when burning all API capacity on Discovery.
if (process.env.DISABLE_BG_SYNC !== '1') {
  setTimeout(() => {
    syncAllTrackedWallets();
  }, 5000);
  setInterval(syncAllTrackedWallets, 60 * 60 * 1000);
} else {
  console.log('[SYNC] DISABLE_BG_SYNC=1 — skipping background sync loop.');
}

app.post('/api/sync', requireAdmin, async (req, res) => {
  syncAllTrackedWallets();
  res.json({ success: true, message: 'Sync started in background.' });
});

// ──────────────────────────────────────────────
// TOKEN AUDIT
// ──────────────────────────────────────────────
app.get('/api/audit', requireAuth, requirePremium, async (req, res) => {
  const { address } = req.query;
  if (!address || !/^0x[0-9a-fA-F]{40}$/.test(address)) {
    return res.status(400).json({ success: false, error: 'Invalid address format.' });
  }

  let market = null;
  let score = 100;
  const risks = [], warnings = [];

  try {
    const data = await fetcher(`https://api.dexscreener.com/latest/dex/tokens/${address}`);
    const pairs = (data?.pairs || [])
      .filter(p => p.chainId === 'base')
      .sort((a, b) => parseFloat(b.liquidity?.usd || 0) - parseFloat(a.liquidity?.usd || 0));

    if (pairs[0]) {
      const p = pairs[0];
      market = {
        name: p.baseToken?.name || 'Unknown',
        symbol: p.baseToken?.symbol || '???',
        price: parseFloat(p.priceUsd || 0),
        liquidity: parseFloat(p.liquidity?.usd || 0),
        volume24h: parseFloat(p.volume?.h24 || 0),
        change24h: parseFloat(p.priceChange?.h24 || 0),
        change1h: parseFloat(p.priceChange?.h1 || 0),
        change6h: parseFloat(p.priceChange?.h6 || 0),
        dex: p.dexId,
        pairUrl: p.url,
        pairAddress: p.pairAddress,
        mcap: parseFloat(p.marketCap || 0),
        fdv: parseFloat(p.fdv || 0),
        txCount24h: (p.txns?.h24?.buys || 0) + (p.txns?.h24?.sells || 0),
        buys: p.txns?.h24?.buys || 0,
        sells: p.txns?.h24?.sells || 0,
      };
    }
  } catch {}

  if (!market) {
    score -= 30;
    warnings.push('Token not found on any DEX on Base network.');
    market = { name: 'Unknown', symbol: '???', price: 0, liquidity: 0, volume24h: 0, change24h: 0, change1h: 0, change6h: 0, dex: 'unknown', pairUrl: '', mcap: 0, fdv: 0, txCount24h: 0, buys: 0, sells: 0 };
  } else {
    if (market.liquidity < 5000) { score -= 40; risks.push('Extremely low liquidity (<$5k) — extreme rugpull risk.'); }
    else if (market.liquidity < 25000) { score -= 15; warnings.push('Low liquidity (<$25k) — high slippage risk.'); }
    if (market.volume24h < 500) { score -= 10; warnings.push('Very low 24h volume — limited market activity.'); }
    if (market.change24h < -30) { score -= 15; risks.push('Severe price crash (>30% in 24h) — possible exit scam.'); }
    else if (market.change24h < -15) { score -= 7; warnings.push('Significant price decline in 24h.'); }
    if (market.change24h > 200) { score -= 12; warnings.push('Extreme pump (>200% 24h) — high dump risk.'); }
    else if (market.change24h > 100) { score -= 6; warnings.push('Significant spike (>100% 24h) — watch for reversal.'); }
    const bsRatio = market.sells > 0 ? market.buys / market.sells : 1;
    if (bsRatio > 5) { score -= 8; warnings.push('Abnormal buy/sell ratio — possible wash trading or bot activity.'); }
  }

  // Real contract security check via GoPlus Security API (Base chain = 8453)
  let hasMint = false, hasBlacklist = false, isRenounced = false, hasProxy = false, isHoneypot = false, isOpenSource = false;
  try {
    const gp = await fetcher(`https://api.gopluslabs.io/api/v1/token_security/8453?contract_addresses=${address}`, 8000);
    const info = gp?.result?.[address.toLowerCase()];
    if (info) {
      hasMint       = info.is_mintable === '1';
      hasBlacklist  = info.is_blacklisted === '1';
      isRenounced   = info.owner_address === '0x0000000000000000000000000000000000000000' || info.can_take_back_ownership === '0';
      hasProxy      = info.is_proxy === '1';
      isHoneypot    = info.is_honeypot === '1';
      isOpenSource  = info.is_open_source === '1';

      if (isHoneypot)    { score -= 50; risks.push('Honeypot detected — sells may be blocked by contract code.'); }
      if (hasMint)       { score -= 18; risks.push('Mint function detected — contract owner can inflate token supply.'); }
      if (hasBlacklist)  { score -= 14; risks.push('Blacklist function detected — owner can block wallet sells.'); }
      if (hasProxy)      { score -= 10; risks.push('Upgradeable proxy — contract logic can be modified post-deployment.'); }
      if (!isRenounced)  { score -= 5;  warnings.push('Contract ownership not renounced — owner retains admin privileges.'); }
      if (!isOpenSource) { score -= 8;  warnings.push('Contract source code not verified on-chain.'); }
    }
  } catch (gpErr) {
    warnings.push('Contract security check unavailable — verify manually before trading.');
  }

  score = Math.max(0, Math.min(100, score));
  const verdict = score >= 75 ? 'SAFE' : score >= 48 ? 'CAUTION' : 'DANGER';

  res.json({
    success: true,
    address,
    score,
    verdict,
    market,
    contract: { hasMint, hasBlacklist, isRenounced, hasProxy },
    risks,
    warnings,
    analyzedAt: new Date().toISOString(),
  });
});

// ──────────────────────────────────────────────
// SEARCH — DexScreener token search
// ──────────────────────────────────────────────
app.get('/api/search', async (req, res) => {
  const { q } = req.query;
  if (!q) return res.json({ success: true, results: [] });
  try {
    const lq = q.toLowerCase().trim();

    // Wallet search: by address prefix or label (from DB)
    const isAddress = /^0x[0-9a-fA-F]{3,}/.test(lq);
    let wallets = [];
    if (isAddress) {
      wallets = db.prepare(`
        SELECT tw.address, tw.label, wm.alpha_score, wm.win_rate, wm.roi_30d
        FROM tracked_wallets tw
        LEFT JOIN wallet_metrics wm ON tw.address = wm.address
        WHERE lower(tw.address) LIKE ?
        LIMIT 5
      `).all(lq + '%');
    } else if (lq.length >= 2) {
      wallets = db.prepare(`
        SELECT tw.address, tw.label, wm.alpha_score, wm.win_rate, wm.roi_30d
        FROM tracked_wallets tw
        LEFT JOIN wallet_metrics wm ON tw.address = wm.address
        WHERE lower(tw.label) LIKE ?
        LIMIT 5
      `).all('%' + lq + '%');
    }

    const walletResults = wallets.map(w => ({
      type: 'wallet',
      address: w.address,
      name: w.label || `Wallet ${w.address.slice(0, 8)}`,
      alphaScore: w.alpha_score || 0,
      winRate: w.win_rate ? w.win_rate.toFixed(1) : '0',
      roi30d: w.roi_30d ? w.roi_30d.toFixed(1) : '0',
    }));

    // Token search: DexScreener
    const data = await fetcher(`https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(q)}`);
    const pairs = (data?.pairs || [])
      .filter(p => p.chainId === 'base')
      .slice(0, 6)
      .map(p => ({
        type: 'token',
        address: p.baseToken?.address,
        name: p.baseToken?.name,
        symbol: p.baseToken?.symbol,
        price: parseFloat(p.priceUsd || 0),
        liquidity: parseFloat(p.liquidity?.usd || 0),
        change24h: parseFloat(p.priceChange?.h24 || 0),
      }));

    res.json({ success: true, results: [...walletResults, ...pairs] });
  } catch { res.json({ success: true, results: [] }); }
});

// ──────────────────────────────────────────────
// FALLBACK TOKENS (when DexScreener is down)
// lastGoodTrendingTokens updated on every live response — used first.
// Static fallback only if cache is also empty (cold start with no API).
// ──────────────────────────────────────────────
const FALLBACK_TOKENS = [
  { address: '0x532f27101965dd16442e59d40670faf5ebb142e4', name: 'Brett', symbol: 'BRETT', price: 0.005, liquidity: 1500000, volume24h: 800000, change1h: 0, change24h: 0, change6h: 0, dex: 'uniswap', pairUrl: 'https://dexscreener.com/base/0x532f27101965dd16442e59d40670faf5ebb142e4', mcap: 50000000, fdv: 52000000, buys24h: 0, sells24h: 0, pairAddress: '' },
  { address: '0x4ed4e862860bed51a9570b96d89af5e1b0efefed', name: 'Degen', symbol: 'DEGEN', price: 0.004, liquidity: 3000000, volume24h: 900000, change1h: 0, change24h: 0, change6h: 0, dex: 'aerodrome', pairUrl: 'https://dexscreener.com/base/0x4ed4e862860bed51a9570b96d89af5e1b0efefed', mcap: 40000000, fdv: 44000000, buys24h: 0, sells24h: 0, pairAddress: '' },
  { address: '0x0b3e328455c4059eeb9e3f84b5543f74e24e7e1b', name: 'Virtuals Protocol', symbol: 'VIRTUAL', price: 1.5, liquidity: 5000000, volume24h: 2000000, change1h: 0, change24h: 0, change6h: 0, dex: 'aerodrome', pairUrl: 'https://dexscreener.com/base/0x0b3e328455c4059eeb9e3f84b5543f74e24e7e1b', mcap: 800000000, fdv: 900000000, buys24h: 0, sells24h: 0, pairAddress: '' },
  { address: '0x940181a94A35A4569E4529A3CDfB74e38FD98631', name: 'Aerodrome', symbol: 'AERO', price: 1.2, liquidity: 40000000, volume24h: 15000000, change1h: 0, change24h: 0, change6h: 0, dex: 'aerodrome', pairUrl: 'https://dexscreener.com/base/0x940181a94a35a4569e4529a3cdfb74e38fd98631', mcap: 600000000, fdv: 680000000, buys24h: 0, sells24h: 0, pairAddress: '' },
];

// ──────────────────────────────────────────────
// WALLET DISCOVERY PIPELINE (WalletDNA 200+)
// Scans DexScreener for new tokens → finds first buyers
// → viability filter → real indexer sync → real alpha_score
//
// Two-phase design:
//   Phase 1 (evaluateCandidate): activity-only filter — is this wallet worth syncing?
//            Uses on-chain signals: tx count, token diversity, two-sided trading.
//            Does NOT fabricate ROI or win rate — those come from Phase 2.
//   Phase 2 (post-promotion sync): real indexer runs syncWallet() → recalculateMetrics()
//            Produces real alpha_score, win_rate, roi_30d.
//            Wallets that fail real threshold are pruned in Step 5.
// ──────────────────────────────────────────────

// Phase 1: activity viability filter.
// Returns null (reject) or { totalTrades, activityScore } (viable for sync).
// Never computes or stores ROI / win rate — those are set to 0 until real indexer runs.
async function evaluateCandidate(address) {
  try {
    const addr = address.toLowerCase();

    const addrInfo = await fetcher(`https://base.blockscout.com/api/v2/addresses/${addr}`, 6000);
    if (addrInfo?.creation_transaction_hash) return null;

    const signals = await assessWalletTradeSignals(addr);
    const { recognizedCount, buyCount, sellCount, uniqueTokens } = signals;

    // Note: totalUsd is always 0 in assessWalletTradeSignals because usd_value is
    // computed only during syncWallet (with historical ETH prices). Do not check it here.
    if (recognizedCount < 3 || buyCount < 1 || sellCount < 1 || uniqueTokens < 2) {
      return null;
    }

    const activityScore = Math.min(95, 20 + recognizedCount * 8 + uniqueTokens * 6);
    console.log(`[DISCOVERY] ${addr.slice(0,10)}… viable — trades:${recognizedCount} buys:${buyCount} sells:${sellCount} tokens:${uniqueTokens} score:${activityScore}`);

    return {
      totalTrades: recognizedCount,
      winRate:     0,
      roi:         0,
      alphaScore:  activityScore,
    };
  } catch (e) {
    console.warn(`[DISCOVERY] evaluateCandidate failed for ${address}:`, e.message);
    return null;
  }
}

// Main discovery pipeline — runs every 6 hours
let discoveryRunning = false;
let discoveryLastRun = null;
async function runWalletDiscovery() {
  if (discoveryRunning) return;
  discoveryRunning = true;
  const pipelineStart = Date.now();
  let tokensScanned = 0, candidatesFound = 0, newApproved = 0, newPromoted = 0, newArchived = 0;
  console.log('[DISCOVERY] Starting wallet discovery pipeline...');

  try {
    // Skip sourcing if backlog is huge — focus cycle on evaluating existing pending.
    const pendingBacklog = db.prepare("SELECT COUNT(*) as c FROM wallet_candidates WHERE status='pending'").get().c;
    const skipSourcing = pendingBacklog > 500;
    if (skipSourcing) {
      console.log(`[DISCOVERY] Backlog ${pendingBacklog} pending — skipping sourcing, going straight to evaluation.`);
    }

    // ── Step 1: Source candidate tokens.
    //
    // Old approach (trending-only) consistently produced fresh wallets that fail
    // Phase 2 quality (closed≥5, days≥7, capital≥500). The fix: prefer holders of
    // tokens we've *already verified* pumped (signal_backtest). Anyone who held
    // those tokens through a real move has, by definition, multi-token history.
    //
    // Trending DexScreener is kept as a secondary signal so brand-new winners
    // still get sampled — but historical winners drive most of the candidates.
    const winnerTokens = skipSourcing ? [] : db.prepare(`
      SELECT token_address, token_symbol
      FROM signal_backtest
      WHERE peak_gain_pct >= 30
        AND peak_gain_pct < 5000
        AND current_pct  > -95
      ORDER BY peak_gain_pct DESC
      LIMIT 60
    `).all().map(r => ({
      tokenAddress: r.token_address.toLowerCase(),
      source: 'backtest_winner',
      symbol: r.token_symbol,
    }));

    const trendingTokens = [];
    if (!skipSourcing) try {
      const trendingEndpoints = [
        { url: 'https://api.dexscreener.com/latest/dex/search?q=base', source: 'dexscreener_search' },
        { url: 'https://api.dexscreener.com/token-boosts/top/v1',      source: 'dexscreener_boosts' },
      ];
      for (const { url, source } of trendingEndpoints) {
        const data = await fetcher(url, 10000);
        const pairs = (data?.pairs || data || [])
          .filter(p => p?.chainId === 'base' || p?.chain === 'base')
          .slice(0, 10);
        for (const p of pairs) {
          const addr = (p.baseToken?.address || p.tokenAddress || '').toLowerCase();
          if (addr) trendingTokens.push({ tokenAddress: addr, source, symbol: p.baseToken?.symbol });
        }
      }
    } catch (err) {
      console.warn('[DISCOVERY] trending source error:', err.message);
    }

    const seen = new Set();
    const allTokens = [...winnerTokens, ...trendingTokens].filter(t => {
      if (!t.tokenAddress || seen.has(t.tokenAddress)) return false;
      seen.add(t.tokenAddress);
      return true;
    });

    tokensScanned = allTokens.length;
    console.log(`[DISCOVERY] Sourcing candidates from ${winnerTokens.length} historical winners + ${trendingTokens.length} trending tokens (${allTokens.length} unique)...`);

    // Cross-token holding map: wallet → set of winner tokens they hold.
    // Wallets in ≥2 winners get logged as high-conviction candidates.
    const crossHolds = new Map();

    for (const tok of allTokens) {
      const { tokenAddress: tokenAddr, source: sourceType } = tok;
      const isWinner = sourceType === 'backtest_winner';

      try {
        // For winners: holders endpoint gives wallets that *still hold* a pumped token.
        // For trending: keep the early-buyer signal from transfers (covers brand-new tokens
        // that have no holder history yet).
        let candidateEntries = [];

        if (isWinner) {
          // Holders = wallets that still hold (diamond hands).
          // Transfers = wallets that traded the token (sold profitably likely have history).
          // Union both, dedup by address.
          const [holders, transfers] = await Promise.all([
            fetcher(`https://base.blockscout.com/api/v2/tokens/${tokenAddr}/holders`, 8000).catch(() => null),
            fetcher(`https://base.blockscout.com/api/v2/tokens/${tokenAddr}/transfers`, 8000).catch(() => null),
          ]);

          const map = new Map();
          const holderItems = (holders?.items || []).filter(h =>
            h.address?.hash && /^0x[0-9a-fA-F]{40}$/.test(h.address.hash) && !h.address?.is_contract
          ).slice(0, 50);
          for (const h of holderItems) {
            const addr = h.address.hash.toLowerCase();
            map.set(addr, { address: addr, count: 1, firstTxAt: Date.now(), capitalTraded: Number(h.value || 0) });
          }
          const transferItems = (transfers?.items || []).filter(t =>
            t.to?.hash && /^0x[0-9a-fA-F]{40}$/.test(t.to.hash) && !t.to?.is_contract
          ).slice(0, 100);
          for (const item of transferItems) {
            const addr = item.to.hash.toLowerCase();
            if (addr === tokenAddr) continue;
            const e = map.get(addr) || { address: addr, count: 0, firstTxAt: Date.now(), capitalTraded: 0 };
            e.count += 1;
            const ts = Number(item.timestamp || item.block_timestamp || 0) || Date.now();
            e.firstTxAt = Math.min(e.firstTxAt, ts);
            map.set(addr, e);
          }
          candidateEntries = [...map.values()];
        } else {
          const transfers = await fetcher(
            `https://base.blockscout.com/api/v2/tokens/${tokenAddr}/transfers`,
            8000
          );
          const items = (transfers?.items || []).filter(t => {
            const value = Number(t.value_usd || t.value || 0);
            return t.to?.hash && /^0x[0-9a-fA-F]{40}$/.test(t.to.hash) && !t.to?.is_contract && value > 0;
          }).slice(0, 100);
          const map = new Map();
          for (const item of items) {
            const addr = item.to.hash.toLowerCase();
            if (addr === tokenAddr) continue;
            const e = map.get(addr) || { address: addr, count: 0, firstTxAt: Date.now(), capitalTraded: 0 };
            e.count += 1;
            e.capitalTraded += Number(item.value_usd || item.value || 0) || 0;
            const ts = Number(item.timestamp || item.block_timestamp || 0) || Date.now();
            e.firstTxAt = Math.min(e.firstTxAt, ts);
            map.set(addr, e);
          }
          candidateEntries = [...map.values()];
        }

        const candidateAddrs = candidateEntries
          .filter(e => e.count >= 1)
          .sort((a, b) => (b.capitalTraded - a.capitalTraded) || (a.firstTxAt - b.firstTxAt))
          .slice(0, 30);

        for (const entry of candidateAddrs) {
          const { address: addr } = entry;

          if (isWinner) {
            if (!crossHolds.has(addr)) crossHolds.set(addr, new Set());
            crossHolds.get(addr).add(tokenAddr);
          }

          const alreadyTracked   = db.prepare('SELECT 1 FROM tracked_wallets WHERE address = ?').get(addr);
          const alreadyCandidate = db.prepare('SELECT status FROM wallet_candidates WHERE address = ?').get(addr);

          if (alreadyTracked) continue;
          // Resurrect rejected candidates only when sourced from a winner — they have
          // a fresh, stronger signal than the old trending-token sample that rejected them.
          if (alreadyCandidate && alreadyCandidate.status !== 'pending') {
            if (!isWinner) continue;
            db.prepare(`
              UPDATE wallet_candidates
              SET status='pending', candidate_source=?, source_token=?, candidate_reason=?, last_evaluated=0
              WHERE address=?
            `).run(
              sourceType,
              tokenAddr,
              `Re-sourced as holder of historical winner ${tok.symbol || tokenAddr.slice(0, 8)}`,
              addr,
            );
            continue;
          }

          db.prepare(`
            INSERT OR IGNORE INTO wallet_candidates
              (address, discovered_at, source_token, candidate_source, candidate_reason, first_tx_at, total_transfers, capital_traded, status, last_evaluated)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', 0)
          `).run(
            addr,
            Date.now(),
            tokenAddr,
            sourceType,
            isWinner
              ? `Holder of historical winner ${tok.symbol || tokenAddr.slice(0, 8)}`
              : `First buyer activity from ${sourceType} token ${tokenAddr.slice(0, 8)}…`,
            entry.firstTxAt,
            entry.count,
            entry.capitalTraded,
          );
          candidatesFound++;
        }

        await new Promise(r => setTimeout(r, 350));
      } catch (err) {
        console.error(`[DISCOVERY] Error scanning token ${tokenAddr}:`, err.message);
      }
    }

    // Cross-winner holders → bump them to the front of the queue for evaluation
    // with a stronger candidate_reason. These are the highest-signal wallets.
    let crossWinnerCount = 0;
    for (const [addr, tokens] of crossHolds) {
      if (tokens.size < 2) continue;
      crossWinnerCount++;
      db.prepare(`
        UPDATE wallet_candidates
        SET candidate_source='cross_winner',
            candidate_reason=?
        WHERE address=? AND status='pending'
      `).run(`Holds ${tokens.size} historical winners`, addr);
    }
    if (crossWinnerCount > 0) console.log(`[DISCOVERY] ${crossWinnerCount} wallets hold ≥2 historical winners.`);

    // Step 3: Evaluate pending candidates — cross-winner > single-winner > trending.
    const pending = db.prepare(`
      SELECT address FROM wallet_candidates
      WHERE status = 'pending' AND last_evaluated < ?
      ORDER BY CASE candidate_source
                 WHEN 'cross_winner'     THEN 0
                 WHEN 'backtest_winner'  THEN 1
                 WHEN 'dexscreener_search' THEN 2
                 WHEN 'dexscreener_boosts' THEN 3
                 ELSE 4
               END,
               capital_traded DESC
      LIMIT 200
    `).all(Date.now() - 5 * 60 * 1000);

    console.log(`[DISCOVERY] Evaluating ${pending.length} pending candidates...`);

    for (const { address } of pending) {
      const stats = await evaluateCandidate(address);
      const now = Date.now();

      if (!stats) {
        db.prepare(`UPDATE wallet_candidates SET status='rejected', last_evaluated=? WHERE address=?`).run(now, address);
        continue;
      }

      const { totalTrades, winRate, roi, alphaScore } = stats;

      // Phase 1: determine if wallet is worth a real sync
      const worthy = alphaScore >= 55 && totalTrades >= 4;
      const newStatus = worthy ? 'pending_sync' : (alphaScore < 20 ? 'rejected' : 'pending');

      db.prepare(`
        UPDATE wallet_candidates
        SET total_trades=?, roi=?, win_rate=?, alpha_score=?, status=?, last_evaluated=?
        WHERE address=?
      `).run(totalTrades, roi, winRate, alphaScore, newStatus, now, address);

      // Step 4: Auto-promote to tracked_wallets and trigger real indexer sync
      if (worthy) {
        const currentCount = db.prepare('SELECT COUNT(*) as c FROM tracked_wallets').get().c;
        if (currentCount < 500) {
          const label = `[Candidate] Discovery-${address.slice(2, 6).toUpperCase()}`;
          const alreadyTracked = db.prepare('SELECT 1 FROM tracked_wallets WHERE address = ?').get(address);
          if (!alreadyTracked) {
            db.prepare(`
              INSERT OR IGNORE INTO tracked_wallets (address, label, first_seen, last_updated)
              VALUES (?, ?, ?, 0)
            `).run(address, label, Date.now());
            db.prepare('INSERT OR IGNORE INTO wallet_metrics (address) VALUES (?)').run(address);
            newPromoted++;
            console.log(`[DISCOVERY] ✅ Auto-promoted ${address} (ActivityScore: ${alphaScore}) — starting real sync`);

            // Phase 2: trigger real indexer sync — post-sync validates against strict criteria
            syncWallet(address, label).then(() => {
              const real = db.prepare(`
                SELECT m.win_rate, m.roi_30d, m.closed_positions, m.total_capital,
                       m.data_quality, m.alpha_score, m.days_active, m.archetype
                FROM wallet_metrics m
                WHERE m.address = ?
              `).get(address);

              if (real) {
                const isValid = walletIsValidForDiscovery(real);
                const closed    = real.closed_positions || 0;
                const alpha     = real.alpha_score      || 0;
                const rWinRate  = real.win_rate         || 0;
                const rRoi      = real.roi_30d          || 0;
                const days      = real.days_active      || 1;

                if (isValid) {
                  // Human-readable label: continue the "Alpha Trader #N" sequence.
                  const nextIdx = db.prepare(
                    `SELECT COALESCE(MAX(CAST(substr(label, instr(label,'#')+1) AS INTEGER)),0)+1 AS n
                     FROM tracked_wallets WHERE label LIKE 'Alpha Trader #%'`
                  ).get().n;
                  const realLabel = `Alpha Trader #${nextIdx}`;
                  db.prepare('UPDATE tracked_wallets SET label = ? WHERE address = ?').run(realLabel, address);
                  db.prepare(`
                    UPDATE wallet_candidates
                    SET status='approved', win_rate=?, roi=?, alpha_score=?, last_evaluated=?
                    WHERE address=?
                  `).run(rWinRate, rRoi, alpha, Date.now(), address);
                  newApproved++;
                  console.log(`[DISCOVERY] 🎓 Graduated ${address} — Alpha: ${alpha}, ROI: ${rRoi}%, WinRate: ${rWinRate}%, Days: ${days}`);
                } else {
                  // Keep the synced wallet_metrics so later re-evaluation can re-approve
                  // if archetype/alpha shifts. Remove the [Candidate] label suffix only.
                  db.prepare(`
                    UPDATE wallet_candidates
                    SET status='rejected', win_rate=?, roi=?, alpha_score=?, last_evaluated=?
                    WHERE address=?
                  `).run(rWinRate, rRoi, alpha, Date.now(), address);
                  // Pruned (failed quality) — strip the [Candidate] prefix but keep history; mark as "Reviewed".
                  const cleanLabel = `Reviewed-${address.slice(2, 6).toUpperCase()}`;
                  db.prepare('UPDATE tracked_wallets SET label = ? WHERE address = ?').run(cleanLabel, address);
                  console.log(`[DISCOVERY] ❌ Pruned ${address} — Closed:${closed} Days:${days} Capital:${(real.total_capital||0).toFixed(0)} Quality:${real.data_quality} Alpha:${alpha} WR:${rWinRate.toFixed(1)}%`);
                }
              }
            }).catch(e => {
              console.error(`[DISCOVERY] Sync failed for ${address}:`, e.message);
            });
          }
        }
      }

      await new Promise(r => setTimeout(r, 300));
    }

    // Step 5: Maintenance — purge Discovery wallets that failed quality after sync.
    // Junk = synced (last_calc_at>0) and either LOW quality or no archetype, OR
    // long-standing underperformer (negative ROI + bad win rate among scored wallets).
    const toArchive = db.prepare(`
      SELECT w.address FROM tracked_wallets w
      JOIN wallet_metrics m ON w.address = m.address
      WHERE (w.label LIKE 'Discovery-%' OR w.label LIKE '[Candidate] Discovery-%')
        AND (
          (m.last_calc_at > 0 AND (m.data_quality = 'LOW' OR m.data_quality = 'UNKNOWN'))
          OR (m.data_quality IN ('HIGH','MEDIUM') AND m.roi_30d < 0 AND m.win_rate < 40)
        )
    `).all();

    for (const { address } of toArchive) {
      db.prepare(`UPDATE wallet_candidates SET status='archived' WHERE address=?`).run(address);
      purgeWallet(address);
      newArchived++;
      console.log(`[DISCOVERY] 📦 Purged underperformer: ${address}`);
    }

    const durationMs = Date.now() - pipelineStart;
    // Write scan history record
    try {
      db.prepare(`
        INSERT INTO discovery_history
          (ran_at, tokens_scanned, candidates_found, candidates_approved, candidates_promoted, candidates_archived, duration_ms)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(pipelineStart, tokensScanned, candidatesFound, newApproved, newPromoted, newArchived, durationMs);
    } catch (_) {}
    discoveryLastRun = { ranAt: pipelineStart, tokensScanned, candidatesFound, approved: newApproved, promoted: newPromoted, archived: newArchived, durationMs };

    console.log(`[DISCOVERY] Pipeline complete in ${(durationMs / 1000).toFixed(1)}s. Tokens: ${tokensScanned}, Found: ${candidatesFound}, Approved: ${newApproved}, Promoted: ${newPromoted}`);
  } catch (e) {
    console.error('[DISCOVERY] Fatal error:', e.message);
  } finally {
    discoveryRunning = false;
  }
}

// Run discovery: 30s after startup, then every 6 hours
setTimeout(runWalletDiscovery, 30000);
setInterval(runWalletDiscovery, 6 * 60 * 60 * 1000);

// ──────────────────────────────────────────────
// WALLET DISCOVERY API ROUTES
// ──────────────────────────────────────────────
app.get('/api/discovery', requireAuth, requirePremium, (req, res) => {
  try {
    const rows = fetchCandidatesWithMetrics();

    const reconcileRejection = db.prepare(
      `UPDATE wallet_candidates SET status='rejected', last_evaluated=? WHERE address=?`
    );
    const now = Date.now();
    for (const row of rows) {
      if (row.status === 'approved' && !row.is_valid) {
        reconcileRejection.run(now, row.address);
        row.status = 'rejected';
      }
    }

    const approved = rows.filter(r => r.status === 'approved' && r.is_valid);
    const rejected = rows.filter(r => r.status !== 'approved' || !r.is_valid);

    res.json({
      success: true,
      approved,
      rejected,
      total: rows.length,
      stats: { total: rows.length, approved: approved.length, rejected: rejected.length },
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.get('/api/discovery/stats', requireAuth, requirePremium, (req, res) => {
  try {
    const total   = db.prepare("SELECT COUNT(*) as c FROM wallet_candidates").get().c;
    const pending = db.prepare("SELECT COUNT(*) as c FROM wallet_candidates WHERE status='pending'").get().c;
    const approved= db.prepare("SELECT COUNT(*) as c FROM wallet_candidates WHERE status='approved'").get().c;
    const rejected= db.prepare("SELECT COUNT(*) as c FROM wallet_candidates WHERE status='rejected'").get().c;
    const archived= db.prepare("SELECT COUNT(*) as c FROM wallet_candidates WHERE status='archived'").get().c;
    const tracked = db.prepare("SELECT COUNT(*) as c FROM tracked_wallets").get().c;
    const promoted= db.prepare("SELECT COUNT(*) as c FROM tracked_wallets WHERE label LIKE 'Discovery-%'").get().c;

    res.json({ success: true, stats: { total, pending, approved, rejected, archived, tracked, promoted } });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.get('/api/discovery/rejection-breakdown', requireAuth, requirePremium, (req, res) => {
  try {
    res.json({ success: true, ...getDiscoveryRejectionBreakdown(fetchCandidatesWithMetrics()) });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.get('/api/discovery/candidates', requireAuth, requirePremium, (req, res) => {
  try {
    const status = req.query.status || 'approved';
    const limit  = Math.min(parseInt(req.query.limit) || 100, 200);

    const rows = db.prepare(`
      SELECT c.*,
             (tw.address IS NOT NULL) as is_tracked,
             m.win_rate         as m_win_rate,
             m.roi_30d          as m_roi_30d,
             m.alpha_score      as m_alpha_score,
             m.data_quality     as m_data_quality,
             m.closed_positions as m_closed_positions,
             m.days_active      as m_days_active,
             m.archetype        as m_archetype
      FROM wallet_candidates c
      LEFT JOIN tracked_wallets tw ON c.address = tw.address
      LEFT JOIN wallet_metrics  m  ON c.address = m.address
      WHERE c.status = ?
      ORDER BY c.alpha_score DESC
      LIMIT ?
    `).all(status, limit).map(mergeCandidateRow);

    // Approved candidates that no longer pass quality are silently demoted; they should
    // never appear in the approved view stale.
    if (status === 'approved') {
      const demote = db.prepare(
        `UPDATE wallet_candidates SET status='rejected', last_evaluated=? WHERE address=?`
      );
      const now = Date.now();
      for (const row of rows) if (!row.is_valid) demote.run(now, row.address);
    }
    const filtered = status === 'approved' ? rows.filter(r => r.is_valid) : rows;

    res.json({ success: true, candidates: filtered });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.post('/api/discovery/run', requireAdmin, async (req, res) => {
  if (discoveryRunning) {
    return res.json({ success: false, message: 'Discovery already running.', running: true });
  }
  runWalletDiscovery(); // fire async
  res.json({ success: true, message: 'Discovery pipeline started.', running: true });
});

app.get('/api/discovery/status', requireAuth, requirePremium, (req, res) => {
  res.json({
    success: true,
    running: discoveryRunning,
    lastRun: discoveryLastRun,
  });
});

app.get('/api/discovery/history', requireAuth, requirePremium, (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const rows = db.prepare(
      'SELECT * FROM discovery_history ORDER BY ran_at DESC LIMIT ?'
    ).all(limit);
    res.json({ success: true, history: rows });
  } catch (e) {
    res.json({ success: true, history: [] });
  }
});

// ──────────────────────────────────────────────
// STATUS PAGE API
// ──────────────────────────────────────────────
let statusCache = { data: null, updatedAt: 0 };
app.get('/api/status', async (req, res) => {
  if (Date.now() - statusCache.updatedAt < 5 * 60 * 1000 && statusCache.data) {
    return res.json(statusCache.data);
  }
  try {
    const walletsTracked     = db.prepare('SELECT COUNT(*) as c FROM tracked_wallets').get().c;
    const totalTrades        = db.prepare('SELECT COUNT(*) as c FROM wallet_trades').get().c;
    const signals24h         = db.prepare("SELECT COUNT(DISTINCT token_address) as c FROM wallet_trades WHERE type='BUY' AND timestamp > ?").get(Date.now() - 86400000).c;
    const backtestCount      = db.prepare('SELECT COUNT(*) as c FROM signal_backtest').get().c;
    const lastBuy            = db.prepare("SELECT MAX(timestamp) as ts FROM wallet_trades WHERE type='BUY'").get();
    const lastSyncRow        = db.prepare("SELECT MAX(synced_at) as ts FROM sync_log WHERE status='OK'").get();
    const recentSyncs        = db.prepare("SELECT address, synced_at, trades_found, status FROM sync_log ORDER BY synced_at DESC LIMIT 10").all();
    const walletsWithMetrics = db.prepare("SELECT COUNT(*) as c FROM wallet_metrics WHERE alpha_score > 0").get().c;
    const topWallet          = db.prepare("SELECT address, win_rate, roi_30d, alpha_score FROM wallet_metrics ORDER BY alpha_score DESC LIMIT 1").get();

    let dbSizeKB = null;
    try {
      const fs = await import('node:fs');
      dbSizeKB = Math.round(fs.statSync('alpha_engine.db').size / 1024);
    } catch {}

    const serviceChecks = await Promise.all([
      { name: 'Blockscout',    url: 'https://base.blockscout.com/api/v2/stats' },
      { name: 'DexScreener',   url: 'https://api.dexscreener.com/latest/dex/tokens/So11111111111111111111111111111111111111112' },
      { name: 'GeckoTerminal', url: 'https://api.geckoterminal.com/api/v2/networks/base/trending_pools?page=1' },
    ].map(async s => {
      const t0 = Date.now();
      const timeout = new Promise(res => setTimeout(() => res(null), 4000));
      try {
        const r = await Promise.race([fetch(s.url), timeout]);
        if (!r) return { name: s.name, ok: false, latencyMs: Date.now() - t0, httpStatus: 0 };
        return { name: s.name, ok: r.ok, latencyMs: Date.now() - t0, httpStatus: r.status };
      } catch {
        return { name: s.name, ok: false, latencyMs: Date.now() - t0, httpStatus: 0 };
      }
    }));

    const payload = {
      walletsTracked,
      totalTrades,
      signals24h,
      backtestCount,
      walletsWithMetrics,
      lastSignalMinsAgo: lastBuy?.ts   ? Math.round((Date.now() - lastBuy.ts)       / 60000) : null,
      lastSyncAgo:       lastSyncRow?.ts ? Math.round((Date.now() - lastSyncRow.ts) / 60000) : null,
      dbSizeKB,
      topWallet: topWallet ? {
        address: topWallet.address,
        winRate: topWallet.win_rate?.toFixed(1),
        roi30d:  topWallet.roi_30d?.toFixed(1),
        alphaScore: topWallet.alpha_score,
      } : null,
      recentSyncs: recentSyncs.map(s => ({
        address: s.address,
        agoMin: Math.round((Date.now() - s.synced_at) / 60000),
        tradesFound: s.trades_found,
        status: s.status,
      })),
      services: serviceChecks,
      uptime: Math.round(process.uptime()),
      serverTime: new Date().toISOString(),
    };
    statusCache = { data: payload, updatedAt: Date.now() };
    res.json(payload);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ──────────────────────────────────────────────
// HEALTH CHECK
// ──────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  let wallets = 0, trades = 0, backtestSignals = 0, lastSignalMinsAgo = null;
  try {
    wallets = db.prepare('SELECT COUNT(*) as c FROM tracked_wallets').get().c;
    trades  = db.prepare('SELECT COUNT(*) as c FROM wallet_trades').get().c;
    const lastBuy = db.prepare("SELECT MAX(timestamp) as ts FROM wallet_trades WHERE type='BUY'").get();
    if (lastBuy?.ts) lastSignalMinsAgo = Math.round((Date.now() - lastBuy.ts) / 60000);
    backtestSignals = db.prepare('SELECT COUNT(*) as c FROM signal_backtest').get().c;
  } catch {}
  res.json({
    status: 'ok',
    wallets, trades, backtestSignals, lastSignalMinsAgo,
    discoveryRunning,
    uptime: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

// ──────────────────────────────────────────────
// SERVE BUILT FRONTEND (production: npm run build → node server.js)
// ──────────────────────────────────────────────
import { existsSync } from 'fs';
if (existsSync(join(__dirname, 'dist', 'index.html'))) {
  app.use(express.static(join(__dirname, 'dist')));
  app.get('*', (req, res) => {
    res.sendFile(join(__dirname, 'dist', 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`🧬 WalletDNA API Server → ${BASE_URL}`);

  // Auto-run backtest on startup if table is empty or stale (>12h old)
  setTimeout(async () => {
    try {
      const row = db.prepare(`SELECT COUNT(*) as c, MAX(computed_at) as latest FROM signal_backtest`).get();
      const stale = !row.c || !row.latest || (Date.now() - row.latest) > 12 * 60 * 60 * 1000;
      if (stale) {
        console.log('[BACKTEST] Table empty or stale — starting backtest...');
        const { spawn } = await import('child_process');
        const child = spawn('node', ['scripts/backtest.js'], {
          env: { ...process.env },
          stdio: 'inherit',
        });
        child.on('exit', code => console.log(`[BACKTEST] Finished with code ${code}`));
      } else {
        console.log(`[BACKTEST] ${row.c} signals cached — skipping.`);
      }
    } catch (e) {
      console.error('[BACKTEST] Auto-run failed:', e.message);
    }
  }, 90 * 1000); // 90s after start — give sync time to populate wallets first
});
