const { Pool } = require("pg");

let pool = null;

function getPool() {
  if (pool) return pool;

  const connectionString = process.env.SUPABASE_DB_URL;
  if (!connectionString) return null;

  pool = new Pool({
    connectionString,
    max: 3,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
  });

  return pool;
}

function hasDatabaseConfig() {
  return Boolean(process.env.SUPABASE_DB_URL);
}

function requireDb() {
  const db = getPool();
  if (!db) {
    const error = new Error("Garden database is not configured.");
    error.statusCode = 503;
    error.code = "garden_not_configured";
    throw error;
  }
  return db;
}

module.exports = {
  getPool,
  hasDatabaseConfig,
  requireDb,
};
