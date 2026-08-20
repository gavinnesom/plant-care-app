const {
  extractJson,
  validateIdentificationImages,
} = require("./plant-identification-core");

const CARE_GUIDE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "summary",
    "sunlight",
    "watering",
    "soilDrainage",
    "temperatureSeasonal",
    "feeding",
    "pruningMaintenance",
    "containerAdvice",
    "propagation",
    "safety",
    "watchFor",
  ],
  properties: {
    summary: { type: "string" },
    sunlight: { type: "string" },
    watering: { type: "string" },
    soilDrainage: { type: "string" },
    temperatureSeasonal: { type: "string" },
    feeding: { type: "string" },
    pruningMaintenance: { type: "string" },
    containerAdvice: { type: "string" },
    propagation: { type: "string" },
    safety: { type: "string" },
    watchFor: { type: "array", items: { type: "string" } },
  },
};

const DIAGNOSIS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "summary",
    "confidence",
    "observedSymptoms",
    "likelyCauses",
    "recommendedActions",
    "monitorNext",
    "urgentSafetyNotes",
    "uncertainty",
  ],
  properties: {
    summary: { type: "string" },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    observedSymptoms: { type: "array", items: { type: "string" } },
    likelyCauses: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["cause", "likelihood", "rationale"],
        properties: {
          cause: { type: "string" },
          likelihood: { type: "string", enum: ["high", "medium", "low"] },
          rationale: { type: "string" },
        },
      },
    },
    recommendedActions: { type: "array", items: { type: "string" } },
    monitorNext: { type: "array", items: { type: "string" } },
    urgentSafetyNotes: { type: "array", items: { type: "string" } },
    uncertainty: { type: "string" },
  },
};

function modelName() {
  return process.env.OPENAI_MODEL || "gpt-4.1-mini";
}

function requireApiKey() {
  if (process.env.OPENAI_API_KEY) return process.env.OPENAI_API_KEY;
  const error = new Error("Missing OPENAI_API_KEY.");
  error.statusCode = 500;
  error.exposeMessage = true;
  throw error;
}

function outputText(payload) {
  return (
    payload.output_text ||
    payload.output
      ?.flatMap((item) => item.content || [])
      .map((content) => content.text || "")
      .join("")
      .trim()
  );
}

async function callStructuredGardenAI({
  prompt,
  images = [],
  schema,
  schemaName,
}) {
  const validatedImages = images.length
    ? validateIdentificationImages(images)
    : [];
  let response;
  try {
    response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${requireApiKey()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: modelName(),
        input: [
          {
            role: "user",
            content: [
              { type: "input_text", text: prompt },
              ...validatedImages.map((image) => ({
                type: "input_image",
                image_url: `data:${image.mimeType};base64,${image.buffer.toString("base64")}`,
                detail: "high",
              })),
            ],
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: schemaName,
            strict: true,
            schema,
          },
        },
      }),
    });
  } catch (error) {
    error.boundary = "openai";
    throw error;
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error?.message || "OpenAI request failed.");
    error.statusCode = response.status;
    throw error;
  }
  const text = outputText(payload);
  if (!text) throw new Error("OpenAI returned an empty response.");
  return { result: extractJson(text), model: modelName() };
}

function carePrompt(context) {
  return `Create a practical, concise care guide for this saved plant. Use the identity and location as the primary facts. Images, when present, are deliberately selected healthy identity/reference photos. Do not diagnose a problem here. State uncertainty and safety cautions plainly. Never claim a plant is non-toxic or safe to eat based only on an uncertain AI identity; when identity or toxicity is uncertain, say that Gavin should verify with an authoritative plant, veterinary, or poison-control source.\n\nPlant context:\n${JSON.stringify(context)}`;
}

function diagnosisPrompt(context) {
  return `Assess what may be happening to this saved plant. This is problem diagnosis, not species identification. The first images are attached to the selected observations and should be treated as problem evidence. Any later identity/reference images are explicitly labeled in the context and are only a healthy comparison. Consider watering, drainage, heat, light, nutrients, pests, transplant shock, physical damage, and disease without assuming disease. Give reversible next steps, distinguish evidence from uncertainty, and flag urgent human/pet safety concerns. Never claim a plant is non-toxic or safe to eat based only on an uncertain AI identity; recommend authoritative verification where identity or toxicity matters.\n\nPlant and observation context:\n${JSON.stringify(context)}`;
}

async function callOpenAIForCareGuide(context, images = []) {
  return callStructuredGardenAI({
    prompt: carePrompt(context),
    images,
    schema: CARE_GUIDE_SCHEMA,
    schemaName: "plant_care_guide",
  });
}

async function callOpenAIForDiagnosis(context, images = []) {
  return callStructuredGardenAI({
    prompt: diagnosisPrompt(context),
    images,
    schema: DIAGNOSIS_SCHEMA,
    schemaName: "plant_problem_diagnosis",
  });
}

module.exports = {
  CARE_GUIDE_SCHEMA,
  DIAGNOSIS_SCHEMA,
  callOpenAIForCareGuide,
  callOpenAIForDiagnosis,
};
