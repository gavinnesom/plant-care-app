const crypto = require("node:crypto");
const { requireDb } = require("./db");
const { listPhotos } = require("./garden-photo-store");
const { getPlantRecords } = require("./garden-record-store");
const {
  cleanText,
  normalizeIdentitySource,
  requireText,
} = require("./garden-validation");

function normalizedStoredIdentitySource(value) {
  return value === "ai_initial"
    ? "ai_accepted"
    : normalizeIdentitySource(value);
}

function serializePlant(row, photos = [], records = {}) {
  if (!row) return null;
  const referencePhotos = photos.filter(
    (photo) => photo.purpose === "identity_reference",
  );
  const primaryPhoto =
    referencePhotos.find((photo) => photo.isPrimary) ||
    referencePhotos[0] ||
    null;
  const assessment = records.aiAssessment || null;
  return {
    id: row.id,
    plantName: row.plant_name,
    location: row.location || "",
    plantType: row.plant_type || "",
    identitySource: normalizedStoredIdentitySource(row.identity_source),
    aiAssessmentState:
      assessment || row.ai_assessment_state === "ai_guess"
        ? "ai_guess"
        : "none",
    aiCommonName: assessment?.commonName || row.ai_common_name || "",
    aiScientificName:
      assessment?.scientificName || row.ai_scientific_name || "",
    aiConfidence:
      assessment?.confidence ??
      (row.ai_confidence === null ? null : Number(row.ai_confidence)),
    aiAssessment: assessment,
    photoId: primaryPhoto?.id || row.primary_photo_id || null,
    photoUrl:
      primaryPhoto?.url ||
      (row.primary_photo_id
        ? `/api/garden-photos/${row.primary_photo_id}`
        : ""),
    photoCount: photos.length || Number(row.photo_count || 0),
    photos,
    careGuide: records.careGuide || null,
    observations: records.observations || [],
    diagnosis: records.diagnosis || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function listPlants() {
  const db = requireDb();
  const { rows } = await db.query(
    `select p.*,
      (select ph.id from plant_id.garden_photos ph
       where ph.plant_id = p.id and ph.deleted_at is null and ph.purpose = 'identity_reference'
       order by ph.is_primary desc, ph.created_at asc limit 1) as primary_photo_id,
      (select count(*) from plant_id.garden_photos ph
       where ph.plant_id = p.id and ph.deleted_at is null) as photo_count
     from plant_id.garden_plants p
     where p.deleted_at is null
     order by p.updated_at desc`,
  );
  return rows.map((row) => serializePlant(row));
}

async function getPlant(id) {
  const db = requireDb();
  const { rows } = await db.query(
    `select p.* from plant_id.garden_plants p
     where p.id = $1 and p.deleted_at is null`,
    [id],
  );
  if (!rows[0]) return null;
  const [photos, records] = await Promise.all([
    listPhotos(id, db),
    getPlantRecords(db, rows[0]),
  ]);
  return serializePlant(rows[0], photos, records);
}

async function createPlant(input = {}) {
  const plantName = requireText(
    input.plantName || input.gardenName,
    "Plant Name",
    120,
  );
  const plantType = cleanText(input.plantType, 180);
  const identitySource = plantType
    ? normalizeIdentitySource(input.identitySource)
    : "manual";
  const id = crypto.randomUUID();
  const db = requireDb();
  await db.query(
    `insert into plant_id.garden_plants
      (id, plant_name, location, plant_type, identity_source, ai_assessment_state)
     values ($1, $2, $3, $4, $5, 'none')`,
    [id, plantName, cleanText(input.location, 160), plantType, identitySource],
  );
  return getPlant(id);
}

async function updatePlant(id, input = {}) {
  const plantName = requireText(
    input.plantName || input.gardenName,
    "Plant Name",
    120,
  );
  const db = requireDb();
  const existing = await db.query(
    `select plant_type, identity_source, ai_common_name, ai_scientific_name
     from plant_id.garden_plants where id = $1 and deleted_at is null`,
    [id],
  );
  if (!existing.rows[0]) return null;

  const current = existing.rows[0];
  const plantType = cleanText(input.plantType, 180);
  const typeChanged = plantType !== (current.plant_type || "");
  let identitySource = normalizeIdentitySource(
    input.identitySource,
    normalizedStoredIdentitySource(current.identity_source),
  );
  if (!plantType) identitySource = "manual";
  if (typeChanged && identitySource === "ai_accepted") {
    const aiNames = [current.ai_scientific_name, current.ai_common_name].filter(
      Boolean,
    );
    if (!aiNames.includes(plantType)) identitySource = "manual";
  }
  if (typeChanged && !input.identitySource) identitySource = "manual";

  const { rowCount } = await db.query(
    `update plant_id.garden_plants
     set plant_name = $2, location = $3, plant_type = $4,
       identity_source = $5, updated_at = now()
     where id = $1 and deleted_at is null`,
    [id, plantName, cleanText(input.location, 160), plantType, identitySource],
  );
  if (!rowCount) return null;
  return getPlant(id);
}

async function softDeletePlant(id) {
  const db = requireDb();
  const { rowCount } = await db.query(
    `update plant_id.garden_plants
     set deleted_at = now(), updated_at = now()
     where id = $1 and deleted_at is null`,
    [id],
  );
  return rowCount > 0;
}

module.exports = {
  createPlant,
  getPlant,
  listPlants,
  serializePlant,
  softDeletePlant,
  updatePlant,
};
