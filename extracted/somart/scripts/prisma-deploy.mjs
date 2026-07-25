#!/usr/bin/env node
/**
 * scripts/prisma-deploy.mjs
 *
 * Safe Prisma migration runner for production (Render).
 *
 * Why this exists:
 *   Prisma records every migration attempt in _prisma_migrations.  If a
 *   previous attempt failed (e.g. due to the UTF-8 BOM bug), Prisma marks
 *   the row as "failed" and refuses to run `migrate deploy` again (P3009)
 *   until the failure is explicitly resolved.
 *
 * What this script does on every deploy:
 *   1. For every migration that ships in prisma/migrations/, attempt
 *      `prisma migrate resolve --rolled-back <name>`.
 *      - If the migration is recorded as failed  → marks it rolled-back so
 *        `migrate deploy` can reapply it cleanly.
 *      - If the migration was never recorded, or already succeeded  →
 *        Prisma prints a warning and exits non-zero; we swallow that and
 *        move on (it is harmless).
 *   2. Run `prisma migrate deploy`, which applies any pending migrations.
 *
 * This is intentionally idempotent: on every subsequent deploy after a
 * clean initial migration the resolve step is a no-op and deploy is a
 * no-op, so there is no performance or correctness risk.
 */

import { execSync, spawnSync } from 'child_process';
import { readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(__dirname, '..', 'prisma', 'migrations');

// ── 1. Collect all migration names (subdirectory names) ──────────────────────
let migrationNames = [];
try {
  migrationNames = readdirSync(migrationsDir).filter((entry) => {
    const full = join(migrationsDir, entry);
    return statSync(full).isDirectory();
  });
} catch {
  // No migrations directory yet — nothing to resolve.
}

// ── 2. Attempt resolve --rolled-back for each migration ──────────────────────
for (const name of migrationNames) {
  console.log(`[prisma-deploy] Attempting resolve --rolled-back for: ${name}`);
  const result = spawnSync(
    'npx',
    ['prisma', 'migrate', 'resolve', '--rolled-back', name],
    { stdio: 'inherit', shell: true }
  );
  if (result.status === 0) {
    console.log(`[prisma-deploy] Resolved failed migration: ${name}`);
  } else {
    // Non-zero means "nothing to resolve" — that's fine.
    console.log(`[prisma-deploy] Nothing to resolve for ${name} (or already clean) — continuing.`);
  }
}

// ── 3. Run prisma migrate deploy ─────────────────────────────────────────────
console.log('[prisma-deploy] Running: prisma migrate deploy');
try {
  execSync('npx prisma migrate deploy', { stdio: 'inherit' });
  console.log('[prisma-deploy] Migrations applied successfully.');
} catch (err) {
  console.error('[prisma-deploy] prisma migrate deploy failed.');
  process.exit(1);
}
