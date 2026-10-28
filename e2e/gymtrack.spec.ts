import { test, expect, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";

async function register(page: Page) {
  await page.goto("/register");

  await page.getByLabel("Full name").fill("Test Athlete");

  await page
    .getByLabel("Email address")
    .fill(`test-${randomUUID()}@example.test`);

  await page.getByLabel("Password").fill("VeryStrong#2026");

  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page).toHaveURL(/\/dashboard/);
}

test("register", async ({ page }) => {
  await register(page);

  await expect(
    page.getByRole("heading", {
      name: /Ready when you are, Test/,
    }),
  ).toBeVisible();
});

test("log a workout", async ({ page }) => {
  await register(page);

  await page.goto("/plans/new");

  await page.getByRole("button", { name: "Save workout plan" }).click();

  await expect(page).toHaveURL(/\/plans/);

  await page.getByRole("button", { name: "Activate plan" }).click();

  await page.getByRole("button", { name: /Start workout/ }).click();

  await expect(page).toHaveURL(/\/workouts\//);

  await page
    .getByRole("button", { name: /Log set 1/ })
    .first()
    .click();

  await expect(page.getByText(/1 confirmed working sets/)).toBeVisible({
    timeout: 15000,
  });

  await page.getByRole("button", { name: "Finish workout" }).click();

  await expect(page).toHaveURL(/\/workouts\/[^/]+\/summary$/, {
    timeout: 15000,
  });

  await expect(
    page.getByRole("heading", {
      name: /Nice work\. Session complete\./,
    }),
  ).toBeVisible();
});

test("view progress", async ({ page }) => {
  await register(page);

  await page.goto("/dashboard/progress");

  await expect(
    page.getByRole("heading", {
      name: "Progress & insights",
    }),
  ).toBeVisible();

  await expect(page.getByText("Weekly training volume")).toBeVisible();
});
