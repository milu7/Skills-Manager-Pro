// v1 is distributed for Windows x64; use the explicit Node-API entry so
// Webpack can relocate the shipped native binary without probing build paths.
import BetterSqlite3 from 'better-sqlite3/win32-x64';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import path from 'node:path';
import { existsSync, mkdirSync } from 'node:fs';
import * as schema from './schema';
import { migrations } from './migrations';

export interface DatabaseContext {
  sqlite: BetterSqlite3.Database;
  orm: BetterSQLite3Database<typeof schema>;
  isNewDatabase: boolean;
}

let context: DatabaseContext | null = null;

export function openDatabase(userDataPath: string): DatabaseContext {
  if (context) return context;
  mkdirSync(userDataPath, { recursive: true });
  const dbPath = path.join(userDataPath, 'skill-workbench.sqlite3');
  const isNewDatabase = !existsSync(dbPath);
  const sqlite = new BetterSqlite3(dbPath);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  sqlite.pragma('synchronous = NORMAL');
  sqlite.pragma('busy_timeout = 5000');
  const currentVersion = Number(sqlite.pragma('user_version', { simple: true }) ?? 0);
  for (const migration of migrations) {
    if (migration.version <= currentVersion) continue;
    sqlite.transaction(() => {
      sqlite.exec(migration.sql);
      sqlite.pragma(`user_version = ${migration.version}`);
    })();
  }
  if (isNewDatabase) {
    sqlite.prepare(`
      INSERT INTO settings (key, value, updated_at) VALUES ('locale.preference', 'system', ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `).run(new Date().toISOString());
  }
  context = { sqlite, orm: drizzle(sqlite, { schema }), isNewDatabase };
  return context;
}

export function closeDatabase(): void {
  if (!context) return;
  context.sqlite.close();
  context = null;
}
