import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma.js';

const SECRET = process.env.SESSION_SECRET || 'insecure-dev-secret';
export const COOKIE = 'somart_token';

export function signToken(user) {
  return jwt.sign({ uid: user.id, role: user.role }, SECRET, { expiresIn: '7d' });
}
export function setAuthCookie(res, user) {
  res.cookie(COOKIE, signToken(user), {
    httpOnly: true, sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 7 * 24 * 3600 * 1000,
  });
}
export function clearAuthCookie(res) { res.clearCookie(COOKIE); }

export async function attachUser(req, _res, next) {
  const token = req.cookies?.[COOKIE];
  if (token) {
    try {
      const { uid } = jwt.verify(token, SECRET);
      const user = await prisma.user.findUnique({ where: { id: uid } });
      if (user && user.accountStatus !== 'blocked') req.user = user;
    } catch { /* invalid/expired token */ }
  }
  next();
}
export function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Please log in.' });
  if (req.user.accountStatus === 'suspended') return res.status(403).json({ error: 'Your account is suspended. Contact admin.' });
  next();
}
export function requireVerified(req, res, next) {
  requireAuth(req, res, () => {
    if (!req.user.emailVerified) return res.status(403).json({ error: 'Please verify your institutional email first.' });
    next();
  });
}
export function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required.' });
  next();
}
export async function audit(adminId, action, targetType, targetId, reason) {
  await prisma.adminAuditLog.create({ data: { adminId, action, targetType, targetId, reason: reason || null } });
}
