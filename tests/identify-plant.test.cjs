const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { extractJson, parseMultipartImage, validatePlantResult } = require('../server/plant-identification-core');

function validRawResult(overrides = {}) {
  return {
    commonName: 'Orange Tree',
    scientificName: 'Citrus sinensis',
    confidence: 0.72,
    identificationNotes: 'Glossy leaves and citrus fruit suggest an orange tree.',
    likelyAlternatives: [
      {
        commonName: 'Mandarin',
        scientificName: 'Citrus reticulata',
        reason: 'Similar leaves and fruit shape.',
      },
    ],
    care: {
      light: 'full_sun',
      water: 'moderate',
      soil: 'well_draining',
      difficulty: 'moderate',
      californiaSuitability: 'good',
      petSafety: 'caution',
    },
    sections: {
      overview: 'A citrus tree suited to warm patio conditions.',
      sunlight: 'Give full sun.',
      watering: 'Water deeply and let the top soil dry.',
      soil: 'Use a draining citrus mix.',
      californiaNotes: 'Protect from hard frost.',
      commonProblems: 'Watch for scale and leaf curl.',
      propagation: 'Usually grafted.',
      funFact: 'Orange trees can flower and fruit at the same time.',
    },
    ...overrides,
  };
}

test('extractJson accepts JSON wrapped in model prose', () => {
  const result = extractJson('Here is the result:\n{"commonName":"Orange Tree","confidence":0.72}');

  assert.equal(result.commonName, 'Orange Tree');
  assert.equal(result.confidence, 0.72);
});

test('parseMultipartImage extracts the uploaded image part', () => {
  const boundary = 'plant-id-boundary';
  const body = Buffer.from(
    [
      `--${boundary}`,
      'Content-Disposition: form-data; name="image"; filename="plant.webp"',
      'Content-Type: image/webp',
      '',
      'image-bytes',
      `--${boundary}--`,
      '',
    ].join('\r\n')
  );

  const image = parseMultipartImage(`multipart/form-data; boundary=${boundary}`, body);

  assert.equal(image.filename, 'plant.webp');
  assert.equal(image.mimeType, 'image/webp');
  assert.equal(image.buffer.toString(), 'image-bytes');
});

test('validatePlantResult trims strings, caps alternatives, and normalizes unknown enums', () => {
  const result = validatePlantResult(
    validRawResult({
      commonName: '  Orange Tree  ',
      likelyAlternatives: [
        {
          commonName: 'Mandarin',
          scientificName: 'Citrus reticulata',
          reason: 'Similar leaves.',
        },
        {
          commonName: 'Lemon',
          scientificName: 'Citrus limon',
          reason: 'Similar growth habit.',
        },
        {
          commonName: 'Lime',
          scientificName: 'Citrus aurantiifolia',
          reason: 'Similar evergreen foliage.',
        },
        {
          commonName: 'Kumquat',
          scientificName: 'Citrus japonica',
          reason: 'Similar small fruit.',
        },
      ],
      care: {
        light: 'impossible_light',
        water: 'too_much',
        soil: 'moon_dust',
        difficulty: 'legendary',
        californiaSuitability: 'unknown_region',
        petSafety: 'mystery',
      },
    })
  );

  assert.equal(result.commonName, 'Orange Tree');
  assert.equal(result.likelyAlternatives.length, 3);
  assert.deepEqual(result.care, {
    light: 'partial_sun',
    water: 'moderate',
    soil: 'well_draining',
    difficulty: 'moderate',
    californiaSuitability: 'good',
    petSafety: 'unknown',
  });
});

test('validatePlantResult rejects missing required care sections', () => {
  assert.throws(
    () =>
      validatePlantResult(
        validRawResult({
          sections: {
            overview: 'A plant.',
          },
        })
      ),
    /Invalid or missing sections\.sunlight/
  );
});

test('plant-identification core does not live in the Vercel API route directory', () => {
  const apiCorePath = path.join(__dirname, '..', 'api', 'plant-identification-core.js');

  assert.equal(fs.existsSync(apiCorePath), false);
});
