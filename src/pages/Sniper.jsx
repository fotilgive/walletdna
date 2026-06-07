import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { fmtAddr, fmtNum } from '../utils/format'
import { useT } from '../utils/i18n'

export default function Sniper() {
  const navigate = useNavigate()
  const [clusters, setClusters] = useState([])
  const [loading, setLoading] = useState(true)
  const t = useT()

  useEffect(() => {
    const fetchClusters = async () => {
      try {
        const res = await fetch('/api/clusters')
        const data = await res.json()
        if (data.success) {
          setClusters(data.clusters)
        }
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    fetchClusters()
  }, [])

  return (
    <div className="anim-fade-up" style={{ paddingBottom: 60 }}>
      <div className="page-header" style={{ textAlign: 'left', marginBottom: 40 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div style={{ 
            padding: '6px 14px', borderRadius: 100, 
            background: 'var(--red-dim)', color: 'var(--red)', 
            border: '1px solid rgba(255,59,107,0.2)',
            fontSize: '0.8rem', fontWeight: 800, letterSpacing: '0.05em' 
          }}>
            {t('sn_eyebrow')}
          </div>
        </div>
        <h1 style={{ fontSize: '3.2rem', fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 1.1, marginBottom: 16 }}>
          {t('sn_title_a')}<br/><span className="text-red">{t('sn_title_b')}</span>
        </h1>
        <p style={{ fontSize: '1.1rem', color: 'var(--text-2)', maxWidth: 600, lineHeight: 1.6 }}>
          {t('sn_sub')}
        </p>
      </div>

      {loading ? (
        <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-3)' }}>
          <div className="spinner" style={{ margin: '0 auto 16px' }}></div>
          {t('sn_loading')}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {clusters.map((cluster, idx) => (
            <motion.div
              key={cluster.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              className="card"
              style={{ padding: 0, border: '1px solid var(--border-bright)', overflow: 'hidden' }}
            >
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 0 }}>
                
                {/* Left Side: Intel */}
                <div style={{ padding: 32 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
                    <div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-3)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>
                        {t('sn_detected')}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <h2 style={{ fontSize: '2.2rem', fontWeight: 900, letterSpacing: '-0.02em', color: 'var(--text-1)' }}>
                          {cluster.token.symbol}
                        </h2>
                        <span style={{ color: 'var(--text-3)', fontFamily: 'var(--mono)' }}>{fmtAddr(cluster.token.address, 6)}</span>
                      </div>
                    </div>
                    
                    <div style={{ display: 'flex', gap: 16 }}>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '1.8rem', fontWeight: 900, fontFamily: 'var(--mono)', color: 'var(--cyan)' }}>{cluster.confidenceScore}%</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-3)', textTransform: 'uppercase', fontWeight: 700 }}>{t('sn_confidence')}</div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '1.8rem', fontWeight: 900, fontFamily: 'var(--mono)', color: 'var(--red)' }}>{cluster.urgencyScore}%</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-3)', textTransform: 'uppercase', fontWeight: 700 }}>{t('sn_urgency')}</div>
                      </div>
                    </div>
                  </div>

                  <div style={{ background: 'var(--bg-1)', padding: 20, borderRadius: 12, border: '1px solid var(--border)', marginBottom: 24 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                      <span style={{ color: 'var(--purple)' }}>🧠</span>
                      <strong style={{ color: 'var(--text-1)', fontSize: '0.95rem' }}>{t('sn_ai_insight')}</strong>
                    </div>
                    <p style={{ color: 'var(--text-2)', fontSize: '0.95rem', lineHeight: 1.6 }}>
                      {cluster.analysis}
                    </p>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
                    <div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-3)', textTransform: 'uppercase', fontWeight: 700 }}>{t('sn_cluster_size')}</div>
                      <div style={{ fontSize: '1.2rem', color: 'var(--text-1)', fontFamily: 'var(--mono)', fontWeight: 700, marginTop: 4 }}>{cluster.walletCount} {t('sn_wallets')}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-3)', textTransform: 'uppercase', fontWeight: 700 }}>{t('sn_total_inflow')}</div>
                      <div style={{ fontSize: '1.2rem', color: 'var(--green)', fontFamily: 'var(--mono)', fontWeight: 700, marginTop: 4 }}>${fmtNum(cluster.totalInflowUSD)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-3)', textTransform: 'uppercase', fontWeight: 700 }}>{t('sn_avg_entry')}</div>
                      <div style={{ fontSize: '1.2rem', color: 'var(--cyan)', fontFamily: 'var(--mono)', fontWeight: 700, marginTop: 4 }}>${cluster.avgEntryPrice}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-3)', textTransform: 'uppercase', fontWeight: 700 }}>{t('sn_current')}</div>
                      <div style={{ fontSize: '1.2rem', color: 'var(--text-2)', fontFamily: 'var(--mono)', fontWeight: 700, marginTop: 4 }}>${cluster.currentPrice}</div>
                    </div>
                  </div>

                  <div style={{ marginTop: 24, display: 'flex', gap: 12 }}>
                    <button 
                      className="btn btn-primary"
                      onClick={() => navigate(`/audit?address=${cluster.token.address}`)}
                    >
                      {t('sn_audit')} {cluster.token.symbol}
                    </button>
                    <button className="btn btn-ghost" style={{ border: '1px solid var(--border)' }}>
                      {t('sn_alert')}
                    </button>
                  </div>
                </div>

                {/* Right Side: Wallets */}
                <div style={{ background: 'var(--bg-0)', borderLeft: '1px solid var(--border)', padding: '24px 0' }}>
                  <div style={{ padding: '0 24px', marginBottom: 16, fontSize: '0.8rem', color: 'var(--text-3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                    {t('sn_cohort')}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {cluster.wallets.map((w, i) => (
                      <div 
                        key={i} 
                        style={{ 
                          padding: '12px 24px', 
                          borderBottom: i !== cluster.wallets.length - 1 ? '1px solid var(--border)' : 'none',
                          cursor: 'pointer',
                          transition: 'background 0.2s ease'
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-glass)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        onClick={() => navigate(`/profile/${w.address}`)}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                          <span style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-1)' }}>{w.label}</span>
                          <span style={{ color: 'var(--green)', fontFamily: 'var(--mono)', fontSize: '0.85rem', fontWeight: 600 }}>${fmtNum(w.amount)}</span>
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-3)', fontFamily: 'var(--mono)' }}>
                          {fmtAddr(w.address)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
