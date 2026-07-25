// Prisma client factory.
// - SQLite (dev, DATABASE_URL starts with "file:"): uses the better-sqlite3 driver
//   adapter with Prisma's queryCompiler — no native engine binaries needed.
// - PostgreSQL (production/Replit): standard PrismaClient. Change the datasource
//   provider in prisma/schema.prisma to "postgresql" and set DATABASE_URL.
import { PrismaClient } from '@prisma/client';

const url = process.env.DATABASE_URL || 'file:./prisma/dev.db';
let prisma;
if (url.startsWith('file:')) {
  const { PrismaBetterSQLite3 } = await import('@prisma/adapter-better-sqlite3');
  const adapter = new PrismaBetterSQLite3({ url: url.replace('file:./', 'file:./prisma/').replace('file:./prisma/prisma/', 'file:./prisma/') });
  prisma = new PrismaClient({ adapter });
} else {
  prisma = new PrismaClient();
}
export { prisma };
