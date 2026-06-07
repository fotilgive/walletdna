import { create } from 'zustand'

const useStore = create((set, get) => ({
  // ── User Authentication ───────────────────────
  user: null,
  token: localStorage.getItem('walletdna_token') || null,
  authLoading: !!localStorage.getItem('walletdna_token'), // true if token exists — waiting for /me
  supportEmail: import.meta.env.VITE_SUPPORT_EMAIL || 'support@walletdna.com',
  setUser: (user) => set({ user }),
  setToken: (token) => {
    if (token) {
      localStorage.setItem('walletdna_token', token);
    } else {
      localStorage.removeItem('walletdna_token');
    }
    set({ token });
  },
  logout: () => {
    const token = get().token
    if (token) {
      fetch('/api/auth/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {})
    }
    localStorage.removeItem('walletdna_token')
    set({ user: null, token: null, isPremium: false })
  },

  isPremium: false,

  initAuth: async () => {
    const token = localStorage.getItem('walletdna_token')
    if (!token) {
      set({ authLoading: false })
      return
    }
    try {
      const res = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (data.success && data.user) {
        set({ user: data.user, token, isPremium: data.user.isPremium || false, authLoading: false })
      } else {
        localStorage.removeItem('walletdna_token')
        set({ user: null, token: null, isPremium: false, authLoading: false })
      }
    } catch {
      // network error — keep token, don't block UI
      set({ authLoading: false })
    }
  },

  // ── Wallet Profile Cache ──────────────────────
  profiles: {},
  loadingProfile: false,
  profileError: null,

  fetchProfile: async (address) => {
    if (get().profiles[address]) return get().profiles[address]
    set({ loadingProfile: true, profileError: null })
    try {
      const token = get().token
      const res = await fetch(`/api/wallet/${address}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error)
      set(s => ({ profiles: { ...s.profiles, [address]: data }, loadingProfile: false }))
      return data
    } catch (err) {
      set({ loadingProfile: false, profileError: err.message })
      return null
    }
  },

  // ── Signals ───────────────────────────────────
  signals: [],
  loadingSignals: false,
  fetchSignals: async () => {
    set({ loadingSignals: true })
    try {
      const res = await fetch('/api/signals')
      const data = await res.json()
      set({ signals: data.signals || [], loadingSignals: false })
    } catch { set({ loadingSignals: false }) }
  },

  // ── Leaderboard ───────────────────────────────
  leaderboard: [],
  loadingLB: false,
  fetchLeaderboard: async () => {
    set({ loadingLB: true })
    try {
      const res = await fetch('/api/leaderboard')
      const data = await res.json()
      set({ leaderboard: data.categories || [], loadingLB: false })
    } catch { set({ loadingLB: false }) }
  },

  // ── Trending Tokens ───────────────────────────
  tokens: [],
  loadingTokens: false,
  fetchTokens: async () => {
    set({ loadingTokens: true })
    try {
      const res = await fetch('/api/trending')
      const data = await res.json()
      set({ tokens: data.tokens || [], loadingTokens: false })
    } catch { set({ loadingTokens: false }) }
  },

  // ── Watchlist ─────────────────────────────────
  watchlist: JSON.parse(localStorage.getItem('watchlist') || '[]'),
  addToWatchlist: (address, label) => {
    set(s => {
      const wl = [...s.watchlist.filter(w => w.address !== address), { address, label, addedAt: Date.now() }]
      localStorage.setItem('watchlist', JSON.stringify(wl))
      return { watchlist: wl }
    })
  },
  removeFromWatchlist: (address) => {
    set(s => {
      const wl = s.watchlist.filter(w => w.address !== address)
      localStorage.setItem('watchlist', JSON.stringify(wl))
      return { watchlist: wl }
    })
  },
  isFollowing: (address) => get().watchlist.some(w => w.address === address),
  toggleFollow: (address, label) => {
    const s = get()
    if (s.watchlist.some(w => w.address === address)) s.removeFromWatchlist(address)
    else s.addToWatchlist(address, label)
  },

  // ── Audit Cache ───────────────────────────────
  audits: {},
  loadingAudit: false,
  auditError: null,
  fetchAudit: async (address) => {
    if (get().audits[address]) return get().audits[address]
    set({ loadingAudit: true, auditError: null })
    try {
      const res = await fetch(`/api/audit?address=${address}`)
      const data = await res.json()
      if (!data.success) throw new Error(data.error)
      set(s => ({ audits: { ...s.audits, [address]: data }, loadingAudit: false }))
      return data
    } catch (err) {
      set({ loadingAudit: false, auditError: err.message })
      return null
    }
  },

  // ── Global Stats ─────────────────────────
  globalStats: {
    walletsAnalyzed: parseInt(localStorage.getItem('walletsAnalyzed') || '1254'),
    signalsToday: 0,
    smartMoneyActive: 0,
    walletsTracked: 0,
    verifiedWallets: 0,
    activeClusters: 0,
    followed30d: null,
    followed7d: null,
    ethPrice: 0,
    totalVolume24h: 0,
    lastSignalMinsAgo: null,
    signalsLast24h: 0,
    signalsLastWeek: 0,
  },
  incrementWallets: () => {
    set(s => {
      const n = s.globalStats.walletsAnalyzed + 1
      localStorage.setItem('walletsAnalyzed', n)
      return { globalStats: { ...s.globalStats, walletsAnalyzed: n } }
    })
  },
  fetchGlobalStats: async () => {
    try {
      const res = await fetch('/api/stats')
      const data = await res.json()
      if (data.ethPrice) {
        set(s => ({
          globalStats: {
            ...s.globalStats,
            ethPrice: parseFloat(data.ethPrice),
            signalsToday: data.signalsToday || s.globalStats.signalsToday,
            totalVolume24h: data.totalVolume24h || 0,
            smartMoneyActive: data.smartMoneyActive || s.globalStats.smartMoneyActive,
            walletsTracked: data.walletsTracked ?? s.globalStats.walletsTracked,
            verifiedWallets: data.verifiedWallets ?? s.globalStats.verifiedWallets,
            activeClusters:  data.activeClusters  ?? s.globalStats.activeClusters,
            followed30d:     data.followed30d     ?? s.globalStats.followed30d,
            followed7d:      data.followed7d      ?? s.globalStats.followed7d,
            lastSignalMinsAgo: data.lastSignalMinsAgo ?? s.globalStats.lastSignalMinsAgo,
            signalsLast24h: data.signalsLast24h ?? s.globalStats.signalsLast24h,
            signalsLastWeek: data.signalsLastWeek ?? s.globalStats.signalsLastWeek,
          }
        }))
      }
    } catch {}
  },

  // ── Alerts & Subscriptions ───────────────────
  alerts: [
    {
      id: 'alert_init_1',
      type: 'WHALE_BUY',
      emoji: '🐋',
      token: 'BRETT',
      wallet: 'DeFi Whale #1',
      walletAddress: '0x4b9c25ca0224aef6a7522cabdbc3b2e125b7ca50',
      amount: '$148,200',
      timestamp: new Date(Date.now() - 4 * 60000).toISOString(),
      minsAgo: 4,
      significance: 88,
      chain: 'Base',
      hash: '0x4af095a89f21d3f9024f2b1841e4210a4fa588f0',
    },
    {
      id: 'alert_init_2',
      type: 'SMART_ENTRY',
      emoji: '🎯',
      token: 'DEGEN',
      wallet: 'Alpha Hunter',
      walletAddress: '0x8103683202aa8da10536036edef04cdd865c225e',
      amount: '$45,000',
      timestamp: new Date(Date.now() - 15 * 60000).toISOString(),
      minsAgo: 15,
      significance: 92,
      chain: 'Base',
      hash: '0x532f27101965dd16442e59d40670faf5ebb142e4',
    },
  ],
  alertSubscriptions: JSON.parse(localStorage.getItem('alertSubscriptions') || '[]'),
  
  addAlertSubscription: (address, label) => {
    set(s => {
      const exists = s.alertSubscriptions.some(sub => sub.address.toLowerCase() === address.toLowerCase())
      if (exists) return {}
      const subs = [...s.alertSubscriptions, { address, label, addedAt: Date.now() }]
      localStorage.setItem('alertSubscriptions', JSON.stringify(subs))
      return { alertSubscriptions: subs }
    })
  },
  
  removeAlertSubscription: (address) => {
    set(s => {
      const subs = s.alertSubscriptions.filter(sub => sub.address.toLowerCase() !== address.toLowerCase())
      localStorage.setItem('alertSubscriptions', JSON.stringify(subs))
      return { alertSubscriptions: subs }
    })
  },

  addAlert: (alert) => {
    set(s => ({
      alerts: [alert, ...s.alerts].slice(0, 50)
    }))
  },

  // ── SaaS Premium Subscription ─────────────────
  setPremium: (status) => {
    localStorage.setItem('walletDnaPremium', status)
    set({ isPremium: status })
  },

  // ── Sniper Bot Configuration & Logs ───────────
  sniperConfig: JSON.parse(localStorage.getItem('sniperConfig') || JSON.stringify({
    enabled: false,
    slippage: 1.5,
    maxBuySize: 0.1, // ETH
    minLiquidity: 10000, // USD
    gasMultiplier: 1.2,
    safetyScoreLimit: 75,
  })),
  updateSniperConfig: (config) => {
    set(s => {
      const updated = { ...s.sniperConfig, ...config }
      localStorage.setItem('sniperConfig', JSON.stringify(updated))
      return { sniperConfig: updated }
    })
  },
  sniperLogs: [
    { id: 'log_1', time: new Date(Date.now() - 3 * 60000).toISOString(), type: 'INFO', msg: 'V2 Sniper Bot initialized on Base Mainnet Node.' },
    { id: 'log_2', time: new Date(Date.now() - 2.5 * 60000).toISOString(), type: 'SUCCESS', msg: 'RPC handshake success. Latency: 12ms.' }
  ],
  addSniperLog: (log) => {
    set(s => ({
      sniperLogs: [{ id: `log_${Date.now()}_${Math.random()}`, time: new Date().toISOString(), ...log }, ...s.sniperLogs].slice(0, 80)
    }))
  },

  // ── Wallet Copilot Chat ───────────────────────
  copilotChats: {},
  addCopilotMessage: (address, message) => {
    set(s => {
      const chat = s.copilotChats[address] || [
        { sender: 'ai', text: `Hello! I am your Wallet DNA Copilot. Ask me anything about the strategic transactions or safety score of ${address.slice(0, 6)}...` }
      ]
      const updatedChat = [...chat, message]
      return {
        copilotChats: {
          ...s.copilotChats,
          [address]: updatedChat
        }
      }
    })
  },

  // ── Portfolio Tracker ─────────────────────────
  portfolio: JSON.parse(localStorage.getItem('portfolio') || '[]'),
  addToPortfolio: (address, label, notes = '') => {
    set(s => {
      const exists = s.portfolio.some(p => p.address.toLowerCase() === address.toLowerCase())
      if (exists) return {}
      const updated = [...s.portfolio, { address, label, notes, addedAt: Date.now(), tags: [] }]
      localStorage.setItem('portfolio', JSON.stringify(updated))
      return { portfolio: updated }
    })
  },
  removeFromPortfolio: (address) => {
    set(s => {
      const updated = s.portfolio.filter(p => p.address.toLowerCase() !== address.toLowerCase())
      localStorage.setItem('portfolio', JSON.stringify(updated))
      return { portfolio: updated }
    })
  },
  updatePortfolioNote: (address, notes) => {
    set(s => {
      const updated = s.portfolio.map(p =>
        p.address.toLowerCase() === address.toLowerCase() ? { ...p, notes } : p
      )
      localStorage.setItem('portfolio', JSON.stringify(updated))
      return { portfolio: updated }
    })
  },
  // ── Language / Localization ──────────────────
  language: localStorage.getItem('walletDnaLang') || 'en',
  setLanguage: (lang) => {
    localStorage.setItem('walletDnaLang', lang)
    set({ language: lang })
  },

  // ── Wallet Discovery Persistent State ─────────
  discoveryActiveTab: localStorage.getItem('discoveryTab') || 'approved',
  discoveryCandidatesCache: {},
  discoveryStats: { total: 0, pending: 0, approved: 0, rejected: 0, archived: 0, tracked: 0, promoted: 0 },
  discoveryLastRun: localStorage.getItem('discoveryLastRun') || null,
  discoveryHistory: JSON.parse(localStorage.getItem('discoveryHistory') || '[]'),

  setDiscoveryTab: (tab) => {
    localStorage.setItem('discoveryTab', tab)
    set({ discoveryActiveTab: tab })
  },
  setDiscoveryCandidates: (tab, candidates) => {
    set(s => ({ discoveryCandidatesCache: { ...s.discoveryCandidatesCache, [tab]: candidates } }))
  },
  setDiscoveryStats: (stats) => set({ discoveryStats: stats }),
  setDiscoveryLastRun: (time) => {
    localStorage.setItem('discoveryLastRun', time)
    set({ discoveryLastRun: time })
  },
  addDiscoveryHistory: (entry) => {
    set(s => {
      const history = [entry, ...s.discoveryHistory].slice(0, 10)
      localStorage.setItem('discoveryHistory', JSON.stringify(history))
      return { discoveryHistory: history }
    })
  },
}))

export default useStore
