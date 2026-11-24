/**
 * D1 database query and transaction helpers for Merveille Designs.
 */

export async function query<T = Record<string, any>>(
  db: D1Database,
  sql: string,
  params: any[] = [],
): Promise<T[]> {
  const stmt = db.prepare(sql);
  const bound = params.length > 0 ? stmt.bind(...params) : stmt;
  const result = await bound.all<T>();
  return result.results || [];
}

export async function queryFirst<T = Record<string, any>>(
  db: D1Database,
  sql: string,
  params: any[] = [],
): Promise<T | null> {
  const stmt = db.prepare(sql);
  const bound = params.length > 0 ? stmt.bind(...params) : stmt;
  const result = await bound.first<T>();
  return result || null;
}

export async function execute(
  db: D1Database,
  sql: string,
  params: any[] = [],
): Promise<D1Response> {
  const stmt = db.prepare(sql);
  const bound = params.length > 0 ? stmt.bind(...params) : stmt;
  return await bound.run();
}

export async function batch(
  db: D1Database,
  statements: D1PreparedStatement[],
): Promise<D1Response[]> {
  return await db.batch(statements);
}

/**
 * Execute a multi-statement SQL migration string against D1.
 */
export async function executeMigration(
  db: D1Database,
  sqlContent: string,
): Promise<void> {
  // Preserve trigger bodies and SQL literals; semicolons are not a safe SQL parser.
  await db.exec(sqlContent);
}
