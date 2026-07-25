import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import multer from 'multer';
import crypto from 'crypto';
import { attachUser, requireVerified } from './middleware/auth.js';
import authRoutes from './routes/auth.js';
import listingRoutes from './routes/listings.js';
import transactionRoutes from './routes/transactions.js';
import messageRoutes from './routes/messages.js';
import miscRoutes from './routes/misc.js';
import adminRoutes from './routes/admin.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const app = express();
app.set('trust proxy', 1);
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());
app.use(attachUser);

// Image uploads
const uploadDir = path.join(root, 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });
const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (_req, file, cb) => cb(null, crypto.randomUUID() + path.extname(file.originalname).toLowerCase()),
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 }, fileFilter: (_req, file, cb) => {
  cb(null, ['.jpg','.jpeg','.png','.webp','.gif'].includes(path.extname(file.originalname).toLowerCase()));
}});
app.post('/api/upload', requireVerified, upload.array('images', 8), (req, res) => {
  res.json({ urls: (req.files || []).map(f => `/uploads/${f.filename}`) });
});
app.use('/uploads', express.static(uploadDir));

// API routes (relative — no hardcoded hosts)
app.use('/api/auth', authRoutes);
app.use('/api/listings', listingRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api', miscRoutes);
app.use('/api/admin', adminRoutes);
app.get('/api/health', (_req, res) => res.json({ ok: true, app: 'SoMart' }));

app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));

// Serve built frontend in production
const dist = path.join(root, 'client', 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
} else {
  app.get('/', (_req, res) => res.send('SoMart API running. Build the client with `npm run build` or use `npm run dev`.'));
}

// Error handler
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong. Please try again.' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`SoMart server running on port ${PORT}`));
