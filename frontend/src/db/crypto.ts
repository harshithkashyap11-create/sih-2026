import type { UserSummary } from "../api/generated/models";

import { db, getMeta, setMeta, migratePatientStorage } from "./schema";
import { base64, unbase64, openVault, lockVault } from "./vault";

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const MAX_OFFLINE_FAILURES = 5;
const OFFLINE_LOCK_MS = 15 * 60 * 1000;

interface StoredSecrets {
  salt: string;
  verifierIv: string;
  verifier: string;
  tokenIv: string;
  revoked?: boolean;
  user?: UserSummary;
  owner?: string;
  wrappedKey?: string;
  keyIv?: string;
  encryptedUser?: string;
  userIv?: string;
}

let activeOfflineUserId: string | null = null;
let activeOfflineKey: CryptoKey | null = null;

export interface OfflineUnlock {
  refreshToken: string;
  user: UserSummary;
}
export class OfflinePinRecoveryRequired extends Error {
  constructor() {
    super("The previous device PIN is required to recover encrypted offline records.");
    this.name = "OfflinePinRecoveryRequired";
  }
}

function b64(data: ArrayBuffer | Uint8Array): string {
  return btoa(String.fromCharCode(...new Uint8Array(data)));
}

function bytes(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}

async function deriveKey(pin: string, salt: Uint8Array): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    "raw",
    encoder.encode(pin),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt as BufferSource,
      iterations: 210_000,
      hash: "SHA-256",
    },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function storeOfflineSecrets(
  pin: string,
  refreshToken: string,
  user: UserSummary,
): Promise<void> {
  lockOfflineStorage();
  const existingRaw = await getMeta("pinVerifier");
  const existing = existingRaw ? JSON.parse(existingRaw) as StoredSecrets : null;
  const existingOwner = existing?.owner ?? existing?.user?.id;
  const archivedRaw = await getMeta(`credential:${user.id}`);
  const previous = existingOwner === user.id ? existing : archivedRaw ? JSON.parse(archivedRaw) as StoredSecrets : null;
  // Never replace a key merely because a reset PIN passed server authentication.
  // Rewrapping requires the old PIN; unsynced records must remain recoverable.
  let rawKey: Uint8Array<ArrayBuffer>;
  let key: CryptoKey;
  let salt: Uint8Array;
  if (previous) {
    salt = bytes(previous.salt);
    key = await deriveKey(pin, salt);
    try {
      await crypto.subtle.decrypt({ name: "AES-GCM", iv: bytes(previous.verifierIv) as BufferSource }, key, bytes(previous.verifier) as BufferSource);
    } catch {
      throw new OfflinePinRecoveryRequired();
    }
    if (previous.wrappedKey && previous.keyIv) {
      rawKey = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: unbase64(previous.keyIv) }, key, unbase64(previous.wrappedKey)));
    } else rawKey = crypto.getRandomValues(new Uint8Array(32));
  } else {
    if (existing && !existing.wrappedKey && existingOwner !== user.id)
      throw new Error("Unlock the previous patient's legacy records before switching accounts");
    salt = crypto.getRandomValues(new Uint8Array(16));
    key = await deriveKey(pin, salt);
    rawKey = crypto.getRandomValues(new Uint8Array(32));
  }
  const dataKey = await crypto.subtle.importKey("raw", rawKey, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
  const verifierIv = crypto.getRandomValues(new Uint8Array(12));
  const tokenIv = crypto.getRandomValues(new Uint8Array(12));
  const keyIv = crypto.getRandomValues(new Uint8Array(12));
  const userIv = crypto.getRandomValues(new Uint8Array(12));
  const encrypt = (iv: Uint8Array, value: BufferSource) => crypto.subtle.encrypt({ name: "AES-GCM", iv: iv as BufferSource }, key, value);
  const metadata: StoredSecrets = {
    salt: b64(salt), verifierIv: b64(verifierIv),
    verifier: b64(await encrypt(verifierIv, encoder.encode("smarana-pin"))),
    tokenIv: b64(tokenIv), owner: user.id, keyIv: base64(keyIv),
    wrappedKey: base64(await encrypt(keyIv, rawKey)), userIv: base64(userIv),
    encryptedUser: base64(await encrypt(userIv, encoder.encode(JSON.stringify(user)))),
  };
  openVault(user.id, dataKey);
  const encryptedRefresh = b64(await encrypt(tokenIv, encoder.encode(refreshToken)));
  try {
    await db.transaction("rw", db.tables, async () => {
      await migratePatientStorage();
      if (existing && existingOwner) await setMeta(`credential:${existingOwner}`, JSON.stringify(existing));
      await setMeta("pinVerifier", JSON.stringify(metadata));
      await setMeta(`credential:${user.id}`, JSON.stringify(metadata));
      await setMeta("refreshTokenEncrypted", encryptedRefresh);
    });
  } catch (error) { lockVault(); throw error; }
  activeOfflineKey = key;
  activeOfflineUserId = user.id;
  if (typeof caches !== "undefined") {
    const { migrateLegacyMedia } = await import("./media");
    await migrateLegacyMedia();
  }
  await clearOfflineFailures();
}

export async function unlockOffline(
  pin: string,
): Promise<OfflineUnlock | null> {
  if (await offlineLockedUntil()) return null;
  lockOfflineStorage();
  const raw = await getMeta("pinVerifier");
  const encrypted = await getMeta("refreshTokenEncrypted");
  if (!raw || !encrypted) return null;
  try {
    const data = JSON.parse(raw) as StoredSecrets;
    if (data.revoked) return null;
    const key = await deriveKey(pin, bytes(data.salt));
    const verifier = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: bytes(data.verifierIv) as BufferSource },
      key,
      bytes(data.verifier) as BufferSource,
    );
    if (decoder.decode(verifier) !== "smarana-pin") return null;
    const token = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: bytes(data.tokenIv) as BufferSource },
      key,
      bytes(encrypted) as BufferSource,
    );
    const user = data.encryptedUser && data.userIv
      ? JSON.parse(decoder.decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv: unbase64(data.userIv) }, key, unbase64(data.encryptedUser)))) as UserSummary
      : data.user;
    if (!user) return null;
    if (data.wrappedKey && data.keyIv) {
      const rawKey = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unbase64(data.keyIv) }, key, unbase64(data.wrappedKey));
      openVault(user.id, await crypto.subtle.importKey("raw", rawKey, "AES-GCM", false, ["encrypt", "decrypt"]));
      await migratePatientStorage();
    } else {
      await storeOfflineSecrets(pin, decoder.decode(token), user);
    }
    activeOfflineKey = key;
    activeOfflineUserId = user.id;
    return { refreshToken: decoder.decode(token), user };
  } catch {
    lockOfflineStorage();
    return null;
  }
}

export async function updateEncryptedRefreshToken(
  refreshToken: string,
): Promise<void> {
  const raw = await getMeta("pinVerifier");
  if (!raw || !activeOfflineKey) return;
  const data = JSON.parse(raw) as StoredSecrets;
  if (activeOfflineUserId !== (data.owner ?? data.user?.id)) return;
  const tokenIv = crypto.getRandomValues(new Uint8Array(12));
  const encryptedToken = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: tokenIv },
    activeOfflineKey,
    encoder.encode(refreshToken),
  );
  const updated = JSON.stringify({ ...data, tokenIv: b64(tokenIv) });
  await db.transaction("rw", db.meta, async () => {
    await setMeta("pinVerifier", updated);
    await setMeta(`credential:${activeOfflineUserId}`, updated);
    await setMeta("refreshTokenEncrypted", b64(encryptedToken));
  });
}

export async function offlineLockedUntil(
  now = Date.now(),
): Promise<number | null> {
  const value = Number(await getMeta("offlineLockedUntil"));
  if (!Number.isFinite(value) || value <= now) {
    if (value) await clearOfflineFailures();
    return null;
  }
  return value;
}

export async function recordOfflineFailure(
  now = Date.now(),
): Promise<number | null> {
  const failures = Number(await getMeta("offlineFailures")) || 0;
  const next = failures + 1;
  await setMeta("offlineFailures", String(next));
  if (next < MAX_OFFLINE_FAILURES) return null;
  const lockedUntil = now + OFFLINE_LOCK_MS;
  await setMeta("offlineLockedUntil", String(lockedUntil));
  return lockedUntil;
}

export async function clearOfflineFailures(): Promise<void> {
  await db.meta.bulkDelete(["offlineFailures", "offlineLockedUntil"]);
}

export function lockOfflineStorage(): void {
  activeOfflineKey = null;
  activeOfflineUserId = null;
  lockVault();
}

// Logout locks retained ciphertext and preserves wrapped credentials and pending writes.
export function clearOfflineSecrets(): Promise<void> {
  lockOfflineStorage();
  return Promise.resolve();
}

export async function changeOfflinePin(oldPin: string, newPin: string, expectedUserId?: string): Promise<void> {
  const unlocked = await unlockOffline(oldPin);
  if (!unlocked) throw new Error("Current PIN is required to preserve offline records");
  if (expectedUserId && unlocked.user.id !== expectedUserId) {
    lockOfflineStorage();
    throw new Error("The previous PIN belongs to a different account");
  }
  const raw = await getMeta("pinVerifier");
  if (!raw) throw new Error("Offline credentials unavailable");
  const previous = JSON.parse(raw) as StoredSecrets;
  const oldKey = await deriveKey(oldPin, bytes(previous.salt));
  if (!previous.wrappedKey || !previous.keyIv) throw new Error("Migrate offline records before changing PIN");
  const rawKey = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unbase64(previous.keyIv) }, oldKey, unbase64(previous.wrappedKey));
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await deriveKey(newPin, salt);
  const encrypt = async (value: BufferSource) => {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    return { iv: base64(iv), value: base64(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, value)) };
  };
  const wrapped = await encrypt(rawKey);
  const verifier = await encrypt(encoder.encode("smarana-pin"));
  const user = await encrypt(encoder.encode(JSON.stringify(unlocked.user)));
  const token = await encrypt(encoder.encode(unlocked.refreshToken));
  const data: StoredSecrets = { owner: unlocked.user.id, salt: base64(salt), keyIv: wrapped.iv, wrappedKey: wrapped.value,
    verifierIv: verifier.iv, verifier: verifier.value, userIv: user.iv, encryptedUser: user.value, tokenIv: token.iv };
  await db.transaction("rw", db.meta, async () => {
    await setMeta("pinVerifier", JSON.stringify(data));
    await setMeta(`credential:${unlocked.user.id}`, JSON.stringify(data));
    await setMeta("refreshTokenEncrypted", token.value);
  });
  activeOfflineKey = key;
}

export async function revokeOfflineAccess(): Promise<void> {
  const raw = await getMeta("pinVerifier");
  if (raw) await setMeta("pinVerifier", JSON.stringify({ ...JSON.parse(raw) as StoredSecrets, revoked: true }));
  lockOfflineStorage();
}
