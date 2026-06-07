import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useT, useFmt } from '../utils/i18n'
import useStore from '../store/useStore'
import FreshnessPulse from '../components/FreshnessPulse'
import { apiFetch } from '../utils/api'

const STATUS_COLORS = {
  pending:  { color: 'var(--amber)', bg: 'rgba(255,184,0,0.1)',   icon: '⏳' },
  approved: { color: 'var(--green)', bg: 'rgba(0,255,148,0.08)',  icon: '✅' },
  rejected: { color: 'var(--red)',   bg: 'rgba(255,59,107,0.08)', icon: '❌' },
  archived: { color: 'var(--text-3)',bg: 'rgba(255,255,255,0.04)',icon: '📦' },
}

/* ─── Stat Card ──────────────────────────────────────── */
function StatCard({ label, value, sub, color = 'var(--text-1)', icon }) {
  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border)',
      borderRadius: 'var(--r-lg)', padding: '18px 20px',
      display: 'flex', flexDirection: 'column', gap: 4,
    }}>
      <div style={{ fontSize: '0.65rem', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700 }}>
        {icon && <span style={{ marginRight: 5 }}>{icon}</span>}{label}
      </div>
      <div style={{ fontSize: '1.8rem', fontWeight: 900, fontFamily: 'var(--mono)', color, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: '0.7rem', color: 'var(--text-3)', fontWeight: 600 }}>{sub}</div>}
    </div>
  )
}

/* ─── Pipeline Flow ──────────────────────────────────── */
function PipelineFlow({ stats }) {
  const t = useT()
  const steps = [
    { label: t('wd_flow_scan'),     value: stats.total,    color: 'var(--cyan)',   icon: '🔍' },
    { label: t('wd_flow_pending'),  value: stats.pending,  color: 'var(--amber)',  icon: '⏳' },
    { label: t('wd_flow_approved'), value: stats.approved, color: 'var(--green)',  icon: '✅' },
    { label: t('wd_flow_promoted'), value: stats.promoted, color: 'var(--purple)', icon: '🚀' },
  ]
  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border)',
      borderRadius: 'var(--r-lg)', padding: '20px 24px', marginBottom: 24,
    }}>
      <div style={{ fontSize: '0.7rem', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700, marginBottom: 18 }}>
        {t('wd_flow_title')}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
        {steps.map((s, i) => (
          <React.Fragment key={s.label}>
            <div style={{ textAlign: 'center', padding: '8px 4px', borderRadius: 'var(--r-md)', background: 'rgba(255,255,255,0.02)' }}>
              <div style={{ fontSize: '1.5rem', marginBottom: 4 }}>{s.icon}</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 900, fontFamily: 'var(--mono)', color: s.color }}>{s.value}</div>
              <div style={{ fontSize: '0.58rem', color: 'var(--text-3)', fontWeight: 700, whiteSpace: 'pre-line', lineHeight: 1.3, marginTop: 4 }}>{s.label}</div>
            </div>
          </React.Fragment>
        ))}
      </div>
    </div>
  )
}

/* ─── Skeleton Row ───────────────────────────────────── */
function SkeletonRow({ index }) {
  return (
    <div className="wd-candidate-row" style={{ animationDelay: `${index * 0.07}s` }}>
      {[0.55, 0.3, 0.3, 0.25, 0.35, 0.25].map((w, i) => (
        <div key={i} style={{
          height: 11, borderRadius: 6,
          background: 'rgba(255,255,255,0.07)',
          width: `${w * 100}%`,
          animation: 'shimmer 1.4s infinite',
          backgroundImage: 'linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.04) 75%)',
          backgroundSize: '200% 100%',
          marginLeft: i === 0 ? 0 : 'auto',
        }} />
      ))}
    </div>
  )
}

/* ─── Candidate Card (mobile) / Row (desktop) ────────── */
function CandidateRow({ c, index, onViewProfile }) {
  const t = useT()
  const fmt = useFmt()
  const [active, setActive] = useState(false)
  const st = STATUS_COLORS[c.status] || STATUS_COLORS.pending
  const short = `${c.address.slice(0, 6)}...${c.address.slice(-4)}`
  const age = c.discovered_at ? Math.round((Date.now() - c.discovered_at) / 86400000) : 0

  const handleClick = () => {
    setActive(true)
    setTimeout(() => { setActive(false); onViewProfile(c.address) }, 120)
  }

  return (
    <>
      {/* Desktop row */}
      <motion.div
        initial={{ opacity: 0, x: -8 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: index * 0.025 }}
        className="wd-candidate-row wd-desktop-row"
        style={{
          cursor: 'pointer',
          background: active ? 'rgba(0,212,255,0.05)' : 'transparent',
          transition: 'background 0.15s',
        }}
        onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.03)' }}
        onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
        onClick={handleClick}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: st.color, boxShadow: `0 0 6px ${st.color}` }} />
          <div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: '0.82rem', color: 'var(--cyan)', fontWeight: 700 }}>{short}</div>
            {c.source_token && (
              <div style={{ fontSize: '0.6rem', color: 'var(--text-3)' }}>
                {t('via')} {c.source_token.slice(0, 6)}…{c.source_token.slice(-4)}
              </div>
            )}
          </div>
        </div>
        <div style={{ textAlign: 'right', fontFamily: 'var(--mono)', fontSize: '0.85rem', color: (c.roi || 0) >= 0 ? 'var(--green)' : 'var(--red)', fontWeight: 700 }}>
          {(c.roi || 0) >= 0 ? '+' : ''}{(c.roi || 0).toFixed(0)}%
        </div>
        <div style={{ textAlign: 'right', fontFamily: 'var(--mono)', fontSize: '0.85rem', color: 'var(--text-2)' }}>
          {(c.win_rate || 0).toFixed(0)}%
        </div>
        <div style={{ textAlign: 'right', fontFamily: 'var(--mono)', fontSize: '0.85rem', color: 'var(--text-2)' }}>
          {c.total_trades || 0}
        </div>
        <div style={{ textAlign: 'center' }}>
          <span style={{ fontSize: '0.7rem', fontWeight: 800, padding: '3px 8px', borderRadius: 4, background: st.bg, color: st.color }}>
            {st.icon} {t('wd_status_' + c.status)}
          </span>
        </div>
        <div style={{ textAlign: 'right', fontFamily: 'var(--mono)', fontSize: '0.8rem', color: 'var(--text-3)' }}>
          {fmt.daysAgo(age)}
        </div>
      </motion.div>

      {/* Mobile card */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.03 }}
        className="wd-mobile-card"
        onClick={handleClick}
        style={{
          background: active ? 'rgba(0,212,255,0.05)' : 'var(--bg-card)',
          border: `1px solid ${active ? 'rgba(0,212,255,0.3)' : 'var(--border)'}`,
          borderRadius: 'var(--r-lg)', padding: '14px 16px',
          cursor: 'pointer', marginBottom: 8, transition: 'all 0.15s',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: st.color, boxShadow: `0 0 6px ${st.color}`, flexShrink: 0 }} />
            <div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: '0.85rem', color: 'var(--cyan)', fontWeight: 700 }}>{short}</div>
              {c.source_token && (
                <div style={{ fontSize: '0.6rem', color: 'var(--text-3)', marginTop: 1 }}>
                  {t('via')} {c.source_token.slice(0, 6)}…{c.source_token.slice(-4)}
                </div>
              )}
            </div>
          </div>
          <span style={{ fontSize: '0.7rem', fontWeight: 800, padding: '3px 9px', borderRadius: 4, background: st.bg, color: st.color }}>
            {st.icon} {t('wd_status_' + c.status)}
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {[
            { label: 'ROI', value: `${(c.roi || 0) >= 0 ? '+' : ''}${(c.roi || 0).toFixed(0)}%`, color: (c.roi || 0) >= 0 ? 'var(--green)' : 'var(--red)' },
            { label: 'Win %', value: `${(c.win_rate || 0).toFixed(0)}%`, color: 'var(--text-1)' },
            { label: 'Trades', value: c.total_trades || 0, color: 'var(--text-2)' },
          ].map(m => (
            <div key={m.label} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '8px 10px' }}>
              <div style={{ fontSize: '0.58rem', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, marginBottom: 3 }}>{m.label}</div>
              <div style={{ fontFamily: 'var(--mono)', fontWeight: 800, color: m.color, fontSize: '0.9rem' }}>{m.value}</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 8, fontSize: '0.68rem', color: 'var(--text-3)', textAlign: 'right' }}>{fmt.daysAgo(age)}</div>
      </motion.div>
    </>
  )
}

/* ─── Discovery History ──────────────────────────────── */
function DiscoveryHistory({ history }) {
  const t = useT()
  const [open, setOpen] = useState(false)

  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border)',
      borderRadius: 'var(--r-lg)', marginBottom: 24, overflow: 'hidden',
    }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 20px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-1)',
        }}
      >
        <span style={{ fontSize: '0.85rem', fontWeight: 800 }}>{t('wd_history_title')}</span>
        <span style={{ fontSize: '0.7rem', color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 8 }}>
          {history.length > 0 && (
            <span style={{ background: 'rgba(255,255,255,0.08)', padding: '2px 8px', borderRadius: 'var(--r-full)', fontWeight: 700 }}>
              {history.length}
            </span>
          )}
          <span style={{ transition: 'transform 0.2s', display: 'inline-block', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
        </span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ borderTop: '1px solid var(--border)' }}>
              {history.length === 0 ? (
                <div style={{ padding: '24px 20px', textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-3)' }}>
                  {t('wd_history_empty')}
                </div>
              ) : (
                <>
                  <div className="wd-history-row" style={{ background: 'var(--bg-1)' }}>
                    {[t('wd_history_time'), t('wd_history_scanned'), t('wd_history_new'), t('wd_history_promoted'), t('wd_history_db')].map((h, i) => (
                      <div key={i} style={{ fontSize: '0.6rem', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, textAlign: i === 0 ? 'left' : 'right' }}>{h}</div>
                    ))}
                  </div>
                  {history.map((entry, i) => (
                    <div key={i} className="wd-history-row" style={{ borderTop: '1px solid var(--border)' }}>
                      <div style={{ fontFamily: 'var(--mono)', fontSize: '0.75rem', color: 'var(--text-2)' }}>{entry.time}</div>
                      <div style={{ textAlign: 'right', fontFamily: 'var(--mono)', fontSize: '0.8rem', color: 'var(--cyan)', fontWeight: 700 }}>{entry.scanned}</div>
                      <div style={{ textAlign: 'right', fontFamily: 'var(--mono)', fontSize: '0.8rem', color: 'var(--green)', fontWeight: 700 }}>+{entry.newDiscovered}</div>
                      <div style={{ textAlign: 'right', fontFamily: 'var(--mono)', fontSize: '0.8rem', color: 'var(--purple)', fontWeight: 700 }}>+{entry.promoted}</div>
                      <div style={{ textAlign: 'right', fontFamily: 'var(--mono)', fontSize: '0.8rem', color: 'var(--text-2)' }}>{entry.dbSize}</div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/* ─── Main Page ──────────────────────────────────────── */
export default function WalletDiscovery() {
  const navigate = useNavigate()
  const t = useT()

  const {
    discoveryActiveTab, setDiscoveryTab,
    discoveryCandidatesCache, setDiscoveryCandidates,
    discoveryStats, setDiscoveryStats,
    discoveryLastRun, setDiscoveryLastRun,
    discoveryHistory, addDiscoveryHistory,
  } = useStore()

  const [loading, setLoading] = useState(!discoveryCandidatesCache[discoveryActiveTab])
  const [running, setRunning] = useState(false)
  const [runProgress, setRunProgress] = useState(0)

  const candidates = discoveryCandidatesCache[discoveryActiveTab] || []

  // Derived value stats from approved candidates — what a buyer cares about,
  // not engineering counts. These are the headline numbers on the Discovery page.
  const approvedRows = (discoveryCandidatesCache.approved || []).filter(c => c.is_valid !== false)
  const valueStats = (() => {
    if (approvedRows.length === 0) return null
    const sumROI = approvedRows.reduce((s, c) => s + (Number(c.roi) || 0), 0)
    const sumWR  = approvedRows.reduce((s, c) => s + (Number(c.win_rate) || 0), 0)
    const sumAlpha = approvedRows.reduce((s, c) => s + (Number(c.alpha_score) || 0), 0)
    const sumCap = approvedRows.reduce((s, c) => s + (Number(c.capital_traded) || 0), 0)
    return {
      verified: approvedRows.length,
      avgROI:   +(sumROI / approvedRows.length).toFixed(1),
      avgWR:    Math.round(sumWR / approvedRows.length),
      avgAlpha: Math.round(sumAlpha / approvedRows.length),
      totalCap: Math.round(sumCap),
    }
  })()

  const load = useCallback(async (tab) => {
    const activeTab = tab || discoveryActiveTab
    const hasCached = !!discoveryCandidatesCache[activeTab]
    if (!hasCached) setLoading(true)
    try {
      const [sRes, cRes] = await Promise.all([
        apiFetch('/api/discovery/stats').then(r => r.json()),
        fetch(`/api/discovery/candidates?status=${activeTab}&limit=100`).then(r => r.json()),
      ])
      if (sRes.success) setDiscoveryStats(sRes.stats)
      if (cRes.success) setDiscoveryCandidates(activeTab, cRes.candidates || [])
    } catch (e) {
      console.error('[Discovery] Load error:', e)
    } finally {
      setLoading(false)
    }
  }, [discoveryActiveTab])

  useEffect(() => {
    load()
    // Always pre-load approved candidates so the value stats render even
    // when the user is on a different tab.
    if (!discoveryCandidatesCache.approved) {
      apiFetch('/api/discovery/candidates?status=approved&limit=100')
        .then(r => r.json())
        .then(d => { if (d.success) setDiscoveryCandidates('approved', d.candidates || []) })
        .catch(() => {})
    }
  }, [])

  useEffect(() => {
    if (!discoveryCandidatesCache[discoveryActiveTab]) {
      setLoading(true)
      load(discoveryActiveTab)
    }
  }, [discoveryActiveTab])

  useEffect(() => {
    const iv = setInterval(() => load(), 30000)
    return () => clearInterval(iv)
  }, [load])

  const handleTabChange = (tab) => {
    setDiscoveryTab(tab)
    const hasCached = !!discoveryCandidatesCache[tab]
    if (!hasCached) { setLoading(true); load(tab) }
    else load(tab)
  }

  const handleRunDiscovery = async () => {
    if (running) return
    setRunning(true)
    setRunProgress(5)
    const prevStats = { ...discoveryStats }

    const progressInterval = setInterval(() => {
      setRunProgress(p => p < 85 ? p + Math.random() * 12 : p)
    }, 500)

    try {
      await apiFetch('/api/discovery/run', { method: 'POST' }).then(r => r.json())
      const now = new Date().toLocaleTimeString()
      setDiscoveryLastRun(now)
      clearInterval(progressInterval)
      setRunProgress(100)

      setTimeout(async () => {
        await load()
        const newStats = useStore.getState().discoveryStats
        addDiscoveryHistory({
          time: now,
          scanned: newStats.total,
          newDiscovered: Math.max(0, (newStats.approved || 0) - (prevStats.approved || 0)),
          promoted: Math.max(0, (newStats.promoted || 0) - (prevStats.promoted || 0)),
          dbSize: newStats.tracked,
        })
        setRunning(false)
        setRunProgress(0)
      }, 6000)
    } catch {
      clearInterval(progressInterval)
      setRunning(false)
      setRunProgress(0)
    }
  }

  const tabs = [
    { id: 'approved', label: t('wd_tab_approved'), count: discoveryStats.approved },
    { id: 'pending',  label: t('wd_tab_pending'),  count: discoveryStats.pending  },
    { id: 'rejected', label: t('wd_tab_rejected'), count: discoveryStats.rejected },
    { id: 'archived', label: t('wd_tab_archived'), count: discoveryStats.archived },
  ]

  const headers = [t('wd_th_wallet'), t('wd_th_roi'), t('wd_th_winrate'), t('wd_th_trades'), t('wd_th_status'), t('wd_th_discovered')]

  return (
    <div className="anim-fade-up" style={{ paddingBottom: 60 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 14 }}>
        <div>
          <div className="eyebrow">{t('wd_eyebrow')}</div>
          <h1 style={{ fontSize: 'clamp(1.4rem, 3.5vw, 2.2rem)', fontWeight: 900, letterSpacing: '-0.03em', marginBottom: 6 }}>
            {t('wd_title')}
          </h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-2)', maxWidth: 500, lineHeight: 1.6 }}>
            {t('wd_desc')}
          </p>
          <div style={{ marginTop: 10 }}><FreshnessPulse /></div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
          <button
            className="btn btn-green"
            style={{ display: 'flex', alignItems: 'center', gap: 8, opacity: running ? 0.85 : 1, transition: 'opacity 0.15s' }}
            onClick={handleRunDiscovery}
            disabled={running}
          >
            {running
              ? <><div className="spinner" style={{ width: 14, height: 14 }} /> {t('wd_running')}</>
              : <>{t('wd_run')}</>
            }
          </button>
          {discoveryLastRun && (
            <div style={{ fontSize: '0.68rem', color: 'var(--text-3)' }}>
              ✓ {t('wd_triggered').replace('{time}', discoveryLastRun)}
            </div>
          )}
        </div>
      </div>

      {/* Progress bar */}
      {running && (
        <div style={{ height: 3, background: 'var(--border)', borderRadius: 2, marginBottom: 20, overflow: 'hidden' }}>
          <motion.div
            animate={{ width: `${runProgress}%` }}
            transition={{ duration: 0.5 }}
            style={{ height: '100%', background: 'linear-gradient(90deg, var(--green), var(--cyan))', borderRadius: 2 }}
          />
        </div>
      )}

      {/* Value-first stats. Engineering pipeline guts moved below the fold. */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, marginBottom: 24 }}>
        <StatCard
          label="✅ Verified Alpha Wallets"
          value={valueStats?.verified ?? discoveryStats.approved}
          icon="✅" color="var(--green)"
          sub="Backed by real on-chain trades"
        />
        <StatCard
          label="📈 Average ROI"
          value={valueStats ? `${valueStats.avgROI >= 0 ? '+' : ''}${valueStats.avgROI}%` : '—'}
          icon="📈" color={valueStats?.avgROI >= 0 ? 'var(--green)' : 'var(--red)'}
          sub="Across approved wallets"
        />
        <StatCard
          label="🎯 Average Win Rate"
          value={valueStats ? `${valueStats.avgWR}%` : '—'}
          icon="🎯" color={valueStats?.avgWR >= 50 ? 'var(--green)' : 'var(--amber)'}
          sub="FIFO-closed positions"
        />
        <StatCard
          label="⚡ Average Alpha"
          value={valueStats?.avgAlpha ?? '—'}
          icon="⚡" color="var(--cyan)"
          sub="Out of 100"
        />
      </div>

      {/* Engineering details (collapsible, for the curious / dev). */}
      <details style={{ marginBottom: 24 }}>
        <summary style={{ cursor: 'pointer', fontSize: '0.72rem', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, marginBottom: 12 }}>
          Pipeline internals
        </summary>
        <PipelineFlow stats={discoveryStats} />
      </details>

      {/* Discovery History */}
      <DiscoveryHistory history={discoveryHistory} />

      {/* How it works — collapsible on mobile */}
      <details style={{ marginBottom: 20 }}>
        <summary style={{
          cursor: 'pointer', fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-1)',
          background: 'linear-gradient(135deg, rgba(6,182,212,0.06) 0%, rgba(168,85,247,0.06) 100%)',
          border: '1px solid rgba(6,182,212,0.15)', borderRadius: 'var(--r-lg)',
          padding: '14px 20px', listStyle: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          {t('wd_how_title')} <span style={{ fontSize: '0.7rem', color: 'var(--text-3)' }}>▼</span>
        </summary>
        <div style={{
          background: 'linear-gradient(135deg, rgba(6,182,212,0.04) 0%, rgba(168,85,247,0.04) 100%)',
          border: '1px solid rgba(6,182,212,0.15)', borderTop: 'none',
          borderRadius: '0 0 var(--r-lg) var(--r-lg)', padding: '16px 20px',
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px 24px' }}>
            {[
              { step: '1', text: t('wd_step1') },
              { step: '2', text: t('wd_step2') },
              { step: '3', text: t('wd_step3') },
              { step: '4', text: t('wd_step4') },
              { step: '5', text: t('wd_step5') },
              { step: '6', text: t('wd_step6') },
            ].map(s => (
              <div key={s.step} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: '0.82rem', color: 'var(--text-2)' }}>
                <span style={{
                  background: 'rgba(6,182,212,0.15)', color: 'var(--cyan)',
                  borderRadius: '50%', width: 20, height: 20, display: 'flex',
                  alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem',
                  fontWeight: 900, flexShrink: 0,
                }}>{s.step}</span>
                {s.text}
              </div>
            ))}
          </div>
        </div>
      </details>

      {/* Candidates Table */}
      <div style={{ marginBottom: 16 }}>
        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 14, flexWrap: 'wrap' }}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              style={{
                padding: '8px 14px', borderRadius: 'var(--r-full)',
                cursor: 'pointer', fontWeight: 700, fontSize: '0.8rem',
                background: discoveryActiveTab === tab.id ? 'var(--bg-card)' : 'transparent',
                color: discoveryActiveTab === tab.id ? 'var(--text-1)' : 'var(--text-3)',
                border: discoveryActiveTab === tab.id ? '1px solid var(--border-bright)' : '1px solid transparent',
                boxShadow: discoveryActiveTab === tab.id ? '0 2px 8px rgba(0,0,0,0.3)' : 'none',
                transition: 'all var(--t)',
              }}
            >
              {tab.label}
              <span style={{
                marginLeft: 6, padding: '1px 6px', borderRadius: 'var(--r-full)',
                background: discoveryActiveTab === tab.id ? 'rgba(0,212,255,0.15)' : 'rgba(255,255,255,0.06)',
                fontSize: '0.7rem',
                color: discoveryActiveTab === tab.id ? 'var(--cyan)' : 'var(--text-3)',
              }}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Desktop Table */}
        <div className="card wd-table-wrap" style={{ overflow: 'hidden', padding: 0 }}>
          {/* Table header */}
          <div className="wd-candidate-row wd-desktop-row" style={{ background: 'var(--bg-1)' }}>
            {headers.map((h, i) => (
              <div key={i} style={{
                fontSize: '0.6rem', color: 'var(--text-3)',
                textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700,
                textAlign: i === 0 ? 'left' : i === 4 ? 'center' : 'right',
              }}>{h}</div>
            ))}
          </div>

          {loading ? (
            <>{Array.from({ length: 7 }).map((_, i) => <SkeletonRow key={i} index={i} />)}</>
          ) : candidates.length === 0 ? (
            <div className="empty-state" style={{ padding: '50px 0' }}>
              <div className="empty-state-icon">🔍</div>
              <div className="empty-state-title">
                {t('wd_empty_title').replace('{status}', t('wd_status_' + discoveryActiveTab))}
              </div>
              <div className="empty-state-sub">
                {discoveryActiveTab === 'approved'
                  ? t('wd_empty_approved_sub')
                  : t('wd_empty_generic_sub').replace('{status}', t('wd_status_' + discoveryActiveTab))}
              </div>
              {discoveryActiveTab === 'approved' && (
                <button className="btn btn-green" style={{ marginTop: 16 }} onClick={handleRunDiscovery} disabled={running}>
                  {t('wd_run')}
                </button>
              )}
            </div>
          ) : (
            <AnimatePresence>
              {candidates.map((c, i) => (
                <CandidateRow
                  key={c.address}
                  c={c}
                  index={i}
                  onViewProfile={addr => navigate(`/profile/${addr}`)}
                />
              ))}
            </AnimatePresence>
          )}
        </div>

        {candidates.length > 0 && (
          <div style={{ fontSize: '0.72rem', color: 'var(--text-3)', marginTop: 10, textAlign: 'center' }}>
            {t('wd_footer_note')
              .replace('{count}', candidates.length)
              .replace('{status}', t('wd_status_' + discoveryActiveTab))}
          </div>
        )}
      </div>
    </div>
  )
}
