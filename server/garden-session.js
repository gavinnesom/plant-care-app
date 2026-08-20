const crypto = require("node:crypto");

const COOKIE_NAME = "plant_id_garden_session";
const SESSION_SECONDS = 30 * 24 * 60 * 60;
const UNLOCK_WINDOW_MS = 15 * 60 * 1000;
const UNLOCK_ATTEMPT_LIMIT = 10;
const unlockAttempts = new Map();

function getOwnerKey() {
  return process.env.PLANT_ID_OWNER_KEY || "";
}

function getSessionSecret() {
  return process.env.PLANT_ID_SESSION_SECRET || "";
}

function timingSafeEqualText(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function base64Url(input) {
  return Buffer.from(input).toString("base64url");
}

function sign(value) {
  return crypto
    .createHmac("sha256", getSessionSecret())
    .update(value)
    .digest("base64url");
}

function parseCookies(req) {
  const header = req.headers.cookie || "";
  return Object.fromEntries(
    header
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const index = part.indexOf("=");
        if (index === -1) return [part, ""];
        return [
          decodeURIComponent(part.slice(0, index)),
          decodeURIComponent(part.slice(index + 1)),
        ];
      }),
  );
}

function requestIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim())
    return forwarded.split(",")[0].trim();
  return req.socket?.remoteAddress || "unknown";
}

function unlockKeyForRequest(req) {
  return crypto.createHash("sha256").update(requestIp(req)).digest("base64url");
}

function pruneUnlockAttempts(now = Date.now()) {
  for (const [key, entry] of unlockAttempts.entries()) {
    if (entry.resetAt <= now) unlockAttempts.delete(key);
  }
}

function checkOwnerUnlockRateLimit(req, now = Date.now()) {
  pruneUnlockAttempts(now);
  const key = unlockKeyForRequest(req);
  const entry = unlockAttempts.get(key);
  if (!entry || entry.resetAt <= now || entry.count < UNLOCK_ATTEMPT_LIMIT)
    return { allowed: true };
  return {
    allowed: false,
    retryAfterSeconds: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)),
  };
}

function recordFailedOwnerUnlock(req, now = Date.now()) {
  pruneUnlockAttempts(now);
  const key = unlockKeyForRequest(req);
  const current = unlockAttempts.get(key);
  if (!current || current.resetAt <= now) {
    unlockAttempts.set(key, { count: 1, resetAt: now + UNLOCK_WINDOW_MS });
    return;
  }
  current.count += 1;
}

function clearOwnerUnlockAttemptsForTests() {
  unlockAttempts.clear();
}

function sessionConfigError() {
  if (!getOwnerKey() || !getSessionSecret()) {
    return {
      status: 503,
      body: {
        error: {
          code: "garden_not_configured",
          message: "My Garden is temporarily unavailable.",
        },
      },
    };
  }
  return null;
}

function createSessionCookie() {
  const payload = JSON.stringify({
    scope: "plant-id-garden",
    exp: Math.floor(Date.now() / 1000) + SESSION_SECONDS,
    nonce: crypto.randomBytes(16).toString("base64url"),
  });
  const encoded = base64Url(payload);
  const token = `${encoded}.${sign(encoded)}`;
  return `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; Max-Age=${SESSION_SECONDS}; HttpOnly; Secure; SameSite=Lax`;
}

function verifySession(req) {
  const configError = sessionConfigError();
  if (configError) return { ok: false, configError };

  const token = parseCookies(req)[COOKIE_NAME];
  if (!token || !token.includes(".")) return { ok: false };

  const [encoded, signature] = token.split(".");
  if (!encoded || !signature || !timingSafeEqualText(signature, sign(encoded)))
    return { ok: false };

  let payload;
  try {
    payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
  } catch {
    return { ok: false };
  }

  if (payload.scope !== "plant-id-garden" || typeof payload.exp !== "number")
    return { ok: false };
  if (payload.exp <= Math.floor(Date.now() / 1000)) return { ok: false };

  return { ok: true, expiresAt: payload.exp * 1000 };
}

function validateOwnerKey(ownerKey) {
  const configError = sessionConfigError();
  if (configError) return { ok: false, configError };
  return { ok: timingSafeEqualText(ownerKey || "", getOwnerKey()) };
}

function requireGardenSession(req, res) {
  const session = verifySession(req);
  if (session.configError) {
    res.status(session.configError.status).json(session.configError.body);
    return null;
  }
  if (!session.ok) {
    res.status(401).json({
      error: {
        code: "garden_locked",
        message: "Unlock My Garden to continue.",
      },
    });
    return null;
  }
  return session;
}

module.exports = {
  COOKIE_NAME,
  SESSION_SECONDS,
  UNLOCK_ATTEMPT_LIMIT,
  checkOwnerUnlockRateLimit,
  clearOwnerUnlockAttemptsForTests,
  createSessionCookie,
  recordFailedOwnerUnlock,
  requireGardenSession,
  validateOwnerKey,
  verifySession,
};
