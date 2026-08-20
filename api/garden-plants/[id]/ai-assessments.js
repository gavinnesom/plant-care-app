const { requireGardenSession } = require("../../../server/garden-session");
const { getPlant } = require("../../../server/garden-store");
const { saveAiAssessment } = require("../../../server/garden-record-store");
const { gardenError, getRouteId, readJson } = require("../../../server/http");
const {
  validatePlantResult,
} = require("../../../server/plant-identification-core");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed." });
  }
  if (!requireGardenSession(req, res)) return null;

  try {
    const plantId = getRouteId(req, 1);
    const body = await readJson(req);
    const result = validatePlantResult(body.result || {});
    await saveAiAssessment(plantId, result, {
      photoIds: body.photoIds,
      model: body.assessmentMeta?.model,
      schemaVersion: body.assessmentMeta?.schemaVersion,
      promptVersion: body.assessmentMeta?.promptVersion,
      source: "carried_identification",
    });
    return res.status(201).json({ plant: await getPlant(plantId) });
  } catch (error) {
    return gardenError(res, error, "The AI assessment could not be saved.");
  }
};
