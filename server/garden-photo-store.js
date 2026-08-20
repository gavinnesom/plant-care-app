const crypto = require("node:crypto");
const { requireDb } = require("./db");
const {
  MAX_AI_PHOTOS,
  cleanText,
  normalizePhotoPurpose,
  normalizeUploadedImage,
  validatePhotoIds,
} = require("./garden-validation");

function serializePhoto(row) {
  if (!row) return null;
  return {
    id: row.id,
    url: `/api/garden-photos/${row.id}`,
    altText: row.alt_text || "",
    purpose: normalizePhotoPurpose(row.purpose),
    isPrimary: Boolean(row.is_primary),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function listPhotoRows(db, plantId) {
  const { rows } = await db.query(
    `select id, alt_text, purpose, is_primary, created_at, updated_at
     from plant_id.garden_photos
     where plant_id = $1 and deleted_at is null
     order by is_primary desc, created_at asc`,
    [plantId],
  );
  return rows;
}

async function listPhotos(plantId, db = requireDb()) {
  return (await listPhotoRows(db, plantId)).map(serializePhoto);
}

async function saveUploadedPhoto(
  plantId,
  rawImage,
  altText = "",
  purpose = "identity_reference",
) {
  const image = normalizeUploadedImage(rawImage);
  const normalizedPurpose = normalizePhotoPurpose(purpose);
  const db = requireDb();
  const client = await db.connect();
  const id = crypto.randomUUID();

  try {
    await client.query("begin");
    const plantLock = await client.query(
      `select id from plant_id.garden_plants
       where id = $1 and deleted_at is null
       for update`,
      [plantId],
    );
    if (!plantLock.rows[0]) {
      const error = new Error("Plant not found.");
      error.statusCode = 404;
      throw error;
    }
    const photoState = await client.query(
      `select coalesce(bool_or(is_primary), false) as has_primary
       from plant_id.garden_photos
       where plant_id = $1 and deleted_at is null and purpose = 'identity_reference'`,
      [plantId],
    );
    const state = photoState.rows[0];

    await client.query(
      `insert into plant_id.garden_photos
        (id, plant_id, mime_type, byte_size, image_bytes, alt_text, purpose, is_primary)
       values ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        id,
        plantId,
        image.mimeType,
        image.buffer.length,
        image.buffer,
        cleanText(altText || image.filename, 240),
        normalizedPurpose,
        normalizedPurpose === "identity_reference" && !state.has_primary,
      ],
    );
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

  return { id, plantId };
}

async function softDeletePhoto(photoId) {
  const db = requireDb();
  const client = await db.connect();
  let plantId = null;

  try {
    await client.query("begin");
    const { rows } = await client.query(
      `update plant_id.garden_photos ph
       set deleted_at = now(), updated_at = now()
       from plant_id.garden_plants p
       where ph.id = $1 and ph.deleted_at is null
         and p.id = ph.plant_id and p.deleted_at is null
       returning ph.plant_id, ph.is_primary`,
      [photoId],
    );
    if (!rows[0]) {
      await client.query("rollback");
      return null;
    }
    plantId = rows[0].plant_id;
    if (rows[0].is_primary) {
      await client.query(
        `update plant_id.garden_photos
         set is_primary = true, updated_at = now()
         where id = (
           select id from plant_id.garden_photos
           where plant_id = $1 and deleted_at is null and purpose = 'identity_reference'
           order by created_at asc limit 1
         )`,
        [plantId],
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
  return plantId;
}

async function getPlantImages(
  plantId,
  rawPhotoIds,
  { required = false, purposes = [] } = {},
) {
  const photoIds = validatePhotoIds(rawPhotoIds, {
    required,
    max: MAX_AI_PHOTOS,
  });
  if (!photoIds.length) return [];
  const db = requireDb();
  const { rows } = await db.query(
    `select ph.id, ph.mime_type, ph.image_bytes
     from plant_id.garden_photos ph
     join plant_id.garden_plants p on p.id = ph.plant_id
     where p.id = $1 and p.deleted_at is null and ph.deleted_at is null
       and ph.id = any($2::uuid[])
       and (cardinality($3::text[]) = 0 or ph.purpose = any($3::text[]))
     order by ph.is_primary desc, ph.created_at asc`,
    [plantId, photoIds, purposes],
  );
  if (rows.length !== photoIds.length) {
    const error = new Error("One or more selected photos are unavailable.");
    error.statusCode = 400;
    throw error;
  }
  return rows.map((row) => ({
    id: row.id,
    filename: `${row.id}.${row.mime_type.split("/")[1] || "image"}`,
    mimeType: row.mime_type,
    buffer: Buffer.from(row.image_bytes),
  }));
}

async function getPhoto(photoId) {
  const db = requireDb();
  const { rows } = await db.query(
    `select ph.mime_type, ph.image_bytes
     from plant_id.garden_photos ph
     join plant_id.garden_plants p on p.id = ph.plant_id
     where ph.id = $1 and ph.deleted_at is null and p.deleted_at is null`,
    [photoId],
  );
  return rows[0] || null;
}

module.exports = {
  getPhoto,
  getPlantImages,
  listPhotos,
  saveUploadedPhoto,
  serializePhoto,
  softDeletePhoto,
};
