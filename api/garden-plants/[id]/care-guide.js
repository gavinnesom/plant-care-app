const { callOpenAIForCareGuide } = require("../../../server/garden-ai-core");
const { requireGardenSession } = require("../../../server/garden-session");
const { getPlantImages } = require("../../../server/garden-photo-store");
const { saveCareGuide } = require("../../../server/garden-record-store");
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
    const plant = await getPlant(plantId);
    if (!plant) return res.status(404).json({ error: "Plant not found." });
    if (!plant.plantType && !plant.aiScientificName && !plant.aiCommonName) {
      return res.status(400).json({
        error:
          "Add or identify the Plant Type before generating care guidance.",
      });
    }

    const photoIds = Array.isArray(body.referencePhotoIds)
      ? body.referencePhotoIds
      : [];
    const images = await getPlantImages(plantId, photoIds, {
      purposes: ["identity_reference"],
    });
    const contextSnapshot = {
      plantName: plant.plantName,
      location: plant.location,
      plantType: plant.plantType,
      identitySource: plant.identitySource,
      aiIdentity: plant.aiAssessment
        ? {
            commonName: plant.aiAssessment.commonName,
            scientificName: plant.aiAssessment.scientificName,
            confidence: plant.aiAssessment.confidence,
          }
        : null,
      observations: (plant.observations || []).map((observation) => ({
        description: observation.description,
        observedAt: observation.observedAt,
      })),
      referencePhotoIds: photoIds,
    };
    const { result, model } = await callOpenAIForCareGuide(
      contextSnapshot,
      images,
    );
    await saveCareGuide(plantId, result, contextSnapshot, { model, photoIds });
    return res.status(201).json({ plant: await getPlant(plantId) });
  } catch (error) {
    return gardenError(res, error, "Care guidance is temporarily unavailable.");
  }
};
