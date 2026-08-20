const {
  callOpenAIForPlant,
  identificationModel,
  MAX_IDENTIFICATION_BYTES,
  parseMultipartImages,
} = require("../server/plant-identification-core");
const {
  checkSupabaseRateLimit,
  parseWindowSeconds,
} = require("../server/rate-limit");
const { readRequestBody } = require("../server/http");

const LOW_CONFIDENCE_THRESHOLD = 0.68;
const isDevelopment = process.env.NODE_ENV !== "production";
const IP_LIMIT = Number.parseInt(process.env.PLANT_ID_IP_LIMIT || "15", 10);
const IP_WINDOW_SECONDS = parseWindowSeconds(
  process.env.PLANT_ID_IP_WINDOW,
  60 * 60,
);
const DAILY_GLOBAL_LIMIT = Number.parseInt(
  process.env.PLANT_ID_DAILY_GLOBAL_LIMIT || "100",
  10,
);
const DAILY_GLOBAL_WINDOW_SECONDS = parseWindowSeconds(
  process.env.PLANT_ID_DAILY_GLOBAL_WINDOW,
  24 * 60 * 60,
);
const RATE_LIMIT_ERROR_MESSAGE =
  "This public demo has reached its usage limit. Please try again later.";
const UNKNOWN_CLIENT_ID = "unknown-client";
const FORCE_LOCAL_RATE_LIMIT =
  process.env.VERCEL_ENV !== "production" &&
  process.env.PLANT_ID_FORCE_RATE_LIMIT === "1";

function devLog(method, message, data) {
  if (!isDevelopment) return;
  console[method](message, data);
}

function logServerError(error, status) {
  console.error("[Plant ID API] Request failed", {
    status,
    name: error.name,
    message: error.message,
    boundary: error.boundary,
    causeName: error.cause?.name,
    causeCode: error.cause?.code,
    causeMessage: error.cause?.message,
    stack: error.stack?.split("\n").slice(0, 3).join("\n"),
  });
}

function wrapBoundaryError(error, boundary) {
  error.boundary = boundary;
  return error;
}

function getClientIdentifier(req) {
  const forwardedFor = req.headers["x-forwarded-for"];
  const forwardedIp = Array.isArray(forwardedFor)
    ? forwardedFor[0]
    : forwardedFor;
  const firstForwardedIp = forwardedIp?.split(",")[0]?.trim();

  return (
    firstForwardedIp ||
    req.headers["x-real-ip"] ||
    req.socket?.remoteAddress ||
    req.connection?.remoteAddress ||
    UNKNOWN_CLIENT_ID
  );
}

function secondsUntil(resetTime) {
  if (!resetTime) return 3600;
  const resetMs =
    resetTime instanceof Date ? resetTime.getTime() : Number(resetTime);
  if (!Number.isFinite(resetMs)) return 3600;
  return Math.max(1, Math.ceil((resetMs - Date.now()) / 1000));
}

function setRateLimitHeaders(res, result, retryAfterSeconds) {
  if (!result) return;

  if (typeof result.limit === "number") {
    res.setHeader("X-RateLimit-Limit", String(result.limit));
  }
  if (typeof result.remaining === "number") {
    res.setHeader(
      "X-RateLimit-Remaining",
      String(Math.max(0, result.remaining)),
    );
  }
  if (result.reset) {
    res.setHeader("X-RateLimit-Reset", String(result.reset));
  }
  if (retryAfterSeconds) {
    res.setHeader("Retry-After", String(retryAfterSeconds));
  }
}

function rateLimitedResponse(res, result) {
  const retryAfterSeconds = secondsUntil(result?.reset);
  setRateLimitHeaders(res, result, retryAfterSeconds);
  return res.status(429).json({
    error: {
      code: "rate_limited",
      message: RATE_LIMIT_ERROR_MESSAGE,
    },
    retryAfterSeconds,
  });
}

async function checkRateLimit(req, res) {
  if (FORCE_LOCAL_RATE_LIMIT) {
    return rateLimitedResponse(res, {
      limit: 0,
      remaining: 0,
      reset: Date.now() + 60 * 1000,
    });
  }

  const clientId = getClientIdentifier(req);
  let rateLimit;
  try {
    rateLimit = await checkSupabaseRateLimit({
      clientIdentifier: clientId,
      clientLimit: IP_LIMIT,
      clientWindowSeconds: IP_WINDOW_SECONDS,
      globalLimit: DAILY_GLOBAL_LIMIT,
      globalWindowSeconds: DAILY_GLOBAL_WINDOW_SECONDS,
    });
  } catch (error) {
    throw wrapBoundaryError(error, "rate_limit");
  }

  if (rateLimit.response?.status) {
    return res.status(rateLimit.response.status).json(rateLimit.response.body);
  }

  if (!rateLimit.configured) {
    return null;
  }

  devLog("info", "[Plant ID API] Rate limit checked", {
    clientSuccess: rateLimit.response.success,
    remaining: rateLimit.response.remaining,
  });

  if (!rateLimit.response.success) {
    return rateLimitedResponse(res, rateLimit.response);
  }

  setRateLimitHeaders(res, rateLimit.response);
  return null;
}

async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed." });
  }

  try {
    devLog("info", "[Plant ID API] Request received", {
      method: req.method,
      contentType: req.headers["content-type"],
    });

    const contentType = req.headers["content-type"] || "";
    if (!contentType.includes("multipart/form-data")) {
      return res
        .status(400)
        .json({ error: "Send the image as multipart/form-data." });
    }

    const rateLimitResponse = await checkRateLimit(req, res);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const body = await readRequestBody(
      req,
      MAX_IDENTIFICATION_BYTES + 2 * 1024 * 1024,
    );
    const images = parseMultipartImages(contentType, body);
    devLog("info", "[Plant ID API] Image parsed", {
      count: images.length,
      bytes: images.reduce((sum, image) => sum + image.buffer.length, 0),
    });

    const result = await callOpenAIForPlant(images);
    const warning =
      result.confidence < LOW_CONFIDENCE_THRESHOLD
        ? "Low-confidence identification. Compare the alternatives and confirm with another source."
        : "";

    return res.status(200).json({
      result,
      warning,
      assessmentMeta: {
        model: identificationModel(),
        schemaVersion: "plant-identification-v1",
        promptVersion: "plant-identification-v2",
      },
    });
  } catch (error) {
    const status = error.statusCode || 500;
    logServerError(error, status);
    const message =
      status >= 500 && !error.exposeMessage
        ? "Plant identification is temporarily unavailable. Check server logs and API key configuration."
        : error.message;

    return res.status(status).json({ error: message });
  }
}

module.exports = handler;
