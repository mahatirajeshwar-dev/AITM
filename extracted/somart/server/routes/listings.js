import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireVerified } from '../middleware/auth.js';
import { safeSeller, ratingSummary } from '../lib/util.js';

const r = Router();
export const CATEGORIES = ['Books','Electronics','Furniture','Cycles','Sports Equipment','Room Essentials','Kitchen Items','Academic Supplies','Fashion','Event Tickets','Other'];
const CONDITIONS = ['new','like_new','good','fair'];

r.get('/categories', (_req, res) => res.json({ categories: CATEGORIES }));

// Browse/search
r.get('/', async (req, res) => {
  const { q, category, type, minPrice, maxPrice, condition, sort, sellerId, limit, includeMine } = req.query;
  const where = { status: 'active' };
  if (sellerId) { where.sellerId = String(sellerId); if (includeMine === '1' && req.user?.id === sellerId) delete where.status, where.status = { notIn: ['deleted'] }; }
  if (category) where.category = String(category);
  if (type === 'sale' || type === 'rent') where.listingType = String(type);
  if (condition) where.condition = String(condition);
  if (q) where.OR = [
    { title: { contains: String(q) } },
    { description: { contains: String(q) } },
    { category: { contains: String(q) } },
  ];
  const price = {};
  if (minPrice) price.gte = parseFloat(minPrice);
  if (maxPrice) price.lte = parseFloat(maxPrice);
  if (price.gte != null || price.lte != null) {
    where.AND = [{ OR: [{ price }, { rentalRate: price }] }];
  }
  let orderBy = { createdAt: 'desc' };
  if (sort === 'price_asc') orderBy = [{ price: 'asc' }, { rentalRate: 'asc' }];
  if (sort === 'price_desc') orderBy = [{ price: 'desc' }, { rentalRate: 'desc' }];
  const listings = await prisma.listing.findMany({
    where, orderBy, take: limit ? Math.min(parseInt(limit), 100) : 60,
    include: { images: { orderBy: { sortOrder: 'asc' } }, seller: true },
  });
  res.json({ listings: listings.map(l => ({ ...l, seller: safeSeller(l.seller) })) });
});

// Home page sections
r.get('/home', async (_req, res) => {
  const base = { where: { status: 'active' }, include: { images: { orderBy: { sortOrder: 'asc' } }, seller: true } };
  const strip = ls => ls.map(l => ({ ...l, seller: safeSeller(l.seller) }));
  const [recent, sale, rent, popular] = await Promise.all([
    prisma.listing.findMany({ ...base, orderBy: { createdAt: 'desc' }, take: 8 }),
    prisma.listing.findMany({ ...base, where: { status: 'active', listingType: 'sale' }, orderBy: { createdAt: 'desc' }, take: 8 }),
    prisma.listing.findMany({ ...base, where: { status: 'active', listingType: 'rent' }, orderBy: { createdAt: 'desc' }, take: 8 }),
    prisma.listing.findMany({ ...base, orderBy: { transactions: { _count: 'desc' } }, take: 8 }),
  ]);
  res.json({ recent: strip(recent), sale: strip(sale), rent: strip(rent), popular: strip(popular), categories: CATEGORIES });
});

r.get('/:id', async (req, res) => {
  const l = await prisma.listing.findUnique({
    where: { id: req.params.id },
    include: { images: { orderBy: { sortOrder: 'asc' } }, seller: true },
  });
  if (!l || l.status === 'deleted') return res.status(404).json({ error: 'Listing not found.' });
  const rating = await ratingSummary(l.sellerId);
  const isOwner = req.user?.id === l.sellerId;
  res.json({ listing: { ...l, seller: { ...safeSeller(l.seller), ...rating, phone: null }, isOwner } });
});

function validateBody(b, forUpdate = false) {
  const errs = [];
  if (!forUpdate || b.title !== undefined) if (!b.title?.trim()) errs.push('Title is required.');
  if (!forUpdate || b.description !== undefined) if (!b.description?.trim()) errs.push('Description is required.');
  if (b.category && !CATEGORIES.includes(b.category)) errs.push('Invalid category.');
  if (b.listingType && !['sale','rent'].includes(b.listingType)) errs.push('Invalid listing type.');
  if (b.condition && !CONDITIONS.includes(b.condition)) errs.push('Invalid condition.');
  return errs;
}

r.post('/', requireVerified, async (req, res) => {
  const b = req.body || {};
  const errs = validateBody(b);
  if (!b.category) errs.push('Category is required.');
  if (!b.listingType) errs.push('Listing type is required.');
  if (!b.condition) errs.push('Condition is required.');
  if (!b.location?.trim()) errs.push('Pickup location is required.');
  if (b.listingType === 'sale' && !(parseFloat(b.price) > 0)) errs.push('Selling price is required.');
  if (b.listingType === 'rent' && !(parseFloat(b.rentalRate) > 0)) errs.push('Rental price is required.');
  if (b.listingType === 'rent' && !['day','week','month'].includes(b.rentalUnit)) errs.push('Rental pricing unit is required.');
  if (errs.length) return res.status(400).json({ error: errs.join(' ') });
  const listing = await prisma.listing.create({ data: {
    sellerId: req.user.id,
    title: b.title.trim(), description: b.description.trim(),
    category: b.category, listingType: b.listingType, condition: b.condition,
    price: b.listingType === 'sale' ? parseFloat(b.price) : null,
    rentalRate: b.listingType === 'rent' ? parseFloat(b.rentalRate) : null,
    rentalUnit: b.listingType === 'rent' ? b.rentalUnit : null,
    securityDeposit: b.securityDeposit ? parseFloat(b.securityDeposit) : null,
    minRentalPeriod: b.minRentalPeriod ? parseInt(b.minRentalPeriod) : null,
    maxRentalPeriod: b.maxRentalPeriod ? parseInt(b.maxRentalPeriod) : null,
    availableFrom: b.availableFrom ? new Date(b.availableFrom) : null,
    availableUntil: b.availableUntil ? new Date(b.availableUntil) : null,
    negotiable: !!b.negotiable, location: b.location.trim(),
    images: { create: (b.images || []).slice(0, 8).map((url, i) => ({ url, sortOrder: i })) },
  }, include: { images: true } });
  res.json({ listing });
});

r.put('/:id', requireVerified, async (req, res) => {
  const l = await prisma.listing.findUnique({ where: { id: req.params.id } });
  if (!l || l.status === 'deleted') return res.status(404).json({ error: 'Listing not found.' });
  if (l.sellerId !== req.user.id) return res.status(403).json({ error: 'Only the listing owner can edit this listing.' });
  const b = req.body || {};
  const errs = validateBody(b, true);
  if (errs.length) return res.status(400).json({ error: errs.join(' ') });
  const data = {};
  for (const k of ['title','description','category','condition','location','rentalUnit']) if (b[k] !== undefined) data[k] = b[k];
  for (const k of ['price','rentalRate','securityDeposit']) if (b[k] !== undefined) data[k] = b[k] === null || b[k] === '' ? null : parseFloat(b[k]);
  for (const k of ['minRentalPeriod','maxRentalPeriod']) if (b[k] !== undefined) data[k] = b[k] ? parseInt(b[k]) : null;
  for (const k of ['availableFrom','availableUntil']) if (b[k] !== undefined) data[k] = b[k] ? new Date(b[k]) : null;
  if (b.negotiable !== undefined) data.negotiable = !!b.negotiable;
  if (b.status !== undefined && ['active','paused','inactive'].includes(b.status) && ['active','paused','inactive'].includes(l.status)) data.status = b.status;
  if (b.images !== undefined) {
    await prisma.listingImage.deleteMany({ where: { listingId: l.id } });
    data.images = { create: (b.images || []).slice(0, 8).map((url, i) => ({ url, sortOrder: i })) };
  }
  const listing = await prisma.listing.update({ where: { id: l.id }, data, include: { images: true } });
  res.json({ listing });
});

// Soft delete
r.delete('/:id', requireVerified, async (req, res) => {
  const l = await prisma.listing.findUnique({ where: { id: req.params.id } });
  if (!l) return res.status(404).json({ error: 'Listing not found.' });
  if (l.sellerId !== req.user.id) return res.status(403).json({ error: 'Only the listing owner can delete this listing.' });
  if (['deal_in_progress','rented'].includes(l.status)) return res.status(400).json({ error: 'Cannot delete a listing with an active deal.' });
  await prisma.listing.update({ where: { id: l.id }, data: { status: 'deleted' } });
  res.json({ ok: true });
});

export default r;
