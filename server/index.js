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
// 2. LIVE DASHBOARD DATA & OVERVIEW (FROM POSTGRESQL PRISMA)
// ============================================================
const handleDashboardData = async (req, res) => {
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
      prisma.deployment ? prisma.deployment.count({ where: { status: 'READY' } }).catch(() => 0) : 0,
      prisma.payment.aggregate({
        _sum: { amount: true },
        where: { status: 'SUCCESS' },
      }).catch(() => ({ _sum: { amount: 0 } })),
      prisma.payment.aggregate({
        _sum: { creditsGranted: true },
        where: { status: 'SUCCESS' },
      }).catch(() => ({ _sum: { creditsGranted: 0 } })),
      prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { projects: true } } },
      }),
      prisma.project.findMany({
        take: 20,
        orderBy: { updatedAt: 'desc' },
        include: { user: { select: { name: true, email: true } } },
      }).catch(() => []),
      prisma.payment.findMany({
        take: 20,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { name: true, email: true } },
          creditPackage: { select: { name: true } },
        },
      }).catch(() => []),
      prisma.creditPackage.findMany({
        where: { isActive: true },
        orderBy: { priceInInr: 'asc' },
      }).catch(() => []),
    ]);

    const rawRevenue = revenueResult?._sum?.amount || 0;
    const formattedRevenue = `₹${rawRevenue.toLocaleString('en-IN')}`;
    const totalCreditsSold = (creditsSoldResult?._sum?.creditsGranted || 0).toLocaleString('en-IN');

    const formattedPackages = creditPackages.length > 0
      ? creditPackages.map((p) => ({
          id: p.id,
          name: p.name,
          price: `₹${p.priceInInr}`,
          priceVal: p.priceInInr,
          credits: `${p.credits} Credits`,
          creditsVal: p.credits,
          priceInInr: p.priceInInr,
        }))
      : [
          { id: 'starter', name: 'Starter Plan', price: '₹99', priceVal: 99, credits: '100 Credits', creditsVal: 100, priceInInr: 99 },
          { id: 'builder', name: 'Builder Plan', price: '₹399', priceVal: 399, credits: '500 Credits', creditsVal: 500, priceInInr: 399 },
          { id: 'pro', name: 'Pro Plan', price: '₹999', priceVal: 999, credits: '1500 Credits', creditsVal: 1500, priceInInr: 999 },
        ];

    const statsObj = {
      totalUsers: totalUsers.toLocaleString('en-IN'),
      totalProjects: totalProjects.toLocaleString('en-IN'),
      totalRevenue: formattedRevenue,
      creditsSold: totalCreditsSold,
      activeDeployments: (activeDeployments || totalProjects || 0).toString(),
    };

    const formattedUsers = users.map((u) => {
      const total = u.freeBuildsTotal ?? 3;
      const used = u.freeBuildsUsed ?? 0;
      const balance = Math.max(0, total - used) + (u.credits || 0);

      return {
        id: u.id,
        name: u.name || 'Anonymous User',
        email: u.email,
        credits: balance,
        projectsCount: u._count?.projects || 0,
        authProvider: u.authProvider || 'LOCAL',
        role: u.role,
        joined: new Date(u.createdAt).toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        }),
      };
    });

    const formattedTransactions = payments.map((p) => ({
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
    }));

    return res.status(200).json({
      // Values for App.jsx (/api/admin/overview)
      totalUsers,
      totalProjects,
      totalRevenue: rawRevenue,
      // Values for AdminDashboard.jsx (/api/admin/dashboard-data)
      metrics: statsObj,
      stats: statsObj,
      users: formattedUsers,
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
      transactions: formattedTransactions,
      payments: formattedTransactions,
      packages: formattedPackages,
      creditPackages: formattedPackages,
    });
  } catch (error) {
    console.error('Admin dashboard data fetch error:', error);
    res.status(500).json({ error: 'Failed to retrieve admin dashboard records' });
  }
};

app.get('/api/admin/dashboard-data', handleDashboardData);
app.get('/api/admin/overview', handleDashboardData);
app.get('/api/admin/payments', handleDashboardData);

// ============================================================
// 3. GRANT FREE CREDITS GLOBALLY (ALL USERS)
// ============================================================
const handleGrantGlobalCredits = async (req, res) => {
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
};

app.post('/api/admin/credits/grant-global', handleGrantGlobalCredits);
app.post('/api/admin/credits/global', handleGrantGlobalCredits);

// ============================================================
// 4. ADJUST CREDITS FOR A SPECIFIC USER
// ============================================================
const handleAdjustUserCredits = async (req, res) => {
  try {
    const { email, userId, delta, amount } = req.body;
    const change = parseInt(delta ?? amount, 10);

    let whereClause = {};
    if (email) whereClause = { email: email.trim().toLowerCase() };
    else if (userId) whereClause = { id: userId };
    else return res.status(400).json({ error: 'User email or ID is required' });

    const user = await prisma.user.findFirst({ where: whereClause });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        freeBuildsTotal: { increment: change },
      },
    });

    return res.status(200).json({
      success: true,
      message: `Adjusted credits for ${user.name || user.email}`,
      user: updatedUser,
    });
  } catch (error) {
    console.error('User credit adjustment error:', error);
    res.status(500).json({ error: 'Failed to update user credits' });
  }
};

app.post('/api/admin/credits/adjust-user', handleAdjustUserCredits);
app.post('/api/admin/credits/user', handleAdjustUserCredits);

// ============================================================
// 5. DYNAMIC PACKAGE SYNC (PERSISTENT PRICING IN POSTGRESQL)
// ============================================================
app.get('/api/payments/packages', async (req, res) => {
  try {
    const packages = await prisma.creditPackage.findMany({
      where: { isActive: true },
      orderBy: { priceInInr: 'asc' },
    });

    // Provide map format for App.jsx as well as array
    const packageMap = {
      starter: { name: 'Starter Plan', priceInInr: 99, credits: 100 },
      builder: { name: 'Builder Plan', priceInInr: 399, credits: 500 },
      pro: { name: 'Pro Plan', priceInInr: 999, credits: 1500 },
    };

    packages.forEach((pkg) => {
      packageMap[pkg.id] = {
        name: pkg.name,
        priceInInr: pkg.priceInInr,
        credits: pkg.credits,
      };
    });

    return res.json({ packages: packageMap, list: packages });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to load packages' });
  }
});

// Handles BOTH single and multi package saves from App.jsx and AdminDashboard.jsx
const handlePackageSaveOrUpdate = async (req, res) => {
  try {
    const { 
      id, 
      packageId, 
      name, 
      credits, 
      price, 
      priceInInr, 
      popular,
      starterPrice,
      starterCredits,
      builderPrice,
      builderCredits,
      proPrice,
      proCredits
    } = req.body;

    const operations = [];

    // Support payload schema from App.jsx
    if (starterPrice !== undefined || starterCredits !== undefined) {
      operations.push(
        prisma.creditPackage.upsert({
          where: { id: 'starter' },
          update: {
            ...(starterPrice !== undefined && { priceInInr: Number(starterPrice) }),
            ...(starterCredits !== undefined && { credits: Number(starterCredits) }),
            isActive: true,
          },
          create: {
            id: 'starter',
            name: 'Starter Plan',
            priceInInr: Number(starterPrice) || 99,
            credits: Number(starterCredits) || 100,
            isActive: true,
          },
        })
      );
    }
    if (builderPrice !== undefined || builderCredits !== undefined) {
      operations.push(
        prisma.creditPackage.upsert({
          where: { id: 'builder' },
          update: {
            ...(builderPrice !== undefined && { priceInInr: Number(builderPrice) }),
            ...(builderCredits !== undefined && { credits: Number(builderCredits) }),
            isActive: true,
          },
          create: {
            id: 'builder',
            name: 'Builder Plan',
            priceInInr: Number(builderPrice) || 399,
            credits: Number(builderCredits) || 500,
            isActive: true,
          },
        })
      );
    }
    if (proPrice !== undefined || proCredits !== undefined) {
      operations.push(
        prisma.creditPackage.upsert({
          where: { id: 'pro' },
          update: {
            ...(proPrice !== undefined && { priceInInr: Number(proPrice) }),
            ...(proCredits !== undefined && { credits: Number(proCredits) }),
            isActive: true,
          },
          create: {
            id: 'pro',
            name: 'Pro Plan',
            priceInInr: Number(proPrice) || 999,
            credits: Number(proCredits) || 1500,
            isActive: true,
          },
        })
      );
    }

    // Support single item save schema
    const targetId = String(id || packageId || '').toLowerCase().trim();
    if (targetId && operations.length === 0) {
      const finalCredits = Number(credits);
      const finalPrice = Number(priceInInr ?? price);

      operations.push(
        prisma.creditPackage.upsert({
          where: { id: targetId },
          update: {
            ...(name && { name }),
            ...(!isNaN(finalCredits) && { credits: finalCredits }),
            ...(!isNaN(finalPrice) && { priceInInr: finalPrice }),
            isActive: true,
          },
          create: {
            id: targetId,
            name: name || (targetId.charAt(0).toUpperCase() + targetId.slice(1)),
            credits: !isNaN(finalCredits) ? finalCredits : 100,
            priceInInr: !isNaN(finalPrice) ? finalPrice : 99,
            popular: !!popular,
            isActive: true,
          },
        })
      );
    }

    await Promise.all(operations);
    console.log('✅ Package updated in PostgreSQL successfully');
    return res.json({ success: true, message: 'Packages saved successfully' });
  } catch (err) {
    console.error('Package update error:', err);
    return res.status(500).json({ error: err.message || 'Failed to update package in database' });
  }
};

app.post('/api/admin/packages/save', handlePackageSaveOrUpdate);
app.post('/api/admin/packages/update', handlePackageSaveOrUpdate);

// ============================================================
// START SERVER
// ============================================================
app.listen(PORT, '0.0.0.0', () => {
  console.log(`WEBTO AI Admin Server running on port ${PORT}`);
});
