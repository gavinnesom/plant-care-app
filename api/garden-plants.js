const { requireGardenSession } = require('../server/garden-session');
const { createPlant, listPlants } = require('../server/garden-store');

function readJson(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    req.on('data', (chunk) => {
      total += chunk.length;
      if (total > 34 * 1024 * 1024) {
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

function handleError(res, error) {
  return res.status(error.statusCode || 500).json({
    error: {
      code: error.code || 'garden_request_failed',
      message: error.statusCode && error.statusCode < 500 ? error.message : 'My Garden is temporarily unavailable.',
    },
  });
}

module.exports = async function handler(req, res) {
  if (!requireGardenSession(req, res)) return null;

  try {
    if (req.method === 'GET') {
      return res.status(200).json({ plants: await listPlants() });
    }

    if (req.method === 'POST') {
      const body = await readJson(req);
      return res.status(201).json({ plant: await createPlant(body) });
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed.' });
  } catch (error) {
    return handleError(res, error);
  }
};
