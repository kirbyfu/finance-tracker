import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultDbPath = path.resolve(__dirname, '../../../../data/finance.db');
const dbPath = process.env.DATABASE_URL || defaultDbPath;

const sqlite = new Database(dbPath);
export const db = drizzle(sqlite, { schema });

export * from './schema';
