import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import useStore from '../store/useStore'
import { apiFetch } from '../utils/api'

const GUMROAD = import.meta.env.VITE_GUMROAD_URL || 'https://walletdna.gumroad.com/l/walletdna'
const PRICE = 149
const PRICE_ANCHOR = 249
const FOUNDING_CAP = 50

function Check({ children }) {
  return (
    <div style={{ display: 'flex', gap: 10, marginBottom: 10, fontSize: '0.9rem', color: 'var(--text-2)', lineHeight: 1.5 }}>
      <span style={{ color: 'var(--green)', flexShrink: 0, fontWeight: 900 }}>✓</span> {children}
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

export default function Landing() {
  const navigate = useNavigate()
  const { user, token } = useStore()
  const [liveStats, setLiveStats] = useState(null)
  const [bt, setBt] = useState(null)
  const [winners, setWinners] = useState([])

  useEffect(() => {
    if (token && user) { navigate('/'); return }
    Promise.all([
      apiFetch('/api/stats').then(r => r.json()).catch(() => null),
      apiFetch('/api/backtest').then(r => r.json()).catch(() => null),
    ]).then(([s, d]) => {
      if (s) setLiveStats(s)
      if (d && d.computed) {
        setBt(d.summary)
        setWinners((d.signals || []).filter(x => x.peakGain >= 50).slice(0, 6))
      }
    })
  }, [])

  const walletsTracked = liveStats?.verifiedWallets ?? '-'
  const totalTrades = liveStats?.totalTrades ?? '-'
  const winRate = bt?.peakWinRate ?? '-'
  const avgGain = bt?.avgPeakGain ?? '-'
  const sampleSize = bt?.sampleSize ?? '-'
  const best = bt?.best

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-0)', color: 'var(--text-1)', fontFamily: 'var(--font)' }}>

      {/* ── NAV ── */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '16px 6vw', borderBottom: '1px solid var(--border)',
        position: 'sticky', top: 0,
        background: 'rgba(2,2,2,0.92)', backdropFilter: 'blur(16px)', zIndex: 50,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 900, fontSize: '1.1rem' }}>
          🧬 Wallet<span className="text-purple">DNA</span>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button className="btn btn-ghost" onClick={() => navigate('/login')} style={{ fontSize: '0.85rem' }}>
            Sign In
          </button>
          <a href={GUMROAD} target="_blank" rel="noopener noreferrer"
            className="btn btn-primary"
            style={{ background: 'var(--purple)', fontSize: '0.85rem', textDecoration: 'none', boxShadow: '0 0 16px rgba(181,74,255,0.35)' }}>
            Get Access — ${PRICE}
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
            <span style={{ color: 'var(--text-1)', fontWeight: 700 }}>{typeof totalTrades === 'number' ? totalTrades.toLocaleString() : totalTrades}</span> trades analyzed
          </span>
          {liveStats?.lastSignalMinsAgo != null && (
            <span style={{ color: 'var(--text-3)' }}>
              last signal <span style={{ color: 'var(--cyan)', fontWeight: 700 }}>{liveStats.lastSignalMinsAgo}m ago</span>
            </span>
          )}
          {best && (
            <span style={{ color: 'var(--text-3)' }}>
              best signal: <span style={{ color: 'var(--purple)', fontWeight: 700 }}>{best.symbol} +{best.gain?.toFixed(0)}%</span>
            </span>
          )}
        </div>
      </div>

      {/* ── HERO ── */}
      <section style={{ textAlign: 'center', padding: 'clamp(55px, 8vw, 90px) 6vw 0', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -120, left: '50%', transform: 'translateX(-50%)', width: 1000, height: 750, background: 'radial-gradient(ellipse, rgba(181,74,255,0.12) 0%, transparent 65%)', pointerEvents: 'none' }} />

        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} style={{ position: 'relative' }}>

          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '7px 20px', borderRadius: 100, background: 'rgba(0,255,148,0.08)', border: '1px solid rgba(0,255,148,0.22)', color: 'var(--green)', fontSize: '0.78rem', fontWeight: 800, letterSpacing: '0.06em', marginBottom: 28 }}>
            <div className="live-dot" style={{ background: 'var(--green)' }} />
            {sampleSize} signals backtested · {winRate}% hit +20% · avg peak +{avgGain}%
          </div>

          <h1 style={{ fontSize: 'clamp(2.6rem, 6vw, 5rem)', fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 1.0, maxWidth: 1050, margin: '0 auto 22px' }}>
            Track <span className="text-purple">{walletsTracked} smart wallets</span><br />
            on Base. <span style={{ color: 'var(--cyan)' }}>See moves first.</span>
          </h1>

          <p style={{ fontSize: 'clamp(1.05rem, 1.8vw, 1.22rem)', color: 'var(--text-2)', maxWidth: 580, margin: '0 auto 36px', lineHeight: 1.65 }}>
            When 2+ smart wallets pile into the same token — you get a Telegram alert.
            Not a signal group. Real on-chain data. Every cluster verifiable on Blockscout.
          </p>

          <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 48 }}>
            <a href={GUMROAD} target="_blank" rel="noopener noreferrer"
              className="btn btn-primary"
              style={{ background: 'var(--purple)', fontSize: '1.08rem', padding: '16px 36px', textDecoration: 'none', boxShadow: '0 0 36px rgba(181,74,255,0.45)' }}>
              Get Lifetime Access — ${PRICE} →
            </a>
            <button className="btn btn-ghost" onClick={() => navigate('/login')}
              style={{ fontSize: '1rem', padding: '16px 24px' }}>
              Sign In
            </button>
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

      {/* ── DISCLAIMER ── */}
      <div style={{ background: 'var(--bg-1)', borderBottom: '1px solid var(--border)', padding: '9px 6vw', textAlign: 'center' }}>
        <span style={{ fontSize: '0.72rem', color: 'var(--text-3)' }}>
          All gains measured on real on-chain prices via GeckoTerminal · Peak within 30 days of entry · We show losses too
        </span>
      </div>

      {/* ── WHAT IT IS ── */}
      <section style={{ padding: 'clamp(50px,7vw,70px) 6vw', textAlign: 'center', borderTop: '1px solid var(--border)' }}>
        <h2 style={{ fontSize: 'clamp(1.6rem, 3vw, 2.3rem)', fontWeight: 900, marginBottom: 20 }}>
          Not a signal group. Not a copy-trade service.<br />
          <span className="text-purple">Real on-chain analytics.</span>
        </h2>
        <p style={{ color: 'var(--text-2)', maxWidth: 640, margin: '0 auto 48px', fontSize: '1rem', lineHeight: 1.7 }}>
          WalletDNA indexes {walletsTracked} verified smart money wallets on Base. Every trade is recorded,
          scored, and clustered. When multiple wallets converge on the same token — that's a signal.
          You get it on Telegram before it trends on Twitter.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, maxWidth: 780, margin: '0 auto' }}>
          {[
            { icon: '⛓', title: 'On-chain. Not screenshots.', desc: 'Every trade verifiable on Blockscout. We link the transaction. No trust required.' },
            { icon: '🤖', title: 'Fully automated.', desc: 'Pipeline syncs wallets every hour. Signals fire when wallets cluster — no human in the loop.' },
            { icon: '📱', title: 'Telegram alerts.', desc: 'Cluster forms → you get pinged instantly. Works 24/7. No need to watch a dashboard.' },
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
              <div key={w.tokenAddress}
                className="card" style={{ padding: 18, borderTop: '2px solid var(--green)' }}>
                <div style={{ fontWeight: 800, marginBottom: 8, fontSize: '0.9rem' }}>{w.tokenSymbol}</div>
                <div style={{ fontSize: '1.8rem', fontWeight: 900, fontFamily: 'var(--mono)', color: 'var(--green)', lineHeight: 1 }}>+{w.peakGain.toFixed(0)}%</div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-3)', marginTop: 6 }}>{w.daysAgo}d ago · {w.walletCount}w</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── FEATURES ── */}
      <section style={{ padding: 'clamp(50px,7vw,70px) 6vw', borderTop: '1px solid var(--border)' }}>
        <h2 style={{ fontSize: 'clamp(1.5rem, 2.8vw, 2.2rem)', fontWeight: 900, textAlign: 'center', marginBottom: 12 }}>Everything in one dashboard</h2>
        <p style={{ textAlign: 'center', color: 'var(--text-3)', marginBottom: 44, fontSize: '0.92rem' }}>All tools run automatically. You just watch and act.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, maxWidth: 1100, margin: '0 auto' }}>
          {[
            { ic: '🔥', t: 'Live Cluster Detection', d: '2+ smart wallets buy same token within hours → cluster fires → Telegram alert. Real-time, 24/7.' },
            { ic: '🧬', t: 'Wallet DNA Profiles', d: `Full on-chain breakdown: alpha score, best trades, FIFO P&L, win rate. For every one of ${walletsTracked}+ wallets.` },
            { ic: '💎', t: 'Hidden Gems', d: 'High-alpha wallets with low visibility. Finds the next smart money before Twitter does.' },
            { ic: '🎯', t: 'Exit Alerts', d: 'Tracks when smart money sells. See the exit signal before the dump hits CT.' },
            { ic: '📊', t: 'Signal Backtest', d: `${sampleSize} historical clusters tested against real prices. ${winRate}% hit +20% peak. Avg peak +${avgGain}%.` },
            { ic: '🚀', t: 'Wallet Discovery', d: 'Automated pipeline finds new alpha wallets from DexScreener first-buyers. Self-expanding database.' },
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
            <Cross>Pay $99/mo for a signal group posting screenshots</Cross>
            <Cross>Miss the move. Become exit liquidity.</Cross>
          </div>
          <div style={{ background: 'rgba(0,255,148,0.04)', border: '1px solid rgba(0,255,148,0.18)', borderRadius: 'var(--r-lg)', padding: '28px 24px' }}>
            <div style={{ fontSize: '0.65rem', color: 'var(--green)', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 18 }}>✅ With WalletDNA</div>
            <Check>See accumulation before the move — not after</Check>
            <Check>Know which wallets, how much capital, since when</Check>
            <Check>Cluster fires when 2+ smart wallets agree — not one guy</Check>
            <Check>Telegram alert on your phone — every cluster, every exit</Check>
            <Check><strong>${PRICE} once.</strong> No subscription. All future updates free.</Check>
          </div>
        </div>
      </section>

      {/* ── WHAT YOU GET ── */}
      <section style={{ padding: 'clamp(50px,7vw,70px) 6vw', borderTop: '1px solid var(--border)' }}>
        <h2 style={{ fontSize: 'clamp(1.5rem, 2.8vw, 2.2rem)', fontWeight: 900, textAlign: 'center', marginBottom: 44 }}>What's included</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, maxWidth: 900, margin: '0 auto' }}>
          {[
            { icon: '📱', item: 'Telegram Signal Bot', sub: 'Cluster forms → instant Telegram alert. Entry + exit signals. 24/7 automated.' },
            { icon: '🔥', item: 'Live Clusters Dashboard', sub: `Real-time view of all active clusters across ${walletsTracked} wallets. See exactly who's buying.` },
            { icon: '🧬', item: 'Wallet DNA Profiles', sub: 'Full profile for every tracked wallet: alpha score, top tokens, win rate, P&L.' },
            { icon: '💎', item: 'Hidden Gems Engine', sub: 'Surfaces high-alpha wallets with low visibility before they get copied.' },
            { icon: '📊', item: 'Signal History & Proof', sub: `${sampleSize}+ past signals with real entry/exit prices. Wins and losses shown — no cherry-picking.` },
            { icon: '♾️', item: 'Lifetime Access', sub: 'One payment. Every future feature free. No subscription, no upsells, ever.' },
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

      {/* ── WHO IT'S FOR ── */}
      <section style={{ padding: 'clamp(50px,7vw,70px) 6vw', background: 'var(--bg-1)', borderTop: '1px solid var(--border)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24, maxWidth: 840, margin: '0 auto' }}>
          <div>
            <h3 style={{ fontWeight: 900, fontSize: '1.1rem', marginBottom: 20, color: 'var(--green)' }}>Who this is for</h3>
            <Check>Base chain traders who want data, not vibes</Check>
            <Check>People done bleeding on VIP signal groups</Check>
            <Check>Anyone who wants early entry — not news feed confirmation</Check>
            <Check>Traders who want Telegram alerts without managing a bot</Check>
          </div>
          <div>
            <h3 style={{ fontWeight: 900, fontSize: '1.1rem', marginBottom: 20, color: 'var(--red)' }}>Who it's NOT for</h3>
            <Cross>If you want a magic formula that prints while you sleep</Cross>
            <Cross>If you can't sit with a losing trade</Cross>
            <Cross>If you want someone to manage risk for you</Cross>
            <Cross>If you need someone to tell you exactly when to buy</Cross>
          </div>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section style={{ padding: 'clamp(60px,8vw,80px) 6vw', textAlign: 'center', background: 'var(--bg-0)', borderTop: '1px solid var(--border)' }} id="pricing">
        <h2 style={{ fontSize: 'clamp(1.6rem, 3vw, 2.4rem)', fontWeight: 900, marginBottom: 8 }}>One product. One price. Yours forever.</h2>
        <p style={{ color: 'var(--text-3)', marginBottom: 50, fontSize: '0.95rem' }}>
          Pay once. Get lifetime access. Every update free. No subscription ever.
        </p>

        <div style={{ maxWidth: 460, margin: '0 auto' }}>
          <motion.div whileHover={{ y: -6 }}
            style={{
              background: 'var(--bg-card)', border: '2px solid var(--purple)',
              borderRadius: 'var(--r-lg)', padding: '40px 36px',
              boxShadow: '0 0 60px rgba(181,74,255,0.22)', position: 'relative',
            }}>
            <div style={{ position: 'absolute', top: -14, left: '50%', transform: 'translateX(-50%)', background: 'var(--purple)', color: '#fff', fontSize: '0.7rem', fontWeight: 800, padding: '5px 18px', borderRadius: 100, letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>
              ⚡ FOUNDING MEMBER — FIRST {FOUNDING_CAP} ONLY
            </div>

            <div style={{ fontSize: '0.9rem', color: 'var(--text-3)', marginBottom: 8 }}>WalletDNA — Lifetime Access</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 4, justifyContent: 'center' }}>
              <div style={{ fontSize: '4.2rem', fontWeight: 900, fontFamily: 'var(--mono)', lineHeight: 1, color: 'var(--purple)' }}>${PRICE}</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--text-3)', textDecoration: 'line-through' }}>${PRICE_ANCHOR}</div>
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-3)', marginBottom: 28 }}>
              one-time · price goes to ${PRICE_ANCHOR} after first {FOUNDING_CAP} buyers
            </div>

            <div style={{ textAlign: 'left', marginBottom: 32 }}>
              <Check>Live cluster detection dashboard — {walletsTracked}+ wallets</Check>
              <Check>Telegram signal bot — instant alerts on every cluster</Check>
              <Check>Wallet DNA profiles, hidden gems, signal history</Check>
              <Check>Exit alerts when smart money sells</Check>
              <Check>All future features — free forever</Check>
              <Check>7-day money-back guarantee — no questions</Check>
            </div>

            <a href={GUMROAD} target="_blank" rel="noopener noreferrer"
              className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center', background: 'var(--purple)', textDecoration: 'none', fontSize: '1.1rem', padding: '17px', boxShadow: '0 0 24px rgba(181,74,255,0.4)', display: 'flex', alignItems: 'center' }}>
              Get WalletDNA — ${PRICE} →
            </a>

            <div style={{ marginTop: 16, fontSize: '0.78rem', color: 'var(--text-3)' }}>
              🛡️ 7-day money-back guarantee · Instant access after payment
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section style={{ padding: 'clamp(50px,7vw,70px) 6vw', borderTop: '1px solid var(--border)', background: 'var(--bg-1)' }}>
        <h2 style={{ fontSize: 'clamp(1.4rem, 2.5vw, 2rem)', fontWeight: 900, textAlign: 'center', marginBottom: 40 }}>Common questions</h2>
        <div style={{ display: 'grid', gap: 16, maxWidth: 740, margin: '0 auto' }}>
          {[
            { q: 'What do I get after paying?', a: 'Instant access to the web dashboard + a welcome email with login credentials. You also get an invite link to the private Telegram bot that sends you cluster alerts automatically.' },
            { q: 'How does the Telegram bot work?', a: 'After purchase you\'ll receive a one-click link to start the bot. It sends a message every time a new cluster forms — token name, wallets involved, entry price, and Blockscout link. No setup required.' },
            { q: 'Is there a subscription?', a: `No. $${PRICE} one-time. Yours forever. Every future update included free. Price goes to $${PRICE_ANCHOR} after the first ${FOUNDING_CAP} buyers.` },
            { q: 'What chain is supported?', a: 'Base chain only. All wallets are Base-native. Deep data on one chain beats shallow data on many.' },
            { q: 'Does it trade automatically?', a: 'No. WalletDNA tracks and alerts. You decide when to enter and exit. Your keys, your trades.' },
            { q: 'How do I verify the signals are real?', a: 'Every signal links to Blockscout transactions. You can verify any wallet, any trade, any timestamp independently.' },
            { q: 'What\'s the refund policy?', a: '7-day money-back guarantee. If WalletDNA doesn\'t deliver in your first week, email walletdna.help@gmail.com for a full refund.' },
            { q: 'Can I try before paying?', a: 'The stats bar above shows live data from the real system running right now. After payment you get instant access.' },
          ].map(f => (
            <div key={f.q} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: '20px 24px' }}>
              <div style={{ fontWeight: 800, marginBottom: 8, fontSize: '0.96rem' }}>{f.q}</div>
              <div style={{ fontSize: '0.88rem', color: 'var(--text-3)', lineHeight: 1.6 }}>{f.a}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section style={{ padding: 'clamp(60px,8vw,80px) 6vw 100px', textAlign: 'center', borderTop: '1px solid var(--border)', background: 'var(--bg-0)' }}>
        <div style={{ position: 'relative', maxWidth: 720, margin: '0 auto' }}>
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 600, height: 400, background: 'radial-gradient(ellipse, rgba(181,74,255,0.12) 0%, transparent 65%)', pointerEvents: 'none' }} />
          <h2 style={{ fontSize: 'clamp(1.7rem, 3.5vw, 2.8rem)', fontWeight: 900, marginBottom: 16, position: 'relative' }}>
            The next cluster is forming right now.<br />
            <span style={{ color: 'var(--text-3)', fontSize: '0.55em', fontWeight: 600 }}>You could be watching it.</span>
          </h2>
          <p style={{ color: 'var(--text-2)', marginBottom: 36, fontSize: '1.02rem', position: 'relative', lineHeight: 1.65 }}>
            {walletsTracked} wallets tracked live. Telegram alert fires the moment a cluster forms.
            One payment, lifetime access.
          </p>
          <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap', position: 'relative' }}>
            <a href={GUMROAD} target="_blank" rel="noopener noreferrer"
              className="btn btn-primary"
              style={{ background: 'var(--purple)', fontSize: '1.12rem', padding: '18px 44px', textDecoration: 'none', boxShadow: '0 0 40px rgba(181,74,255,0.5)' }}>
              Get WalletDNA — ${PRICE} →
            </a>
            <button className="btn btn-ghost" onClick={() => navigate('/login')}
              style={{ fontSize: '1.05rem', padding: '18px 28px' }}>
              Already a member →
            </button>
          </div>
          <div style={{ marginTop: 20, fontSize: '0.78rem', color: 'var(--text-3)' }}>
            🛡️ 7-day money-back · Instant access · {walletsTracked} wallets · {typeof totalTrades === 'number' ? totalTrades.toLocaleString() : totalTrades} trades analyzed
          </div>
        </div>
      </section>
    </div>
  )
}
