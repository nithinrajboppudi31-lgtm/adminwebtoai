import Razorpay from 'razorpay';
import crypto from 'crypto';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Resend } from 'resend';
import { PrismaClient } from '@prisma/client';

dotenv.config();

const app = express();
const prisma = new PrismaClient();

const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'webto_ai_super_secure_jwt_secret_key_2026';

const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:5000',
  process.env.CLIENT_URL,
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (
        origin.endsWith('.vercel.app') ||
        allowedOrigins.includes(origin) ||
        origin.startsWith('http://localhost:')
      ) {
        return callback(null, true);
      }
      return callback(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ limit: '25mb', extended: true }));

// Health Check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', uptime: process.uptime() });
});

app.get('/', (req, res) => {
  res.send('WEBTO AI Backend & Admin Server running!');
});

// Resend Email Service
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const adminOtpStore = {};

const formatSafeUser = (user) => {
  const {
    password: _,
    resetPasswordToken: __,
    resetPasswordExpires: ___,
    ...rest
  } = user;

  const total = rest.freeBuildsTotal ?? 3;
  const used = rest.freeBuildsUsed ?? 0;

  return {
    ...rest,
    credits: Math.max(0, total - used) + (rest.credits || 0),
  };
};

// ============================================================
// AUTHENTICATION MIDDLEWARE
// ============================================================
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authorization token required.' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    if (decoded.role === 'ADMIN') {
      req.user = { id: 'admin', email: decoded.email, role: 'ADMIN' };
      return next();
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
    });

    if (!user) {
      return res.status(401).json({ error: 'User not found.' });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
};

// ============================================================
// 1. MAIN APP USER AUTHENTICATION (Login, Register, OAuth)
// ============================================================

// POST /api/auth/login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email address is required.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    let user = await prisma.user.findUnique({ where: { email: cleanEmail } });

    if (!user) {
      // Auto-provision user if they signed up previously or are using passwordless login
      const defaultPass = await bcrypt.hash(password || 'webtoai_default', 10);
      user = await prisma.user.create({
        data: {
          email: cleanEmail,
          password: defaultPass,
          name: cleanEmail.split('@')[0],
          freeBuildsUsed: 0,
          freeBuildsTotal: 3,
          role: 'USER',
        },
      });
    } else if (password && user.password) {
      const match = await bcrypt.compare(password, user.password).catch(() => false);
      if (!match && user.password !== password) {
        return res.status(401).json({ error: 'Invalid password. Please check your credentials.' });
      }
    }

    const token = jwt.sign({ userId: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '30d' });
    return res.status(200).json({ success: true, token, user: formatSafeUser(user) });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Login failed. Please try again.' });
  }
});

// POST /api/auth/register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, name, password, authProvider } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    let user = await prisma.user.findUnique({ where: { email: cleanEmail } });

    if (!user) {
      const hashedPassword = await bcrypt.hash(password || crypto.randomBytes(16).toString('hex'), 10);
      user = await prisma.user.create({
        data: {
          email: cleanEmail,
          name: name || cleanEmail.split('@')[0],
          password: hashedPassword,
          freeBuildsUsed: 0,
          freeBuildsTotal: 3,
          role: 'USER',
          ...(authProvider ? { authProvider } : {}),
        },
      });
    }

    const token = jwt.sign({ userId: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '30d' });
    return res.status(200).json({ success: true, token, user: formatSafeUser(user) });
  } catch (err) {
    console.error('Register error:', err);
    return res.status(500).json({ error: 'Registration failed.' });
  }
});

// POST /api/auth/oauth (Prompt fallback flow)
app.post('/api/auth/oauth', async (req, res) => {
  try {
    const { email, name, provider } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required.' });

    const cleanEmail = email.trim().toLowerCase();
    let user = await prisma.user.findUnique({ where: { email: cleanEmail } });

    if (!user) {
      const dummyPass = await bcrypt.hash(crypto.randomBytes(16).toString('hex'), 10);
      user = await prisma.user.create({
        data: {
          email: cleanEmail,
          name: name || cleanEmail.split('@')[0],
          password: dummyPass,
          freeBuildsUsed: 0,
          freeBuildsTotal: 3,
          role: 'USER',
          ...(provider ? { authProvider: provider } : {}),
        },
      });
    }

    const token = jwt.sign({ userId: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '30d' });
    return res.status(200).json({ success: true, token, user: formatSafeUser(user) });
  } catch (error) {
    console.error('OAuth fallback error:', error);
    return res.status(500).json({ error: 'OAuth authentication failed.' });
  }
});

// POST /api/auth/google
app.post('/api/auth/google', async (req, res) => {
  try {
    const { access_token } = req.body;
    if (!access_token) return res.status(400).json({ error: 'Access token is required' });

    const googleRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    if (!googleRes.ok) return res.status(401).json({ error: 'Failed to verify Google account' });

    const profile = await googleRes.json();
    const cleanEmail = profile.email.trim().toLowerCase();

    let user = await prisma.user.findUnique({ where: { email: cleanEmail } });

    if (!user) {
      const dummyPass = await bcrypt.hash(crypto.randomBytes(16).toString('hex'), 10);
      user = await prisma.user.create({
        data: {
          email: cleanEmail,
          name: profile.name || cleanEmail.split('@')[0],
          password: dummyPass,
          freeBuildsUsed: 0,
          freeBuildsTotal: 3,
          role: 'USER',
          authProvider: 'GOOGLE',
        },
      });
    }

    const token = jwt.sign({ userId: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '30d' });
    return res.status(200).json({ success: true, token, user: formatSafeUser(user) });
  } catch (error) {
    console.error('Google auth error:', error);
    return res.status(500).json({ error: 'Google authentication failed' });
  }
});

// POST /api/auth/github
app.post('/api/auth/github', async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: 'Authorization code is required' });

    const clientId = process.env.GITHUB_CLIENT_ID;
    const clientSecret = process.env.GITHUB_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return res.status(500).json({ error: 'GitHub OAuth credentials not configured on backend.' });
    }

    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'User-Agent': 'WEBTOAI-App',
      },
      body: JSON.stringify({
        client_id: clientId.trim(),
        client_secret: clientSecret.trim(),
        code: code.trim(),
      }),
    });

    const tokenData = await tokenRes.json();
    if (tokenData.error || !tokenData.access_token) {
      return res.status(401).json({ error: tokenData.error_description || 'Failed to exchange GitHub authorization code.' });
    }

    const userRes = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        'User-Agent': 'WEBTOAI-App',
      },
    });

    const ghUser = await userRes.json();
    let email = ghUser.email;

    if (!email) {
      const emailRes = await fetch('https://api.github.com/user/emails', {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
          'User-Agent': 'WEBTOAI-App',
        },
      });
      const emails = await emailRes.json();
      if (Array.isArray(emails)) {
        const primary = emails.find((e) => e.primary && e.verified);
        email = primary ? primary.email : emails[0]?.email;
      }
    }

    if (!email) {
      email = `${ghUser.login}@users.noreply.github.com`;
    }

    const cleanEmail = email.trim().toLowerCase();
    let user = await prisma.user.findUnique({ where: { email: cleanEmail } });

    if (!user) {
      const dummyPass = await bcrypt.hash(crypto.randomBytes(16).toString('hex'), 10);
      user = await prisma.user.create({
        data: {
          email: cleanEmail,
          name: ghUser.name || ghUser.login || 'GitHub User',
          password: dummyPass,
          freeBuildsUsed: 0,
          freeBuildsTotal: 3,
          role: 'USER',
          authProvider: 'GITHUB',
        },
      });
    }

    const token = jwt.sign({ userId: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '30d' });
    return res.status(200).json({ success: true, token, user: formatSafeUser(user) });
  } catch (error) {
    console.error('GitHub auth error:', error);
    return res.status(500).json({ error: error.message || 'GitHub authentication failed' });
  }
});

app.get('/api/auth/me', authenticate, (req, res) => {
  return res.json({ user: formatSafeUser(req.user) });
});

// ============================================================
// 2. ADMIN PANEL ROUTES
// ============================================================

app.post('/api/admin/request-otp', async (req, res) => {
  try {
    const { email } = req.body;
    const adminEmail = (process.env.ADMIN_EMAIL || 'webtoai26@gmail.com').trim().toLowerCase();

    if (!email || email.trim().toLowerCase() !== adminEmail) {
      return res.status(403).json({ error: 'Unauthorized: Not an admin email.' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    adminOtpStore[adminEmail] = { otp, expiresAt: Date.now() + 10 * 60 * 1000 };
    console.log(`>>> WEBTO ADMIN OTP: ${otp} <<<`);

    if (resend) {
      await resend.emails.send({
        from: 'onboarding@resend.dev',
        to: [adminEmail],
        subject: 'WEBTO AI Admin Access OTP',
        html: `<p>Your Admin OTP is: <b>${otp}</b></p>`,
      });
    }

    return res.json({ success: true, message: 'OTP sent successfully.' });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to send OTP.' });
  }
});

app.post('/api/admin/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;
    const cleanEmail = (email || '').trim().toLowerCase();
    const record = adminOtpStore[cleanEmail];

    if (!record || record.otp !== (otp || '').trim() || Date.now() > record.expiresAt) {
      return res.status(400).json({ error: 'Invalid or expired OTP.' });
    }

    delete adminOtpStore[cleanEmail];
    const token = jwt.sign({ role: 'ADMIN', email: cleanEmail }, JWT_SECRET, { expiresIn: '30d' });
    return res.json({ success: true, token });
  } catch (err) {
    return res.status(500).json({ error: 'Verification failed.' });
  }
});

const handleDashboardData = async (req, res) => {
  try {
    const [totalUsers, totalProjects, users, payments] = await Promise.all([
      prisma.user.count(),
      prisma.project.count(),
      prisma.user.findMany({ orderBy: { createdAt: 'desc' }, take: 50 }),
      prisma.payment.findMany({ orderBy: { createdAt: 'desc' }, take: 50 }).catch(() => []),
    ]);

    const successfulPayments = payments.filter((p) => p.status === 'SUCCESS');
    const totalRevenue = successfulPayments.reduce((acc, curr) => acc + (curr.amount || 0), 0);
    const creditsSold = successfulPayments.reduce((acc, curr) => acc + (curr.creditsGranted || curr.credits || 0), 0);

    const safeUsers = users.map((u) => {
      const total = u.freeBuildsTotal ?? 3;
      const used = u.freeBuildsUsed ?? 0;
      return {
        id: u.id,
        name: u.name || 'Anonymous',
        email: u.email,
        credits: Math.max(0, total - used) + (u.credits || 0),
        role: u.role || 'USER',
        createdAt: u.createdAt,
      };
    });

    return res.json({
      totalUsers,
      totalProjects,
      totalRevenue,
      creditsSold,
      users: safeUsers,
      payments,
      transactions: payments,
      metrics: {
        totalUsers: totalUsers.toString(),
        totalProjects: totalProjects.toString(),
        totalRevenue: `₹${totalRevenue}`,
        creditsSold: creditsSold.toString(),
      },
    });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
};

app.get('/api/admin/overview', handleDashboardData);
app.get('/api/admin/dashboard-data', handleDashboardData);

// Packages
app.get('/api/payments/packages', async (req, res) => {
  const packageMap = {
    starter: { name: 'Starter', priceInInr: 149, credits: 100 },
    builder: { name: 'Builder', priceInInr: 449, credits: 500 },
    pro: { name: 'Pro', priceInInr: 999, credits: 1500 },
  };
  return res.json({ packages: packageMap });
});
app.get('/api/packages', (req, res) => res.redirect('/api/payments/packages'));

// Start Server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`WEBTO AI Full Backend running on port ${PORT}`);
});
