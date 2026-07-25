import { Router } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { prisma } from '../lib/prisma.js';
import { hashCode, checkCode, sendEmail, devEmailMode, publicUser } from '../lib/util.js';
import { setAuthCookie, clearAuthCookie, requireAuth } from '../middleware/auth.js';
import crypto from 'crypto';

const r = Router();
const authLimit = rateLimit({ windowMs: 15 * 60 * 1000, max: 50, standardHeaders: true, legacyHeaders: false });

const DOMAIN = () => (process.env.ALLOWED_EMAIL_DOMAIN || 'bitsom.edu.in').toLowerCase();
const validEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && e.toLowerCase().endsWith('@' + DOMAIN());

async function issueCode(userId, purpose) {
  const code = String(crypto.randomInt(100000, 1000000));
  await prisma.emailToken.updateMany({ where: { userId, purpose, usedAt: null }, data: { usedAt: new Date() } });
  await prisma.emailToken.create({ data: { userId, purpose, codeHash: await hashCode(code), expiresAt: new Date(Date.now() + 15 * 60 * 1000) } });
  return code;
}

r.post('/signup', authLimit, async (req, res) => {
  const { fullName, email, password, confirmPassword, batch, phone } = req.body || {};
  if (!fullName || !email || !password) return res.status(400).json({ error: 'Full name, email and password are required.' });
  if (password !== confirmPassword) return res.status(400).json({ error: 'Passwords do not match.' });
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  if (!validEmail(email)) return res.status(400).json({ error: `Registration is restricted to @${DOMAIN()} email addresses.` });
  const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (existing) return res.status(409).json({ error: 'An account with this email already exists.' });
  const user = await prisma.user.create({ data: {
    fullName: fullName.trim(), email: email.toLowerCase(),
    passwordHash: await bcrypt.hash(password, 10),
    batch: batch || null, phone: phone || null,
  }});
  const code = await issueCode(user.id, 'verify_email');
  sendEmail(user.email, 'Verify your SoMart account', `Your verification code is ${code}`);
  setAuthCookie(res, user);
  res.json({ user: publicUser(user), ...(devEmailMode() ? { devCode: code } : {}) });
});

r.post('/login', authLimit, async (req, res) => {
  const { email, password } = req.body || {};
  const user = email && await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user || !(await bcrypt.compare(password || '', user.passwordHash))) return res.status(401).json({ error: 'Invalid email or password.' });
  if (user.accountStatus === 'blocked') return res.status(403).json({ error: 'This account has been blocked.' });
  setAuthCookie(res, user);
  res.json({ user: publicUser(user) });
});

r.post('/logout', (req, res) => { clearAuthCookie(res); res.json({ ok: true }); });

r.get('/me', async (req, res) => res.json({ user: req.user ? publicUser(req.user) : null }));

r.post('/verify-email', requireAuth, async (req, res) => {
  const { code } = req.body || {};
  const token = await prisma.emailToken.findFirst({ where: { userId: req.user.id, purpose: 'verify_email', usedAt: null }, orderBy: { createdAt: 'desc' } });
  if (!token || token.expiresAt < new Date()) return res.status(400).json({ error: 'Code expired. Request a new one.' });
  if (token.attempts >= 5) return res.status(429).json({ error: 'Too many attempts. Request a new code.' });
  await prisma.emailToken.update({ where: { id: token.id }, data: { attempts: { increment: 1 } } });
  if (!code || !(await checkCode(String(code), token.codeHash))) return res.status(400).json({ error: 'Incorrect code.' });
  await prisma.$transaction([
    prisma.emailToken.update({ where: { id: token.id }, data: { usedAt: new Date() } }),
    prisma.user.update({ where: { id: req.user.id }, data: { emailVerified: true } }),
  ]);
  res.json({ ok: true });
});

r.post('/resend-verification', requireAuth, authLimit, async (req, res) => {
  if (req.user.emailVerified) return res.status(400).json({ error: 'Email already verified.' });
  const code = await issueCode(req.user.id, 'verify_email');
  sendEmail(req.user.email, 'Verify your SoMart account', `Your verification code is ${code}`);
  res.json({ ok: true, ...(devEmailMode() ? { devCode: code } : {}) });
});

r.post('/forgot-password', authLimit, async (req, res) => {
  const { email } = req.body || {};
  const user = email && await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  let devCode;
  if (user) {
    const code = await issueCode(user.id, 'reset_password');
    sendEmail(user.email, 'SoMart password reset', `Your reset code is ${code}`);
    if (devEmailMode()) devCode = code;
  }
  res.json({ ok: true, message: 'If the account exists, a reset code has been sent.', ...(devCode ? { devCode } : {}) });
});

r.post('/reset-password', authLimit, async (req, res) => {
  const { email, code, password } = req.body || {};
  if (!password || password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  const user = email && await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user) return res.status(400).json({ error: 'Invalid reset request.' });
  const token = await prisma.emailToken.findFirst({ where: { userId: user.id, purpose: 'reset_password', usedAt: null }, orderBy: { createdAt: 'desc' } });
  if (!token || token.expiresAt < new Date()) return res.status(400).json({ error: 'Code expired. Request a new one.' });
  if (token.attempts >= 5) return res.status(429).json({ error: 'Too many attempts. Request a new code.' });
  await prisma.emailToken.update({ where: { id: token.id }, data: { attempts: { increment: 1 } } });
  if (!code || !(await checkCode(String(code), token.codeHash))) return res.status(400).json({ error: 'Incorrect code.' });
  await prisma.$transaction([
    prisma.emailToken.update({ where: { id: token.id }, data: { usedAt: new Date() } }),
    prisma.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(password, 10) } }),
  ]);
  res.json({ ok: true });
});

// Admin login (separate page /admin/login)
r.post('/admin/login', authLimit, async (req, res) => {
  const { username, password } = req.body || {};
  const admin = await prisma.user.findFirst({ where: { role: 'admin', email: `${(username || '').toLowerCase()}@somart.admin` } });
  if (!admin || !(await bcrypt.compare(password || '', admin.passwordHash))) return res.status(401).json({ error: 'Invalid admin credentials.' });
  setAuthCookie(res, admin);
  res.json({ user: publicUser(admin) });
});

export default r;
