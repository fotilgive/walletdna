import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch } from '../utils/api'

/**
 * LiveTicker — top-bar marquee of last quality wallet trades.
 *
 * Pulls /api/ticker every 60s. Shows BUY/SELL by tracked alpha wallets,
 * USD amount, token, alpha score, mins ago. Each chip clickable → /token/:addr.
 *
 * The point: prove the engine is alive *and* prove the wallets are not asleep.
 */

function fmtUsd(n) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(1)}K`
  return `$${n}`
}

function fmtMins(m) {
  if (m < 60)   return `${m}m`
  if (m < 1440) return `${Math.round(m / 60)}h`
  return `${Math.round(m / 1440)}d`
}

export default function LiveTicker() {
  const navigate = useNavigate()
  const [items, setItems] = useState([])
  const railRef = useRef(null)

  useEffect(() => {
    let alive = true
    const load = async () => {
      try {
        const r = await apiFetch('/api/ticker')
        const d = await r.json()
        if (alive && d.success) setItems(d.ticker || [])
      } catch {}
    }
    // Load immediately on mount
    load()
    // Then poll every 15s for fresh trades
    const id = setInterval(load, 15_000)
    return () => { alive = false; clearInterval(id) }
  }, [])

  if (items.length === 0) return null

  // Double the list for seamless marquee loop.
  const reel = [...items, ...items]

  return (
    <div style={{
      borderBottom: '1px solid var(--border)',
      background: 'linear-gradient(90deg, rgba(0,229,148,0.04), rgba(181,74,255,0.04))',
      overflow: 'hidden',
      position: 'relative',
    }}>
      <style>{`
        @keyframes wd-ticker {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes wd-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
        .wd-ticker-rail { display: inline-flex; gap: 18px; padding: 8px 0; animation: wd-ticker 90s linear infinite; }
        .wd-ticker-rail:hover { animation-play-state: paused; }
        .wd-live-badge { 
          display: inline-flex; align-items: center; gap: 4px;
          padding: 3px 8px; background: rgba(0,229,148,0.15); 
          border-radius: 999px; font-size: 0.65rem; font-weight: 700;
          color: var(--green, #00E594);
        }
        .wd-live-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--green, #00E594); animation: wd-pulse 2s ease-in-out infinite; }
      `}</style>
      <div style={{
        padding: '6px 16px', fontSize: '0.7rem', color: 'var(--text-3)',
        display: 'flex', alignItems: 'center', gap: 12,
        background: 'rgba(0,0,0,0.3)',
      }}>
        <div className="wd-live-badge">
          <div className="wd-live-dot" />
          LIVE
        </div>
        <span>Smart money trades from top alpha wallets</span>
      </div>
      <div style={{
        position: 'absolute', top: 0, bottom: 0, left: 0, width: 80,
        background: 'linear-gradient(90deg, var(--bg-0), transparent)',
        pointerEvents: 'none', zIndex: 2,
      }} />
      <div style={{
        position: 'absolute', top: 0, bottom: 0, right: 0, width: 80,
        background: 'linear-gradient(-90deg, var(--bg-0), transparent)',
        pointerEvents: 'none', zIndex: 2,
      }} />
      <div ref={railRef} style={{ whiteSpace: 'nowrap', display: 'flex' }}>
        <div className="wd-ticker-rail">
          {reel.map((it, idx) => {
            const isBuy = it.type === 'BUY'
            const color = isBuy ? 'var(--green, #00E594)' : 'var(--red, #FF3B6B)'
            return (
              <div
                key={`${it.address}-${it.symbol}-${idx}`}
                onClick={() => it.tokenAddress && navigate(`/token/${it.tokenAddress}`)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  padding: '4px 12px', borderRadius: 999,
                  background: 'rgba(255,255,255,0.03)',
                  border: `1px solid ${color}22`,
                  fontSize: '0.74rem', fontWeight: 700,
                  whiteSpace: 'nowrap', cursor: 'pointer',
                }}
              >
                <span style={{ color, fontSize: '0.65rem', fontWeight: 900 }}>
                  {isBuy ? '🟢 BUY' : '🔴 SELL'}
                </span>
                <span style={{ color: 'var(--text-1)', fontFamily: 'var(--mono)' }}>
                  {fmtUsd(it.usd)}
                </span>
                <span style={{ color: 'var(--text-2)' }}>{it.symbol}</span>
                <span style={{ color: 'var(--text-3)', fontSize: '0.66rem' }}>
                  by {it.label} · α{it.alpha}
                </span>
                <span style={{ color: 'var(--text-3)', fontSize: '0.66rem', fontFamily: 'var(--mono)' }}>
                  {fmtMins(it.minsAgo)} ago
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
