import { expect, test, type Page } from "@playwright/test";

test.use({ serviceWorkers: "block" });

const DEMO_PASSWORD = "SmaranaDemo123!";

async function useSeededAuth(page: Page): Promise<void> {
  await page.route("**/api/v1/patients/", (route) =>
    route.fulfill({
      json: {
        results: [
          {
            id: "test-patient",
            name: "Rao",
            is_primary: true,
            last_active_at: null,
            pending_on_device: false,
          },
        ],
      },
    }),
  );
  await page.route("**/adherence/?days=7", (route) =>
    route.fulfill({ json: { days: [], summary: {} } }),
  );
  await page.route("**/api/v1/doctor/dashboard/", (route) =>
    route.fulfill({
      json: {
        patients: [],
        needs_attention: [],
        reviews_due: [],
        recent_completed: [],
      },
    }),
  );
  await page.route("**/api/v1/auth/login/", async (route) => {
    const body = route.request().postDataJSON() as {
      email_or_phone: string;
      password: string;
    };
    const users = {
      "priya@example.com": { display_name: "Priya", role: "caregiver" },
      "deka@example.com": { display_name: "Dr. Deka", role: "doctor" },
    } as const;
    const user = users[body.email_or_phone as keyof typeof users];

    if (!user || body.password !== DEMO_PASSWORD) {
      await route.fulfill({
        json: {
          code: "credentials_not_verified",
          detail: "credentials_not_verified",
        },
        status: 401,
      });
      return;
    }

    await route.fulfill({
      json: {
        access: `seed-access-${user.role}`,
        refresh: `seed-refresh-${user.role}`,
        user: {
          id: user.role === "caregiver" ? "caregiver-id" : "doctor-id",
          display_name: user.display_name,
          email: body.email_or_phone,
          phone: "",
          role: user.role,
        },
      },
      status: 200,
    });
  });
}

async function login(page: Page, role: "caregiver" | "doctor", email: string) {
  await page.goto(`/login/${role}`);
  await page.getByLabel("Email or phone").fill(email);
  await page.getByLabel("Password").fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
}

test.beforeEach(async ({ page }) => useSeededAuth(page));

test("seeded caregiver logs in and cannot open the doctor layout", async ({
  page,
}) => {
  await login(page, "caregiver", "priya@example.com");

  await expect(page).toHaveURL(/\/caregiver\/test-patient\/today$/);
  await expect(
    page.getByRole("heading", { name: "Rao", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Priya")).toBeVisible();

  await page.evaluate(() => {
    window.history.pushState({}, "", "/doctor");
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText("Gentle support for every day.")).toBeVisible();
});

test("seeded doctor logs in and sees the doctor layout", async ({ page }) => {
  await login(page, "doctor", "deka@example.com");

  await expect(page).toHaveURL(/\/doctor$/);
  await expect(page.getByRole("heading", { name: /patients/i })).toBeVisible();
  await expect(page.getByText("Dr. Deka")).toBeVisible();
});
