import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import TokenCard from '../components/TokenCard'
import useStore from '../store/useStore'
import { fmtNum } from '../utils/format'
import { useT } from '../utils/i18n'

export default function Scanner() {
  const { tokens, loadingTokens, fetchTokens } = useStore()
  const [filter, setFilter] = useState('all')
  const [sort, setSort] = useState('volume')
  const [search, setSearch] = useState('')
  const t = useT()

  useEffect(() => { fetchTokens() }, [])

  function getScoreDetails(tok) {
    const factors = []
    let s = 90

    if (tok.liquidity < 5000) {
      s -= 40
      factors.push({ label: 'Liquidity', note: `$${fmtNum(tok.liquidity)} — very low`, delta: -40, bad: true })
    } else if (tok.liquidity < 25000) {
      s -= 15
      factors.push({ label: 'Liquidity', note: `$${fmtNum(tok.liquidity)} — low`, delta: -15, bad: true })
    } else {
      factors.push({ label: 'Liquidity', note: `$${fmtNum(tok.liquidity)} — OK`, delta: 0, bad: false })
    }

    if (tok.volume24h < 1000) {
      s -= 10
      factors.push({ label: 'Volume 24h', note: `$${fmtNum(tok.volume24h)} — very low`, delta: -10, bad: true })
    } else {
      factors.push({ label: 'Volume 24h', note: `$${fmtNum(tok.volume24h)}`, delta: 0, bad: false })
    }

    if (tok.change24h < -20) {
      s -= 15
      factors.push({ label: 'Price 24h', note: `${tok.change24h?.toFixed(1)}% — sharp drop`, delta: -15, bad: true })
    } else if (tok.change24h > 150) {
      s -= 10
      factors.push({ label: 'Price 24h', note: `+${tok.change24h?.toFixed(1)}% — suspicious pump`, delta: -10, bad: true })
    } else {
      factors.push({ label: 'Price 24h', note: `${tok.change24h >= 0 ? '+' : ''}${tok.change24h?.toFixed(1)}%`, delta: 0, bad: false })
    }

    return { score: Math.max(10, Math.min(100, s)), factors }
  }

  function getScore(tok) { return getScoreDetails(tok).score }
  function getClass(score) {
    if (score >= 75) return 'safe'
    if (score >= 50) return 'caution'
    return 'danger'
  }

  const FILTERS = [
    { id: 'all', label: t('sc_all') },
    { id: 'safe', label: t('sc_safe') },
    { id: 'caution', label: t('sc_caution') },
    { id: 'danger', label: t('sc_danger') },
  ]
  const SORTS = [
    { id: 'volume', label: t('sc_sort_vol') },
    { id: 'liquidity', label: t('sc_sort_liq') },
    { id: 'change', label: t('sc_sort_chg') },
    { id: 'mcap', label: t('sc_sort_mcap') },
  ]

  const scored = tokens.map(tok => ({ ...tok, score: getScore(tok), riskClass: getClass(getScore(tok)) }))
  const filtered = scored
    .filter(tok => {
      if (filter !== 'all' && tok.riskClass !== filter) return false
      if (search && !tok.name?.toLowerCase().includes(search.toLowerCase()) && !tok.symbol?.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
    .sort((a, b) => {
      if (sort === 'volume') return b.volume24h - a.volume24h
      if (sort === 'liquidity') return b.liquidity - a.liquidity
      if (sort === 'change') return b.change24h - a.change24h
      if (sort === 'mcap') return b.mcap - a.mcap
      return 0
    })

  const totalVol = tokens.reduce((s, tok) => s + tok.volume24h, 0)
  const gainers = tokens.filter(tok => tok.change24h > 0).length
  const losers = tokens.filter(tok => tok.change24h < 0).length

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>

      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div className="eyebrow">{t('sc_eyebrow')}</div>
        <h1 style={{ fontSize: 'clamp(1.4rem, 2.5vw, 1.9rem)', fontWeight: 900, letterSpacing: '-0.03em' }}>
          {t('sc_title')}
        </h1>
      </div>

      {/* Quick stats */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        {[
          { label: t('sc_vol'), value: `$${fmtNum(totalVol)}`, color: 'var(--cyan)' },
          { label: t('sc_gainers'), value: gainers, color: 'var(--green)' },
          { label: t('sc_losers'), value: losers, color: 'var(--red)' },
          { label: t('sc_pairs'), value: tokens.length, color: 'var(--text-2)' },
        ].map(s => (
          <div key={s.label} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: '8px 14px', minWidth: 80 }}>
            <div style={{ fontSize: '0.6rem', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 700, marginBottom: 2 }}>{s.label}</div>
            <div style={{ fontSize: '1.05rem', fontWeight: 800, fontFamily: 'var(--mono)', color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Controls bar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          className="input"
          placeholder={t('sc_search')}
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ maxWidth: 200, fontSize: '0.85rem' }}
        />

        {/* Risk filter */}
        <div className="tab-group">
          {FILTERS.map(f => (
            <button
              key={f.id}
              className={`tab-btn ${filter === f.id ? 'active' : ''}`}
              onClick={() => setFilter(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Sort */}
        <div className="tab-group" style={{ marginLeft: 'auto' }}>
          {SORTS.map(s => (
            <button
              key={s.id}
              className={`tab-btn ${sort === s.id ? 'active' : ''}`}
              onClick={() => setSort(s.id)}
            >
              {s.label}
            </button>
          ))}
        </div>

        <button className="btn-icon" onClick={fetchTokens} title="Refresh">↻</button>
      </div>

      {/* Grid */}
      {loadingTokens ? (
        <div className="loading-block">
          <div className="spinner" style={{ width: 28, height: 28 }} />
          {t('sc_loading')}
        </div>
      ) : (
        <div className="token-grid">
          {filtered.map((tok, i) => (
            <motion.div
              key={tok.address || i}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.03, 0.5) }}
            >
              <TokenCard token={tok} />
            </motion.div>
          ))}
          {filtered.length === 0 && !loadingTokens && (
            <div className="empty-state" style={{ gridColumn: '1/-1' }}>
              <div className="empty-state-icon">🔍</div>
              <div className="empty-state-title">{t('sc_empty')}</div>
              <div className="empty-state-sub">{t('sc_empty_sub')}</div>
            </div>
          )}
        </div>
      )}
    </motion.div>
  )
}
