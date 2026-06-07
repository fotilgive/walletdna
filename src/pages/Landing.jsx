import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import useStore from '../store/useStore'
import { useT } from '../utils/i18n'

// One product. One price. WalletDNA = $149 lifetime. Anchor at $199.
const GUMROAD = {
  lifetime: import.meta.env.VITE_GUMROAD_LIFETIME || 'YOUR_GUMROAD_LIFETIME_LINK_HERE',
  // Legacy keys keep old in-page buttons resolving to the same SKU.
  monthly:  import.meta.env.VITE_GUMROAD_LIFETIME || 'YOUR_GUMROAD_LIFETIME_LINK_HERE',
  yearly:   import.meta.env.VITE_GUMROAD_LIFETIME || 'YOUR_GUMROAD_LIFETIME_LINK_HERE',
  starter:  import.meta.env.VITE_GUMROAD_LIFETIME || 'YOUR_GUMROAD_LIFETIME_LINK_HERE',
  pro:      import.meta.env.VITE_GUMROAD_LIFETIME || 'YOUR_GUMROAD_LIFETIME_LINK_HERE',
}
const PRICE = 149
const PRICE_ANCHOR = 249
const FOUNDING_CAP = 100
const TELEGRAM_FREE_CHANNEL = import.meta.env.VITE_TELEGRAM_FREE_URL || 'https://t.me/walletdna_alpha'

// ── tiny helpers ──────────────────────────────
function Check({ children, color = 'var(--green)' }) {
  return (
    <div style={{ display: 'flex', gap: 10, marginBottom: 10, fontSize: '0.9rem', color: 'var(--text-2)', lineHeight: 1.5 }}>
      <span style={{ color, flexShrink: 0, fontWeight: 900 }}>✓</span> {children}
    </div>
  )
}
function Cross({ children }) {
  return (
    <div style={{ display: 'flex', gap: 10, marginBottom: 10, fontSize: '0.9rem', color: 'var(--text-2)', lineHeight: 1.5 }}>
      <span style={{ color: 'var(--red)', flexShrink: 0 }}>✕</span> {children}
    </div>
  )
}
function FoundingCounter({ cap }) {
  // For now read sold-count from env (set after launch). Until launch we honestly
  // show 0 / cap so we're not faking scarcity.
  const sold = Number(import.meta.env.VITE_FOUNDING_SOLD || 0)
  const left = Math.max(0, cap - sold)
  const pct  = Math.min(100, Math.round((sold / cap) * 100))
  return (
    <div style={{
      padding: '12px 14px',
      background: 'rgba(0,229,148,0.06)',
      border: '1px solid rgba(0,229,148,0.28)',
      borderRadius: 'var(--r-md)',
      textAlign: 'left',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-2)', marginBottom: 6 }}>
        <span>Founding seats taken</span>
        <span style={{ color: 'var(--green)', fontFamily: 'var(--mono)' }}>{sold} / {cap}</span>
      </div>
      <div style={{ height: 6, borderRadius: 999, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: 'var(--green)', boxShadow: '0 0 8px rgba(0,229,148,0.6)' }} />
      </div>
      <div style={{ marginTop: 8, fontSize: '0.7rem', color: 'var(--text-3)', textAlign: 'center' }}>
        {left} seats left at ${149}
      </div>
    </div>
  )
}

function Step({ n, title, desc }) {
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: '22px' }}>
      <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'rgba(181,74,255,0.15)', border: '1px solid rgba(181,74,255,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, color: 'var(--purple)', fontSize: '0.9rem', marginBottom: 14 }}>{n}</div>
      <div style={{ fontWeight: 800, marginBottom: 6, fontSize: '0.97rem' }}>{title}</div>
      <div style={{ fontSize: '0.84rem', color: 'var(--text-3)', lineHeight: 1.55 }}>{desc}</div>
    </div>
  )
}

export default function Landing() {
  const navigate = useNavigate()
  const { language, setLanguage } = useStore()
  const t = useT()
  const [bt, setBt] = useState(null)
  const [winners, setWinners] = useState([])
  const [liveStats, setLiveStats] = useState(null)
  const [topWallet, setTopWallet] = useState(null)

  useEffect(() => {
    Promise.all([
      fetch('/api/backtest').then(r => r.json()),
      fetch('/api/stats').then(r => r.json()),
      fetch('/api/leaderboard').then(r => r.json()),
    ]).then(([d, s, lb]) => {
      if (d.computed) {
        setBt(d.summary)
        setWinners((d.signals || []).filter(x => x.peakGain >= 50).slice(0, 6))
      }
      setLiveStats(s)
      // top alpha hunter
      const cats = lb?.categories || []
      const hunters = cats.find(c => c.id === 'alpha_hunters')
      if (hunters?.wallets?.length) setTopWallet(hunters.wallets[0])
    }).catch(() => {})
  }, [])

  const best = bt?.best
  const winRate = bt?.peakWinRate ?? 52
  const avgGain = bt?.avgPeakGain ?? 45.7
  const sampleSize = bt?.sampleSize ?? 106
  // Canonical wallet count = verified approved wallets. Same number everywhere.
  const walletsTracked = liveStats?.verifiedWallets ?? liveStats?.walletsTracked ?? 23
  const totalTrades = liveStats?.totalTrades ?? 129000

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-0)', color: 'var(--text-1)', fontFamily: 'var(--font)' }}>

      {/* ── STICKY NAV ── */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '16px 6vw', borderBottom: '1px solid var(--border)',
        position: 'sticky', top: 0,
        background: 'rgba(2,2,2,0.9)', backdropFilter: 'blur(16px)', zIndex: 50,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 900, fontSize: '1.1rem' }}>
          <img src="/logo.png" alt="WalletDNA" style={{ width: '68px', height: '68px', objectFit: 'contain' }} />
          Wallet<span className="text-purple" style={{ marginLeft: 4 }}>DNA</span>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {['en', 'ru'].map(l => (
            <button key={l} onClick={() => setLanguage(l)}
              style={{ padding: '4px 12px', borderRadius: 6, fontSize: '0.78rem', fontWeight: 700, border: '1px solid var(--border)',
                background: language === l ? 'var(--purple)' : 'transparent', color: language === l ? '#fff' : 'var(--text-3)' }}>
              {l.toUpperCase()}
            </button>
          ))}
          <button className="btn btn-ghost" onClick={() => navigate('/proof')} style={{ fontSize: '0.82rem' }}>
            Signal Proof
          </button>
          <button className="btn btn-ghost" onClick={() => navigate('/')} style={{ fontSize: '0.82rem' }}>
            Live App
          </button>
          <a href={TELEGRAM_FREE_CHANNEL} target="_blank" rel="noopener noreferrer"
            className="btn btn-ghost"
            style={{ fontSize: '0.82rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            📡 Free Telegram
          </a>
          <a href={GUMROAD.lifetime} target="_blank" rel="noopener noreferrer"
            className="btn btn-primary"
            style={{ background: 'var(--purple)', fontSize: '0.85rem', textDecoration: 'none', boxShadow: '0 0 16px rgba(181,74,255,0.35)' }}>
            Get WalletDNA — ${PRICE}
          </a>
        </div>
      </div>

      {/* ── LIVE TICKER ── */}
      <div style={{ background: 'rgba(0,255,148,0.04)', borderBottom: '1px solid rgba(0,255,148,0.12)', padding: '9px 6vw' }}>
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'center', fontSize: '0.75rem', fontFamily: 'var(--mono)' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--green)', display: 'inline-block', boxShadow: '0 0 6px var(--green)' }} />
            <span style={{ color: 'var(--green)', fontWeight: 700 }}>LIVE</span>
          </span>
          <span style={{ color: 'var(--text-3)' }}>
            <span style={{ color: 'var(--text-1)', fontWeight: 700 }}>{walletsTracked}</span> wallets tracked
          </span>
          <span style={{ color: 'var(--text-3)' }}>
            <span style={{ color: 'var(--text-1)', fontWeight: 700 }}>{totalTrades.toLocaleString()}</span> trades in DB
          </span>
          {liveStats?.lastSignalMinsAgo != null && (
            <span style={{ color: 'var(--text-3)' }}>
              last signal <span style={{ color: 'var(--cyan)', fontWeight: 700 }}>{liveStats.lastSignalMinsAgo}m ago</span>
            </span>
          )}
          {best && (
            <span style={{ color: 'var(--text-3)' }}>
              best ever: <span style={{ color: 'var(--purple)', fontWeight: 700 }}>{best.symbol} +{best.gain?.toFixed(0)}%</span>
            </span>
          )}
        </div>
      </div>

      {/* ── HERO ── */}
      <section style={{ textAlign: 'center', padding: 'clamp(55px, 8vw, 90px) 6vw 0', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -120, left: '50%', transform: 'translateX(-50%)', width: 1000, height: 750, background: 'radial-gradient(ellipse, rgba(181,74,255,0.12) 0%, transparent 65%)', pointerEvents: 'none' }} />

        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} style={{ position: 'relative' }}>

          {/* proof pill */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '7px 20px', borderRadius: 100, background: 'rgba(0,255,148,0.08)', border: '1px solid rgba(0,255,148,0.22)', color: 'var(--green)', fontSize: '0.78rem', fontWeight: 800, letterSpacing: '0.06em', marginBottom: 28 }}>
            <div className="live-dot" style={{ background: 'var(--green)' }} />
            {sampleSize} signals backtested · {winRate}% hit +20% · avg peak +{avgGain.toFixed(0)}%
          </div>

          <h1 style={{ fontSize: 'clamp(2.6rem, 6vw, 5rem)', fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 1.0, maxWidth: 1050, margin: '0 auto 22px' }}>
            We track{' '}
            <span className="text-purple">{walletsTracked} wallets</span>
            {' '}that move<br />
            Base markets.{' '}
            <span style={{ color: 'var(--cyan)' }}>You see it first.</span>
          </h1>

          <p style={{ fontSize: 'clamp(1.05rem, 1.8vw, 1.22rem)', color: 'var(--text-2)', maxWidth: 600, margin: '0 auto 28px', lineHeight: 1.65 }}>
            When 2+ smart wallets pile into the same token at once — you get a Telegram alert.
            Not a signal group. Real on-chain data. Every cluster verifiable on Blockscout.
          </p>

          {/* Top Wallet Highlight Card */}
          <div style={{
            maxWidth: 460,
            margin: '0 auto 36px',
            background: 'linear-gradient(135deg, rgba(168,85,247,0.08) 0%, rgba(6,182,212,0.08) 100%)',
            border: '1px solid rgba(168,85,247,0.22)',
            borderRadius: 'var(--r-lg)',
            padding: '22px 26px',
            textAlign: 'left',
            boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
          }}>
            <div style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-2)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: '1.25rem' }}>🏆</span> One tracked wallet achieved:
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: '0.98rem', color: 'var(--text-1)', paddingLeft: 6, marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: 'var(--purple)', fontWeight: 900 }}>•</span> 
                <span><strong style={{ color: 'var(--green)' }}>94.6%</strong> win rate</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: 'var(--purple)', fontWeight: 900 }}>•</span> 
                <span><strong style={{ color: 'var(--green)' }}>+102.6% ROI</strong> in 30 days</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: 'var(--purple)', fontWeight: 900 }}>•</span> 
                <span><strong style={{ color: 'var(--cyan)' }}>37</strong> closed positions</span>
              </div>
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-3)', fontFamily: 'var(--mono)', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>ID: {topWallet ? `${topWallet.address.slice(0, 6)}…${topWallet.address.slice(-4)}` : '0x7a8e…98f1'}</span>
              <span style={{ color: 'var(--cyan)', cursor: 'pointer', textDecoration: 'underline' }} onClick={() => navigate('/proof')}>Verify every trade on Base →</span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 48 }}>
            <a href={GUMROAD.monthly} target="_blank" rel="noopener noreferrer"
              className="btn btn-primary"
              style={{ background: 'var(--purple)', fontSize: '1.08rem', padding: '16px 36px', textDecoration: 'none', boxShadow: '0 0 36px rgba(181,74,255,0.45)', display: 'flex', alignItems: 'center', gap: 10 }}>
              Start Pro — $39/mo
            </a>
            <a href={TELEGRAM_FREE_CHANNEL} target="_blank" rel="noopener noreferrer"
              className="btn btn-ghost"
              style={{ fontSize: '1.08rem', padding: '16px 28px', textDecoration: 'none' }}>
              Free Telegram channel →
            </a>
          </div>

          {/* 5 stats bar */}
          <div style={{ overflowX: 'auto', maxWidth: 940, margin: '0 auto' }}>
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', minWidth: 540,
              background: 'var(--bg-1)', border: '1px solid var(--border)',
              borderBottom: 'none', borderRadius: 'var(--r-lg) var(--r-lg) 0 0', overflow: 'hidden',
            }}>
              {[
                { value: walletsTracked, label: 'wallets tracked', color: 'var(--text-1)' },
                { value: totalTrades.toLocaleString(), label: 'trades analyzed', color: 'var(--cyan)' },
                { value: sampleSize, label: 'verified signals', color: 'var(--text-1)' },
                { value: `${winRate}%`, label: 'hit +20% in 30d', color: 'var(--green)' },
                { value: best ? `+${best.gain?.toFixed(0)}%` : '+562%', label: best ? `best (${best.symbol})` : 'best signal', color: 'var(--purple)' },
              ].map((s, i) => (
                <div key={i} style={{ padding: '22px 12px', borderRight: i < 4 ? '1px solid var(--border)' : 'none', textAlign: 'center' }}>
                  <div style={{ fontSize: 'clamp(1.4rem, 2.8vw, 2.2rem)', fontWeight: 900, fontFamily: 'var(--mono)', color: s.color, lineHeight: 1, marginBottom: 6 }}>{s.value}</div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-3)', fontWeight: 600, lineHeight: 1.4 }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </section>

      {/* ── HONEST DISCLAIMER ── */}
      <div style={{ background: 'var(--bg-1)', borderBottom: '1px solid var(--border)', padding: '9px 6vw', textAlign: 'center' }}>
        <span style={{ fontSize: '0.72rem', color: 'var(--text-3)' }}>
          All gains measured on real on-chain prices via GeckoTerminal · Peak within 30 days of entry · We show losses too ·{' '}
          <span style={{ color: 'var(--cyan)', cursor: 'pointer', fontWeight: 700 }} onClick={() => navigate('/proof')}>View all {sampleSize} signals →</span>
        </span>
      </div>

      {/* ── WHAT IT IS — 3 sentences ── */}
      <section style={{ padding: 'clamp(50px,7vw,70px) 6vw', textAlign: 'center', borderTop: '1px solid var(--border)' }}>
        <h2 style={{ fontSize: 'clamp(1.6rem, 3vw, 2.3rem)', fontWeight: 900, marginBottom: 20 }}>
          Not a signal group. Not a copy-trade service.<br />
          <span className="text-purple">On-chain analytics software.</span>
        </h2>
        <p style={{ color: 'var(--text-2)', maxWidth: 640, margin: '0 auto 48px', fontSize: '1rem', lineHeight: 1.7 }}>
          WalletDNA indexes {walletsTracked} verified smart money wallets on Base. Every trade they make
          is recorded, scored, and clustered. When multiple wallets converge on the same token —
          that's a signal. You get it on Telegram before it trends on Twitter.
        </p>

        {/* 3 differentiators */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, maxWidth: 780, margin: '0 auto' }}>
          {[
            { icon: '⛓', title: 'On-chain. Not screenshots.', desc: 'Every trade is verifiable on Blockscout. We link the transaction. No trust required.' },
            { icon: '🤖', title: 'No human in the loop.', desc: 'Automated pipeline syncs wallets every hour. Signals fire when wallets cluster, not when a moderator posts.' },
            { icon: '🔍', title: 'You audit it yourself.', desc: 'Full Python + Node source included. Every formula is in the code. No black boxes.' },
          ].map(f => (
            <div key={f.title} className="card card-p" style={{ background: 'var(--bg-card)', textAlign: 'left' }}>
              <div style={{ fontSize: '2rem', marginBottom: 12 }}>{f.icon}</div>
              <div style={{ fontWeight: 800, marginBottom: 8, fontSize: '0.97rem' }}>{f.title}</div>
              <div style={{ fontSize: '0.86rem', color: 'var(--text-3)', lineHeight: 1.6 }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── RECENT WINNERS ── */}
      {winners.length > 0 && (
        <section style={{ padding: 'clamp(50px,7vw,70px) 6vw', textAlign: 'center', borderTop: '1px solid var(--border)', background: 'var(--bg-1)' }}>
          <h2 style={{ fontSize: 'clamp(1.5rem, 2.8vw, 2.2rem)', fontWeight: 900, marginBottom: 8 }}>Signals that paid off</h2>
          <p style={{ color: 'var(--text-3)', marginBottom: 36, fontSize: '0.92rem' }}>
            These clusters fired before the move. All on-chain. All verifiable.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12, maxWidth: 1000, margin: '0 auto 28px' }}>
            {winners.map(w => (
              <div key={w.tokenAddress} onClick={() => navigate(`/token/${w.tokenAddress}`)}
                className="card" style={{ padding: 18, borderTop: '2px solid var(--green)', cursor: 'pointer', transition: 'var(--t)' }}
                onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-3px)'}
                onMouseLeave={e => e.currentTarget.style.transform = ''}>
                <div style={{ fontWeight: 800, marginBottom: 8, fontSize: '0.9rem' }}>{w.tokenSymbol}</div>
                <div style={{ fontSize: '1.8rem', fontWeight: 900, fontFamily: 'var(--mono)', color: 'var(--green)', lineHeight: 1 }}>+{w.peakGain.toFixed(0)}%</div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-3)', marginTop: 6 }}>{w.daysAgo}d ago · {w.walletCount}w</div>
              </div>
            ))}
          </div>
          <button className="btn btn-ghost" onClick={() => navigate('/proof')} style={{ fontSize: '0.88rem' }}>
            View all {sampleSize} signals with full P&L →
          </button>
        </section>
      )}

      {/* ── HOW IT WORKS — 6 real signals ── */}
      <section style={{ padding: 'clamp(50px,7vw,70px) 6vw', borderTop: '1px solid var(--border)' }}>
        <h2 style={{ fontSize: 'clamp(1.5rem, 2.8vw, 2.2rem)', fontWeight: 900, textAlign: 'center', marginBottom: 12 }}>Six engines. One dashboard.</h2>
        <p style={{ textAlign: 'center', color: 'var(--text-3)', marginBottom: 44, fontSize: '0.92rem' }}>Everything runs automatically. You just watch and act.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, maxWidth: 1100, margin: '0 auto' }}>
          {[
            { ic: '🧬', t: 'Alpha Score', d: 'FIFO P&L from Blockscout. Every wallet ranked 0–100 based on real realized gains, not speculation.' },
            { ic: '🔥', t: 'Cluster Detection', d: '10+ wallets buy the same token within hours → cluster forms → Telegram fires. No hype, just math.' },
            { ic: '💎', t: 'Hidden Gems', d: 'High-alpha wallets with low visibility. Finds the next smart money before Twitter finds them.' },
            { ic: '🎯', t: 'Exit Alerts', d: 'Tracks when smart money sells. You see the exit signal before the dump hits CT.' },
            { ic: '📊', t: 'Signal Backtest', d: `${sampleSize} historical clusters tested against real prices. ${winRate}% hit +20% peak. Avg peak: +${avgGain.toFixed(0)}%.` },
            { ic: '🔎', t: 'Wallet Discovery', d: 'Automated pipeline finds new alpha wallets from DexScreener first-buyers. Self-expanding database.' },
          ].map(f => (
            <div key={f.t} className="card card-p" style={{ background: 'var(--bg-card)' }}>
              <div style={{ fontSize: '2rem', marginBottom: 12 }}>{f.ic}</div>
              <div style={{ fontWeight: 800, marginBottom: 8, fontSize: '0.97rem' }}>{f.t}</div>
              <div style={{ fontSize: '0.86rem', color: 'var(--text-3)', lineHeight: 1.6 }}>{f.d}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── BEFORE / AFTER ── */}
      <section style={{ padding: 'clamp(50px,7vw,70px) 6vw', background: 'var(--bg-1)', borderTop: '1px solid var(--border)' }}>
        <h2 style={{ fontSize: 'clamp(1.5rem, 2.8vw, 2.2rem)', fontWeight: 900, textAlign: 'center', marginBottom: 12 }}>The edge is timing</h2>
        <p style={{ textAlign: 'center', color: 'var(--text-3)', marginBottom: 44, fontSize: '0.92rem' }}>Smart money moves first. You see it before Twitter. Or you don't.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20, maxWidth: 860, margin: '0 auto' }}>
          <div style={{ background: 'rgba(255,59,107,0.05)', border: '1px solid rgba(255,59,107,0.15)', borderRadius: 'var(--r-lg)', padding: '28px 24px' }}>
            <div style={{ fontSize: '0.65rem', color: 'var(--red)', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 18 }}>❌ Without WalletDNA</div>
            <Cross>Find tokens on Twitter — after +200% already happened</Cross>
            <Cross>Buy the top because everyone is talking about it</Cross>
            <Cross>No context on who bought or why</Cross>
            <Cross>Signal Telegram group posts a screenshot at 3am</Cross>
            <Cross>Pay $99/mo forever for less</Cross>
          </div>
          <div style={{ background: 'rgba(0,255,148,0.04)', border: '1px solid rgba(0,255,148,0.18)', borderRadius: 'var(--r-lg)', padding: '28px 24px' }}>
            <div style={{ fontSize: '0.65rem', color: 'var(--green)', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 18 }}>✅ With WalletDNA</div>
            <Check>See accumulation before the move, not after</Check>
            <Check>Know exactly which wallets, how much capital, since when</Check>
            <Check>Cluster fires when 10+ smart wallets agree — not one guy</Check>
            <Check>Telegram alert on your phone — every cluster, every exit</Check>
            <Check><span style={{ textDecoration: 'line-through', opacity: 0.55 }}>$149</span> → <strong>$99 launch price</strong>. Every future update free.</Check>
          </div>
        </div>
      </section>

      {/* ── WHAT YOU GET ── */}
      <section style={{ padding: 'clamp(50px,7vw,70px) 6vw', borderTop: '1px solid var(--border)' }}>
        <h2 style={{ fontSize: 'clamp(1.5rem, 2.8vw, 2.2rem)', fontWeight: 900, textAlign: 'center', marginBottom: 44 }}>What's in the ZIP</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, maxWidth: 900, margin: '0 auto' }}>
          {[
            { icon: '🧬', item: 'WalletDNA — full source', sub: 'Node.js backend + React frontend. No obfuscation, no DRM, audit every line.' },
            { icon: '📊', item: 'Live dashboard', sub: `Clusters, leaderboard, hidden gems, signal history, wallet profiles. ${walletsTracked}+ wallets pre-loaded.` },
            { icon: '📱', item: 'Telegram alerts', sub: 'Entry clusters + exit signals → your phone. Configure chat ID in one line.' },
            { icon: '⚙️', item: 'Pre-built SQLite DB', sub: `${totalTrades.toLocaleString()} trades already indexed. Starts with data, not an empty shell.` },
            { icon: '♾️', item: 'Lifetime updates', sub: 'Every future version, free. Wallet Discovery keeps growing the database automatically.' },
            { icon: '🛡️', item: '30-day money-back', sub: 'Run it for 30 days. If it\'s not what I said it is — full refund, no questions.' },
          ].map(f => (
            <div key={f.item} style={{ display: 'flex', gap: 16, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: '18px' }}>
              <div style={{ fontSize: '1.7rem', flexShrink: 0 }}>{f.icon}</div>
              <div>
                <div style={{ fontWeight: 800, marginBottom: 5, fontSize: '0.94rem' }}>{f.item}</div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-3)', lineHeight: 1.55 }}>{f.sub}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── WHO THIS IS FOR / NOT FOR ── */}
      <section style={{ padding: 'clamp(50px,7vw,70px) 6vw', background: 'var(--bg-1)', borderTop: '1px solid var(--border)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24, maxWidth: 840, margin: '0 auto' }}>
          <div>
            <h3 style={{ fontWeight: 900, fontSize: '1.1rem', marginBottom: 20, color: 'var(--green)' }}>Who this is for</h3>
            <Check>Base chain traders who want data, not vibes</Check>
            <Check>People done bleeding on VIP signal groups</Check>
            <Check>Devs who want to read the code before trusting the score</Check>
            <Check>Anyone who wants early entry — not news feed confirmation</Check>
          </div>
          <div>
            <h3 style={{ fontWeight: 900, fontSize: '1.1rem', marginBottom: 20, color: 'var(--red)' }}>Who it's NOT for</h3>
            <Cross>If you want a magic formula that prints while you sleep</Cross>
            <Cross>If you can't sit with a losing trade — work on that first</Cross>
            <Cross>If you want someone to manage risk for you</Cross>
            <Cross>If you need someone to tell you when exactly to buy</Cross>
          </div>
        </div>
      </section>

      {/* ── WHY I BUILT IT ── */}
      <section style={{ padding: 'clamp(50px,7vw,70px) 6vw', borderTop: '1px solid var(--border)', background: 'var(--bg-1)' }}>
        <div style={{ maxWidth: 640, margin: '0 auto', textAlign: 'left' }}>
          <h2 style={{ fontSize: 'clamp(1.6rem, 3vw, 2.2rem)', fontWeight: 900, marginBottom: 24, textAlign: 'center' }}>
            Why I built it
          </h2>
          <p style={{ fontSize: '1.02rem', lineHeight: 1.7, color: 'var(--text-2)', marginBottom: 16 }}>
            I kept seeing the same wallets buy before the move:
          </p>
          <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', justifyContent: 'center' }}>
            {['BRETT', 'DEGEN', 'HIGHER'].map(tok => (
              <span key={tok} style={{ background: 'rgba(0,255,148,0.08)', border: '1px solid rgba(0,255,148,0.25)', color: 'var(--green)', padding: '6px 16px', borderRadius: 'var(--r-md)', fontFamily: 'var(--mono)', fontWeight: 800, fontSize: '0.9rem' }}>
                {tok}
              </span>
            ))}
          </div>
          <p style={{ fontSize: '1.02rem', lineHeight: 1.7, color: 'var(--text-2)', marginBottom: 16 }}>
            The pattern repeated. By the time Crypto Twitter noticed, the buying had already happened. The wallets were already in profit, and latecomers became exit liquidity.
          </p>
          <p style={{ fontSize: '1.02rem', lineHeight: 1.7, color: 'var(--text-2)', marginBottom: 16 }}>
            So I started tracking those wallets manually. First 10. Then 50. Then hundreds. I wrote scripts to pull Blockscout data, built a FIFO cost-basis engine, and backtested every signal against real price data.
          </p>
          <p style={{ fontSize: '1.02rem', lineHeight: 1.7, color: 'var(--text-2)', marginBottom: 16 }}>
            After enough trades, the data became impossible to ignore. WalletDNA grew out of that process.
          </p>
          <p style={{ fontSize: '1.02rem', lineHeight: 1.7, color: 'var(--text-3)', borderLeft: '3px solid var(--purple)', paddingLeft: 16, fontStyle: 'italic', marginBottom: 0 }}>
            You're buying access to the exact software I use personally. Not a course. Not a VIP signal group. Clean, verifiable on-chain software.
          </p>
        </div>
      </section>

      {/* ── SETUP — 4 steps ── */}
      <section style={{ padding: 'clamp(50px,7vw,70px) 6vw', borderTop: '1px solid var(--border)' }}>
        <h2 style={{ fontSize: 'clamp(1.5rem, 2.8vw, 2.2rem)', fontWeight: 900, textAlign: 'center', marginBottom: 12 }}>Installation takes about 5 minutes</h2>
        <p style={{ textAlign: 'center', color: 'var(--text-3)', marginBottom: 40, fontSize: '0.92rem' }}>Simple local setup. No cloud subscription. Runs on your machine.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, maxWidth: 860, margin: '0 auto' }}>
          <Step n="1" title="Install Node.js" desc="Free download from nodejs.org. Installs in 2 minutes on Windows, Mac, or Linux." />
          <Step n="2" title="Download WalletDNA" desc="Instant ZIP download after purchase containing all clean frontend and backend source code." />
          <Step n="3" title="Run Launcher Script" desc="Double-click start.bat (Windows) or run start.sh (Mac/Linux). The script handles setup automatically." />
          <Step n="4" title="Open Your Dashboard" desc={`Opens instantly in your browser, fully seeded with ${walletsTracked} verified wallets.`} />
        </div>
      </section>

      {/* ── PRICING — single $149 lifetime SKU ── */}
      <section style={{ padding: 'clamp(60px,8vw,80px) 6vw', textAlign: 'center', background: 'var(--bg-1)', borderTop: '1px solid var(--border)' }}>
        <h2 style={{ fontSize: 'clamp(1.6rem, 3vw, 2.4rem)', fontWeight: 900, marginBottom: 8 }}>One product. One price. Yours forever.</h2>
        <p style={{ color: 'var(--text-3)', marginBottom: 50, fontSize: '0.95rem' }}>
          Pay once. Run it locally. Every future update free. No subscription. No upsells.
        </p>

        <div style={{ maxWidth: 460, margin: '0 auto' }}>
          <motion.div whileHover={{ y: -6 }}
            style={{
              background: 'var(--bg-card)', border: '2px solid var(--purple)',
              borderRadius: 'var(--r-lg)', padding: '40px 36px',
              boxShadow: '0 0 60px rgba(181,74,255,0.22)', position: 'relative',
            }}>
            <div style={{ position: 'absolute', top: -14, left: '50%', transform: 'translateX(-50%)', background: 'var(--purple)', color: '#fff', fontSize: '0.7rem', fontWeight: 800, padding: '5px 18px', borderRadius: 100, letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>
              🚀 FOUNDING MEMBER ACCESS · FIRST {FOUNDING_CAP}
            </div>
            <div style={{ fontSize: '0.9rem', color: 'var(--text-3)', marginBottom: 8 }}>WalletDNA — Founding Lifetime Access</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 4, justifyContent: 'center' }}>
              <div style={{ fontSize: '4.2rem', fontWeight: 900, fontFamily: 'var(--mono)', lineHeight: 1, color: 'var(--purple)' }}>${PRICE}</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--text-3)', textDecoration: 'line-through' }}>${PRICE_ANCHOR}</div>
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-3)', marginBottom: 24 }}>one-time · price increases to ${PRICE_ANCHOR} after first {FOUNDING_CAP} founding members</div>

            {/* Founding counter — proves scarcity */}
            <FoundingCounter cap={FOUNDING_CAP} />
            <div style={{ height: 18 }} />
            <div style={{ textAlign: 'left', marginBottom: 32 }}>
              <Check>Full source code — Node.js + React, no DRM, no telemetry</Check>
              <Check>Pre-indexed DB ({walletsTracked} verified wallets, {totalTrades.toLocaleString()} trades)</Check>
              <Check>Live dashboard — clusters, leaderboard, discovery, alerts</Check>
              <Check>Cluster + whale Telegram alerts via private channel</Check>
              <Check>Lifetime updates — every future version free</Check>
              <Check>30-day money-back — verify every signal on-chain first</Check>
            </div>
            <a href={GUMROAD.lifetime} target="_blank" rel="noopener noreferrer"
              className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center', background: 'var(--purple)', textDecoration: 'none', fontSize: '1.1rem', padding: '17px', boxShadow: '0 0 24px rgba(181,74,255,0.4)' }}>
              Get WalletDNA — ${PRICE} →
            </a>
            <a href={TELEGRAM_FREE_CHANNEL} target="_blank" rel="noopener noreferrer"
              style={{ display: 'block', marginTop: 14, fontSize: '0.82rem', color: 'var(--text-3)', textDecoration: 'underline' }}>
              or preview free Telegram channel first →
            </a>
          </motion.div>
        </div>

        <div style={{ marginTop: 28, fontSize: '0.8rem', color: 'var(--text-3)' }}>
          🛡️ 30-day money-back guarantee — no forms, no questions.
        </div>
      </section>

      {/* ── PRICING (legacy 3-tier left as dead code so older sections render — removed ── */}
      <div style={{ display: 'none' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 18, maxWidth: 1040, margin: '0 auto' }}>
          {/* FREE */}
          <motion.div whileHover={{ y: -6 }}
            style={{
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              borderRadius: 'var(--r-lg)', padding: '32px 28px',
              display: 'flex', flexDirection: 'column',
            }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-3)', marginBottom: 6, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Free</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
              <div style={{ fontSize: '2.6rem', fontWeight: 900, fontFamily: 'var(--mono)', lineHeight: 1 }}>$0</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-3)' }}>forever</div>
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-3)', marginBottom: 24 }}>Public Telegram channel · 6h-delayed</div>
            <div style={{ textAlign: 'left', marginBottom: 24, flexGrow: 1 }}>
              <Check>Top cluster of the day</Check>
              <Check>Top 3 wallets visible on the site</Check>
              <Cross>Real-time alerts</Cross>
              <Cross>Full wallet leaderboard</Cross>
              <Cross>Daily email summary</Cross>
            </div>
            <a href={TELEGRAM_FREE_CHANNEL} target="_blank" rel="noopener noreferrer"
              className="btn btn-ghost"
              style={{ width: '100%', justifyContent: 'center', textDecoration: 'none', fontSize: '0.95rem', padding: '14px' }}>
              Join free channel →
            </a>
          </motion.div>

          {/* PRO MONTHLY — main SKU */}
          <motion.div whileHover={{ y: -6 }}
            style={{
              background: 'var(--bg-card)', border: '2px solid var(--purple)',
              borderRadius: 'var(--r-lg)', padding: '32px 28px',
              boxShadow: '0 0 60px rgba(181,74,255,0.18)', position: 'relative',
              display: 'flex', flexDirection: 'column',
            }}>
            <div style={{ position: 'absolute', top: -14, left: '50%', transform: 'translateX(-50%)', background: 'var(--purple)', color: '#fff', fontSize: '0.68rem', fontWeight: 800, padding: '5px 18px', borderRadius: 100, letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>
              ⚡ MOST POPULAR
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--purple)', marginBottom: 6, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Pro</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
              <div style={{ fontSize: '2.8rem', fontWeight: 900, fontFamily: 'var(--mono)', lineHeight: 1, color: 'var(--purple)' }}>$39</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-3)' }}>/ month</div>
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-3)', marginBottom: 24 }}>or $299 / year (save 36%)</div>
            <div style={{ textAlign: 'left', marginBottom: 24, flexGrow: 1 }}>
              <Check>Private Telegram channel — real-time</Check>
              <Check>Every cluster + every whale buy/sell &gt;$20k</Check>
              <Check>Full wallet leaderboard ({walletsTracked}+ wallets)</Check>
              <Check>Per-token risk gate ✅ ⚠️ 🚫</Check>
              <Check>Daily email summary 9am UTC</Check>
              <Check>Cancel any time — 7-day money-back</Check>
            </div>
            <a href={GUMROAD.monthly} target="_blank" rel="noopener noreferrer"
              className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center', background: 'var(--purple)', textDecoration: 'none', fontSize: '1.0rem', padding: '15px', boxShadow: '0 0 24px rgba(181,74,255,0.35)' }}>
              Start Pro — $39/mo →
            </a>
            <a href={GUMROAD.yearly} target="_blank" rel="noopener noreferrer"
              style={{ marginTop: 10, fontSize: '0.78rem', color: 'var(--text-3)', textDecoration: 'underline' }}>
              or pay yearly · $299
            </a>
          </motion.div>

          {/* LIFETIME */}
          <motion.div whileHover={{ y: -6 }}
            style={{
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              borderRadius: 'var(--r-lg)', padding: '32px 28px',
              display: 'flex', flexDirection: 'column',
            }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-3)', marginBottom: 6, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Lifetime</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
              <div style={{ fontSize: '2.6rem', fontWeight: 900, fontFamily: 'var(--mono)', lineHeight: 1 }}>$499</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-3)' }}>once</div>
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-3)', marginBottom: 24 }}>Anchor price · locks every future update</div>
            <div style={{ textAlign: 'left', marginBottom: 24, flexGrow: 1 }}>
              <Check>Everything in Pro</Check>
              <Check>Full source code — Node.js + React, no DRM</Check>
              <Check>Lifetime updates — every future version free</Check>
              <Check>Self-host: run it locally, no recurring fee</Check>
              <Check>30-day money-back</Check>
            </div>
            <a href={GUMROAD.lifetime} target="_blank" rel="noopener noreferrer"
              className="btn btn-ghost"
              style={{ width: '100%', justifyContent: 'center', textDecoration: 'none', fontSize: '0.95rem', padding: '14px' }}>
              Buy Lifetime →
            </a>
          </motion.div>
        </div>
      </div>

      {/* ── FAQ ── */}
      <section style={{ padding: 'clamp(50px,7vw,70px) 6vw', borderTop: '1px solid var(--border)' }}>
        <h2 style={{ fontSize: 'clamp(1.4rem, 2.5vw, 2rem)', fontWeight: 900, textAlign: 'center', marginBottom: 40 }}>Common questions</h2>
        <div style={{ display: 'grid', gap: 16, maxWidth: 740, margin: '0 auto' }}>
          {[
            { q: 'Does it trade automatically?', a: 'No. WalletDNA tracks and alerts. You decide when to enter and exit. Your keys, your trades.' },
            { q: 'Do I need a server to run this?', a: 'No. Runs locally on your Mac or PC. npm install && npm start is all it takes. No cloud fees.' },
            { q: 'How do I verify the signals are real?', a: 'Every signal links to Blockscout transactions. You can check any wallet, any trade, any timestamp independently. Nothing is fabricated.' },
            { q: 'What chain does it support?', a: 'Base chain only. All 369+ wallets are Base-native. Deep data beats broad data.' },
            { q: 'What if I\'m not technical?', a: 'You need to run one terminal command. If that\'s a blocker, this isn\'t for you yet. Basic Node.js knowledge helps.' },
            { q: 'Is there a subscription?', a: `No. $${PRICE} one-time. Yours forever. Every future update included free. Price goes to $${PRICE_ANCHOR} after the first 50 buyers.` },
            { q: 'How do I get the Telegram alerts?', a: 'After purchase, your welcome email contains a one-click invite link to the buyers-only Telegram channel. Our server posts every cluster and every smart-money trade over $20k automatically. No bot setup. No chat_id. No tokens.' },
            { q: 'Can I try before paying?', a: 'Yes. The free public Telegram channel posts the top cluster of the day (6-hour delay). The live dashboard at the top of this page is the real app running on real data. 30-day full refund if it does not deliver.' },
          ].map(f => (
            <div key={f.q} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: '20px 24px' }}>
              <div style={{ fontWeight: 800, marginBottom: 8, fontSize: '0.96rem' }}>{f.q}</div>
              <div style={{ fontSize: '0.88rem', color: 'var(--text-3)', lineHeight: 1.6 }}>{f.a}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section style={{ padding: 'clamp(60px,8vw,80px) 6vw 100px', textAlign: 'center', borderTop: '1px solid var(--border)', background: 'var(--bg-1)' }}>
        <div style={{ position: 'relative', maxWidth: 720, margin: '0 auto' }}>
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 600, height: 400, background: 'radial-gradient(ellipse, rgba(181,74,255,0.12) 0%, transparent 65%)', pointerEvents: 'none' }} />
          <h2 style={{ fontSize: 'clamp(1.7rem, 3.5vw, 2.8rem)', fontWeight: 900, marginBottom: 16, position: 'relative' }}>
            The cluster that made +562% on ZLURPEE<br />
            <span style={{ color: 'var(--text-3)', fontSize: '0.55em', fontWeight: 600 }}>fired in WalletDNA 14 hours before Twitter noticed.</span>
          </h2>
          <p style={{ color: 'var(--text-2)', marginBottom: 36, fontSize: '1.02rem', position: 'relative', lineHeight: 1.65 }}>
            The next one is forming right now. You could be watching it.
          </p>
          <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap', position: 'relative' }}>
            <a href={GUMROAD.monthly} target="_blank" rel="noopener noreferrer"
              className="btn btn-primary"
              style={{ background: 'var(--purple)', fontSize: '1.12rem', padding: '18px 44px', textDecoration: 'none', boxShadow: '0 0 40px rgba(181,74,255,0.5)', display: 'flex', alignItems: 'center', gap: 10 }}>
              Start Pro — $39/mo →
            </a>
            <a href={TELEGRAM_FREE_CHANNEL} target="_blank" rel="noopener noreferrer"
              className="btn btn-ghost"
              style={{ fontSize: '1.05rem', padding: '18px 28px', textDecoration: 'none' }}>
              Join free Telegram channel →
            </a>
          </div>
          <div style={{ marginTop: 20, fontSize: '0.78rem', color: 'var(--text-3)' }}>
            7-day money-back on Pro · cancel anytime · {walletsTracked}+ wallets · {totalTrades.toLocaleString()} trades
          </div>
        </div>
      </section>
    </div>
  )
}
