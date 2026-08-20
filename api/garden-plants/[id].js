const { requireGardenSession } = require('../../server/garden-session');
const { getPlant, softDeletePlant, updatePlant } = require('../../server/garden-store');

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

function getId(req) {
  const url = new URL(req.url, 'https://plants.gavinnesom.com');
  return decodeURIComponent(url.pathname.split('/').filter(Boolean).pop() || '');
}

module.exports = async function handler(req, res) {
  if (!requireGardenSession(req, res)) return null;

  try {
    const id = getId(req);
    if (req.method === 'GET') {
      const plant = await getPlant(id);
      if (!plant) return res.status(404).json({ error: 'Plant not found.' });
      return res.status(200).json({ plant });
    }

    if (req.method === 'PATCH') {
      const plant = await updatePlant(id, await readJson(req));
      if (!plant) return res.status(404).json({ error: 'Plant not found.' });
      return res.status(200).json({ plant });
    }

    if (req.method === 'DELETE') {
      const deleted = await softDeletePlant(id);
      if (!deleted) return res.status(404).json({ error: 'Plant not found.' });
      return res.status(200).json({ deleted: true });
    }

    res.setHeader('Allow', 'GET, PATCH, DELETE');
    return res.status(405).json({ error: 'Method not allowed.' });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      error: {
        code: error.code || 'garden_request_failed',
        message: error.statusCode && error.statusCode < 500 ? error.message : 'My Garden is temporarily unavailable.',
      },
    });
  }
};
