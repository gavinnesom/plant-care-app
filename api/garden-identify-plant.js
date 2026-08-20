const { requireGardenSession } = require('../server/garden-session');
const { callOpenAIForPlant } = require('../server/plant-identification-core');
const { getPlantPhotosForIdentification, updatePlantAiAssessment } = require('../server/garden-store');

const LOW_CONFIDENCE_THRESHOLD = 0.68;

function readJson(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    req.on('data', (chunk) => {
      total += chunk.length;
      if (total > 64 * 1024) {
        reject(new Error('Request body is too large.'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(new Error('Request body must be JSON.'));
      }
    });
    req.on('error', reject);
  });
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  if (!requireGardenSession(req, res)) return null;

  try {
    const body = await readJson(req);
    const plantId = typeof body.plantId === 'string' ? body.plantId : '';
    const photoIds = Array.isArray(body.photoIds) ? body.photoIds.filter((id) => typeof id === 'string') : [];
    if (!plantId) return res.status(400).json({ error: 'Plant id is required.' });

    const images = await getPlantPhotosForIdentification(plantId, photoIds);
    if (!images.length) return res.status(400).json({ error: 'Choose at least one saved photo to identify.' });

    const result = await callOpenAIForPlant(images);
    const plant = await updatePlantAiAssessment(plantId, result);
    if (!plant) return res.status(404).json({ error: 'Plant not found.' });

    const warning =
      result.confidence < LOW_CONFIDENCE_THRESHOLD
        ? 'Low-confidence identification. Compare the alternatives and confirm with another source.'
        : '';

    return res.status(200).json({ plant, result, warning });
  } catch (error) {
    const status = error.statusCode || 500;
    console.error('[Plant ID Garden AI] Request failed', {
      status,
      name: error.name,
      message: error.message,
      boundary: error.boundary,
      stack: error.stack?.split('\n').slice(0, 3).join('\n'),
    });
    const message =
      status >= 500 && !error.exposeMessage
        ? 'Garden identification is temporarily unavailable. Check server logs and API key configuration.'
        : error.message;
    return res.status(status).json({ error: message });
  }
};
