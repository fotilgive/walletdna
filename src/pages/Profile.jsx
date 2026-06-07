import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import useStore from '../store/useStore'
import DNARadar, { DNAMetricList } from '../components/DNARadar'
import ScoreRing from '../components/ScoreRing'
import { fmtAddr, fmtTime, fmtNum } from '../utils/format'
import { useT } from '../utils/i18n'


export default function Profile() {
  const { address } = useParams()
  const navigate = useNavigate()
  const t = useT()
  const { fetchProfile, loadingProfile, profileError, profiles, addToWatchlist, watchlist, incrementWallets, isPremium } = useStore()

  const [activeTab, setActiveTab] = useState('overview')
  const data = address ? profiles[address] : null

  useEffect(() => {
    if (address) {
      fetchProfile(address).then(d => { if (d) incrementWallets() })
    }
  }, [address])

  // ── Empty state ─────────────────────────
  if (!address) {
    return (
      <div style={{ maxWidth: 520, margin: '80px auto 0', textAlign: 'center' }}>
        <div style={{ fontSize: '3rem', marginBottom: 16 }}>🔍</div>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: 8 }}>{t('pf_empty_h2')}</h2>
        <p style={{ color: 'var(--text-3)', marginBottom: 24, fontSize: '0.88rem' }}>{t('pf_empty_desc')}</p>
        <WalletSearchBox t={t} />
        <div className="hint-box" style={{ marginTop: 20, textAlign: 'left' }}>
          <span className="hint-icon">💡</span>
          <span>{t('pf_empty_hint')}</span>
        </div>
      </div>
    )
  }

  if (loadingProfile) return (
    <div className="loading-block">
      <div className="spinner" style={{ width: 40, height: 40 }} />
      <div>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>{t('pf_loading')}</div>
        <div style={{ fontSize: '0.82rem', color: 'var(--text-2)', fontFamily: 'var(--mono)' }}>{fmtAddr(address, 10)}</div>
      </div>
    </div>
  )

  if (profileError) return (
    <div style={{ textAlign: 'center', padding: '60px 0' }}>
      <div style={{ color: 'var(--red)', fontSize: '1rem', marginBottom: 16 }}>⚠️ {profileError}</div>
      <button className="btn btn-ghost" onClick={() => navigate('/profile')}>{t('pf_try_another')}</button>
    </div>
  )

  if (!data) return null

  const { archetype, dnaScores, stats, holdings, recentActivity, sybilDetails, overallScore, alphaBreakdown, bestTrade } = data
  const inWatchlist = watchlist.some(w => w.address === address)

  const TABS = [
    { id: 'overview', label: t('pf_tab_overview') },
    { id: 'dna',      label: t('pf_tab_dna') },
    { id: 'holdings', label: `${t('pf_tab_holdings')} (${holdings.length})` },
    { id: 'activity', label: t('pf_tab_activity') },
    { id: 'sybil',    label: t('pf_tab_sybil') },
  ]

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
      {/* ── Header ─── */}
      <div className="flex items-center justify-between mb-6" style={{ flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div className="eyebrow" style={{ marginBottom: 6 }}>{t('pf_eyebrow')}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 900, fontFamily: 'var(--mono)', letterSpacing: '-0.02em' }}>
              {fmtAddr(address, 8)}
            </h1>
            <span className="badge badge-cyan">{archetype.emoji} {archetype.name}</span>
            <span className="badge badge-gray">{t('pf_base')}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6, flexWrap: 'wrap' }}>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-3)', fontFamily: 'var(--mono)' }}>{address}</div>
            <a
              href={`https://basescan.org/address/${address}`}
              target="_blank" rel="noopener noreferrer"
              style={{ fontSize: '0.75rem', color: 'var(--cyan)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 3 }}
            >
              View on Basescan ↗
            </a>
          </div>
          {stats.lastTradeTs && (
            <div style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginTop: 4 }}>
              Last trade: <span style={{ color: 'var(--amber)' }}>{fmtTime(new Date(stats.lastTradeTs).toISOString())}</span>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            className="btn btn-ghost"
            onClick={() => {
              navigator.clipboard.writeText(address)
              toast.success(t('pf_copied'))
            }}
          >
            {t('pf_copy')}
          </button>
          <button
            className={`btn ${inWatchlist ? 'btn-danger' : 'btn-ghost'}`}
            onClick={() => {
              if (inWatchlist) {
                useStore.getState().removeFromWatchlist(address)
                toast.success(t('pf_unfollowed'))
              } else {
                addToWatchlist(address, fmtAddr(address, 8))
                toast.success(t('pf_followed_msg'))
              }
            }}
          >
            {inWatchlist ? t('pf_following') : t('pf_follow')}
          </button>
          <button className="btn btn-ghost" onClick={() => navigate(`/compare?addr1=${address}`)}>
            {t('pf_compare')}
          </button>
        </div>
      </div>

      {/* ── Archetype Banner ─── */}
      <div className="archetype-card mb-6" style={{
        background: `${archetype.color}10`, borderColor: `${archetype.color}30`,
      }}>
        <div className="archetype-emoji">{archetype.emoji}</div>
        <div>
          <div className="archetype-name" style={{ color: archetype.color }}>{archetype.name}</div>
          <div className="archetype-desc">{archetype.desc}</div>
        </div>
        <div style={{ marginLeft: 'auto', textAlign: 'right', flexShrink: 0 }}>
          <ScoreRing score={overallScore} size={100} strokeWidth={7} />
        </div>
      </div>

      {/* ── Best Trade Card — proof in one line ─── */}
      {bestTrade && (
        <div style={{
          marginBottom: 22,
          padding: '18px 22px',
          borderRadius: 'var(--r-lg)',
          background: 'linear-gradient(90deg, rgba(0,229,148,0.10), rgba(0,229,148,0.02))',
          border: '1px solid rgba(0,229,148,0.30)',
          display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap',
          cursor: 'pointer',
        }}
        onClick={() => bestTrade.tokenAddress && navigate(`/token/${bestTrade.tokenAddress}`)}
        >
          <div style={{ fontSize: '0.62rem', color: 'var(--green)', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            🏆 Best Closed Trade
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: '1.6rem', fontWeight: 900, fontFamily: 'var(--mono)', color: 'var(--text-1)', lineHeight: 1 }}>{bestTrade.symbol}</span>
            <span style={{ fontSize: '1.6rem', fontWeight: 900, fontFamily: 'var(--mono)', color: 'var(--green)', lineHeight: 1 }}>
              +{bestTrade.roiPct}%
            </span>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-3)', fontWeight: 700, fontFamily: 'var(--mono)' }}>
              ×{bestTrade.multiple.toFixed(2)}
            </span>
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-2)' }}>
            spent <strong style={{ color: 'var(--text-1)', fontFamily: 'var(--mono)' }}>${bestTrade.spentUSD.toLocaleString()}</strong>
            {' '}→ profit <strong style={{ color: 'var(--green)', fontFamily: 'var(--mono)' }}>${bestTrade.profitUSD.toLocaleString()}</strong>
          </div>
          <div style={{ marginLeft: 'auto', fontSize: '0.72rem', color: 'var(--cyan)', fontWeight: 700 }}>
            View token →
          </div>
        </div>
      )}

      {/* ── Tabs ─── */}
      <div className="tab-group" style={{ marginBottom: 24, alignSelf: 'flex-start' }}>
        {TABS.map(tab => (
          <button key={tab.id}
            className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >{tab.label}</button>
        ))}
      </div>

      {/* ── Overview ─── */}
      {activeTab === 'overview' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          {/* Key performance metrics — most important first */}
          <div className="stats-grid mb-6">
            {[
              {
                label: 'Win Rate',
                value: stats.winRate != null ? `${stats.winRate}%` : '—',
                color: parseFloat(stats.winRate) >= 50 ? 'var(--green)' : parseFloat(stats.winRate) >= 35 ? 'var(--amber)' : 'var(--red)',
                hint: 'Trades that closed in profit',
              },
              {
                label: 'ROI 30d',
                value: stats.roi30d != null ? `${parseFloat(stats.roi30d) >= 0 ? '+' : ''}${stats.roi30d}%` : '—',
                color: parseFloat(stats.roi30d) >= 0 ? 'var(--green)' : 'var(--red)',
                hint: 'Return on invested capital',
              },
              {
                label: 'Closed Trades',
                value: stats.closedTrades ?? stats.uniqueContracts ?? '—',
                color: 'var(--cyan)',
                hint: 'Completed buy→sell cycles',
              },
              { label: t('pf_stat_txns'), value: stats.totalTxns?.toLocaleString(), color: 'var(--purple)', hint: 'Total on-chain transactions' },
              { label: t('pf_stat_days'), value: stats.daysActive, color: 'var(--amber)', hint: 'Days since first transaction' },
              {
                label: t('pf_stat_fail'),
                value: `${stats.failRate}%`,
                color: parseFloat(stats.failRate) > 5 ? 'var(--red)' : 'var(--green)',
                hint: 'Reverted transaction rate',
              },
            ].map(s => (
              <div key={s.label} className="stat-block" title={s.hint}>
                <div className="stat-block-label">{s.label}</div>
                <div className="stat-block-value" style={{ color: s.color }}>{s.value}</div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-3)', marginTop: 2 }}>{s.hint}</div>
              </div>
            ))}
          </div>

          {/* Score explanation */}
          <ScoreExplainer
            score={overallScore}
            winRate={parseFloat(stats.winRate)}
            roi={parseFloat(stats.roi30d)}
            closedTrades={stats.closedTrades ?? stats.uniqueContracts}
            breakdown={alphaBreakdown}
          />

          <div className="grid-2" style={{ gap: 20, marginTop: 20 }}>
            <div className="card card-p">
              <div className="section-title">{t('pf_dna_radar')}</div>
              <DNARadar scores={dnaScores} />
            </div>
            <div className="card card-p">
              <div className="section-title">{t('pf_metric_breakdown')}</div>
              <DNAMetricList scores={dnaScores} />
            </div>
          </div>
        </motion.div>
      )}

      {/* ── DNA Scores ─── */}
      {activeTab === 'dna' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid-2" style={{ gap: 20 }}>
          <div className="card card-p">
            <div className="section-title">{t('pf_radar_viz')}</div>
            <DNARadar scores={dnaScores} />
          </div>
          <div className="card card-p">
            <div className="section-title">{t('pf_detailed_scores')}</div>
            <DNAMetricList scores={dnaScores} />
            <div className="divider" />
            <div style={{ fontSize: '0.8rem', color: 'var(--text-3)', lineHeight: 1.7 }}>
              <strong style={{ color: 'var(--text-2)' }}>{t('pf_scores_how')}</strong><br />
              {t('pf_scores_desc')}
            </div>
          </div>
        </motion.div>
      )}

      {/* ── Holdings ─── */}
      {activeTab === 'holdings' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="card">
            {holdings.length === 0 ? (
              <div className="loading-block"><p>{t('pf_no_holdings')}</p></div>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>{t('pf_th_token')}</th>
                    <th>{t('pf_th_balance')}</th>
                    <th className="text-right">{t('pf_th_usd')}</th>
                  </tr>
                </thead>
                <tbody>
                  {holdings.map((h, i) => (
                    <tr key={i}>
                      <td>
                        <div style={{ fontWeight: 700 }}>{h.symbol}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>{h.name}</div>
                      </td>
                      <td className="text-mono" style={{ color: 'var(--text-2)' }}>
                        {fmtNum(h.balance)}
                      </td>
                      <td className="text-right text-mono" style={{ color: 'var(--cyan)', fontWeight: 700 }}>
                        {h.usdValue > 0 ? `$${fmtNum(h.usdValue)}` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </motion.div>
      )}

      {/* ── Activity ─── */}
      {activeTab === 'activity' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="card">
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 700 }}>{t('pf_recent_txns')}</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-3)' }}>{t('pf_last10')}</div>
            </div>
            {recentActivity.length === 0 ? (
              <div className="loading-block"><p>{t('pf_no_activity')}</p></div>
            ) : recentActivity.map((tx, i) => (
              <div key={i} className="activity-row">
                <div className={`activity-status ${tx.status === 'ok' ? 'ok' : 'err'}`} />
                <span className={`activity-badge ${tx.type}`}>{tx.type}</span>
                <span className="activity-method">{tx.method}</span>
                <span className="activity-value text-mono">
                  {tx.value > 0 ? `${tx.value.toFixed(4)} ETH` : '—'}
                </span>
                <span className="activity-time">{fmtTime(tx.timestamp)}</span>
                {tx.hash && (
                  <a href={`https://basescan.org/tx/${tx.hash}`} target="_blank" rel="noopener noreferrer"
                    style={{ color: 'var(--text-3)', fontSize: '0.78rem' }}>↗</a>
                )}
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* ── Sybil ─── */}
      {activeTab === 'sybil' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          {!isPremium ? (
            <div className="card card-p-lg text-center" style={{ padding: '60px 40px', background: 'rgba(13, 16, 34, 0.65)' }}>
              <div style={{ fontSize: '3rem', marginBottom: 16 }}>🔒</div>
              <h3 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: 8 }}>{t('pf_sybil_locked')}</h3>
              <p style={{ color: 'var(--text-2)', maxWidth: 460, margin: '0 auto 24px', fontSize: '0.88rem', lineHeight: 1.6 }}>
                {t('pf_sybil_locked_desc')}
              </p>
              <button className="btn btn-primary" onClick={() => navigate('/pricing')}>{t('pf_upgrade')}</button>
            </div>
          ) : (
            <div className="grid-2" style={{ gap: 20 }}>
              <div className="card card-p">
                <div className="section-title">{t('pf_sybil_score')}</div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '20px 0' }}>
                  <ScoreRing score={100 - sybilDetails.riskScore} size={140} strokeWidth={8} />
                  <div style={{
                    padding: '6px 20px', borderRadius: 100, fontWeight: 800,
                    fontSize: '0.9rem', fontFamily: 'var(--mono)',
                    background: sybilDetails.verdict === 'CLEAN' ? 'var(--green-dim)' : sybilDetails.verdict === 'SUSPICIOUS' ? 'var(--amber-dim)' : 'var(--red-dim)',
                    color: sybilDetails.verdict === 'CLEAN' ? 'var(--green)' : sybilDetails.verdict === 'SUSPICIOUS' ? 'var(--amber)' : 'var(--red)',
                    border: `1px solid ${sybilDetails.verdict === 'CLEAN' ? 'rgba(0,255,148,0.2)' : sybilDetails.verdict === 'SUSPICIOUS' ? 'rgba(255,184,0,0.2)' : 'rgba(255,59,107,0.2)'}`,
                  }}>
                    {sybilDetails.verdict === 'CLEAN'
                      ? t('pf_clean')
                      : sybilDetails.verdict === 'SUSPICIOUS'
                        ? t('pf_suspicious')
                        : t('pf_high_risk')}
                  </div>
                </div>
              </div>
              <div className="card card-p">
                <div className="section-title">{t('pf_forensic')}</div>
                {sybilDetails.checks.map((c, i) => (
                  <div key={i} className={`sybil-check-row ${c.pass ? 'pass' : 'fail'}`}>
                    <span style={{ fontSize: '1rem', flexShrink: 0 }}>{c.pass ? '✅' : '❌'}</span>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{c.name}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-2)', marginTop: 2 }}>{c.detail}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      )}

    </motion.div>
  )
}

function WalletSearchBox({ t }) {
  const [val, setVal] = useState('')
  const navigate = useNavigate()
  return (
    <div style={{ display: 'flex', gap: 10, maxWidth: 560, margin: '0 auto' }}>
      <input className="input" placeholder="0x..." value={val} onChange={e => setVal(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && navigate(`/profile/${val.trim()}`)} />
      <button className="btn btn-primary" onClick={() => navigate(`/profile/${val.trim()}`)}>
        {t('pf_analyze_btn')}
      </button>
    </div>
  )
}

function ScoreExplainer({ score, winRate, roi, closedTrades, breakdown }) {
  const hasRealBreakdown = breakdown && breakdown.roi_pts != null

  const rows = hasRealBreakdown
    ? [
        {
          label: 'ROI (weight 37)',
          pts: breakdown.roi_pts,
          max: 37,
          formula: breakdown.formulas?.roi || `ROI ${roi >= 0 ? '+' : ''}${roi}%`,
          color: breakdown.roi_pts >= 25 ? 'var(--green)' : breakdown.roi_pts >= 10 ? 'var(--amber)' : 'var(--red)',
        },
        {
          label: 'Win Rate (weight 30)',
          pts: breakdown.win_rate_pts,
          max: 30,
          formula: breakdown.formulas?.win_rate || `Win Rate ${winRate}%`,
          color: breakdown.win_rate_pts >= 22 ? 'var(--green)' : breakdown.win_rate_pts >= 12 ? 'var(--amber)' : 'var(--red)',
        },
        {
          label: 'Consistency (weight 20)',
          pts: breakdown.consistency_pts,
          max: 20,
          formula: breakdown.formulas?.consistency || '',
          color: 'var(--purple)',
        },
        {
          label: 'Activity (weight 13)',
          pts: breakdown.activity_pts,
          max: 13,
          formula: breakdown.formulas?.activity || `${closedTrades} closed trades`,
          color: 'var(--cyan)',
        },
        ...(breakdown.drawdown_deduct < 0 ? [{
          label: 'Drawdown penalty',
          pts: breakdown.drawdown_deduct,
          max: 0,
          formula: breakdown.formulas?.drawdown || '',
          color: 'var(--red)',
        }] : []),
      ]
    : [
        {
          label: 'Win Rate',
          pts: null,
          max: 30,
          formula: `${winRate != null ? winRate + '%' : '—'} · weight 30`,
          color: winRate >= 60 ? 'var(--green)' : winRate >= 40 ? 'var(--amber)' : 'var(--red)',
        },
        {
          label: 'ROI 30d',
          pts: null,
          max: 37,
          formula: `${roi != null ? (roi >= 0 ? '+' : '') + roi + '%' : '—'} · weight 37`,
          color: roi >= 0 ? 'var(--green)' : 'var(--red)',
        },
        {
          label: 'Activity',
          pts: null,
          max: 13,
          formula: `${closedTrades ?? 0} closed trades · weight 13`,
          color: 'var(--cyan)',
        },
      ]

  return (
    <div className="card card-p" style={{ marginBottom: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div className="section-title" style={{ marginBottom: 0 }}>Alpha Score Breakdown</div>
        <div style={{
          fontFamily: 'var(--mono)', fontSize: '0.8rem', fontWeight: 800,
          color: score >= 75 ? 'var(--green)' : score >= 50 ? 'var(--amber)' : 'var(--red)',
        }}>
          {score} / 100
        </div>
      </div>

      {!closedTrades && (
        <div style={{ fontSize: '0.8rem', color: 'var(--amber)', marginBottom: 12, padding: '6px 10px', background: 'var(--amber-dim)', borderRadius: 6, border: '1px solid rgba(255,184,0,0.15)' }}>
          ⚠️ No tracked trades yet — score reflects on-chain activity only. Resync to update.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {rows.map((r, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 150, fontSize: '0.75rem', color: 'var(--text-3)', flexShrink: 0 }}>{r.label}</div>
            <div style={{ flex: 1, height: 6, background: 'rgba(255,255,255,0.05)', borderRadius: 3, overflow: 'hidden' }}>
              {r.max > 0 && (
                <div style={{
                  height: '100%', borderRadius: 3,
                  width: `${Math.max(0, ((r.pts ?? 0) / r.max) * 100)}%`,
                  background: r.color,
                }} />
              )}
            </div>
            <div style={{ width: 36, textAlign: 'right', fontFamily: 'var(--mono)', fontSize: '0.78rem', fontWeight: 700, color: r.color, flexShrink: 0 }}>
              {r.pts != null ? (r.pts >= 0 ? '+' : '') + r.pts : '—'}
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-3)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 220 }}
              title={r.formula}>
              {r.formula}
            </div>
          </div>
        ))}
      </div>

      {hasRealBreakdown && (
        <div style={{ marginTop: 10, fontSize: '0.68rem', color: 'var(--text-3)', borderTop: '1px solid var(--border)', paddingTop: 8 }}>
          Cost basis: FIFO · Source: Blockscout (Base) · Scored on {breakdown.confidence_filter || 'high-confidence trades'}
        </div>
      )}
    </div>
  )
}
