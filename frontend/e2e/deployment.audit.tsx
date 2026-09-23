import "fake-indexeddb/auto";
import { webcrypto } from "node:crypto";
import { beforeEach, afterEach, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import { i18n } from "../src/shared/i18n";
import { MedicinesPage } from "../src/features/patient/medicines/MedicinesPage";
import { db, activatePatient, setSessionUser } from "../src/db/schema";
import { storeOfflineSecrets } from "../src/db/crypto";
import { lockVault } from "../src/db/vault";
import { privateMediaUrl, purgeUnreferencedMedia } from "../src/db/media";
import { gameCatalog } from "../src/games/registry";
import { routineRepository } from "../src/db/repo/routine";
import * as api from "../src/api/client";

beforeEach(async () => {
  vi.stubGlobal("crypto", webcrypto);
  lockVault();
  setSessionUser(null);
  await db.delete();
  await db.open();
  await i18n.changeLanguage("en");
});
afterEach(async () => {
  lockVault();
  await db.delete();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

test("stopped cached medicine must not appear as current medicine", async () => {
  const repo = {
    getMedications: () =>
      Promise.resolve([
        {
          id: "stopped",
          name: "Stopped prescription",
          dose: "1 tablet",
          times: ["08:00"],
          instructions: "Old instructions",
          active: false,
        },
      ]),
    getToday: () => Promise.resolve([]),
    respond: () => Promise.resolve(),
  };
  render(
    <I18nextProvider i18n={i18n}>
      <MedicinesPage repo={repo} />
    </I18nextProvider>,
  );
  await screen.findByRole("heading", { name: "My medicines" });
  await new Promise((resolve) => setTimeout(resolve, 30));
  expect(screen.queryByText("Stopped prescription")).not.toBeInTheDocument();
});

test("online medicine refresh removes omitted cached rows before going offline", async () => {
  const user = { id: "medicine-user", display_name: "Fictional patient", role: "patient" as const, email: "", phone: "" };
  await storeOfflineSecrets("1234", "fictional-token", user);
  setSessionUser(user.id);
  await activatePatient("medicine-patient", user.id);
  await db.profile.put({ id: "medicine-patient", userId: user.id, name: "Fixture", orientation: {}, refreshedAt: new Date().toISOString() });
  await db.medications.put({ id: "old", patientId: "medicine-patient", name: "Old medicine", dose: "1", times: ["08:00"], instructions: "", active: true });
  vi.spyOn(api, "apiClient").mockResolvedValue([]);
  expect(await routineRepository.getMedications()).toEqual([]);
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
  expect(await routineRepository.getMedications()).toEqual([]);
});

test("every enabled game has a real English instruction instead of a translation key", () => {
  const missing = gameCatalog
    .filter((g) => g.enabled && i18n.t(g.descriptionKey) === g.descriptionKey)
    .map((g) => g.descriptionKey);
  expect(missing).toEqual([]);
});

test("previously cached signed photo stays available offline after URL rotation", async () => {
  const user = {
    id: "audit-user",
    display_name: "Fictional audit",
    role: "patient" as const,
    email: "",
    phone: "",
  };
  await storeOfflineSecrets("1234", "fictional-token", user);
  setSessionUser(user.id);
  await activatePatient("audit-patient", user.id);
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:audit");
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response("fictional image", {
        headers: { "Content-Type": "image/png" },
      }),
    ),
  );
  const original = "https://private.example.test/photo.png?X-Amz-Signature=old";
  const rotated = "https://private.example.test/photo.png?X-Amz-Signature=new";
  expect(await privateMediaUrl(original)).toBe("blob:audit");
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
  expect(await privateMediaUrl(rotated)).toBe("blob:audit");
});

test("deleted photo metadata purges only unreferenced encrypted blobs", async () => {
  const user = { id: "purge-user", display_name: "Fictional patient", role: "patient" as const, email: "", phone: "" };
  await storeOfflineSecrets("1234", "fictional-token", user);
  setSessionUser(user.id);
  await activatePatient("purge-patient", user.id);
  const url = "https://private.example.test/photo.png?X-Amz-Signature=old";
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:purge");
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("fictional image")));
  await db.familyMembers.put({ id: "member", patientId: "purge-patient", name: "Fixture", relationship: "friend", photoUrl: url });
  await privateMediaUrl(url);
  await purgeUnreferencedMedia("purge-patient");
  expect(await db.memoryMedia.count()).toBe(1);
  await db.familyMembers.delete("member");
  await purgeUnreferencedMedia("purge-patient");
  expect(await db.memoryMedia.count()).toBe(0);
});

test("an expired uncached storage link renews through scoped metadata", async () => {
  const user = { id: "renew-user", display_name: "Fictional patient", role: "patient" as const, email: "", phone: "" };
  await storeOfflineSecrets("1234", "fictional-token", user);
  setSessionUser(user.id);
  await activatePatient("renew-patient", user.id);
  await db.profile.put({ id: "renew-patient", userId: user.id, name: "Fixture", orientation: {}, refreshedAt: new Date().toISOString() });
  const old = "https://private.example.test/photo.png?X-Amz-Signature=old";
  const renewed = "https://private.example.test/photo.png?X-Amz-Signature=new";
  vi.spyOn(api, "apiClient").mockImplementation((path) => Promise.resolve(path.includes("/family/") ? [{ photo_url: renewed }] : []));
  const fetch = vi.fn().mockResolvedValueOnce(new Response("expired", { status: 403 })).mockResolvedValueOnce(new Response("fictional image"));
  vi.stubGlobal("fetch", fetch);
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:renewed");
  expect(await privateMediaUrl(old)).toBe("blob:renewed");
  expect(fetch).toHaveBeenLastCalledWith(renewed, { cache: "no-store", credentials: "same-origin" });
});
