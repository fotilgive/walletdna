import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import useStore from '../store/useStore'

export default function AccountMenu() {
  const navigate = useNavigate()
  const { user, isPremium, logout } = useStore()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  if (!user) {
    return (
      <div style={{ display: 'flex', gap: 6 }}>
        <button onClick={() => navigate('/login')} style={btnGhost}>Sign in</button>
        <button onClick={() => navigate('/register')} style={btnPrimary}>Sign up</button>
      </div>
    )
  }

  const initial = (user.name || user.email || '?').trim().charAt(0).toUpperCase()
  const display = user.name || user.email
  const premium = isPremium || user.isPremium

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={() => setOpen(o => !o)} style={triggerStyle(open)} title={display}>
        {user.avatarUrl ? (
          <img src={user.avatarUrl} alt="" style={{ width: 28, height: 28, borderRadius: '50%' }} />
        ) : (
          <span style={avatarStyle(premium)}>{initial}</span>
        )}
        {premium && <span style={proPill}>PRO</span>}
        <span style={{ fontSize: '0.78rem', color: 'var(--text-2)', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {display}
        </span>
        <span style={{ fontSize: 9, color: 'var(--text-3)' }}>▼</span>
      </button>

      {open && (
        <div style={dropdownStyle}>
          <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-1)' }}>{display}</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-3)', marginTop: 2 }}>{user.email}</div>
            <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
              {premium ? (
                <span style={badgePremium}>✓ Premium</span>
              ) : (
                <span style={badgeFree}>Free plan</span>
              )}
              {user.isAdmin && <span style={badgeAdmin}>Admin</span>}
            </div>
          </div>

          <button style={menuItem} onClick={() => { setOpen(false); navigate('/account') }}>
            <span>⚙️</span> Account settings
          </button>
          {!premium && (
            <button style={{ ...menuItem, color: 'var(--cyan)' }} onClick={() => { setOpen(false); navigate('/pricing') }}>
              <span>⚡</span> Upgrade to Premium
            </button>
          )}
          <button style={menuItem} onClick={() => { setOpen(false); navigate('/alerts') }}>
            <span>🔔</span> Telegram Alerts
          </button>
          <div style={{ height: 1, background: 'var(--border)' }} />
          <button style={{ ...menuItem, color: 'var(--red)' }} onClick={() => { logout(); navigate('/landing') }}>
            <span>↩</span> Sign out
          </button>
        </div>
      )}
    </div>
  )
}

const triggerStyle = (open) => ({
  display: 'flex', alignItems: 'center', gap: 8,
  padding: '4px 10px 4px 4px', borderRadius: 'var(--r-full)',
  background: open ? 'var(--bg-2)' : 'transparent',
  border: `1px solid ${open ? 'var(--border)' : 'transparent'}`,
  cursor: 'pointer', transition: 'all 0.15s',
})

const avatarStyle = (premium) => ({
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  width: 28, height: 28, borderRadius: '50%',
  background: premium
    ? 'linear-gradient(135deg, #00D4FF, #A855F7)'
    : 'var(--bg-2)',
  color: '#fff', fontWeight: 800, fontSize: '0.82rem',
  border: '1px solid var(--border)',
})

const proPill = {
  fontSize: 9, fontWeight: 800, padding: '2px 6px',
  borderRadius: 'var(--r-full)',
  background: 'linear-gradient(135deg, #00D4FF, #A855F7)',
  color: '#fff', letterSpacing: '0.05em',
}

const dropdownStyle = {
  position: 'absolute', right: 0, top: 'calc(100% + 8px)',
  width: 260, background: 'var(--bg-1)',
  border: '1px solid var(--border)', borderRadius: 'var(--r-md)',
  boxShadow: '0 12px 40px rgba(0,0,0,0.5)', zIndex: 100,
  overflow: 'hidden',
}

const menuItem = {
  display: 'flex', alignItems: 'center', gap: 10,
  width: '100%', padding: '10px 14px',
  background: 'transparent', border: 'none',
  color: 'var(--text-1)', fontSize: '0.82rem',
  textAlign: 'left', cursor: 'pointer',
  transition: 'background 0.12s',
}

const badgePremium = {
  fontSize: 9, fontWeight: 800, padding: '3px 7px',
  borderRadius: 'var(--r-full)',
  background: 'rgba(0,229,148,0.12)', color: 'var(--green)',
  border: '1px solid rgba(0,229,148,0.3)',
}
const badgeFree = {
  fontSize: 9, fontWeight: 800, padding: '3px 7px',
  borderRadius: 'var(--r-full)',
  background: 'var(--bg-2)', color: 'var(--text-3)',
  border: '1px solid var(--border)',
}
const badgeAdmin = {
  fontSize: 9, fontWeight: 800, padding: '3px 7px',
  borderRadius: 'var(--r-full)',
  background: 'rgba(255,184,0,0.12)', color: 'var(--amber)',
  border: '1px solid rgba(255,184,0,0.3)',
}
const btnGhost = {
  padding: '6px 12px', borderRadius: 'var(--r-md)',
  background: 'transparent', border: '1px solid var(--border)',
  color: 'var(--text-1)', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
}
const btnPrimary = {
  padding: '6px 12px', borderRadius: 'var(--r-md)',
  background: 'linear-gradient(135deg, #00D4FF, #A855F7)',
  border: 'none', color: '#fff', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer',
}
