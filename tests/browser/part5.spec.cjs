const { expect, test } = require("@playwright/test");
const AxeBuilder = require("@axe-core/playwright").default;

const plant = {
  id: "plant-1",
  plantName: "Big Red",
  location: "Patio table",
  plantType: "Cordyline",
  identitySource: "manual",
  aiCommonName: "Cordyline",
  aiScientificName: "Cordyline fruticosa",
  aiConfidence: 0.78,
  photoUrl: "/api/garden-photos/photo-1",
  photoCount: 2,
  photos: [
    {
      id: "photo-1",
      url: "/api/garden-photos/photo-1",
      altText: "Big Red healthy reference",
      purpose: "identity_reference",
      isPrimary: true,
    },
    {
      id: "photo-2",
      url: "/api/garden-photos/photo-2",
      altText: "Brown lower leaf",
      purpose: "observation_problem",
      isPrimary: false,
    },
  ],
  aiAssessment: {
    id: "assessment-1",
    confidence: 0.78,
    createdAt: "2026-08-20T12:00:00Z",
    result: {
      identificationNotes: "Leaf shape and color support this assessment.",
      likelyAlternatives: [],
    },
  },
  careGuide: {
    id: "care-1",
    guide: {
      summary: "Keep Big Red bright, evenly watered, and freely draining.",
      sunlight: "Bright filtered light with gentle morning sun.",
      watering: "Water when the top inch begins to dry.",
      soilDrainage: "Use an airy mix and an unobstructed drainage hole.",
      temperatureSeasonal: "Protect from cold and extreme afternoon heat.",
      feeding: "Feed lightly during active growth.",
      pruningMaintenance: "Remove fully brown lower leaves.",
      containerAdvice: "Do not let the pot stand in water.",
      propagation: "Stem cuttings can root in warm weather.",
      safety: "Verify toxicity before pet or child exposure.",
      watchFor: ["Persistently wet compost", "New leaf browning"],
    },
  },
  observations: [
    {
      id: "observation-1",
      description: "Lower leaves browning while compost stays wet.",
      observedAt: "2026-08-20T12:00:00Z",
      photoIds: ["photo-2"],
    },
  ],
  diagnosis: {
    id: "diagnosis-1",
    diagnosis: {
      summary: "Overwatering and slow drainage are the leading concerns.",
      confidence: 0.82,
      observedSymptoms: ["Browning lower leaves", "Wet compost"],
      likelyCauses: [
        {
          cause: "Slow drainage",
          likelihood: "high",
          rationale: "The compost remains wet for several days.",
        },
      ],
      recommendedActions: ["Allow the surface to dry", "Check drainage"],
      monitorNext: ["New growth", "Soil drying time"],
      urgentSafetyNotes: ["Verify toxicity around pets"],
      uncertainty: "Root condition has not been inspected.",
    },
  },
};

async function mockGarden(page) {
  let deleted = [
    {
      id: "deleted-1",
      plantName: "Patio Sage",
      plantType: "Salvia",
      photoCount: 1,
      deletedAt: "2026-08-20T10:00:00Z",
    },
  ];
  const pixel = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    "base64",
  );

  await page.route("**/api/garden-session", (route) =>
    route.fulfill({ status: 200, json: { unlocked: true } }),
  );
  await page.route("**/api/garden-photos/*", (route) =>
    route.fulfill({ status: 200, contentType: "image/png", body: pixel }),
  );
  await page.route("**/api/garden-plants?view=deleted", (route) =>
    route.fulfill({ status: 200, json: { plants: deleted } }),
  );
  await page.route("**/api/garden-plants/deleted-1", (route) => {
    deleted = [];
    return route.fulfill({ status: 200, json: { restored: true } });
  });
  await page.route("**/api/garden-plants/plant-1", (route) =>
    route.fulfill({ status: 200, json: { plant } }),
  );
  await page.route("**/api/garden-plants", (route) =>
    route.fulfill({ status: 200, json: { plants: [plant] } }),
  );
}

async function openPlant(page) {
  await mockGarden(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Open My Garden" }).click();
  await page.getByRole("button", { name: /Big Red/ }).click();
  await expect(page.getByRole("heading", { name: "Big Red" })).toBeVisible();
}

test("plant record is vertical, readable, accessible, and printable", async ({
  page,
}, testInfo) => {
  await openPlant(page);
  const names = [
    "Identity",
    "Care Guide",
    "Problems / Observations",
    "Diagnosis / Remediation",
  ];
  const tops = [];
  for (const name of names) {
    const heading = page.getByRole("heading", { name, exact: true });
    await expect(heading).toBeVisible();
    tops.push((await heading.boundingBox()).y);
  }
  expect(tops).toEqual([...tops].sort((a, b) => a - b));
  await expect(
    page.getByRole("button", { name: "Print / laminate guide" }),
  ).toBeVisible();

  const accessibility = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  expect(accessibility.violations).toEqual([]);
  await page.screenshot({
    path: testInfo.outputPath("plant-record-screen.png"),
    fullPage: true,
  });

  await page.emulateMedia({ media: "print" });
  await expect(page.locator(".print-page")).toHaveCount(2);
  await expect(page.locator(".print-sheet")).toBeVisible();
  await expect(page.locator(".garden-header-band")).toBeHidden();
  const pdf = await page.pdf({
    format: "Letter",
    printBackground: true,
    path: testInfo.outputPath("big-red-care-sheet.pdf"),
  });
  expect(pdf.length).toBeGreaterThan(10_000);
});

test("mobile plant page has no horizontal overflow and deleted plants restore", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openPlant(page);
  const overflow = await page.evaluate(
    () =>
      globalThis.document.documentElement.scrollWidth -
      globalThis.document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
  await page.screenshot({
    path: testInfo.outputPath("plant-record-mobile.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "My Garden" }).click();
  await page.getByRole("button", { name: "Recently deleted" }).click();
  await expect(page.getByRole("heading", { name: "Patio Sage" })).toBeVisible();
  await page.getByRole("button", { name: "Restore plant" }).click();
  await expect(page.getByRole("heading", { name: "Patio Sage" })).toBeHidden();
});
