import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireAdmin, audit } from '../middleware/auth.js';
import { publicUser, safeSeller } from '../lib/util.js';

const r = Router();
r.use(requireAdmin);

// ---- Users ----
r.get('/users', async (req, res) => {
  const { q, status } = req.query;
  const where = { role: 'student' };
  if (status) where.accountStatus = String(status);
  if (q) where.OR = [{ fullName: { contains: String(q) } }, { email: { contains: String(q) } }];
  const users = await prisma.user.findMany({ where, orderBy: { createdAt: 'desc' }, take: 200 });
  const counts = {
    total: await prisma.user.count({ where: { role: 'student' } }),
    verified: await prisma.user.count({ where: { role: 'student', emailVerified: true } }),
    suspended: await prisma.user.count({ where: { role: 'student', accountStatus: 'suspended' } }),
    blocked: await prisma.user.count({ where: { role: 'student', accountStatus: 'blocked' } }),
  };
  res.json({ users: users.map(publicUser), counts });
});
r.get('/users/:id', async (req, res) => {
  const u = await prisma.user.findUnique({ where: { id: req.params.id }, include: {
    listings: { include: { images: true } },
    purchases: { include: { listing: true } }, sales: { include: { listing: true } },
  }});
  if (!u) return res.status(404).json({ error: 'User not found.' });
  res.json({ user: publicUser(u) });
});
r.post('/users/:id/status', async (req, res) => {
  const { status, reason } = req.body || {};
  if (!['active','suspended','blocked'].includes(status)) return res.status(400).json({ error: 'Invalid status.' });
  const u = await prisma.user.update({ where: { id: req.params.id }, data: { accountStatus: status } });
  await audit(req.user.id, `user_${status}`, 'user', u.id, reason);
  res.json({ user: publicUser(u) });
});

// ---- Listings ----
r.get('/listings', async (req, res) => {
  const { status, reported } = req.query;
  let where = {};
  if (status) where.status = String(status);
  if (reported === '1') {
    const reportedIds = (await prisma.report.findMany({ where: { listingId: { not: null }, status: 'open' }, select: { listingId: true } })).map(x => x.listingId);
    where.id = { in: reportedIds };
  }
  const listings = await prisma.listing.findMany({ where, include: { images: true, seller: true, _count: { select: { reports: true } } }, orderBy: { createdAt: 'desc' }, take: 200 });
  const counts = {
    active: await prisma.listing.count({ where: { status: 'active' } }),
    sold: await prisma.listing.count({ where: { status: 'sold' } }),
    rental: await prisma.listing.count({ where: { listingType: 'rent', status: { notIn: ['deleted'] } } }),
    removed: await prisma.listing.count({ where: { status: { in: ['removed','deleted'] } } }),
    reported: await prisma.report.count({ where: { listingId: { not: null }, status: 'open' } }),
  };
  res.json({ listings: listings.map(l => ({ ...l, seller: safeSeller(l.seller), reportCount: l._count.reports })), counts });
});
r.post('/listings/:id/status', async (req, res) => {
  const { status, reason } = req.body || {};
  if (!['active','removed','paused'].includes(status)) return res.status(400).json({ error: 'Invalid status.' });
  const l = await prisma.listing.update({ where: { id: req.params.id }, data: { status } });
  await audit(req.user.id, `listing_${status === 'active' ? 'restored' : status}`, 'listing', l.id, reason);
  res.json({ listing: l });
});

// ---- Transactions ----
r.get('/transactions', async (_req, res) => {
  const ts = await prisma.transaction.findMany({
    include: { listing: true, buyer: true, seller: true, otps: { where: { active: true } }, rentalDetail: true },
    orderBy: { createdAt: 'desc' }, take: 300,
  });
  res.json({ transactions: ts.map(t => ({
    id: t.id, item: t.listing.title, buyer: safeSeller(t.buyer), seller: safeSeller(t.seller),
    transactionType: t.transactionType, listedAmount: t.listedAmount, agreedAmount: t.agreedAmount,
    status: t.status, createdAt: t.createdAt, completedAt: t.completedAt,
    otpStatus: t.otps[0] ? { buyerVerified: t.otps[0].buyerOtpVerified, sellerVerified: t.otps[0].sellerOtpVerified, phase: t.otps[0].phase } : null,
  })) });
});
// Admin override — requires explicit confirmation + reason; audited. Never exposes OTPs.
r.post('/transactions/:id/override', async (req, res) => {
  const { action, reason, confirm } = req.body || {};
  if (!confirm) return res.status(400).json({ error: 'Explicit confirmation required for admin override.' });
  if (!reason?.trim()) return res.status(400).json({ error: 'A reason is required for admin override.' });
  if (!['cancel'].includes(action)) return res.status(400).json({ error: 'Only cancel override is supported. Transactions complete only via dual OTP.' });
  const t = await prisma.transaction.findUnique({ where: { id: req.params.id } });
  if (!t) return res.status(404).json({ error: 'Transaction not found.' });
  await prisma.$transaction([
    prisma.transaction.update({ where: { id: t.id }, data: { status: 'cancelled' } }),
    prisma.listing.update({ where: { id: t.listingId }, data: { status: 'active' } }),
    prisma.otpVerification.updateMany({ where: { transactionId: t.id }, data: { active: false } }),
  ]);
  await audit(req.user.id, 'transaction_override_cancel', 'transaction', t.id, reason);
  res.json({ ok: true });
});

// ---- Reports ----
r.get('/reports', async (_req, res) => {
  const reports = await prisma.report.findMany({ include: { reporter: true, reportedUser: true, listing: true }, orderBy: { createdAt: 'desc' }, take: 200 });
  res.json({ reports: reports.map(rp => ({
    id: rp.id, reason: rp.reason, details: rp.details, status: rp.status, createdAt: rp.createdAt,
    reporter: safeSeller(rp.reporter), reportedUser: rp.reportedUser ? safeSeller(rp.reportedUser) : null,
    listing: rp.listing ? { id: rp.listing.id, title: rp.listing.title, status: rp.listing.status } : null,
  })) });
});
r.post('/reports/:id/status', async (req, res) => {
  const { status } = req.body || {};
  if (!['reviewed','dismissed','actioned','open'].includes(status)) return res.status(400).json({ error: 'Invalid status.' });
  const rp = await prisma.report.update({ where: { id: req.params.id }, data: { status } });
  await audit(req.user.id, `report_${status}`, 'report', rp.id);
  res.json({ report: rp });
});

// ---- Analytics ----
r.get('/analytics', async (_req, res) => {
  const [totalUsers, verifiedUsers, activeListings, totalListings, itemsSold, activeRentals, completedRentals, totalTx] = await Promise.all([
    prisma.user.count({ where: { role: 'student' } }),
    prisma.user.count({ where: { role: 'student', emailVerified: true } }),
    prisma.listing.count({ where: { status: 'active' } }),
    prisma.listing.count({ where: { status: { not: 'deleted' } } }),
    prisma.listing.count({ where: { status: 'sold' } }),
    prisma.transaction.count({ where: { transactionType: 'rental', status: { in: ['rented','awaiting_return'] } } }),
    prisma.transaction.count({ where: { transactionType: 'rental', status: 'completed' } }),
    prisma.transaction.count(),
  ]);
  const agg = await prisma.transaction.aggregate({ where: { status: 'completed' }, _sum: { agreedAmount: true }, _avg: { agreedAmount: true } });
  const listAvg = await prisma.listing.aggregate({ where: { status: { not: 'deleted' } }, _avg: { price: true } });

  const completed = await prisma.transaction.findMany({ where: { status: 'completed' }, select: { completedAt: true, agreedAmount: true, transactionType: true } });
  const byMonth = {};
  for (const t of completed) {
    const m = (t.completedAt || new Date()).toISOString().slice(0, 7);
    byMonth[m] = byMonth[m] || { month: m, count: 0, value: 0, sale: 0, rental: 0 };
    byMonth[m].count++; byMonth[m].value += t.agreedAmount || 0;
    byMonth[m][t.transactionType === 'sale' ? 'sale' : 'rental']++;
  }
  const byCategoryRaw = await prisma.listing.groupBy({ by: ['category'], where: { status: { not: 'deleted' } }, _count: true });
  const txByType = await prisma.transaction.groupBy({ by: ['transactionType'], _count: true });
  const activeUsersRaw = await prisma.transaction.groupBy({ by: ['sellerId'], _count: true, orderBy: { _count: { sellerId: 'desc' } }, take: 5 });
  const activeUsers = await Promise.all(activeUsersRaw.map(async a => ({
    user: safeSeller(await prisma.user.findUnique({ where: { id: a.sellerId } })), transactions: a._count,
  })));

  res.json({
    totals: { totalUsers, verifiedUsers, activeListings, totalListings, itemsSold, activeRentals, completedRentals, totalTransactions: totalTx,
      totalRecordedValue: agg._sum.agreedAmount || 0, avgAgreedPrice: agg._avg.agreedAmount ? Math.round(agg._avg.agreedAmount) : 0,
      avgListingPrice: listAvg._avg.price ? Math.round(listAvg._avg.price) : 0,
      note: 'Total recorded transaction value is the sum of agreed amounts recorded by users — it is NOT platform revenue.' },
    byMonth: Object.values(byMonth).sort((a, b) => a.month.localeCompare(b.month)),
    byCategory: byCategoryRaw.map(c => ({ category: c.category, count: c._count })).sort((a, b) => b.count - a.count),
    saleVsRental: txByType.map(t => ({ type: t.transactionType, count: t._count })),
    mostActiveUsers: activeUsers,
  });
});

r.get('/audit-logs', async (_req, res) => {
  const logs = await prisma.adminAuditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 100 });
  res.json({ logs });
});

export default r;
