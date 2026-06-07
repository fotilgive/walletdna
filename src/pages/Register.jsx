import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useStore from '../store/useStore';
import toast from 'react-hot-toast';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

export default function Register() {
  const navigate = useNavigate();
  const { setUser, setToken, setPremium } = useStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if (!window.google) return;
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleGoogleResponse,
      });
      window.google.accounts.id.renderButton(
        document.getElementById('google-btn-reg'),
        { theme: 'filled_black', size: 'large', shape: 'rectangular', width: 340, text: 'signup_with' }
      );
    };
    document.body.appendChild(script);
    return () => document.body.removeChild(script);
  }, []);

  async function handleGoogleResponse(response) {
    setGoogleLoading(true);
    try {
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: response.credential }),
      });
      const data = await res.json();
      if (data.success) {
        setToken(data.token, true);
        setUser(data.user);
        setPremium(data.user.isPremium);
        toast.success(data.isNew ? 'Account created!' : 'Welcome back!');
        navigate(data.user.onboardingCompleted ? '/' : '/onboarding');
      } else {
        toast.error(data.error || 'Google signup failed');
      }
    } catch {
      toast.error('Google signup failed');
    } finally {
      setGoogleLoading(false);
    }
  }

  const handleRegister = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) return toast.error('Passwords do not match');
    if (password.length < 8) return toast.error('Password must be at least 8 characters');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Account created! Sign in now.');
        navigate('/login');
      } else {
        toast.error(data.error || 'Registration failed');
      }
    } catch {
      toast.error('Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex',
      background: '#06060a', position: 'relative', overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', top: '-20%', left: '50%', transform: 'translateX(-50%)',
        width: 600, height: 600,
        background: 'radial-gradient(circle, rgba(0,212,255,0.1) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', bottom: '-10%', left: '10%',
        width: 400, height: 400,
        background: 'radial-gradient(circle, rgba(168,85,247,0.07) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <div style={{
        margin: 'auto', width: '100%', maxWidth: 400,
        padding: '20px 16px', position: 'relative', zIndex: 1,
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 52, height: 52, borderRadius: 14,
            background: 'linear-gradient(135deg, #00D4FF, #A855F7)',
            marginBottom: 16, fontSize: '1.5rem',
          }}>🧬</div>
          <h1 style={{ color: '#F8FAFC', fontSize: '1.6rem', fontWeight: 800, margin: 0 }}>
            WalletDNA
          </h1>
          <p style={{ color: '#64748B', marginTop: 6, fontSize: '0.9rem' }}>
            Create your free account
          </p>
        </div>

        {/* Card */}
        <div style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 20, padding: '32px 28px',
          backdropFilter: 'blur(12px)',
        }}>
          <h2 style={{ color: '#F8FAFC', fontSize: '1.1rem', fontWeight: 700, marginBottom: 24, textAlign: 'center' }}>
            Join WalletDNA
          </h2>

          {/* Google */}
          {GOOGLE_CLIENT_ID ? (
            <div style={{ marginBottom: 20 }}>
              <div
                id="google-btn-reg"
                style={{
                  display: 'flex', justifyContent: 'center',
                  opacity: googleLoading ? 0.6 : 1,
                  transition: 'opacity 0.2s', minHeight: 44,
                }}
              />
            </div>
          ) : (
            <button style={googleBtnStyle} onClick={() => toast('Google signup coming soon')}>
              <GoogleIcon /> Sign up with Google
            </button>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '20px 0' }}>
            <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.07)' }} />
            <span style={{ color: '#475569', fontSize: '0.75rem', fontWeight: 600 }}>OR</span>
            <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.07)' }} />
          </div>

          <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={labelStyle}>Email</label>
              <input
                type="email" value={email}
                onChange={(e) => setEmail(e.target.value)}
                required placeholder="you@example.com" style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Password</label>
              <input
                type="password" value={password}
                onChange={(e) => setPassword(e.target.value)}
                required placeholder="Min 8 characters" style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Confirm Password</label>
              <input
                type="password" value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required placeholder="Repeat password" style={inputStyle}
              />
            </div>
            <button type="submit" disabled={loading} style={submitBtnStyle(loading)}>
              {loading ? 'Creating account…' : 'Create Account →'}
            </button>
          </form>

          <p style={{ color: '#475569', fontSize: '0.68rem', textAlign: 'center', marginTop: 14, lineHeight: 1.5 }}>
            By signing up you agree to our terms. Free account has limited access.
            Unlock everything with a one-time purchase.
          </p>

          <div style={{ marginTop: 18, textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <p style={{ color: '#64748B', fontSize: '0.85rem' }}>
              Already have an account?{' '}
              <button onClick={() => navigate('/login')} style={linkStyle}>Sign in</button>
            </p>
            <button onClick={() => navigate('/landing')} style={{ ...linkStyle, fontSize: '0.78rem', color: '#475569' }}>
              ← Back to landing
            </button>
          </div>
        </div>

        <p style={{ textAlign: 'center', color: '#334155', fontSize: '0.72rem', marginTop: 20 }}>
          🔒 Secured · No wallet connection needed · Real on-chain data
        </p>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M17.64 9.20455C17.64 8.56636 17.5827 7.95273 17.4764 7.36364H9V10.845H13.8436C13.635 11.97 13.0009 12.9232 12.0477 13.5614V15.8195H14.9564C16.6582 14.2527 17.64 11.9455 17.64 9.20455Z" fill="#4285F4"/>
      <path d="M9 18C11.43 18 13.4673 17.1941 14.9564 15.8195L12.0477 13.5614C11.2418 14.1014 10.2109 14.4204 9 14.4204C6.65591 14.4204 4.67182 12.8373 3.96409 10.71H0.957275V13.0418C2.43818 15.9832 5.48182 18 9 18Z" fill="#34A853"/>
      <path d="M3.96409 10.71C3.78409 10.17 3.68182 9.59318 3.68182 9C3.68182 8.40682 3.78409 7.83 3.96409 7.29V4.95818H0.957275C0.347727 6.17318 0 7.54773 0 9C0 10.4523 0.347727 11.8268 0.957275 13.0418L3.96409 10.71Z" fill="#FBBC05"/>
      <path d="M9 3.57955C10.3214 3.57955 11.5077 4.03364 12.4405 4.92545L15.0218 2.34409C13.4632 0.891818 11.4259 0 9 0C5.48182 0 2.43818 2.01682 0.957275 4.95818L3.96409 7.29C4.67182 5.16273 6.65591 3.57955 9 3.57955Z" fill="#EA4335"/>
    </svg>
  );
}

const labelStyle = {
  display: 'block', color: '#94A3B8', fontSize: '0.8rem',
  fontWeight: 600, marginBottom: 6, letterSpacing: '0.02em',
};
const inputStyle = {
  width: '100%', padding: '11px 14px',
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 10, color: '#F8FAFC', fontSize: '0.92rem',
  outline: 'none', boxSizing: 'border-box',
};
const submitBtnStyle = (loading) => ({
  width: '100%', padding: '12px',
  background: loading
    ? 'rgba(0,212,255,0.3)'
    : 'linear-gradient(135deg, #00D4FF 0%, #A855F7 100%)',
  border: 'none', borderRadius: 10,
  color: '#fff', fontSize: '0.95rem', fontWeight: 700,
  cursor: loading ? 'not-allowed' : 'pointer',
  marginTop: 4,
});
const googleBtnStyle = {
  width: '100%', padding: '11px 16px',
  background: 'rgba(255,255,255,0.07)',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 10, color: '#F8FAFC',
  fontSize: '0.92rem', fontWeight: 600,
  cursor: 'pointer', display: 'flex',
  alignItems: 'center', justifyContent: 'center', gap: 10,
  marginBottom: 4,
};
const linkStyle = {
  background: 'none', border: 'none',
  color: '#A855F7', cursor: 'pointer',
  fontWeight: 600, fontSize: '0.85rem',
  textDecoration: 'underline',
};
