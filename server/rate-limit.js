const crypto = require('node:crypto');
const { Pool } = require('pg');

let pool = null;
let warnedMissingRateLimitConfig = false;

function parseWindowSeconds(value, fallbackSeconds) {
  if (typeof value !== 'string' || !value.trim()) return fallbackSeconds;

  const match = value.trim().match(/^(\d+)\s*(s|sec|secs|second|seconds|m|min|mins|minute|minutes|h|hr|hour|hours|d|day|days)$/i);
  if (!match) return fallbackSeconds;

  const amount = Number.parseInt(match[1], 10);
  const unit = match[2].toLowerCase();
  if (!Number.isFinite(amount) || amount < 1) return fallbackSeconds;

  if (unit.startsWith('s')) return amount;
  if (unit.startsWith('m')) return amount * 60;
  if (unit.startsWith('h')) return amount * 60 * 60;
  if (unit.startsWith('d')) return amount * 24 * 60 * 60;

  return fallbackSeconds;
}

function hashClientIdentifier(clientIdentifier) {
  return crypto.createHash('sha256').update(clientIdentifier).digest('hex');
}

function getPool() {
  if (pool) return pool;

  const connectionString = process.env.SUPABASE_DB_URL;
  if (!connectionString) return null;

  pool = new Pool({
    connectionString,
    max: 1,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
  });

  return pool;
}

function hasRateLimitConfig() {
  return Boolean(process.env.SUPABASE_DB_URL);
}

function shouldFailClosed() {
  return Boolean(process.env.VERCEL_ENV);
}

async function checkSupabaseRateLimit({ clientIdentifier, clientLimit, clientWindowSeconds, globalLimit, globalWindowSeconds }) {
  const db = getPool();
  if (!db) {
    if (shouldFailClosed()) {
      return {
        configured: false,
        response: {
          status: 503,
          body: {
            error: {
              code: 'rate_limit_not_configured',
              message: 'Plant identification is temporarily unavailable.',
            },
          },
        },
      };
    }

    if (!warnedMissingRateLimitConfig) {
      console.warn('[Plant ID API] Supabase rate limiting is not configured. Local development requests will be allowed.');
      warnedMissingRateLimitConfig = true;
    }

    return { configured: false, response: null };
  }

  const clientKey = hashClientIdentifier(clientIdentifier);
  const { rows } = await db.query(
    `select success, limit_value, remaining, reset_at
     from plant_id.check_rate_limit($1, $2, $3, $4, $5)`,
    [clientKey, clientLimit, clientWindowSeconds, globalLimit, globalWindowSeconds]
  );

  const result = rows[0];
  if (!result) {
    throw new Error('Supabase rate-limit function returned no result.');
  }

  return {
    configured: true,
    response: {
      success: result.success,
      limit: Number(result.limit_value),
      remaining: Number(result.remaining),
      reset: new Date(result.reset_at).getTime(),
    },
  };
}

module.exports = {
  checkSupabaseRateLimit,
  hashClientIdentifier,
  hasRateLimitConfig,
  parseWindowSeconds,
};
