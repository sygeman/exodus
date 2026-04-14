import { drizzle } from 'drizzle-orm/bun-sqlite';
import { Database } from 'bun:sqlite';
import * as schema from './schema';
import { join } from 'path';

// Путь к базе: относительно корня проекта (4 уровня вверх от db/index.ts)
const DB_PATH = join(import.meta.dir, '..', '..', '..', '..', 'data', 'exodus.db');

// Ensure data directory exists
import { mkdir } from 'fs/promises';
await mkdir(join(DB_PATH, '..'), { recursive: true }).catch(() => {});

const sqlite = new Database(DB_PATH);
sqlite.exec('PRAGMA journal_mode = WAL;');

export const db = drizzle(sqlite, { schema });

export type DatabaseType = typeof db;
