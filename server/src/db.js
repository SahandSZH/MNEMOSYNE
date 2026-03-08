import pg from "pg";

import { config } from "./config.js";

const { Pool } = pg;

if (!config.databaseUrl) {
  throw new Error("DATABASE_URL is required. Add it to server/.env");
}

const useSsl = config.databaseSslMode !== "disable";

const pool = new Pool({
  connectionString: config.databaseUrl,
  ssl: useSsl
    ? {
        rejectUnauthorized: false,
      }
    : undefined,
});

export async function query(text, params = []) {
  return pool.query(text, params);
}

export async function withTransaction(callback) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function closeDatabase() {
  await pool.end();
}

export async function healthCheckDatabase() {
  await query("SELECT 1");
}
