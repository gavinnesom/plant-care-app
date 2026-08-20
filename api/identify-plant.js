const { extractJson, parseMultipartImage, validatePlantResult } = require('../server/plant-identification-core');
const { checkSupabaseRateLimit, parseWindowSeconds } = require('../server/rate-limit');

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const LOW_CONFIDENCE_THRESHOLD = 0.68;
const isDevelopment = process.env.NODE_ENV !== 'production';
const IP_LIMIT = Number.parseInt(process.env.PLANT_ID_IP_LIMIT || '15', 10);
const IP_WINDOW_SECONDS = parseWindowSeconds(process.env.PLANT_ID_IP_WINDOW, 60 * 60);
const DAILY_GLOBAL_LIMIT = Number.parseInt(process.env.PLANT_ID_DAILY_GLOBAL_LIMIT || '100', 10);
const DAILY_GLOBAL_WINDOW_SECONDS = parseWindowSeconds(process.env.PLANT_ID_DAILY_GLOBAL_WINDOW, 24 * 60 * 60);
const RATE_LIMIT_ERROR_MESSAGE = 'This public demo has reached its usage limit. Please try again later.';
const UNKNOWN_CLIENT_ID = 'unknown-client';
const FORCE_LOCAL_RATE_LIMIT = process.env.VERCEL_ENV !== 'production' && process.env.PLANT_ID_FORCE_RATE_LIMIT === '1';

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

function devLog(method, message, data) {
  if (!isDevelopment) return;
  console[method](message, data);
}

function logServerError(error, status) {
  console.error('[Plant ID API] Request failed', {
    status,
    name: error.name,
    message: error.message,
    boundary: error.boundary,
    causeName: error.cause?.name,
    causeCode: error.cause?.code,
    causeMessage: error.cause?.message,
    stack: error.stack?.split('\n').slice(0, 3).join('\n'),
  });
}

function wrapBoundaryError(error, boundary) {
  error.boundary = boundary;
  return error;
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
    throw wrapBoundaryError(error, 'rate_limit');
  }

  if (rateLimit.response?.status) {
    return res.status(rateLimit.response.status).json(rateLimit.response.body);
  }

  if (!rateLimit.configured) {
    return null;
  }

  devLog('info', '[Plant ID API] Rate limit checked', {
    clientSuccess: rateLimit.response.success,
    remaining: rateLimit.response.remaining,
  });

  if (!rateLimit.response.success) {
    return rateLimitedResponse(res, rateLimit.response);
  }

  setRateLimitHeaders(res, rateLimit.response);
  return null;
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

  let response;
  try {
    response = await fetch('https://api.openai.com/v1/responses', {
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
  } catch (error) {
    throw wrapBoundaryError(error, 'openai');
  }

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
    logServerError(error, status);
    const message =
      status >= 500 && !error.exposeMessage
        ? 'Plant identification is temporarily unavailable. Check server logs and API key configuration.'
        : error.message;

    return res.status(status).json({ error: message });
  }
}

module.exports = handler;
