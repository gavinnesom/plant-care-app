const ACCEPTED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_AI_PHOTOS = 5;
const IDENTITY_SOURCES = new Set(["manual", "ai_accepted", "label_confirmed"]);
const PHOTO_PURPOSES = new Set([
  "identity_reference",
  "observation_problem",
  "progress_history",
]);

function cleanText(value, maxLength = 240) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

function requireText(value, label, maxLength = 240) {
  const cleaned = cleanText(value, maxLength);
  if (!cleaned) {
    const error = new Error(`${label} is required.`);
    error.statusCode = 400;
    throw error;
  }
  return cleaned;
}

function normalizeIdentitySource(value, fallback = "manual") {
  return IDENTITY_SOURCES.has(value) ? value : fallback;
}

function normalizePhotoPurpose(value, fallback = "identity_reference") {
  return PHOTO_PURPOSES.has(value) ? value : fallback;
}

function validatePhotoIds(
  value,
  { required = false, max = MAX_AI_PHOTOS } = {},
) {
  const ids = Array.isArray(value)
    ? [
        ...new Set(
          value
            .filter((id) => typeof id === "string" && id.trim())
            .map((id) => id.trim()),
        ),
      ]
    : [];
  if (required && !ids.length) {
    const error = new Error("Choose at least one photo.");
    error.statusCode = 400;
    throw error;
  }
  if (ids.length > max) {
    const error = new Error(
      `Choose no more than ${max} photos for one AI request.`,
    );
    error.statusCode = 400;
    throw error;
  }
  return ids;
}

function validateImageSignature(buffer, mimeType) {
  if (mimeType === "image/jpeg")
    return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (mimeType === "image/png")
    return buffer
      .subarray(0, 8)
      .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (mimeType === "image/webp")
    return (
      buffer.subarray(0, 4).toString() === "RIFF" &&
      buffer.subarray(8, 12).toString() === "WEBP"
    );
  return false;
}

function normalizeUploadedImage(image) {
  const mimeType = cleanText(image?.mimeType, 80).toLowerCase();
  const buffer = Buffer.isBuffer(image?.buffer) ? image.buffer : null;
  if (!ACCEPTED_IMAGE_TYPES.has(mimeType)) {
    const error = new Error("Photo must be a JPG, PNG, or WebP image.");
    error.statusCode = 400;
    throw error;
  }
  if (!buffer?.length || buffer.length > MAX_IMAGE_BYTES) {
    const error = new Error("Photo must be smaller than 8 MB.");
    error.statusCode = 400;
    throw error;
  }
  if (!validateImageSignature(buffer, mimeType)) {
    const error = new Error("The uploaded file does not match its image type.");
    error.statusCode = 400;
    throw error;
  }
  return {
    buffer,
    mimeType,
    filename: cleanText(image.filename, 240) || "Plant photo",
  };
}

module.exports = {
  ACCEPTED_IMAGE_TYPES,
  IDENTITY_SOURCES,
  MAX_AI_PHOTOS,
  MAX_IMAGE_BYTES,
  cleanText,
  normalizeIdentitySource,
  normalizePhotoPurpose,
  normalizeUploadedImage,
  requireText,
  validatePhotoIds,
};
