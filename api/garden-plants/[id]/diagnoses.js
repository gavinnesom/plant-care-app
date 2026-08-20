const { callOpenAIForDiagnosis } = require("../../../server/garden-ai-core");
const { requireGardenSession } = require("../../../server/garden-session");
const { getPlantImages } = require("../../../server/garden-photo-store");
const {
  getObservationsForDiagnosis,
  saveDiagnosis,
} = require("../../../server/garden-record-store");
const { getPlant } = require("../../../server/garden-store");
const { gardenError, getRouteId, readJson } = require("../../../server/http");
const { validatePhotoIds } = require("../../../server/garden-validation");

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

    const observations = await getObservationsForDiagnosis(
      plantId,
      body.observationIds,
    );
    const problemPhotoIds = [
      ...new Set(observations.flatMap((item) => item.photoIds)),
    ].slice(0, 5);
    const remainingSlots = 5 - problemPhotoIds.length;
    const referencePhotoIds = validatePhotoIds(body.referencePhotoIds).slice(
      0,
      remainingSlots,
    );
    const problemImages = await getPlantImages(plantId, problemPhotoIds, {
      purposes: ["observation_problem"],
    });
    const referenceImages = await getPlantImages(plantId, referencePhotoIds, {
      purposes: ["identity_reference"],
    });
    const photoIds = [...problemPhotoIds, ...referencePhotoIds];
    const contextSnapshot = {
      plant: {
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
      },
      careGuide: plant.careGuide?.guide || null,
      observations,
      imageOrder: {
        problemPhotoIds,
        referencePhotoIds,
      },
    };
    const { result, model } = await callOpenAIForDiagnosis(contextSnapshot, [
      ...problemImages,
      ...referenceImages,
    ]);
    await saveDiagnosis(plantId, result, contextSnapshot, {
      model,
      observationIds: observations.map((item) => item.id),
      photoIds,
    });
    return res.status(201).json({ plant: await getPlant(plantId) });
  } catch (error) {
    return gardenError(
      res,
      error,
      "Problem diagnosis is temporarily unavailable.",
    );
  }
};
