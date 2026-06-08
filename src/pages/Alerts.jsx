import React, { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { apiFetch } from '../utils/api'
import useStore from '../store/useStore'

const GUMROAD = import.meta.env.VITE_GUMROAD_URL || 'https://walletdna.gumroad.com/l/walletdna'

export default function Alerts() {
  const { user, isPremium } = useStore()
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [linkUrl, setLinkUrl] = useState(null)
  const [unlinking, setUnlinking] = useState(false)
  const [preview, setPreview] = useState({ cluster: '', exit: '' })

  const loadStatus = useCallback(async () => {
    try {
      const r = await apiFetch('/api/alerts/tg-status').then(r => r.json())
      setStatus(r)
    } catch {}
    setLoading(false)
  }, [])

  useEffect(() => {
    loadStatus()
    Promise.all([
      apiFetch('/api/alerts/preview?type=cluster').then(r => r.json()).catch(() => ({ text: '' })),
      apiFetch('/api/alerts/preview?type=exit').then(r => r.json()).catch(() => ({ text: '' })),
    ]).then(([c, e]) => setPreview({ cluster: c.text || '', exit: e.text || '' }))
  }, [])

  async function generateLink() {
    setGenerating(true)
    setLinkUrl(null)
    try {
      const r = await apiFetch('/api/alerts/link-token', { method: 'POST' }).then(r => r.json())
      if (r.success) setLinkUrl(r.url)
    } catch {}
    setGenerating(false)
  }

  async function unlink() {
    setUnlinking(true)
    try {
      await apiFetch('/api/alerts/tg-unlink', { method: 'POST' })
      setStatus({ linked: false, active: false })
      setLinkUrl(null)
    } catch {}
    setUnlinking(false)
  }

  return (
    <div className="anim-fade-up" style={{ maxWidth: 680, paddingBottom: 60 }}>

      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <div className="eyebrow" style={{ color: 'var(--green)' }}>📡 TELEGRAM ALERTS</div>
        <h1 style={{ fontSize: 'clamp(1.6rem, 3vw, 2.4rem)', fontWeight: 900, letterSpacing: '-0.03em', marginBottom: 8 }}>
          Signals straight to <span className="text-purple">Telegram</span>
        </h1>
        <p style={{ fontSize: '0.95rem', color: 'var(--text-2)', lineHeight: 1.6 }}>
          Connect once. Every cluster alert fires under 60 seconds — directly to you, no channels.
          PRO only. Active as long as your subscription is active.
        </p>
      </div>

      {/* Connection card */}
      <div style={{
        background: 'var(--bg-card)',
        border: `2px solid ${status?.linked && status?.active ? 'var(--green)' : 'var(--border)'}`,
        borderRadius: 'var(--r-lg)', padding: '28px 28px', marginBottom: 24,
        boxShadow: status?.linked && status?.active ? '0 0 32px rgba(0,229,148,0.12)' : 'none',
        transition: 'all 0.3s',
      }}>
        {loading ? (
          <div style={{ color: 'var(--text-3)', fontSize: '0.9rem' }}>Loading…</div>
        ) : status?.linked && status?.active ? (
          // ── CONNECTED ──
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
              <span style={{ fontSize: '1.5rem' }}>✅</span>
              <div>
                <div style={{ fontWeight: 900, fontSize: '1.1rem' }}>Telegram connected</div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-3)', marginTop: 2 }}>
                  {status.username ? `@${status.username}` : 'Linked'} · {isPremium ? '⭐ signals active' : '🔒 upgrade to activate'}
                </div>
              </div>
            </div>

            {!isPremium && (
              <div style={{
                background: 'rgba(255,59,107,0.08)', border: '1px solid rgba(255,59,107,0.2)',
                borderRadius: 'var(--r-md)', padding: '12px 16px', marginBottom: 18, fontSize: '0.86rem', color: 'var(--red)',
              }}>
                ⚠️ No active PRO subscription — signals won't be sent until you upgrade.
                <a href={GUMROAD} target="_blank" rel="noopener noreferrer"
                  style={{ color: 'var(--purple)', marginLeft: 8, fontWeight: 700 }}>
                  Upgrade →
                </a>
              </div>
            )}

            {isPremium && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 18 }}>
                {[
                  { label: 'Cluster alert', sub: 'On new cluster signal' },
                  { label: 'Exit alert', sub: 'Smart money sells' },
                  { label: 'Whale trade', sub: 'Single wallet >$20k' },
                ].map(f => (
                  <div key={f.label} style={{
                    background: 'rgba(0,229,148,0.06)', border: '1px solid rgba(0,229,148,0.15)',
                    borderRadius: 'var(--r-md)', padding: '10px 12px', fontSize: '0.78rem',
                  }}>
                    <div style={{ fontWeight: 800, color: 'var(--green)', marginBottom: 3 }}>✓ {f.label}</div>
                    <div style={{ color: 'var(--text-3)' }}>{f.sub}</div>
                  </div>
                ))}
              </div>
            )}

            <button className="btn btn-ghost" onClick={unlink} disabled={unlinking}
              style={{ fontSize: '0.82rem', padding: '8px 16px', color: 'var(--text-3)' }}>
              {unlinking ? 'Disconnecting…' : 'Disconnect Telegram'}
            </button>
          </div>
        ) : (
          // ── NOT CONNECTED ──
          <div>
            <div style={{ fontWeight: 800, fontSize: '1.05rem', marginBottom: 8 }}>
              🔗 Connect your Telegram
            </div>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-2)', marginBottom: 20, lineHeight: 1.6 }}>
              Click the button — a unique link opens Telegram. One tap and you're connected.
              No bot setup. No chat_id. Works on mobile and desktop.
            </p>

            {!isPremium && (
              <div style={{
                background: 'rgba(181,74,255,0.07)', border: '1px solid rgba(181,74,255,0.2)',
                borderRadius: 'var(--r-md)', padding: '12px 16px', marginBottom: 18, fontSize: '0.86rem',
              }}>
                <span style={{ color: 'var(--purple)', fontWeight: 800 }}>PRO required</span>
                <span style={{ color: 'var(--text-2)', marginLeft: 8 }}>
                  You can connect Telegram, but signals won't fire until you have an active subscription.
                </span>
                <a href={GUMROAD} target="_blank" rel="noopener noreferrer"
                  style={{ display: 'block', marginTop: 8, color: 'var(--purple)', fontWeight: 700 }}>
                  Get PRO — $149 lifetime →
                </a>
              </div>
            )}

            {linkUrl ? (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                style={{
                  background: 'rgba(0,229,148,0.06)', border: '1px solid rgba(0,229,148,0.25)',
                  borderRadius: 'var(--r-md)', padding: '18px 20px', marginBottom: 16,
                }}>
                <div style={{ fontSize: '0.78rem', color: 'var(--green)', fontWeight: 800, marginBottom: 10, letterSpacing: '0.06em' }}>
                  ✓ LINK READY — expires in 10 minutes
                </div>
                <a href={linkUrl} target="_blank" rel="noopener noreferrer"
                  className="btn btn-primary"
                  style={{ width: '100%', justifyContent: 'center', textDecoration: 'none', background: 'var(--purple)', fontSize: '1rem', padding: '14px' }}>
                  Open in Telegram →
                </a>
                <div style={{ marginTop: 12, fontSize: '0.76rem', color: 'var(--text-3)', textAlign: 'center' }}>
                  After opening, tap START — Telegram links automatically.
                </div>
                <button className="btn btn-ghost" onClick={loadStatus}
                  style={{ width: '100%', marginTop: 10, fontSize: '0.82rem' }}>
                  ✓ I connected — check status
                </button>
              </motion.div>
            ) : (
              <button className="btn btn-primary" onClick={generateLink} disabled={generating}
                style={{ width: '100%', background: 'var(--purple)', fontSize: '1rem', padding: '14px', justifyContent: 'center' }}>
                {generating ? 'Generating link…' : '🔗 Connect Telegram'}
              </button>
            )}
          </div>
        )}
      </div>

      {/* How it works */}
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: 'var(--r-lg)', padding: '20px 24px', marginBottom: 24,
      }}>
        <div style={{ fontSize: '0.7rem', color: 'var(--text-3)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 14 }}>
          How it works
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14 }}>
          {[
            { n: '1', t: 'Click "Connect Telegram"', s: 'Generates a one-time secure link' },
            { n: '2', t: 'Open in Telegram & tap START', s: 'Links your account instantly' },
            { n: '3', t: 'Signals arrive automatically', s: 'Every cluster, every exit, real-time' },
          ].map(s => (
            <div key={s.n} style={{ display: 'flex', gap: 10 }}>
              <div style={{
                width: 24, height: 24, borderRadius: '50%', background: 'var(--purple)', color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.72rem', fontWeight: 900, flexShrink: 0, marginTop: 1,
              }}>{s.n}</div>
              <div>
                <div style={{ fontWeight: 800, fontSize: '0.86rem', marginBottom: 3 }}>{s.t}</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-3)', lineHeight: 1.5 }}>{s.s}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Alert previews */}
      {(preview.cluster || preview.exit) && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-3)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 14 }}>
            🔍 Preview — what an alert looks like
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
            {[
              { label: 'Cluster Alert', text: preview.cluster },
              { label: 'Exit Alert', text: preview.exit },
            ].filter(p => p.text).map(p => (
              <div key={p.label} style={{
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                borderRadius: 'var(--r-lg)', padding: '18px 20px',
              }}>
                <div style={{ fontSize: '0.68rem', color: 'var(--cyan)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
                  {p.label}
                </div>
                <pre style={{
                  fontFamily: 'var(--mono)', fontSize: '0.76rem', lineHeight: 1.6,
                  color: 'var(--text-2)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0,
                }}>{p.text || 'No signal available yet.'}</pre>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Disclaimer */}
      <div style={{ fontSize: '0.75rem', color: 'var(--text-3)', lineHeight: 1.6, padding: '14px 0', borderTop: '1px solid var(--border)' }}>
        We never read your wallet. We never trade for you. Alerts are read-only on-chain observations.
        Signals stop if your subscription expires.
      </div>
    </div>
  )
}
