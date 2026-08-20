const crypto = require("node:crypto");
const { requireDb } = require("./db");
const {
  cleanText,
  requireText,
  validatePhotoIds,
} = require("./garden-validation");

const IDENTIFICATION_SCHEMA_VERSION = "plant-identification-v1";
const IDENTIFICATION_PROMPT_VERSION = "plant-identification-v2";
const CARE_SCHEMA_VERSION = "plant-care-guide-v1";
const CARE_PROMPT_VERSION = "plant-care-guide-v2";
const DIAGNOSIS_SCHEMA_VERSION = "plant-diagnosis-v1";
const DIAGNOSIS_PROMPT_VERSION = "plant-diagnosis-v2";

function serializeAssessment(row, fallbackPlant = null) {
  if (!row && fallbackPlant?.ai_assessment_state !== "ai_guess") return null;
  if (!row) {
    return {
      id: null,
      commonName: fallbackPlant.ai_common_name || "",
      scientificName: fallbackPlant.ai_scientific_name || "",
      confidence:
        fallbackPlant.ai_confidence === null
          ? null
          : Number(fallbackPlant.ai_confidence),
      result: fallbackPlant.ai_raw || null,
      model: "",
      schemaVersion: "legacy",
      promptVersion: "legacy",
      source: "legacy",
      photoIds: [],
      createdAt: fallbackPlant.updated_at,
    };
  }
  return {
    id: row.id,
    commonName: row.common_name || "",
    scientificName: row.scientific_name || "",
    confidence: row.confidence === null ? null : Number(row.confidence),
    result: row.result,
    model: row.model || "",
    schemaVersion: row.schema_version,
    promptVersion: row.prompt_version,
    source: row.source,
    photoIds: row.photo_ids || [],
    createdAt: row.created_at,
  };
}

function serializeCareGuide(row) {
  if (!row) return null;
  return {
    id: row.id,
    guide: row.guide,
    contextSnapshot: row.context_snapshot,
    model: row.model || "",
    schemaVersion: row.schema_version,
    promptVersion: row.prompt_version,
    photoIds: row.photo_ids || [],
    createdAt: row.created_at,
  };
}

function serializeObservation(row) {
  return {
    id: row.id,
    description: row.description,
    observedAt: row.observed_at,
    photoIds: row.photo_ids || [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function serializeDiagnosis(row) {
  if (!row) return null;
  return {
    id: row.id,
    diagnosis: row.diagnosis,
    contextSnapshot: row.context_snapshot,
    model: row.model || "",
    schemaVersion: row.schema_version,
    promptVersion: row.prompt_version,
    observationIds: row.observation_ids || [],
    photoIds: row.photo_ids || [],
    createdAt: row.created_at,
  };
}

async function getCurrentAssessment(db, plantRow) {
  if (!plantRow.current_ai_assessment_id)
    return serializeAssessment(null, plantRow);
  const { rows } = await db.query(
    `select a.*,
      coalesce(array_agg(ap.photo_id) filter (where ap.photo_id is not null), '{}') as photo_ids
     from plant_id.ai_assessments a
     left join plant_id.ai_assessment_photos ap on ap.assessment_id = a.id
     where a.id = $1 and a.plant_id = $2
     group by a.id`,
    [plantRow.current_ai_assessment_id, plantRow.id],
  );
  return serializeAssessment(rows[0], plantRow);
}

async function getCurrentCareGuide(db, plantRow) {
  if (!plantRow.current_care_guide_id) return null;
  const { rows } = await db.query(
    `select c.*,
      coalesce(array_agg(cp.photo_id) filter (where cp.photo_id is not null), '{}') as photo_ids
     from plant_id.care_guides c
     left join plant_id.care_guide_photos cp on cp.care_guide_id = c.id
     where c.id = $1 and c.plant_id = $2
     group by c.id`,
    [plantRow.current_care_guide_id, plantRow.id],
  );
  return serializeCareGuide(rows[0]);
}

async function listObservations(db, plantId) {
  const { rows } = await db.query(
    `select o.*,
      coalesce(array_agg(op.photo_id) filter (where op.photo_id is not null), '{}') as photo_ids
     from plant_id.observations o
     left join plant_id.observation_photos op on op.observation_id = o.id
     where o.plant_id = $1 and o.deleted_at is null
     group by o.id
     order by o.observed_at desc, o.created_at desc`,
    [plantId],
  );
  return rows.map(serializeObservation);
}

async function getCurrentDiagnosis(db, plantRow) {
  if (!plantRow.current_diagnosis_id) return null;
  const { rows } = await db.query(
    `select d.*,
      coalesce((select array_agg(observation_id) from plant_id.diagnosis_observations where diagnosis_id = d.id), '{}') as observation_ids,
      coalesce((select array_agg(photo_id) from plant_id.diagnosis_photos where diagnosis_id = d.id), '{}') as photo_ids
     from plant_id.diagnoses d
     where d.id = $1 and d.plant_id = $2`,
    [plantRow.current_diagnosis_id, plantRow.id],
  );
  return serializeDiagnosis(rows[0]);
}

async function getPlantRecords(db, plantRow) {
  const [aiAssessment, careGuide, observations, diagnosis] = await Promise.all([
    getCurrentAssessment(db, plantRow),
    getCurrentCareGuide(db, plantRow),
    listObservations(db, plantRow.id),
    getCurrentDiagnosis(db, plantRow),
  ]);
  return { aiAssessment, careGuide, observations, diagnosis };
}

async function assertPhotoIdsForPlant(
  db,
  plantId,
  rawPhotoIds,
  { max = 10, purposes = [] } = {},
) {
  const photoIds = validatePhotoIds(rawPhotoIds, { max });
  if (!photoIds.length) return [];
  const { rows } = await db.query(
    `select id from plant_id.garden_photos
     where plant_id = $1 and deleted_at is null and id = any($2::uuid[])
       and (cardinality($3::text[]) = 0 or purpose = any($3::text[]))`,
    [plantId, photoIds, purposes],
  );
  if (rows.length !== photoIds.length) {
    const error = new Error("One or more selected photos are unavailable.");
    error.statusCode = 400;
    throw error;
  }
  return photoIds;
}

async function saveAiAssessment(
  plantId,
  result,
  metadata = {},
  db = requireDb(),
) {
  const photoIds = await assertPhotoIdsForPlant(
    db,
    plantId,
    metadata.photoIds,
    {
      max: 5,
      purposes: ["identity_reference"],
    },
  );
  const id = crypto.randomUUID();
  const client = await db.connect();
  try {
    await client.query("begin");
    const plant = await client.query(
      `select id from plant_id.garden_plants
       where id = $1 and deleted_at is null for update`,
      [plantId],
    );
    if (!plant.rows[0]) {
      const error = new Error("Plant not found.");
      error.statusCode = 404;
      throw error;
    }
    await client.query(
      `insert into plant_id.ai_assessments
        (id, plant_id, common_name, scientific_name, confidence, result, model, schema_version, prompt_version, source)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        id,
        plantId,
        cleanText(result.commonName, 160),
        cleanText(result.scientificName, 180),
        result.confidence,
        result,
        cleanText(metadata.model, 120),
        cleanText(metadata.schemaVersion, 80) || IDENTIFICATION_SCHEMA_VERSION,
        cleanText(metadata.promptVersion, 80) || IDENTIFICATION_PROMPT_VERSION,
        metadata.source === "carried_identification"
          ? "carried_identification"
          : "openai",
      ],
    );
    for (const photoId of photoIds) {
      await client.query(
        "insert into plant_id.ai_assessment_photos (assessment_id, photo_id) values ($1, $2)",
        [id, photoId],
      );
    }
    await client.query(
      `update plant_id.garden_plants
       set current_ai_assessment_id = $2,
         ai_assessment_state = 'ai_guess',
         ai_common_name = $3,
         ai_scientific_name = $4,
         ai_confidence = $5,
         ai_raw = $6,
         plant_type = case when length(trim(plant_type)) = 0 then coalesce(nullif($4, ''), nullif($3, ''), '') else plant_type end,
         identity_source = case when length(trim(plant_type)) = 0 then 'ai_accepted' else identity_source end,
         updated_at = now()
       where id = $1`,
      [
        plantId,
        id,
        cleanText(result.commonName, 160),
        cleanText(result.scientificName, 180),
        result.confidence,
        result,
      ],
    );
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
  return id;
}

async function saveCareGuide(
  plantId,
  guide,
  contextSnapshot,
  metadata = {},
  db = requireDb(),
) {
  const photoIds = await assertPhotoIdsForPlant(
    db,
    plantId,
    metadata.photoIds,
    {
      max: 5,
      purposes: ["identity_reference"],
    },
  );
  const id = crypto.randomUUID();
  const client = await db.connect();
  try {
    await client.query("begin");
    const plant = await client.query(
      "select id from plant_id.garden_plants where id = $1 and deleted_at is null for update",
      [plantId],
    );
    if (!plant.rows[0]) {
      const error = new Error("Plant not found.");
      error.statusCode = 404;
      throw error;
    }
    await client.query(
      `insert into plant_id.care_guides
        (id, plant_id, guide, context_snapshot, model, schema_version, prompt_version)
       values ($1, $2, $3, $4, $5, $6, $7)`,
      [
        id,
        plantId,
        guide,
        contextSnapshot,
        cleanText(metadata.model, 120),
        CARE_SCHEMA_VERSION,
        CARE_PROMPT_VERSION,
      ],
    );
    for (const photoId of photoIds) {
      await client.query(
        "insert into plant_id.care_guide_photos (care_guide_id, photo_id) values ($1, $2)",
        [id, photoId],
      );
    }
    await client.query(
      "update plant_id.garden_plants set current_care_guide_id = $2, updated_at = now() where id = $1",
      [plantId, id],
    );
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
  return id;
}

async function createObservation(plantId, input = {}, db = requireDb()) {
  const description = requireText(input.description, "Observation", 2000);
  const observedAt = input.observedAt ? new Date(input.observedAt) : new Date();
  if (Number.isNaN(observedAt.getTime())) {
    const error = new Error("Observation date is invalid.");
    error.statusCode = 400;
    throw error;
  }
  const photoIds = await assertPhotoIdsForPlant(db, plantId, input.photoIds, {
    max: 10,
    purposes: ["observation_problem"],
  });
  const id = crypto.randomUUID();
  const client = await db.connect();
  try {
    await client.query("begin");
    const plant = await client.query(
      "select id from plant_id.garden_plants where id = $1 and deleted_at is null",
      [plantId],
    );
    if (!plant.rows[0]) {
      const error = new Error("Plant not found.");
      error.statusCode = 404;
      throw error;
    }
    await client.query(
      "insert into plant_id.observations (id, plant_id, description, observed_at) values ($1, $2, $3, $4)",
      [id, plantId, description, observedAt.toISOString()],
    );
    for (const photoId of photoIds) {
      await client.query(
        "insert into plant_id.observation_photos (observation_id, photo_id) values ($1, $2)",
        [id, photoId],
      );
    }
    await client.query(
      "update plant_id.garden_plants set updated_at = now() where id = $1",
      [plantId],
    );
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
  return id;
}

async function getObservationsForDiagnosis(
  plantId,
  rawObservationIds,
  db = requireDb(),
) {
  const ids = Array.isArray(rawObservationIds)
    ? [
        ...new Set(
          rawObservationIds.filter((id) => typeof id === "string" && id.trim()),
        ),
      ]
    : [];
  if (!ids.length) {
    const error = new Error("Choose at least one observation to diagnose.");
    error.statusCode = 400;
    throw error;
  }
  const { rows } = await db.query(
    `select o.id, o.description, o.observed_at,
      coalesce(array_agg(op.photo_id) filter (where op.photo_id is not null), '{}') as photo_ids
     from plant_id.observations o
     left join plant_id.observation_photos op on op.observation_id = o.id
     where o.plant_id = $1 and o.deleted_at is null and o.id = any($2::uuid[])
     group by o.id
     order by o.observed_at asc`,
    [plantId, ids],
  );
  if (rows.length !== ids.length) {
    const error = new Error(
      "One or more selected observations are unavailable.",
    );
    error.statusCode = 400;
    throw error;
  }
  return rows.map((row) => ({
    id: row.id,
    description: row.description,
    observedAt: row.observed_at,
    photoIds: row.photo_ids || [],
  }));
}

async function saveDiagnosis(
  plantId,
  diagnosis,
  contextSnapshot,
  metadata = {},
  db = requireDb(),
) {
  const photoIds = await assertPhotoIdsForPlant(
    db,
    plantId,
    metadata.photoIds,
    {
      max: 5,
      purposes: ["identity_reference", "observation_problem"],
    },
  );
  const observations = await getObservationsForDiagnosis(
    plantId,
    metadata.observationIds,
    db,
  );
  const id = crypto.randomUUID();
  const client = await db.connect();
  try {
    await client.query("begin");
    const plant = await client.query(
      "select id from plant_id.garden_plants where id = $1 and deleted_at is null for update",
      [plantId],
    );
    if (!plant.rows[0]) {
      const error = new Error("Plant not found.");
      error.statusCode = 404;
      throw error;
    }
    await client.query(
      `insert into plant_id.diagnoses
        (id, plant_id, diagnosis, context_snapshot, model, schema_version, prompt_version)
       values ($1, $2, $3, $4, $5, $6, $7)`,
      [
        id,
        plantId,
        diagnosis,
        contextSnapshot,
        cleanText(metadata.model, 120),
        DIAGNOSIS_SCHEMA_VERSION,
        DIAGNOSIS_PROMPT_VERSION,
      ],
    );
    for (const observation of observations) {
      await client.query(
        "insert into plant_id.diagnosis_observations (diagnosis_id, observation_id) values ($1, $2)",
        [id, observation.id],
      );
    }
    for (const photoId of photoIds) {
      await client.query(
        "insert into plant_id.diagnosis_photos (diagnosis_id, photo_id) values ($1, $2)",
        [id, photoId],
      );
    }
    await client.query(
      "update plant_id.garden_plants set current_diagnosis_id = $2, updated_at = now() where id = $1",
      [plantId, id],
    );
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
  return id;
}

module.exports = {
  CARE_PROMPT_VERSION,
  CARE_SCHEMA_VERSION,
  DIAGNOSIS_PROMPT_VERSION,
  DIAGNOSIS_SCHEMA_VERSION,
  IDENTIFICATION_PROMPT_VERSION,
  IDENTIFICATION_SCHEMA_VERSION,
  createObservation,
  getObservationsForDiagnosis,
  getPlantRecords,
  saveAiAssessment,
  saveCareGuide,
  saveDiagnosis,
};
