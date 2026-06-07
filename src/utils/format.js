export const fmtNum = (n) => {
  if (!n || isNaN(n)) return '0'
  const v = parseFloat(n)
  if (v >= 1e9) return (v / 1e9).toFixed(2) + 'B'
  if (v >= 1e6) return (v / 1e6).toFixed(2) + 'M'
  if (v >= 1e3) return (v / 1e3).toFixed(1) + 'K'
  return Number.isInteger(v) ? v.toString() : v.toFixed(2)
}

export const fmtPrice = (n) => {
  if (!n || isNaN(n)) return '$0'
  const v = parseFloat(n)
  if (v < 0.000001) return `$${v.toExponential(2)}`
  if (v < 0.001) return `$${v.toFixed(8)}`
  if (v < 1) return `$${v.toFixed(4)}`
  return `$${v.toFixed(2)}`
}

export const fmtAddr = (addr, chars = 6) => {
  if (!addr) return ''
  return `${addr.slice(0, chars)}…${addr.slice(-4)}`
}


export const fmtTime = (iso) => {
  if (!iso) return ''
  const d = new Date(iso)
  const now = Date.now()
  const diff = now - d.getTime()
  if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  return `${Math.floor(diff / 86400000)}d ago`
}

export const fmtEth = (n) => {
  const v = parseFloat(n)
  if (isNaN(v)) return '0 ETH'
  if (v >= 1000) return `${fmtNum(v)} ETH`
  return `${v.toFixed(4)} ETH`
}

export const scoreColor = (score) => {
  if (score >= 75) return 'var(--green)'
  if (score >= 50) return 'var(--amber)'
  return 'var(--red)'
}

export const scoreClass = (score) => {
  if (score >= 75) return 'safe'
  if (score >= 50) return 'caution'
  return 'danger'
}

export const pctClass = (v) => v >= 0 ? 'text-up' : 'text-down'
export const pctStr = (v) => `${v >= 0 ? '+' : ''}${parseFloat(v).toFixed(2)}%`

export const dnaLabels = {
  diamondHands: 'Consistency',
  alphaRate: 'Alpha Score',
  sybilRisk: 'Risk Control',
  tradingActivity: 'Trade Volume',
  whaleInfluence: 'Capital Size',
  smartMoney: 'Smart Money',
}

export const dnaColors = {
  diamondHands: '#00E5FF',
  alphaRate: '#B54AFF',
  sybilRisk: '#00FF94',
  gasIQ: '#FFB800',
  whaleInfluence: '#FF6B35',
  defiSophistication: '#6B8AFF',
  smartMoney: '#FF3B6B',
}
