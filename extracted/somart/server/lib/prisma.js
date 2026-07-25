// Prisma client — connects to PostgreSQL via DATABASE_URL env var.
// For local development, set DATABASE_URL to a local PostgreSQL connection string
// (e.g. postgresql://postgres:password@localhost:5432/somart).
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
export { prisma };
