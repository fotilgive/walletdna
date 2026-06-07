import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fmtNum, fmtPrice, pctClass, pctStr, scoreClass, scoreColor } from '../utils/format'
import { useT } from '../utils/i18n'

function computeScore(token) {
  const factors = []
  let s = 90
  if (token.liquidity < 5000) {
    s -= 40; factors.push({ label: 'Liquidity', ok: false, note: `$${fmtNum(token.liquidity)} — very low` })
  } else if (token.liquidity < 25000) {
    s -= 15; factors.push({ label: 'Liquidity', ok: false, note: `$${fmtNum(token.liquidity)} — low` })
  } else {
    factors.push({ label: 'Liquidity', ok: true, note: `$${fmtNum(token.liquidity)}` })
  }
  if (token.volume24h < 1000) {
    s -= 10; factors.push({ label: 'Volume', ok: false, note: `$${fmtNum(token.volume24h)} — low` })
  } else {
    factors.push({ label: 'Volume', ok: true, note: `$${fmtNum(token.volume24h)}` })
  }
  if (token.change24h < -20) {
    s -= 15; factors.push({ label: 'Price 24h', ok: false, note: `${token.change24h?.toFixed(1)}% drop` })
  } else if (token.change24h > 150) {
    s -= 10; factors.push({ label: 'Price 24h', ok: false, note: `+${token.change24h?.toFixed(1)}% pump` })
  } else {
    factors.push({ label: 'Price 24h', ok: true, note: `${token.change24h >= 0 ? '+' : ''}${token.change24h?.toFixed(1)}%` })
  }
  return { score: Math.max(10, Math.min(100, s)), factors }
}

export default function TokenCard({ token }) {
  const navigate = useNavigate()
  const t = useT()
  const [expanded, setExpanded] = useState(false)

  const { score: scoreVal, factors } = computeScore(token)
  const sc = scoreClass(scoreVal)
  const initials = (token.symbol || '??').slice(0, 2).toUpperCase()

  // Avatar gradient based on symbol hash
  const hash = [...(token.symbol || 'XX')].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 0)
  const hue1 = Math.abs(hash % 360)
  const hue2 = (hue1 + 120) % 360
  const avatarGrad = `linear-gradient(135deg, hsl(${hue1},80%,55%), hsl(${hue2},80%,45%))`

  return (
    <div
      className={`token-card ${sc}`}
      onClick={() => navigate(`/audit?address=${token.address}`)}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="token-avatar" style={{ background: avatarGrad }}>{initials}</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{token.name}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-3)', fontFamily: 'var(--mono)' }}>
              {token.symbol} · {token.dex}
            </div>
          </div>
        </div>
        <div style={{
          padding: '3px 10px', borderRadius: 100,
          background: sc === 'safe' ? 'var(--green-dim)' : sc === 'caution' ? 'var(--amber-dim)' : 'var(--red-dim)',
          color: scoreColor(scoreVal), fontFamily: 'var(--mono)', fontSize: '0.78rem', fontWeight: 700,
          border: `1px solid ${scoreColor(scoreVal)}30`,
        }}>
          {sc === 'safe' ? '🟢' : sc === 'caution' ? '🟡' : '🔴'} {scoreVal}
        </div>
      </div>

      {/* Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 16px', marginBottom: 14 }}>
        {[
          { key: 'p', label: t('tc_price'), value: fmtPrice(token.price) },
          { key: 'c', label: t('tc_24h'), value: pctStr(token.change24h), cls: pctClass(token.change24h) },
          { key: 'l', label: t('tc_liquidity'), value: `$${fmtNum(token.liquidity)}` },
          { key: 'v', label: t('tc_vol'), value: `$${fmtNum(token.volume24h)}` },
        ].map(m => (
          <div key={m.key}>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>{m.label}</div>
            <div className={`text-mono ${m.cls || ''}`} style={{ fontWeight: 700, fontSize: '0.9rem' }}>{m.value}</div>
          </div>
        ))}
      </div>

      {/* Buy/Sell bar */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: 'var(--text-3)', marginBottom: 4 }}>
          <span>{t('tc_buys')} {token.buys24h}</span>
          <span>{t('tc_sells')} {token.sells24h}</span>
        </div>
        <div style={{ height: 4, background: 'rgba(255,255,255,0.05)', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: 2,
            width: `${token.buys24h / Math.max(token.buys24h + token.sells24h, 1) * 100}%`,
            background: 'linear-gradient(90deg, var(--green), var(--cyan))',
          }} />
        </div>
      </div>

      {/* Score breakdown toggle */}
      <div
        onClick={e => { e.stopPropagation(); setExpanded(x => !x) }}
        style={{
          cursor: 'pointer', fontSize: '0.72rem', color: 'var(--text-3)',
          display: 'flex', alignItems: 'center', gap: 4, marginBottom: 10,
          userSelect: 'none',
        }}
      >
        <span style={{ color: scoreColor(scoreVal), fontWeight: 700, fontFamily: 'var(--mono)' }}>Score {scoreVal}</span>
        <span style={{ opacity: 0.5 }}>·</span>
        <span>{expanded ? '▲ hide' : '▼ why?'}</span>
      </div>

      {expanded && (
        <div style={{ marginBottom: 12, borderRadius: 6, overflow: 'hidden', border: '1px solid var(--border)' }}>
          {factors.map((f, i) => (
            <div key={i} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '5px 10px', background: i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent',
              fontSize: '0.75rem',
            }}>
              <span style={{ color: 'var(--text-2)', display: 'flex', alignItems: 'center', gap: 5 }}>
                <span>{f.ok ? '✅' : '⚠️'}</span>
                <span>{f.label}</span>
              </span>
              <span style={{ color: f.ok ? 'var(--text-3)' : 'var(--amber)', fontFamily: 'var(--mono)' }}>{f.note}</span>
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }} onClick={e => e.stopPropagation()}>
        <button
          className="btn btn-ghost"
          style={{ fontSize: '0.82rem', padding: '8px', justifyContent: 'center' }}
          onClick={() => navigate(`/audit?address=${token.address}`)}
        >
          🛡️ {t('tc_audit')}
        </button>
        {token.pairUrl && (
          <a href={token.pairUrl} target="_blank" rel="noopener noreferrer">
            <button className="btn btn-ghost" style={{ fontSize: '0.82rem', padding: '8px', width: '100%', justifyContent: 'center' }}>
              📊 {t('tc_chart')}
            </button>
          </a>
        )}
      </div>
    </div>
  )
}

