import React, { useEffect, useState, useCallback } from 'react'
import { apiFetch } from '../utils/api'
import useStore from '../store/useStore'

const GUMROAD = import.meta.env.VITE_GUMROAD_URL || 'https://walletdna.gumroad.com/l/walletdna'

export default function Alerts() {
  const { isPremium } = useStore()

  const [cfg, setCfg]         = useState(null)   // { configured, chatId, enabled, hasToken }
  const [loading, setLoading] = useState(true)

  // Form state
  const [botToken, setBotToken] = useState('')
  const [chatId, setChatId]     = useState('')
  const [saving, setSaving]     = useState(false)
  const [saveErr, setSaveErr]   = useState(null)

  // Chat-id auto-detect
  const [detecting, setDetecting] = useState(false)
  const [detectErr, setDetectErr] = useState(null)

  // Test
  const [testing, setTesting]   = useState(false)
  const [testMsg, setTestMsg]   = useState(null)

  // Toggle
  const [toggling, setToggling] = useState(false)

  const load = useCallback(async () => {
    try {
      const r = await apiFetch('/api/alerts/my-config').then(r => r.json())
      if (r.success) setCfg(r)
    } catch {}
    setLoading(false)
  }, [])

  useEffect(() => { if (isPremium) { load() } else { setLoading(false) } }, [isPremium])

  async function save() {
    if (!botToken.trim() || !chatId.trim()) { setSaveErr('Both fields required'); return }
    setSaving(true); setSaveErr(null)
    try {
      const r = await apiFetch('/api/alerts/my-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ botToken: botToken.trim(), chatId: chatId.trim() }),
      }).then(r => r.json())
      if (r.success) { setBotToken(''); setChatId(''); await load() }
      else setSaveErr(r.error || 'Error')
    } catch (e) { setSaveErr(e.message) }
    setSaving(false)
  }

  async function detectChatId() {
    if (!botToken.trim()) { setDetectErr('Enter bot token first'); return }
    setDetecting(true); setDetectErr(null)
    try {
      const r = await apiFetch(`/api/alerts/get-chat-id?botToken=${encodeURIComponent(botToken.trim())}`).then(r => r.json())
      if (r.success) { setChatId(String(r.chatId)); setDetectErr(null) }
      else setDetectErr(r.error || 'Not found')
    } catch (e) { setDetectErr(e.message) }
    setDetecting(false)
  }

  async function sendTest() {
    setTesting(true); setTestMsg(null)
    try {
      const r = await apiFetch('/api/alerts/test', { method: 'POST' }).then(r => r.json())
      setTestMsg(r.success ? '✅ Test message sent!' : `❌ ${r.error}`)
    } catch (e) { setTestMsg(`❌ ${e.message}`) }
    setTesting(false)
  }

  async function toggle() {
    setToggling(true)
    try {
      const r = await apiFetch('/api/alerts/my-config/toggle', { method: 'POST' }).then(r => r.json())
      if (r.success) await load()
    } catch {}
    setToggling(false)
  }

  async function remove() {
    if (!confirm('Remove bot config?')) return
    await apiFetch('/api/alerts/my-config', { method: 'DELETE' })
    setCfg(null)
  }

  // ─── styles ──────────────────────────────────────────────────────────────
  const card = {
    background: 'var(--bg-card)', border: '1px solid var(--border)',
    borderRadius: 'var(--r-lg)', padding: '24px 24px', marginBottom: 20,
  }
  const inp = {
    width: '100%', background: 'var(--bg-input, rgba(255,255,255,0.05))',
    border: '1px solid var(--border)', borderRadius: 'var(--r-md)',
    color: 'var(--text-1)', fontSize: '0.88rem', padding: '10px 14px',
    outline: 'none', boxSizing: 'border-box', fontFamily: 'var(--mono)',
  }
  const label = { fontSize: '0.72rem', color: 'var(--text-3)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6, display: 'block' }

  // ─── not premium ─────────────────────────────────────────────────────────
  if (!isPremium) return (
    <div style={{ maxWidth: 600, paddingBottom: 60 }}>
      <div className="eyebrow" style={{ color: 'var(--green)' }}>📡 TELEGRAM ALERTS</div>
      <h1 style={{ fontSize: 'clamp(1.5rem,3vw,2.2rem)', fontWeight: 900, letterSpacing: '-0.03em', marginBottom: 12 }}>
        Signals straight to <span className="text-purple">Telegram</span>
      </h1>
      <div style={{ ...card, border: '2px solid rgba(181,74,255,0.3)', background: 'rgba(181,74,255,0.06)' }}>
        <div style={{ fontWeight: 800, marginBottom: 8 }}>🔒 PRO required</div>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-2)', marginBottom: 16 }}>
          Connect your own Telegram bot — signals arrive in your private chat, not a shared channel.
        </p>
        <a href={GUMROAD} target="_blank" rel="noopener noreferrer" className="btn btn-primary"
          style={{ background: 'var(--purple)', textDecoration: 'none' }}>
          Get PRO — $149 lifetime →
        </a>
      </div>
    </div>
  )

  return (
    <div style={{ maxWidth: 640, paddingBottom: 60 }}>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div className="eyebrow" style={{ color: 'var(--green)' }}>📡 TELEGRAM ALERTS</div>
        <h1 style={{ fontSize: 'clamp(1.5rem,3vw,2.2rem)', fontWeight: 900, letterSpacing: '-0.03em', marginBottom: 8 }}>
          Your bot, your signals
        </h1>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-2)', lineHeight: 1.6 }}>
          Create a Telegram bot via BotFather → paste token + chat_id → signals go through your own bot.
          WalletDNA never stores messages, only sends.
        </p>
      </div>

      {loading ? (
        <div style={{ color: 'var(--text-3)', fontSize: '0.9rem' }}>Loading…</div>
      ) : cfg?.configured ? (
        // ── CONFIGURED ───────────────────────────────────────────────────
        <>
          <div style={{
            ...card,
            border: `2px solid ${cfg.enabled ? 'var(--green)' : 'var(--border)'}`,
            boxShadow: cfg.enabled ? '0 0 28px rgba(0,229,148,0.10)' : 'none',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <span style={{ fontSize: '1.4rem' }}>{cfg.enabled ? '✅' : '⏸️'}</span>
              <div>
                <div style={{ fontWeight: 900 }}>Bot connected</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-3)', marginTop: 2 }}>
                  chat_id: <code style={{ fontFamily: 'var(--mono)' }}>{cfg.chatId}</code>
                  {' · '}{cfg.enabled ? '🟢 signals active' : '⏸ paused'}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button className="btn btn-primary" onClick={sendTest} disabled={testing}
                style={{ background: 'var(--purple)', fontSize: '0.86rem' }}>
                {testing ? 'Sending…' : '📨 Send test'}
              </button>
              <button className="btn btn-ghost" onClick={toggle} disabled={toggling}
                style={{ fontSize: '0.86rem' }}>
                {toggling ? '…' : cfg.enabled ? '⏸ Pause alerts' : '▶ Resume alerts'}
              </button>
              <button className="btn btn-ghost" onClick={remove}
                style={{ fontSize: '0.86rem', color: 'var(--red)' }}>
                🗑 Remove
              </button>
            </div>

            {testMsg && (
              <div style={{ marginTop: 14, fontSize: '0.84rem', color: testMsg.startsWith('✅') ? 'var(--green)' : 'var(--red)' }}>
                {testMsg}
              </div>
            )}
          </div>

          {/* Alert types */}
          <div style={card}>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-3)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 }}>
              What you receive
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px,1fr))', gap: 10 }}>
              {[
                { label: '🔮 Cluster alert', sub: 'New cluster with urgency ≥60' },
                { label: '🚪 Exit alert', sub: 'Smart money sells' },
              ].map(f => (
                <div key={f.label} style={{
                  background: 'rgba(0,229,148,0.05)', border: '1px solid rgba(0,229,148,0.15)',
                  borderRadius: 'var(--r-md)', padding: '10px 14px', fontSize: '0.8rem',
                }}>
                  <div style={{ fontWeight: 800, marginBottom: 3 }}>{f.label}</div>
                  <div style={{ color: 'var(--text-3)', fontSize: '0.75rem' }}>{f.sub}</div>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        // ── SETUP FORM ───────────────────────────────────────────────────
        <>
          {/* Step guide */}
          <div style={{ ...card, marginBottom: 20 }}>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-3)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 }}>
              Setup — 3 steps
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { n: '1', t: 'Open @BotFather in Telegram', s: 'Send /newbot → choose name → copy the token' },
                { n: '2', t: 'Send any message to your new bot', s: 'Required for chat_id auto-detect to work' },
                { n: '3', t: 'Paste token below → auto-detect chat_id → save', s: 'Done. Signals fire within 5 min of a new cluster' },
              ].map(s => (
                <div key={s.n} style={{ display: 'flex', gap: 12 }}>
                  <div style={{
                    width: 22, height: 22, borderRadius: '50%', background: 'var(--purple)',
                    color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.7rem', fontWeight: 900, flexShrink: 0, marginTop: 2,
                  }}>{s.n}</div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '0.88rem' }}>{s.t}</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-3)', lineHeight: 1.5 }}>{s.s}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Form */}
          <div style={card}>
            <div style={{ marginBottom: 18 }}>
              <label style={label}>Bot token (from BotFather)</label>
              <input
                style={inp}
                placeholder="1234567890:ABCdefGHI..."
                value={botToken}
                onChange={e => { setBotToken(e.target.value); setDetectErr(null); setSaveErr(null) }}
                autoComplete="off"
              />
            </div>

            <div style={{ marginBottom: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <label style={{ ...label, marginBottom: 0 }}>Chat ID</label>
                <button className="btn btn-ghost" onClick={detectChatId} disabled={detecting}
                  style={{ fontSize: '0.76rem', padding: '4px 10px' }}>
                  {detecting ? 'Detecting…' : '⚡ Auto-detect'}
                </button>
              </div>
              <input
                style={inp}
                placeholder="123456789"
                value={chatId}
                onChange={e => { setChatId(e.target.value); setSaveErr(null) }}
                autoComplete="off"
              />
              {detectErr && <div style={{ marginTop: 6, fontSize: '0.78rem', color: 'var(--red)' }}>{detectErr}</div>}
              <div style={{ marginTop: 6, fontSize: '0.74rem', color: 'var(--text-3)' }}>
                Send any message to your bot, then click Auto-detect.
              </div>
            </div>

            {saveErr && <div style={{ marginBottom: 12, fontSize: '0.82rem', color: 'var(--red)' }}>{saveErr}</div>}

            <button className="btn btn-primary" onClick={save} disabled={saving}
              style={{ background: 'var(--purple)', width: '100%', justifyContent: 'center', padding: '13px' }}>
              {saving ? 'Saving…' : '💾 Save & activate'}
            </button>
          </div>
        </>
      )}

      {/* Footer */}
      <div style={{ fontSize: '0.74rem', color: 'var(--text-3)', lineHeight: 1.6, padding: '14px 0', borderTop: '1px solid var(--border)' }}>
        Your bot token is stored encrypted. WalletDNA only sends messages — never reads your chats.
        Signals stop automatically if your subscription expires.
      </div>
    </div>
  )
}
