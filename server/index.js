import crypto from 'crypto';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import { Resend } from 'resend';
import { PrismaClient } from '@prisma/client';

dotenv.config();

const app = express();
const prisma = new PrismaClient();

const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'webto_ai_super_secure_jwt_secret_key_2026';

// Native SHA256 password hashing
const hashPassword = (pw) => crypto.createHash('sha256').update(pw).digest('hex');

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

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Health Check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', uptime: process.uptime() });
});

app.get('/', (req, res) => {
  res.send('WEBTO AI Backend & Synthesis Engine running!');
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

    if (decoded.role === 'ADMIN' && decoded.userId === 'admin') {
      let adminRecord = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
      if (!adminRecord) {
        adminRecord = await prisma.user.findFirst();
      }
      req.user = adminRecord || { id: decoded.userId, email: decoded.email, role: 'ADMIN' };
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
// AI SYNTHESIS HELPERS
// ============================================================
function cleanAndParseJSON(rawText) {
  let cleaned = (rawText || '').trim();
  cleaned = cleaned.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();

  try {
    return JSON.parse(cleaned);
  } catch (err) {
    const sanitized = cleaned.replace(/"((?:\\.|[^"\\])*)"/gs, (match) => {
      return match
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r')
        .replace(/\t/g, '\\t');
    });
    return JSON.parse(sanitized);
  }
}

const SYSTEM_PROMPT = `
You are the Lead Full-Stack Software Architect and UI/UX Designer for WEBTO AI.
Generate a complete, single-page full-stack web application based on the user's prompt.

CRITICAL RULES:
1. "entryHtml": MUST be a 100% complete, working HTML5 file with Tailwind CSS (<script src="[https://cdn.tailwindcss.com](https://cdn.tailwindcss.com)"></script>) and FontAwesome 6 (<link rel="stylesheet" href="[https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css](https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css)" />).
2. Implement full interactive state in JavaScript (window.state, dynamic filters, interactive cart/counter actions, modal popups).
3. "files": Provide an array of modular files ({ name, path, content }).
4. Return ONLY a valid JSON object with keys "entryHtml" and "files". No markdown backticks.
`;

async function generateProjectCode(prompt, projectType = 'FULL_STACK', existingCode = '', image = null) {
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey) throw new Error('GEMINI_API_KEY is not configured on Render.');

  let fullPrompt = `${SYSTEM_PROMPT}\n\nProject Architecture Type: ${projectType}\nUser Requirements:\n${prompt}`;
  if (existingCode) {
    fullPrompt += `\n\nExisting Application Code:\n${existingCode.slice(0, 15000)}`;
  }

  const parts = [{ text: fullPrompt }];

  if (image) {
    let mimeType = 'image/png';
    let base64Data = image;

    if (image.startsWith('data:')) {
      const matches = image.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
      if (matches && matches.length === 3) {
        mimeType = matches[1];
        base64Data = matches[2];
      } else {
        base64Data = image.split(',')[1] || image;
      }
    }

    parts.unshift({
      inline_data: {
        mime_type: mimeType,
        data: base64Data,
      },
    });
  }
  const endpoint = [
    'https:',
    '',
    'generativelanguage.googleapis.com',
    'v1beta',
    'models',
    'gemini-3.6-flash:generateContent'
  ].join('/');

  const url = `${endpoint}?key=${encodeURIComponent(apiKey)}`;
  
       
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify({
      contents: [{ role: 'user', parts }],
      generationConfig: {
        responseMimeType: 'application/json',
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const textOutput = data.candidates?.[0]?.content?.parts?.[0]?.text;
  return cleanAndParseJSON(textOutput);
}


async function generateChatReply(projectName, projectType, messages) {
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey) throw new Error('GEMINI_API_KEY missing.');

  const formattedHistory = messages
    .map((m) => `${m.role === 'user' ? 'User' : 'Lead Architect'}: ${m.content}`)
    .join('\n');

  const prompt = `
You are the Lead Architect for WEBTO AI. Interview the user to plan the app.
Project: "${projectName || 'Web App'}" (${projectType || 'FULL_STACK'})

History:
${formattedHistory}

INSTRUCTIONS:
1. Ask 1-2 focused questions about key features or styles (under 3 sentences).
2. Always end with 3 suggestion chips strictly formatted as: [CHIPS: Option 1 | Option 2 | Option 3]
`;

          const endpoint = [
    'https:',
    '',
    'generativelanguage.googleapis.com',
    'v1beta',
    'models',
    'gemini-3.6-flash:generateContent'
  ].join('/');

  const url = `${endpoint}?key=${encodeURIComponent(apiKey)}`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    }),
  });

  const data = await response.json();
  const replyText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

  let chips = [];
  const chipMatch = replyText.match(/\[CHIPS:\s*(.*?)\]/i);
  if (chipMatch) {
    chips = chipMatch[1].split('|').map((c) => c.trim());
  }

  const cleanedMessage = replyText.replace(/\[CHIPS:\s*.*?\]/i, '').trim();
  return { message: cleanedMessage, chips };
}

// ============================================================
// 1. AUTHENTICATION ROUTES
// ============================================================
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email) return res.status(400).json({ error: 'Email address is required.' });

    const cleanEmail = email.trim().toLowerCase();
    let user = await prisma.user.findUnique({ where: { email: cleanEmail } });

    if (!user) {
      const defaultPass = hashPassword(password || 'webtoai_default');
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
      const hashedAttempt = hashPassword(password);
      if (user.password !== hashedAttempt && user.password !== password && !user.password.startsWith('$2')) {
        return res.status(401).json({ error: 'Invalid password. Please check your credentials.' });
      }
    }

    const token = jwt.sign({ userId: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '30d' });
    return res.status(200).json({ success: true, token, user: formatSafeUser(user) });
  } catch (err) {
    return res.status(500).json({ error: 'Login failed.' });
  }
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, name, password, authProvider } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required.' });

    const cleanEmail = email.trim().toLowerCase();
    let user = await prisma.user.findUnique({ where: { email: cleanEmail } });

    if (!user) {
      const hashedPassword = hashPassword(password || crypto.randomBytes(16).toString('hex'));
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
    return res.status(500).json({ error: 'Registration failed.' });
  }
});

app.post('/api/auth/oauth', async (req, res) => {
  try {
    const { email, name, provider } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required.' });

    const cleanEmail = email.trim().toLowerCase();
    let user = await prisma.user.findUnique({ where: { email: cleanEmail } });

    if (!user) {
      const dummyPass = hashPassword(crypto.randomBytes(16).toString('hex'));
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
    return res.status(500).json({ error: 'OAuth failed.' });
  }
});

app.post('/api/auth/google', async (req, res) => {
  try {
    const { access_token } = req.body;
    if (!access_token) return res.status(400).json({ error: 'Access token is required' });

    const googleRes = await fetch('[https://www.googleapis.com/oauth2/v3/userinfo](https://www.googleapis.com/oauth2/v3/userinfo)', {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    if (!googleRes.ok) return res.status(401).json({ error: 'Failed to verify Google account' });

    const profile = await googleRes.json();
    const cleanEmail = profile.email.trim().toLowerCase();

    let user = await prisma.user.findUnique({ where: { email: cleanEmail } });
    if (!user) {
      const dummyPass = hashPassword(crypto.randomBytes(16).toString('hex'));
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
    return res.status(500).json({ error: 'Google authentication failed' });
  }
});

app.post('/api/auth/github', async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: 'Authorization code is required' });

    const clientId = process.env.GITHUB_CLIENT_ID;
    const clientSecret = process.env.GITHUB_CLIENT_SECRET;

    const tokenRes = await fetch('[https://github.com/login/oauth/access_token](https://github.com/login/oauth/access_token)', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code }),
    });

    const tokenData = await tokenRes.json();
    if (tokenData.error || !tokenData.access_token) {
      return res.status(401).json({ error: 'Failed to exchange GitHub authorization code.' });
    }

    const userRes = await fetch('[https://api.github.com/user](https://api.github.com/user)', {
      headers: { Authorization: `Bearer ${tokenData.access_token}`, 'User-Agent': 'WEBTOAI' },
    });

    const ghUser = await userRes.json();
    let email = ghUser.email || `${ghUser.login}@users.noreply.github.com`;

    const cleanEmail = email.trim().toLowerCase();
    let user = await prisma.user.findUnique({ where: { email: cleanEmail } });
    if (!user) {
      const dummyPass = hashPassword(crypto.randomBytes(16).toString('hex'));
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
    return res.status(500).json({ error: 'GitHub authentication failed' });
  }
});

app.get('/api/auth/me', authenticate, (req, res) => {
  return res.json({ user: formatSafeUser(req.user) });
});

// ============================================================
// 2. PROJECT CREATION & WORKSPACE ROUTES
// ============================================================
app.post('/api/projects', authenticate, async (req, res) => {
  try {
    const { name, description, type } = req.body;
    const userId = req.user.id;

    const baseSlug = (name || 'project')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 30);
    const uniqueSlug = `${baseSlug}-${Date.now().toString().slice(-5)}`;

    const project = await prisma.project.create({
      data: {
        name: name || 'New Application',
        description: description || '',
        type: type || 'FULL_STACK',
        userId: userId,
        slug: uniqueSlug,
        entryHtml: '',
      },
    });

    return res.status(201).json({ success: true, project });
  } catch (error) {
    console.error('Create project error:', error);
    return res.status(500).json({ error: error.message || 'Failed to create project in database.' });
  }
});

app.get('/api/projects/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        user: true,
      },
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    return res.json({ project });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to retrieve project.' });
  }
});

app.post('/api/generate/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { prompt, image } = req.body;

    if (req.user.role !== 'ADMIN') {
      const remaining = Math.max(0, (req.user.freeBuildsTotal ?? 3) - (req.user.freeBuildsUsed ?? 0)) + (req.user.credits || 0);
      if (remaining <= 0) {
        return res.status(403).json({ error: 'No build credits remaining. Please upgrade or refill.' });
      }
    }

    const project = await prisma.project.findUnique({
      where: { id },
    });
    if (!project) return res.status(404).json({ error: 'Project not found.' });

    const aiResult = await generateProjectCode(prompt, project.type, project.entryHtml, image);

    const updatedProject = await prisma.project.update({
      where: { id },
      data: {
        entryHtml: aiResult.entryHtml,
        updatedAt: new Date(),
      },
    });

    let updatedUser = req.user;
    if (req.user.role !== 'ADMIN') {
      updatedUser = await prisma.user.update({
        where: { id: req.user.id },
        data: { freeBuildsUsed: { increment: 1 } },
      });
    }

    const finalCredits = Math.max(0, (updatedUser.freeBuildsTotal ?? 3) - (updatedUser.freeBuildsUsed ?? 0)) + (updatedUser.credits || 0);

    return res.json({
      success: true,
      entryHtml: updatedProject.entryHtml,
      files: aiResult.files || [],
      remainingCredits: finalCredits,
    });
  } catch (error) {
    console.error('Synthesis error:', error);
    return res.status(500).json({ error: error.message || 'AI generation failed' });
  }
});

app.post('/api/chat/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { messages } = req.body;
    const project = await prisma.project.findUnique({ where: { id } });

    const chatResponse = await generateChatReply(project?.name, project?.type, messages || []);
    return res.json(chatResponse);
  } catch (error) {
    return res.status(500).json({ error: 'Chat synthesis failed.' });
  }
});

app.patch('/api/projects/:id/visibility', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { isPublic } = req.body;

    const project = await prisma.project.update({
      where: { id },
      data: { isPublic: !!isPublic },
    });

    return res.json({ success: true, isPublic: project.isPublic });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update visibility.' });
  }
});

app.patch('/api/projects/:id/seo', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, slug, description } = req.body;

    const project = await prisma.project.update({
      where: { id },
      data: {
        name: title,
        slug: slug,
        description: description,
      },
    });

    return res.json({ success: true, project, entryHtml: project.entryHtml });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update SEO metadata.' });
  }
});

app.post('/api/deploy/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const project = await prisma.project.findUnique({ where: { id } });
    if (!project) return res.status(404).json({ error: 'Project not found.' });

    const deployedUrl = `[https://webtoai.vercel.app/preview/$](https://webtoai.vercel.app/preview/$){project.slug || project.id}`;
    await prisma.project.update({
      where: { id },
      data: { isDeployed: true, deployedUrl },
    });

    return res.json({ success: true, project, deployedUrl });
  } catch (err) {
    return res.status(500).json({ error: 'Deployment failed.' });
  }
});

// ============================================================
// 3. ADMIN PANEL & MANAGEMENT
// ============================================================
app.post('/api/admin/request-otp', async (req, res) => {
  try {
    const { email } = req.body;
    const adminEmail = (process.env.ADMIN_EMAIL || 'webtoai26@gmail.com').trim().toLowerCase();

    if (!email || email.trim().toLowerCase() !== adminEmail) {
      return res.status(403).json({ error: 'Unauthorized admin email.' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    adminOtpStore[adminEmail] = { otp, expiresAt: Date.now() + 10 * 60 * 1000 };

    if (resend) {
      await resend.emails.send({
        from: 'onboarding@resend.dev',
        to: [adminEmail],
        subject: 'WEBTO AI Admin OTP',
        html: `<p>Your Admin OTP: <b>${otp}</b></p>`,
      });
    }

    return res.json({ success: true, message: 'OTP sent successfully.' });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to dispatch OTP.' });
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
    let adminUser = await prisma.user.findUnique({ where: { email: cleanEmail } });
    if (!adminUser) {
      adminUser = await prisma.user.create({
        data: { email: cleanEmail, name: 'Admin', role: 'ADMIN', freeBuildsTotal: 99999 },
      });
    }

    const token = jwt.sign({ userId: adminUser.id, role: 'ADMIN', email: cleanEmail }, JWT_SECRET, { expiresIn: '30d' });
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
    const creditsSold = successfulPayments.reduce((acc, curr) => acc + (curr.creditsGranted || 0), 0);

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
    return res.status(500).json({ error: 'Failed to fetch dashboard data.' });
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

// Server Launch
app.listen(PORT, '0.0.0.0', () => {
  console.log(`WEBTO AI Full Engine running on port ${PORT}`);
});
