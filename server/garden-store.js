const crypto = require('node:crypto');
const { getPool } = require('./db');

const MAX_PHOTO_BYTES = 8 * 1024 * 1024;
const MAX_PHOTO_COUNT = 5;
const MAX_PHOTO_SET_BYTES = 24 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
let plantNameColumnReady = false;

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
  if (!input || input.state !== 'ai_guess') {
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

function normalizePhotos(input) {
  const rawPhotos = Array.isArray(input?.photos) ? input.photos : input?.photo ? [input.photo] : [];
  const photos = rawPhotos.map(normalizePhoto).filter(Boolean);
  if (photos.length > MAX_PHOTO_COUNT) {
    const error = new Error(`Save no more than ${MAX_PHOTO_COUNT} photos at a time.`);
    error.statusCode = 400;
    throw error;
  }
  const totalBytes = photos.reduce((sum, photo) => sum + photo.bytes.length, 0);
  if (totalBytes > MAX_PHOTO_SET_BYTES) {
    const error = new Error('Photo set is too large.');
    error.statusCode = 400;
    throw error;
  }
  return photos;
}

async function ensurePlantNameColumn(db) {
  if (plantNameColumnReady) return;
  await db.query(`
    do $$
    begin
      if exists (
        select 1 from information_schema.columns
        where table_schema = 'plant_id' and table_name = 'garden_plants' and column_name = 'garden_name'
      ) and not exists (
        select 1 from information_schema.columns
        where table_schema = 'plant_id' and table_name = 'garden_plants' and column_name = 'plant_name'
      ) then
        alter table plant_id.garden_plants rename column garden_name to plant_name;
      end if;
    end $$;

    alter table plant_id.garden_plants
      drop constraint if exists garden_plants_name_check;

    alter table plant_id.garden_plants
      drop constraint if exists garden_plants_plant_name_check;

    alter table plant_id.garden_plants
      add constraint garden_plants_plant_name_check check (length(trim(plant_name)) > 0);
  `);
  plantNameColumnReady = true;
}

function serializePhoto(row) {
  if (!row) return null;
  return {
    id: row.id,
    url: `/api/garden-photos/${row.id}`,
    altText: row.alt_text || '',
    isPrimary: Boolean(row.is_primary),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function serializePlant(row, photos = []) {
  if (!row) return null;
  const serializedPhotos = photos.map(serializePhoto).filter(Boolean);
  const primaryPhoto = serializedPhotos.find((photo) => photo.isPrimary) || serializedPhotos[0] || null;
  return {
    id: row.id,
    plantName: row.plant_name,
    location: row.location || '',
    plantType: row.plant_type || '',
    aiAssessmentState: row.ai_assessment_state,
    aiCommonName: row.ai_common_name || '',
    aiScientificName: row.ai_scientific_name || '',
    aiConfidence: row.ai_confidence === null ? null : Number(row.ai_confidence),
    photoId: primaryPhoto?.id || row.primary_photo_id || null,
    photoUrl: primaryPhoto?.url || (row.primary_photo_id ? `/api/garden-photos/${row.primary_photo_id}` : ''),
    photos: serializedPhotos,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function listPhotosForPlant(db, plantId) {
  const { rows } = await db.query(
    `select id, alt_text, is_primary, created_at, updated_at
     from plant_id.garden_photos
     where plant_id = $1 and deleted_at is null
     order by is_primary desc, created_at asc`,
    [plantId]
  );
  return rows;
}

async function listPlants() {
  const db = requireDb();
  await ensurePlantNameColumn(db);
  const { rows } = await db.query(
    `select p.*,
      (select ph.id from plant_id.garden_photos ph where ph.plant_id = p.id and ph.deleted_at is null order by ph.is_primary desc, ph.created_at asc limit 1) as primary_photo_id
     from plant_id.garden_plants p
     where p.deleted_at is null
     order by p.updated_at desc`
  );
  return rows.map((row) => serializePlant(row));
}

async function getPlant(id) {
  const db = requireDb();
  await ensurePlantNameColumn(db);
  const { rows } = await db.query(
    `select p.*,
      (select ph.id from plant_id.garden_photos ph where ph.plant_id = p.id and ph.deleted_at is null order by ph.is_primary desc, ph.created_at asc limit 1) as primary_photo_id
     from plant_id.garden_plants p
     where p.id = $1 and p.deleted_at is null`,
    [id]
  );
  if (!rows[0]) return null;
  return serializePlant(rows[0], await listPhotosForPlant(db, id));
}

async function savePhotos(client, plantId, photos) {
  if (!photos.length) return;
  const { rows } = await client.query(
    `select exists (
       select 1 from plant_id.garden_photos
       where plant_id = $1 and deleted_at is null and is_primary = true
     ) as has_primary`,
    [plantId]
  );
  const hasPrimary = Boolean(rows[0]?.has_primary);
  for (const [index, photo] of photos.entries()) {
    await client.query(
      `insert into plant_id.garden_photos (id, plant_id, mime_type, byte_size, image_bytes, alt_text, is_primary)
       values ($1, $2, $3, $4, $5, $6, $7)`,
      [photo.id, plantId, photo.mimeType, photo.bytes.length, photo.bytes, photo.altText, !hasPrimary && index === 0]
    );
  }
}

async function createPlant(input = {}) {
  const plantName = cleanText(input.plantName || input.gardenName, 120);
  if (!plantName) {
    const error = new Error('Plant Name is required.');
    error.statusCode = 400;
    throw error;
  }

  const ai = normalizeAiAssessment(input.aiAssessment);
  const plantType = cleanText(input.plantType || ai.scientificName || ai.commonName || '', 180);
  const photos = normalizePhotos(input);
  const id = crypto.randomUUID();
  const db = requireDb();
  await ensurePlantNameColumn(db);
  const client = await db.connect();

  try {
    await client.query('begin');
    await client.query(
      `insert into plant_id.garden_plants (
        id, plant_name, location, plant_type, identity_source,
        ai_assessment_state, ai_common_name, ai_scientific_name, ai_confidence, ai_raw
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        id,
        plantName,
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
    await savePhotos(client, id, photos);
    await client.query('commit');
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }

  return getPlant(id);
}

async function updatePlant(id, input = {}) {
  const plantName = cleanText(input.plantName || input.gardenName, 120);
  if (!plantName) {
    const error = new Error('Plant Name is required.');
    error.statusCode = 400;
    throw error;
  }

  const photos = normalizePhotos(input);
  const db = requireDb();
  await ensurePlantNameColumn(db);
  const existingPlant = await getPlant(id);
  if (!existingPlant) return null;
  if ((existingPlant.photos?.length || 0) + photos.length > MAX_PHOTO_COUNT) {
    const error = new Error(`A plant can have up to ${MAX_PHOTO_COUNT} photos.`);
    error.statusCode = 400;
    throw error;
  }
  const client = await db.connect();

  try {
    await client.query('begin');
    const { rowCount } = await client.query(
      `update plant_id.garden_plants
       set plant_name = $2,
         location = $3,
         plant_type = $4,
         identity_source = case when plant_type is distinct from $4 then 'manual' else identity_source end,
         updated_at = now()
       where id = $1 and deleted_at is null`,
      [id, plantName, cleanText(input.location, 160), cleanText(input.plantType, 180)]
    );
    if (!rowCount) throw new Error('Plant not found.');
    await savePhotos(client, id, photos);
    await client.query('commit');
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }

  return getPlant(id);
}

async function addPlantPhotos(id, input = {}) {
  const photos = normalizePhotos(input);
  if (!photos.length) {
    const error = new Error('Choose at least one photo to add.');
    error.statusCode = 400;
    throw error;
  }

  const db = requireDb();
  await ensurePlantNameColumn(db);
  const plant = await getPlant(id);
  if (!plant) return null;
  if ((plant.photos?.length || 0) + photos.length > MAX_PHOTO_COUNT) {
    const error = new Error(`A plant can have up to ${MAX_PHOTO_COUNT} photos.`);
    error.statusCode = 400;
    throw error;
  }

  const client = await db.connect();
  try {
    await client.query('begin');
    await savePhotos(client, id, photos);
    await client.query('update plant_id.garden_plants set updated_at = now() where id = $1 and deleted_at is null', [id]);
    await client.query('commit');
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }

  return getPlant(id);
}

async function softDeletePhoto(photoId) {
  const db = requireDb();
  await ensurePlantNameColumn(db);
  const client = await db.connect();
  let plantId = null;

  try {
    await client.query('begin');
    const { rows } = await client.query(
      `update plant_id.garden_photos ph
       set deleted_at = now(), updated_at = now()
       from plant_id.garden_plants p
       where ph.id = $1 and ph.deleted_at is null and p.id = ph.plant_id and p.deleted_at is null
       returning ph.plant_id, ph.is_primary`,
      [photoId]
    );
    if (!rows[0]) {
      await client.query('rollback');
      return null;
    }
    plantId = rows[0].plant_id;
    if (rows[0].is_primary) {
      await client.query(
        `update plant_id.garden_photos
         set is_primary = true, updated_at = now()
         where id = (
           select id from plant_id.garden_photos
           where plant_id = $1 and deleted_at is null
           order by created_at asc
           limit 1
         )`,
        [plantId]
      );
    }
    await client.query('update plant_id.garden_plants set updated_at = now() where id = $1 and deleted_at is null', [plantId]);
    await client.query('commit');
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }

  return getPlant(plantId);
}

async function getPlantPhotosForIdentification(plantId, photoIds = []) {
  const db = requireDb();
  await ensurePlantNameColumn(db);
  const idFilter = Array.isArray(photoIds) && photoIds.length ? photoIds.map(String) : null;
  const { rows } = await db.query(
    `select ph.id, ph.mime_type, ph.image_bytes
     from plant_id.garden_photos ph
     join plant_id.garden_plants p on p.id = ph.plant_id
     where p.id = $1 and p.deleted_at is null and ph.deleted_at is null
       and ($2::uuid[] is null or ph.id = any($2::uuid[]))
     order by ph.is_primary desc, ph.created_at asc`,
    [plantId, idFilter]
  );
  return rows.map((row) => ({
    id: row.id,
    filename: `${row.id}.${row.mime_type.split('/')[1] || 'image'}`,
    mimeType: row.mime_type,
    buffer: Buffer.from(row.image_bytes),
  }));
}

async function updatePlantAiAssessment(id, result) {
  const ai = normalizeAiAssessment({
    state: 'ai_guess',
    commonName: result.commonName,
    scientificName: result.scientificName,
    confidence: result.confidence,
    raw: result,
  });
  const db = requireDb();
  await ensurePlantNameColumn(db);
  const { rowCount } = await db.query(
    `update plant_id.garden_plants
     set ai_assessment_state = $2,
       ai_common_name = $3,
       ai_scientific_name = $4,
       ai_confidence = $5,
       ai_raw = $6,
       plant_type = case when length(trim(plant_type)) = 0 then coalesce(nullif($4, ''), nullif($3, ''), plant_type) else plant_type end,
       identity_source = case when length(trim(plant_type)) = 0 then 'ai_initial' else identity_source end,
       updated_at = now()
     where id = $1 and deleted_at is null`,
    [id, ai.state, ai.commonName, ai.scientificName, ai.confidence, ai.raw]
  );
  if (!rowCount) return null;
  return getPlant(id);
}

async function softDeletePlant(id) {
  const db = requireDb();
  await ensurePlantNameColumn(db);
  const { rowCount } = await db.query(
    `update plant_id.garden_plants
     set deleted_at = now(),
       updated_at = now()
     where id = $1 and deleted_at is null`,
    [id]
  );
  return rowCount > 0;
}

async function getPhoto(photoId) {
  const db = requireDb();
  await ensurePlantNameColumn(db);
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
  addPlantPhotos,
  getPhoto,
  getPlant,
  getPlantPhotosForIdentification,
  listPlants,
  normalizeAiAssessment,
  normalizePhoto,
  normalizePhotos,
  softDeletePhoto,
  softDeletePlant,
  updatePlantAiAssessment,
  updatePlant,
  MAX_PHOTO_COUNT,
};
