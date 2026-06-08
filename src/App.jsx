import React, { useEffect } from 'react'
import { Routes, Route, useLocation, useNavigate, Navigate } from 'react-router-dom'
import ErrorBoundary from './components/ErrorBoundary'
import Landing from './pages/Landing'
import Sidebar from './components/Sidebar'
import TopBar from './components/TopBar'
import LiveTicker from './components/LiveTicker'
import ParticleCanvas from './components/ParticleCanvas'
import Home from './pages/Home'
import Profile from './pages/Profile'
import Leaderboard from './pages/Leaderboard'
import Compare from './pages/Compare'
import Scanner from './pages/Scanner'
import Audit from './pages/Audit'
import Alerts from './pages/Alerts'
import Pricing from './pages/Pricing'
import Sniper from './pages/Sniper'
import HiddenGems from './pages/HiddenGems'
import Clusters from './pages/Clusters'
import SignalHistory from './pages/SignalHistory'
import TokenIntel from './pages/TokenIntel'
import WalletDiscovery from './pages/WalletDiscovery'
import Proof from './pages/Proof'
import Status from './pages/Status'
import Onboarding from './pages/Onboarding'
import Login from './pages/Login'
import Register from './pages/Register'
import Account from './pages/Account'
import useStore from './store/useStore'

// Redirect to /login if not authenticated, /pricing if not premium.
// authLoading = true while initAuth() fetches /api/auth/me after F5.
// Render null during that window to avoid flash-redirect on premium users.
function AuthSpinner() {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#06060a', color: '#64748B',
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{
          width: 36, height: 36, margin: '0 auto 14px',
          border: '3px solid rgba(168,85,247,0.2)',
          borderTopColor: '#A855F7', borderRadius: '50%',
          animation: 'wd-spin 0.9s linear infinite',
        }} />
        <div style={{ fontSize: '0.78rem', letterSpacing: '0.06em' }}>Loading…</div>
        <style>{`@keyframes wd-spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  )
}

function RequireAuth({ children }) {
  const { user, token, authLoading } = useStore()
  const location = useLocation()
  if (authLoading) return <AuthSpinner />
  if (!token || !user) {
    // Root path → landing (sales page). Other auth-only paths → login.
    if (location.pathname === '/') return <Navigate to="/landing" replace />
    sessionStorage.setItem('walletdna_redirect', location.pathname)
    return <Navigate to="/login" replace />
  }
  return children
}

function RequirePremium({ children }) {
  const { user, token, isPremium, authLoading } = useStore()
  const location = useLocation()
  if (authLoading) return <AuthSpinner />
  if (!token || !user) {
    sessionStorage.setItem('walletdna_redirect', location.pathname)
    return <Navigate to="/login" replace />
  }
  if (!isPremium && !user?.isPremium) return <Navigate to="/pricing" replace />
  return children
}

function MobileBottomNav() {
  const location = useLocation()
  const navigate = useNavigate()
  const path = location.pathname

  const items = [
    { icon: '🏠', label: 'Feed',      to: '/' },
    { icon: '🏆', label: 'Top',       to: '/leaderboard' },
    { icon: '🔮', label: 'Clusters',  to: '/clusters' },
    { icon: '🧬', label: 'Discovery', to: '/discovery' },
    { icon: '💎', label: 'Gems',      to: '/hidden-gems' },
  ]

  return (
    <nav className="mobile-bottom-nav">
      {items.map(item => (
        <button
          key={item.to}
          className={`mobile-nav-btn${path === item.to ? ' active' : ''}`}
          onClick={() => navigate(item.to)}
        >
          <span className="mobile-nav-icon">{item.icon}</span>
          {item.label}
        </button>
      ))}
    </nav>
  )
}

export default function App() {
  const location = useLocation()
  const { initAuth } = useStore()

  useEffect(() => {
    initAuth()
  }, [])

  if (location.pathname === '/landing' || location.pathname === '/login' || location.pathname === '/register' || location.pathname === '/onboarding') {
    return (
      <Routes>
        <Route path="/landing" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/onboarding" element={<Onboarding />} />
      </Routes>
    )
  }
  return (
    <>
      <ParticleCanvas />
      <div className="app-shell" style={{ position: 'relative', zIndex: 1 }}>
        <Sidebar />
        <div className="main-content">
          <TopBar />
          <main className="page-content">
            <ErrorBoundary>
            <Routes>
              <Route path="/" element={<RequireAuth><Home /></RequireAuth>} />
              <Route path="/leaderboard" element={<RequireAuth><Leaderboard /></RequireAuth>} />
              <Route path="/pricing" element={<Pricing />} />
              <Route path="/proof" element={<Proof />} />
              <Route path="/status" element={<Status />} />
              <Route path="/token/:address" element={<TokenIntel />} />
              <Route path="/token" element={<TokenIntel />} />
              {/* Auth required */}
              <Route path="/profile" element={<RequireAuth><Profile /></RequireAuth>} />
              <Route path="/profile/:address" element={<RequireAuth><Profile /></RequireAuth>} />
              <Route path="/alerts" element={<RequireAuth><Alerts /></RequireAuth>} />
              <Route path="/account" element={<RequireAuth><Account /></RequireAuth>} />
              {/* Premium required */}
              <Route path="/clusters" element={<RequirePremium><Clusters /></RequirePremium>} />
              <Route path="/signal-history" element={<RequirePremium><SignalHistory /></RequirePremium>} />
              <Route path="/compare" element={<RequirePremium><Compare /></RequirePremium>} />
              <Route path="/hidden-gems" element={<RequirePremium><HiddenGems /></RequirePremium>} />
              <Route path="/audit" element={<RequirePremium><Audit /></RequirePremium>} />
              <Route path="/scanner" element={<RequirePremium><Scanner /></RequirePremium>} />
              <Route path="/sniper" element={<RequirePremium><Sniper /></RequirePremium>} />
              <Route path="/discovery" element={<RequirePremium><WalletDiscovery /></RequirePremium>} />
            </Routes>
            </ErrorBoundary>
          </main>
        </div>
      </div>
      <MobileBottomNav />
    </>
  )
}
