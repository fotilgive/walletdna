import React from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useT } from '../utils/i18n'
import useStore from '../store/useStore'

const NAV = [
  {
    labelKey: 'nav_signals',
    items: [
      { path: '/',               icon: '⚡', labelKey: 'nav_alpha_feed',     badge: 'live' },
      { path: '/clusters',       icon: '🎯', labelKey: 'nav_clusters',       badge: 'live' },
      { path: '/signal-history', icon: '📊', labelKey: 'nav_signal_history' },
      { path: '/proof',          icon: '✅', labelKey: 'nav_proof' },
    ]
  },
  {
    labelKey: 'nav_wallets',
    items: [
      { path: '/leaderboard',    icon: '🏆', labelKey: 'nav_smart_money' },
      { path: '/profile',        icon: '🔍', labelKey: 'nav_profiler' },
      { path: '/discovery',      icon: '🧬', labelKey: 'nav_discovery', badge: 'live' },
    ]
  },
  {
    labelKey: 'nav_tools',
    items: [
      { path: '/audit',          icon: '🛡️', labelKey: 'nav_audit' },
      { path: '/scanner',        icon: '🌐', labelKey: 'nav_scanner' },
      { path: '/alerts',         icon: '🔔', labelKey: 'nav_alerts', badge: 'live' },
      { path: '/status',         icon: '🟢', labelKey: 'nav_status' },
    ]
  },
]

export default function Sidebar() {
  const navigate = useNavigate()
  const location = useLocation()
  const t = useT()
  const { globalStats, watchlist } = useStore()

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="sidebar-logo" onClick={() => navigate('/')}>
        <img src="/logo.png" alt="WalletDNA" style={{ width: '60px', height: '60px', objectFit: 'contain' }} />
        <div className="logo-text">Wallet<span>DNA</span></div>
      </div>

      <nav className="sidebar-nav">
        {NAV.map(group => (
          <React.Fragment key={group.labelKey}>
            <div className="sidebar-section-label">{t(group.labelKey)}</div>
            {group.items.map(item => {
              const active = location.pathname === item.path ||
                (item.path !== '/' && location.pathname.startsWith(item.path))
              return (
                <div
                  key={item.path}
                  className={`nav-item ${active ? 'active' : ''}`}
                  onClick={() => navigate(item.path)}
                >
                  <span className="nav-icon">{item.icon}</span>
                  <span>{t(item.labelKey)}</span>
                  {item.badge === 'live' && <span className="nav-badge-live" />}
                </div>
              )
            })}
          </React.Fragment>
        ))}

        {watchlist.length > 0 && (
          <>
            <div className="sidebar-section-label" style={{ marginTop: 4 }}>{t('nav_watchlist')}</div>
            {watchlist.slice(0, 3).map(w => (
              <div key={w.address} className="nav-item" onClick={() => navigate(`/profile/${w.address}`)}>
                <span className="nav-icon">👁</span>
                <span className="truncate" style={{ fontSize: '0.78rem' }}>{w.label}</span>
              </div>
            ))}
          </>
        )}
      </nav>

      {/* Footer */}
      <div className="sidebar-footer">
        <div style={{ fontSize: '0.7rem', color: 'var(--text-3)', marginBottom: 6, paddingLeft: 4 }}>
          <span style={{ fontFamily: 'var(--mono)', color: 'var(--cyan)', fontWeight: 700 }}>
            {globalStats.walletsTracked || 300}
          </span>
          {' '}{t('nav_tracked')}
        </div>
        <div className="live-indicator">
          <div className="live-dot" />
          <div className="live-text">Live · Base</div>
        </div>
      </div>
    </aside>
  )
}
