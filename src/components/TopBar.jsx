import React, { useState, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { fmtAddr } from '../utils/format'
import useStore from '../store/useStore'
import { useT } from '../utils/i18n'

function FreshnessChip({ minsAgo }) {
  if (minsAgo === null || minsAgo === undefined) return null

  let color, label
  if (minsAgo < 60) {
    color = 'var(--green)'
    label = minsAgo < 2 ? 'just now' : `${minsAgo}m ago`
  } else if (minsAgo < 1440) {
    color = 'var(--amber)'
    label = `${Math.round(minsAgo / 60)}h ago`
  } else {
    color = 'var(--red)'
    label = `${Math.round(minsAgo / 1440)}d ago`
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 5,
      padding: '3px 10px', borderRadius: 'var(--r-full)',
      background: `${color}0f`, border: `1px solid ${color}30`,
      fontSize: '0.68rem', fontWeight: 700, color,
      whiteSpace: 'nowrap',
    }}>
      <span style={{
        width: 5, height: 5, borderRadius: '50%', background: color,
        boxShadow: minsAgo < 60 ? `0 0 6px ${color}` : 'none',
        flexShrink: 0,
        animation: minsAgo < 60 ? 'pulse 1.5s ease-in-out infinite' : 'none',
      }} />
      Last signal: {label}
    </div>
  )
}

export default function TopBar() {
  const navigate = useNavigate()
  const { globalStats, fetchGlobalStats, language, setLanguage } = useStore()
  const t = useT()

  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    fetchGlobalStats()
    const iv = setInterval(fetchGlobalStats, 2 * 60 * 1000)
    return () => clearInterval(iv)
  }, [])

  const handleSearch = useCallback(async (val) => {
    setQuery(val)
    if (!val || val.length < 3) { setResults([]); return }
    if (/^0x[0-9a-fA-F]{40}$/.test(val)) {
      navigate(`/profile/${val}`)
      setQuery(''); setResults([])
      return
    }
    setSearching(true)
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(val)}`)
      const data = await res.json()
      setResults(data.results || [])
    } catch {} finally { setSearching(false) }
  }, [navigate])

  const handleKey = (e) => {
    if (e.key === 'Enter' && /^0x[0-9a-fA-F]{40}$/.test(query)) {
      navigate(`/profile/${query}`)
      setQuery(''); setResults([])
    }
    if (e.key === 'Escape') { setResults([]); setQuery('') }
  }

  return (
    <div className="topbar">
      {/* Search */}
      <div className="topbar-search" style={{ position: 'relative' }}>
        <span className="topbar-search-icon">🔍</span>
        <input
          placeholder={t('tb_search')}
          value={query}
          onChange={e => handleSearch(e.target.value)}
          onKeyDown={handleKey}
          spellCheck={false}
        />
        {searching && <div className="spinner" style={{ width: 14, height: 14, borderWidth: 1.5 }} />}

        {results.length > 0 && (
          <div className="search-dropdown">
            {results.map((r, i) => (
              <div key={`${r.address || ''}-${i}`} className="search-result-item"
                onClick={() => {
                  if (r.type === 'wallet') navigate(`/profile/${r.address}`);
                  else navigate(`/token/${r.address}`);
                  setResults([]); setQuery('');
                }}>
                {r.type === 'wallet' ? (
                  <>
                    <div style={{ fontWeight: 700, fontSize: '0.82rem' }}>
                      <span style={{ color: 'var(--text-3)', marginRight: 6 }}>👛</span>{r.name}
                    </div>
                    <div style={{ marginLeft: 'auto', fontFamily: 'var(--mono)', fontSize: '0.7rem', color: 'var(--cyan)' }}>
                      Score {r.alphaScore} · WR {r.winRate}%
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ fontWeight: 700 }}>{r.symbol}</div>
                    <div style={{ color: 'var(--text-2)', fontSize: '0.78rem' }}>{r.name}</div>
                    <div style={{ marginLeft: 'auto', fontFamily: 'var(--mono)', fontSize: '0.7rem', color: 'var(--text-3)' }}>
                      {fmtAddr(r.address)}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Right side */}
      <div className="topbar-right">
        {/* Signal Freshness */}
        <FreshnessChip minsAgo={globalStats.lastSignalMinsAgo} />

        {/* 24h signal count */}
        {globalStats.signalsLast24h > 0 && (
          <div className="topbar-chip" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
            <span style={{ color: 'var(--cyan)', fontWeight: 700 }}>{globalStats.signalsLast24h}</span>
            <span style={{ color: 'var(--text-3)' }}>tokens today</span>
          </div>
        )}

        {/* Active wallets */}
        <div className="topbar-chip" onClick={() => navigate('/clusters')}>
          <span className="live-dot" style={{ width: 5, height: 5 }} />
          <strong style={{ color: 'var(--red)' }}>{globalStats.smartMoneyActive || 0}</strong>
          <span>{t('tb_clusters')}</span>
        </div>

        {/* Network */}
        <div className="topbar-chip" style={{ cursor: 'default' }}>
          <span style={{ color: 'var(--cyan)', fontWeight: 700 }}>Base</span>
        </div>

        {/* Language */}
        <div style={{ display: 'flex', gap: 2, background: 'var(--bg-2)', borderRadius: 'var(--r-full)', padding: 2, border: '1px solid var(--border)' }}>
          {['en', 'ru'].map(l => (
            <button key={l} onClick={() => setLanguage(l)}
              style={{
                padding: '3px 9px', borderRadius: 'var(--r-full)',
                fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.04em',
                background: language === l ? 'var(--purple)' : 'transparent',
                color: language === l ? '#fff' : 'var(--text-3)',
                transition: 'all var(--t)',
              }}>
              {l.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
