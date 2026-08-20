const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const {
  MAX_IDENTIFICATION_IMAGES,
  MAX_IMAGE_BYTES,
  extractJson,
  parseMultipartImage,
  parseMultipartImages,
  plantPrompt,
  validateIdentificationImages,
  validatePlantResult,
} = require("../server/plant-identification-core");
const {
  checkSupabaseRateLimit,
  hashClientIdentifier,
  parseWindowSeconds,
} = require("../server/rate-limit");

function validRawResult(overrides = {}) {
  return {
    commonName: "Orange Tree",
    scientificName: "Citrus sinensis",
    confidence: 0.72,
    identificationNotes:
      "Glossy leaves and citrus fruit suggest an orange tree.",
    likelyAlternatives: [
      {
        commonName: "Mandarin",
        scientificName: "Citrus reticulata",
        reason: "Similar leaves and fruit shape.",
      },
    ],
    care: {
      light: "full_sun",
      water: "moderate",
      soil: "well_draining",
      difficulty: "moderate",
      californiaSuitability: "good",
      petSafety: "caution",
    },
    sections: {
      overview: "A citrus tree suited to warm patio conditions.",
      sunlight: "Give full sun.",
      watering: "Water deeply and let the top soil dry.",
      soil: "Use a draining citrus mix.",
      californiaNotes: "Protect from hard frost.",
      commonProblems: "Watch for scale and leaf curl.",
      propagation: "Usually grafted.",
      funFact: "Orange trees can flower and fruit at the same time.",
    },
    ...overrides,
  };
}

test("extractJson accepts JSON wrapped in model prose", () => {
  const result = extractJson(
    'Here is the result:\n{"commonName":"Orange Tree","confidence":0.72}',
  );

  assert.equal(result.commonName, "Orange Tree");
  assert.equal(result.confidence, 0.72);
});

test("parseMultipartImage extracts the uploaded image part", () => {
  const boundary = "plant-id-boundary";
  const body = Buffer.from(
    [
      `--${boundary}`,
      'Content-Disposition: form-data; name="image"; filename="plant.webp"',
      "Content-Type: image/webp",
      "",
      "image-bytes",
      `--${boundary}--`,
      "",
    ].join("\r\n"),
  );

  const image = parseMultipartImage(
    `multipart/form-data; boundary=${boundary}`,
    body,
  );

  assert.equal(image.filename, "plant.webp");
  assert.equal(image.mimeType, "image/webp");
  assert.equal(image.buffer.toString(), "image-bytes");
});

test("parseMultipartImages extracts every uploaded image part", () => {
  const boundary = "plant-id-boundary";
  const body = Buffer.from(
    [
      `--${boundary}`,
      'Content-Disposition: form-data; name="images"; filename="leaf.jpg"',
      "Content-Type: image/jpeg",
      "",
      "leaf-bytes",
      `--${boundary}`,
      'Content-Disposition: form-data; name="images"; filename="flower.png"',
      "Content-Type: image/png",
      "",
      "flower-bytes",
      `--${boundary}--`,
      "",
    ].join("\r\n"),
  );

  const images = parseMultipartImages(
    `multipart/form-data; boundary=${boundary}`,
    body,
  );

  assert.equal(images.length, 2);
  assert.equal(images[0].filename, "leaf.jpg");
  assert.equal(images[1].buffer.toString(), "flower-bytes");
});

test("validateIdentificationImages rejects excessive image counts and oversized members", () => {
  const image = { buffer: Buffer.from("image-bytes"), mimeType: "image/png" };
  assert.throws(
    () =>
      validateIdentificationImages(
        Array.from({ length: MAX_IDENTIFICATION_IMAGES + 1 }, () => image),
      ),
    /no more than 5 photos/,
  );
  assert.throws(
    () =>
      validateIdentificationImages([
        { buffer: Buffer.alloc(MAX_IMAGE_BYTES + 1), mimeType: "image/png" },
      ]),
    /smaller than 8 MB/,
  );
  assert.throws(
    () =>
      validateIdentificationImages([
        { buffer: Buffer.from("x"), mimeType: "image/gif" },
      ]),
    /JPG, PNG, or WebP/,
  );
});

test("plant prompt tells the model to use the full image set", () => {
  assert.match(plantPrompt(3), /receiving 3 plant photos/);
  assert.match(plantPrompt(3), /Use all provided images together/);
});

test("validatePlantResult trims strings, caps alternatives, and normalizes unknown enums", () => {
  const result = validatePlantResult(
    validRawResult({
      commonName: "  Orange Tree  ",
      likelyAlternatives: [
        {
          commonName: "Mandarin",
          scientificName: "Citrus reticulata",
          reason: "Similar leaves.",
        },
        {
          commonName: "Lemon",
          scientificName: "Citrus limon",
          reason: "Similar growth habit.",
        },
        {
          commonName: "Lime",
          scientificName: "Citrus aurantiifolia",
          reason: "Similar evergreen foliage.",
        },
        {
          commonName: "Kumquat",
          scientificName: "Citrus japonica",
          reason: "Similar small fruit.",
        },
      ],
      care: {
        light: "impossible_light",
        water: "too_much",
        soil: "moon_dust",
        difficulty: "legendary",
        californiaSuitability: "unknown_region",
        petSafety: "mystery",
      },
    }),
  );

  assert.equal(result.commonName, "Orange Tree");
  assert.equal(result.likelyAlternatives.length, 3);
  assert.deepEqual(result.care, {
    light: "partial_sun",
    water: "moderate",
    soil: "well_draining",
    difficulty: "moderate",
    californiaSuitability: "good",
    petSafety: "unknown",
  });
});

test("validatePlantResult rejects missing required care sections", () => {
  assert.throws(
    () =>
      validatePlantResult(
        validRawResult({
          sections: {
            overview: "A plant.",
          },
        }),
      ),
    /Invalid or missing sections\.sunlight/,
  );
});

test("plant-identification core does not live in the Vercel API route directory", () => {
  const apiCorePath = path.join(
    __dirname,
    "..",
    "api",
    "plant-identification-core.js",
  );

  assert.equal(fs.existsSync(apiCorePath), false);
});

test("rate-limit window parsing preserves configured defaults", () => {
  assert.equal(parseWindowSeconds("1 h", 99), 60 * 60);
  assert.equal(parseWindowSeconds("1 d", 99), 24 * 60 * 60);
  assert.equal(parseWindowSeconds("15 minutes", 99), 15 * 60);
  assert.equal(parseWindowSeconds("nonsense", 99), 99);
});

test("rate-limit client keys are stable hashes instead of raw identifiers", () => {
  const hash = hashClientIdentifier("203.0.113.10");

  assert.equal(hash.length, 64);
  assert.notEqual(hash, "203.0.113.10");
  assert.equal(hash, hashClientIdentifier("203.0.113.10"));
});

test("missing Supabase rate-limit config allows local development requests", async () => {
  const previousDbUrl = process.env.SUPABASE_DB_URL;
  const previousVercelEnv = process.env.VERCEL_ENV;
  delete process.env.SUPABASE_DB_URL;
  delete process.env.VERCEL_ENV;

  try {
    const result = await checkSupabaseRateLimit({
      clientIdentifier: "203.0.113.10",
      clientLimit: 15,
      clientWindowSeconds: 60 * 60,
      globalLimit: 100,
      globalWindowSeconds: 24 * 60 * 60,
    });

    assert.deepEqual(result, { configured: false, response: null });
  } finally {
    if (previousDbUrl === undefined) {
      delete process.env.SUPABASE_DB_URL;
    } else {
      process.env.SUPABASE_DB_URL = previousDbUrl;
    }
    if (previousVercelEnv === undefined) {
      delete process.env.VERCEL_ENV;
    } else {
      process.env.VERCEL_ENV = previousVercelEnv;
    }
  }
});

test("missing Supabase rate-limit config fails closed in Vercel deployments", async () => {
  const previousDbUrl = process.env.SUPABASE_DB_URL;
  const previousVercelEnv = process.env.VERCEL_ENV;
  delete process.env.SUPABASE_DB_URL;
  process.env.VERCEL_ENV = "preview";

  try {
    const result = await checkSupabaseRateLimit({
      clientIdentifier: "203.0.113.10",
      clientLimit: 15,
      clientWindowSeconds: 60 * 60,
      globalLimit: 100,
      globalWindowSeconds: 24 * 60 * 60,
    });

    assert.equal(result.configured, false);
    assert.equal(result.response.status, 503);
    assert.equal(result.response.body.error.code, "rate_limit_not_configured");
  } finally {
    if (previousDbUrl === undefined) {
      delete process.env.SUPABASE_DB_URL;
    } else {
      process.env.SUPABASE_DB_URL = previousDbUrl;
    }
    if (previousVercelEnv === undefined) {
      delete process.env.VERCEL_ENV;
    } else {
      process.env.VERCEL_ENV = previousVercelEnv;
    }
  }
});
