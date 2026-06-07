import React, { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, Legend } from 'recharts'
import useStore from '../store/useStore'
import ScoreRing from '../components/ScoreRing'
import { fmtAddr, dnaLabels, scoreColor } from '../utils/format'
import { useT } from '../utils/i18n'


function WalletInput({ label, value, onChange, onAnalyze, loading, t }) {
  return (
    <div className="card card-p">
      <div className="section-title">{label}</div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          className="input"
          placeholder="0x wallet address…"
          value={value}
          onChange={e => onChange(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && onAnalyze()}
          style={{ fontFamily: 'var(--mono)', fontSize: '0.85rem' }}
        />
        <button className="btn btn-primary" onClick={onAnalyze} disabled={loading}>
          {loading ? <div className="spinner" style={{ width: 16, height: 16 }} /> : t('cmp_load')}
        </button>
      </div>
    </div>
  )
}

function ProfileSummary({ data, color, t }) {
  if (!data) return <div className="card card-p" style={{ textAlign: 'center', color: 'var(--text-3)' }}>{t('cmp_enter')}</div>
  const { archetype, overallScore, stats, dnaScores } = data
  return (
    <div className="card card-p">
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
        <ScoreRing score={overallScore} size={90} strokeWidth={7} />
        <div>
          <div style={{ fontWeight: 800, fontSize: '1.1rem', color }}>{archetype.name}</div>
          <div style={{ fontSize: '0.82rem', color: 'var(--text-2)', marginTop: 2 }}>{archetype.emoji} {archetype.desc.slice(0, 60)}…</div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: '0.75rem', color: 'var(--text-3)', marginTop: 4 }}>{fmtAddr(data.address)}</div>
        </div>
      </div>
      <div className="stats-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
        {[
          { label: t('cmp_txns'), value: stats.totalTxns?.toLocaleString() },
          { label: t('cmp_days'), value: stats.daysActive },
          { label: t('cmp_eth'), value: `${stats.ethBalance}` },
          { label: t('cmp_contracts'), value: stats.uniqueContracts },
        ].map(s => (
          <div key={s.label} className="stat-block">
            <div className="stat-block-label">{s.label}</div>
            <div className="stat-block-value" style={{ fontSize: '1rem', color }}>{s.value}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function Compare() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { fetchProfile, loadingProfile, profiles } = useStore()
  const t = useT()

  const [addr1, setAddr1] = useState(searchParams.get('addr1') || '')
  const [addr2, setAddr2] = useState(searchParams.get('addr2') || '')
  const [loading1, setLoading1] = useState(false)
  const [loading2, setLoading2] = useState(false)

  const data1 = profiles[addr1]
  const data2 = profiles[addr2]

  const analyze1 = async () => {
    if (!/^0x[0-9a-fA-F]{40}$/.test(addr1)) return
    setLoading1(true)
    await fetchProfile(addr1)
    setLoading1(false)
  }
  const analyze2 = async () => {
    if (!/^0x[0-9a-fA-F]{40}$/.test(addr2)) return
    setLoading2(true)
    await fetchProfile(addr2)
    setLoading2(false)
  }

  useEffect(() => {
    if (addr1 && /^0x[0-9a-fA-F]{40}$/.test(addr1)) analyze1()
    if (addr2 && /^0x[0-9a-fA-F]{40}$/.test(addr2)) analyze2()
  }, [])

  // Radar data
  const radarData = data1 && data2
    ? Object.keys(data1.dnaScores).map(key => ({
        metric: dnaLabels[key] || key,
        wallet1: data1.dnaScores[key],
        wallet2: data2.dnaScores[key],
      }))
    : []

  // Score comparison
  const winners = data1 && data2
    ? Object.keys(data1.dnaScores).map(key => ({
        key,
        label: dnaLabels[key],
        v1: data1.dnaScores[key],
        v2: data2.dnaScores[key],
        winner: data1.dnaScores[key] > data2.dnaScores[key] ? 1 : data2.dnaScores[key] > data1.dnaScores[key] ? 2 : 0,
      }))
    : []

  const w1wins = winners.filter(w => w.winner === 1).length
  const w2wins = winners.filter(w => w.winner === 2).length

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
      <div className="page-header">
        <div className="eyebrow">{t('cmp_eyebrow')}</div>
        <h1>Wallet <span className="gradient-text">{t('cmp_title')}</span></h1>
        <p>{t('cmp_sub')}</p>
      </div>

      {/* Inputs */}
      <div className="compare-grid" style={{ marginBottom: 28 }}>
        <WalletInput label={t('cmp_wallet_a')} value={addr1} onChange={setAddr1} onAnalyze={analyze1} loading={loading1} t={t} />
        <div className="compare-vs"><div className="compare-vs-text">VS</div></div>
        <WalletInput label={t('cmp_wallet_b')} value={addr2} onChange={setAddr2} onAnalyze={analyze2} loading={loading2} t={t} />
      </div>

      {/* Summary cards */}
      <div className="compare-grid" style={{ marginBottom: 28 }}>
        <ProfileSummary data={data1} color="var(--cyan)" t={t} />
        <div />
        <ProfileSummary data={data2} color="var(--purple)" t={t} />
      </div>

      {/* Combined radar */}
      {data1 && data2 && (
        <>
          <div className="card card-p mb-6">
            <div className="section-title" style={{ textAlign: 'center' }}>{t('cmp_overlay')}</div>
            <div style={{ height: 400 }}>
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData}>
                  <PolarGrid stroke="rgba(255,255,255,0.06)" />
                  <PolarAngleAxis dataKey="metric"
                    tick={{ fill: 'var(--text-2)', fontSize: 10, fontFamily: 'Outfit' }} />
                  <Radar name={fmtAddr(addr1)} dataKey="wallet1"
                    stroke="var(--cyan)" fill="var(--cyan)" fillOpacity={0.12} strokeWidth={2}
                    dot={{ fill: 'var(--cyan)', r: 3 }} />
                  <Radar name={fmtAddr(addr2)} dataKey="wallet2"
                    stroke="var(--purple)" fill="var(--purple)" fillOpacity={0.12} strokeWidth={2}
                    dot={{ fill: 'var(--purple)', r: 3 }} />
                  <Legend wrapperStyle={{ fontSize: 12, fontFamily: 'JetBrains Mono' }} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Metric-by-metric */}
          <div className="card">
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
              <div>
                <span style={{ color: 'var(--cyan)', fontWeight: 800 }}>{fmtAddr(addr1)}</span>
                <span style={{ color: 'var(--text-3)', margin: '0 8px' }}>{t('cmp_wins')}</span>
                <span style={{ fontFamily: 'var(--mono)', fontWeight: 900, color: 'var(--cyan)' }}>{w1wins}</span>
              </div>
              <div style={{ color: 'var(--text-3)', fontWeight: 700 }}>{t('cmp_battles')}</div>
              <div>
                <span style={{ fontFamily: 'var(--mono)', fontWeight: 900, color: 'var(--purple)' }}>{w2wins}</span>
                <span style={{ color: 'var(--text-3)', margin: '0 8px' }}>{t('cmp_wins')}</span>
                <span style={{ color: 'var(--purple)', fontWeight: 800 }}>{fmtAddr(addr2)}</span>
              </div>
            </div>
            {winners.map((w, i) => (
              <div key={w.key} style={{
                display: 'grid', gridTemplateColumns: '1fr 120px 1fr',
                alignItems: 'center', gap: 16, padding: '14px 20px',
                borderBottom: i < winners.length - 1 ? '1px solid var(--border)' : 'none',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'flex-end' }}>
                  <span style={{ fontFamily: 'var(--mono)', fontWeight: 700, color: w.winner === 1 ? 'var(--cyan)' : 'var(--text-2)' }}>{w.v1}</span>
                  <div style={{ width: 60, height: 4, background: 'rgba(255,255,255,0.05)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ height: '100%', background: 'var(--cyan)', width: `${w.v1}%`, borderRadius: 2, float: 'right' }} />
                  </div>
                  {w.winner === 1 && <span style={{ fontSize: '0.8rem' }}>🏆</span>}
                </div>
                <div style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-3)', fontWeight: 700, textTransform: 'uppercase' }}>{w.label}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {w.winner === 2 && <span style={{ fontSize: '0.8rem' }}>🏆</span>}
                  <div style={{ width: 60, height: 4, background: 'rgba(255,255,255,0.05)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ height: '100%', background: 'var(--purple)', width: `${w.v2}%`, borderRadius: 2 }} />
                  </div>
                  <span style={{ fontFamily: 'var(--mono)', fontWeight: 700, color: w.winner === 2 ? 'var(--purple)' : 'var(--text-2)' }}>{w.v2}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </motion.div>
  )
}
