const { requireGardenSession } = require("../../../server/garden-session");
const { saveUploadedPhoto } = require("../../../server/garden-photo-store");
const { getPlant } = require("../../../server/garden-store");
const {
  gardenError,
  getRouteId,
  readRequestBody,
} = require("../../../server/http");
const {
  parseMultipartImages,
} = require("../../../server/plant-identification-core");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed." });
  }
  if (!requireGardenSession(req, res)) return null;

  try {
    const contentType = req.headers["content-type"] || "";
    if (!contentType.includes("multipart/form-data")) {
      return res
        .status(400)
        .json({ error: "Send the photo as multipart/form-data." });
    }
    const body = await readRequestBody(req, 9 * 1024 * 1024);
    const images = parseMultipartImages(contentType, body);
    if (images.length !== 1) {
      return res
        .status(400)
        .json({ error: "Upload one saved photo at a time." });
    }
    const url = new URL(req.url, "https://plants.gavinnesom.com");
    const purpose = url.searchParams.get("purpose") || "identity_reference";
    const plantId = getRouteId(req, 1);
    const saved = await saveUploadedPhoto(
      plantId,
      images[0],
      images[0].filename,
      purpose,
    );
    return res
      .status(201)
      .json({ photoId: saved.id, plant: await getPlant(plantId) });
  } catch (error) {
    return gardenError(res, error, "The photo could not be saved.");
  }
};
