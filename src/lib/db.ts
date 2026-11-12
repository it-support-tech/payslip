import fs from "node:fs/promises";
import path from "node:path";
import { Pool, type PoolClient, type QueryResultRow } from "pg";

const g = globalThis as unknown as { __pgPool?: Pool };

export function pool(): Pool {
  if (g.__pgPool) return g.__pgPool;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("ບໍ່ພົບ DATABASE_URL ໃນ .env.local — run: npm run setup");
  return (g.__pgPool = new Pool({ connectionString, max: 10 }));
}

export async function query<T extends QueryResultRow>(text: string, params: unknown[] = []) {
  return (await pool().query<T>(text, params)).rows;
}

export async function transaction<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool().connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function migrate() {
  const dir = path.join(process.cwd(), "migrations");
  const files = (await fs.readdir(dir)).filter((f) => f.endsWith(".sql")).sort();
  await query(
    "CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())",
  );
  const done = new Set((await query<{ name: string }>("SELECT name FROM schema_migrations")).map((r) => r.name));
  for (const file of files) {
    if (done.has(file)) continue;
    const sql = await fs.readFile(path.join(dir, file), "utf-8");
    await transaction(async (c) => {
      await c.query(sql);
      await c.query("INSERT INTO schema_migrations (name) VALUES ($1)", [file]);
    });
    console.log(`[db] migrated ${file}`);
  }
}
