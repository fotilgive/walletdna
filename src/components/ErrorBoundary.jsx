import React from 'react'

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, message: '' }
  }

  static getDerivedStateFromError(err) {
    return { hasError: true, message: err?.message || 'Unknown error' }
  }

  componentDidCatch(err, info) {
    console.error('[ErrorBoundary]', err, info)
  }

  render() {
    if (!this.state.hasError) return this.props.children
    return (
      <div style={{
        minHeight: '60vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 16, padding: '40px 24px',
      }}>
        <div style={{ fontSize: '2.5rem' }}>⚠️</div>
        <div style={{ fontWeight: 800, fontSize: '1.1rem' }}>Something went wrong</div>
        <div style={{ fontSize: '0.82rem', color: 'var(--text-3)', fontFamily: 'var(--mono)', maxWidth: 400, textAlign: 'center' }}>
          {this.state.message}
        </div>
        <button
          className="btn btn-ghost"
          onClick={() => { this.setState({ hasError: false }); window.location.reload(); }}
        >
          Reload page
        </button>
      </div>
    )
  }
}
