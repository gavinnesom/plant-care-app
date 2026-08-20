function readRequestBody(req, maxBytes) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    let settled = false;

    req.on("data", (chunk) => {
      if (settled) return;
      total += chunk.length;
      if (total > maxBytes) {
        settled = true;
        const error = new Error("Request body is too large.");
        error.statusCode = 413;
        reject(error);
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on("end", () => {
      if (settled) return;
      settled = true;
      resolve(Buffer.concat(chunks));
    });
    req.on("error", (error) => {
      if (settled) return;
      settled = true;
      reject(error);
    });
  });
}

async function readJson(req, maxBytes = 64 * 1024) {
  const body = await readRequestBody(req, maxBytes);
  if (!body.length) return {};
  try {
    return JSON.parse(body.toString("utf8"));
  } catch {
    const error = new Error("Request body must be JSON.");
    error.statusCode = 400;
    throw error;
  }
}

function getRouteId(req, offsetFromEnd = 0) {
  const url = new URL(req.url, "https://plants.gavinnesom.com");
  const parts = url.pathname.split("/").filter(Boolean);
  return decodeURIComponent(parts[parts.length - 1 - offsetFromEnd] || "");
}

function gardenError(
  res,
  error,
  fallback = "My Garden is temporarily unavailable.",
) {
  const status = error.statusCode || 500;
  return res.status(status).json({
    error: {
      code: error.code || "garden_request_failed",
      message: status < 500 ? error.message : fallback,
    },
  });
}

module.exports = {
  gardenError,
  getRouteId,
  readJson,
  readRequestBody,
};
