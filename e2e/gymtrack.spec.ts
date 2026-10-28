import { test, expect, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";

// Register a new test user and verify authentication.
async function register(page: Page) {
  await page.goto("/register");

  await page.getByLabel("Full name").fill("Test Athlete");

  await page
    .getByLabel("Email address")
    .fill(`test-${randomUUID()}@example.test`);

  await page.getByLabel("Password").fill("VeryStrong#2026");

  await page
    .getByRole("button", {
      name: "Create account",
    })
    .click();

  await expect(page).toHaveURL(/\/dashboard(?:\/)?$/, {
    timeout: 15000,
  });
}

// Test 1: User registration and dashboard.
test("register", async ({ page }) => {
  await register(page);

  await expect(
    page.getByRole("heading", {
      name: /Ready when you are, Test\./i,
    }),
  ).toBeVisible();

  await expect(page.getByText("YOUR TRAINING WORKSPACE")).toBeVisible();
});

// Test 2: Complete workout logging flow.
test("log a workout", async ({ page }) => {
  await register(page);

  // Create a workout plan.
  await page.goto("/plans/new");

  await page
    .getByRole("button", {
      name: "Save workout plan",
    })
    .click();

  await expect(page).toHaveURL(/\/plans(?:\/)?$/, {
    timeout: 15000,
  });

  // Activate the newly created plan.
  await page
    .getByRole("button", {
      name: "Activate plan",
    })
    .click();

  // Start the workout.
  await page
    .getByRole("button", {
      name: /Start workout/i,
    })
    .click();

  await expect(page).toHaveURL(/\/workouts\/[^/]+(?:\?.*)?$/, {
    timeout: 15000,
  });

  // Verify workout logger.
  await expect(
    page.getByRole("heading", {
      name: "Your exercises",
    }),
  ).toBeVisible();

  // Log the first set.
  await page
    .getByRole("button", {
      name: /Log set 1/i,
    })
    .first()
    .click();

  // Confirm the set was saved and synchronized.
  await expect(page.getByText(/1 confirmed working sets/i)).toBeVisible({
    timeout: 20000,
  });

  await expect(page.getByText("No pending sets")).toBeVisible({
    timeout: 15000,
  });

  // Accept the browser confirmation dialog.
  page.once("dialog", async (dialog) => {
    await dialog.accept();
  });

  // Complete the workout.
  await page
    .getByRole("button", {
      name: "Finish workout",
    })
    .click();

  // R4 redirects to the workout summary page.
  await expect(page).toHaveURL(/\/workouts\/[^/]+\/summary(?:\/)?$/, {
    timeout: 20000,
  });

  // Verify the completion summary.
  await expect(
    page.getByRole("heading", {
      name: /Nice work\. Session complete\./i,
    }),
  ).toBeVisible();

  await expect(page.getByText("Exercise breakdown")).toBeVisible();

  await expect(page.getByText("Working sets", { exact: true })).toBeVisible();

  // Verify navigation to workout history.
  await page
    .getByRole("link", {
      name: "Workout history",
    })
    .last()
    .click();

  await expect(page).toHaveURL(/\/workouts\/history(?:\/)?$/, {
    timeout: 15000,
  });
});

// Test 3: Progress and analytics page.
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
