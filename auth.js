import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { OAuth2Client } from 'google-auth-library';
import {
  createUser,
  getUserByEmail,
  createSession,
  getSessionByToken,
  deleteSession,
  deleteExpiredSessions,
  activateLicense,
  completeOnboarding,
  upsertGoogleUser,
} from './database.js';

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const JWT_SECRET = process.env.JWT_SECRET || 'walletdna-secret-key-change-in-production';
const JWT_EXPIRY = '7d';

export async function hashPassword(password) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

export function generateToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRY });
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

export function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  const token = authHeader.substring(7);
  const session = getSessionByToken(token);

  if (!session) {
    return res.status(401).json({ success: false, error: 'Invalid or expired session' });
  }

  req.user = {
    id: session.user_id,
    email: session.email,
    isAdmin: session.is_admin === 1,
    isPremium: session.is_premium === 1,
    gumroadLicense: session.gumroad_license,
    onboardingCompleted: session.onboarding_completed === 1
  };

  next();
}

export function requirePremium(req, res, next) {
  if (!req.user || !req.user.isPremium) {
    return res.status(403).json({ success: false, error: 'Premium subscription required' });
  }
  next();
}

export function requireAdmin(req, res, next) {
  if (!req.user || !req.user.isAdmin) {
    return res.status(403).json({ success: false, error: 'Admin access required' });
  }
  next();
}

export function setupAuthRoutes(app) {
  // Register
  app.post('/api/auth/register', async (req, res) => {
    try {
      const { email, password } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({ success: false, error: 'Email and password required' });
      }

      if (password.length < 8) {
        return res.status(400).json({ success: false, error: 'Password must be at least 8 characters' });
      }

      const passwordHash = await hashPassword(password);
      const result = createUser(email, passwordHash);

      if (!result.success) {
        return res.status(400).json({ success: false, error: result.error });
      }

      res.json({ success: true, message: 'Account created' });
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // Login
  app.post('/api/auth/login', async (req, res) => {
    try {
      const { email, password } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({ success: false, error: 'Email and password required' });
      }

      const user = getUserByEmail(email);
      if (!user) {
        return res.status(401).json({ success: false, error: 'Invalid credentials' });
      }

      const valid = await verifyPassword(password, user.password_hash);
      if (!valid) {
        return res.status(401).json({ success: false, error: 'Invalid credentials' });
      }

      const token = generateToken({ userId: user.id });
      const expiresAt = Date.now() + (7 * 24 * 60 * 60 * 1000); // 7 days
      createSession(user.id, token, expiresAt);

      res.json({
        success: true,
        token,
        user: {
          id: user.id,
          email: user.email,
          isAdmin: user.is_admin === 1,
          isPremium: user.is_premium === 1,
          gumroadLicense: user.gumroad_license,
          onboardingCompleted: user.onboarding_completed === 1
        }
      });
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // Logout
  app.post('/api/auth/logout', (req, res) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      deleteSession(token);
    }
    res.json({ success: true });
  });

  // Get current user (full profile incl. name, avatar, license, created_at)
  app.get('/api/auth/me', requireAuth, (req, res) => {
    try {
      const full = getUserByEmail(req.user.email);
      res.json({
        success: true,
        user: {
          id: req.user.id,
          email: req.user.email,
          name: full?.name || null,
          avatarUrl: full?.avatar_url || null,
          isAdmin: req.user.isAdmin,
          isPremium: req.user.isPremium,
          gumroadLicense: req.user.gumroadLicense,
          licenseActivatedAt: full?.license_activated_at || null,
          createdAt: full?.created_at || null,
          onboardingCompleted: req.user.onboardingCompleted,
          authMethod: full?.google_id ? 'google' : 'password',
        }
      });
    } catch (e) {
      res.json({ success: true, user: req.user });
    }
  });

  // Activate license
  app.post('/api/auth/activate-license', requireAuth, (req, res) => {
    const { licenseKey } = req.body;
    if (!licenseKey) {
      return res.status(400).json({ success: false, error: 'License key required' });
    }
    activateLicense(req.user.id, licenseKey);
    res.json({ success: true, message: 'License activated' });
  });

  // Complete onboarding
  app.post('/api/auth/complete-onboarding', requireAuth, (req, res) => {
    completeOnboarding(req.user.id);
    res.json({ success: true });
  });

  // Google OAuth — verify credential from Google Identity Services
  app.post('/api/auth/google', async (req, res) => {
    try {
      const { credential } = req.body;
      if (!credential) return res.status(400).json({ success: false, error: 'Missing credential' });

      if (!process.env.GOOGLE_CLIENT_ID) {
        return res.status(503).json({ success: false, error: 'Google login not configured' });
      }

      const ticket = await googleClient.verifyIdToken({
        idToken: credential,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      const payload = ticket.getPayload();
      const { sub: googleId, email, name, picture } = payload;

      if (!email) return res.status(400).json({ success: false, error: 'No email from Google' });

      const { userId, isNew } = upsertGoogleUser({
        googleId,
        email,
        name: name || email.split('@')[0],
        avatarUrl: picture || null,
      });

      const token = generateToken({ userId });
      const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;
      createSession(userId, token, expiresAt);

      const user = getUserByEmail(email);
      res.json({
        success: true,
        token,
        isNew,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          avatarUrl: user.avatar_url,
          isAdmin: user.is_admin === 1,
          isPremium: user.is_premium === 1,
          onboardingCompleted: user.onboarding_completed === 1,
        },
      });
    } catch (e) {
      console.error('[GOOGLE AUTH]', e.message);
      res.status(401).json({ success: false, error: 'Google authentication failed' });
    }
  });

  // Clean up expired sessions (run daily)
  setInterval(() => {
    deleteExpiredSessions();
  }, 24 * 60 * 60 * 1000);
}
