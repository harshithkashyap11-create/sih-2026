import { webcrypto } from "node:crypto";
import { beforeEach, expect, test, vi } from "vitest";

const state = vi.hoisted(() => ({
  values: new Map<string, string>(),
  bulkDelete: vi.fn((keys: string[]) => {
    keys.forEach((key) => state.values.delete(key));
    return Promise.resolve();
  }),
}));

vi.mock("./schema", () => ({
  db: { tables: [], meta: { bulkDelete: state.bulkDelete }, transaction: (_mode: string, _table: unknown, run: () => Promise<void>) => run() },
  migratePatientStorage: vi.fn().mockResolvedValue(undefined),
  getMeta: vi.fn((key: string) => Promise.resolve(state.values.get(key))),
  setMeta: vi.fn((key: string, value: string) => {
    state.values.set(key, value);
    return Promise.resolve();
  }),
}));

import {
  offlineLockedUntil,
  recordOfflineFailure,
  storeOfflineSecrets,
  changeOfflinePin,
  OfflinePinRecoveryRequired,
  unlockOffline,
  updateEncryptedRefreshToken,
} from "./crypto";

const patient = {
  id: "patient-user",
  display_name: "Rao Garu",
  email: "",
  phone: "",
  role: "patient" as const,
};

beforeEach(() => {
  state.values.clear();
  vi.stubGlobal("crypto", webcrypto);
});

test("stores an encrypted refresh token that only the correct PIN unlocks", async () => {
  await storeOfflineSecrets("1234", "refresh-token", patient);

  expect(await unlockOffline("9999")).toBeNull();
  await expect(unlockOffline("1234")).resolves.toEqual({
    refreshToken: "refresh-token",
    user: patient,
  });
  expect(state.values.get("refreshTokenEncrypted")).not.toContain(
    "refresh-token",
  );
});

test("reset PIN preserves the old data key until explicit recovery", async () => {
  await storeOfflineSecrets("1234", "first", patient);
  const original = state.values.get("pinVerifier");
  await expect(storeOfflineSecrets("5678", "new", patient)).rejects.toBeInstanceOf(OfflinePinRecoveryRequired);
  expect(state.values.get("pinVerifier")).toBe(original);
  await changeOfflinePin("1234", "5678", patient.id);
  await storeOfflineSecrets("5678", "new", patient);
  expect(await unlockOffline("1234")).toBeNull();
  expect(await unlockOffline("5678")).toEqual({ refreshToken: "new", user: patient });
});

test("re-encrypts a rotated refresh token for the next offline unlock", async () => {
  await storeOfflineSecrets("1234", "first-refresh", patient);
  await updateEncryptedRefreshToken("rotated-refresh");

  await expect(unlockOffline("1234")).resolves.toEqual({
    refreshToken: "rotated-refresh",
    user: patient,
  });
});

test("locks for fifteen minutes after five offline failures", async () => {
  const now = 1_000_000;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    await expect(recordOfflineFailure(now)).resolves.toBeNull();
  }
  await expect(recordOfflineFailure(now)).resolves.toBe(now + 15 * 60 * 1000);
  await expect(offlineLockedUntil(now + 1)).resolves.toBe(now + 15 * 60 * 1000);
  await expect(offlineLockedUntil(now + 15 * 60 * 1000)).resolves.toBeNull();
});
