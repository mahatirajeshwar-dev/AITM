import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireVerified } from '../middleware/auth.js';
import { notify, safeSeller } from '../lib/util.js';

const r = Router();

const pair = (a, b) => (a < b ? [a, b] : [b, a]);

r.get('/', requireVerified, async (req, res) => {
  const convos = await prisma.conversation.findMany({
    where: { OR: [{ userAId: req.user.id }, { userBId: req.user.id }] },
    include: { userA: true, userB: true, messages: { orderBy: { createdAt: 'desc' }, take: 1 } },
    orderBy: { updatedAt: 'desc' },
  });
  const unreadCounts = await Promise.all(convos.map(c =>
    prisma.message.count({ where: { conversationId: c.id, senderId: { not: req.user.id }, readAt: null } })));
  const listingIds = [...new Set(convos.map(c => c.listingId).filter(Boolean))];
  const listings = await prisma.listing.findMany({ where: { id: { in: listingIds } }, select: { id: true, title: true } });
  const lmap = Object.fromEntries(listings.map(l => [l.id, l.title]));
  res.json({ conversations: convos.map((c, i) => ({
    id: c.id, other: safeSeller(c.userAId === req.user.id ? c.userB : c.userA),
    listingId: c.listingId, listingTitle: c.listingId ? lmap[c.listingId] : null,
    lastMessage: c.messages[0] || null, unread: unreadCounts[i], updatedAt: c.updatedAt,
  })) });
});

r.get('/unread-count', requireVerified, async (req, res) => {
  const convos = await prisma.conversation.findMany({ where: { OR: [{ userAId: req.user.id }, { userBId: req.user.id }] }, select: { id: true } });
  const count = await prisma.message.count({ where: { conversationId: { in: convos.map(c => c.id) }, senderId: { not: req.user.id }, readAt: null } });
  res.json({ count });
});

// Start (or fetch) a conversation with a user, optionally about a listing
r.post('/start', requireVerified, async (req, res) => {
  const { userId, listingId } = req.body || {};
  if (!userId || userId === req.user.id) return res.status(400).json({ error: 'Invalid recipient.' });
  const other = await prisma.user.findUnique({ where: { id: userId } });
  if (!other || other.role !== 'student') return res.status(400).json({ error: 'Recipient not found.' });
  const [a, b] = pair(req.user.id, userId);
  const convo = await prisma.conversation.upsert({
    where: { userAId_userBId_listingId: { userAId: a, userBId: b, listingId: listingId || null } },
    create: { userAId: a, userBId: b, listingId: listingId || null },
    update: {},
  });
  res.json({ conversationId: convo.id });
});

r.get('/:id', requireVerified, async (req, res) => {
  const c = await prisma.conversation.findUnique({ where: { id: req.params.id }, include: { userA: true, userB: true, messages: { orderBy: { createdAt: 'asc' } } } });
  if (!c || (c.userAId !== req.user.id && c.userBId !== req.user.id)) return res.status(404).json({ error: 'Conversation not found.' });
  await prisma.message.updateMany({ where: { conversationId: c.id, senderId: { not: req.user.id }, readAt: null }, data: { readAt: new Date() } });
  res.json({ conversation: { id: c.id, other: safeSeller(c.userAId === req.user.id ? c.userB : c.userA), listingId: c.listingId, messages: c.messages } });
});

r.post('/:id', requireVerified, async (req, res) => {
  const c = await prisma.conversation.findUnique({ where: { id: req.params.id } });
  if (!c || (c.userAId !== req.user.id && c.userBId !== req.user.id)) return res.status(404).json({ error: 'Conversation not found.' });
  const body = req.body?.body?.trim();
  if (!body) return res.status(400).json({ error: 'Message cannot be empty.' });
  const msg = await prisma.message.create({ data: { conversationId: c.id, senderId: req.user.id, body: body.slice(0, 2000) } });
  await prisma.conversation.update({ where: { id: c.id }, data: { updatedAt: new Date() } });
  const other = c.userAId === req.user.id ? c.userBId : c.userAId;
  await notify(other, 'message', 'New message', `${req.user.fullName.split(' ')[0]}: ${body.slice(0, 60)}`, `/messages/${c.id}`);
  res.json({ message: msg });
});

export default r;
