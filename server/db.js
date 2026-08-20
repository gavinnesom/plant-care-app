const { Pool } = require('pg');

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

module.exports = {
  getPool,
  hasDatabaseConfig,
};
