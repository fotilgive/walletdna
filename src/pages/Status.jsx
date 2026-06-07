import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { fmtNum, fmtAddr, fmtTime } from '../utils/format'

const API = import.meta.env.VITE_API_URL || ''

function ago(mins) {
  if (mins == null) return '—'
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  if (mins < 1440) return `${Math.floor(mins / 60)}h ago`
  return `${Math.floor(mins / 1440)}d ago`
}

function uptime(secs) {
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  return `${h}h ${m}m`
}

export default function Status() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshedAt, setRefreshedAt] = useState(null)

  async function load() {
    setLoading(true)
    try {
      const r = await fetch(`${API}/api/status`)
      const d = await r.json()
      setData(d)
      setRefreshedAt(new Date())
    } catch (e) {
      setData({ error: e.message })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div className="eyebrow">SYSTEM</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <h1 style={{ fontSize: 'clamp(1.4rem, 2.5vw, 1.9rem)', fontWeight: 900, letterSpacing: '-0.03em' }}>
            Platform Status
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {refreshedAt && (
              <span style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>
                Updated {fmtTime(refreshedAt.toISOString())}
              </span>
            )}
            <button className="btn btn-ghost" onClick={load} disabled={loading} style={{ fontSize: '0.82rem' }}>
              {loading ? '⟳ Loading…' : '↻ Refresh'}
            </button>
          </div>
        </div>
      </div>

      {loading && !data && (
        <div className="loading-block">
          <div className="spinner" style={{ width: 28, height: 28 }} />
          Checking systems…
        </div>
      )}

      {data?.error && (
        <div style={{ color: 'var(--red)', padding: '20px', background: 'var(--red-dim)', borderRadius: 8 }}>
          ⚠️ Failed to load status: {data.error}
        </div>
      )}

      {data && !data.error && (
        <>
          {/* External API health */}
          <div className="card card-p" style={{ marginBottom: 20 }}>
            <div className="section-title">External APIs</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {data.services?.map(s => (
                <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
                    background: s.ok ? 'var(--green)' : 'var(--red)',
                    boxShadow: `0 0 6px ${s.ok ? 'var(--green)' : 'var(--red)'}60`,
                  }} />
                  <div style={{ flex: 1, fontWeight: 600, fontSize: '0.88rem' }}>{s.name}</div>
                  <div style={{ fontSize: '0.78rem', color: s.ok ? 'var(--green)' : 'var(--red)', fontFamily: 'var(--mono)' }}>
                    {s.ok ? 'ONLINE' : 'OFFLINE'}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-3)', fontFamily: 'var(--mono)', minWidth: 60, textAlign: 'right' }}>
                    {s.latencyMs}ms
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Core metrics */}
          <div className="stats-grid" style={{ marginBottom: 20 }}>
            {[
              { label: 'Wallets Tracked',  value: fmtNum(data.walletsTracked),  color: 'var(--cyan)',   hint: 'Total wallets in DB' },
              { label: 'Total Trades',     value: fmtNum(data.totalTrades),     color: 'var(--purple)', hint: 'ERC-20 trades indexed' },
              { label: 'Signals 24h',      value: data.signals24h,              color: 'var(--green)',  hint: 'Unique tokens bought today' },
              { label: 'Backtest Signals', value: data.backtestCount,           color: 'var(--amber)',  hint: 'Signals with OHLCV data' },
              { label: 'Last Signal',      value: ago(data.lastSignalMinsAgo),  color: data.lastSignalMinsAgo < 60 ? 'var(--green)' : 'var(--amber)', hint: 'Time since last buy signal' },
              { label: 'Last Sync',        value: ago(data.lastSyncAgo),        color: data.lastSyncAgo < 120 ? 'var(--green)' : 'var(--amber)', hint: 'Last successful wallet sync' },
              { label: 'Wallets w/ Metrics', value: data.walletsWithMetrics,   color: 'var(--cyan)',   hint: 'Wallets with real alpha score' },
              { label: 'DB Size',          value: data.dbSizeKB ? `${fmtNum(data.dbSizeKB)} KB` : '—', color: 'var(--text-2)', hint: 'SQLite database file size' },
              { label: 'Server Uptime',    value: uptime(data.uptime),          color: 'var(--text-2)', hint: 'Time since last restart' },
            ].map(s => (
              <div key={s.label} className="stat-block" title={s.hint}>
                <div className="stat-block-label">{s.label}</div>
                <div className="stat-block-value" style={{ color: s.color }}>{s.value}</div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-3)', marginTop: 2 }}>{s.hint}</div>
              </div>
            ))}
          </div>

          {/* Top wallet */}
          {data.topWallet && (
            <div className="card card-p" style={{ marginBottom: 20 }}>
              <div className="section-title">Top Wallet by Alpha Score</div>
              <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ fontFamily: 'var(--mono)', fontSize: '0.85rem', color: 'var(--text-2)' }}>
                  {fmtAddr(data.topWallet.address, 8)}
                </div>
                {[
                  { label: 'Alpha Score', value: data.topWallet.alphaScore, color: 'var(--cyan)' },
                  { label: 'Win Rate', value: `${data.topWallet.winRate}%`, color: 'var(--green)' },
                  { label: 'ROI 30d', value: `+${data.topWallet.roi30d}%`, color: 'var(--green)' },
                ].map(m => (
                  <div key={m.label} style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{m.label}</div>
                    <div style={{ fontWeight: 800, fontFamily: 'var(--mono)', color: m.color }}>{m.value}</div>
                  </div>
                ))}
                <a
                  href={`/profile/${data.topWallet.address}`}
                  style={{ marginLeft: 'auto', fontSize: '0.82rem', color: 'var(--cyan)', textDecoration: 'none' }}
                >
                  View Profile →
                </a>
              </div>
            </div>
          )}

          {/* Recent syncs */}
          {data.recentSyncs?.length > 0 && (
            <div className="card" style={{ marginBottom: 20 }}>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', fontWeight: 700, fontSize: '0.88rem' }}>
                Recent Syncs
              </div>
              {data.recentSyncs.map((s, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '10px 20px',
                  borderBottom: i < data.recentSyncs.length - 1 ? '1px solid var(--border)' : 'none',
                  fontSize: '0.82rem',
                }}>
                  <div style={{
                    width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                    background: s.status === 'OK' ? 'var(--green)' : 'var(--red)',
                  }} />
                  <div style={{ fontFamily: 'var(--mono)', color: 'var(--text-2)', flex: 1 }}>
                    {fmtAddr(s.address, 8)}
                  </div>
                  <div style={{ color: 'var(--cyan)', fontFamily: 'var(--mono)', fontSize: '0.8rem' }}>
                    +{s.tradesFound} trades
                  </div>
                  <div style={{ color: 'var(--text-3)', fontSize: '0.75rem' }}>
                    {ago(s.agoMin)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </motion.div>
  )
}
