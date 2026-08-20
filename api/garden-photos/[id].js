const { requireGardenSession } = require("../../server/garden-session");
const {
  getPhoto,
  softDeletePhoto,
} = require("../../server/garden-photo-store");
const { getPlant } = require("../../server/garden-store");
const { gardenError, getRouteId } = require("../../server/http");

module.exports = async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "DELETE") {
    res.setHeader("Allow", "GET, DELETE");
    return res.status(405).json({ error: "Method not allowed." });
  }

  if (!requireGardenSession(req, res)) return null;

  try {
    if (req.method === "DELETE") {
      const plantId = await softDeletePhoto(getRouteId(req));
      if (!plantId) return res.status(404).json({ error: "Photo not found." });
      return res.status(200).json({ plant: await getPlant(plantId) });
    }

    const photo = await getPhoto(getRouteId(req));
    if (!photo) return res.status(404).json({ error: "Photo not found." });

    res.setHeader("Content-Type", photo.mime_type);
    res.setHeader("Cache-Control", "private, max-age=300");
    return res.status(200).send(Buffer.from(photo.image_bytes));
  } catch (error) {
    return gardenError(res, error, "Garden photo is temporarily unavailable.");
  }
};
