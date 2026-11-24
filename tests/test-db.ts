/**
 * Test D1 Database adapter wrapping Node.js 22 native DatabaseSync (:memory:).
 * Executes genuine SQLite queries, migrations, and transactions with zero external mocks.
 */

import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { executeMigration } from "@/server/db";

export function createTestD1Database(): D1Database {
  const sqlite = new DatabaseSync(":memory:");

  const adapter: D1Database = {
    // @ts-ignore
    exec: async (sql: string) => {
      sqlite.exec(sql);
      return { count: 0, duration: 0 };
    },
    prepare: (sql: string) => {
      let boundParams: any[] = [];
      return {
        bind: (...params: any[]) => {
          boundParams = params.map((p) => (p === undefined ? null : p));
          return {
            first: async <T = any>() => {
              const stmt = sqlite.prepare(sql);
              const row = stmt.get(...boundParams);
              return (row as T) || null;
            },
            all: async <T = any>() => {
              const stmt = sqlite.prepare(sql);
              const rows = stmt.all(...boundParams);
              return { results: rows as T[], success: true, meta: {} as any };
            },
            run: async () => {
              const stmt = sqlite.prepare(sql);
              const info = stmt.run(...boundParams);
              return {
                success: true,
                meta: { changes: Number(info.changes), last_row_id: Number(info.lastInsertRowid) } as any,
              };
            },
          } as any;
        },
        first: async <T = any>() => {
          const stmt = sqlite.prepare(sql);
          return (stmt.get() as T) || null;
        },
        all: async <T = any>() => {
          const stmt = sqlite.prepare(sql);
          return { results: stmt.all() as T[], success: true, meta: {} as any };
        },
        run: async () => {
          const stmt = sqlite.prepare(sql);
          const info = stmt.run();
          return {
            success: true,
            meta: { changes: Number(info.changes), last_row_id: Number(info.lastInsertRowid) } as any,
          };
        },
      } as any;
    },
    batch: async (statements: any[]) => {
      const results: D1Response[] = [];
      sqlite.exec("BEGIN TRANSACTION");
      try {
        for (const s of statements) {
          const res = await s.run();
          results.push(res);
        }
        sqlite.exec("COMMIT");
      } catch (e) {
        sqlite.exec("ROLLBACK");
        throw e;
      }
      return results;
    },
    dump: async () => new ArrayBuffer(0),
  };

  return adapter;
}

/**
 * Initialize test D1 database and apply repository migration files.
 */
export async function setupMigratedTestDb(): Promise<D1Database> {
  const db = createTestD1Database();
  const migrationsDir = path.resolve(__dirname, "../migrations");
  const files = ["0001_identity_and_permissions.sql", "0002_projects_and_enquiries.sql"];

  for (const file of files) {
    const migrationPath = path.join(migrationsDir, file);
    if (fs.existsSync(migrationPath)) {
      const sql = fs.readFileSync(migrationPath, "utf-8");
      await executeMigration(db, sql);
    }
  }
  return db;
}
