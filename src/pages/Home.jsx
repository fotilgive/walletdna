import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { fmtNum } from '../utils/format'
import { useT, useFmt } from '../utils/i18n'
import useStore from '../store/useStore'
import { apiFetch } from '../utils/api'
import FreshnessPulse from '../components/FreshnessPulse'
import TodaysMoveCard from '../components/TodaysMoveCard'
import RecentWins from '../components/RecentWins'

const uniswapUrl = (addr) => `https://app.uniswap.org/swap?chain=base&outputCurrency=${addr}`

function PositionSimulator({ followed30d }) {
  const [size, setSize] = React.useState(1000)
  const { avgPeak, avgHeldPct, worstSignalPct, count: signals } = followed30d || {}

  // Flat-bet $size per signal. All three outcomes are sums across signals.
  const flatPeak  = size * (avgPeak / 100) * signals
  const flatHeld  = size * (avgHeldPct / 100) * signals
  const worstDD   = size * (worstSignalPct / 100)   // worst single-signal drawdown (one bet)

  return (
    <div style={{
      marginBottom: 26,
      padding: '20px 22px',
      borderRadius: 'var(--r-lg)',
      background: 'linear-gradient(90deg, rgba(181,74,255,0.08), rgba(0,229,148,0.05))',
      border: '1px solid rgba(181,74,255,0.30)',
    }}>
      <div style={{ fontSize: '0.62rem', color: 'var(--purple)', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>
        💰 Position Simulator — last 30 days, {signals} signals
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.86rem', color: 'var(--text-2)' }}>
          <span>If I put</span>
          <span style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)', pointerEvents: 'none', fontFamily: 'var(--mono)', fontWeight: 800 }}>$</span>
            <input
              type="number" min="50" max="100000" step="50" value={size}
              onChange={e => setSize(Math.max(0, Number(e.target.value) || 0))}
              style={{
                width: 120, padding: '8px 10px 8px 22px',
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                borderRadius: 'var(--r-md)', color: 'var(--text-1)',
                fontFamily: 'var(--mono)', fontWeight: 800, fontSize: '1rem',
              }}
            />
          </span>
          <span>per signal</span>
        </label>
      </div>

      <div style={{
        marginTop: 16,
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12,
      }}>
        <SimTile
          label="Peak outcome"
          sub={`sold at peak · avg +${avgPeak}%`}
          value={`${flatPeak >= 0 ? '+' : '−'}$${Math.abs(Math.round(flatPeak)).toLocaleString()}`}
          color="var(--green, #00E594)"
        />
        <SimTile
          label="Held until now"
          sub={`never sold · avg ${avgHeldPct >= 0 ? '+' : ''}${avgHeldPct}%`}
          value={`${flatHeld >= 0 ? '+' : '−'}$${Math.abs(Math.round(flatHeld)).toLocaleString()}`}
          color={flatHeld >= 0 ? 'var(--green, #00E594)' : 'var(--red, #FF3B6B)'}
        />
        <SimTile
          label="Worst single signal"
          sub={`one bad signal · ${worstSignalPct}%`}
          value={`${worstDD >= 0 ? '+' : '−'}$${Math.abs(Math.round(worstDD)).toLocaleString()}`}
          color={worstDD >= 0 ? 'var(--green, #00E594)' : 'var(--red, #FF3B6B)'}
        />
      </div>

      <div style={{ marginTop: 12, fontSize: '0.72rem', color: 'var(--text-3)' }}>
        Honest math from {signals} real signals. Past performance ≠ future returns.
        Real outcomes depend on entry timing and discipline.
      </div>
    </div>
  )
}

function SimTile({ label, sub, value, color }) {
  return (
    <div style={{
      padding: '12px 14px',
      borderRadius: 'var(--r-md)',
      background: 'rgba(0,0,0,0.25)',
      border: '1px solid var(--border)',
    }}>
      <div style={{ fontSize: '0.62rem', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 800 }}>
        {label}
      </div>
      <div style={{ fontSize: '1.55rem', fontWeight: 900, fontFamily: 'var(--mono)', color, lineHeight: 1.1, marginTop: 4 }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: '0.66rem', color: 'var(--text-3)', marginTop: 3 }}>{sub}</div>}
    </div>
  )
}

function HeroStat({ label, value, accent = 'var(--text-1)' }) {
  return (
    <div>
      <div style={{
        fontSize: '1.45rem', fontWeight: 900, fontFamily: 'var(--mono)',
        color: accent, lineHeight: 1,
      }}>
        {value}
      </div>
      <div style={{
        fontSize: '0.68rem', color: 'var(--text-3)', fontWeight: 700,
        textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 4,
      }}>
        {label}
      </div>
    </div>
  )
}

function ValueChip({ value, label, color = 'var(--text-1)', pulse = false }) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 8,
      padding: '8px 14px', borderRadius: 'var(--r-md)',
      background: 'var(--bg-card)', border: `1px solid ${color}22`,
    }}>
      {pulse && (
        <span style={{
          width: 6, height: 6, borderRadius: '50%', background: color,
          boxShadow: `0 0 6px ${color}`,
        }} />
      )}
      <span style={{
        fontSize: '1.05rem', fontWeight: 900, fontFamily: 'var(--mono)',
        color, lineHeight: 1, letterSpacing: '-0.01em',
      }}>{value}</span>
      <span style={{
        fontSize: '0.65rem', color: 'var(--text-3)', fontWeight: 700,
        textTransform: 'uppercase', letterSpacing: '0.06em',
      }}>{label}</span>
    </div>
  )
}

function ConvictionRing({ score, color }) {
  const r = 22, c = 2 * Math.PI * r, off = c - (score / 100) * c
  return (
    <svg width="54" height="54" viewBox="0 0 54 54" style={{ transform: 'rotate(-90deg)', flexShrink: 0 }}>
      <circle cx="27" cy="27" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="4" />
      <circle cx="27" cy="27" r={r} fill="none" stroke={color} strokeWidth="4" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={off} style={{ transition: 'stroke-dashoffset 0.6s ease' }} />
      <text x="27" y="27" textAnchor="middle" dominantBaseline="central" fill={color}
        fontSize="14" fontWeight="900" fontFamily="var(--mono)" transform="rotate(90 27 27)">{score}</text>
    </svg>
  )
}

function UrgencyBadge({ score, minsAgo }) {
  const isNew = minsAgo !== undefined && minsAgo < 5
  if (isNew) return (
    <span style={{
      background: 'rgba(255,59,107,0.15)', border: '1px solid rgba(255,59,107,0.4)',
      color: 'var(--red)', fontSize: '0.58rem', fontWeight: 900,
      padding: '2px 7px', borderRadius: 'var(--r-full)', letterSpacing: '0.08em',
      animation: 'pulse 1.5s ease-in-out infinite',
    }}>● NEW</span>
  )
  if (score >= 85) return (
    <span className="badge badge-red" style={{ fontSize: '0.6rem' }}>🔥 HOT</span>
  )
  if (score >= 70) return (
    <span style={{ background: 'rgba(255,184,0,0.12)', border: '1px solid rgba(255,184,0,0.3)', color: 'var(--amber)', fontSize: '0.6rem', fontWeight: 800, padding: '2px 7px', borderRadius: 'var(--r-full)' }}>⚡ ACTIVE</span>
  )
  return null
}

function OpportunityScore({ score }) {
  const color = score >= 80 ? 'var(--red)' : score >= 65 ? 'var(--amber)' : 'var(--cyan)'
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '6px 12px', borderRadius: 'var(--r-md)',
      background: `${color}10`, border: `1px solid ${color}25`,
    }}>
      <div style={{ fontSize: '0.55rem', color: 'var(--text-3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>OPP</div>
      <div style={{ fontSize: '1.1rem', fontWeight: 900, fontFamily: 'var(--mono)', color, lineHeight: 1 }}>{score}</div>
    </div>
  )
}

export default function Home() {
  const navigate = useNavigate()
  const t = useT()
  const fmt = useFmt()
  const [clusters, setClusters] = useState([])
  const [feed, setFeed] = useState([])
  const [backtest, setBacktest] = useState(null)
  const [winners, setWinners] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const [cRes, fRes, bRes] = await Promise.all([
          apiFetch('/api/clusters').then(r => r.json()).catch(() => ({ success: false })),
          apiFetch('/api/alpha-feed').then(r => r.json()).catch(() => ({ success: false })),
          apiFetch('/api/backtest').then(r => r.json()).catch(() => ({ success: false })),
        ])
        if (cRes.success) setClusters(cRes.clusters || [])
        if (fRes.success) setFeed(fRes.feed || [])
        if (bRes.success && bRes.computed) {
          setBacktest(bRes.summary)
          setWinners((bRes.signals || []).filter(s => s.peakGain >= 20).slice(0, 4))
        }
      } catch (e) { console.error(e) } finally { setLoading(false) }
    }
    load()
    const iv = setInterval(load, 60000)
    return () => clearInterval(iv)
  }, [])

  const { globalStats } = useStore()
  const convColor = (s) => s >= 85 ? 'var(--red)' : s >= 70 ? 'var(--amber)' : 'var(--cyan)'
  const totalInflow = clusters.reduce((s, c) => s + (c.totalInflowUSD || 0), 0)
  const hotCount = clusters.filter(c => (c.urgencyScore || 0) >= 80).length

  return (
    <div className="anim-fade-up" style={{ paddingBottom: 60 }}>

      {/* ── HERO ── */}
      <section style={{ marginBottom: 28, position: 'relative' }}>
        <div style={{
          position: 'absolute', top: -80, right: 0, width: 500, height: 400,
          background: 'radial-gradient(ellipse at center, rgba(168,85,247,0.07) 0%, transparent 70%)',
          pointerEvents: 'none', zIndex: -1,
        }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '4px 12px', borderRadius: 'var(--r-full)',
            background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
            color: 'var(--red)', fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.1em',
          }}>
            <div className="live-dot" style={{ background: 'var(--red)', boxShadow: '0 0 6px var(--red)' }} />
            {t('home_live')}
          </div>
          {!loading && clusters.length > 0 && (
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '4px 12px', borderRadius: 'var(--r-full)',
              background: 'rgba(0,255,148,0.06)', border: '1px solid rgba(0,255,148,0.2)',
              color: 'var(--green)', fontSize: '0.68rem', fontWeight: 800,
            }}>
              {clusters.length} {t('home_opps_now')}
              {hotCount > 0 && <span style={{ color: 'var(--red)' }}>· {hotCount} 🔥</span>}
            </div>
          )}
          <FreshnessPulse />
        </div>

        <h1 style={{
          fontSize: 'clamp(2rem, 4.5vw, 3.2rem)', fontWeight: 900,
          letterSpacing: '-0.04em', lineHeight: 1.05, marginBottom: 10, maxWidth: 720,
        }}>
          {t('home_h1a')}<span className="gradient-text">{t('home_h1b')}</span>{t('home_h1c')}
        </h1>

        <p style={{ fontSize: '1rem', color: 'var(--text-2)', marginBottom: 20, maxWidth: 520, lineHeight: 1.6 }}>
          {t('home_sub')}
        </p>

        {/* ── ONE BIG HERO NUMBER ── one promise, above the fold. */}
        {globalStats.followed30d?.count > 0 && (
          <div
            onClick={() => navigate('/proof')}
            style={{
              display: 'flex', alignItems: 'center', gap: 28, flexWrap: 'wrap',
              padding: '24px 28px',
              marginBottom: 22,
              borderRadius: 'var(--r-lg)',
              background: 'linear-gradient(90deg, rgba(0,229,148,0.10), transparent 70%)',
              border: '1px solid rgba(0,229,148,0.30)',
              cursor: 'pointer',
            }}>
            <div style={{ minWidth: 220 }}>
              <div style={{
                fontSize: 'clamp(3.6rem, 7vw, 5.4rem)', fontWeight: 900,
                fontFamily: 'var(--mono)', color: 'var(--green, #00E594)',
                lineHeight: 0.95, letterSpacing: '-0.04em',
              }}>
                +{globalStats.followed30d.avgPeak}%
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-2)', marginTop: 6, fontWeight: 600 }}>
                Average peak gain across all tracked clusters
                <span style={{ color: 'var(--text-3)' }}> · last 30 days</span>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 18, flexGrow: 1 }}>
              <HeroStat label="Verified alpha wallets" value={globalStats.verifiedWallets} />
              <HeroStat label="Signals analyzed" value={globalStats.followed30d.count} />
              <HeroStat label="Hit +20% in 30d" value={`${globalStats.followed30d.hitRate20}%`} />
              <HeroStat label="Best single signal" value={`+${Math.round(globalStats.followed30d.bestSignalPct)}%`} accent="var(--cyan)" />
            </div>
          </div>
        )}

        {/* Value bar — only metrics that tell the buyer what they get.
            Numbers from /api/stats + /api/backtest. No engineering counts. */}
        {(globalStats.verifiedWallets > 0 || globalStats.activeClusters > 0) && (
          <div style={{ display: 'flex', gap: 14, marginBottom: 18, flexWrap: 'wrap' }}>
            <ValueChip
              value={globalStats.verifiedWallets}
              label="verified alpha wallets"
              color="var(--cyan)"
            />
            <ValueChip
              value={globalStats.activeClusters}
              label="active opportunities"
              color={globalStats.activeClusters > 0 ? 'var(--green)' : 'var(--text-3)'}
              pulse={globalStats.activeClusters > 0}
            />
            {backtest && (
              <>
                <ValueChip
                  value={`${backtest.peakWinRate}%`}
                  label="hit +20% in 30d"
                  color={backtest.peakWinRate >= 40 ? 'var(--green)' : 'var(--amber)'}
                />
                <ValueChip
                  value={`+${backtest.avgPeakGain}%`}
                  label="avg peak gain"
                  color="var(--green)"
                />
              </>
            )}
          </div>
        )}

        {/* Followed-it-all banner — strongest single conversion line.
            "If you had bought every cluster signal in the last 30 days at the avg entry
            and sold at the realised peak within 30d, your sum-of-peak would be +X%". */}
        {globalStats.followed30d?.count > 0 && (
          <div style={{
            marginBottom: 22,
            padding: '18px 22px',
            borderRadius: 'var(--r-lg)',
            background: 'linear-gradient(90deg, rgba(0,229,148,0.10), rgba(0,229,148,0.02))',
            border: '1px solid rgba(0,229,148,0.30)',
            display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap',
            cursor: 'pointer',
          }}
          onClick={() => navigate('/proof')}
          >
            <div style={{
              fontSize: '0.62rem', color: 'var(--green)', fontWeight: 800,
              letterSpacing: '0.1em', textTransform: 'uppercase',
            }}>
              📈 If you followed every cluster · last 30d
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontSize: '2.0rem', fontWeight: 900, fontFamily: 'var(--mono)', color: 'var(--green)', lineHeight: 1 }}>
                +{globalStats.followed30d.avgPeak}%
              </span>
              <span style={{ fontSize: '0.74rem', color: 'var(--text-3)', fontWeight: 700 }}>
                avg peak / signal
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontSize: '1.3rem', fontWeight: 900, fontFamily: 'var(--mono)', color: 'var(--text-1)', lineHeight: 1 }}>
                {globalStats.followed30d.hitRate20}%
              </span>
              <span style={{ fontSize: '0.74rem', color: 'var(--text-3)', fontWeight: 700 }}>
                hit +20%
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontSize: '1.3rem', fontWeight: 900, fontFamily: 'var(--mono)', color: 'var(--text-1)', lineHeight: 1 }}>
                {globalStats.followed30d.count}
              </span>
              <span style={{ fontSize: '0.74rem', color: 'var(--text-3)', fontWeight: 700 }}>
                signals
              </span>
            </div>
            <div style={{ marginLeft: 'auto', fontSize: '0.72rem', color: 'var(--cyan)', fontWeight: 700 }}>
              View proof →
            </div>
          </div>
        )}

        {/* ── Today's Top Move — single actionable card ── */}
        <TodaysMoveCard />

        {/* ── Recent Wins strip — social proof of recent landings ── */}
        <RecentWins />

        {/* ── Position-size calculator — "what would I have made?" ── */}
        {globalStats.followed30d?.count > 0 && (
          <PositionSimulator followed30d={globalStats.followed30d} />
        )}

        {/* Proof strip */}
        {backtest && (
          <div
            onClick={() => navigate('/proof')}
            className="kpi-strip"
            style={{ maxWidth: 580, cursor: 'pointer' }}
          >
            {[
              { label: t('home_bt_tested'), value: backtest.sampleSize, color: 'var(--text-1)' },
              { label: t('home_bt_hit'), value: `${backtest.peakWinRate}%`, color: backtest.peakWinRate >= 50 ? 'var(--green)' : 'var(--amber)' },
              { label: t('home_bt_peak'), value: `+${backtest.avgPeakGain}%`, color: 'var(--green)' },
              { label: t('home_bt_best'), value: `+${backtest.best?.gain?.toFixed(0)}%`, sub: backtest.best?.symbol, color: 'var(--cyan)' },
            ].map((s) => (
              <div key={s.label} className="kpi-cell">
                <div className="kpi-label">{s.label}</div>
                <div className="kpi-val" style={{ color: s.color }}>
                  {s.value}
                  {s.sub && <span style={{ fontSize: '0.6rem', color: 'var(--text-3)', marginLeft: 4 }}>{s.sub}</span>}
                </div>
              </div>
            ))}
            <div style={{ display: 'flex', alignItems: 'center', padding: '0 14px', color: 'var(--text-3)', fontSize: '0.7rem', whiteSpace: 'nowrap' }}>
              {t('home_bt_proof')}
            </div>
          </div>
        )}
      </section>

      {/* ── LIVE OPPORTUNITIES ── */}
      <section style={{ marginBottom: 36 }}>
        <div className="section-head">
          <h2>
            🔥 {t('home_opps_title')}
            {clusters.length > 0 && (
              <span className="badge badge-red" style={{ marginLeft: 6 }}>{clusters.length} {t('home_active')}</span>
            )}
          </h2>
          {clusters.length > 0 && (
            <span style={{ fontSize: '0.78rem', color: 'var(--text-3)' }}>
              <span style={{ color: 'var(--green)', fontWeight: 700 }}>${fmtNum(totalInflow)}</span> {t('clp_combined_inflow').toLowerCase()}
            </span>
          )}
        </div>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[1, 2, 3].map(i => (
              <div key={i} style={{
                height: 90, borderRadius: 'var(--r-lg)',
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                animation: 'pulse 1.5s ease-in-out infinite',
                animationDelay: `${i * 0.1}s`,
              }} />
            ))}
          </div>
        ) : clusters.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">🎯</div>
            <div className="empty-state-title">{t('home_no_clusters')}</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <AnimatePresence>
              {clusters.slice(0, 5).map((c, idx) => {
                const color = convColor(c.confidenceScore)
                const oppScore = c.opportunityScore || c.confidenceScore || 0
                return (
                  <motion.div key={c.id}
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }}
                    style={{
                      background: `linear-gradient(90deg, ${color}08 0%, var(--bg-card) 20%)`,
                      border: `1px solid ${color}30`,
                      borderLeft: `3px solid ${color}`,
                      borderRadius: 'var(--r-lg)',
                      padding: '16px 18px',
                      display: 'grid',
                      gridTemplateColumns: 'auto 1fr auto',
                      gap: 16, alignItems: 'center',
                      cursor: 'pointer',
                      transition: 'background var(--t)',
                    }}
                    onClick={() => navigate(`/token/${c.token.address}`)}
                    onMouseEnter={e => e.currentTarget.style.background = `linear-gradient(90deg, ${color}12 0%, var(--bg-card) 40%)`}
                    onMouseLeave={e => e.currentTarget.style.background = `linear-gradient(90deg, ${color}08 0%, var(--bg-card) 20%)`}
                  >
                    {/* Score ring */}
                    <ConvictionRing score={c.confidenceScore} color={color} />

                    {/* Info */}
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '1.1rem', fontWeight: 900 }}>
                          {c.walletCount} wallets → <span style={{ color }}>{c.token.symbol}</span>
                        </span>
                        <UrgencyBadge score={c.urgencyScore} minsAgo={c.minsAgo} />
                      </div>
                      {c.followedLabel && (
                        <div style={{
                          display: 'inline-flex', alignItems: 'center', gap: 6,
                          padding: '3px 10px', marginBottom: 8,
                          borderRadius: 999,
                          background: c.followedColor === 'green' ? 'rgba(0,229,148,0.10)'
                                    : c.followedColor === 'red'   ? 'rgba(255,59,107,0.10)'
                                    : 'rgba(255,255,255,0.05)',
                          border: `1px solid ${c.followedColor === 'green' ? 'rgba(0,229,148,0.35)' : c.followedColor === 'red' ? 'rgba(255,59,107,0.35)' : 'rgba(255,255,255,0.10)'}`,
                          color:  c.followedColor === 'green' ? 'var(--green, #00E594)'
                                : c.followedColor === 'red'   ? 'var(--red, #FF3B6B)'
                                : 'var(--text-2)',
                          fontSize: '0.72rem', fontWeight: 800, fontFamily: 'var(--mono)',
                        }}>
                          📈 If you followed: {c.followedLabel}
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                        <div>
                          <div style={{ fontSize: '0.6rem', color: 'var(--text-3)', textTransform: 'uppercase', fontWeight: 700 }}>{t('home_combined')}</div>
                          <div style={{ fontSize: '0.95rem', color: 'var(--green)', fontFamily: 'var(--mono)', fontWeight: 800 }}>${fmtNum(c.totalInflowUSD)}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: '0.6rem', color: 'var(--text-3)', textTransform: 'uppercase', fontWeight: 700 }}>{t('home_avg_entry')}</div>
                          <div style={{ fontSize: '0.95rem', color: 'var(--text-2)', fontFamily: 'var(--mono)', fontWeight: 700 }}>{c.avgEntryPrice && c.avgEntryPrice !== '0.00' ? `$${c.avgEntryPrice}` : '—'}</div>
                        </div>
                        {c.currentPrice && c.currentPrice !== c.avgEntryPrice && (
                          <div>
                            <div style={{ fontSize: '0.6rem', color: 'var(--text-3)', textTransform: 'uppercase', fontWeight: 700 }}>{t('home_now')}</div>
                            <div style={{ fontSize: '0.95rem', color: 'var(--cyan)', fontFamily: 'var(--mono)', fontWeight: 700 }}>${c.currentPrice}</div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right: Opportunity Score + Actions */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
                      <OpportunityScore score={oppScore} />
                      <div style={{ display: 'flex', gap: 6 }}>
                        <a href={uniswapUrl(c.token.address)} target="_blank" rel="noopener noreferrer"
                          className="btn btn-green btn-sm"
                          onClick={e => e.stopPropagation()}
                        >
                          {t('home_copy')}
                        </a>
                        <button className="btn btn-ghost btn-sm"
                          onClick={e => { e.stopPropagation(); navigate(`/token/${c.token.address}`) }}>
                          {t('home_token_intel')}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </AnimatePresence>

            {clusters.length > 5 && (
              <button className="btn btn-ghost" style={{ alignSelf: 'center', marginTop: 4 }}
                onClick={() => navigate('/clusters')}>
                {t('home_view_all')} {clusters.length} {t('home_clusters_word')} →
              </button>
            )}
          </div>
        )}
      </section>

      {/* ── RECENT WINNERS ── */}
      {winners.length > 0 && (
        <section style={{ marginBottom: 32 }}>
          <div className="section-head">
            <h2>{t('home_winners')}</h2>
            <span className="section-head-action" onClick={() => navigate('/proof')}>
              {t('home_see_proof')}
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(winners.length, 4)}, 1fr)`, gap: 10 }}>
            {winners.map(w => (
              <div key={w.tokenAddress}
                onClick={() => navigate(`/token/${w.tokenAddress}`)}
                style={{
                  background: 'var(--bg-card)', border: '1px solid var(--border)',
                  borderTop: '2px solid var(--green)', borderRadius: 'var(--r-lg)',
                  padding: '14px', cursor: 'pointer', textAlign: 'center',
                  transition: 'all var(--t)',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--green)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.transform = '' }}
              >
                <div style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: 4 }}>{w.tokenSymbol}</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 900, fontFamily: 'var(--mono)', color: 'var(--green)', lineHeight: 1 }}>
                  +{w.peakGain.toFixed(0)}%
                </div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-3)', marginTop: 5 }}>
                  {fmt.daysAgo(w.daysAgo)} · {w.walletCount}w
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── RECENT ACTIVITY ── */}
      {!loading && feed.length > 0 && (
        <section>
          <div className="section-head">
            <h2>📡 {t('home_recent_act')}</h2>
            <span className="section-head-action" onClick={() => navigate('/signal-history')}>
              {t('home_see_history')}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {feed.slice(0, 8).map((item) => {
              const buy = item.action ? item.action === 'BUY' : /accumulated/.test(item.text)
              const verb = buy ? t('home_feed_bought') : t('home_feed_sold')
              const line = item.label
                ? `${item.label} ${verb} $${fmtNum(item.usdValue)} ${t('home_feed_of')} ${item.tokenSymbol}`
                : item.text
              return (
                <div key={item.id}
                  className="feed-item"
                  onClick={() => item.tokenAddress && navigate(`/token/${item.tokenAddress}`)}>
                  <div className={`feed-dot ${buy ? 'feed-dot-buy' : 'feed-dot-sell'}`} />
                  <span className="feed-text truncate">{line}</span>
                  <span className="feed-time">{fmt.ago(item.minsAgo)}</span>
                  <span className="feed-alpha" style={{ color: item.alphaScore >= 45 ? 'var(--green)' : 'var(--text-3)' }}>
                    α{item.alphaScore}
                  </span>
                </div>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}
