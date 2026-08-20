const assert = require('node:assert/strict');
const test = require('node:test');
const path = require('node:path');
const {
  UNLOCK_ATTEMPT_LIMIT,
  checkOwnerUnlockRateLimit,
  clearOwnerUnlockAttemptsForTests,
  createSessionCookie,
  recordFailedOwnerUnlock,
  validateOwnerKey,
  verifySession,
} = require('../server/garden-session');
const { createPlant, normalizeAiAssessment, normalizePhoto, updatePlant } = require('../server/garden-store');

function withEnv(nextEnv, fn) {
  const previous = {};
  for (const key of Object.keys(nextEnv)) {
    previous[key] = process.env[key];
    if (nextEnv[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = nextEnv[key];
    }
  }

  return Promise.resolve()
    .then(fn)
    .finally(() => {
      for (const [key, value] of Object.entries(previous)) {
        if (value === undefined) {
          delete process.env[key];
        } else {
          process.env[key] = value;
        }
      }
    });
}

test('owner key validation requires server-side configuration and exact key match', async () => {
  await withEnv({ PLANT_ID_OWNER_KEY: undefined, PLANT_ID_SESSION_SECRET: undefined }, () => {
    const result = validateOwnerKey('anything');
    assert.equal(result.ok, false);
    assert.equal(result.configError.status, 503);
  });

  await withEnv({ PLANT_ID_OWNER_KEY: 'correct-key', PLANT_ID_SESSION_SECRET: 'session-secret' }, () => {
    assert.equal(validateOwnerKey('wrong-key').ok, false);
    assert.equal(validateOwnerKey('correct-key').ok, true);
  });
});

test('garden session cookie verifies as a 30-day signed device session', async () => {
  await withEnv({ PLANT_ID_OWNER_KEY: 'correct-key', PLANT_ID_SESSION_SECRET: 'session-secret' }, () => {
    const cookie = createSessionCookie();
    assert.match(cookie, /Max-Age=2592000/);
    assert.match(cookie, /HttpOnly/);
    assert.match(cookie, /Secure/);
    assert.match(cookie, /SameSite=Lax/);

    const session = verifySession({ headers: { cookie } });
    assert.equal(session.ok, true);
    assert.ok(session.expiresAt > Date.now());
  });
});

test('garden session rejects tampered cookies', async () => {
  await withEnv({ PLANT_ID_OWNER_KEY: 'correct-key', PLANT_ID_SESSION_SECRET: 'session-secret' }, () => {
    const cookie = createSessionCookie().replace(/plant_id_garden_session=([^;]+)/, (_match, token) => {
      const tampered = `${token.slice(0, -1)}${token.endsWith('x') ? 'y' : 'x'}`;
      return `plant_id_garden_session=${tampered}`;
    });
    assert.equal(verifySession({ headers: { cookie } }).ok, false);
  });
});

test('AI assessment normalization keeps no-guess and AI guess separate', () => {
  assert.deepEqual(normalizeAiAssessment({ state: 'none' }), {
    state: 'none',
    commonName: '',
    scientificName: '',
    confidence: null,
    raw: null,
  });

  assert.deepEqual(
    normalizeAiAssessment({
      state: 'ai_guess',
      commonName: 'Cordyline',
      scientificName: 'Cordyline australis',
      confidence: 0.85,
      raw: { commonName: 'Cordyline' },
    }),
    {
      state: 'ai_guess',
      commonName: 'Cordyline',
      scientificName: 'Cordyline australis',
      confidence: 0.85,
      raw: { commonName: 'Cordyline' },
    }
  );
});

test('photo normalization accepts private image bytes without public URLs', () => {
  const photo = normalizePhoto({
    dataUrl: `data:image/png;base64,${Buffer.from('image-bytes').toString('base64')}`,
    altText: 'Patio plant',
  });

  assert.equal(photo.mimeType, 'image/png');
  assert.equal(photo.bytes.toString(), 'image-bytes');
  assert.equal(photo.altText, 'Patio plant');
  assert.equal(photo.isPrimary, true);
});

test('saved plants require Plant Name terminology before database work', async () => {
  await assert.rejects(() => createPlant({ plantName: '   ' }), /Plant Name is required/);
  await assert.rejects(() => updatePlant('plant-id', { plantName: '   ' }), /Plant Name is required/);
});

test('owner unlock throttles repeated bad guesses by request source', () => {
  clearOwnerUnlockAttemptsForTests();
  const req = { headers: { 'x-forwarded-for': '203.0.113.10' } };

  for (let index = 0; index < UNLOCK_ATTEMPT_LIMIT; index += 1) {
    assert.equal(checkOwnerUnlockRateLimit(req).allowed, true);
    recordFailedOwnerUnlock(req);
  }

  const limited = checkOwnerUnlockRateLimit(req);
  assert.equal(limited.allowed, false);
  assert.ok(limited.retryAfterSeconds > 0);
  clearOwnerUnlockAttemptsForTests();
});

test('soft deletion marks Garden records recoverably and normal listing excludes deleted rows', async () => {
  const dbPath = path.resolve(__dirname, '..', 'server', 'db.js');
  const storePath = path.resolve(__dirname, '..', 'server', 'garden-store.js');
  const previousDbCache = require.cache[dbPath];
  const previousStoreCache = require.cache[storePath];
  const queries = [];

  require.cache[dbPath] = {
    id: dbPath,
    filename: dbPath,
    loaded: true,
    exports: {
      getPool: () => ({
        query: async (sql, params) => {
          queries.push({ sql, params });
          if (sql.includes('information_schema.columns')) return { rows: [], rowCount: 0 };
          if (sql.includes('select p.*')) return { rows: [], rowCount: 0 };
          if (sql.includes('set deleted_at')) return { rows: [], rowCount: 1 };
          return { rows: [], rowCount: 0 };
        },
      }),
    },
  };
  delete require.cache[storePath];

  try {
    const { listPlants, softDeletePlant } = require('../server/garden-store');
    assert.equal(await softDeletePlant('plant-id'), true);
    await listPlants();

    assert.match(queries.find((query) => query.sql.includes('set deleted_at')).sql, /deleted_at = now\(\)/);
    assert.match(queries.find((query) => query.sql.includes('select p.*')).sql, /where p\.deleted_at is null/);
  } finally {
    if (previousDbCache) {
      require.cache[dbPath] = previousDbCache;
    } else {
      delete require.cache[dbPath];
    }
    if (previousStoreCache) {
      require.cache[storePath] = previousStoreCache;
    } else {
      delete require.cache[storePath];
    }
  }
});
