import { drizzle } from 'drizzle-orm/bun-sqlite';
import { Database } from 'bun:sqlite';
import * as schema from './schema';

const DB_PATH = process.env.DATABASE_URL?.replace('sqlite:', '') || './data/exodus.db';

// Ensure data directory exists
await Bun.write(DB_PATH, '').catch(() => {});

const sqlite = new Database(DB_PATH);
sqlite.exec('PRAGMA journal_mode = WAL;');

export const db = drizzle(sqlite, { schema });

export type DatabaseType = typeof db;
