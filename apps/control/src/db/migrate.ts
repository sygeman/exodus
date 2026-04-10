import { migrate } from 'drizzle-orm/bun-sqlite/migrator';
import { db } from './index';

export async function runMigrations(): Promise<void> {
  console.log('[DB] Running migrations...');
  console.log('[DB] Using SQLite');

  try {
    await migrate(db, { migrationsFolder: './drizzle' });
    console.log('[DB] Migrations completed successfully');
  } catch (error) {
    console.error('[DB] Migration failed:', error);
    throw error;
  }
}
