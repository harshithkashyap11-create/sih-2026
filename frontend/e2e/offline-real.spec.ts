import { readEncryptedRecords } from "./encrypted-db";
import { expect, test, type Page } from "@playwright/test";
import demoPacks from "../src/content/demo-packs.json" with { type: "json" };

test.skip(
  process.env.SMARANA_REAL_BACKEND !== "1",
  "Requires the dedicated seeded local/CI backend",
);
const backend = process.env.SMARANA_BACKEND_URL ?? "http://127.0.0.1:8000";
const records = readEncryptedRecords;
async function pin(page: Page) {
  for (const digit of "1234")
    await page.getByRole("button", { name: digit, exact: true }).click();
}
async function dismissInstructions(page: Page) {
  const dialog = page.getByRole("dialog", {
    name: "Instructions",
    exact: true,
  });
  if (await dialog.isVisible()) {
    await dialog.getByRole("button", { name: "Got it", exact: true }).click();
  }
  await expect(dialog).toHaveCount(0);
}

test("real reminder and completed offline game survive reload, upload, and replay", async ({
  page,
  context,
  request,
}) => {
  test.setTimeout(90_000);
  const patientLogin = await request.post(
    `${backend}/api/v1/auth/patient/login/`,
    {
      data: {
        login_id: "RAO1234",
        pin: "1234",
        device_id: `real-test-${Date.now()}`,
      },
    },
  );
  expect(patientLogin.ok()).toBeTruthy();
  const patientSession = (await patientLogin.json()) as { access: string };
  const patientHeaders = { Authorization: `Bearer ${patientSession.access}` };
  const patientList = await request.get(`${backend}/api/v1/patients/`, {
    headers: patientHeaders,
  });
  const patientId = (
    (await patientList.json()) as { results: Array<{ id: string }> }
  ).results[0]!.id;
  await page.goto("/login/patient");
  await page.getByLabel("Login ID").fill("RAO1234");
  await pin(page);
  await expect(page).toHaveURL(/(?<!login)\/patient$/);
  await expect(page.locator("main h1")).toBeVisible();
  await dismissInstructions(page);
  await expect
    .poll(async () => (await records(page, "routineItems")).length)
    .toBeGreaterThan(0);
  await page.getByRole("button", { name: /games/i }).click();
  await expect(
    page.getByRole("heading", { name: "Games", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Got it", exact: true }),
  ).toBeVisible();
  await dismissInstructions(page);
  await page.getByRole("link", { name: /^Familiar Place Recall/ }).click();
  await expect(
    page.getByRole("heading", { name: "Familiar Place Recall" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Home", exact: true }).click();
  await page.getByRole("button", { name: /routine/i }).click();
  await expect(
    page.getByRole("button", { name: "Got it", exact: true }),
  ).toBeVisible();
  await dismissInstructions(page);
  await expect(page.getByText("Morning tablet", { exact: true })).toBeVisible();
  await expect
    .poll(
      () => page.evaluate(() => Boolean(navigator.serviceWorker.controller)),
      { timeout: 30_000 },
    )
    .toBe(true);
  await context.setOffline(true);
  await page
    .getByRole("button", { name: "Taken", exact: true })
    .first()
    .click();
  await expect(
    page.getByText("Saved safely on this device.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Home", exact: true }).click();
  await page.getByRole("button", { name: /games/i }).click();
  await dismissInstructions(page);
  await page.getByRole("link", { name: /^Familiar Place Recall/ }).click();
  for (let round = 1; round <= 5; round++) {
    await expect(
      page.getByText(`Round ${round} of 5`, { exact: true }),
    ).toBeVisible();
    if (await page.getByRole("dialog").isVisible()) {
      await page
        .getByRole("button", { name: "Keep going", exact: true })
        .click();
    }
    const image = page.locator("main section img");
    let answer: string;
    if (await image.count()) {
      const src = await image.first().getAttribute("src");
      answer = demoPacks.AS.items.place.find(
        (item) => item.image_url === src,
      )!.title;
    } else
      answer = (await page.getByText(/^Find /).textContent())!
        .replace(/^Find /, "")
        .replace(/\.$/, "");
    await page.getByRole("button", { name: answer, exact: true }).click();
  }
  await expect(page.getByRole("button", { name: /Play again/ })).toBeVisible();
  const queued = await records(page, "outbox");
  const session = queued.find((item) => item.model === "game_session")!;
  const response = queued.find((item) => item.model === "reminder_response")!;
  expect(session).toBeTruthy();
  expect(response).toBeTruthy();
  expect(
    (await records(page, "gameSessions")).find((x) => x.id === session.objectId)
      ?.metrics,
  ).toMatchObject({ completed: true, rounds: 5 });
  const rawRows = await page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("smarana");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () =>
        reject(request.error ?? new Error("Database inspection failed"));
    });
    const stores = ["profile", "routineItems", "gameSessions", "outbox"];
    const rows = await Promise.all(
      stores.map(
        (store) =>
          new Promise<Array<Record<string, unknown>>>((resolve, reject) => {
            const request = database
              .transaction(store)
              .objectStore(store)
              .getAll();
            request.onsuccess = () =>
              resolve(request.result as Array<Record<string, unknown>>);
            request.onerror = () =>
              reject(request.error ?? new Error("Raw inspection failed"));
          }),
      ),
    );
    database.close();
    return rows.flat();
  });
  expect(rawRows.length).toBeGreaterThan(0);
  expect(rawRows.every((row) => Boolean(row.__sealed))).toBe(true);
  expect(JSON.stringify(rawRows)).not.toContain("Morning tablet");
  expect(JSON.stringify(rawRows)).not.toContain('"payload"');
  expect(JSON.stringify(rawRows)).not.toContain('"metrics"');
  await page.reload();
  await page.getByRole("button", { name: /Patient/ }).click();
  await page.getByLabel("Login ID").fill("RAO1234");
  await pin(page);
  await expect(page).toHaveURL(/(?<!login)\/patient$/);
  expect(
    (await records(page, "gameSessions")).some(
      (x) => x.id === session.objectId,
    ),
  ).toBeTruthy();
  expect(
    (await records(page, "reminderResponses")).some(
      (x) => x.id === response.objectId,
    ),
  ).toBeTruthy();
  await context.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect
    .poll(async () => (await records(page, "outbox")).length, {
      timeout: 15_000,
    })
    .toBe(0);
  const login = await request.post(`${backend}/api/v1/auth/login/`, {
    data: {
      email_or_phone: "priya@example.com",
      password: "SmaranaDemo123!",
      device_id: `care-test-${Date.now()}`,
    },
  });
  expect(login.ok()).toBeTruthy();
  const caregiver = (await login.json()) as { access: string };
  const readSessions = async () => {
    const result = await request.get(
      `${backend}/api/v1/patients/${patientId}/game-sessions/`,
      { headers: { Authorization: `Bearer ${caregiver.access}` } },
    );
    expect(result.ok()).toBeTruthy();
    return (await result.json()) as Array<{ id: string }>;
  };
  expect(
    (await readSessions()).filter((x) => x.id === session.objectId),
  ).toHaveLength(1);
  const items = queued
    .filter((x) =>
      ["reminder_response", "game_session"].includes(String(x.model)),
    )
    .map((x) => ({
      outbox_id: x.id,
      model: x.model,
      object_id: x.objectId,
      patient_id: patientId,
      payload: x.payload,
      idempotency_key: x.idempotencyKey,
    }));
  for (let repeat = 0; repeat < 2; repeat++) {
    const replay = await request.post(`${backend}/api/v1/sync/push/`, {
      headers: patientHeaders,
      data: { items },
    });
    expect((await replay.json()) as unknown).toMatchObject({ rejected: [] });
  }
  expect(
    (await readSessions()).filter((x) => x.id === session.objectId),
  ).toHaveLength(1);
  const pull = await request.get(`${backend}/api/v1/sync/pull/`, {
    headers: patientHeaders,
  });
  const synced = (await pull.json()) as {
    records: { reminder_responses: Array<{ id: string }> };
  };
  expect(
    synced.records.reminder_responses.filter((x) => x.id === response.objectId),
  ).toHaveLength(1);
  const adherence = await request.get(
    `${backend}/api/v1/patients/${patientId}/adherence/`,
    { headers: { Authorization: `Bearer ${caregiver.access}` } },
  );
  expect(JSON.stringify(await adherence.json())).toContain("taken");
});
