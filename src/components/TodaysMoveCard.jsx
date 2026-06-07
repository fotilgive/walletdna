import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch } from '../utils/api'

/**
 * TodaysMoveCard — single actionable trading card.
 *
 * Pulls /api/today-move. Shows the highest-composite cluster as an actionable
 * plan: entry zone, stop loss, three targets, position sizing rule of thumb.
 *
 * The whole point: prove the buyer can act on the signal in 60 seconds.
 */
export default function TodaysMoveCard() {
  const navigate = useNavigate()
  const [data, setData] = useState(null)

  useEffect(() => {
    let alive = true
    const load = async () => {
      try {
        const r = await apiFetch('/api/today-move')
        const d = await r.json()
        if (alive && d.success) setData(d)
      } catch {}
    }
    load()
    const id = setInterval(load, 60_000)
    return () => { alive = false; clearInterval(id) }
  }, [])

  if (!data || !data.move) return null

  const m = data.move
  const riskColor = m.riskGate?.level === 'LOW'  ? 'var(--green, #00E594)'
                  : m.riskGate?.level === 'HIGH' ? 'var(--red, #FF3B6B)'
                  : 'var(--amber, #FFB800)'
  const riskEmoji = m.riskGate?.level === 'LOW' ? '🟢' : m.riskGate?.level === 'HIGH' ? '🔴' : '🟡'

  return (
    <div style={{
      marginBottom: 26,
      borderRadius: 'var(--r-lg)',
      border: '2px solid var(--purple)',
      background: 'linear-gradient(135deg, rgba(181,74,255,0.10), rgba(0,229,148,0.04))',
      boxShadow: '0 0 60px rgba(181,74,255,0.15)',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '14px 22px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        background: 'rgba(181,74,255,0.10)',
        flexWrap: 'wrap',
      }}>
        <span style={{
          fontSize: '0.66rem', color: 'var(--purple)', fontWeight: 900,
          letterSpacing: '0.12em', textTransform: 'uppercase',
        }}>
          🎯 Today's Top Move
        </span>
        <span style={{
          fontSize: '0.7rem', padding: '3px 10px', borderRadius: 999,
          background: 'rgba(0,229,148,0.15)', color: 'var(--green)',
          fontWeight: 800, letterSpacing: '0.05em',
        }}>
          {m.action}
        </span>
        <span style={{
          fontSize: '0.7rem', padding: '3px 10px', borderRadius: 999,
          background: `${riskColor}20`, color: riskColor,
          fontWeight: 800, letterSpacing: '0.05em',
        }}>
          {riskEmoji} {m.riskGate?.level || 'MEDIUM'} RISK
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-3)', fontWeight: 700 }}>
            Conviction <span style={{ color: 'var(--cyan)', fontFamily: 'var(--mono)', fontWeight: 900 }}>{m.confidence}/100</span>
          </span>
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: '20px 22px', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 22, alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: '0.66rem', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 800, marginBottom: 6 }}>
            Token
          </div>
          <div style={{ fontSize: '2.0rem', fontWeight: 900, letterSpacing: '-0.02em', display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
            ${m.symbol}
            <span style={{ fontSize: '0.85rem', color: 'var(--text-3)', fontWeight: 600 }}>{m.tokenName}</span>
          </div>

          <div style={{ marginTop: 10, fontSize: '0.85rem', color: 'var(--text-2)', lineHeight: 1.5 }}>
            <strong style={{ color: 'var(--cyan)' }}>{m.smartMoneyCount}</strong> verified alpha wallets converging
            {' · '}
            <strong style={{ color: 'var(--green)', fontFamily: 'var(--mono)' }}>
              ${m.smartMoneyCapital.toLocaleString()}
            </strong> deployed
            {m.followedLabel && (
              <>
                {' · '}
                <span style={{ color: m.followedColor === 'green' ? 'var(--green)' : m.followedColor === 'red' ? 'var(--red)' : 'var(--amber)', fontFamily: 'var(--mono)', fontWeight: 800 }}>
                  {m.followedLabel}
                </span>
              </>
            )}
          </div>

          {/* Why now — concrete bullets, no marketing copy */}
          {m.whyNow?.length > 0 && (
            <div style={{
              marginTop: 16,
              padding: '12px 16px',
              background: 'rgba(0,0,0,0.25)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--r-md)',
            }}>
              <div style={{ fontSize: '0.62rem', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 800, marginBottom: 8 }}>
                Why now
              </div>
              <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 5 }}>
                {m.whyNow.map((b, i) => (
                  <li key={i} style={{ display: 'flex', gap: 8, fontSize: '0.82rem', color: 'var(--text-2)', lineHeight: 1.45 }}>
                    <span style={{ color: 'var(--cyan)', fontWeight: 900 }}>•</span>
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Trade plan grid */}
          <div style={{
            marginTop: 18,
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
            gap: 10,
          }}>
            <PlanCell label="Entry" value={`$${m.entryLow} – $${m.entryHigh}`} color="var(--text-1)" />
            <PlanCell label="Now"   value={`$${m.currentPrice}`} color="var(--cyan)" />
            <PlanCell label="Stop loss"     value={`$${m.stopLoss}`} color="var(--red)" sub="-15%" />
            {m.targets?.[0] && <PlanCell label="Target 1" value={`$${m.targets[0]}`} color="var(--green)" sub="+25%" />}
            {m.targets?.[1] && <PlanCell label="Target 2" value={`$${m.targets[1]}`} color="var(--green)" sub="+50%" />}
            {m.targets?.[2] && <PlanCell label="Target 3" value={`$${m.targets[2]}`} color="var(--green)" sub="+100%" />}
          </div>

          {/* Sizing */}
          <div style={{
            marginTop: 16,
            padding: '12px 14px',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--r-md)',
          }}>
            <div style={{ fontSize: '0.62rem', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 800, marginBottom: 8 }}>
              Suggested position sizing — never risk more than 5% per signal
            </div>
            <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', fontSize: '0.84rem' }}>
              {m.sizingExamples.map(s => (
                <div key={s.bankroll}>
                  <span style={{ color: 'var(--text-3)' }}>Bankroll </span>
                  <span style={{ color: 'var(--text-1)', fontFamily: 'var(--mono)', fontWeight: 700 }}>${s.bankroll.toLocaleString()}</span>
                  <span style={{ color: 'var(--text-3)' }}> → use </span>
                  <span style={{ color: 'var(--green)', fontFamily: 'var(--mono)', fontWeight: 800 }}>${s.recommended.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 10, marginTop: 18, flexWrap: 'wrap' }}>
            <a href={m.uniswapUrl} target="_blank" rel="noopener noreferrer"
              style={{
                padding: '10px 18px', borderRadius: 'var(--r-md)',
                background: 'var(--purple)', color: '#fff',
                fontWeight: 800, fontSize: '0.88rem', textDecoration: 'none',
                boxShadow: '0 0 16px rgba(181,74,255,0.4)',
              }}>
              Buy on Uniswap →
            </a>
            <a href={m.dexscreenerUrl} target="_blank" rel="noopener noreferrer"
              style={{
                padding: '10px 18px', borderRadius: 'var(--r-md)',
                background: 'transparent', border: '1px solid var(--border)',
                color: 'var(--text-2)', fontWeight: 700, fontSize: '0.88rem',
                textDecoration: 'none',
              }}>
              DexScreener chart
            </a>
            <button
              onClick={() => navigate(`/token/${m.tokenAddress}`)}
              style={{
                padding: '10px 18px', borderRadius: 'var(--r-md)',
                background: 'transparent', border: '1px solid var(--border)',
                color: 'var(--text-2)', fontWeight: 700, fontSize: '0.88rem', cursor: 'pointer',
              }}>
              Full intel →
            </button>
          </div>
        </div>

        {/* Conviction ring (right) */}
        <ConvictionBig score={m.confidence} />
      </div>
    </div>
  )
}

function PlanCell({ label, value, color, sub }) {
  return (
    <div style={{
      padding: '8px 10px', borderRadius: 'var(--r-md)',
      background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)',
    }}>
      <div style={{ fontSize: '0.58rem', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 800 }}>
        {label}{sub && <span style={{ marginLeft: 5, color }}>{sub}</span>}
      </div>
      <div style={{ fontSize: '0.95rem', fontFamily: 'var(--mono)', fontWeight: 800, color }}>
        {value}
      </div>
    </div>
  )
}

function ConvictionBig({ score }) {
  const r = 38
  const C = 2 * Math.PI * r
  const offset = C - (score / 100) * C
  const color = score >= 75 ? 'var(--green)' : score >= 50 ? 'var(--cyan)' : 'var(--amber)'
  return (
    <div style={{ position: 'relative', width: 96, height: 96, display: 'none' }} className="conv-big-show-on-wide">
      <svg width="96" height="96" viewBox="0 0 96 96" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="48" cy="48" r={r} stroke="rgba(255,255,255,0.07)" strokeWidth="6" fill="none" />
        <circle cx="48" cy="48" r={r} stroke={color} strokeWidth="6" fill="none"
          strokeDasharray={C} strokeDashoffset={offset} strokeLinecap="round" />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
        <div style={{ fontSize: '1.4rem', fontWeight: 900, color, fontFamily: 'var(--mono)', lineHeight: 1 }}>{score}</div>
        <div style={{ fontSize: '0.55rem', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>conviction</div>
      </div>
    </div>
  )
}
