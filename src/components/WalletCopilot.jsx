import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import useStore from '../store/useStore'
import { fmtAddr } from '../utils/format'


export default function WalletCopilot({ address, walletData }) {
  const { copilotChats, addCopilotMessage, isPremium } = useStore()
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [typing, setTyping] = useState(false)
  
  const chatHistory = copilotChats[address] || [
    { sender: 'ai', text: `Hi! I am your AI Wallet Copilot. I have analyzed the transaction logs of ${fmtAddr(address, 6)}. Ask me any strategic details about this profile!` }
  ]

  const chatEndRef = useRef(null)

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [chatHistory, open])

  const handleSend = (e) => {
    e.preventDefault()
    if (!input.trim()) return

    const userMsg = input.trim()
    setInput('')
    
    // Add user message
    addCopilotMessage(address, { sender: 'user', text: userMsg })
    
    // Simulate AI thinking & reply
    setTyping(true)
    setTimeout(() => {
      let replyText = ''
      const q = userMsg.toLowerCase()
      const { archetype, dnaScores, stats, holdings, sybilDetails } = walletData

      if (!isPremium) {
        replyText = t('copilot_free_locked', `🛡️ [PRO FEATURES LOCKED] I detected your query. Detailed AI quantitative suggestions are available only for Degen Pro subscribers. Unlock now under "Pricing & Plans" to access full copilot strategies.`)
      } else if (q.includes('sybil') || q.includes('bot') || q.includes('farm')) {
        const risk = dnaScores.sybilRisk
        const verdict = t('profile_sybil_' + sybilDetails.verdict.toLowerCase(), sybilDetails.verdict)
        const checkDetail = stats.failRate > 5 
          ? t('copilot_sybil_sig_bot', 'High transaction fail rate triggers standard bot activity signatures.')
          : t('copilot_sybil_sig_human', 'Normal transaction execution suggests human-driven actions.')
        replyText = `${t('copilot_sybil_risk_1', 'Forensic analysis shows a Sybil Risk Rating of ')}${100 - risk}${t('copilot_sybil_risk_2', '%. The wallet pattern indicates a ')}${verdict}${t('copilot_sybil_risk_3', ' profile.')} ${checkDetail}`
      } else if (q.includes('alpha') || q.includes('profit') || q.includes('snipe') || q.includes('early')) {
        const speed = dnaScores.alphaRate > 70 
          ? t('copilot_alpha_early', 'exceptionally early (typically before 2x-5x expansions)') 
          : t('copilot_alpha_late', 'at late-stage retail velocity.')
        const archName = t('arch_' + archetype.id, archetype.name)
        replyText = `${t('copilot_alpha_1', 'This account has an Alpha Discovery score of ')}${dnaScores.alphaRate}${t('copilot_alpha_2', '/100. They classified as "')}${archName}". ${t('copilot_alpha_early', 'exceptionally early (typically before 2x-5x expansions)') === speed ? 'Consistently entering positions early.' : 'Entering late stage.'}`
      } else if (q.includes('holding') || q.includes('token') || q.includes('portfolio')) {
        const symbols = holdings.map(h => h.symbol).join(', ')
        const holdingList = symbols || t('copilot_holding_none', 'None detected in top tokens list')
        replyText = `${t('copilot_holding_1', 'The current wallet holds ')}${stats.tokenCount}${t('copilot_holding_2', ' tokens. Major holdings include: ')}${holdingList}. ${t('copilot_holding_3', 'Total ETH Balance: ')}${stats.ethBalance} ETH.`
      } else if (q.includes('whale') || q.includes('size')) {
        const influenceText = dnaScores.whaleInfluence > 60 
          ? t('copilot_whale_influence_heavy', 'Their trades are large enough to influence slippage grids on decentralized exchanges.') 
          : t('copilot_whale_influence_retail', 'Transaction sizing remains typical of a retail participant.')
        replyText = `${t('copilot_whale_1', 'Whale Influence index sits at ')}${dnaScores.whaleInfluence}${t('copilot_whale_2', '/100. This score reflects an ETH balance of ')}${stats.ethBalance}${t('copilot_whale_3', ' and total on-chain interaction count of ')}${stats.totalTxns}. ${influenceText}`
      } else {
        const archName = t('arch_' + archetype.id, archetype.name)
        replyText = `${t('copilot_generic_1', 'Based on my machine learning analysis of this wallet, they fit the "')}${archName}${t('copilot_generic_2', '" behavioral cohort. Key metrics: Diamond Hands index is ')}${dnaScores.diamondHands}${t('copilot_generic_3', '%, Gas IQ rating is ')}${dnaScores.gasIQ}${t('copilot_generic_4', '%. I recommend adding this account to your Real-Time Alerts feed to capture their next swap immediately.')}`
      }

      addCopilotMessage(address, { sender: 'ai', text: replyText })
      setTyping(false)
    }, 1200)
  }

  return (
    <>
      {/* Floating Toggle Bubble */}
      <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 500 }}>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setOpen(!open)}
          style={{
            width: 56, height: 56, borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--cyan) 0%, var(--purple) 100%)',
            boxShadow: '0 8px 30px var(--cyan-glow)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.5rem', cursor: 'pointer', border: 'none', color: '#04040d'
          }}
        >
          {open ? '✕' : '🤖'}
        </motion.button>
      </div>

      {/* Slide-out Chat Panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 26, stiffness: 220 }}
            style={{
              position: 'fixed', top: 60, right: 0, bottom: 0,
              width: 380, background: 'rgba(10, 12, 28, 0.97)',
              borderLeft: '1px solid var(--border-bright)', zIndex: 450,
              backdropFilter: 'blur(20px)', display: 'flex', flexDirection: 'column'
            }}
          >
            {/* Header */}
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: '0.95rem' }}>{t('profile_copilot_title', 'AI Wallet Copilot')}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>{t('copilot_analyzing_msg', 'Analyzing: ')}{fmtAddr(address, 10)}</div>
              </div>
              {!isPremium && <span className="badge badge-purple" style={{ fontSize: '0.65rem' }}>{t('copilot_free_version', 'FREE VERSION')}</span>}
            </div>

            {/* Chat Log */}
            <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {chatHistory.map((m, idx) => (
                <div
                  key={idx}
                  style={{
                    alignSelf: m.sender === 'user' ? 'flex-end' : 'flex-start',
                    maxWidth: '85%',
                    background: m.sender === 'user' ? 'var(--cyan-dim)' : 'var(--bg-glass)',
                    border: m.sender === 'user' ? '1px solid rgba(0,229,255,0.2)' : '1px solid var(--border)',
                    padding: '10px 14px',
                    borderRadius: m.sender === 'user' ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
                    fontSize: '0.84rem',
                    color: m.sender === 'user' ? 'var(--cyan)' : 'var(--text-1)',
                    lineHeight: 1.5
                  }}
                >
                  {m.text}
                </div>
              ))}
              {typing && (
                <div style={{ alignSelf: 'flex-start', background: 'var(--bg-glass)', border: '1px solid var(--border)', padding: '10px 14px', borderRadius: '14px 14px 14px 2px', fontSize: '0.84rem', color: 'var(--text-3)' }}>
                  {t('copilot_thinking', 'Copilot is thinking...')}
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input Form */}
            <form onSubmit={handleSend} style={{ padding: '14px 20px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8 }}>
              <input
                className="input"
                placeholder={t('copilot_placeholder', 'Ask about sybil risk, alpha timing...')}
                value={input}
                onChange={e => setInput(e.target.value)}
                style={{ fontSize: '0.84rem', padding: '10px 12px' }}
              />
              <button className="btn btn-primary" type="submit" style={{ padding: '0 16px' }}>{t('copilot_send', 'Send')}</button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

