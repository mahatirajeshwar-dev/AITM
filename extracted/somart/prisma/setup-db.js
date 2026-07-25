// Creates the SQLite dev database from prisma/init.sql.
// (On Postgres/Replit use `npx prisma db push` instead.)
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const dir = path.dirname(fileURLToPath(import.meta.url));
const db = new Database(path.join(dir, 'dev.db'));
db.pragma('journal_mode = WAL');
db.exec(fs.readFileSync(path.join(dir, 'init.sql'), 'utf8'));
console.log('SQLite database ready at prisma/dev.db');
