export function apiErrorMessage(payload, fallback) {
  if (typeof payload?.error === "string") return payload.error;
  if (typeof payload?.error?.message === "string") return payload.error.message;
  return fallback;
}

export async function readJsonResponse(response, fallback) {
  const responseText = await response.text();
  let payload = {};
  try {
    payload = responseText ? JSON.parse(responseText) : {};
  } catch {
    throw new Error(fallback);
  }
  if (!response.ok) throw new Error(apiErrorMessage(payload, fallback));
  return payload;
}

export async function apiJson(
  url,
  options = {},
  fallback = "The request could not be completed.",
) {
  const response = await fetch(url, {
    ...options,
    headers: options.body
      ? { "Content-Type": "application/json", ...(options.headers || {}) }
      : options.headers,
  });
  return readJsonResponse(response, fallback);
}

export async function uploadGardenPhoto(plantId, file, purpose) {
  const formData = new FormData();
  formData.append("image", file);
  const response = await fetch(
    `/api/garden-plants/${plantId}/photos?purpose=${encodeURIComponent(purpose)}`,
    { method: "POST", body: formData },
  );
  return readJsonResponse(response, "The photo could not be saved.");
}
