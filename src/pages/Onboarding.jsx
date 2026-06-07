import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useStore from '../store/useStore';
import toast from 'react-hot-toast';

export default function Onboarding() {
  const navigate = useNavigate();
  const { user, setUser } = useStore();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user?.onboardingCompleted) {
      navigate('/');
    }
  }, [user, navigate]);

  const handleComplete = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('walletdna_token');
      await fetch('/api/auth/complete-onboarding', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });
      setUser({ ...user, onboardingCompleted: true });
      toast.success('Welcome to WalletDNA!');
      navigate('/');
    } catch (e) {
      toast.error('Failed to complete onboarding');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="onboarding-container" style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      background: 'linear-gradient(135deg, #0f0f23 0%, #1a1a3e 100%)',
    }}>
      <div style={{
        maxWidth: '600px',
        width: '100%',
        background: 'rgba(255, 255, 255, 0.05)',
        backdropFilter: 'blur(10px)',
        borderRadius: '20px',
        padding: '40px',
        border: '1px solid rgba(255, 255, 255, 0.1)',
      }}>
        <h1 style={{
          color: '#fff',
          fontSize: '2rem',
          marginBottom: '20px',
          textAlign: 'center',
        }}>
          Welcome to WalletDNA
        </h1>

        {step === 1 && (
          <div className="step">
            <p style={{ color: '#aaa', marginBottom: '30px', lineHeight: '1.6' }}>
              WalletDNA helps you track smart money movements, discover profitable trading opportunities,
              and make data-driven investment decisions on Base.
            </p>
            <div style={{ marginBottom: '30px' }}>
              <h3 style={{ color: '#fff', marginBottom: '15px' }}>Key Features:</h3>
              <ul style={{ color: '#aaa', lineHeight: '2' }}>
                <li>🔍 Track wallet DNA and trading patterns</li>
                <li>📊 Real-time cluster analysis</li>
                <li>🚀 Smart money exit signals</li>
                <li>🎯 Token audit and risk assessment</li>
                <li>📈 Wallet discovery pipeline</li>
              </ul>
            </div>
            <button
              onClick={() => setStep(2)}
              style={{
                width: '100%',
                padding: '15px',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                border: 'none',
                borderRadius: '10px',
                color: '#fff',
                fontSize: '1rem',
                cursor: 'pointer',
                transition: 'transform 0.2s',
              }}
              onMouseOver={(e) => e.target.style.transform = 'scale(1.02)'}
              onMouseOut={(e) => e.target.style.transform = 'scale(1)'}
            >
              Continue
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="step">
            <p style={{ color: '#aaa', marginBottom: '30px', lineHeight: '1.6' }}>
              To get started, you'll need to activate your premium license.
              This unlocks all features including wallet tracking, cluster analysis,
              and real-time alerts.
            </p>
            <div style={{
              background: 'rgba(102, 126, 234, 0.1)',
              padding: '20px',
              borderRadius: '10px',
              marginBottom: '30px',
              border: '1px solid rgba(102, 126, 234, 0.3)',
            }}>
              <h3 style={{ color: '#667eea', marginBottom: '10px' }}>Need a License?</h3>
              <p style={{ color: '#aaa', marginBottom: '15px' }}>
                Visit our pricing page to purchase a license through Gumroad.
              </p>
              <button
                onClick={() => navigate('/pricing')}
                style={{
                  padding: '10px 20px',
                  background: '#667eea',
                  border: 'none',
                  borderRadius: '5px',
                  color: '#fff',
                  cursor: 'pointer',
                }}
              >
                View Pricing
              </button>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => setStep(1)}
                style={{
                  flex: 1,
                  padding: '15px',
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: 'none',
                  borderRadius: '10px',
                  color: '#fff',
                  cursor: 'pointer',
                }}
              >
                Back
              </button>
              <button
                onClick={handleComplete}
                disabled={loading}
                style={{
                  flex: 1,
                  padding: '15px',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  border: 'none',
                  borderRadius: '10px',
                  color: '#fff',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.7 : 1,
                }}
              >
                {loading ? 'Completing...' : 'Complete Setup'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
