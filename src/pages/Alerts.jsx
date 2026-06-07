import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'

/**
 * Alerts page — zero-friction. No bot token. No chat_id. No BotFather.
 *
 * Two buttons:
 *   1. Join Free Telegram channel (public, 6h-delayed top signal)
 *   2. Join Pro Telegram channel (buyers only, real-time)
 *
 * Plus a preview of what an alert actually looks like (pulled from /api/alerts/preview).
 */

const TG_FREE = import.meta.env.VITE_TELEGRAM_FREE_URL || 'https://t.me/walletdna_alpha'
const TG_PRO  = import.meta.env.VITE_TELEGRAM_PRO_URL  || 'https://t.me/walletdna_pro'
const GUMROAD = import.meta.env.VITE_GUMROAD_LIFETIME  || '#'

export default function Alerts() {
  const [preview, setPreview] = useState({ cluster: '', exit: '' })

  useEffect(() => {
    Promise.all([
      fetch('/api/alerts/preview?type=cluster').then(r => r.json()).catch(() => ({ text: '' })),
      fetch('/api/alerts/preview?type=exit').then(r => r.json()).catch(() => ({ text: '' })),
    ]).then(([c, e]) => setPreview({ cluster: c.text || '', exit: e.text || '' }))
  }, [])

  return (
    <div className="anim-fade-up" style={{ paddingBottom: 60 }}>
      <div style={{ marginBottom: 28 }}>
        <div className="eyebrow" style={{ color: 'var(--green)' }}>
          📡 TELEGRAM ALERTS
        </div>
        <h1 style={{ fontSize: 'clamp(1.6rem, 3vw, 2.4rem)', fontWeight: 900, letterSpacing: '-0.03em', marginBottom: 8 }}>
          Get every signal in <span className="text-purple">Telegram</span>
        </h1>
        <p style={{ fontSize: '0.95rem', color: 'var(--text-2)', maxWidth: 600, lineHeight: 1.6 }}>
          One channel. One tap to join. No bot setup, no token, no chat_id.
          You buy → you join → signals start arriving. Done.
        </p>
      </div>

      {/* Two-tier channel cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 18, marginBottom: 36 }}>

        {/* FREE */}
        <motion.div whileHover={{ y: -4 }} style={{
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 'var(--r-lg)', padding: '24px 26px', display: 'flex', flexDirection: 'column',
        }}>
          <div style={{ fontSize: '0.65rem', color: 'var(--text-3)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>
            Free Channel
          </div>
          <div style={{ fontSize: '1.45rem', fontWeight: 900, marginBottom: 10 }}>
            📡 WalletDNA Alpha
          </div>
          <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 22px', display: 'flex', flexDirection: 'column', gap: 8, color: 'var(--text-2)', fontSize: '0.86rem' }}>
            <li>✓ Top cluster of the day</li>
            <li>✓ Public, 6-hour delayed</li>
            <li>✓ Forever free, no signup</li>
          </ul>
          <a href={TG_FREE} target="_blank" rel="noopener noreferrer"
            className="btn btn-ghost"
            style={{ width: '100%', justifyContent: 'center', textDecoration: 'none', padding: 14, fontSize: '1rem', marginTop: 'auto' }}>
            Join Free Channel →
          </a>
        </motion.div>

        {/* PRO */}
        <motion.div whileHover={{ y: -4 }} style={{
          background: 'var(--bg-card)', border: '2px solid var(--purple)',
          borderRadius: 'var(--r-lg)', padding: '24px 26px',
          boxShadow: '0 0 40px rgba(181,74,255,0.18)', position: 'relative',
          display: 'flex', flexDirection: 'column',
        }}>
          <div style={{
            position: 'absolute', top: -12, left: 24,
            background: 'var(--purple)', color: '#fff', fontSize: '0.66rem',
            padding: '4px 12px', borderRadius: 100, fontWeight: 800, letterSpacing: '0.06em',
          }}>
            BUYERS ONLY
          </div>
          <div style={{ fontSize: '0.65rem', color: 'var(--purple)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>
            Pro Channel
          </div>
          <div style={{ fontSize: '1.45rem', fontWeight: 900, marginBottom: 10 }}>
            🚀 WalletDNA Pro
          </div>
          <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 22px', display: 'flex', flexDirection: 'column', gap: 8, color: 'var(--text-2)', fontSize: '0.86rem' }}>
            <li>⚡ Real-time — under 60 seconds</li>
            <li>⚡ Every cluster, every whale trade &gt;$20k</li>
            <li>⚡ Risk gate inline · entry, target, peak</li>
            <li>⚡ Lifetime access · pay once</li>
          </ul>
          <a href={GUMROAD} target="_blank" rel="noopener noreferrer"
            className="btn btn-primary"
            style={{
              width: '100%', justifyContent: 'center', textDecoration: 'none',
              padding: 14, fontSize: '1rem', background: 'var(--purple)',
              boxShadow: '0 0 18px rgba(181,74,255,0.35)', marginTop: 'auto',
            }}>
            Unlock Pro Channel →
          </a>
        </motion.div>
      </div>

      {/* Live preview of an actual alert message */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: '0.7rem', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700, marginBottom: 12 }}>
          🔍 Preview — what an alert looks like
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14 }}>
          <AlertPreview title="Cluster alert" body={preview.cluster || 'No live cluster right now.'} />
          <AlertPreview title="Exit alert"    body={preview.exit    || 'No live exit right now.'} />
        </div>
      </div>

      <div style={{ fontSize: '0.78rem', color: 'var(--text-3)', textAlign: 'center', marginTop: 22 }}>
        We never read your wallet. We never trade for you. Alerts are read-only on-chain observations.
      </div>
    </div>
  )
}

function AlertPreview({ title, body }) {
  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border)',
      borderRadius: 'var(--r-lg)', padding: '16px 18px',
    }}>
      <div style={{ fontSize: '0.62rem', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, marginBottom: 10 }}>
        {title}
      </div>
      <pre style={{
        margin: 0, fontSize: '0.78rem', lineHeight: 1.5, color: 'var(--text-2)',
        whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'var(--mono)',
        background: 'var(--bg-0)', padding: '12px 14px', borderRadius: 'var(--r-md)',
        border: '1px solid var(--border)',
      }}>
        {body}
      </pre>
    </div>
  )
}
