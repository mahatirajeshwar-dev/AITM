import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma.js';
import { requireAuth, requireVerified } from '../middleware/auth.js';
import { publicUser, ratingSummary, safeSeller } from '../lib/util.js';

const r = Router();

// ---- Notifications ----
r.get('/notifications', requireAuth, async (req, res) => {
  const notifications = await prisma.notification.findMany({ where: { userId: req.user.id }, orderBy: { createdAt: 'desc' }, take: 50 });
  const unread = await prisma.notification.count({ where: { userId: req.user.id, readAt: null } });
  res.json({ notifications, unread });
});
r.post('/notifications/read', requireAuth, async (req, res) => {
  await prisma.notification.updateMany({ where: { userId: req.user.id, readAt: null }, data: { readAt: new Date() } });
  res.json({ ok: true });
});

// ---- Profile ----
r.get('/profile', requireAuth, async (req, res) => {
  const rating = await ratingSummary(req.user.id);
  const reviews = await prisma.review.findMany({ where: { revieweeId: req.user.id }, include: { reviewer: true }, orderBy: { createdAt: 'desc' }, take: 20 });
  res.json({ user: publicUser(req.user), ...rating, reviews: reviews.map(rv => ({ id: rv.id, rating: rv.rating, comment: rv.comment, createdAt: rv.createdAt, reviewer: safeSeller(rv.reviewer) })) });
});
r.put('/profile', requireAuth, async (req, res) => {
  const b = req.body || {};
  const data = {};
  if (b.fullName?.trim()) data.fullName = b.fullName.trim();
  if (b.batch !== undefined) data.batch = b.batch || null;
  if (b.phone !== undefined) data.phone = b.phone || null;
  if (b.profileImage !== undefined) data.profileImage = b.profileImage || null;
  if (b.contactPref && ['chat','phone'].includes(b.contactPref)) data.contactPref = b.contactPref;
  if (b.email && b.email.toLowerCase() !== req.user.email) return res.status(400).json({ error: 'Institutional email cannot be changed directly. Contact admin — re-verification is required.' });
  const user = await prisma.user.update({ where: { id: req.user.id }, data });
  res.json({ user: publicUser(user) });
});
r.put('/profile/password', requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!(await bcrypt.compare(currentPassword || '', req.user.passwordHash))) return res.status(400).json({ error: 'Current password is incorrect.' });
  if (!newPassword || newPassword.length < 8) return res.status(400).json({ error: 'New password must be at least 8 characters.' });
  await prisma.user.update({ where: { id: req.user.id }, data: { passwordHash: await bcrypt.hash(newPassword, 10) } });
  res.json({ ok: true });
});

// Public profile of another user
r.get('/users/:id', async (req, res) => {
  const u = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!u || u.role !== 'student') return res.status(404).json({ error: 'User not found.' });
  const rating = await ratingSummary(u.id);
  const reviews = await prisma.review.findMany({ where: { revieweeId: u.id }, include: { reviewer: true }, orderBy: { createdAt: 'desc' }, take: 10 });
  res.json({ user: safeSeller(u), ...rating, reviews: reviews.map(rv => ({ id: rv.id, rating: rv.rating, comment: rv.comment, createdAt: rv.createdAt, reviewer: safeSeller(rv.reviewer) })) });
});

// ---- Reports ----
const REASONS = ['fake_listing','fraud','misleading','inappropriate','damaged_item','misconduct','other'];
r.post('/reports', requireVerified, async (req, res) => {
  const { reason, details, listingId, reportedUserId } = req.body || {};
  if (!REASONS.includes(reason)) return res.status(400).json({ error: 'Invalid report reason.' });
  if (!listingId && !reportedUserId) return res.status(400).json({ error: 'Report must target a listing or a user.' });
  const report = await prisma.report.create({ data: {
    reporterId: req.user.id, reason, details: details?.trim() || null,
    listingId: listingId || null, reportedUserId: reportedUserId || null,
  }});
  res.json({ report });
});

export default r;
