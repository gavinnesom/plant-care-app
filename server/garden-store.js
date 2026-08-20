const crypto = require('node:crypto');
const { getPool } = require('./db');

const MAX_PHOTO_BYTES = 8 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

function requireDb() {
  const db = getPool();
  if (!db) {
    const error = new Error('Garden database is not configured.');
    error.statusCode = 503;
    error.code = 'garden_not_configured';
    throw error;
  }
  return db;
}

function cleanText(value, maxLength = 240) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLength);
}

function normalizeAiAssessment(input = {}) {
  if (!input || input.state === 'none') {
    return {
      state: 'none',
      commonName: '',
      scientificName: '',
      confidence: null,
      raw: null,
    };
  }

  return {
    state: 'ai_guess',
    commonName: cleanText(input.commonName, 160),
    scientificName: cleanText(input.scientificName, 180),
    confidence: Number.isFinite(Number(input.confidence)) ? Number(input.confidence) : null,
    raw: input.raw || null,
  };
}

function normalizePhoto(input) {
  if (!input?.dataUrl) return null;
  const match = String(input.dataUrl).match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    const error = new Error('Photo must be a data URL.');
    error.statusCode = 400;
    throw error;
  }

  const mimeType = match[1];
  if (!ACCEPTED_IMAGE_TYPES.has(mimeType)) {
    const error = new Error('Photo must be a JPG, PNG, or WebP image.');
    error.statusCode = 400;
    throw error;
  }

  const buffer = Buffer.from(match[2], 'base64');
  if (!buffer.length || buffer.length > MAX_PHOTO_BYTES) {
    const error = new Error('Photo must be smaller than 8 MB.');
    error.statusCode = 400;
    throw error;
  }

  return {
    id: crypto.randomUUID(),
    mimeType,
    bytes: buffer,
    altText: cleanText(input.altText, 240),
    isPrimary: true,
  };
}

function serializePlant(row) {
  if (!row) return null;
  return {
    id: row.id,
    gardenName: row.garden_name,
    location: row.location || '',
    plantType: row.plant_type || '',
    aiAssessmentState: row.ai_assessment_state,
    aiCommonName: row.ai_common_name || '',
    aiScientificName: row.ai_scientific_name || '',
    aiConfidence: row.ai_confidence === null ? null : Number(row.ai_confidence),
    photoId: row.primary_photo_id || null,
    photoUrl: row.primary_photo_id ? `/api/garden-photos/${row.primary_photo_id}` : '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function listPlants() {
  const db = requireDb();
  const { rows } = await db.query(
    `select p.*,
      (select ph.id from plant_id.garden_photos ph where ph.plant_id = p.id and ph.deleted_at is null order by ph.is_primary desc, ph.created_at asc limit 1) as primary_photo_id
     from plant_id.garden_plants p
     where p.deleted_at is null
     order by p.updated_at desc`
  );
  return rows.map(serializePlant);
}

async function getPlant(id) {
  const db = requireDb();
  const { rows } = await db.query(
    `select p.*,
      (select ph.id from plant_id.garden_photos ph where ph.plant_id = p.id and ph.deleted_at is null order by ph.is_primary desc, ph.created_at asc limit 1) as primary_photo_id
     from plant_id.garden_plants p
     where p.id = $1 and p.deleted_at is null`,
    [id]
  );
  return serializePlant(rows[0]);
}

async function savePhoto(client, plantId, photo) {
  if (!photo) return;
  await client.query(
    `update plant_id.garden_photos set is_primary = false, updated_at = now() where plant_id = $1 and deleted_at is null`,
    [plantId]
  );
  await client.query(
    `insert into plant_id.garden_photos (id, plant_id, mime_type, byte_size, image_bytes, alt_text, is_primary)
     values ($1, $2, $3, $4, $5, $6, true)`,
    [photo.id, plantId, photo.mimeType, photo.bytes.length, photo.bytes, photo.altText]
  );
}

async function createPlant(input) {
  const gardenName = cleanText(input.gardenName, 120);
  if (!gardenName) {
    const error = new Error('Garden Name is required.');
    error.statusCode = 400;
    throw error;
  }

  const ai = normalizeAiAssessment(input.aiAssessment);
  const plantType = cleanText(input.plantType || ai.scientificName || ai.commonName || '', 180);
  const photo = normalizePhoto(input.photo);
  const id = crypto.randomUUID();
  const db = requireDb();
  const client = await db.connect();

  try {
    await client.query('begin');
    await client.query(
      `insert into plant_id.garden_plants (
        id, garden_name, location, plant_type, identity_source,
        ai_assessment_state, ai_common_name, ai_scientific_name, ai_confidence, ai_raw
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        id,
        gardenName,
        cleanText(input.location, 160),
        plantType,
        input.identitySource === 'manual' ? 'manual' : ai.state === 'ai_guess' ? 'ai_initial' : 'manual',
        ai.state,
        ai.commonName,
        ai.scientificName,
        ai.confidence,
        ai.raw,
      ]
    );
    await savePhoto(client, id, photo);
    await client.query('commit');
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }

  return getPlant(id);
}

async function updatePlant(id, input) {
  const gardenName = cleanText(input.gardenName, 120);
  if (!gardenName) {
    const error = new Error('Garden Name is required.');
    error.statusCode = 400;
    throw error;
  }

  const db = requireDb();
  const { rowCount } = await db.query(
    `update plant_id.garden_plants
     set garden_name = $2,
       location = $3,
       plant_type = $4,
       identity_source = case when plant_type is distinct from $4 then 'manual' else identity_source end,
       updated_at = now()
     where id = $1 and deleted_at is null`,
    [id, gardenName, cleanText(input.location, 160), cleanText(input.plantType, 180)]
  );
  if (!rowCount) return null;
  return getPlant(id);
}

async function getPhoto(photoId) {
  const db = requireDb();
  const { rows } = await db.query(
    `select ph.mime_type, ph.image_bytes
     from plant_id.garden_photos ph
     join plant_id.garden_plants p on p.id = ph.plant_id
     where ph.id = $1 and ph.deleted_at is null and p.deleted_at is null`,
    [photoId]
  );
  return rows[0] || null;
}

module.exports = {
  createPlant,
  getPhoto,
  getPlant,
  listPlants,
  normalizeAiAssessment,
  normalizePhoto,
  updatePlant,
};
