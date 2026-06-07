import React, { useEffect, useState, useCallback } from 'react'

/**
 * FreshnessPulse — proves the engine is alive without scaring users.
 *
 * Shows `🟢 N clusters · Discovery Xm ago · Sync Xm ago`.
 * "Last signal" was removed because tracked-wallet buys are bursty and showing
 * "5h ago" reads as dead even when discovery and sync ran 10 minutes ago.
 *
 * Colors track the freshest of (discovery, sync):
 *   green < 90min · amber < 6h · red ≥ 6h.
 *
 * Pulls /api/stats every 30s.
 */

function color(mins) {
  if (mins == null) return 'var(--text-3)'
  if (mins < 90)  return 'var(--green, #00E594)'
  if (mins < 360) return 'var(--amber, #FFB800)'
  return 'var(--red, #FF3B6B)'
}

function fmt(mins) {
  if (mins == null) return '—'
  if (mins < 1)    return 'just now'
  if (mins < 60)   return `${mins}m ago`
  if (mins < 1440) return `${Math.round(mins / 60)}h ago`
  return `${Math.round(mins / 1440)}d ago`
}

export default function FreshnessPulse({ compact = false }) {
  const [data, setData] = useState(null)

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/stats')
      const d = await r.json()
      setData(d)
    } catch {}
  }, [])

  useEffect(() => {
    load()
    const id = setInterval(load, 30_000)
    return () => clearInterval(id)
  }, [load])

  const sync     = data?.lastSyncMinsAgo
  const disc     = data?.lastDiscoveryMinsAgo
  const clusters = data?.activeClusters ?? 0

  // Worst of sync/discovery sets dot color. Clusters > 0 keeps it green
  // regardless because there's actively something happening.
  const worst = Math.max(sync ?? 0, disc ?? 0)
  const dotColor = clusters > 0 ? 'var(--green, #00E594)' : color(worst)

  if (compact) {
    return (
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-2)',
        letterSpacing: '0.05em', textTransform: 'uppercase',
      }}>
        <PulseDot color={dotColor} />
        <span style={{ color: dotColor, fontFamily: 'var(--mono)' }}>{clusters}</span>
        <span style={{ color: 'var(--text-3)' }}>active clusters</span>
      </div>
    )
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 14,
      padding: '7px 12px', borderRadius: 999,
      background: 'rgba(255,255,255,0.04)',
      border: `1px solid ${dotColor}33`,
      fontSize: '0.72rem', fontWeight: 700,
      letterSpacing: '0.05em', textTransform: 'uppercase',
      whiteSpace: 'nowrap',
    }}>
      <PulseDot color={dotColor} />
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
        <span style={{ color: dotColor, fontFamily: 'var(--mono)' }}>{clusters}</span>
        <span style={{ color: 'var(--text-3)' }}>active clusters</span>
      </span>
      <Sep />
      <Tick label="discovery" mins={disc} />
      <Sep />
      <Tick label="sync"      mins={sync} />
    </div>
  )
}

function Tick({ label, mins }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
      <span style={{ color: 'var(--text-3)' }}>{label}</span>
      <span style={{ color: color(mins), fontFamily: 'var(--mono)' }}>{fmt(mins)}</span>
    </span>
  )
}

function Sep() {
  return <span style={{ color: 'var(--text-3)', opacity: 0.4 }}>·</span>
}

function PulseDot({ color }) {
  return (
    <span style={{
      width: 9, height: 9, borderRadius: '50%',
      background: color, boxShadow: `0 0 0 0 ${color}`,
      animation: 'wd-pulse 1.6s infinite',
    }}>
      <style>{`
        @keyframes wd-pulse {
          0%   { box-shadow: 0 0 0 0 currentColor; }
          70%  { box-shadow: 0 0 0 8px transparent; }
          100% { box-shadow: 0 0 0 0 transparent; }
        }
      `}</style>
    </span>
  )
}
