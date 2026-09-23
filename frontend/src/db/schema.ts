import Dexie, { type EntityTable } from "dexie";
import { encryptedStorage, allowLegacyMigration, sensitive } from "./encryptedStorage";
import { lockVault, vaultOwner } from "./vault";

export interface MetaEntry {
  key: string;
  value: string;
}

export type SyncModel =
  | "patient_profile_favourites"
  | "accessibility"
  | "reminder_response"
  | "game_session"
  | "difficulty_state"
  | "difficulty_change"
  | "memory_quiz_attempt"
  | "sleep_log"
  | "mood_log"
  | "checkin_response"
  | "sos_event"
  | "routine_item";
export interface OutboxEntry {
  id: string;
  model: SyncModel;
  objectId: string;
  patientId: string;
  payload: Record<string, unknown>;
  idempotencyKey: string;
  createdAt: string;
  attempts: number;
  nextAttemptAt: string;
  lastError?: string;
}
export interface DeadLetterEntry extends OutboxEntry {
  rejectedAt: string;
  code: string;
}
export interface CachedGenericRecord {
  id: string;
  patientId: string;
  deviceUpdatedAt: string;
  [key: string]: unknown;
}

export interface CachedPatientProfile {
  id: string;
  name: string;
  orientation: unknown;
  userId?: string;
  refreshedAt: string;
}

export interface CachedFamilyMember {
  id: string;
  patientId: string;
  name: string;
  relationship: string;
  photoUrl: string | null;
  phone?: string;
  isEmergencyContact?: boolean;
}

export interface CachedMemory {
  id: string;
  patientId: string;
  title: string;
  occasion: string;
  occurredOn: string | null;
  place: string;
  summary: string;
  visibility?: string;
  people: Array<{ id: string; name: string; relationship: string }>;
  media: Array<{
    id: string;
    kind: string;
    url: string | null;
    caption: string;
  }>;
}

export interface CachedQuizAttempt {
  id: string;
  patientId: string;
  memoryId: string | null;
  questionType: string;
  expected: string;
  given: string;
  correct: boolean;
  attemptedAt: string;
  responseMs: number;
  idempotencyKey: string;
}

export interface CachedRoutineItem {
  id: string;
  patientId: string;
  title: string;
  category: string;
  time_of_day: string;
  days_of_week?: number[];
  start_date?: string;
  end_date?: string | null;
  note?: string;
}
export interface CachedReminder {
  id: string;
  patientId: string;
  title: string;
  category: string;
  note: string;
  scheduled_at: string;
  status: string;
  snoozed_until: string | null;
}
export interface CachedReminderResponse {
  id: string;
  reminderId: string;
  action: string;
  respondedAt: string;
}
export interface CachedMedication {
  start_date?: string | null;
  end_date?: string | null;
  id: string;
  patientId: string;
  name: string;
  dose: string;
  times: string[];
  instructions: string;
  active: boolean;
}
export interface CachedGameSession {
  guestMode?: boolean;
  id: string;
  patientId: string;
  gameKey: string;
  seed: string;
  level: number;
  metrics: Record<string, unknown>;
  challengeMode: boolean;
  startedAt: string;
  endedAt: string;
  synced: boolean;
}
export interface CachedGameDefinition {
  key: string;
  name: string;
  cognitive_domains: string[];
  min_level: number;
  max_level: number;
  is_regional: boolean;
}
export interface CachedDifficultyState {
  id: string;
  patientId: string;
  gameKey: string;
  level: number;
  window: unknown[];
  lockedByDoctor: boolean;
  capLevel: number | null;
  minLevel: number;
  maxLevel: number;
}
export interface CachedDifficultyChange {
  id: string;
  stateId: string;
  sessionId: string;
  fromLevel: number;
  toLevel: number;
  reasonCode: string;
  explanation: string;
}

class SmaranaDatabase extends Dexie {
  meta!: EntityTable<MetaEntry, "key">;
  profile!: EntityTable<CachedPatientProfile, "id">;
  familyMembers!: EntityTable<CachedFamilyMember, "id">;
  routineItems!: EntityTable<CachedRoutineItem, "id">;
  reminders!: EntityTable<CachedReminder, "id">;
  reminderResponses!: EntityTable<CachedReminderResponse, "id">;
  medications!: EntityTable<CachedMedication, "id">;
  memories!: EntityTable<CachedMemory, "id">;
  quizAttempts!: EntityTable<CachedQuizAttempt, "id">;
  gameDefinitions!: EntityTable<CachedGameDefinition, "key">;
  gameSessions!: EntityTable<CachedGameSession, "id">;
  difficultyStates!: EntityTable<CachedDifficultyState, "id">;
  difficultyChanges!: EntityTable<CachedDifficultyChange, "id">;
  memoryMedia!: EntityTable<CachedGenericRecord, "id">;
  sleepLogs!: EntityTable<CachedGenericRecord, "id">;
  moodLogs!: EntityTable<CachedGenericRecord, "id">;
  sosEvents!: EntityTable<CachedGenericRecord, "id">;
  contentPacks!: EntityTable<CachedGenericRecord, "id">;
  outbox!: EntityTable<OutboxEntry, "id">;
  outboxDead!: EntityTable<DeadLetterEntry, "id">;

  constructor() {
    super("smarana");
    this.version(1).stores({ meta: "&key" });
    this.version(2).stores({
      meta: "&key",
      profile: "&id, refreshedAt",
      familyMembers: "&id, patientId",
    });
    this.version(3).stores({
      meta: "&key",
      profile: "&id, refreshedAt",
      familyMembers: "&id, patientId",
      routineItems: "&id, patientId",
      reminders: "&id, patientId, scheduled_at",
      reminderResponses: "&id, reminderId",
      medications: "&id, patientId",
    });
    this.version(4).stores({
      meta: "&key",
      profile: "&id, refreshedAt",
      familyMembers: "&id, patientId",
      routineItems: "&id, patientId",
      reminders: "&id, patientId, scheduled_at",
      reminderResponses: "&id, reminderId",
      medications: "&id, patientId",
      memories: "&id, patientId",
      quizAttempts: "&id, patientId, attemptedAt, idempotencyKey",
    });
    this.version(5).stores({
      meta: "&key",
      profile: "&id, refreshedAt",
      familyMembers: "&id, patientId",
      routineItems: "&id, patientId",
      reminders: "&id, patientId, scheduled_at",
      reminderResponses: "&id, reminderId",
      medications: "&id, patientId",
      memories: "&id, patientId",
      quizAttempts: "&id, patientId, attemptedAt, idempotencyKey",
      gameSessions: "&id, patientId, gameKey, synced",
      difficultyStates: "&id, [patientId+gameKey]",
      difficultyChanges: "&id, stateId, sessionId",
    });
    this.version(6).stores({
      meta: "&key",
      profile: "&id, refreshedAt",
      familyMembers: "&id, patientId",
      routineItems: "&id, patientId",
      reminders: "&id, patientId, scheduled_at",
      reminderResponses: "&id, reminderId",
      medications: "&id, patientId",
      memories: "&id, patientId",
      memoryMedia: "&id, patientId",
      quizAttempts: "&id, patientId, attemptedAt, idempotencyKey",
      gameSessions: "&id, patientId, gameKey, synced",
      difficultyStates: "&id, [patientId+gameKey]",
      difficultyChanges: "&id, stateId, sessionId",
      sleepLogs: "&id, patientId, deviceUpdatedAt",
      moodLogs: "&id, patientId, deviceUpdatedAt",
      sosEvents: "&id, patientId, deviceUpdatedAt",
      contentPacks: "&id, patientId",
      outbox: "&id, createdAt, nextAttemptAt, model, objectId",
      outboxDead: "&id, rejectedAt, model",
    });
    this.use(encryptedStorage);
    this.version(7).stores({
      gameDefinitions: "&key",
    });
  }
}

export const db = new SmaranaDatabase();

const scopedKeys = new Set([
  "checkins",
  "memoryEngagement",
  "exerciseAssignments",
  "favourites",
  "walkthroughSeen",
  "lastPullAt",
  "gamePatient",
  "languageLocked",
  "slowSpeech",
  "fontScale",
  "theme",
  "quiz-resume",
  "accessibilityPending",
]);

export async function metadataKey(key: string): Promise<string> {
  if (!scopedKeys.has(key)) return key;
  const patientId = (await db.meta.get("patientId"))?.value;
  const owner = (await db.meta.get("patientUserId"))?.value;
  return patientId && owner === sessionUserId
    ? `patient:${patientId}:${key}`
    : `unassigned:${sessionUserId ?? "anonymous"}:${key}`;
}
export async function getMeta(key: string): Promise<string | undefined> {
  return (await db.meta.get(await metadataKey(key)))?.value;
}
export async function setMeta(key: string, value: string): Promise<void> {
  await db.meta.put({ key: await metadataKey(key), value });
}
let sessionUserId: string | null = null;
export function setSessionUser(userId: string | null): void {
  if (vaultOwner() && vaultOwner() !== userId) lockVault();
  sessionUserId = userId;
}
export async function activeProfile(): Promise<
  CachedPatientProfile | undefined
> {
  const id = await getMeta("patientId");
  if (!sessionUserId || (await getMeta("patientUserId")) !== sessionUserId)
    return undefined;
  return id ? db.profile.get(id) : undefined;
}
export async function activatePatient(
  patientId: string,
  userId: string,
): Promise<void> {
  // Adopt legacy metadata only when its offline credential proves the owner.
  const secrets = await getMeta("pinVerifier");
  let legacyOwner: string | undefined;
  try {
    legacyOwner = secrets
      ? (JSON.parse(secrets) as { user?: { id?: string } }).user?.id
      : undefined;
  } catch {
    /* Ignore invalid legacy credentials. */
  }
  await db.transaction("rw", db.meta, async () => {
    if (legacyOwner === userId) {
      for (const key of scopedKeys) {
        const old = await db.meta.get(key);
        const scoped = `patient:${patientId}:${key}`;
        if (old && !(await db.meta.get(scoped)))
          await db.meta.put({ key: scoped, value: old.value });
      }
    }
    for (const key of scopedKeys) await db.meta.delete(key);
    await db.meta.put({ key: "patientId", value: patientId });
    await db.meta.put({ key: "patientUserId", value: userId });
  });
  if (typeof window !== "undefined")
    window.dispatchEvent(new Event("smarana:session-ready"));
}

/** Rewrites legacy rows atomically only after the previous offline owner authenticates. */
export async function migratePatientStorage(): Promise<void> {
  if (!vaultOwner()) throw new Error("Offline storage is locked");
  await db.transaction("rw", db.tables, async () => {
    allowLegacyMigration(true);
    try {
      for (const table of db.tables) {
        if (table.name === "gameDefinitions") continue;
        const rows = await table.toArray() as Array<Record<string, unknown>>;
        for (const row of rows) {
          if (!sensitive(table.name, row)) continue;
          if (row.userId && row.userId !== vaultOwner())
            throw new Error("Legacy data must be unlocked by its owner before switching accounts");
          await table.put(row);
        }
      }
    } finally { allowLegacyMigration(false); }
  });
}
/** Explicit deletion cannot silently discard pending or rejected writes. */
export async function deleteLocalPatientData(discardPending = false): Promise<void> {
  if (!discardPending && ((await db.outbox.count()) || (await db.outboxDead.count())))
    throw new Error("Sync or explicitly discard pending records before deleting local data");
  await db.transaction("rw", db.tables, async () => {
    for (const table of db.tables) if (table.name !== "gameDefinitions") await table.clear();
  });
  const { lockOfflineStorage } = await import("./crypto");
  lockOfflineStorage();
  setSessionUser(null);
  if (typeof window !== "undefined") window.dispatchEvent(new Event("smarana:vault-locked"));
  if (typeof caches !== "undefined") await caches.delete("smarana-media");
}
