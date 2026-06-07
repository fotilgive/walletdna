import React from 'react'
import { fmtTime } from '../utils/format'
import { useT } from '../utils/i18n'


const TYPE_META = {
  WHALE_BUY:     { bg: 'rgba(0,229,255,0.08)', border: 'rgba(0,229,255,0.2)', label: 'WHALE BUY', c: 'var(--cyan)' },
  SMART_ENTRY:   { bg: 'rgba(181,74,255,0.08)', border: 'rgba(181,74,255,0.2)', label: 'SMART ENTRY', c: 'var(--purple)' },
  ACCUMULATION:  { bg: 'rgba(0,255,148,0.08)', border: 'rgba(0,255,148,0.2)', label: 'ACCUMULATION', c: 'var(--green)' },
  LARGE_TRANSFER:{ bg: 'rgba(255,184,0,0.08)', border: 'rgba(255,184,0,0.2)', label: 'LARGE TRANSFER', c: 'var(--amber)' },
  DEX_SPIKE:     { bg: 'rgba(255,107,53,0.08)', border: 'rgba(255,107,53,0.2)', label: 'DEX SPIKE', c: 'var(--orange)' },
}

export default function SignalCard({ signal, compact = false }) {
  const t = useT()
  const meta = TYPE_META[signal.type] || TYPE_META.WHALE_BUY
  const label = meta.label || signal.type

  if (compact) {
    return (
      <div className="signal-item">
        <div style={{ fontSize: '1.3rem' }}>{signal.emoji}</div>
        <div className="signal-body">
          <div className="signal-title">
            <span style={{ color: meta.c, fontFamily: 'var(--mono)', fontSize: '0.75rem', marginRight: 8 }}>
              {label}
            </span>
            <strong>{signal.token}</strong> · {signal.amount}
          </div>
          <div className="signal-sub">{signal.wallet} · {signal.chain}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-3)' }}>{signal.minsAgo}m ago</div>
          <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
            <div style={{ width: 40, height: 3, background: 'rgba(255,255,255,0.05)', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ width: `${signal.significance}%`, height: '100%', background: meta.c, borderRadius: 2 }} />
            </div>
            <span style={{ fontSize: '0.68rem', color: 'var(--text-3)', fontFamily: 'var(--mono)' }}>{signal.significance}</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      background: meta.bg,
      border: `1px solid ${meta.border}`,
      borderRadius: 'var(--r-md)',
      padding: '16px 18px',
      display: 'flex', alignItems: 'center', gap: 14,
      transition: 'var(--t)',
    }}>
      <div style={{ fontSize: '1.6rem' }}>{signal.emoji}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span style={{
            background: meta.c, color: '#04040d', fontSize: '0.68rem',
            fontWeight: 800, padding: '2px 7px', borderRadius: 4, fontFamily: 'var(--mono)'
          }}>{label}</span>
          <strong style={{ fontSize: '0.95rem' }}>{signal.token}</strong>
          <span style={{ color: 'var(--text-2)', fontSize: '0.85rem' }}>— {signal.amount}</span>
        </div>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-2)', fontFamily: 'var(--mono)' }}>
          {signal.wallet} · {signal.chain} · {signal.minsAgo}m ago
        </div>
      </div>
      <div style={{
        background: 'rgba(255,255,255,0.04)', padding: '6px 12px',
        borderRadius: 'var(--r-sm)', textAlign: 'center', flexShrink: 0
      }}>
        <div style={{ fontSize: '1.1rem', fontWeight: 800, fontFamily: 'var(--mono)', color: meta.c }}>{signal.significance}</div>
        <div style={{ fontSize: '0.65rem', color: 'var(--text-3)' }}>{t('sc_signal_label')}</div>
      </div>
    </div>
  )
}

