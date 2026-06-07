import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { fmtAddr } from '../utils/format'
import { useT } from '../utils/i18n'
import useStore from '../store/useStore'

export default function HiddenGems() {
  const navigate = useNavigate()
  const t = useT()
  const language = useStore(s => s.language)
  const [gems, setGems] = useState([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState(null)

  useEffect(() => {
    const fetchGems = async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/hidden-gems?lang=${language}`)
        const data = await res.json()
        if (data.success) {
          setGems(data.gems)
        }
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    fetchGems()
  }, [language])

  return (
    <div className="anim-fade-up" style={{ paddingBottom: 60 }}>
      <div style={{ marginBottom: 20 }}>
        <div className="eyebrow">💎 AI-Powered</div>
        <h1 style={{ fontSize: 'clamp(1.4rem, 2.5vw, 2rem)', fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1.1 }}>
          {t('hg_title_a')} <span className="gradient-text">{t('hg_title_b')}</span>
        </h1>
        <p style={{ color: 'var(--text-3)', fontSize: '0.82rem', marginTop: 4 }}>
          {t('hg_sub')}
        </p>
      </div>

      {loading ? (
        <div className="loading-block">
          <div className="spinner" style={{ width: 28, height: 28 }} />
          {t('hg_loading')}
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 20 }}>
          <AnimatePresence>
            {gems.map((gem, idx) => {
              const isExpanded = expandedId === gem.address
              
              return (
                <motion.div
                  key={gem.address}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="card"
                  style={{ 
                    padding: 0,
                    border: '1px solid var(--border-bright)',
                    background: 'var(--bg-card)'
                  }}
                >
                  {/* Summary Row */}
                  <div 
                    style={{ 
                      display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 24, alignItems: 'center',
                      padding: '24px 32px', cursor: 'pointer'
                    }}
                    onClick={() => setExpandedId(isExpanded ? null : gem.address)}
                  >
                    {/* Score */}
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '2.4rem', fontWeight: 900, fontFamily: 'var(--mono)', color: 'var(--cyan)', lineHeight: 1 }}>{gem.hiddenGemScore}</div>
                      <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-3)', marginTop: 6, fontWeight: 700 }}>{t('hg_score')}</div>
                    </div>

                    {/* Basic Info */}
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                        <h3 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-1)' }}>{gem.label}</h3>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-3)', fontFamily: 'var(--mono)' }}>{fmtAddr(gem.address)}</span>
                      </div>
                      
                      <div style={{ display: 'flex', gap: 32, marginTop: 12 }}>
                        <div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-3)', textTransform: 'uppercase', fontWeight: 700 }}>{t('hg_roi')}</div>
                          <div style={{ fontSize: '1.1rem', color: 'var(--green)', fontFamily: 'var(--mono)', fontWeight: 700, marginTop: 2 }}>{gem.metrics.roi}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-3)', textTransform: 'uppercase', fontWeight: 700 }}>{t('hg_winrate')}</div>
                          <div style={{ fontSize: '1.1rem', color: 'var(--cyan)', fontFamily: 'var(--mono)', fontWeight: 700, marginTop: 2 }}>{gem.metrics.winRate}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-3)', textTransform: 'uppercase', fontWeight: 700 }}>{t('hg_followers')}</div>
                          <div style={{ fontSize: '1.1rem', color: 'var(--purple)', fontFamily: 'var(--mono)', fontWeight: 700, marginTop: 2 }}>{gem.metrics.followers}</div>
                        </div>
                      </div>
                    </div>

                    {/* Expand Toggle */}
                    <div style={{ color: 'var(--text-3)' }}>
                      <svg width="24" height="24" fill="none" viewBox="0 0 24 24" style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.3s ease' }}>
                        <path stroke="currentColor" strokeWidth="2" d="M6 9l6 6 6-6"/>
                      </svg>
                    </div>
                  </div>

                  {/* Expanded Explanation Section */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        style={{ overflow: 'hidden' }}
                      >
                        <div style={{ borderTop: '1px solid var(--border)', padding: '32px', background: 'var(--bg-0)' }}>
                          <h4 style={{ fontSize: '0.85rem', color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 800, marginBottom: 20 }}>
                            {t('hg_why')}
                          </h4>
                          
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32, marginBottom: 24 }}>
                            {/* Why Interesting */}
                            <div style={{ background: 'var(--bg-1)', padding: 20, borderRadius: 12, border: '1px solid var(--border)' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                                <span style={{ color: 'var(--cyan)' }}>🔍</span>
                                <strong style={{ color: 'var(--text-1)' }}>{t('hg_interesting')}</strong>
                              </div>
                              <p style={{ color: 'var(--text-2)', fontSize: '0.95rem', lineHeight: 1.6 }}>{gem.explanation.whyInteresting}</p>
                            </div>

                            {/* Why Now */}
                            <div style={{ background: 'var(--bg-1)', padding: 20, borderRadius: 12, border: '1px solid var(--border)' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                                <span style={{ color: 'var(--purple)' }}>⚡</span>
                                <strong style={{ color: 'var(--text-1)' }}>{t('hg_now')}</strong>
                              </div>
                              <p style={{ color: 'var(--text-2)', fontSize: '0.95rem', lineHeight: 1.6 }}>{gem.explanation.whyNow}</p>
                            </div>

                            {/* What Changed */}
                            <div style={{ background: 'var(--bg-1)', padding: 20, borderRadius: 12, border: '1px solid var(--border)' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                                <span style={{ color: 'var(--green)' }}>📈</span>
                                <strong style={{ color: 'var(--text-1)' }}>{t('hg_recent')}</strong>
                              </div>
                              <p style={{ color: 'var(--text-2)', fontSize: '0.95rem', lineHeight: 1.6 }}>{gem.explanation.whatChanged}</p>
                            </div>

                            {/* Comparison */}
                            <div style={{ background: 'var(--bg-1)', padding: 20, borderRadius: 12, border: '1px solid var(--border)' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                                <span style={{ color: 'var(--amber)' }}>⚖️</span>
                                <strong style={{ color: 'var(--text-1)' }}>{t('hg_comparison')}</strong>
                              </div>
                              <p style={{ color: 'var(--text-2)', fontSize: '0.95rem', lineHeight: 1.6 }}>{gem.explanation.comparison}</p>
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--border)', paddingTop: 24 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                              <span style={{ fontSize: '0.85rem', color: 'var(--text-3)', fontWeight: 700 }}>{t('hg_recent_wins')}</span>
                              <div style={{ display: 'flex', gap: 8 }}>
                                {gem.recentWins.map(w => (
                                  <span key={w} style={{ background: 'var(--bg-2)', padding: '4px 10px', borderRadius: 4, fontSize: '0.8rem', color: 'var(--text-2)', border: '1px solid var(--border)' }}>
                                    {w}
                                  </span>
                                ))}
                              </div>
                            </div>
                            
                            <button 
                              className="btn btn-primary" 
                              onClick={() => navigate(`/profile/${gem.address}`)}
                              style={{ padding: '10px 24px' }}
                            >
                              {t('hg_analyze')}
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}
