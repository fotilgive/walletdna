import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { fmtNum } from '../utils/format'
import { useT, useFmt } from '../utils/i18n'

function Tile({ label, value, sub, color = 'var(--text-1)' }) {
  return (
    <div style={{ minWidth: 90 }}>
      <div style={{ fontSize: '0.6rem', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 700, marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: '1.15rem', fontWeight: 800, fontFamily: 'var(--mono)', color, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: '0.65rem', color: 'var(--text-3)', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

function Pct({ pct, bold }) {
  if (pct === null || pct === undefined) return <span style={{ color: 'var(--text-3)' }}>—</span>
  const color = pct >= 0 ? 'var(--green)' : 'var(--red)'
  return <span style={{ color, fontFamily: 'var(--mono)', fontWeight: bold ? 900 : 700 }}>{pct >= 0 ? '+' : ''}{pct.toFixed(1)}%</span>
}

function PeakBadge({ pct }) {
  if (pct >= 100) return <span style={{ background: 'rgba(0,255,148,0.15)', color: 'var(--green)', padding: '2px 8px', borderRadius: 4, fontSize: '0.7rem', fontWeight: 800 }}>🔥 {pct.toFixed(0)}%</span>
  if (pct >= 50)  return <span style={{ background: 'rgba(0,255,148,0.12)', color: 'var(--green)', padding: '2px 8px', borderRadius: 4, fontSize: '0.7rem', fontWeight: 800 }}>+{pct.toFixed(0)}%</span>
  if (pct >= 20)  return <span style={{ background: 'rgba(0,229,255,0.12)', color: 'var(--cyan)', padding: '2px 8px', borderRadius: 4, fontSize: '0.7rem', fontWeight: 800 }}>+{pct.toFixed(0)}%</span>
  if (pct >= 0)   return <span style={{ background: 'rgba(255,184,0,0.1)', color: 'var(--amber)', padding: '2px 8px', borderRadius: 4, fontSize: '0.7rem', fontWeight: 800 }}>+{pct.toFixed(0)}%</span>
  return <span style={{ background: 'rgba(255,59,107,0.1)', color: 'var(--red)', padding: '2px 8px', borderRadius: 4, fontSize: '0.7rem', fontWeight: 800 }}>{pct.toFixed(0)}%</span>
}

export default function SignalHistory() {
  const navigate = useNavigate()
  const t = useT()
  const fmt = useFmt()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [sort, setSort] = useState('peak')

  useEffect(() => {
    fetch('/api/backtest').then(r => r.json()).then(d => { if (d.success) setData(d) }).finally(() => setLoading(false))
  }, [])

  const s = data?.summary
  const signals = data?.signals || []
  const sorted = [...signals].sort((a, b) => sort === 'peak' ? b.peakGain - a.peakGain : a.daysAgo - b.daysAgo)

  return (
    <div className="anim-fade-up" style={{ paddingBottom: 60 }}>

      <div style={{ marginBottom: 20 }}>
        <div className="eyebrow">📊 Signal History</div>
        <h1 style={{ fontSize: 'clamp(1.4rem, 2.5vw, 2rem)', fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1.1 }}>
          {t('sh_title_a')}<span className="gradient-text">{t('sh_title_b')}</span>{t('sh_title_c')}
        </h1>
      </div>

      {loading ? (
        <div className="loading-block">
          <div className="spinner" style={{ width: 28, height: 28 }} />
          Loading backtest data…
        </div>
      ) : !s ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-3)', background: 'var(--bg-1)', borderRadius: 'var(--r-lg)', border: '1px solid var(--border)' }}>
          {t('sh_not_computed')} <code style={{ color: 'var(--cyan)' }}>node scripts/backtest.js</code> {t('sh_to_populate')}
        </div>
      ) : (
        <>
          {/* Hero metric — avg peak gain. The "hit rate" + "best" support it.
              "If held to now" is a real but misleading number on its own (tokens peaked
              then corrected) so it goes into the secondary line below, not the headline grid. */}
          <div style={{
            display: 'flex', flexWrap: 'wrap', gap: 18, alignItems: 'flex-end',
            marginBottom: 18, padding: '20px 24px',
            background: 'linear-gradient(90deg, rgba(0,229,148,0.08), rgba(0,229,148,0.02))',
            border: '1px solid rgba(0,229,148,0.25)',
            borderRadius: 'var(--r-lg)',
          }}>
            <div>
              <div style={{ fontSize: '0.62rem', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700, marginBottom: 6 }}>
                {t('sh_avg_peak')}
              </div>
              <div style={{ fontSize: '2.6rem', fontWeight: 900, fontFamily: 'var(--mono)', color: 'var(--green)', lineHeight: 1 }}>
                +{s.avgPeakGain}%
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-3)', marginTop: 4 }}>
                {t('sh_median')} +{s.medianPeakGain}% · within 30 days of signal
              </div>
            </div>
            <div style={{ flexGrow: 1 }} />
            <Tile label={t('sh_hit')}   value={`${s.peakWinRate}%`}
                  color={s.peakWinRate >= 40 ? 'var(--green)' : 'var(--amber)'} />
            <Tile label={t('sh_best')}  value={`+${s.best.gain.toFixed(0)}%`} sub={s.best.symbol} color="var(--cyan)" />
            <Tile label={t('sh_tracked')} value={s.sampleSize} color="var(--text-1)" />
          </div>

          <div className="hint-box" style={{ marginBottom: 18 }}>
            <span className="hint-icon">💡</span>
            <span>
              <strong style={{ color: 'var(--green)' }}>{s.peakWinRate}% hit +20% within 30 days</strong>
              {' · '}avg peak <strong style={{ color: 'var(--green)' }}>+{s.avgPeakGain}%</strong>
              {' · '}<span style={{ color: 'var(--text-3)' }}>if you'd never sold and held to today: {s.avgHoldReturn}% (most tokens peaked then corrected)</span>
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-3)' }}>{signals.length} signals</span>
            <div className="tab-group">
              {[['peak', '🔥 Top Gains'], ['recent', '🕐 Recent']].map(([k, lbl]) => (
                <button key={k} className={`tab-btn ${sort === k ? 'active' : ''}`} onClick={() => setSort(k)}>{lbl}</button>
              ))}
            </div>
          </div>

          <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr 1fr 0.8fr auto', gap: 12, padding: '12px 20px', borderBottom: '1px solid var(--border)', background: 'var(--bg-1)' }}>
              {[t('sh_token'), t('sh_signal'), t('sh_entry'), t('sh_peak'), t('sh_now'), ''].map((h, i) => (
                <div key={i} style={{ fontSize: '0.66rem', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>{h}</div>
              ))}
            </div>
            {sorted.map((sig, idx) => (
              <motion.div key={sig.tokenAddress}
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: Math.min(idx * 0.02, 0.5) }}
                style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr 1fr 0.8fr auto', gap: 12, padding: '12px 20px', borderBottom: '1px solid var(--border)', alignItems: 'center', cursor: 'pointer' }}
                onClick={() => navigate(`/token/${sig.tokenAddress}`)}>
                <div>
                  <div style={{ fontWeight: 800, color: 'var(--text-1)' }}>{sig.tokenSymbol}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-3)' }}>{sig.daysAgo}{t('time_d')} {t('time_ago')}</div>
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--purple)', fontWeight: 700 }}>
                  {sig.walletCount} {sig.walletCount === 1 ? t('sh_wallet') : t('sh_wallets')}
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-3)', fontWeight: 600 }}>${fmtNum(sig.totalInflow)}</div>
                </div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-2)', fontFamily: 'var(--mono)' }}>
                  ${sig.entryPrice < 0.001 ? sig.entryPrice.toFixed(7) : sig.entryPrice.toFixed(4)}
                </div>
                <div><PeakBadge pct={sig.peakGain} /></div>
                <div style={{ fontSize: '0.85rem' }}><Pct pct={sig.currentPct} /></div>
                <div style={{ color: 'var(--text-3)', fontSize: '0.9rem' }}>→</div>
              </motion.div>
            ))}
          </div>

          <div style={{ marginTop: 16, fontSize: '0.75rem', color: 'var(--text-3)', textAlign: 'center' }}>
            {t('sh_footer')}
          </div>
        </>
      )}
    </div>
  )
}
