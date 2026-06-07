import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch } from '../utils/api'

/**
 * RecentWins — horizontal scroller of recent positive signals.
 * Each chip: ${SYM} +X% in Yd · clickable → /token/:addr
 * Proves real wins keep landing.
 */
export default function RecentWins() {
  const navigate = useNavigate()
  const [wins, setWins] = useState([])

  useEffect(() => {
    let alive = true
    apiFetch('/api/recent-wins').then(r => r.json()).then(d => {
      if (alive && d.success) setWins(d.wins || [])
    }).catch(() => {})
    return () => { alive = false }
  }, [])

  if (wins.length === 0) return null

  return (
    <div style={{ marginBottom: 26 }}>
      <div style={{
        display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 10,
      }}>
        <div style={{ fontSize: '0.62rem', color: 'var(--green)', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          🏆 Recent Wins · last 60 days
        </div>
        <div style={{ fontSize: '0.7rem', color: 'var(--text-3)' }}>
          {wins.length} signals hit +20%+ peak
        </div>
      </div>
      <div style={{
        display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 6,
        scrollbarWidth: 'thin', msOverflowStyle: 'none',
      }}>
        {wins.map(w => (
          <div key={w.address}
            onClick={() => navigate(`/token/${w.address}`)}
            style={{
              flex: '0 0 auto',
              padding: '12px 16px',
              borderRadius: 'var(--r-md)',
              background: 'linear-gradient(135deg, rgba(0,229,148,0.10), rgba(0,229,148,0.02))',
              border: '1px solid rgba(0,229,148,0.30)',
              cursor: 'pointer',
              display: 'flex', flexDirection: 'column', gap: 4,
              minWidth: 170,
            }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontSize: '0.95rem', fontWeight: 900, color: 'var(--text-1)' }}>${w.symbol}</span>
              <span style={{ fontSize: '1.2rem', fontWeight: 900, fontFamily: 'var(--mono)', color: 'var(--green)' }}>
                +{w.peakGainPct}%
              </span>
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-3)', fontWeight: 700, fontFamily: 'var(--mono)' }}>
              Signal → {w.daysAgo === 1 ? '1 day' : `${w.daysAgo} days`} ago
            </div>
            <div style={{ fontSize: '0.65rem', color: 'var(--text-3)' }}>
              peaked {w.daysToPeak}d after signal
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
