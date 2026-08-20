const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const {
  UNLOCK_ATTEMPT_LIMIT,
  checkOwnerUnlockRateLimit,
  clearOwnerUnlockAttemptsForTests,
  createSessionCookie,
  recordFailedOwnerUnlock,
  validateOwnerKey,
  verifySession,
} = require("../server/garden-session");
const {
  CARE_GUIDE_SCHEMA,
  DIAGNOSIS_SCHEMA,
} = require("../server/garden-ai-core");
const {
  createObservation,
  saveAiAssessment,
  saveCareGuide,
  saveDiagnosis,
} = require("../server/garden-record-store");
const {
  MAX_AI_PHOTOS,
  normalizeIdentitySource,
  normalizePhotoPurpose,
  normalizeUploadedImage,
  validatePhotoIds,
} = require("../server/garden-validation");

const root = path.resolve(__dirname, "..");

function source(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function fakeRecordDb() {
  const queries = [];
  const client = {
    query: async (sql, params) => {
      queries.push({ sql, params, boundary: "client" });
      if (sql.includes("select id from plant_id.garden_plants")) {
        return { rows: [{ id: "plant-id" }], rowCount: 1 };
      }
      return { rows: [], rowCount: 1 };
    },
    release: () => {},
  };
  return {
    queries,
    query: async (sql, params) => {
      queries.push({ sql, params, boundary: "pool" });
      if (sql.includes("from plant_id.observations o")) {
        return {
          rows: [
            {
              id: "observation-id",
              description: "Leaves yellowing",
              observed_at: "2026-08-20T12:00:00Z",
              photo_ids: [],
            },
          ],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 0 };
    },
    connect: async () => client,
  };
}

function withEnv(nextEnv, fn) {
  const previous = {};
  for (const key of Object.keys(nextEnv)) {
    previous[key] = process.env[key];
    if (nextEnv[key] === undefined) delete process.env[key];
    else process.env[key] = nextEnv[key];
  }
  return Promise.resolve()
    .then(fn)
    .finally(() => {
      for (const [key, value] of Object.entries(previous)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    });
}

test("owner key validation requires server configuration and an exact match", async () => {
  await withEnv(
    { PLANT_ID_OWNER_KEY: undefined, PLANT_ID_SESSION_SECRET: undefined },
    () => {
      const result = validateOwnerKey("anything");
      assert.equal(result.ok, false);
      assert.equal(result.configError.status, 503);
    },
  );
  await withEnv(
    {
      PLANT_ID_OWNER_KEY: "correct-key",
      PLANT_ID_SESSION_SECRET: "session-secret",
    },
    () => {
      assert.equal(validateOwnerKey("wrong-key").ok, false);
      assert.equal(validateOwnerKey("correct-key").ok, true);
    },
  );
});

test("garden session cookie verifies as a 30-day signed device session", async () => {
  await withEnv(
    {
      PLANT_ID_OWNER_KEY: "correct-key",
      PLANT_ID_SESSION_SECRET: "session-secret",
    },
    () => {
      const cookie = createSessionCookie();
      assert.match(cookie, /Max-Age=2592000/);
      assert.match(cookie, /HttpOnly/);
      assert.match(cookie, /Secure/);
      assert.equal(verifySession({ headers: { cookie } }).ok, true);
      const tampered = cookie.replace(
        /plant_id_garden_session=([^;]+)/,
        (_match, token) => {
          const replacement = token.endsWith("x") ? "y" : "x";
          return `plant_id_garden_session=${token.slice(0, -1)}${replacement}`;
        },
      );
      assert.equal(verifySession({ headers: { cookie: tampered } }).ok, false);
    },
  );
});

test("owner unlock throttles repeated bad guesses by request source", () => {
  clearOwnerUnlockAttemptsForTests();
  const req = { headers: { "x-forwarded-for": "203.0.113.10" } };
  for (let index = 0; index < UNLOCK_ATTEMPT_LIMIT; index += 1) {
    assert.equal(checkOwnerUnlockRateLimit(req).allowed, true);
    recordFailedOwnerUnlock(req);
  }
  assert.equal(checkOwnerUnlockRateLimit(req).allowed, false);
  clearOwnerUnlockAttemptsForTests();
});

test("photo purpose and identity source use explicit extensible values", () => {
  assert.equal(
    normalizePhotoPurpose("identity_reference"),
    "identity_reference",
  );
  assert.equal(
    normalizePhotoPurpose("observation_problem"),
    "observation_problem",
  );
  assert.equal(normalizePhotoPurpose("progress_history"), "progress_history");
  assert.equal(normalizePhotoPurpose("unknown"), "identity_reference");
  assert.equal(normalizeIdentitySource("ai_accepted"), "ai_accepted");
  assert.equal(normalizeIdentitySource("label_confirmed"), "label_confirmed");
});

test("the five-photo limit belongs to one AI request, not saved plant storage", () => {
  const five = Array.from(
    { length: MAX_AI_PHOTOS },
    (_, index) => `photo-${index}`,
  );
  assert.deepEqual(validatePhotoIds(five), five);
  assert.throws(() => validatePhotoIds([...five, "photo-6"]), /one AI request/);
  assert.doesNotMatch(
    source("server/garden-photo-store.js"),
    /MAX_SAVED_PHOTOS|photo count limit/i,
  );
});

test("uploaded photos require bounded bytes and a matching image signature", () => {
  const png = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00,
  ]);
  const normalized = normalizeUploadedImage({
    mimeType: "image/png",
    buffer: png,
    filename: "leaf.png",
  });
  assert.equal(normalized.mimeType, "image/png");
  assert.throws(
    () =>
      normalizeUploadedImage({
        mimeType: "image/png",
        buffer: Buffer.from("not-png"),
      }),
    /does not match/,
  );
});

test("saved plant metadata validates Plant Name before database work", async () => {
  const { createPlant, updatePlant } = require("../server/garden-store");
  await assert.rejects(
    () => createPlant({ plantName: "   " }),
    /Plant Name is required/,
  );
  await assert.rejects(
    () => updatePlant("plant-id", { plantName: "   " }),
    /Plant Name is required/,
  );
});

test("AI reassessment appends provenance without overwriting a non-empty Plant Type", async () => {
  const db = fakeRecordDb();
  await saveAiAssessment(
    "plant-id",
    {
      commonName: "Cordyline",
      scientificName: "Cordyline australis",
      confidence: 0.84,
    },
    { model: "test-model" },
    db,
  );

  const insert = db.queries.find(({ sql }) =>
    sql.includes("insert into plant_id.ai_assessments"),
  );
  const update = db.queries.find(({ sql }) =>
    sql.includes("current_ai_assessment_id"),
  );
  assert.ok(insert);
  assert.match(
    update.sql,
    /plant_type = case when length\(trim\(plant_type\)\) = 0/,
  );
  assert.match(update.sql, /else plant_type end/);
  assert.equal(insert.params[6], "test-model");
});

test("care regeneration preserves versions and moves the current pointer explicitly", async () => {
  const db = fakeRecordDb();
  await saveCareGuide(
    "plant-id",
    { summary: "First" },
    { plantType: "Cordyline" },
    {},
    db,
  );
  await saveCareGuide(
    "plant-id",
    { summary: "Second" },
    { plantType: "Cordyline" },
    {},
    db,
  );

  assert.equal(
    db.queries.filter(({ sql }) =>
      sql.includes("insert into plant_id.care_guides"),
    ).length,
    2,
  );
  assert.equal(
    db.queries.filter(({ sql }) => sql.includes("current_care_guide_id"))
      .length,
    2,
  );
});

test("observations and diagnoses persist as distinct linked records", async () => {
  const db = fakeRecordDb();
  await createObservation("plant-id", { description: "Leaves yellowing" }, db);
  await saveDiagnosis(
    "plant-id",
    { summary: "Possible overwatering" },
    { observations: [{ id: "observation-id" }] },
    { observationIds: ["observation-id"] },
    db,
  );

  assert.ok(
    db.queries.some(({ sql }) =>
      sql.includes("insert into plant_id.observations"),
    ),
  );
  assert.ok(
    db.queries.some(({ sql }) =>
      sql.includes("insert into plant_id.diagnoses"),
    ),
  );
  assert.ok(
    db.queries.some(({ sql }) =>
      sql.includes("insert into plant_id.diagnosis_observations"),
    ),
  );
});

test("garden runtime code contains no schema DDL", () => {
  const runtime = [
    source("server/garden-store.js"),
    source("server/garden-photo-store.js"),
    source("server/garden-record-store.js"),
  ]
    .join("\n")
    .toLowerCase();
  assert.doesNotMatch(runtime, /alter table|create table|information_schema/);
});

test("Part 4 migration persists purpose-aware AI, care, observation, and diagnosis history", () => {
  const migration = source(
    "supabase/migrations/202608200004_plant_id_part_4_records.sql",
  );
  for (const table of [
    "ai_assessments",
    "care_guides",
    "observations",
    "diagnoses",
  ]) {
    assert.match(
      migration,
      new RegExp(`create table if not exists plant_id\\.${table}`),
    );
  }
  assert.match(
    migration,
    /identity_reference.*observation_problem.*progress_history/s,
  );
  assert.ok(
    migration.indexOf("values ('client'") <
      migration.indexOf("values ('global'"),
  );
});

test("care and diagnosis use strict structured-output schemas", () => {
  assert.equal(CARE_GUIDE_SCHEMA.additionalProperties, false);
  assert.ok(CARE_GUIDE_SCHEMA.required.includes("watering"));
  assert.equal(DIAGNOSIS_SCHEMA.additionalProperties, false);
  assert.deepEqual(
    DIAGNOSIS_SCHEMA.properties.likelyCauses.items.properties.likelihood.enum,
    ["high", "medium", "low"],
  );
});

test("garden photo persistence is multipart and observation diagnosis stays purpose-aware", () => {
  assert.match(
    source("api/garden-plants/[id]/photos.js"),
    /multipart\/form-data/,
  );
  assert.doesNotMatch(
    source("api/garden-plants.js"),
    /34 \* 1024 \* 1024|dataUrl/,
  );
  assert.match(
    source("api/garden-plants/[id]/diagnoses.js"),
    /observation_problem/,
  );
  assert.match(source("api/garden-identify-plant.js"), /identity_reference/);
});

test("deleted plants remain separate and can be restored without deleting related records", async () => {
  const { listDeletedPlants, restorePlant } = require("../server/garden-store");
  const queries = [];
  const db = {
    query: async (sql, params) => {
      queries.push({ sql, params });
      if (
        sql.includes("deleted_at is not null") &&
        sql.includes("select p.*")
      ) {
        return {
          rows: [
            {
              id: "plant-id",
              plant_name: "Big Red",
              plant_type: "Cordyline",
              identity_source: "manual",
              ai_assessment_state: "none",
              photo_count: 2,
              deleted_at: "2026-08-20T18:00:00Z",
              created_at: "2026-08-19T18:00:00Z",
              updated_at: "2026-08-20T18:00:00Z",
            },
          ],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 1 };
    },
  };

  const deleted = await listDeletedPlants(db);
  assert.equal(deleted.length, 1);
  assert.equal(deleted[0].deletedAt, "2026-08-20T18:00:00Z");
  assert.equal(deleted[0].photoCount, 2);
  assert.equal(await restorePlant("plant-id", db), true);

  const restore = queries.find(({ sql }) =>
    sql.includes("set deleted_at = null"),
  );
  assert.ok(restore);
  assert.doesNotMatch(restore.sql, /delete from/i);
  assert.deepEqual(restore.params, ["plant-id"]);
  assert.match(source("api/garden-plants.js"), /view.*deleted/s);
  assert.match(source("api/garden-plants/[id].js"), /restorePlant/);
});

test("Part 5 plant record and print layout preserve the required reading order", () => {
  const views = source("src/features/garden/GardenViews.jsx");
  const print = source("src/features/garden/PlantPrintView.jsx");
  const headings = [
    "Identity",
    "Care Guide",
    "Problems / Observations",
    "Diagnosis / Remediation",
  ];
  for (let index = 1; index < headings.length; index += 1) {
    assert.ok(
      views.indexOf(headings[index - 1]) < views.indexOf(headings[index]),
    );
  }
  assert.equal((print.match(/className="print-page/g) || []).length, 2);
  assert.match(source("src/index.css"), /@page[\s\S]*size: Letter portrait/);
  assert.match(
    source("src/index.css"),
    /\.screen-only[\s\S]*display: none !important/,
  );
});
