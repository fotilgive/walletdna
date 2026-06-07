import React, { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import useStore from '../store/useStore'
import { fmtAddr } from '../utils/format'
import { useT } from '../utils/i18n'

const RANK_STYLES = [
  { label: '🥇 #1', cls: 'gold',   border: 'var(--amber)',  glow: 'rgba(245,158,11,0.15)' },
  { label: '🥈 #2', cls: 'silver', border: 'rgba(148,163,184,0.5)', glow: 'transparent' },
  { label: '🥉 #3', cls: 'bronze', border: 'var(--orange)', glow: 'transparent' },
]

function WalletCard({ w, rank, idx, navigate, t }) {
  const rs = RANK_STYLES[rank] || { label: `#${rank + 1}`, cls: '', border: 'var(--border)', glow: 'transparent' }
  const roi = parseFloat(w.returns30d) || 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: idx * 0.04 }}
      className="wallet-card"
      style={{
        border: `1px solid ${rs.border}`,
        background: rs.glow !== 'transparent' ? `linear-gradient(135deg, ${rs.glow} 0%, var(--bg-card) 50%)` : undefined,
      }}
      onClick={() => navigate(`/profile/${w.address}`)}
    >
      {/* Rank + ROI row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div className={`wallet-card-rank ${rs.cls}`}>{rs.label}</div>
        <div style={{ textAlign: 'right' }}>
          <div className="wallet-card-roi" style={{ color: roi >= 0 ? 'var(--green)' : 'var(--red)' }}>
            {roi >= 0 ? '+' : ''}{roi}%
          </div>
          <div style={{ fontSize: '0.58rem', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>
            {t('lbd_roi')}
          </div>
        </div>
      </div>

      {/* Identity */}
      <div className="wallet-card-addr">{w.label}</div>
      <div className="wallet-card-mono">{fmtAddr(w.address)}</div>

      {/* Stats */}
      <div className="wallet-card-stats">
        <div className="wallet-card-stat">
          <div className="wallet-card-stat-label">{t('lbd_win')}</div>
          <div className="wallet-card-stat-val text-cyan">{w.winRate}%</div>
        </div>
        <div className="wallet-card-stat">
          <div className="wallet-card-stat-label">{t('lbd_trades')}</div>
          <div className="wallet-card-stat-val text-muted">{w.totalTrades}</div>
        </div>
        <div className="wallet-card-stat">
          <div className="wallet-card-stat-label">{t('lbd_score')}</div>
          <div className="wallet-card-stat-val text-purple">{w.score}</div>
        </div>
      </div>

      {/* Best Trade — one-line proof per wallet */}
      {w.bestTrade && (
        <div style={{
          marginTop: 10, padding: '6px 10px',
          borderRadius: 'var(--r-md)',
          background: 'rgba(0,229,148,0.08)',
          border: '1px solid rgba(0,229,148,0.22)',
          display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
          fontSize: '0.72rem', fontWeight: 700,
        }}>
          <span style={{ color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: '0.58rem' }}>
            🏆 Best:
          </span>
          <span style={{ color: 'var(--text-1)' }}>{w.bestTrade.symbol}</span>
          <span style={{ color: 'var(--green)', fontFamily: 'var(--mono)' }}>
            +{w.bestTrade.roiPct}% (×{w.bestTrade.multiple.toFixed(1)})
          </span>
        </div>
      )}
    </motion.div>
  )
}

export default function Leaderboard() {
  const { leaderboard, loadingLB, fetchLeaderboard } = useStore()
  const navigate = useNavigate()
  const t = useT()

  useEffect(() => { fetchLeaderboard() }, [])

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} style={{ paddingBottom: 60 }}>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div className="eyebrow">{t('lbd_eyebrow')}</div>
        <h1 style={{ fontSize: 'clamp(1.6rem, 3vw, 2.2rem)', fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1.1 }}>
          {t('lbd_title')}
        </h1>
        <p style={{ color: 'var(--text-3)', fontSize: '0.82rem', marginTop: 4 }}>
          {t('lbd_sub')}
        </p>
      </div>

      {loadingLB ? (
        <div className="loading-block">
          <div className="spinner" style={{ width: 32, height: 32 }} />
          {t('lbd_loading')}
        </div>
      ) : leaderboard.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🏆</div>
          <div className="empty-state-title">{t('lbd_no_data')}</div>
          <div className="empty-state-sub">{t('lbd_no_data_sub')}</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 36 }}>
          {leaderboard.map((category, catIdx) => (
            <div key={category.id}>
              {/* Category header */}
              <div className="section-head">
                <h2>{category.name}</h2>
                {category.wallets.length > 3 && (
                  <span className="section-head-action" onClick={() => {}}>
                    {t('lbd_view_all')} {category.wallets.length} →
                  </span>
                )}
              </div>

              {/* Wallet grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
                {category.wallets.slice(0, 3).map((w, i) => (
                  <WalletCard key={w.address} w={w} rank={i} idx={catIdx * 3 + i} navigate={navigate} t={t} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  )
}
