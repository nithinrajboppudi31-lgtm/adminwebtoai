import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { Resend } from 'resend';
import nodemailer from 'nodemailer';

dotenv.config();

const prisma = new PrismaClient();
const app = express();

const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'webto_ai_super_secure_jwt_secret_key_2026';

app.use(cors());
app.use(express.json());

// ============================================================
// EMAIL DISPATCHER (Resend primary, Nodemailer fallback)
// ============================================================
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

const transporter = process.env.ADMIN_EMAIL_SENDER && process.env.ADMIN_EMAIL_PASS
  ? nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.ADMIN_EMAIL_SENDER,
        pass: process.env.ADMIN_EMAIL_PASS,
      },
    })
  : null;

// In-memory OTP storage for admin logins
const adminOtpStore = {};

// ============================================================
// 1. ADMIN AUTHENTICATION (EMAIL OTP ONLY)
// ============================================================

app.post('/api/admin/request-otp', async (req, res) => {
  try {
    const { email } = req.body;
    const adminEmail = (process.env.ADMIN_EMAIL || 'admin@webtoai.com').trim().toLowerCase();

    if (!email || email.trim().toLowerCase() !== adminEmail) {
      return res.status(403).json({ error: 'Unauthorized: Not an admin email address.' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    adminOtpStore[adminEmail] = {
      otp,
      expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
    };

    const emailSubject = '🔐 WEBTO AI Admin Access OTP';
    const emailHtml = `
      <div style="background:#070b14; color:#fff; padding:28px; border-radius:14px; font-family:sans-serif; max-width:440px; margin:auto;">
        <h2 style="color:#60a5fa; margin:0 0 10px;">WEBTO AI Security</h2>
        <p style="color:#94a3b8; font-size:13px;">Your one-time login authentication code is:</p>
        <div style="background:#0e1626; border:1px solid #1e293b; padding:14px; border-radius:10px; text-align:center; margin:16px 0;">
          <span style="font-size:26px; letter-spacing:6px; font-weight:bold; color:#38bdf8; font-family:monospace;">${otp}</span>
        </div>
        <p style="color:#64748b; font-size:11px;">This OTP expires in 10 minutes. If you did not request this, ignore this email.</p>
      </div>
    `;

    // Try Resend first
    if (resend) {
      await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL || 'WEBTO AI <onboarding@resend.dev>',
        to: [adminEmail],
        subject: emailSubject,
        html: emailHtml,
      });
      return res.json({ success: true, message: 'OTP sent to your email.' });
    }

    // Try Nodemailer fallback
    if (transporter) {
      await transporter.sendMail({
        from: `"WEBTO AI Security" <${process.env.ADMIN_EMAIL_SENDER}>`,
        to: adminEmail,
        subject: emailSubject,
        html: emailHtml,
      });
      return res.json({ success: true, message: 'OTP sent to your email.' });
    }

    // Dev mode fallback
    console.log(`[DEV OTP]: Code for ${adminEmail} is: ${otp}`);
    return res.json({ success: true, devOtp: otp, message: 'OTP generated (Check console in dev mode).' });
  } catch (err) {
    console.error('Admin OTP Dispatch Error:', err);
    return res.status(500).json({ error: 'Failed to send admin OTP.' });
  }
});

app.post('/api/admin/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;
    const cleanEmail = (email || '').trim().toLowerCase();
    const record = adminOtpStore[cleanEmail];

    if (!record || record.otp !== (otp || '').trim() || Date.now() > record.expiresAt) {
      return res.status(400).json({ error: 'Invalid or expired OTP code.' });
    }

    delete adminOtpStore[cleanEmail];

    // Ensure admin user exists in DB
    let adminUser = await prisma.user.findUnique({ where: { email: cleanEmail } });
    if (!adminUser) {
      adminUser = await prisma.user.create({
        data: {
          email: cleanEmail,
          name: 'Admin User',
          role: 'ADMIN',
          freeBuildsTotal: 99999,
        },
      });
    } else if (adminUser.role !== 'ADMIN') {
      await prisma.user.update({ where: { id: adminUser.id }, data: { role: 'ADMIN' } });
    }

    const token = jwt.sign({ userId: adminUser.id, role: 'ADMIN' }, JWT_SECRET, { expiresIn: '30d' });
    return res.json({ success: true, token, user: adminUser });
  } catch (err) {
    console.error('Admin Verify Error:', err);
    return res.status(500).json({ error: 'Failed to verify admin OTP.' });
  }
});

// ============================================================
// 2. LIVE DASHBOARD DATA (FROM POSTGRESQL PRISMA)
// ============================================================
app.get('/api/admin/dashboard-data', async (req, res) => {
  try {
    const [
      totalUsers,
      totalProjects,
      activeDeployments,
      revenueResult,
      creditsSoldResult,
      users,
      projects,
      payments,
      creditPackages,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.project.count(),
      prisma.deployment.count({ where: { status: 'READY' } }),
      prisma.payment.aggregate({
        _sum: { amount: true },
        where: { status: 'SUCCESS' },
      }),
      prisma.payment.aggregate({
        _sum: { creditsGranted: true },
        where: { status: 'SUCCESS' },
      }),
      prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { projects: true } } },
      }),
      prisma.project.findMany({
        take: 20,
        orderBy: { updatedAt: 'desc' },
        include: { user: { select: { name: true, email: true } } },
      }),
      prisma.payment.findMany({
        take: 20,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { name: true, email: true } },
          creditPackage: { select: { name: true } },
        },
      }),
      prisma.creditPackage.findMany({
        where: { isActive: true },
        orderBy: { priceInInr: 'asc' },
      }),
    ]);

    const formattedRevenue = `₹${(revenueResult._sum.amount || 0).toLocaleString('en-IN')}`;
    const totalCreditsSold = (creditsSoldResult._sum.creditsGranted || 0).toLocaleString('en-IN');

    return res.status(200).json({
      metrics: {
        totalUsers: totalUsers.toLocaleString('en-IN'),
        totalProjects: totalProjects.toLocaleString('en-IN'),
        totalRevenue: formattedRevenue,
        creditsSold: totalCreditsSold,
        activeDeployments: activeDeployments.toString(),
      },
      users: users.map((u) => {
        const total = u.freeBuildsTotal ?? 3;
        const used = u.freeBuildsUsed ?? 0;
        const balance = Math.max(0, total - used) + (u.credits || 0);

        return {
          id: u.id,
          name: u.name || 'Anonymous User',
          email: u.email,
          credits: balance,
          projectsCount: u._count.projects,
          authProvider: u.authProvider || 'LOCAL',
          role: u.role,
          joined: new Date(u.createdAt).toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          }),
        };
      }),
      projects: projects.map((p) => ({
        id: p.id,
        name: p.name,
        type: p.type,
        ownerName: p.user?.name || 'Anonymous',
        ownerEmail: p.user?.email || 'N/A',
        isDeployed: p.isDeployed,
        deployedUrl: p.deployedUrl,
        updatedAt: new Date(p.updatedAt).toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        }),
      })),
      transactions: payments.map((p) => ({
        id: p.razorpayPaymentId || p.razorpayOrderId || p.id,
        user: p.user?.name || p.user?.email || 'Anonymous',
        userEmail: p.user?.email || '',
        amount: `₹${p.amount}`,
        status: p.status === 'SUCCESS' ? 'Success' : p.status === 'FAILED' ? 'Failed' : 'Pending',
        creditsGranted: p.creditsGranted,
        date: new Date(p.createdAt).toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        }),
      })),
      packages:
        creditPackages.length > 0
          ? creditPackages
          : [
              { id: 'starter', name: 'Starter Plan', credits: 100, priceInInr: 99, popular: false },
              { id: 'builder', name: 'Builder Plan', credits: 500, priceInInr: 399, popular: true },
              { id: 'pro', name: 'Pro Plan', credits: 1500, priceInInr: 999, popular: false },
            ],
    });
  } catch (error) {
    console.error('Admin dashboard data fetch error:', error);
    res.status(500).json({ error: 'Failed to retrieve admin dashboard records' });
  }
});

// ============================================================
// 3. GRANT FREE CREDITS GLOBALLY (ALL USERS)
// ============================================================
app.post('/api/admin/credits/grant-global', async (req, res) => {
  try {
    const { amount } = req.body;
    const addAmount = parseInt(amount, 10);

    if (isNaN(addAmount) || addAmount <= 0) {
      return res.status(400).json({ error: 'Please enter a valid credit number' });
    }

    const result = await prisma.user.updateMany({
      data: {
        freeBuildsTotal: { increment: addAmount },
      },
    });

    return res.status(200).json({
      success: true,
      message: `Granted +${addAmount} build credits to all ${result.count} registered users!`,
    });
  } catch (error) {
    console.error('Global credit error:', error);
    res.status(500).json({ error: 'Failed to distribute credits globally' });
  }
});

// ============================================================
// 4. ADJUST CREDITS FOR A SPECIFIC USER
// ============================================================
app.post('/api/admin/credits/adjust-user', async (req, res) => {
  try {
    const { email, delta } = req.body;
    const change = parseInt(delta, 10);

    if (!email) {
      return res.status(400).json({ error: 'User email is required' });
    }

    const user = await prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const [updatedUser] = await prisma.$transaction([
      prisma.user.update({
        where: { email: email.trim().toLowerCase() },
        data: {
          freeBuildsTotal: { increment: change },
        },
      }),
      prisma.creditTransaction.create({
        data: {
          userId: user.id,
          type: change > 0 ? 'CREDIT_PURCHASE' : 'CREDIT_USED',
          amount: Math.abs(change),
          balanceAfter: Math.max(0, (user.freeBuildsTotal + change) - user.freeBuildsUsed),
          description: `Admin manual adjustment of ${change > 0 ? '+' : ''}${change} build credits`,
        },
      }),
    ]);

    return res.status(200).json({
      success: true,
      user: updatedUser,
    });
  } catch (error) {
    console.error('User credit adjustment error:', error);
    res.status(500).json({ error: 'Failed to update user credits' });
  }
});

// ============================================================
// 5. DYNAMIC PACKAGE SYNC (LIVE WITH MAIN WEBSITE)
// ============================================================
app.get('/api/payments/packages', async (req, res) => {
  try {
    const packages = await prisma.creditPackage.findMany({
      where: { isActive: true },
      orderBy: { priceInInr: 'asc' },
    });
    return res.json({ packages });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to load packages' });
  }
});

app.post('/api/admin/packages/save', async (req, res) => {
  try {
    const { id, name, credits, priceInInr, popular } = req.body;

    const savedPackage = await prisma.creditPackage.upsert({
      where: { id: id || `pkg_${Date.now()}` },
      update: {
        name,
        credits: Number(credits),
        priceInInr: Number(priceInInr),
        popular: !!popular,
        isActive: true,
      },
      create: {
        name,
        credits: Number(credits),
        priceInInr: Number(priceInInr),
        popular: !!popular,
        isActive: true,
      },
    });

    return res.json({ success: true, package: savedPackage });
  } catch (err) {
    console.error('Package save error:', err);
    return res.status(500).json({ error: 'Failed to update package in database' });
  }
});

// ============================================================
// START SERVER
// ============================================================
app.listen(PORT, () => {
  console.log(`WEBTO AI Admin Server running on port ${PORT}`);
});