import type BetterSqlite3 from 'better-sqlite3/win32-x64';

/**
 * Retention caps (optimization plan #7). Migration v4 applies the same caps
 * one-time to existing databases; these helpers keep them enforced at write
 * time so the tables never grow without bound again.
 */
export const SNAPSHOTS_PER_SKILL = 20;
export const ACTIONS_MAX = 5000;
export const ANALYSES_PER_SKILL = 10;

/** Keeps the newest SNAPSHOTS_PER_SKILL snapshots for one Skill. */
export function pruneSnapshots(sqlite: BetterSqlite3.Database, skillId: string): void {
  sqlite.prepare(`
    DELETE FROM snapshots WHERE skill_id = ? AND id NOT IN (
      SELECT id FROM snapshots WHERE skill_id = ? ORDER BY created_at DESC LIMIT ?
    )
  `).run(skillId, skillId, SNAPSHOTS_PER_SKILL);
}

/** Keeps the newest ACTIONS_MAX rows across the whole history table. */
export function pruneActions(sqlite: BetterSqlite3.Database): void {
  sqlite.prepare(`
    DELETE FROM actions WHERE id IN (SELECT id FROM actions ORDER BY created_at DESC LIMIT -1 OFFSET ?)
  `).run(ACTIONS_MAX);
}

/** Keeps the newest ANALYSES_PER_SKILL AI analyses for one Skill. */
export function pruneAnalyses(sqlite: BetterSqlite3.Database, skillId: string): void {
  sqlite.prepare(`
    DELETE FROM ai_analyses WHERE skill_id = ? AND id NOT IN (
      SELECT id FROM ai_analyses WHERE skill_id = ? ORDER BY created_at DESC LIMIT ?
    )
  `).run(skillId, skillId, ANALYSES_PER_SKILL);
}