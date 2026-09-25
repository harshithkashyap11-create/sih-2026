import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import demoPacks from "../src/content/demo-packs.json" with { type: "json" };
const games = [
  "memory_match",
  "sequence_recall",
  "object_sorting",
  "tea_garden_attention",
  "bihu_rhythm_recall",
  "daily_life_sequencing",
  "familiar_place_recall",
  "who_is_this",
  "word_pairs",
  "festival_calendar",
  "sound_match",
  "spot_the_change",
].map((key) => ({ key, name: key.replaceAll("_", " "), domains: ["memory"] }));

test.use({ serviceWorkers: "block", actionTimeout: 10000 });

const patientId = "patient-a11y";
const memoryId = "memory-a11y";
const family = {
  id: "family-a11y",
  name: "Priya",
  relationship: "daughter",
  relationship_label: "Daughter",
  photo_url: "/content/demo/AS/place-1.svg",
  phone: "+911234567890",
  is_emergency_contact: true,
};
async function prepare(page: Page, theme: string) {
  const now = new Date().toISOString();
  const definitions = games.map((x) => ({
    key: x.key,
    name: x.name,
    cognitive_domains: x.domains,
    min_level: 1,
    max_level: 10,
    is_regional: true,
  }));
  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    let json: unknown = [];
    if (path.endsWith("/auth/patient/login/"))
      json = {
        access: "a11y-access",
        refresh: "a11y-refresh",
        user: {
          id: "a11y-user",
          role: "patient",
          display_name: "Rao",
          phone: "",
          email: "",
        },
      };
    else if (path.endsWith("/patients/"))
      json = {
        results: [{ id: patientId, name: "Rao", region: "AS", language: "en" }],
      };
    else if (path.endsWith("/orientation/"))
      json = {
        greeting_key: "morning",
        day: "Wednesday",
        date: "16 September",
        time: "8:00 AM",
        home_label: "Home",
        next_activity: null,
        family_member: family,
      };
    else if (path.includes("/content/pack")) json = demoPacks.AS;
    else if (path.endsWith("/games/")) json = definitions;
    else if (path.endsWith("/profile/"))
      json = { known_places: ["Home", "Garden"] };
    else if (path.endsWith("/family/")) json = [family];
    else if (path.endsWith("/memories/"))
      json = [
        {
          id: memoryId,
          title: "A day together",
          occasion: "Family",
          occurred_on: "2026-01-01",
          place: "Home",
          summary: "A happy day with Priya.",
          people: [family],
          media: [
            {
              id: "photo-a11y",
              kind: "photo",
              url: family.photo_url,
              caption: "Together",
              order: 0,
            },
          ],
        },
      ];
    else if (path.includes("/memory-quiz/"))
      json = {
        memory_id: memoryId,
        question_type: "who",
        prompt: "Who is this?",
        options: ["Priya", "Rao"],
        expected_label: "Priya",
        media_url: family.photo_url,
      };
    else if (path.endsWith("/reminders/"))
      json = [
        {
          id: "reminder-a11y",
          title: "Morning tablet",
          category: "medicine",
          note: "With water",
          scheduled_at: now,
          status: "pending",
          snoozed_until: null,
        },
      ];
    else if (path.endsWith("/medications/"))
      json = [
        {
          id: "medicine-a11y",
          name: "Morning tablet",
          dose: "As prescribed",
          times: ["08:00"],
          instructions: "With water",
          active: true,
        },
      ];
    else if (path.endsWith("/progress-summary/"))
      json = {
        completed_today: 1,
        points: 10,
        streak_days: 1,
        favourite_games: [],
        upcoming: [],
      };
    else if (path.includes("/difficulty/"))
      json = { level: 1, window: [], locked_by_doctor: false, cap_level: null };
    else if (path.endsWith("/sync/pull/"))
      json = {
        server_time: now,
        patient_id: patientId,
        records: {
          profile: [
            {
              id: patientId,
              name: "Rao",
              accessibility: { theme, font_scale: 1.6 },
            },
          ],
          checkins: [
            { id: "checkin-a11y", requested_by: "Priya", answer: null },
          ],
        },
      };
    else if (path.endsWith("/sync/push/"))
      json = {
        accepted: (
          route.request().postDataJSON() as {
            items: Array<{ outbox_id: string }>;
          }
        ).items.map((x: { outbox_id: string }) => ({
          outbox_id: x.outbox_id,
        })),
        rejected: [],
      };
    await route.fulfill({ json });
  });
  await page.goto("/login/patient");
  await page.getByLabel("Login ID").fill("RAO1234");
  for (const digit of "1234")
    await page.getByRole("button", { name: digit, exact: true }).click();
  await expect(page).toHaveURL(/(?<!login)\/patient$/);
  await expect(
    page.getByRole("heading", { name: /Good (morning|afternoon|evening)/ }),
  ).toBeVisible();
}
async function dismiss(page: Page) {
  const gotIt = page.getByRole("button", { name: "Got it", exact: true });
  if (await gotIt.isVisible()) await gotIt.click();
  await expect(page.getByRole("dialog", { name: "Instructions" })).toHaveCount(
    0,
  );
}
async function inspect(page: Page, label: string) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(results.violations, label).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
    `${label}: horizontal overflow`,
  ).toBeTruthy();
  expect(
    await page.evaluate(() => {
      const nav = document.querySelector(".patient-layout > nav");
      const sos = document.querySelector(".patient-sos-button");
      if (!nav || !sos) return true;
      const navBounds = nav.getBoundingClientRect();
      if (sos.getBoundingClientRect().bottom > navBounds.top) return false;
      return Array.from(nav.querySelectorAll<HTMLElement>("a, button")).every(
        (control) => {
          const controlBounds = control.getBoundingClientRect();
          if (
            controlBounds.left < navBounds.left ||
            controlBounds.right > navBounds.right
          )
            return false;
          return Array.from(
            control.querySelectorAll<HTMLElement>("span"),
          ).every((label) =>
            Array.from(label.getClientRects()).every(
              (rect) => rect.left >= 0 && rect.right <= window.innerWidth,
            ),
          );
        },
      );
    }),
    `${label}: navigation labels fit and do not overlap SOS`,
  ).toBeTruthy();
}
for (const theme of ["light", "dark"]) {
  test(`patient screens at 360px, font scale 1.6, ${theme}`, async ({
    page,
    context,
  }, info) => {
    test.setTimeout(90000);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.setViewportSize({ width: 360, height: 640 });
    await prepare(page, theme);
    const routes = [
      "",
      "routine",
      "medicines",
      "progress",
      "memories",
      `memories/${memoryId}`,
      "memories/quiz",
      "people",
      "games",
      "settings",
      "sleep",
      "calm",
      ...games.map((x) => `games/${x.key}`),
    ];
    for (const route of routes) {
      await page.evaluate(
        (url) => {
          history.pushState({}, "", url);
          window.dispatchEvent(new PopStateEvent("popstate"));
        },
        `/patient${route ? "/" + route : ""}`,
      );
      await expect(page.locator("main h1").first()).toBeVisible();
      await page.waitForTimeout(350);
      await dismiss(page);
      await page.evaluate((theme) => {
        document.documentElement.dataset.theme = theme;
        document.documentElement.dataset.fontScale = "1.6";
        document.documentElement.style.setProperty("--scale", "1.6");
      }, theme);
      expect(errors, `Runtime exceptions on ${route}`).toEqual([]);
      await expect(page).toHaveURL(`/patient${route ? "/" + route : ""}`);
      console.log(`Checking ${theme}: ${route || "home"}`);
      await inspect(page, route || "home");
    }
    await page
      .getByRole("button", { name: "Replay instructions", exact: true })
      .click();
    await inspect(page, "walkthrough dialog");
    await page.keyboard.press("Tab");
    await expect(
      page.getByRole("button", { name: "Got it", exact: true }),
    ).toBeFocused();
    await dismiss(page);
    await page
      .getByRole("button", {
        name: "I feel confused / I need a break",
        exact: true,
      })
      .click();
    await inspect(page, "break dialog");
    await page.getByRole("button", { name: "I am ready", exact: true }).click();
    await page.getByRole("button", { name: "SOS", exact: true }).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog")).toBeVisible();
    await inspect(page, "SOS confirmation");
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await context.setOffline(true);
    await page.evaluate(() => window.scrollTo(0, 0));
    await inspect(page, "offline shell");
    await page.screenshot({
      path: info.outputPath(`${theme}-360.png`),
      fullPage: false,
    });
  });
}
