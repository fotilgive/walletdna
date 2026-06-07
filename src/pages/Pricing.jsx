import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import useStore from '../store/useStore'
import toast from 'react-hot-toast'

const GUMROAD = {
  starter:  'YOUR_GUMROAD_STARTER_LINK_HERE',
  pro:      'YOUR_GUMROAD_PRO_LINK_HERE',
  lifetime: 'YOUR_GUMROAD_LIFETIME_LINK_HERE',
}

const PLANS = [
  {
    key: 'starter',
    name: 'Starter',
    price: 29,
    regularPrice: null,
    feats: ['Smart Money Feed', 'Smart Clusters', 'Token Intelligence'],
    color: 'var(--cyan)',
    hot: false,
    note: null,
  },
  {
    key: 'pro',
    name: 'Pro',
    price: 49,
    regularPrice: null,
    feats: ['Everything in Starter', 'Signal History + Backtest', 'Wallet Profiler'],
    color: 'var(--green)',
    hot: false,
    note: null,
  },
  {
    key: 'lifetime',
    name: 'Lifetime',
    price: 99,
    regularPrice: 149,
    feats: ['Everything in Pro', 'Telegram Auto-Alerts', 'All future updates', 'Pay once — forever'],
    color: 'var(--purple)',
    hot: true,
    note: 'Launch price — first 50 buyers',
  },
]

export default function Pricing() {
  const navigate = useNavigate()
  const { isPremium, setPremium } = useStore()
  const [licenseKey, setLicenseKey] = useState(
    isPremium ? localStorage.getItem('gumroad_license') || '' : ''
  )
  const [activating, setActivating] = useState(false)

  const handleActivate = () => {
    const key = licenseKey.trim()
    if (!key || !key.includes('-')) {
      toast.error('Enter a valid Gumroad license key (GUM-XXXX-XXXX-XXXX)')
      return
    }
    setActivating(true)
    setTimeout(() => {
      setPremium(true)
      localStorage.setItem('gumroad_license', key)
      setActivating(false)
      toast.success('License activated! Welcome to WalletDNA.', { icon: '🎉' })
      navigate('/')
    }, 800)
  }

  const handleDeactivate = () => {
    setPremium(false)
    localStorage.removeItem('gumroad_license')
    setLicenseKey('')
    toast('License deactivated.', { icon: '🔒' })
  }

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="anim-fade-up">

      <div className="page-header" style={{ textAlign: 'center', marginBottom: 40 }}>
        <div className="eyebrow">LICENSE</div>
        <h1>Activate <span className="gradient-text">WalletDNA</span></h1>
        <p style={{ maxWidth: 460, margin: '0 auto' }}>
          Buy once on Gumroad, paste your key below. No subscription. No servers to configure.
        </p>
      </div>

      <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* ── License activation ── */}
        <div className="card card-p" style={{
          border: isPremium ? '1px solid var(--green)' : '1px solid var(--border)',
          background: isPremium ? 'rgba(0,255,148,0.015)' : 'var(--bg-card)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
            <span style={{ fontSize: '1.8rem' }}>{isPremium ? '✅' : '🔑'}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 800, fontSize: '1.05rem', color: isPremium ? 'var(--green)' : 'var(--text-1)' }}>
                {isPremium ? 'License active — full access unlocked' : 'Enter your license key'}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginTop: 2 }}>
                {isPremium
                  ? 'You have full access to all features.'
                  : 'Purchased on Gumroad? Paste your key here.'}
              </div>
            </div>
            {isPremium && (
              <span className="badge badge-green">ACTIVE</span>
            )}
          </div>

          {!isPremium ? (
            <div style={{ display: 'flex', gap: 10 }}>
              <input
                className="input"
                placeholder="GUM-XXXX-XXXX-XXXX-XXXX"
                value={licenseKey}
                onChange={e => setLicenseKey(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleActivate()}
                style={{ fontFamily: 'var(--mono)', fontSize: '0.88rem', flex: 1 }}
                autoFocus
              />
              <button
                className="btn btn-primary"
                onClick={handleActivate}
                disabled={activating || !licenseKey.trim()}
                style={{ whiteSpace: 'nowrap', minWidth: 120 }}
              >
                {activating
                  ? <div className="spinner" style={{ width: 14, height: 14 }} />
                  : 'Activate →'}
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button className="btn btn-primary" onClick={() => navigate('/')} style={{ flex: 1 }}>
                Go to Live Feed →
              </button>
              <button className="btn btn-ghost" onClick={handleDeactivate}>
                Deactivate
              </button>
            </div>
          )}
        </div>

        {/* ── After activation — next steps ── */}
        {isPremium && (
          <div className="card card-p" style={{
            background: 'rgba(0,255,148,0.02)', border: '1px solid rgba(0,255,148,0.15)',
          }}>
            <div style={{ fontWeight: 800, fontSize: '1rem', marginBottom: 16, color: 'var(--green)' }}>
              🚀 Start here
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                ['Live Opportunities', 'See clusters forming right now', '/'],
                ['Signal Proof', '57 verified signals with real performance data', '/proof'],
                ['Telegram Alerts', 'Get pinged when smart money moves', '/alerts'],
              ].map(([label, desc, path]) => (
                <div
                  key={path}
                  onClick={() => navigate(path)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer',
                    padding: '12px 14px', borderRadius: 'var(--r-md)',
                    background: 'var(--bg-card)', border: '1px solid var(--border)',
                    transition: 'border-color var(--t)',
                  }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--green)'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{label}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-3)', marginTop: 2 }}>{desc}</div>
                  </div>
                  <span style={{ color: 'var(--green)', fontSize: '1.1rem' }}>→</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Buy section — only if not premium ── */}
        {!isPremium && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: 22 }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700, marginBottom: 6 }}>
                HAVEN'T PURCHASED YET?
              </div>
              <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-2)' }}>
                Buy on Gumroad → receive key by email → paste above
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
              {PLANS.map(p => (
                <motion.div
                  key={p.key}
                  whileHover={{ y: -3 }}
                  className="card card-p"
                  style={{
                    border: p.hot ? `2px solid ${p.color}` : '1px solid var(--border)',
                    boxShadow: p.hot ? `0 0 32px ${p.color}20` : 'none',
                    position: 'relative',
                  }}
                >
                  {p.hot && (
                    <div style={{
                      position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)',
                      background: p.color, color: '#fff',
                      fontSize: '0.64rem', fontWeight: 800, padding: '3px 12px',
                      borderRadius: 100, whiteSpace: 'nowrap', letterSpacing: '0.06em',
                    }}>
                      BEST VALUE
                    </div>
                  )}

                  <div style={{ fontWeight: 800, color: p.color, marginBottom: 6 }}>{p.name}</div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 2 }}>
                    <div style={{ fontSize: '2.4rem', fontWeight: 900, fontFamily: 'var(--mono)', lineHeight: 1, color: p.hot ? p.color : 'var(--text-1)' }}>
                      ${p.price}
                    </div>
                    {p.regularPrice && (
                      <div style={{ fontSize: '1.1rem', fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--text-3)', textDecoration: 'line-through' }}>
                        ${p.regularPrice}
                      </div>
                    )}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-3)', marginBottom: p.note ? 4 : 18 }}>one-time</div>
                  {p.note && (
                    <div style={{ fontSize: '0.68rem', color: p.color, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 14 }}>
                      🚀 {p.note}
                    </div>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
                    {p.feats.map(f => (
                      <div key={f} style={{ display: 'flex', gap: 8, fontSize: '0.85rem', color: 'var(--text-2)' }}>
                        <span style={{ color: 'var(--green)', flexShrink: 0, fontWeight: 700 }}>✓</span>
                        {f}
                      </div>
                    ))}
                  </div>

                  <a
                    href={GUMROAD[p.key]}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-primary"
                    style={{
                      width: '100%', justifyContent: 'center', textDecoration: 'none',
                      background: p.hot ? p.color : 'var(--bg-2)',
                      boxShadow: p.hot ? `0 0 20px ${p.color}40` : 'none',
                      gap: 8, display: 'flex', alignItems: 'center',
                    }}
                  >
                    Buy {p.name} —
                    {p.regularPrice && (
                      <span style={{ textDecoration: 'line-through', opacity: 0.6, fontSize: '0.9em' }}>${p.regularPrice}</span>
                    )}
                    <span style={{ fontWeight: 900 }}>${p.price}</span>
                    →
                  </a>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* ── What's included ── */}
        <div className="card card-p">
          <div style={{ fontWeight: 800, fontSize: '1rem', marginBottom: 16 }}>
            📦 Everything included
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12 }}>
            {[
              ['🎯', 'Smart Clusters', 'Real-time detection when 2+ alpha wallets pile into the same token.'],
              ['📊', 'Token Intelligence', 'One-glance verdict: accumulating, distributing, or mixed signals.'],
              ['✅', 'Signal Proof', '57 verified signals. Real GeckoTerminal prices. Wins and losses shown.'],
              ['📲', 'Telegram Alerts', 'Cluster forms → message lands. 24/7, no refreshing required.'],
              ['🏆', 'Smart Money Board', 'Verified wallets ranked by real alpha score.'],
              ['♾️', 'Future Updates', 'Every new feature, forever. One payment, done.'],
            ].map(([icon, title, desc]) => (
              <div key={title} style={{
                background: 'var(--bg-1)', border: '1px solid var(--border)',
                borderRadius: 'var(--r-md)', padding: '14px 16px',
              }}>
                <div style={{ fontSize: '1.4rem', marginBottom: 8 }}>{icon}</div>
                <div style={{ fontWeight: 700, fontSize: '0.88rem', marginBottom: 4 }}>{title}</div>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-3)', lineHeight: 1.55 }}>{desc}</div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </motion.div>
  )
}
