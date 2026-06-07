import React, { useState, useEffect } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { fmtNum } from '../utils/format'
import { useT, useFmt } from '../utils/i18n'
import FreshnessPulse from '../components/FreshnessPulse'

const uniswapUrl = (addr) => `https://app.uniswap.org/swap?chain=base&outputCurrency=${addr}`

const VERDICT = {
  ACCUMULATING: { color: 'var(--green)', bg: 'rgba(0,255,148,0.1)', icon: '📈', labelKey: 'ti_acc' },
  DISTRIBUTING: { color: 'var(--red)', bg: 'rgba(255,59,107,0.1)', icon: '📉', labelKey: 'ti_dist' },
  MIXED: { color: 'var(--amber)', bg: 'rgba(255,184,0,0.1)', icon: '⚖️', labelKey: 'ti_mixed' },
}

const STANCE = {
  HOLDING: { color: 'var(--green)', labelKey: 'ti_holding' },
  EXITED: { color: 'var(--red)', labelKey: 'ti_exited' },
  TRIMMED: { color: 'var(--amber)', labelKey: 'ti_trimmed' },
}

function ScoreBar({ label, value, max, color }) {
  const pct = Math.round((value / max) * 100)
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: '0.72rem' }}>
        <span style={{ color: 'var(--text-3)', fontWeight: 600 }}>{label}</span>
        <span style={{ color, fontFamily: 'var(--mono)', fontWeight: 800 }}>{value}/{max}</span>
      </div>
      <div style={{ height: 5, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{
          width: `${pct}%`, height: '100%', borderRadius: 3,
          background: color, transition: 'width 0.6s ease',
        }} />
      </div>
    </div>
  )
}

function OpportunityScoreWidget({ details, color }) {
  const t = useT()
  if (!details || details.score === 0) return null
  const { score, clusterStrengthPoints, convictionPoints, holdingPoints, walletQualityPoints } = details
  const ring = 2 * Math.PI * 28
  const off = ring - (score / 100) * ring

  return (
    <div style={{
      background: 'var(--bg-card)', border: `1px solid ${color}30`,
      borderRadius: 'var(--r-lg)', padding: '20px 24px', marginBottom: 24,
    }}>
      <div style={{ fontSize: '0.75rem', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700, marginBottom: 16 }}>
        {t('ti_opp_title')}
      </div>
      <div style={{ display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
        {/* Score ring */}
        <div style={{ flexShrink: 0, position: 'relative', width: 70, height: 70 }}>
          <svg width="70" height="70" viewBox="0 0 70 70" style={{ transform: 'rotate(-90deg)' }}>
            <circle cx="35" cy="35" r="28" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
            <circle cx="35" cy="35" r="28" fill="none" stroke={color} strokeWidth="6"
              strokeLinecap="round" strokeDasharray={ring} strokeDashoffset={off}
              style={{ transition: 'stroke-dashoffset 0.8s ease' }} />
          </svg>
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center'
          }}>
            <span style={{ fontSize: '1.2rem', fontWeight: 900, fontFamily: 'var(--mono)', color, lineHeight: 1 }}>{score}</span>
            <span style={{ fontSize: '0.5rem', color: 'var(--text-3)', fontWeight: 700 }}>/100</span>
          </div>
        </div>

        {/* Sub-score bars */}
        <div style={{ flex: 1, minWidth: 200 }}>
          <ScoreBar label={t('ti_opp_cluster')} value={clusterStrengthPoints} max={40} color="var(--cyan)" />
          <ScoreBar label={t('ti_opp_conviction')} value={convictionPoints} max={30} color="var(--green)" />
          <ScoreBar label={t('ti_opp_holding')} value={holdingPoints} max={20} color="var(--amber)" />
          <ScoreBar label={t('ti_opp_quality')} value={walletQualityPoints} max={10} color="var(--purple)" />
        </div>
      </div>
    </div>
  )
}

export default function TokenIntel() {
  const { address: paramAddr } = useParams()
  const [search] = useSearchParams()
  const address = paramAddr || search.get('address')
  const navigate = useNavigate()
  const t = useT()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!address) return
    setLoading(true)
    fetch(`/api/token/${address}`).then(r => r.json()).then(setData).finally(() => setLoading(false))
  }, [address])

  if (loading) return (
    <div className="loading-block" style={{ minHeight: 300 }}>
      <div className="spinner" style={{ width: 28, height: 28 }} />
      {t('ti_loading')}
    </div>
  )

  if (!data?.found) return (
    <div className="empty-state" style={{ minHeight: 300 }}>
      <div className="empty-state-icon">🔍</div>
      <div className="empty-state-title">{t('ti_no_act')}</div>
      <div className="empty-state-sub">{t('ti_no_act_sub')}</div>
      <button className="btn btn-ghost" style={{ marginTop: 8 }} onClick={() => navigate('/audit?address=' + address)}>{t('ti_run_audit')}</button>
    </div>
  )

  const v = VERDICT[data.verdict] || VERDICT.MIXED
  const s = data.stats

  // Verdict reason string
  const netStr = `${s.netFlow >= 0 ? '+' : '-'}$${Math.abs(Math.round(s.netFlow)).toLocaleString()}`
  let verdictReason
  if (data.verdict === 'ACCUMULATING') verdictReason = `${s.holders}/${s.buyers} ${t('ti_r_holding')} ${netStr}`
  else if (data.verdict === 'DISTRIBUTING') verdictReason = `${s.exiters} ${t('ti_r_exited')} (${netStr})`
  else verdictReason = `${s.holders} ${t('ti_r_holding_w')}, ${s.exiters} ${t('ti_r_exited_w')} — ${t('ti_r_no_consensus')}`

  // Use server-generated whyItMatters if available, else local fallback
  const whyItMatters = data.whyItMatters?.length
    ? data.whyItMatters
    : [
        `${s.buyers} ${t('ti_w_acc')} ${data.symbol}`,
        `${t('ti_w_roi')} ${s.avgWalletRoi >= 0 ? '+' : ''}${Math.round(s.avgWalletRoi)}%`,
        `${t('ti_w_capital')} $${Math.round(s.totalBought).toLocaleString()}`,
        `${s.holders} ${t('ti_w_of')} ${s.buyers} ${t('ti_w_buyers')} ${t('ti_w_holding')}`,
        s.firstBuyDays > 0
          ? `${t('ti_w_first')} ${s.firstBuyDays}${t('time_d')} ${t('time_ago')}`
          : t('ti_w_today'),
      ]

  return (
    <div className="anim-fade-up" style={{ paddingBottom: 60 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700, marginBottom: 6 }}>{t('ti_eyebrow')}</div>
          <h1 style={{ fontSize: '2.2rem', fontWeight: 900, letterSpacing: '-0.03em', display: 'flex', alignItems: 'center', gap: 12 }}>
            {data.symbol}
            <span style={{ fontSize: '1rem', color: 'var(--text-3)', fontWeight: 600 }}>{data.name}</span>
          </h1>
          <div style={{ marginTop: 8 }}><FreshnessPulse /></div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <a href={uniswapUrl(data.address)} target="_blank" rel="noopener noreferrer"
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '11px 20px', borderRadius: 'var(--r-md)', background: 'var(--green)', color: '#000', fontWeight: 800, fontSize: '0.9rem', textDecoration: 'none', boxShadow: '0 0 16px rgba(0,255,148,0.3)' }}>
            {t('ti_copy')}
          </a>
          <button className="btn btn-ghost" onClick={() => navigate('/audit?address=' + data.address)}>{t('ti_audit')}</button>
        </div>
      </div>

      {/* VERDICT BANNER */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        style={{ background: v.bg, border: `1px solid ${v.color}40`, borderRadius: 'var(--r-lg)', padding: '24px 28px', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 20 }}>
        <div style={{ fontSize: '2.8rem', lineHeight: 1 }}>{v.icon}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 900, color: v.color, letterSpacing: '-0.02em', marginBottom: 4 }}>{t(v.labelKey)}</div>
          <div style={{ fontSize: '1rem', color: 'var(--text-2)' }}>{verdictReason}</div>
        </div>
        <div style={{ textAlign: 'center', paddingLeft: 20, borderLeft: `1px solid ${v.color}30` }}>
          <div style={{ fontSize: '2.4rem', fontWeight: 900, fontFamily: 'var(--mono)', color: v.color, lineHeight: 1 }}>{s.conviction}</div>
          <div style={{ fontSize: '0.62rem', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, marginTop: 4 }}>{t('ti_conviction')}</div>
        </div>
      </motion.div>

      {/* WHY THIS SIGNAL MATTERS */}
      {whyItMatters && (
        <div className="card card-p" style={{ marginBottom: 24, background: 'var(--bg-1)' }}>
          <div style={{ fontSize: '1rem', fontWeight: 800, marginBottom: 14 }}>
            {t('ti_why')}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '10px 24px' }}>
            {whyItMatters.map((reason, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: '0.92rem', color: 'var(--text-2)' }}>
                <span style={{ color: v.color, fontWeight: 900, flexShrink: 0 }}>✓</span>
                {reason}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* OPPORTUNITY SCORE WIDGET */}
      {s.opportunityDetails && (
        <OpportunityScoreWidget details={s.opportunityDetails} color={v.color} />
      )}

      {/* Stat grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 14, marginBottom: 24 }}>
        {[
          { label: t('ti_bought'), value: `$${fmtNum(s.totalBought)}`, color: 'var(--green)' },
          { label: t('ti_sold'), value: `$${fmtNum(s.totalSold)}`, color: 'var(--red)' },
          { label: t('ti_net'), value: `${s.netFlow >= 0 ? '+' : '-'}$${fmtNum(Math.abs(s.netFlow))}`, color: s.netFlow >= 0 ? 'var(--green)' : 'var(--red)' },
          { label: t('ti_avg_entry'), value: `$${s.avgEntry < 0.001 ? s.avgEntry.toExponential(2) : s.avgEntry.toFixed(s.avgEntry < 1 ? 5 : 2)}`, color: 'var(--text-1)' },
          s.currentPrice && { label: t('ti_current'), value: `$${s.currentPrice < 0.001 ? s.currentPrice.toExponential(2) : s.currentPrice.toFixed(s.currentPrice < 1 ? 5 : 2)}`, color: 'var(--cyan)' },
          s.unrealizedPct !== null && { label: t('ti_pnl'), value: `${s.unrealizedPct >= 0 ? '+' : ''}${s.unrealizedPct.toFixed(1)}%`, color: s.unrealizedPct >= 0 ? 'var(--green)' : 'var(--red)' },
        ].filter(Boolean).map(c => (
          <div key={c.label} className="card card-p-sm" style={{ background: 'var(--bg-1)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '0.66rem', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, marginBottom: 6 }}>{c.label}</div>
            <div style={{ fontSize: '1.3rem', fontWeight: 900, fontFamily: 'var(--mono)', color: c.color, lineHeight: 1 }}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* Backtest if available */}
      {data.backtest && (
        <div style={{ padding: '12px 18px', background: 'var(--bg-1)', border: '1px solid var(--border-bright)', borderRadius: 'var(--r-md)', marginBottom: 24, fontSize: '0.9rem', color: 'var(--text-2)' }}>
          {t('ti_bt_a')}{data.symbol}{t('ti_bt_b')}<strong style={{ color: 'var(--green)' }}>+{data.backtest.peakGain}%</strong>{t('ti_bt_c')}<strong style={{ color: data.backtest.currentPct >= 0 ? 'var(--green)' : 'var(--red)' }}>{data.backtest.currentPct >= 0 ? '+' : ''}{data.backtest.currentPct}%</strong>{t('ti_bt_d')}
        </div>
      )}

      {/* Wallet breakdown */}
      <div style={{ marginBottom: 14, fontSize: '1.1rem', fontWeight: 800 }}>
        {t('ti_whos_in')} <span style={{ color: 'var(--text-3)', fontSize: '0.85rem', fontWeight: 600 }}>· {data.wallets.length} {t('ti_smart_wallets')}</span>
      </div>
      <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr 1fr 1fr 0.9fr', gap: 12, padding: '12px 20px', borderBottom: '1px solid var(--border)', background: 'var(--bg-1)' }}>
          {[t('ti_wallet'), t('ti_th_bought'), t('ti_th_sold'), t('ti_net_col'), t('ti_stance')].map((h, i) => (
            <div key={i} style={{ fontSize: '0.66rem', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, textAlign: i > 0 && i < 4 ? 'right' : 'left' }}>{h}</div>
          ))}
        </div>
        {data.wallets.map((w) => {
          const st = STANCE[w.stance] || STANCE.TRIMMED
          return (
            <div key={w.address}
              onClick={() => navigate(`/profile/${w.address}`)}
              style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr 1fr 1fr 0.9fr', gap: 12, padding: '12px 20px', borderBottom: '1px solid var(--border)', alignItems: 'center', cursor: 'pointer', transition: 'background var(--t)' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontFamily: 'var(--mono)', fontSize: '0.7rem', color: 'var(--cyan)', fontWeight: 700 }}>α{w.alphaScore}</span>
                <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-1)' }}>{w.label}</span>
              </div>
              <div style={{ textAlign: 'right', fontFamily: 'var(--mono)', fontSize: '0.85rem', color: 'var(--green)' }}>${fmtNum(w.bought)}</div>
              <div style={{ textAlign: 'right', fontFamily: 'var(--mono)', fontSize: '0.85rem', color: w.sold > 0 ? 'var(--red)' : 'var(--text-3)' }}>{w.sold > 0 ? '$' + fmtNum(w.sold) : '—'}</div>
              <div style={{ textAlign: 'right', fontFamily: 'var(--mono)', fontSize: '0.85rem', fontWeight: 700, color: w.net >= 0 ? 'var(--green)' : 'var(--red)' }}>{w.net >= 0 ? '+' : '-'}${fmtNum(Math.abs(w.net))}</div>
              <div style={{ textAlign: 'left' }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 800, padding: '2px 8px', borderRadius: 4, background: `${st.color}18`, color: st.color }}>{t(st.labelKey)}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
