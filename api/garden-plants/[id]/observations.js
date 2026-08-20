const { requireGardenSession } = require("../../../server/garden-session");
const { createObservation } = require("../../../server/garden-record-store");
const { getPlant } = require("../../../server/garden-store");
const { gardenError, getRouteId, readJson } = require("../../../server/http");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed." });
  }
  if (!requireGardenSession(req, res)) return null;

  try {
    const plantId = getRouteId(req, 1);
    const body = await readJson(req);
    await createObservation(plantId, body);
    return res.status(201).json({ plant: await getPlant(plantId) });
  } catch (error) {
    return gardenError(res, error, "The observation could not be saved.");
  }
};
