const ENUMS = {
  light: ["full_sun", "partial_sun", "partial_shade", "shade"],
  water: ["dry", "moderate", "wet"],
  soil: ["well_draining", "sandy", "loamy", "clay_tolerant"],
  difficulty: ["easy", "moderate", "fussy"],
  californiaSuitability: ["excellent", "good", "caution", "poor"],
  petSafety: ["safe", "caution", "toxic", "unknown"],
};

const REQUIRED_SECTIONS = [
  "overview",
  "sunlight",
  "watering",
  "soil",
  "californiaNotes",
  "commonProblems",
  "propagation",
  "funFact",
];
const MAX_IDENTIFICATION_IMAGES = 5;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_IDENTIFICATION_BYTES = 24 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

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

function parseMultipartImages(contentType, body) {
  const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/);
  const boundary = boundaryMatch?.[1] || boundaryMatch?.[2];
  if (!boundary) throw new Error("Missing multipart boundary.");

  const parts = splitMultipart(body, boundary);
  const images = [];
  for (const part of parts) {
    const headerEnd = indexOfBuffer(part, "\r\n\r\n");
    if (headerEnd === -1) continue;

    const headers = part.subarray(0, headerEnd).toString("utf8");
    const content = part.subarray(headerEnd + 4);
    const disposition =
      headers.match(/content-disposition:\s*([^\r\n]+)/i)?.[1] || "";
    const name = disposition.match(/name="([^"]+)"/)?.[1];
    const filename = disposition.match(/filename="([^"]*)"/)?.[1];
    const mimeType = headers
      .match(/content-type:\s*([^\r\n]+)/i)?.[1]
      ?.trim()
      .toLowerCase();

    if (
      (name === "image" || name === "images" || name === "photos") &&
      filename
    ) {
      images.push({ buffer: content, filename, mimeType });
    }
  }

  if (!images.length) throw new Error("No image file was uploaded.");
  return images;
}

function parseMultipartImage(contentType, body) {
  return parseMultipartImages(contentType, body)[0];
}

function extractJson(text) {
  const trimmed = text.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}"))
    return JSON.parse(trimmed);

  const match = trimmed.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("Model did not return JSON.");
  return JSON.parse(match[0]);
}

function requireString(value, label) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Invalid or missing ${label}.`);
  }
  return value.trim();
}

function normalizeEnum(value, options, fallback) {
  return options.includes(value) ? value : fallback;
}

function validatePlantResult(raw) {
  const confidence = Number(raw.confidence);
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
    throw new Error("Invalid confidence value.");
  }

  const care = raw.care || {};
  const sections = raw.sections || {};

  return {
    commonName: requireString(raw.commonName, "commonName"),
    scientificName: requireString(raw.scientificName, "scientificName"),
    confidence,
    identificationNotes: requireString(
      raw.identificationNotes,
      "identificationNotes",
    ),
    likelyAlternatives: Array.isArray(raw.likelyAlternatives)
      ? raw.likelyAlternatives.slice(0, 3).map((item) => ({
          commonName: requireString(item.commonName, "alternative commonName"),
          scientificName: requireString(
            item.scientificName,
            "alternative scientificName",
          ),
          reason: requireString(item.reason, "alternative reason"),
        }))
      : [],
    care: {
      light: normalizeEnum(care.light, ENUMS.light, "partial_sun"),
      water: normalizeEnum(care.water, ENUMS.water, "moderate"),
      soil: normalizeEnum(care.soil, ENUMS.soil, "well_draining"),
      difficulty: normalizeEnum(care.difficulty, ENUMS.difficulty, "moderate"),
      californiaSuitability: normalizeEnum(
        care.californiaSuitability,
        ENUMS.californiaSuitability,
        "good",
      ),
      petSafety: normalizeEnum(care.petSafety, ENUMS.petSafety, "unknown"),
    },
    sections: Object.fromEntries(
      REQUIRED_SECTIONS.map((key) => [
        key,
        requireString(sections[key], `sections.${key}`),
      ]),
    ),
  };
}

function validateIdentificationImages(images) {
  if (!Array.isArray(images) || !images.length) {
    const error = new Error("Choose at least one plant photo first.");
    error.statusCode = 400;
    throw error;
  }
  if (images.length > MAX_IDENTIFICATION_IMAGES) {
    const error = new Error(
      `Choose no more than ${MAX_IDENTIFICATION_IMAGES} photos.`,
    );
    error.statusCode = 400;
    throw error;
  }

  const totalBytes = images.reduce(
    (sum, image) => sum + (image.buffer?.length || 0),
    0,
  );
  if (totalBytes > MAX_IDENTIFICATION_BYTES) {
    const error = new Error("Please choose a smaller photo set.");
    error.statusCode = 400;
    throw error;
  }

  return images.map((image) => {
    const mimeType = String(image.mimeType || "").toLowerCase();
    if (!ACCEPTED_IMAGE_TYPES.has(mimeType)) {
      const error = new Error("Please upload JPG, PNG, or WebP images.");
      error.statusCode = 400;
      throw error;
    }
    if (!image.buffer?.length || image.buffer.length > MAX_IMAGE_BYTES) {
      const error = new Error("Each image must be smaller than 8 MB.");
      error.statusCode = 400;
      throw error;
    }
    return { ...image, mimeType };
  });
}

function plantPrompt(imageCount = 1) {
  return `You are an AI plant identification assistant for a polished gardening demo.

Return strict JSON only. Do not include markdown, comments, code fences, or extra prose.

You are receiving ${imageCount} plant photo${imageCount === 1 ? "" : "s"} from one selected identification set. Use all provided images together; do not ignore extra photos when multiple views are present.

Plant identification can be uncertain. Never pretend certainty if the image set is ambiguous. Use a confidence score from 0 to 1, include likely alternatives, and explain what visual clues drove the result.

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

function identificationModel() {
  return process.env.OPENAI_MODEL || "gpt-4.1-mini";
}

function wrapBoundaryError(error, boundary) {
  error.boundary = boundary;
  return error;
}

async function callOpenAIForPlant(images) {
  const validatedImages = validateIdentificationImages(images);
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    const error = new Error(
      "Missing OPENAI_API_KEY. Add it to .env.local and restart the dev server.",
    );
    error.statusCode = 500;
    error.exposeMessage = true;
    throw error;
  }

  const model = identificationModel();

  let response;
  try {
    response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        input: [
          {
            role: "user",
            content: [
              { type: "input_text", text: plantPrompt(validatedImages.length) },
              ...validatedImages.map((image) => ({
                type: "input_image",
                image_url: `data:${image.mimeType};base64,${image.buffer.toString("base64")}`,
                detail: "high",
              })),
            ],
          },
        ],
      }),
    });
  } catch (error) {
    throw wrapBoundaryError(error, "openai");
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      payload.error?.message || "OpenAI identification request failed.";
    const error = new Error(message);
    error.statusCode = response.status;
    throw error;
  }

  const outputText =
    payload.output_text ||
    payload.output
      ?.flatMap((item) => item.content || [])
      ?.map((content) => content.text || "")
      ?.join("")
      ?.trim();

  if (!outputText) throw new Error("OpenAI returned an empty response.");
  return validatePlantResult(extractJson(outputText));
}

module.exports = {
  ACCEPTED_IMAGE_TYPES,
  extractJson,
  identificationModel,
  callOpenAIForPlant,
  MAX_IDENTIFICATION_BYTES,
  MAX_IDENTIFICATION_IMAGES,
  MAX_IMAGE_BYTES,
  parseMultipartImage,
  parseMultipartImages,
  plantPrompt,
  validatePlantResult,
  validateIdentificationImages,
};
