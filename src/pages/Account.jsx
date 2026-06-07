import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import useStore from '../store/useStore'
import { apiFetch } from '../utils/api'

export default function Account() {
  const navigate = useNavigate()
  const { user, isPremium, logout, setPremium, setUser } = useStore()
  const [licenseKey, setLicenseKey] = useState('')
  const [activating, setActivating] = useState(false)

  if (!user) {
    navigate('/login')
    return null
  }

  const premium = isPremium || user.isPremium
  const memberSince = user.createdAt ? new Date(user.createdAt).toLocaleDateString() : null
  const licenseActivated = user.licenseActivatedAt ? new Date(user.licenseActivatedAt).toLocaleDateString() : null

  async function activate() {
    if (!licenseKey.trim()) return toast.error('Enter license key')
    setActivating(true)
    try {
      const res = await apiFetch('/api/auth/activate-license', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ licenseKey: licenseKey.trim() }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success('Premium activated!')
        setPremium(true)
        setUser({ ...user, isPremium: true, gumroadLicense: licenseKey.trim() })
        setLicenseKey('')
      } else {
        toast.error(data.error || 'Activation failed')
      }
    } catch {
      toast.error('Activation failed')
    } finally {
      setActivating(false)
    }
  }

  function copyEmail() {
    navigator.clipboard.writeText(user.email)
    toast.success('Email copied')
  }

  function copyLicense() {
    if (!user.gumroadLicense) return
    navigator.clipboard.writeText(user.gumroadLicense)
    toast.success('License key copied')
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 20px' }}>
      <h1 style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-1)', marginBottom: 4 }}>
        Account
      </h1>
      <p style={{ color: 'var(--text-3)', fontSize: '0.9rem', marginBottom: 32 }}>
        Manage your WalletDNA account, subscription, and license.
      </p>

      {/* Profile */}
      <Section title="Profile">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {user.avatarUrl ? (
            <img src={user.avatarUrl} alt="" style={{ width: 56, height: 56, borderRadius: '50%' }} />
          ) : (
            <div style={{
              width: 56, height: 56, borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: premium ? 'linear-gradient(135deg, #00D4FF, #A855F7)' : 'var(--bg-2)',
              color: '#fff', fontSize: '1.4rem', fontWeight: 800,
              border: '1px solid var(--border)',
            }}>
              {(user.name || user.email).charAt(0).toUpperCase()}
            </div>
          )}
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-1)' }}>
              {user.name || user.email.split('@')[0]}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
              <span style={{ color: 'var(--text-3)', fontSize: '0.85rem' }}>{user.email}</span>
              <button onClick={copyEmail} style={miniBtn}>copy</button>
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
              {premium
                ? <span style={badge('var(--green)')}>✓ Premium member</span>
                : <span style={badge('var(--text-3)')}>Free account</span>}
              {user.isAdmin && <span style={badge('var(--amber)')}>Admin</span>}
              <span style={badge('var(--text-3)')}>
                {user.authMethod === 'google' ? 'Google' : 'Email'}
              </span>
            </div>
          </div>
        </div>
        {memberSince && (
          <Row label="Member since" value={memberSince} />
        )}
      </Section>

      {/* Subscription */}
      <Section title="Subscription">
        {premium ? (
          <>
            <Row label="Plan" value={<span style={{ color: 'var(--green)', fontWeight: 700 }}>WalletDNA Premium</span>} />
            <Row label="Price" value="$149 one-time" />
            {licenseActivated && <Row label="Activated" value={licenseActivated} />}
            {user.gumroadLicense && (
              <Row
                label="License key"
                value={
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <code style={{ background: 'var(--bg-2)', padding: '4px 8px', borderRadius: 4, fontSize: '0.78rem' }}>
                      {user.gumroadLicense.slice(0, 8)}…{user.gumroadLicense.slice(-4)}
                    </code>
                    <button onClick={copyLicense} style={miniBtn}>copy</button>
                  </div>
                }
              />
            )}
            <div style={{ marginTop: 16, padding: 14, background: 'rgba(0,229,148,0.06)', border: '1px solid rgba(0,229,148,0.2)', borderRadius: 8 }}>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-1)', fontWeight: 600 }}>
                You have full access to all WalletDNA features.
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-3)', marginTop: 4 }}>
                Live clusters, signal history, wallet profiler, Telegram alerts, and more.
              </div>
            </div>
          </>
        ) : (
          <>
            <Row label="Plan" value="Free account" />
            <Row label="Access" value="Limited — premium features locked" />
            <div style={{ marginTop: 16, padding: 16, background: 'linear-gradient(135deg, rgba(0,212,255,0.08), rgba(168,85,247,0.08))', border: '1px solid rgba(0,212,255,0.2)', borderRadius: 10 }}>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-1)', marginBottom: 6 }}>
                Unlock WalletDNA Premium
              </div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-2)', marginBottom: 14 }}>
                One-time $149 · 7-day money-back · Full Base smart money intelligence.
              </div>
              <button onClick={() => navigate('/pricing')} style={btnPrimary}>
                See pricing →
              </button>
            </div>
            <div style={{ marginTop: 18 }}>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-3)', marginBottom: 8 }}>
                Already purchased? Activate your license:
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  value={licenseKey}
                  onChange={e => setLicenseKey(e.target.value)}
                  placeholder="Paste Gumroad license key"
                  style={{
                    flex: 1, padding: '10px 12px', borderRadius: 8,
                    background: 'var(--bg-2)', border: '1px solid var(--border)',
                    color: 'var(--text-1)', fontSize: '0.85rem', fontFamily: 'var(--mono)',
                  }}
                />
                <button onClick={activate} disabled={activating} style={btnPrimary}>
                  {activating ? 'Activating…' : 'Activate'}
                </button>
              </div>
            </div>
          </>
        )}
      </Section>

      {/* Security */}
      <Section title="Session">
        <Row label="Sign-in method" value={user.authMethod === 'google' ? 'Google account' : 'Email & password'} />
        <Row label="Session expires" value="7 days of inactivity" />
        <button
          onClick={() => { logout(); navigate('/landing') }}
          style={{
            marginTop: 16, padding: '10px 18px', borderRadius: 8,
            background: 'rgba(255,80,80,0.08)', border: '1px solid rgba(255,80,80,0.3)',
            color: 'var(--red)', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer',
          }}
        >
          Sign out
        </button>
      </Section>

      <div style={{ textAlign: 'center', marginTop: 32, fontSize: '0.75rem', color: 'var(--text-3)' }}>
        Need help? Email <a href="mailto:support@walletdna.com" style={{ color: 'var(--cyan)' }}>support@walletdna.com</a>
      </div>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div style={{
      background: 'var(--bg-1)', border: '1px solid var(--border)',
      borderRadius: 12, padding: 24, marginBottom: 18,
    }}>
      <h2 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 18 }}>
        {title}
      </h2>
      {children}
    </div>
  )
}

function Row({ label, value }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '10px 0', borderBottom: '1px solid var(--border)',
    }}>
      <span style={{ color: 'var(--text-3)', fontSize: '0.82rem' }}>{label}</span>
      <span style={{ color: 'var(--text-1)', fontSize: '0.85rem' }}>{value}</span>
    </div>
  )
}

const miniBtn = {
  padding: '2px 8px', borderRadius: 4, fontSize: '0.65rem', fontWeight: 700,
  background: 'var(--bg-2)', border: '1px solid var(--border)',
  color: 'var(--text-2)', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.05em',
}

const btnPrimary = {
  padding: '10px 18px', borderRadius: 8,
  background: 'linear-gradient(135deg, #00D4FF, #A855F7)',
  border: 'none', color: '#fff', fontSize: '0.85rem', fontWeight: 700,
  cursor: 'pointer', whiteSpace: 'nowrap',
}

function badge(color) {
  return {
    fontSize: 9, fontWeight: 800, padding: '3px 8px',
    borderRadius: 'var(--r-full)',
    background: `${color}1a`, color, border: `1px solid ${color}40`,
    letterSpacing: '0.05em',
  }
}
