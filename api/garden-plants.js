const { requireGardenSession } = require("../server/garden-session");
const { createPlant, listPlants } = require("../server/garden-store");
const { gardenError, readJson } = require("../server/http");

module.exports = async function handler(req, res) {
  if (!requireGardenSession(req, res)) return null;

  try {
    if (req.method === "GET") {
      return res.status(200).json({ plants: await listPlants() });
    }

    if (req.method === "POST") {
      const body = await readJson(req);
      return res.status(201).json({ plant: await createPlant(body) });
    }

    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method not allowed." });
  } catch (error) {
    return gardenError(res, error);
  }
};
