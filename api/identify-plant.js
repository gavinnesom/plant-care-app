const { Ratelimit } = require('@upstash/ratelimit');
const { Redis } = require('@upstash/redis');

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const LOW_CONFIDENCE_THRESHOLD = 0.68;
const isDevelopment = process.env.NODE_ENV !== 'production';
const isProduction = process.env.VERCEL_ENV === 'production';
const IP_LIMIT = Number.parseInt(process.env.PLANT_ID_IP_LIMIT || '15', 10);
const IP_WINDOW = process.env.PLANT_ID_IP_WINDOW || '1 h';
const DAILY_GLOBAL_LIMIT = Number.parseInt(process.env.PLANT_ID_DAILY_GLOBAL_LIMIT || '100', 10);
const DAILY_GLOBAL_WINDOW = process.env.PLANT_ID_DAILY_GLOBAL_WINDOW || '1 d';
const RATE_LIMIT_ERROR_MESSAGE = 'This public demo has reached its usage limit. Please try again later.';
const RATE_LIMIT_NOT_CONFIGURED_MESSAGE = 'Plant identification is temporarily unavailable.';
const UNKNOWN_CLIENT_ID = 'unknown-client';
const FORCE_LOCAL_RATE_LIMIT = !isProduction && process.env.PLANT_ID_FORCE_RATE_LIMIT === '1';

let rateLimiters = null;
let warnedMissingRateLimitConfig = false;

const ENUMS = {
  light: ['full_sun', 'partial_sun', 'partial_shade', 'shade'],
  water: ['dry', 'moderate', 'wet'],
  soil: ['well_draining', 'sandy', 'loamy', 'clay_tolerant'],
  difficulty: ['easy', 'moderate', 'fussy'],
  californiaSuitability: ['excellent', 'good', 'caution', 'poor'],
  petSafety: ['safe', 'caution', 'toxic', 'unknown'],
};

const REQUIRED_SECTIONS = [
  'overview',
  'sunlight',
  'watering',
  'soil',
  'californiaNotes',
  'commonProblems',
  'propagation',
  'funFact',
];

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;

    req.on('data', (chunk) => {
      total += chunk.length;
      if (total > MAX_IMAGE_BYTES + 1024 * 1024) {
        reject(new Error('Uploaded image is too large.'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function indexOfBuffer(buffer, search, start = 0) {
  return buffer.indexOf(Buffer.from(search), start);
}

function splitMultipart(buffer, boundary) {
  const marker = Buffer.from(`--${boundary}`);
  const parts = [];
  let start = buffer.indexOf(marker);

  while (start !== -1) {
    start += marker.length;
    if (buffer[start] === 45 && buffer[start + 1] === 45) break;
    if (buffer[start] === 13 && buffer[start + 1] === 10) start += 2;

    let end = buffer.indexOf(marker, start);
    if (end === -1) break;

    let part = buffer.subarray(start, end);
    if (part[part.length - 2] === 13 && part[part.length - 1] === 10) {
      part = part.subarray(0, part.length - 2);
    }
    parts.push(part);
    start = end;
  }

  return parts;
}

function parseMultipartImage(contentType, body) {
  const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/);
  const boundary = boundaryMatch?.[1] || boundaryMatch?.[2];
  if (!boundary) throw new Error('Missing multipart boundary.');

  const parts = splitMultipart(body, boundary);
  for (const part of parts) {
    const headerEnd = indexOfBuffer(part, '\r\n\r\n');
    if (headerEnd === -1) continue;

    const headers = part.subarray(0, headerEnd).toString('utf8');
    const content = part.subarray(headerEnd + 4);
    const disposition = headers.match(/content-disposition:\s*([^\r\n]+)/i)?.[1] || '';
    const name = disposition.match(/name="([^"]+)"/)?.[1];
    const filename = disposition.match(/filename="([^"]*)"/)?.[1];
    const mimeType = headers.match(/content-type:\s*([^\r\n]+)/i)?.[1]?.trim().toLowerCase();

    if (name === 'image' && filename) {
      return { buffer: content, filename, mimeType };
    }
  }

  throw new Error('No image file was uploaded.');
}

function extractJson(text) {
  const trimmed = text.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) return JSON.parse(trimmed);

  const match = trimmed.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Model did not return JSON.');
  return JSON.parse(match[0]);
}

function requireString(value, label) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Invalid or missing ${label}.`);
  }
  return value.trim();
}

function normalizeEnum(value, options, fallback) {
  return options.includes(value) ? value : fallback;
}

function devLog(method, message, data) {
  if (!isDevelopment) return;
  console[method](message, data);
}

function hasRateLimitConfig() {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  return Boolean(url && token);
}

function getRateLimiters() {
  if (!hasRateLimitConfig()) return null;
  if (rateLimiters) return rateLimiters;

  const redis = Redis.fromEnv();
  rateLimiters = {
    ip: new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(IP_LIMIT, IP_WINDOW),
      prefix: 'plant-id:ip',
    }),
    global: new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(DAILY_GLOBAL_LIMIT, DAILY_GLOBAL_WINDOW),
      prefix: 'plant-id:global',
    }),
  };

  return rateLimiters;
}

function getClientIdentifier(req) {
  const forwardedFor = req.headers['x-forwarded-for'];
  const forwardedIp = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
  const firstForwardedIp = forwardedIp?.split(',')[0]?.trim();

  return (
    firstForwardedIp ||
    req.headers['x-real-ip'] ||
    req.socket?.remoteAddress ||
    req.connection?.remoteAddress ||
    UNKNOWN_CLIENT_ID
  );
}

function secondsUntil(resetTime) {
  if (!resetTime) return 3600;
  const resetMs = resetTime instanceof Date ? resetTime.getTime() : Number(resetTime);
  if (!Number.isFinite(resetMs)) return 3600;
  return Math.max(1, Math.ceil((resetMs - Date.now()) / 1000));
}

function setRateLimitHeaders(res, result, retryAfterSeconds) {
  if (!result) return;

  if (typeof result.limit === 'number') {
    res.setHeader('X-RateLimit-Limit', String(result.limit));
  }
  if (typeof result.remaining === 'number') {
    res.setHeader('X-RateLimit-Remaining', String(Math.max(0, result.remaining)));
  }
  if (result.reset) {
    res.setHeader('X-RateLimit-Reset', String(result.reset));
  }
  if (retryAfterSeconds) {
    res.setHeader('Retry-After', String(retryAfterSeconds));
  }
}

function rateLimitedResponse(res, result) {
  const retryAfterSeconds = secondsUntil(result?.reset);
  setRateLimitHeaders(res, result, retryAfterSeconds);
  return res.status(429).json({
    error: {
      code: 'rate_limited',
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

  const limiters = getRateLimiters();

  if (!limiters) {
    if (isProduction) {
      return res.status(503).json({
        error: {
          code: 'rate_limit_not_configured',
          message: RATE_LIMIT_NOT_CONFIGURED_MESSAGE,
        },
      });
    }

    if (!warnedMissingRateLimitConfig) {
      console.warn(
        '[Plant ID API] Upstash rate limiting is not configured. Local development requests will be allowed.'
      );
      warnedMissingRateLimitConfig = true;
    }
    return null;
  }

  const clientId = getClientIdentifier(req);
  const [clientResult, globalResult] = await Promise.all([
    limiters.ip.limit(clientId),
    limiters.global.limit('all'),
  ]);

  devLog('info', '[Plant ID API] Rate limit checked', {
    clientId,
    clientSuccess: clientResult.success,
    clientRemaining: clientResult.remaining,
    globalSuccess: globalResult.success,
    globalRemaining: globalResult.remaining,
  });

  if (!clientResult.success) {
    return rateLimitedResponse(res, clientResult);
  }

  if (!globalResult.success) {
    return rateLimitedResponse(res, globalResult);
  }

  setRateLimitHeaders(res, clientResult);
  return null;
}

function validatePlantResult(raw) {
  const confidence = Number(raw.confidence);
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
    throw new Error('Invalid confidence value.');
  }

  const care = raw.care || {};
  const sections = raw.sections || {};

  return {
    commonName: requireString(raw.commonName, 'commonName'),
    scientificName: requireString(raw.scientificName, 'scientificName'),
    confidence,
    identificationNotes: requireString(raw.identificationNotes, 'identificationNotes'),
    likelyAlternatives: Array.isArray(raw.likelyAlternatives)
      ? raw.likelyAlternatives.slice(0, 3).map((item) => ({
          commonName: requireString(item.commonName, 'alternative commonName'),
          scientificName: requireString(item.scientificName, 'alternative scientificName'),
          reason: requireString(item.reason, 'alternative reason'),
        }))
      : [],
    care: {
      light: normalizeEnum(care.light, ENUMS.light, 'partial_sun'),
      water: normalizeEnum(care.water, ENUMS.water, 'moderate'),
      soil: normalizeEnum(care.soil, ENUMS.soil, 'well_draining'),
      difficulty: normalizeEnum(care.difficulty, ENUMS.difficulty, 'moderate'),
      californiaSuitability: normalizeEnum(care.californiaSuitability, ENUMS.californiaSuitability, 'good'),
      petSafety: normalizeEnum(care.petSafety, ENUMS.petSafety, 'unknown'),
    },
    sections: Object.fromEntries(REQUIRED_SECTIONS.map((key) => [key, requireString(sections[key], `sections.${key}`)])),
  };
}

function plantPrompt() {
  return `You are an AI plant identification assistant for a polished gardening demo.

Return strict JSON only. Do not include markdown, comments, code fences, or extra prose.

Plant identification can be uncertain. Never pretend certainty if the image is ambiguous. Use a confidence score from 0 to 1, include likely alternatives, and explain what visual clues drove the result.

Use broad practical gardening categories, not overly technical botanical language. Include this safety idea in identificationNotes or overview: AI-assisted plant identification should be confirmed before eating, touching unknown plants, treating pests/disease, or exposing pets/children.

Return exactly this shape:
{
  "commonName": "string",
  "scientificName": "string",
  "confidence": 0.0,
  "identificationNotes": "string",
  "likelyAlternatives": [
    {
      "commonName": "string",
      "scientificName": "string",
      "reason": "string"
    }
  ],
  "care": {
    "light": "full_sun | partial_sun | partial_shade | shade",
    "water": "dry | moderate | wet",
    "soil": "well_draining | sandy | loamy | clay_tolerant",
    "difficulty": "easy | moderate | fussy",
    "californiaSuitability": "excellent | good | caution | poor",
    "petSafety": "safe | caution | toxic | unknown"
  },
  "sections": {
    "overview": "string",
    "sunlight": "string",
    "watering": "string",
    "soil": "string",
    "californiaNotes": "string",
    "commonProblems": "string",
    "propagation": "string",
    "funFact": "string"
  }
}

Enum values must be the raw enum strings only. If the plant is not identifiable, return the most likely broad plant group with low confidence and alternatives.`;
}

async function callOpenAI({ imageBuffer, mimeType }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    const error = new Error('Missing OPENAI_API_KEY. Add it to .env.local and restart the dev server.');
    error.statusCode = 500;
    error.exposeMessage = true;
    throw error;
  }

  const imageData = imageBuffer.toString('base64');
  const model = process.env.OPENAI_MODEL || 'gpt-4.1-mini';

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: 'user',
          content: [
            { type: 'input_text', text: plantPrompt() },
            {
              type: 'input_image',
              image_url: `data:${mimeType};base64,${imageData}`,
              detail: 'high',
            },
          ],
        },
      ],
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload.error?.message || 'OpenAI identification request failed.';
    const error = new Error(message);
    error.statusCode = response.status;
    throw error;
  }

  const outputText =
    payload.output_text ||
    payload.output
      ?.flatMap((item) => item.content || [])
      ?.map((content) => content.text || '')
      ?.join('')
      ?.trim();

  if (!outputText) throw new Error('OpenAI returned an empty response.');
  return validatePlantResult(extractJson(outputText));
}

async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  try {
    devLog('info', '[Plant ID API] Request received', {
      method: req.method,
      contentType: req.headers['content-type'],
    });

    const contentType = req.headers['content-type'] || '';
    if (!contentType.includes('multipart/form-data')) {
      return res.status(400).json({ error: 'Send the image as multipart/form-data.' });
    }

    const rateLimitResponse = await checkRateLimit(req, res);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const body = await readBody(req);
    const image = parseMultipartImage(contentType, body);
    devLog('info', '[Plant ID API] Image parsed', {
      filename: image.filename,
      mimeType: image.mimeType,
      bytes: image.buffer.length,
    });

    if (!ACCEPTED_IMAGE_TYPES.has(image.mimeType)) {
      return res.status(400).json({ error: 'Please upload a JPG, PNG, or WebP image.' });
    }

    if (!image.buffer.length || image.buffer.length > MAX_IMAGE_BYTES) {
      return res.status(400).json({ error: 'Please upload an image smaller than 8 MB.' });
    }

    const result = await callOpenAI({ imageBuffer: image.buffer, mimeType: image.mimeType });
    const warning =
      result.confidence < LOW_CONFIDENCE_THRESHOLD
        ? 'Low-confidence identification. Compare the alternatives and confirm with another source.'
        : '';

    return res.status(200).json({ result, warning });
  } catch (error) {
    const status = error.statusCode || 500;
    devLog('error', '[Plant ID API] Request failed', {
      status,
      message: error.message,
    });
    const message =
      status >= 500 && !error.exposeMessage
        ? 'Plant identification is temporarily unavailable. Check server logs and API key configuration.'
        : error.message;

    return res.status(status).json({ error: message });
  }
}

module.exports = handler;
module.exports._test = {
  extractJson,
  parseMultipartImage,
  validatePlantResult,
};
