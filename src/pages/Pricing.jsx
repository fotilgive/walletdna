import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import useStore from '../store/useStore'
import toast from 'react-hot-toast'

const GUMROAD_URL = import.meta.env.VITE_GUMROAD_URL || 'https://gumroad.com'

const FEATURES = [
  { icon: '🔮', title: 'Smart Money Clusters', desc: 'Real-time detection when 2+ alpha wallets pile into the same token.' },
  { icon: '🧬', title: 'Wallet DNA Profiles', desc: 'Full on-chain breakdown: archetype, alpha score, best trades, FIFO PnL.' },
  { icon: '💎', title: 'Hidden Gems', desc: 'Undiscovered wallets with elite win rates — before they get copied.' },
  { icon: '✅', title: 'Signal Proof', desc: 'Every signal tracked with real prices. Wins and losses shown.' },
  { icon: '📲', title: 'Telegram Alerts', desc: 'Cluster forms → message lands in seconds. 24/7 coverage.' },
  { icon: '🏆', title: 'Smart Money Leaderboard', desc: 'Top wallets ranked by verified alpha score. Updated daily.' },
  { icon: '📊', title: 'Signal History + Backtest', desc: 'See how past signals performed. Avg +43% peak in 30 days.' },
  { icon: '♾️', title: 'All Future Features', desc: 'One payment. Every update forever. No subscription.' },
]

const PROOF = [
  { label: 'Avg signal peak', value: '+43%', sub: 'within 30 days' },
  { label: 'Hit rate ≥20%', value: '47%', sub: 'of signals' },
  { label: 'Verified signals', value: '57+', sub: 'with real data' },
  { label: 'Alpha wallets', value: '370+', sub: 'tracked live' },
]

export default function Pricing() {
  const navigate = useNavigate()
  const { user, isPremium } = useStore()
  const [licenseKey, setLicenseKey] = useState('')
  const [activating, setActivating] = useState(false)

  const handleActivate = async () => {
    const key = licenseKey.trim()
    if (!key) return toast.error('Enter your license key')
    if (!user) return navigate('/login')

    setActivating(true)
    try {
      const token = localStorage.getItem('walletdna_token')
      const res = await fetch('/api/auth/activate-license', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ licenseKey: key }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success('License activated! Full access unlocked.', { icon: '🎉', duration: 4000 })
        window.location.href = '/'
      } else {
        toast.error(data.error || 'Activation failed')
      }
    } catch {
      toast.error('Activation failed')
    } finally {
      setActivating(false)
    }
  }

  // Already premium
  if (user?.isPremium || isPremium) {
    return (
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} style={{ maxWidth: 560, margin: '0 auto', padding: '40px 16px' }}>
        <div style={{
          background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.3)',
          borderRadius: 20, padding: '32px 28px', textAlign: 'center',
        }}>
          <div style={{ fontSize: '3rem', marginBottom: 16 }}>✅</div>
          <h2 style={{ color: '#10B981', fontSize: '1.4rem', fontWeight: 800, marginBottom: 8 }}>
            Full Access Active
          </h2>
          <p style={{ color: '#94A3B8', marginBottom: 24 }}>
            You have lifetime access to all WalletDNA features.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              ['🔮 Live Clusters', '/clusters'],
              ['💎 Hidden Gems', '/hidden-gems'],
              ['📊 Signal History', '/signal-history'],
            ].map(([label, path]) => (
              <button key={path} onClick={() => navigate(path)} style={{
                padding: '12px', background: 'rgba(16,185,129,0.1)',
                border: '1px solid rgba(16,185,129,0.2)', borderRadius: 10,
                color: '#10B981', fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem',
              }}>
                {label} →
              </button>
            ))}
          </div>
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '0 16px 60px' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <div style={{
            display: 'inline-block', padding: '4px 14px',
            background: 'rgba(168,85,247,0.12)', border: '1px solid rgba(168,85,247,0.3)',
            borderRadius: 100, fontSize: '0.72rem', fontWeight: 800,
            color: '#A855F7', letterSpacing: '0.08em', marginBottom: 16,
            textTransform: 'uppercase',
          }}>
            Launch Price — First 50 Buyers
          </div>
          <h1 style={{ color: '#F8FAFC', fontSize: 'clamp(1.8rem, 5vw, 2.8rem)', fontWeight: 900, lineHeight: 1.15, marginBottom: 14 }}>
            Track smart money<br />
            <span style={{ background: 'linear-gradient(90deg, #A855F7, #00D4FF)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              before Twitter finds it
            </span>
          </h1>
          <p style={{ color: '#64748B', fontSize: '1rem', maxWidth: 420, margin: '0 auto' }}>
            370+ verified alpha wallets. Real clusters. Real signals. Pay once, use forever.
          </p>
        </div>

        {/* Proof numbers */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 12, marginBottom: 36,
        }}>
          {PROOF.map(p => (
            <div key={p.label} style={{
              background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 12, padding: '16px 12px', textAlign: 'center',
            }}>
              <div style={{ fontSize: '1.6rem', fontWeight: 900, fontFamily: 'var(--mono, monospace)', color: '#A855F7', lineHeight: 1 }}>
                {p.value}
              </div>
              <div style={{ fontSize: '0.72rem', color: '#94A3B8', marginTop: 4 }}>{p.label}</div>
              <div style={{ fontSize: '0.65rem', color: '#475569' }}>{p.sub}</div>
            </div>
          ))}
        </div>

        {/* Main pricing card */}
        <div style={{
          background: 'rgba(168,85,247,0.04)',
          border: '2px solid rgba(168,85,247,0.4)',
          borderRadius: 20, padding: '36px 32px',
          marginBottom: 24, position: 'relative',
          boxShadow: '0 0 60px rgba(168,85,247,0.08)',
        }}>
          {/* BEST VALUE badge */}
          <div style={{
            position: 'absolute', top: -14, left: '50%', transform: 'translateX(-50%)',
            background: 'linear-gradient(135deg, #A855F7, #6366F1)',
            color: '#fff', fontSize: '0.68rem', fontWeight: 800,
            padding: '4px 16px', borderRadius: 100, letterSpacing: '0.08em',
            whiteSpace: 'nowrap',
          }}>
            ⚡ BEST VALUE — ONE-TIME PAYMENT
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 24, marginBottom: 28 }}>
            <div>
              <div style={{ color: '#A855F7', fontWeight: 800, fontSize: '0.8rem', letterSpacing: '0.08em', marginBottom: 8 }}>
                LIFETIME ACCESS
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
                <span style={{ fontSize: '3.5rem', fontWeight: 900, fontFamily: 'var(--mono, monospace)', color: '#F8FAFC', lineHeight: 1 }}>
                  $149
                </span>
                <span style={{ color: '#475569', fontSize: '1.1rem', textDecoration: 'line-through', fontFamily: 'var(--mono, monospace)' }}>
                  $249
                </span>
              </div>
              <div style={{ color: '#64748B', fontSize: '0.78rem', marginTop: 4 }}>
                one-time · no subscription · all updates included
              </div>
            </div>

            {/* CTA */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 220 }}>
              <a
                href={GUMROAD_URL}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  padding: '14px 24px',
                  background: 'linear-gradient(135deg, #A855F7 0%, #6366F1 100%)',
                  border: 'none', borderRadius: 12,
                  color: '#fff', fontSize: '1rem', fontWeight: 800,
                  textDecoration: 'none', cursor: 'pointer',
                  boxShadow: '0 4px 24px rgba(168,85,247,0.35)',
                  transition: 'transform 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
              >
                Buy Now — $149 →
              </a>
              <div style={{ textAlign: 'center', color: '#475569', fontSize: '0.7rem' }}>
                💳 Secure checkout via Gumroad
              </div>
            </div>
          </div>

          {/* Features grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
            {FEATURES.map(f => (
              <div key={f.title} style={{
                display: 'flex', gap: 10, padding: '10px 12px',
                background: 'rgba(255,255,255,0.02)', borderRadius: 10,
                border: '1px solid rgba(255,255,255,0.05)',
              }}>
                <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>{f.icon}</span>
                <div>
                  <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#F8FAFC', marginBottom: 2 }}>{f.title}</div>
                  <div style={{ fontSize: '0.7rem', color: '#64748B', lineHeight: 1.5 }}>{f.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Already bought — activate key */}
        <div style={{
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 16, padding: '24px 28px',
        }}>
          <div style={{ fontWeight: 700, color: '#94A3B8', fontSize: '0.88rem', marginBottom: 14 }}>
            🔑 Already purchased? Activate your license key
          </div>
          {user ? (
            <div style={{ display: 'flex', gap: 10 }}>
              <input
                value={licenseKey}
                onChange={e => setLicenseKey(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleActivate()}
                placeholder="Paste your Gumroad license key here"
                style={{
                  flex: 1, padding: '11px 14px',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 10, color: '#F8FAFC', fontSize: '0.88rem',
                  fontFamily: 'var(--mono, monospace)', outline: 'none',
                }}
              />
              <button
                onClick={handleActivate}
                disabled={activating || !licenseKey.trim()}
                style={{
                  padding: '11px 20px',
                  background: licenseKey.trim() ? 'rgba(168,85,247,0.8)' : 'rgba(255,255,255,0.05)',
                  border: 'none', borderRadius: 10,
                  color: '#fff', fontWeight: 700, cursor: licenseKey.trim() ? 'pointer' : 'not-allowed',
                  whiteSpace: 'nowrap', fontSize: '0.88rem',
                }}
              >
                {activating ? '…' : 'Activate'}
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{
                flex: 1, padding: '11px 14px',
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: 10, color: '#475569', fontSize: '0.85rem',
              }}>
                Sign in first to activate your key
              </div>
              <button
                onClick={() => navigate('/login')}
                style={{
                  padding: '11px 20px',
                  background: 'rgba(168,85,247,0.6)',
                  border: 'none', borderRadius: 10,
                  color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: '0.88rem',
                }}
              >
                Sign In →
              </button>
            </div>
          )}
        </div>

        {/* Guarantee */}
        <div style={{ textAlign: 'center', marginTop: 28, color: '#334155', fontSize: '0.78rem', lineHeight: 1.6 }}>
          Questions? Email <a href="mailto:support@walletdna.app" style={{ color: '#A855F7' }}>support@walletdna.app</a>
          {' · '}No refund policy applies after license activation.
        </div>

      </div>
    </motion.div>
  )
}
