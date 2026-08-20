const { requireGardenSession } = require('../../server/garden-session');
const { getPhoto } = require('../../server/garden-store');

function getId(req) {
  const url = new URL(req.url, 'https://plants.gavinnesom.com');
  return decodeURIComponent(url.pathname.split('/').filter(Boolean).pop() || '');
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  if (!requireGardenSession(req, res)) return null;

  try {
    const photo = await getPhoto(getId(req));
    if (!photo) return res.status(404).json({ error: 'Photo not found.' });

    res.setHeader('Content-Type', photo.mime_type);
    res.setHeader('Cache-Control', 'private, max-age=300');
    return res.status(200).send(Buffer.from(photo.image_bytes));
  } catch {
    return res.status(500).json({
      error: {
        code: 'garden_photo_unavailable',
        message: 'Garden photo is temporarily unavailable.',
      },
    });
  }
};
