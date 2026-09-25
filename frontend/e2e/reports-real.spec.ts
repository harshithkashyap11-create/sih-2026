import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

test.skip(
  process.env.SMARANA_REAL_BACKEND !== "1",
  "Requires the dedicated seeded backend",
);
test.use({ actionTimeout: 10000 });
const backend = process.env.SMARANA_BACKEND_URL ?? "http://127.0.0.1:8000";
test("caregiver check-in reaches patient, reply syncs and both portals download PDFs", async ({
  page,
  request,
}, info) => {
  test.setTimeout(90000);
  const session = await request.post(`${backend}/api/v1/auth/login/`, {
    data: {
      email_or_phone: "priya@example.com",
      password: "SmaranaDemo123!",
      device_id: "reports-e2e",
    },
  });
  expect(session.ok()).toBeTruthy();
  const { access } = (await session.json()) as { access: string };
  const headers = { Authorization: `Bearer ${access}` };
  const list = await request.get(`${backend}/api/v1/patients/`, { headers });
  const patientId = ((await list.json()) as { results: Array<{ id: string }> })
    .results[0]!.id;
  const checkin = await request.post(
    `${backend}/api/v1/patients/${patientId}/checkins/`,
    { headers },
  );
  expect(checkin.status()).toBe(201);
  const { id } = (await checkin.json()) as { id: string };
  await page.goto("/login/patient");
  await page.getByLabel("Login ID").fill("RAO1234");
  for (const digit of "1234")
    await page.getByRole("button", { name: digit, exact: true }).click();
  await expect(page).toHaveURL(/(?<!login)\/patient$/);
  const gotIt = page.getByRole("button", { name: "Got it", exact: true });
  if (await gotIt.isVisible()) await gotIt.click();
  await page.getByRole("button", { name: "I am okay", exact: true }).click();
  await expect
    .poll(async () => {
      const response = await request.get(
        `${backend}/api/v1/patients/${patientId}/checkins/`,
        { headers },
      );
      return (
        (await response.json()) as Array<{ id: string; answer: string }>
      ).find((x) => x.id === id)?.answer;
    })
    .toBe("okay");
  for (const [role, email] of [
    ["caregiver", "priya@example.com"],
    ["doctor", "deka@example.com"],
  ]) {
    await page.goto(`/login/${role}`);
    await page.getByLabel("Email or phone").fill(email!);
    await page.getByLabel("Password").fill("SmaranaDemo123!");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(
      page.getByRole("heading", {
        name: role === "caregiver" ? /^Rao$/ : /patients/i,
      }),
    ).toBeVisible();
    await page.evaluate(
      (path) => {
        window.history.pushState({}, "", path);
        window.dispatchEvent(new PopStateEvent("popstate"));
      },
      role === "caregiver"
        ? `/caregiver/${patientId}/reports`
        : `/doctor/patients/${patientId}/report`,
    );
    const downloadEvent = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "Download report", exact: true })
      .click();
    const download = await downloadEvent;
    const path = info.outputPath(`${role}-report.pdf`);
    await download.saveAs(path);
    expect((await readFile(path)).subarray(0, 5).toString()).toBe("%PDF-");
    if (role === "caregiver") {
      await page.emulateMedia({ media: "print" });
      await expect(
        page.getByRole("heading", { name: "Rao", exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("navigation", { name: "Caregiver sections" }),
      ).toBeHidden();
      await page.emulateMedia({ media: "screen" });
      const cardEvent = page.waitForEvent("download");
      await page
        .getByRole("button", { name: "Download emergency card", exact: true })
        .click();
      const card = await cardEvent;
      const cardPath = info.outputPath("emergency-card.pdf");
      await card.saveAs(cardPath);
      expect((await readFile(cardPath)).subarray(0, 5).toString()).toBe(
        "%PDF-",
      );
    }
    await page.getByRole("button", { name: "Log out", exact: true }).click();
  }
});
