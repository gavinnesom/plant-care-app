const ENUMS = {
  light: ['full_sun', 'partial_sun', 'partial_shade', 'shade'],
  water: ['dry', 'moderate', 'wet'],
  soil: ['well_draining', 'sandy', 'loamy', 'clay_tolerant'],
  difficulty: ['easy', 'moderate', 'fussy'],
  californiaSuitability: ['excellent', 'good', 'caution', 'poor'],
  petSafety: ['safe', 'caution', 'toxic', 'unknown'],
};

const REQUIRED_SECTIONS = [
  'overview',
  'sunlight',
  'watering',
  'soil',
  'californiaNotes',
  'commonProblems',
  'propagation',
  'funFact',
];

function indexOfBuffer(buffer, search, start = 0) {
  return buffer.indexOf(Buffer.from(search), start);
}

function splitMultipart(buffer, boundary) {
  const marker = Buffer.from(`--${boundary}`);
  const parts = [];
  let start = buffer.indexOf(marker);

  while (start !== -1) {
    start += marker.length;
    if (buffer[start] === 45 && buffer[start + 1] === 45) break;
    if (buffer[start] === 13 && buffer[start + 1] === 10) start += 2;

    let end = buffer.indexOf(marker, start);
    if (end === -1) break;

    let part = buffer.subarray(start, end);
    if (part[part.length - 2] === 13 && part[part.length - 1] === 10) {
      part = part.subarray(0, part.length - 2);
    }
    parts.push(part);
    start = end;
  }

  return parts;
}

function parseMultipartImage(contentType, body) {
  const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/);
  const boundary = boundaryMatch?.[1] || boundaryMatch?.[2];
  if (!boundary) throw new Error('Missing multipart boundary.');

  const parts = splitMultipart(body, boundary);
  for (const part of parts) {
    const headerEnd = indexOfBuffer(part, '\r\n\r\n');
    if (headerEnd === -1) continue;

    const headers = part.subarray(0, headerEnd).toString('utf8');
    const content = part.subarray(headerEnd + 4);
    const disposition = headers.match(/content-disposition:\s*([^\r\n]+)/i)?.[1] || '';
    const name = disposition.match(/name="([^"]+)"/)?.[1];
    const filename = disposition.match(/filename="([^"]*)"/)?.[1];
    const mimeType = headers.match(/content-type:\s*([^\r\n]+)/i)?.[1]?.trim().toLowerCase();

    if (name === 'image' && filename) {
      return { buffer: content, filename, mimeType };
    }
  }

  throw new Error('No image file was uploaded.');
}

function extractJson(text) {
  const trimmed = text.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) return JSON.parse(trimmed);

  const match = trimmed.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Model did not return JSON.');
  return JSON.parse(match[0]);
}

function requireString(value, label) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Invalid or missing ${label}.`);
  }
  return value.trim();
}

function normalizeEnum(value, options, fallback) {
  return options.includes(value) ? value : fallback;
}

function validatePlantResult(raw) {
  const confidence = Number(raw.confidence);
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
    throw new Error('Invalid confidence value.');
  }

  const care = raw.care || {};
  const sections = raw.sections || {};

  return {
    commonName: requireString(raw.commonName, 'commonName'),
    scientificName: requireString(raw.scientificName, 'scientificName'),
    confidence,
    identificationNotes: requireString(raw.identificationNotes, 'identificationNotes'),
    likelyAlternatives: Array.isArray(raw.likelyAlternatives)
      ? raw.likelyAlternatives.slice(0, 3).map((item) => ({
          commonName: requireString(item.commonName, 'alternative commonName'),
          scientificName: requireString(item.scientificName, 'alternative scientificName'),
          reason: requireString(item.reason, 'alternative reason'),
        }))
      : [],
    care: {
      light: normalizeEnum(care.light, ENUMS.light, 'partial_sun'),
      water: normalizeEnum(care.water, ENUMS.water, 'moderate'),
      soil: normalizeEnum(care.soil, ENUMS.soil, 'well_draining'),
      difficulty: normalizeEnum(care.difficulty, ENUMS.difficulty, 'moderate'),
      californiaSuitability: normalizeEnum(care.californiaSuitability, ENUMS.californiaSuitability, 'good'),
      petSafety: normalizeEnum(care.petSafety, ENUMS.petSafety, 'unknown'),
    },
    sections: Object.fromEntries(REQUIRED_SECTIONS.map((key) => [key, requireString(sections[key], `sections.${key}`)])),
  };
}

module.exports = {
  extractJson,
  parseMultipartImage,
  validatePlantResult,
};
