import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useFmt } from '../utils/i18n'
import FreshnessPulse from '../components/FreshnessPulse'

function GainBar({ gain, max }) {
  const pct = Math.min(100, Math.max(0, (gain / max) * 100))
  const color = gain >= 100 ? 'var(--purple)' : gain >= 50 ? 'var(--green)' : gain >= 20 ? 'var(--cyan)' : 'var(--amber)'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          style={{ height: '100%', background: color, borderRadius: 3 }}
        />
      </div>
      <div style={{ width: 62, textAlign: 'right', fontFamily: 'var(--mono)', fontSize: '0.88rem', fontWeight: 900, color }}>
        +{gain.toFixed(0)}%
      </div>
    </div>
  )
}

function CaseStudyCard({ signal, rank }) {
  const navigate = useNavigate()
  const fmt = useFmt()
  const color = rank === 1 ? 'var(--purple)' : rank === 2 ? 'var(--cyan)' : 'var(--green)'
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: rank * 0.1 }}
      onClick={() => navigate(`/token/${signal.tokenAddress}`)}
      style={{
        background: 'var(--bg-card)',
        border: `1px solid ${color}30`,
        borderTop: `3px solid ${color}`,
        borderRadius: 'var(--r-lg)',
        padding: '24px',
        cursor: 'pointer',
        transition: 'all var(--t)',
        position: 'relative',
      }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.borderColor = color }}
      onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.borderColor = `${color}30` }}
    >
      <div style={{
        position: 'absolute', top: 16, right: 16,
        background: `${color}15`, border: `1px solid ${color}30`,
        color, fontSize: '0.65rem', fontWeight: 900,
        padding: '3px 10px', borderRadius: 'var(--r-full)',
      }}>
        #{rank} ALL-TIME
      </div>

      <div style={{ fontSize: '1.5rem', fontWeight: 900, marginBottom: 4 }}>{signal.tokenSymbol}</div>
      <div style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginBottom: 20 }}>
        {signal.tokenName} · {signal.walletCount} smart wallets · {fmt.daysAgo(signal.daysAgo)}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: '0.6rem', color: 'var(--text-3)', textTransform: 'uppercase', fontWeight: 700, marginBottom: 4 }}>ENTRY PRICE</div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: '1rem', fontWeight: 700, color: 'var(--text-2)' }}>
            ${signal.entryPrice > 0.001 ? signal.entryPrice.toFixed(5) : signal.entryPrice.toExponential(2)}
          </div>
        </div>
        <div>
          <div style={{ fontSize: '0.6rem', color: 'var(--text-3)', textTransform: 'uppercase', fontWeight: 700, marginBottom: 4 }}>PEAK GAIN</div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: '1.6rem', fontWeight: 900, color, lineHeight: 1 }}>
            +{signal.peakGain.toFixed(0)}%
          </div>
        </div>
        <div>
          <div style={{ fontSize: '0.6rem', color: 'var(--text-3)', textTransform: 'uppercase', fontWeight: 700, marginBottom: 4 }}>CURRENT vs ENTRY</div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: '1rem', fontWeight: 700, color: signal.currentPct >= 0 ? 'var(--green)' : 'var(--red)' }}>
            {signal.currentPct >= 0 ? '+' : ''}{signal.currentPct.toFixed(0)}%
          </div>
        </div>
        <div>
          <div style={{ fontSize: '0.6rem', color: 'var(--text-3)', textTransform: 'uppercase', fontWeight: 700, marginBottom: 4 }}>SIGNAL DATE</div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: '0.85rem', color: 'var(--text-2)' }}>
            {new Date(signal.signalDate).toLocaleDateString()}
          </div>
        </div>
      </div>

      <div style={{
        background: 'rgba(255,255,255,0.04)', borderRadius: 'var(--r-md)', padding: '10px 14px',
        fontSize: '0.75rem', color: 'var(--text-3)',
      }}>
        📢 Smart money entered at ${signal.entryPrice > 0.001 ? signal.entryPrice.toFixed(5) : signal.entryPrice.toExponential(2)} · Peak within 30 days: <span style={{ color, fontWeight: 800 }}>+{signal.peakGain.toFixed(0)}%</span>
      </div>
    </motion.div>
  )
}

export default function Proof() {
  const navigate = useNavigate()
  const fmt = useFmt()
  const [signals, setSignals] = useState([])
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    fetch('/api/backtest').then(r => r.json()).then(d => {
      if (d.computed) {
        setSummary(d.summary)
        setSignals(d.signals || [])
      }
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const filtered = signals.filter(s => {
    if (filter === 'win') return s.peakGain >= 20
    if (filter === '50') return s.peakGain >= 50
    if (filter === '100') return s.peakGain >= 100
    return true
  })

  const maxGain = signals.length ? Math.max(...signals.map(s => s.peakGain)) : 100
  const topSignals = [...signals].slice(0, 3)

  return (
    <div className="anim-fade-up" style={{ paddingBottom: 60 }}>

      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: '0.7rem', color: 'var(--purple)', textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 800, marginBottom: 8 }}>
          📊 SIGNAL PROOF
        </div>
        <h1 style={{ fontSize: 'clamp(1.8rem, 4vw, 2.8rem)', fontWeight: 900, letterSpacing: '-0.03em', marginBottom: 10 }}>
          Verified Signal Performance
        </h1>
        <p style={{ fontSize: '0.95rem', color: 'var(--text-2)', maxWidth: 560, lineHeight: 1.65 }}>
          Every signal measured against real GeckoTerminal prices. We show wins AND losses.
          Peak gain measured within 30 days of smart money entry.
        </p>
        <div style={{ marginTop: 12 }}><FreshnessPulse /></div>
      </div>

      {/* Summary KPIs */}
      {summary && (
        <div className="kpi-strip" style={{ marginBottom: 36, cursor: 'default' }}>
          {[
            { label: 'Signals tracked', value: summary.sampleSize, color: 'var(--text-1)' },
            { label: 'Hit +20% in 30d', value: `${summary.peakWinRate}%`, color: 'var(--green)' },
            { label: 'Avg peak gain', value: `+${summary.avgPeakGain}%`, color: 'var(--green)' },
            { label: 'Median peak', value: `+${summary.medianPeakGain}%`, color: 'var(--cyan)' },
            { label: 'Best ever', value: `+${summary.best?.gain?.toFixed(0)}%`, sub: summary.best?.symbol, color: 'var(--purple)' },
          ].map(s => (
            <div key={s.label} className="kpi-cell">
              <div className="kpi-label">{s.label}</div>
              <div className="kpi-val" style={{ color: s.color }}>
                {s.value}
                {s.sub && <span style={{ fontSize: '0.6rem', color: 'var(--text-3)', marginLeft: 4 }}>{s.sub}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Honest disclaimer */}
      <div style={{
        background: 'rgba(255,184,0,0.06)', border: '1px solid rgba(255,184,0,0.2)',
        borderRadius: 'var(--r-md)', padding: '12px 16px', marginBottom: 36,
        fontSize: '0.78rem', color: 'var(--text-2)', lineHeight: 1.6,
      }}>
        ⚠️ <strong>Honest disclosure:</strong> These are momentum signals. Peak gain occurs within 30 days of entry.
        Avg hold-to-now: <span style={{ color: 'var(--red)', fontWeight: 700 }}>{summary ? `${summary.avgHoldReturn?.toFixed(0) || '?'}%` : '...'}</span>.
        Take profits — don't hold forever. Past performance doesn't guarantee future results.
      </div>

      {/* Case Studies - top 3 */}
      {topSignals.length > 0 && (
        <section style={{ marginBottom: 40 }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: 20 }}>
            🏆 Best Signals Ever
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
            {topSignals.map((s, i) => (
              <CaseStudyCard key={s.tokenAddress} signal={s} rank={i + 1} />
            ))}
          </div>
        </section>
      )}

      {/* Before / After callout */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(168,85,247,0.08) 0%, rgba(6,182,212,0.08) 100%)',
        border: '1px solid rgba(168,85,247,0.2)',
        borderRadius: 'var(--r-lg)', padding: '28px 32px', marginBottom: 40,
        display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 24, alignItems: 'center',
      }}>
        <div>
          <div style={{ fontSize: '0.65rem', color: 'var(--red)', fontWeight: 800, textTransform: 'uppercase', marginBottom: 10, letterSpacing: '0.1em' }}>❌ WITHOUT WALLETDNA</div>
          <div style={{ fontSize: '0.9rem', color: 'var(--text-2)', lineHeight: 1.7 }}>
            Find out about tokens from Twitter — after they're already up 200%.<br />
            Buy the top. Hold through the dump.
          </div>
        </div>
        <div style={{ fontSize: '2rem', color: 'var(--text-3)' }}>→</div>
        <div>
          <div style={{ fontSize: '0.65rem', color: 'var(--green)', fontWeight: 800, textTransform: 'uppercase', marginBottom: 10, letterSpacing: '0.1em' }}>✅ WITH WALLETDNA</div>
          <div style={{ fontSize: '0.9rem', color: 'var(--text-2)', lineHeight: 1.7 }}>
            See smart wallets accumulating before the move.<br />
            Get in early. Set your exit. Take profits.
          </div>
        </div>
      </div>

      {/* All Signals Table */}
      <section>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 800 }}>
            All Signals — Sorted by Peak Gain
          </h2>
          <div style={{ display: 'flex', gap: 4 }}>
            {[
              { id: 'all', label: `All (${signals.length})` },
              { id: 'win', label: `+20%+ (${signals.filter(s => s.peakGain >= 20).length})` },
              { id: '50', label: `+50%+ (${signals.filter(s => s.peakGain >= 50).length})` },
              { id: '100', label: `+100%+ (${signals.filter(s => s.peakGain >= 100).length})` },
            ].map(f => (
              <button key={f.id} onClick={() => setFilter(f.id)}
                style={{
                  padding: '5px 12px', borderRadius: 'var(--r-full)', border: 'none',
                  cursor: 'pointer', fontSize: '0.72rem', fontWeight: 700,
                  background: filter === f.id ? 'var(--bg-card-bright)' : 'transparent',
                  color: filter === f.id ? 'var(--text-1)' : 'var(--text-3)',
                  transition: 'all var(--t)',
                }}
              >{f.label}</button>
            ))}
          </div>
        </div>

        <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
          <div style={{ overflowX: 'auto' }}>
          {/* Table header */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr 1fr 2fr', minWidth: 520,
            gap: 12, padding: '10px 20px',
            background: 'var(--bg-1)', borderBottom: '1px solid var(--border)',
          }}>
            {['Token', 'Entry Price', 'Peak 30d', 'Hold to Now', 'Performance'].map((h, i) => (
              <div key={h} style={{
                fontSize: '0.6rem', color: 'var(--text-3)',
                textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700,
                textAlign: i === 0 ? 'left' : i === 4 ? 'left' : 'right',
              }}>{h}</div>
            ))}
          </div>

          {loading ? (
            <div className="loading-block" style={{ padding: '40px 0' }}>
              <div className="spinner" style={{ width: 24, height: 24 }} />
              Loading signals…
            </div>
          ) : filtered.length === 0 ? (
            <div className="empty-state" style={{ padding: '40px 0' }}>
              <div className="empty-state-icon">📊</div>
              <div className="empty-state-title">No signals match this filter</div>
            </div>
          ) : (
            filtered.map((s, i) => (
              <motion.div
                key={s.tokenAddress}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.02 }}
                style={{
                  display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr 1fr 2fr',
                  minWidth: 520,
                  gap: 12, padding: '12px 20px',
                  borderBottom: '1px solid var(--border)',
                  alignItems: 'center',
                  cursor: 'pointer',
                  transition: 'background var(--t)',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.025)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                onClick={() => navigate(`/token/${s.tokenAddress}`)}
              >
                <div>
                  <div style={{ fontWeight: 800, fontSize: '0.9rem' }}>{s.tokenSymbol}</div>
                  <div style={{ fontSize: '0.62rem', color: 'var(--text-3)' }}>
                    {s.walletCount}w · {fmt.daysAgo(s.daysAgo)}
                  </div>
                </div>
                <div style={{ textAlign: 'right', fontFamily: 'var(--mono)', fontSize: '0.8rem', color: 'var(--text-3)' }}>
                  {s.entryPrice > 0 ? (s.entryPrice > 0.001 ? `$${s.entryPrice.toFixed(5)}` : `$${s.entryPrice.toExponential(2)}`) : '—'}
                </div>
                <div style={{ textAlign: 'right', fontFamily: 'var(--mono)', fontSize: '0.9rem', fontWeight: 800, color: s.peakGain >= 50 ? 'var(--purple)' : s.peakGain >= 20 ? 'var(--green)' : 'var(--cyan)' }}>
                  +{s.peakGain.toFixed(0)}%
                </div>
                <div style={{ textAlign: 'right', fontFamily: 'var(--mono)', fontSize: '0.85rem', fontWeight: 700, color: s.currentPct >= 0 ? 'var(--green)' : 'var(--red)' }}>
                  {s.currentPct >= 0 ? '+' : ''}{s.currentPct.toFixed(0)}%
                </div>
                <GainBar gain={s.peakGain} max={maxGain} />
              </motion.div>
            ))
          )}
          </div>
        </div>

        {!loading && (
          <div style={{ fontSize: '0.7rem', color: 'var(--text-3)', marginTop: 12, textAlign: 'center' }}>
            Showing {filtered.length} of {signals.length} signals · Peak measured within 30d of smart money entry · Prices via GeckoTerminal
          </div>
        )}
      </section>
    </div>
  )
}
