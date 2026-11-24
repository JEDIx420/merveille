import { D1Database, D1PreparedStatement } from "@cloudflare/workers-types";
/** Include in a D1 batch. A failed predicate aborts the entire batch via CHECK, not a no-op update. */
export function atomicGuard(
  db: D1Database,
  predicateSql: string,
  params: unknown[] = [],
): D1PreparedStatement {
  return db
    .prepare(
      `INSERT INTO financial_guard (id, valid) VALUES (?, CASE WHEN (${predicateSql}) THEN 1 ELSE 0 END)`,
    )
    .bind(crypto.randomUUID(), ...params);
}
