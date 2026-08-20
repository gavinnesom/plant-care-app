const {
  checkOwnerUnlockRateLimit,
  createSessionCookie,
  recordFailedOwnerUnlock,
  validateOwnerKey,
  verifySession,
} = require("../server/garden-session");

function readJson(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    req.on("data", (chunk) => {
      total += chunk.length;
      if (total > 64 * 1024) {
        reject(new Error("Request body is too large."));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      if (!chunks.length) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        reject(new Error("Request body must be JSON."));
      }
    });
    req.on("error", reject);
  });
}

module.exports = async function handler(req, res) {
  if (req.method === "GET") {
    const session = verifySession(req);
    if (session.configError)
      return res
        .status(session.configError.status)
        .json(session.configError.body);
    return res
      .status(200)
      .json({ unlocked: session.ok, expiresAt: session.expiresAt || null });
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method not allowed." });
  }

  try {
    const rateLimit = checkOwnerUnlockRateLimit(req);
    if (!rateLimit.allowed) {
      res.setHeader("Retry-After", String(rateLimit.retryAfterSeconds));
      return res.status(429).json({
        error: {
          code: "owner_unlock_rate_limited",
          message: "Too many unlock attempts. Try again soon.",
        },
      });
    }

    const body = await readJson(req);
    const validation = validateOwnerKey(body.ownerKey);
    if (validation.configError)
      return res
        .status(validation.configError.status)
        .json(validation.configError.body);
    if (!validation.ok) {
      recordFailedOwnerUnlock(req);
      return res.status(401).json({
        error: {
          code: "invalid_owner_key",
          message: "That owner key did not unlock My Garden.",
        },
      });
    }

    res.setHeader("Set-Cookie", createSessionCookie());
    return res.status(200).json({ unlocked: true });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      error: {
        code: "garden_unlock_failed",
        message: error.message || "Unable to unlock My Garden.",
      },
    });
  }
};
