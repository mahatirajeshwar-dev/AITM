import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { prisma } from './prisma.js';

export const OTP_EXPIRY_MIN = parseInt(process.env.OTP_EXPIRY_MINUTES || '30', 10);
export const OTP_MAX_ATTEMPTS = parseInt(process.env.OTP_MAX_ATTEMPTS || '5', 10);

export function genOtp() {
  return String(crypto.randomInt(100000, 1000000)); // 6-digit, CSPRNG
}
export async function hashCode(code) { return bcrypt.hash(code, 10); }
export async function checkCode(code, hash) { return bcrypt.compare(code, hash); }

export function publicUser(u) {
  if (!u) return null;
  const { passwordHash, ...rest } = u;
  return rest;
}
export function safeSeller(u) {
  if (!u) return null;
  return { id: u.id, fullName: u.fullName, firstName: u.fullName.split(' ')[0], batch: u.batch, profileImage: u.profileImage };
}

export async function notify(userId, type, title, body, link) {
  try {
    await prisma.notification.create({ data: { userId, type, title, body: body || null, link: link || null } });
  } catch (e) { console.error('notify failed', e); }
}

export function sendEmail(to, subject, text) {
  // Pluggable email delivery. With no EMAIL_SERVICE_API_KEY configured we log
  // to the server console (and dev API responses expose codes for testing).
  if (!process.env.EMAIL_SERVICE_API_KEY) {
    console.log(`[email -> ${to}] ${subject}: ${text}`);
    return false;
  }
  // Integrate a provider (Resend/SendGrid/etc.) here using EMAIL_SERVICE_API_KEY.
  console.log(`[email(api) -> ${to}] ${subject}`);
  return true;
}
export const devEmailMode = () => !process.env.EMAIL_SERVICE_API_KEY;

export async function ratingSummary(userId) {
  const agg = await prisma.review.aggregate({ where: { revieweeId: userId }, _avg: { rating: true }, _count: true });
  const completed = await prisma.transaction.count({
    where: { status: 'completed', OR: [{ buyerId: userId }, { sellerId: userId }] },
  });
  return { avgRating: agg._avg.rating ? Math.round(agg._avg.rating * 10) / 10 : null, reviewCount: agg._count, completedTransactions: completed };
}
