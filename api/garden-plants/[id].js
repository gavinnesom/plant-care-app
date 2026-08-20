const { requireGardenSession } = require("../../server/garden-session");
const {
  getPlant,
  restorePlant,
  softDeletePlant,
  updatePlant,
} = require("../../server/garden-store");
const { gardenError, getRouteId, readJson } = require("../../server/http");

module.exports = async function handler(req, res) {
  if (!requireGardenSession(req, res)) return null;

  try {
    const id = getRouteId(req);
    if (req.method === "GET") {
      const plant = await getPlant(id);
      if (!plant) return res.status(404).json({ error: "Plant not found." });
      return res.status(200).json({ plant });
    }

    if (req.method === "PATCH") {
      const plant = await updatePlant(id, await readJson(req));
      if (!plant) return res.status(404).json({ error: "Plant not found." });
      return res.status(200).json({ plant });
    }

    if (req.method === "DELETE") {
      const deleted = await softDeletePlant(id);
      if (!deleted) return res.status(404).json({ error: "Plant not found." });
      return res.status(200).json({ deleted: true });
    }

    if (req.method === "POST") {
      const restored = await restorePlant(id);
      if (!restored) return res.status(404).json({ error: "Plant not found." });
      return res.status(200).json({ restored: true });
    }

    res.setHeader("Allow", "GET, PATCH, DELETE, POST");
    return res.status(405).json({ error: "Method not allowed." });
  } catch (error) {
    return gardenError(res, error);
  }
};
