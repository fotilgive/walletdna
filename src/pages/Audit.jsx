import React, { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import useStore from '../store/useStore'
import ScoreRing from '../components/ScoreRing'
import { fmtNum, fmtPrice, scoreColor } from '../utils/format'
import { useT } from '../utils/i18n'

export default function Audit() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const t = useT()
  const { fetchAudit, loadingAudit, auditError, audits } = useStore()
  const [address, setAddress] = useState(searchParams.get('address') || '')
  const [submitted, setSubmitted] = useState(!!searchParams.get('address'))
  const data = audits[address]

  useEffect(() => {
    if (searchParams.get('address')) runAudit(searchParams.get('address'))
  }, [])

  const runAudit = async (addr) => {
    const a = (addr || address).trim()
    if (!/^0x[0-9a-fA-F]{40}$/.test(a)) return
    setAddress(a)
    setSubmitted(true)
    await fetchAudit(a)
  }

  const QUICK = [
    { label: 'USDC (Base)', addr: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913' },
    { label: 'BRETT', addr: '0x4af095a89f21d3f9024f2b1841e4210a4fa588f0' },
    { label: 'DEGEN', addr: '0x532f27101965dd16442e59d40670faf5ebb142e4' },
    { label: 'TOSHI', addr: '0x0a3d07d0f948f1f729221124d47c4331e9c20a4b' },
  ]

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
      <div className="page-header">
        <div className="eyebrow">{t('au_eyebrow')}</div>
        <h1>{t('au_title')} <span className="gradient-text">{t('au_title_hl')}</span></h1>
        <p>{t('au_sub')}</p>
      </div>

      {/* Input */}
      <div className="card card-p mb-6">
        <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <input
              className="input"
              placeholder={t('au_placeholder')}
              value={address}
              onChange={e => setAddress(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && runAudit()}
              style={{ paddingLeft: 44 }}
            />
            <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--cyan)', fontSize: '1.1rem' }}>🛡️</span>
          </div>
          <button className="btn btn-primary" onClick={() => runAudit()} disabled={loadingAudit}>
            {loadingAudit ? <div className="spinner" style={{ width: 16, height: 16 }} /> : t('au_btn')}
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-3)' }}>{t('au_quick')}</span>
          {QUICK.map(q => (
            <button key={q.addr}
              onClick={() => runAudit(q.addr)}
              style={{
                padding: '4px 12px', borderRadius: 100, fontSize: '0.78rem', cursor: 'pointer',
                background: 'var(--bg-glass)', border: '1px solid var(--border)',
                color: 'var(--text-2)', transition: 'var(--t)', fontFamily: 'var(--mono)',
              }}
              onMouseEnter={e => e.target.style.color = 'var(--cyan)'}
              onMouseLeave={e => e.target.style.color = 'var(--text-2)'}
            >{q.label}</button>
          ))}
        </div>
      </div>

      {/* Loading */}
      {loadingAudit && (
        <div className="loading-block">
          <div className="spinner" style={{ width: 40, height: 40 }} />
          <div>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>{t('au_loading_title')}</div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-2)' }}>{t('au_loading_sub')}</div>
          </div>
        </div>
      )}

      {/* Error */}
      {auditError && <div style={{ color: 'var(--red)', padding: '20px', background: 'var(--red-dim)', borderRadius: 'var(--r-md)', marginBottom: 24 }}>⚠️ {auditError}</div>}

      {/* Result */}
      {data && !loadingAudit && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <div className="grid-2" style={{ gap: 20, marginBottom: 20 }}>
            {/* Score panel */}
            <div className="card card-p" style={{ textAlign: 'center' }}>
              <div className="section-title">{t('au_score')}</div>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
                <ScoreRing score={data.score} size={160} strokeWidth={10} />
              </div>
              <div style={{
                padding: '8px 24px', borderRadius: 100, display: 'inline-block', marginBottom: 20,
                fontWeight: 800, fontSize: '1rem', fontFamily: 'var(--mono)',
                background: data.verdict === 'SAFE' ? 'var(--green-dim)' : data.verdict === 'CAUTION' ? 'var(--amber-dim)' : 'var(--red-dim)',
                color: data.verdict === 'SAFE' ? 'var(--green)' : data.verdict === 'CAUTION' ? 'var(--amber)' : 'var(--red)',
                border: `1px solid ${scoreColor(data.score)}30`,
              }}>
                {data.verdict === 'SAFE' ? t('au_low_risk') : data.verdict === 'CAUTION' ? t('au_med_risk') : t('au_high_risk')}
              </div>

              {/* Contract checks */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {[
                  { labelKey: 'au_ownership', pass: data.contract.isRenounced,   good: t('au_renounced'),     bad: t('au_not_renounced') },
                  { labelKey: 'au_mint',      pass: !data.contract.hasMint,       good: t('au_not_found'),     bad: t('au_detected') },
                  { labelKey: 'au_blacklist', pass: !data.contract.hasBlacklist,  good: t('au_not_found'),     bad: t('au_detected') },
                  { labelKey: 'au_proxy',     pass: !data.contract.hasProxy,      good: t('au_not_found'),     bad: t('au_detected') },
                ].map(c => (
                  <div key={c.labelKey} style={{
                    background: c.pass ? 'var(--green-dim)' : 'var(--red-dim)',
                    border: `1px solid ${c.pass ? 'rgba(0,255,148,0.15)' : 'rgba(255,59,107,0.15)'}`,
                    borderRadius: 'var(--r-sm)', padding: '10px 12px', textAlign: 'left',
                  }}>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>{t(c.labelKey)}</div>
                    <div style={{ fontWeight: 700, fontSize: '0.82rem', color: c.pass ? 'var(--green)' : 'var(--red)' }}>
                      {c.pass ? c.good : c.bad}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Market data */}
            <div className="card card-p">
              <div className="section-title">{t('au_market')}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
                <div style={{
                  width: 50, height: 50, borderRadius: 12,
                  background: `linear-gradient(135deg, ${scoreColor(data.score)}, var(--purple))`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 900, fontSize: '1rem', color: '#04040d',
                }}>{(data.market.symbol || '??').slice(0, 2)}</div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '1.2rem' }}>{data.market.name}</div>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: '0.8rem', color: 'var(--text-3)' }}>
                    {data.market.symbol} · {data.market.dex}
                  </div>
                </div>
              </div>

              <div className="stats-grid" style={{ gridTemplateColumns: '1fr 1fr', marginBottom: 20 }}>
                {[
                  { labelKey: 'au_price',    value: fmtPrice(data.market.price) },
                  { labelKey: 'au_change24h', value: `${data.market.change24h >= 0 ? '+' : ''}${data.market.change24h?.toFixed(2)}%`, color: data.market.change24h >= 0 ? 'var(--green)' : 'var(--red)' },
                  { labelKey: 'au_liquidity', value: `$${fmtNum(data.market.liquidity)}` },
                  { labelKey: 'au_vol24h',   value: `$${fmtNum(data.market.volume24h)}` },
                  { labelKey: 'au_mcap',     value: data.market.mcap > 0 ? `$${fmtNum(data.market.mcap)}` : '—' },
                  { labelKey: 'au_txns',     value: data.market.txCount24h },
                ].map(s => (
                  <div key={s.labelKey} className="stat-block">
                    <div className="stat-block-label">{t(s.labelKey)}</div>
                    <div className="stat-block-value" style={{ fontSize: '1rem', color: s.color || 'var(--text-1)' }}>{s.value}</div>
                  </div>
                ))}
              </div>

              {/* Risks */}
              <div className="section-title">{t('au_findings')}</div>
              {[...data.risks.map(r => ({ msg: r, type: 'risk' })), ...data.warnings.map(w => ({ msg: w, type: 'warn' }))].map((f, i) => (
                <div key={i} style={{
                  display: 'flex', gap: 10, padding: '10px 12px', marginBottom: 6, borderRadius: 'var(--r-sm)',
                  background: f.type === 'risk' ? 'var(--red-dim)' : 'var(--amber-dim)',
                  borderLeft: `3px solid ${f.type === 'risk' ? 'var(--red)' : 'var(--amber)'}`,
                  fontSize: '0.84rem',
                }}>
                  <span>{f.type === 'risk' ? '❌' : '⚠️'}</span>
                  <span>{f.msg}</span>
                </div>
              ))}
              {data.risks.length === 0 && data.warnings.length === 0 && (
                <div style={{ padding: '10px 12px', background: 'var(--green-dim)', borderLeft: '3px solid var(--green)', borderRadius: 'var(--r-sm)', fontSize: '0.84rem' }}>
                  {t('au_no_risks')}
                </div>
              )}
            </div>
          </div>

          {/* Address */}
          <div className="card card-p-sm" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <span style={{ color: 'var(--text-3)', fontSize: '0.8rem' }}>{t('au_contract')}</span>
            <span style={{ fontFamily: 'var(--mono)', fontSize: '0.82rem', color: 'var(--text-2)', flex: 1 }}>{data.address}</span>
            <a href={`https://basescan.org/token/${data.address}`} target="_blank" rel="noopener noreferrer">
              <button className="btn btn-ghost" style={{ fontSize: '0.78rem', padding: '5px 12px' }}>↗ BaseScan</button>
            </a>
          </div>
        </motion.div>
      )}

      {/* How it works */}
      {!submitted && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginTop: 40 }}>
          {[
            { icon: '🔍', titleKey: 'au_f1_title', descKey: 'au_f1_desc' },
            { icon: '📊', titleKey: 'au_f2_title', descKey: 'au_f2_desc' },
            { icon: '🤖', titleKey: 'au_f3_title', descKey: 'au_f3_desc' },
            { icon: '⚡', titleKey: 'au_f4_title', descKey: 'au_f4_desc' },
          ].map(f => (
            <div key={f.titleKey} className="card card-p card-hover">
              <div style={{ fontSize: '1.8rem', marginBottom: 10 }}>{f.icon}</div>
              <div style={{ fontWeight: 700, marginBottom: 6, fontSize: '0.9rem' }}>{t(f.titleKey)}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-2)', lineHeight: 1.6 }}>{t(f.descKey)}</div>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  )
}
