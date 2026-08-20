const { expect, test } = require("@playwright/test");

test("public identification shell and Garden unlock remain usable", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Plants & Care" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Identify with AI" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Open My Garden" }).click();
  await expect(
    page.getByRole("heading", { name: "Unlock My Garden" }),
  ).toBeVisible();
  await expect(page.getByPlaceholder("Owner key")).toBeVisible();
});

test("private Garden API rejects an unauthenticated browser session", async ({
  request,
}) => {
  test.skip(
    process.env.PLAYWRIGHT_VERIFY_AUTH !== "1",
    "Enable against an unprotected production URL.",
  );
  const response = await request.get("/api/garden-plants");
  expect(response.status()).toBe(401);
});
