import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { fmtNum } from '../utils/format'
import { useT, useFmt } from '../utils/i18n'
import FreshnessPulse from '../components/FreshnessPulse'
import { apiFetch } from '../utils/api'

export default function Clusters() {
  const navigate = useNavigate()
  const t = useT()
  const fmt = useFmt()
  const [clusters, setClusters] = useState([])
  const [exits, setExits] = useState([])
  const [tab, setTab] = useState('in')
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(null)

  useEffect(() => {
    const load = async () => {
      try {
        const [c, e] = await Promise.all([
          apiFetch('/api/clusters').then(r => r.json()),
          apiFetch('/api/exits').then(r => r.json()),
        ])
        if (c.success) setClusters(c.clusters || [])
        if (e.success) setExits(e.exits || [])
      } catch (e) { console.error(e) } finally { setLoading(false) }
    }
    load()
    const iv = setInterval(load, 60000)
    return () => clearInterval(iv)
  }, [])

  const urgColor = (s) => s >= 80 ? 'var(--red)' : s >= 60 ? 'var(--amber)' : 'var(--cyan)'
  const urgLabel = (s) => s >= 80 ? 'CRITICAL' : s >= 60 ? 'HIGH' : 'MEDIUM'

  const list = tab === 'in' ? clusters : exits

  return (
    <div className="anim-fade-up" style={{ paddingBottom: 60 }}>

      {/* Header */}
      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div className="eyebrow">
            <span className="live-dot" style={{ display: 'inline-block', width: 6, height: 6, marginRight: 6, borderRadius: '50%', background: 'var(--red)', boxShadow: '0 0 6px var(--red)', verticalAlign: 'middle' }} />
            {t('clp_eyebrow')}
          </div>
          <h1 style={{ fontSize: 'clamp(1.5rem, 3vw, 2.2rem)', fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1.1 }}>
            {t('clp_title_a')}<span className="text-purple">{t('clp_title_b')}</span>
          </h1>
        </div>
        <FreshnessPulse />
      </div>

      {/* Tabs + summary */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
        <div className="tab-group">
          <button
            className={`tab-btn ${tab === 'in' ? 'active' : ''}`}
            onClick={() => { setTab('in'); setExpanded(null) }}
          >
            {t('clp_accumulating')}{!loading && ` (${clusters.length})`}
          </button>
          <button
            className={`tab-btn ${tab === 'out' ? 'active' : ''}`}
            onClick={() => { setTab('out'); setExpanded(null) }}
          >
            {t('clp_exiting')}{!loading && ` (${exits.length})`}
          </button>
        </div>
        {!loading && tab === 'in' && clusters.length > 0 && (
          <div style={{ marginLeft: 'auto', fontSize: '0.8rem', color: 'var(--text-3)' }}>
            <span style={{ color: 'var(--green)', fontWeight: 700 }}>
              ${fmtNum(clusters.reduce((s, c) => s + (c.totalInflowUSD || 0), 0))}
            </span>
            {' '}{t('clp_combined_inflow').toLowerCase()} · {clusters.reduce((s, c) => s + c.walletCount, 0)} {t('tb_wallets')}
          </div>
        )}
      </div>

      {/* List */}
      {loading ? (
        <div className="loading-block">
          <div className="spinner" style={{ width: 28, height: 28 }} />
          {t('clp_scanning')}
        </div>
      ) : list.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">{tab === 'in' ? '🎯' : '🚪'}</div>
          <div className="empty-state-title">{tab === 'in' ? t('clp_none_title') : t('clp_no_exits_title')}</div>
          <div className="empty-state-sub">
            {tab === 'in' ? t('clp_none') : t('clp_no_exits')}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <AnimatePresence>
            {list.map((c, idx) => {
              const uc = urgColor(c.urgencyScore || c.confidenceScore)
              const ul = urgLabel(c.urgencyScore || c.confidenceScore)
              const isOpen = expanded === c.id
              const isExit = tab === 'out'
              const tokenAddr = c.token?.address

              return (
                <motion.div
                  key={c.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.04 }}
                  style={{
                    background: `linear-gradient(90deg, ${uc}07 0%, var(--bg-card) 20%)`,
                    border: `1px solid ${uc}28`,
                    borderLeft: `3px solid ${uc}`,
                    borderRadius: 'var(--r-lg)',
                    overflow: 'hidden',
                  }}
                >
                  {/* Main row */}
                  <div
                    style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 16, alignItems: 'center', padding: '16px 18px', cursor: 'pointer' }}
                    onClick={() => setExpanded(isOpen ? null : c.id)}
                  >
                    {/* Score */}
                    <div style={{ textAlign: 'center', minWidth: 56 }}>
                      <div style={{ fontSize: '1.6rem', fontWeight: 900, fontFamily: 'var(--mono)', color: uc, lineHeight: 1 }}>
                        {c.confidenceScore}
                      </div>
                      <div style={{ fontSize: '0.55rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-3)', marginTop: 2, fontWeight: 700 }}>
                        score
                      </div>
                    </div>

                    {/* Info */}
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6, flexWrap: 'wrap' }}>
                        <span className="badge" style={{ background: `${uc}18`, color: uc, border: `1px solid ${uc}30`, fontSize: '0.6rem', fontWeight: 800 }}>
                          {ul}
                        </span>
                        {c.urgencyScore >= 80 && (
                          <span style={{ fontSize: '0.65rem', color: 'var(--text-3)' }}>
                            🔥 HOT
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '1.05rem', fontWeight: 800, marginBottom: 6 }}>
                        {isExit ? '🚪' : '🎯'} {c.walletCount} wallets {isExit ? 'exiting' : 'into'}{' '}
                        <span style={{ color: uc }}>{c.token?.symbol}</span>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-3)', fontWeight: 400, marginLeft: 6 }}>{c.token?.name}</span>
                      </div>
                      {/* "If you followed this signal" — the conversion line. */}
                      {c.followedLabel && (
                        <div style={{
                          display: 'inline-flex', alignItems: 'center', gap: 6,
                          padding: '3px 10px', marginBottom: 8,
                          borderRadius: 999,
                          background: c.followedColor === 'green'
                            ? 'rgba(0,229,148,0.10)'
                            : c.followedColor === 'red'
                              ? 'rgba(255,59,107,0.10)'
                              : 'rgba(255,255,255,0.05)',
                          border: `1px solid ${c.followedColor === 'green' ? 'rgba(0,229,148,0.35)' : c.followedColor === 'red' ? 'rgba(255,59,107,0.35)' : 'rgba(255,255,255,0.10)'}`,
                          color: c.followedColor === 'green'
                            ? 'var(--green, #00E594)'
                            : c.followedColor === 'red'
                              ? 'var(--red, #FF3B6B)'
                              : 'var(--text-2)',
                          fontSize: '0.74rem', fontWeight: 800, fontFamily: 'var(--mono)',
                        }}>
                          📈 If you followed: {c.followedLabel}
                        </div>
                      )}
                      {c.riskGate && (
                        <div style={{
                          display: 'inline-flex', alignItems: 'center', gap: 6,
                          padding: '3px 10px', marginBottom: 8, marginLeft: 6,
                          borderRadius: 999,
                          background: c.riskGate.level === 'LOW'   ? 'rgba(0,229,148,0.12)'
                                    : c.riskGate.level === 'HIGH'  ? 'rgba(255,59,107,0.12)'
                                    : 'rgba(255,184,0,0.12)',
                          border: `1px solid ${c.riskGate.level === 'LOW' ? 'rgba(0,229,148,0.35)' : c.riskGate.level === 'HIGH' ? 'rgba(255,59,107,0.35)' : 'rgba(255,184,0,0.35)'}`,
                          color:  c.riskGate.level === 'LOW' ? 'var(--green, #00E594)' : c.riskGate.level === 'HIGH' ? 'var(--red, #FF3B6B)' : 'var(--amber, #FFB800)',
                          fontSize: '0.7rem', fontWeight: 800,
                        }}
                        title={c.riskGate.why?.join(' · ')}>
                          {c.riskGate.level === 'LOW' ? '🟢' : c.riskGate.level === 'HIGH' ? '🔴' : '🟡'}
                          {' '}{c.riskGate.level} RISK
                          {c.riskGate.why?.[0] && <span style={{ marginLeft: 4, color: 'var(--text-3)', fontWeight: 600 }}>· {c.riskGate.why[0]}</span>}
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
                        <div>
                          <div style={{ fontSize: '0.58rem', color: 'var(--text-3)', textTransform: 'uppercase', fontWeight: 700 }}>Inflow</div>
                          <div style={{ fontSize: '0.9rem', color: 'var(--green)', fontFamily: 'var(--mono)', fontWeight: 800 }}>${fmtNum(c.totalInflowUSD)}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: '0.58rem', color: 'var(--text-3)', textTransform: 'uppercase', fontWeight: 700 }}>Avg Entry</div>
                          <div style={{ fontSize: '0.9rem', color: 'var(--text-2)', fontFamily: 'var(--mono)', fontWeight: 700 }}>${c.avgEntryPrice}</div>
                        </div>
                        {c.currentPrice && c.currentPrice !== c.avgEntryPrice && (
                          <div>
                            <div style={{ fontSize: '0.58rem', color: 'var(--text-3)', textTransform: 'uppercase', fontWeight: 700 }}>Now</div>
                            <div style={{ fontSize: '0.9rem', color: 'var(--cyan)', fontFamily: 'var(--mono)', fontWeight: 700 }}>${c.currentPrice}</div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }} onClick={e => e.stopPropagation()}>
                      {!isExit && tokenAddr && (
                        <a
                          href={`https://app.uniswap.org/swap?chain=base&outputCurrency=${tokenAddr}`}
                          target="_blank" rel="noopener noreferrer"
                          className="btn btn-green btn-sm"
                          style={{ justifyContent: 'center' }}
                        >
                          Copy Trade ↗
                        </a>
                      )}
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ justifyContent: 'center' }}
                        onClick={() => navigate(`/token/${tokenAddr}`)}
                      >
                        Details
                      </button>
                      <div style={{ fontSize: '0.65rem', color: 'var(--text-3)', textAlign: 'center', cursor: 'pointer' }}
                        onClick={() => setExpanded(isOpen ? null : c.id)}>
                        {isOpen ? '▲ Hide' : '▼ Wallets'}
                      </div>
                    </div>
                  </div>

                  {/* Expanded: wallet list */}
                  <AnimatePresence>
                    {isOpen && (c.members || c.wallets) && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        style={{ borderTop: `1px solid ${uc}20`, background: 'rgba(0,0,0,0.2)', overflow: 'hidden' }}
                      >
                        <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <div style={{ fontSize: '0.65rem', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, marginBottom: 6 }}>
                            Wallets in this cluster
                          </div>
                          {(c.members || c.wallets).slice(0, 10).map(w => (
                            <div key={w.address}
                              style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto auto auto', alignItems: 'center', gap: 12, padding: '8px 12px', borderRadius: 'var(--r-md)', background: 'var(--bg-glass)', cursor: 'pointer' }}
                              onClick={() => navigate(`/profile/${w.address}`)}
                            >
                              <div style={{ minWidth: 0 }}>
                                <div style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--text-1)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {w.label || `${w.address.slice(0, 6)}…${w.address.slice(-4)}`}
                                </div>
                                {w.bestTrade && (
                                  <div style={{ fontSize: '0.66rem', color: 'var(--green, #00E594)', fontWeight: 700, fontFamily: 'var(--mono)' }}>
                                    🏆 Best: {w.bestTrade.symbol} +{w.bestTrade.roiPct}% (×{w.bestTrade.multiple.toFixed(1)})
                                  </div>
                                )}
                              </div>
                              <span style={{ fontFamily: 'var(--mono)', fontSize: '0.78rem', color: 'var(--text-3)', fontWeight: 700 }}>
                                ${fmtNum(w.amount || w.totalUSD || w.volume)}
                              </span>
                              <span style={{ fontSize: '0.7rem', color: 'var(--cyan)', fontFamily: 'var(--mono)', fontWeight: 800 }}>α{w.alphaScore}</span>
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-3)' }}>→</span>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}
