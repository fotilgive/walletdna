/**
 * ══════════════════════════════════════════════════════════
 * AI ALPHA TERMINAL — SQLite Database Layer
 * ══════════════════════════════════════════════════════════
 * ESM module — matches server.js "type": "module"
 * ══════════════════════════════════════════════════════════
 */

import BetterSqlite3 from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = process.env.DATABASE_PATH || join(__dirname, 'alpha_engine.db');
const db = new BetterSqlite3(dbPath, { verbose: null });
console.log(`[DB] Using database at: ${dbPath}`);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ──────────────────────────────────────────────
// SCHEMA INITIALIZATION
// ──────────────────────────────────────────────
function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS tracked_wallets (
      address      TEXT PRIMARY KEY,
      label        TEXT,
      first_seen   INTEGER,
      last_updated INTEGER
    );

    CREATE TABLE IF NOT EXISTS wallet_metrics (
      address              TEXT PRIMARY KEY,
      win_rate             REAL DEFAULT 0,
      roi_30d              REAL DEFAULT 0,
      total_pnl            REAL DEFAULT 0,
      total_capital        REAL DEFAULT 0,
      closed_positions     INTEGER DEFAULT 0,
      profitable_positions INTEGER DEFAULT 0,
      consistency_score    REAL DEFAULT 0,
      drawdown_penalty     REAL DEFAULT 0,
      growth_trend         REAL DEFAULT 0,
      visibility_penalty   REAL DEFAULT 0,
      activity_score       REAL DEFAULT 0,
      alpha_score          INTEGER DEFAULT 0,
      hidden_gem_score     INTEGER DEFAULT 0,
      alpha_breakdown      TEXT DEFAULT '{}',
      hidden_gem_breakdown TEXT DEFAULT '{}',
      last_calc_at         INTEGER DEFAULT 0,
      data_quality         TEXT DEFAULT 'UNKNOWN',
      unrealized_pnl       REAL DEFAULT 0,
      open_positions       INTEGER DEFAULT 0,
      total_unrealized_roi REAL DEFAULT 0,
      FOREIGN KEY(address) REFERENCES tracked_wallets(address) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS wallet_trades (
      id                 INTEGER PRIMARY KEY AUTOINCREMENT,
      address            TEXT NOT NULL,
      token_address      TEXT NOT NULL,
      token_symbol       TEXT DEFAULT 'UNKNOWN',
      token_name         TEXT DEFAULT 'Unknown Token',
      type               TEXT NOT NULL,
      token_amount       REAL NOT NULL,
      usd_value          REAL NOT NULL DEFAULT 0,
      eth_value          REAL NOT NULL DEFAULT 0,
      timestamp          INTEGER NOT NULL,
      tx_hash            TEXT NOT NULL,
      confidence         TEXT DEFAULT 'LOW',
      confidence_reason  TEXT DEFAULT '',
      raw_transfer_count INTEGER DEFAULT 1,
      UNIQUE(address, tx_hash, token_address, type),
      FOREIGN KEY(address) REFERENCES tracked_wallets(address) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS wallet_positions (
      id                 INTEGER PRIMARY KEY AUTOINCREMENT,
      address            TEXT NOT NULL,
      token_address      TEXT NOT NULL,
      token_symbol       TEXT DEFAULT 'UNKNOWN',
      token_name         TEXT DEFAULT 'Unknown Token',
      -- Aggregated position state (FIFO-derived)
      total_bought_amt   REAL DEFAULT 0,
      total_bought_usd   REAL DEFAULT 0,
      total_sold_amt     REAL DEFAULT 0,
      total_sold_usd     REAL DEFAULT 0,
      realized_pnl_usd   REAL DEFAULT 0,
      avg_cost_usd       REAL DEFAULT 0,
      remaining_amt      REAL DEFAULT 0,
      status             TEXT DEFAULT 'OPEN',
      -- Live price data (updated from DexScreener)
      current_price_usd  REAL,
      unrealized_pnl_usd REAL,
      unrealized_roi_pct REAL,
      price_updated_at   INTEGER DEFAULT 0,
      last_updated       INTEGER,
      UNIQUE(address, token_address),
      FOREIGN KEY(address) REFERENCES tracked_wallets(address) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS sync_log (
      id                  INTEGER PRIMARY KEY AUTOINCREMENT,
      address             TEXT NOT NULL,
      synced_at           INTEGER NOT NULL,
      trades_found        INTEGER DEFAULT 0,
      transfers_fetched   INTEGER DEFAULT 0,
      pages_fetched       INTEGER DEFAULT 0,
      full_history        INTEGER DEFAULT 0,
      status              TEXT DEFAULT 'OK'
    );

    CREATE INDEX IF NOT EXISTS idx_trades_address     ON wallet_trades(address);
    CREATE INDEX IF NOT EXISTS idx_trades_token       ON wallet_trades(token_address);
    CREATE INDEX IF NOT EXISTS idx_trades_timestamp   ON wallet_trades(timestamp);
    CREATE INDEX IF NOT EXISTS idx_trades_type        ON wallet_trades(type);
    -- Composite for cluster/exit/stats queries that filter by type+timestamp and group by token.
    CREATE INDEX IF NOT EXISTS idx_trades_type_ts_tok ON wallet_trades(type, timestamp, token_address);
    -- Composite for per-token participant aggregation.
    CREATE INDEX IF NOT EXISTS idx_trades_tok_type_ts ON wallet_trades(token_address, type, timestamp);
    CREATE INDEX IF NOT EXISTS idx_positions_address  ON wallet_positions(address);
    CREATE INDEX IF NOT EXISTS idx_positions_status   ON wallet_positions(status);
    -- Quality-bar joins on wallet_metrics.
    CREATE INDEX IF NOT EXISTS idx_metrics_quality_alpha
      ON wallet_metrics(data_quality, alpha_score);
  `);

  runMigrations();
}

function runMigrations() {
  const migrations = [
    // wallet_trades columns
    `ALTER TABLE wallet_trades ADD COLUMN confidence TEXT DEFAULT 'LOW'`,
    `ALTER TABLE wallet_trades ADD COLUMN confidence_reason TEXT DEFAULT ''`,
    `ALTER TABLE wallet_trades ADD COLUMN raw_transfer_count INTEGER DEFAULT 1`,
    `ALTER TABLE wallet_trades ADD COLUMN token_symbol TEXT DEFAULT 'UNKNOWN'`,
    `ALTER TABLE wallet_trades ADD COLUMN token_name TEXT DEFAULT 'Unknown Token'`,
    `ALTER TABLE wallet_trades ADD COLUMN eth_value REAL NOT NULL DEFAULT 0`,
    // wallet_metrics columns
    `ALTER TABLE wallet_metrics ADD COLUMN consistency_score REAL DEFAULT 0`,
    `ALTER TABLE wallet_metrics ADD COLUMN drawdown_penalty REAL DEFAULT 0`,
    `ALTER TABLE wallet_metrics ADD COLUMN growth_trend REAL DEFAULT 0`,
    `ALTER TABLE wallet_metrics ADD COLUMN visibility_penalty REAL DEFAULT 0`,
    `ALTER TABLE wallet_metrics ADD COLUMN activity_score REAL DEFAULT 0`,
    `ALTER TABLE wallet_metrics ADD COLUMN alpha_breakdown TEXT DEFAULT '{}'`,
    `ALTER TABLE wallet_metrics ADD COLUMN hidden_gem_breakdown TEXT DEFAULT '{}'`,
    `ALTER TABLE wallet_metrics ADD COLUMN last_calc_at INTEGER DEFAULT 0`,
    `ALTER TABLE wallet_metrics ADD COLUMN data_quality TEXT DEFAULT 'UNKNOWN'`,
    `ALTER TABLE wallet_metrics ADD COLUMN total_capital REAL DEFAULT 0`,
    `ALTER TABLE wallet_metrics ADD COLUMN closed_positions INTEGER DEFAULT 0`,
    `ALTER TABLE wallet_metrics ADD COLUMN profitable_positions INTEGER DEFAULT 0`,
    `ALTER TABLE wallet_metrics ADD COLUMN unrealized_pnl REAL DEFAULT 0`,
    `ALTER TABLE wallet_metrics ADD COLUMN open_positions INTEGER DEFAULT 0`,
    `ALTER TABLE wallet_metrics ADD COLUMN total_unrealized_roi REAL DEFAULT 0`,
    // sync_log columns
    `ALTER TABLE sync_log ADD COLUMN transfers_fetched INTEGER DEFAULT 0`,
    `ALTER TABLE sync_log ADD COLUMN pages_fetched INTEGER DEFAULT 0`,
    `ALTER TABLE sync_log ADD COLUMN full_history INTEGER DEFAULT 0`,
    // GAP-007: historical ETH price audit trail
    `ALTER TABLE wallet_trades ADD COLUMN eth_price_usd REAL DEFAULT 0`,
    // eth_price_history — persistent cache (created by historicalPrice.js on first use)
    `CREATE TABLE IF NOT EXISTS eth_price_history (
      date TEXT PRIMARY KEY, price_usd REAL NOT NULL,
      source TEXT DEFAULT 'coinbase_candles', fetched_at INTEGER
    )`,
    // WalletDNA Discovery Pipeline — candidate wallets found via DexScreener scanning
    `CREATE TABLE IF NOT EXISTS wallet_candidates (
      address TEXT PRIMARY KEY,
      discovered_at INTEGER,
      source_token TEXT,
      candidate_source TEXT DEFAULT 'unknown',
      candidate_reason TEXT DEFAULT '',
      first_tx_at INTEGER DEFAULT 0,
      total_transfers INTEGER DEFAULT 0,
      capital_traded REAL DEFAULT 0,
      total_trades INTEGER DEFAULT 0,
      roi REAL DEFAULT 0,
      win_rate REAL DEFAULT 0,
      alpha_score REAL DEFAULT 0,
      status TEXT DEFAULT 'pending',
      last_evaluated INTEGER DEFAULT 0
    )`,
    `ALTER TABLE wallet_candidates ADD COLUMN candidate_source TEXT DEFAULT 'unknown'`,
    `ALTER TABLE wallet_candidates ADD COLUMN candidate_reason TEXT DEFAULT ''`,
    `ALTER TABLE wallet_candidates ADD COLUMN first_tx_at INTEGER DEFAULT 0`,
    `ALTER TABLE wallet_candidates ADD COLUMN total_transfers INTEGER DEFAULT 0`,
    `ALTER TABLE wallet_candidates ADD COLUMN capital_traded REAL DEFAULT 0`,
    // WalletDNA Discovery History — tracks each pipeline run result
    `CREATE TABLE IF NOT EXISTS discovery_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ran_at INTEGER NOT NULL,
      tokens_scanned INTEGER DEFAULT 0,
      candidates_found INTEGER DEFAULT 0,
      candidates_approved INTEGER DEFAULT 0,
      candidates_promoted INTEGER DEFAULT 0,
      candidates_archived INTEGER DEFAULT 0,
      duration_ms INTEGER DEFAULT 0
    )`,
    // Quality adjustments
    `ALTER TABLE wallet_metrics ADD COLUMN archetype TEXT`,
    `ALTER TABLE wallet_metrics ADD COLUMN days_active INTEGER`,
    // User accounts for authentication
    `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      is_admin INTEGER DEFAULT 0,
      is_premium INTEGER DEFAULT 0,
      gumroad_license TEXT,
      license_activated_at INTEGER,
      onboarding_completed INTEGER DEFAULT 0
    )`,
    `CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token TEXT UNIQUE NOT NULL,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )`,
    `CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token)`,
    `CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id)`,
    // Google OAuth
    `ALTER TABLE users ADD COLUMN google_id TEXT`,
    `ALTER TABLE users ADD COLUMN avatar_url TEXT`,
    `ALTER TABLE users ADD COLUMN name TEXT`,
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id)`,
    // Allow null password_hash for Google-only accounts
    `CREATE TABLE IF NOT EXISTS users_v2_done (id INTEGER PRIMARY KEY)`,
    // Backtest run tracking — persists last_run_timestamp across container restarts
    `CREATE TABLE IF NOT EXISTS backtest_metadata (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )`,
  ];
  for (const cmd of migrations) {
    try { db.exec(cmd); } catch (_) {}
  }
}

initDb();

// ──────────────────────────────────────────────
// OPERATIONS
// ──────────────────────────────────────────────

export function upsertWallet(address, label) {
  db.prepare(`
    INSERT INTO tracked_wallets (address, label, first_seen, last_updated)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(address) DO UPDATE SET label = excluded.label, last_updated = excluded.last_updated
  `).run(address.toLowerCase(), label, Date.now(), Date.now());

  db.prepare(`INSERT OR IGNORE INTO wallet_metrics (address) VALUES (?)`).run(address.toLowerCase());
}

export function insertTrade(trade) {
  try {
    db.prepare(`
      INSERT INTO wallet_trades
        (address, token_address, token_symbol, token_name, type, token_amount,
         usd_value, eth_value, eth_price_usd,
         timestamp, tx_hash, confidence, confidence_reason, raw_transfer_count)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(address, tx_hash, token_address, type) DO NOTHING
    `).run(
      trade.address.toLowerCase(),
      trade.token_address.toLowerCase(),
      trade.token_symbol || 'UNKNOWN',
      trade.token_name   || 'Unknown Token',
      trade.type,
      trade.token_amount,
      trade.usd_value,
      trade.eth_value    || 0,
      trade.eth_price_usd || 0,
      trade.timestamp,
      trade.tx_hash,
      trade.confidence        || 'LOW',
      trade.confidence_reason || '',
      trade.raw_transfer_count || 1,
    );
  } catch (e) {
    if (!e.message.includes('UNIQUE')) console.error('[DB] insertTrade:', e.message);
  }
}

export function upsertPosition(pos) {
  db.prepare(`
    INSERT INTO wallet_positions
      (address, token_address, token_symbol, token_name,
       total_bought_amt, total_bought_usd, total_sold_amt, total_sold_usd,
       realized_pnl_usd, avg_cost_usd, remaining_amt, status,
       current_price_usd, unrealized_pnl_usd, unrealized_roi_pct,
       price_updated_at, last_updated)
    VALUES (?,?,?,?, ?,?,?,?, ?,?,?,?, ?,?,?, ?,?)
    ON CONFLICT(address, token_address) DO UPDATE SET
      token_symbol       = excluded.token_symbol,
      token_name         = excluded.token_name,
      total_bought_amt   = excluded.total_bought_amt,
      total_bought_usd   = excluded.total_bought_usd,
      total_sold_amt     = excluded.total_sold_amt,
      total_sold_usd     = excluded.total_sold_usd,
      realized_pnl_usd   = excluded.realized_pnl_usd,
      avg_cost_usd       = excluded.avg_cost_usd,
      remaining_amt      = excluded.remaining_amt,
      status             = excluded.status,
      current_price_usd  = excluded.current_price_usd,
      unrealized_pnl_usd = excluded.unrealized_pnl_usd,
      unrealized_roi_pct = excluded.unrealized_roi_pct,
      price_updated_at   = excluded.price_updated_at,
      last_updated       = excluded.last_updated
  `).run(
    pos.address.toLowerCase(), pos.token_address.toLowerCase(),
    pos.token_symbol || 'UNKNOWN', pos.token_name || 'Unknown Token',
    pos.total_bought_amt || 0, pos.total_bought_usd || 0,
    pos.total_sold_amt || 0, pos.total_sold_usd || 0,
    pos.realized_pnl_usd || 0, pos.avg_cost_usd || 0,
    pos.remaining_amt || 0, pos.status || 'OPEN',
    pos.current_price_usd ?? null, pos.unrealized_pnl_usd ?? null,
    pos.unrealized_roi_pct ?? null, pos.price_updated_at || 0,
    Date.now(),
  );
}

export function getWalletPositions(address) {
  return db.prepare(`
    SELECT * FROM wallet_positions WHERE address = ? ORDER BY total_bought_usd DESC
  `).all(address.toLowerCase());
}

export function getOpenPositions() {
  return db.prepare(`
    SELECT * FROM wallet_positions WHERE status = 'OPEN' AND remaining_amt > 0
    ORDER BY total_bought_usd DESC
  `).all();
}

export function getWalletTrades(address, limit = 10000) {
  return db.prepare(`SELECT * FROM wallet_trades WHERE address = ? ORDER BY timestamp ASC LIMIT ?`)
    .all(address.toLowerCase(), limit);
}

export function getRecentBuysByToken(sinceMs) {
  return db.prepare(`
    SELECT token_address, token_symbol, token_name,
           COUNT(DISTINCT address) AS wallet_count,
           SUM(usd_value) AS total_inflow,
           MIN(timestamp) AS first_seen,
           MAX(timestamp) AS last_seen
    FROM wallet_trades
    WHERE type = 'BUY' AND timestamp > ?
    GROUP BY token_address
    HAVING wallet_count >= 2
    ORDER BY wallet_count DESC, total_inflow DESC
    LIMIT 20
  `).all(sinceMs);
}

export function updateWalletMetrics(address, m) {
  db.prepare(`
    UPDATE wallet_metrics SET
      win_rate=?, roi_30d=?, total_pnl=?, total_capital=?,
      closed_positions=?, profitable_positions=?,
      consistency_score=?, drawdown_penalty=?, growth_trend=?,
      visibility_penalty=?, activity_score=?,
      alpha_score=?, hidden_gem_score=?,
      alpha_breakdown=?, hidden_gem_breakdown=?,
      last_calc_at=?, data_quality=?,
      unrealized_pnl=?, open_positions=?, total_unrealized_roi=?,
      archetype=?, days_active=?
    WHERE address=?
  `).run(
    m.win_rate ?? 0, m.roi_30d ?? 0, m.total_pnl ?? 0, m.total_capital ?? 0,
    m.closed_positions ?? 0, m.profitable_positions ?? 0,
    m.consistency_score ?? 0, m.drawdown_penalty ?? 0, m.growth_trend ?? 0,
    m.visibility_penalty ?? 0, m.activity_score ?? 0,
    m.alpha_score ?? 0, m.hidden_gem_score ?? 0,
    JSON.stringify(m.alpha_breakdown || {}),
    JSON.stringify(m.hidden_gem_breakdown || {}),
    Date.now(), m.data_quality || 'LOW',
    m.unrealized_pnl ?? 0, m.open_positions ?? 0, m.total_unrealized_roi ?? 0,
    m.archetype ? JSON.stringify(m.archetype) : '{}',
    m.days_active ?? 1,
    address.toLowerCase(),
  );
}

export function updateWalletFirstSeen(address, firstSeen) {
  if (!firstSeen || Number.isNaN(firstSeen)) return;

  db.prepare(`
    UPDATE tracked_wallets
    SET first_seen = CASE
      WHEN first_seen IS NULL OR first_seen > ? THEN ?
      ELSE first_seen
    END,
        last_updated = ?
    WHERE address = ?
  `).run(firstSeen, firstSeen, Date.now(), address.toLowerCase());
}

export function restoreTrackedUniverseFromSyncLog() {
  // Disaster recovery only: bring back wallets that still have real trade history.
  // Without the trades-exist guard this resurrects every wallet ever purged.
  const rows = db.prepare(`
    SELECT s.address, MIN(s.synced_at) AS first_seen, MAX(s.synced_at) AS last_seen
    FROM sync_log s
    WHERE EXISTS (SELECT 1 FROM wallet_trades t WHERE t.address = s.address)
    GROUP BY s.address
  `).all();

  const tx = db.transaction((items) => {
    for (const row of items) {
      const addr = String(row.address || '').toLowerCase();
      if (!addr) continue;

      db.prepare(`
        INSERT OR IGNORE INTO tracked_wallets (address, label, first_seen, last_updated)
        VALUES (?, ?, ?, ?)
      `).run(addr, `Recovered-${addr.slice(2, 6).toUpperCase()}`, row.first_seen || Date.now(), row.last_seen || Date.now());

      db.prepare(`INSERT OR IGNORE INTO wallet_metrics (address) VALUES (?)`).run(addr);
    }
  });

  tx(rows);
  return { restored: rows.length, addresses: rows.map(r => String(r.address || '').toLowerCase()) };
}

export function getTrackedWallets() {
  return db.prepare(`
    SELECT w.address, w.label, w.first_seen, w.last_updated,
           m.win_rate, m.roi_30d, m.total_pnl, m.total_capital,
           m.closed_positions, m.profitable_positions,
           m.consistency_score, m.drawdown_penalty, m.growth_trend, m.visibility_penalty,
           m.activity_score, m.alpha_score, m.hidden_gem_score,
           m.alpha_breakdown, m.hidden_gem_breakdown,
           m.last_calc_at, m.data_quality,
           m.unrealized_pnl, m.open_positions, m.total_unrealized_roi,
           m.archetype, m.days_active
    FROM tracked_wallets w
    LEFT JOIN wallet_metrics m ON w.address = m.address
    ORDER BY m.alpha_score DESC
  `).all();
}

export function getWalletById(address) {
  return db.prepare(`
    SELECT w.address, w.label, w.first_seen, w.last_updated, m.*
    FROM tracked_wallets w
    LEFT JOIN wallet_metrics m ON w.address = m.address
    WHERE w.address = ?
  `).get(address.toLowerCase());
}

export function logSync(address, tradesFound, status = 'OK', extra = {}) {
  db.prepare(`
    INSERT INTO sync_log (address, synced_at, trades_found, transfers_fetched, pages_fetched, full_history, status)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    address.toLowerCase(), Date.now(), tradesFound,
    extra.transfersFetched || 0, extra.pagesFetched || 0,
    extra.fullHistory ? 1 : 0, status,
  );
}

export function getLastSyncTime(address) {
  const row = db.prepare(`SELECT MAX(synced_at) AS last_sync FROM sync_log WHERE address = ?`)
    .get(address.toLowerCase());
  return row?.last_sync || 0;
}

// ──────────────────────────────────────────────
// USER ACCOUNT OPERATIONS
// ──────────────────────────────────────────────
export function createUser(email, passwordHash, isAdmin = false) {
  const stmt = db.prepare(`
    INSERT INTO users (email, password_hash, created_at, is_admin)
    VALUES (?, ?, ?, ?)
  `);
  try {
    const result = stmt.run(email.toLowerCase(), passwordHash, Date.now(), isAdmin ? 1 : 0);
    return { success: true, userId: result.lastInsertRowid };
  } catch (e) {
    if (e.message.includes('UNIQUE')) {
      return { success: false, error: 'Email already exists' };
    }
    return { success: false, error: e.message };
  }
}

export function getUserByEmail(email) {
  return db.prepare(`SELECT * FROM users WHERE email = ?`).get(email.toLowerCase());
}

export function getUserById(id) {
  return db.prepare(`SELECT * FROM users WHERE id = ?`).get(id);
}

export function createSession(userId, token, expiresAt) {
  const stmt = db.prepare(`
    INSERT INTO sessions (user_id, token, created_at, expires_at)
    VALUES (?, ?, ?, ?)
  `);
  try {
    const result = stmt.run(userId, token, Date.now(), expiresAt);
    return { success: true, sessionId: result.lastInsertRowid };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

export function getSessionByToken(token) {
  const stmt = db.prepare(`
    SELECT s.*, u.email, u.is_admin, u.is_premium, u.gumroad_license, u.onboarding_completed
    FROM sessions s
    JOIN users u ON s.user_id = u.id
    WHERE s.token = ? AND s.expires_at > ?
  `);
  return stmt.get(token, Date.now());
}

export function deleteSession(token) {
  db.prepare(`DELETE FROM sessions WHERE token = ?`).run(token);
}

export function deleteExpiredSessions() {
  db.prepare(`DELETE FROM sessions WHERE expires_at < ?`).run(Date.now());
}

export function activateLicense(userId, licenseKey) {
  const stmt = db.prepare(`
    UPDATE users SET is_premium = 1, gumroad_license = ?, license_activated_at = ?
    WHERE id = ?
  `);
  stmt.run(licenseKey, Date.now(), userId);
}

export function completeOnboarding(userId) {
  db.prepare(`UPDATE users SET onboarding_completed = 1 WHERE id = ?`).run(userId);
}

export function upsertGoogleUser({ googleId, email, name, avatarUrl }) {
  const existing = db.prepare(`SELECT * FROM users WHERE google_id = ? OR email = ?`).get(googleId, email.toLowerCase());
  if (existing) {
    db.prepare(`UPDATE users SET google_id = ?, avatar_url = ?, name = ? WHERE id = ?`)
      .run(googleId, avatarUrl, name, existing.id);
    return { userId: existing.id, isNew: false };
  }
  const result = db.prepare(`
    INSERT INTO users (email, password_hash, created_at, google_id, avatar_url, name)
    VALUES (?, '', ?, ?, ?, ?)
  `).run(email.toLowerCase(), Date.now(), googleId, avatarUrl, name);
  return { userId: result.lastInsertRowid, isNew: true };
}

export function getUserByGoogleId(googleId) {
  return db.prepare(`SELECT * FROM users WHERE google_id = ?`).get(googleId);
}

export { db };
