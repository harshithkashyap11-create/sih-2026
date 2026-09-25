import { useAuthStore } from "../features/auth/authStore";
import { apiClient } from "../api/client";
import { db, getMeta, setMeta } from "./schema";
import {
  isFakeOffline,
  markAccepted,
  markRejected,
  markRetry,
  nextBatch,
} from "./outbox";

interface PushResult {
  accepted: Array<{ outbox_id: string }>;
  rejected: Array<{ outbox_id: string; code: string; message: string }>;
}
interface PullResult {
  server_time: string;
  patient_id: string;
  records: Record<string, Array<Record<string, unknown>>>;
}
export async function applyPull(
  records: PullResult["records"],
  patientId: string,
): Promise<void> {
  const reminders = records.reminders ?? [];
  const difficultyStates = records.difficulty_states ?? [];
  await db.transaction(
    "rw",
    [
      db.meta,
      db.profile,
      db.reminders,
      db.reminderResponses,
      db.routineItems,
      db.familyMembers,
      db.medications,
      db.memories,
      db.gameDefinitions,
      db.difficultyStates,
      db.outbox,
      db.sleepLogs,
      db.moodLogs,
    ],
    async () => {
      if ((await getMeta("patientId")) !== patientId) return;
      await setMeta(
        "exerciseAssignments",
        JSON.stringify(records.exercise_assignments ?? []),
      );
      for (const [key, model, table] of [
        ["sleep_logs", "sleep_log", db.sleepLogs],
        ["mood_logs", "mood_log", db.moodLogs],
      ] as const) {
        const pending = new Set(
          (await db.outbox.where("model").equals(model).toArray()).map(
            (x) => x.objectId,
          ),
        );
        for (const row of records[key] ?? [])
          if (!pending.has(String(row.id)))
            await table.put({
              ...row,
              id: String(row.id),
              patientId,
              deviceUpdatedAt: String(row.device_updated_at),
            });
      }
      const checkins = JSON.parse((await getMeta("checkins")) ?? "[]") as Array<
        Record<string, unknown>
      >;
      for (const row of records.checkins ?? []) {
        const index = checkins.findIndex((x) => x.id === row.id);
        if (index < 0) checkins.push(row);
        else {
          const pending = await db.outbox
            .where("model")
            .equals("checkin_response")
            .filter((x) => x.payload.checkin === row.id)
            .first();
          if (!pending) checkins[index] = row;
        }
      }
      await setMeta("checkins", JSON.stringify(checkins));
      const pendingReminderIds = new Set(
        (
          await db.outbox.where("model").equals("reminder_response").toArray()
        ).map((row) => String(row.payload.reminder_id)),
      );
      for (const profile of records.profile ?? []) {
        const existing = await db.profile.get(patientId);
        await db.profile.put({
          id: patientId,
          userId: await getMeta("patientUserId"),
          name: String(profile.name),
          orientation: existing?.orientation ?? {
            home_label: profile.home_label,
          },
          refreshedAt: new Date().toISOString(),
        });
        await setMeta(
          "gamePatient",
          JSON.stringify({
            id: patientId,
            region: profile.region || "AS",
            language: profile.language || "en",
            sessionCapMinutes: profile.session_cap_minutes ?? 20,
            maxDifficultyLevel: profile.max_difficulty_level ?? 5,
            knownPlaces: profile.known_places ?? [],
            useMemoriesInQuiz: profile.use_memories_in_quiz,
          }),
        );
        if (
          !(await db.outbox
            .where("model")
            .equals("patient_profile_favourites")
            .filter((row) => row.patientId === patientId)
            .count())
        )
          await setMeta("favourites", JSON.stringify(profile.favourites ?? []));
        const accessibility = profile.accessibility as
          Record<string, unknown> | undefined;
        if (!(await getMeta("accessibilityPending"))) {
          for (const [key, field] of [
            ["languageLocked", "language_locked"],
            ["slowSpeech", "slow_speech"],
          ])
            await setMeta(key!, accessibility?.[field!] ? "1" : "0");
          if (typeof accessibility?.font_scale === "number")
            await setMeta("fontScale", String(accessibility.font_scale));
          if (typeof accessibility?.theme === "string")
            await setMeta("theme", String(accessibility.theme));
        }
      }
      for (const item of records.reminder_responses ?? [])
        await db.reminderResponses.put({
          id: String(item.id),
          reminderId: String(item.reminder_id),
          action: String(item.action),
          respondedAt: String(item.responded_at),
        });
      for (const item of records.routine_items ?? [])
        await db.routineItems.put({
          id: String(item.id),
          patientId,
          title: String(item.title),
          category: String(item.category),
          time_of_day: String(item.time_of_day),
          days_of_week: item.days_of_week as number[],
          start_date: String(item.start_date),
          end_date: item.end_date as string | null,
          note: typeof item.note === "string" ? item.note : "",
        });
      for (const item of records.family_members ?? [])
        await db.familyMembers.put({
          id: String(item.id),
          patientId,
          name: String(item.name),
          relationship: String(item.relationship_label || item.relationship),
          photoUrl: item.photo_url as string | null,
          phone: typeof item.phone === "string" ? item.phone : "",
          isEmergencyContact: Boolean(item.is_emergency_contact),
        });
      for (const item of records.medications ?? [])
        await db.medications.put({
          id: String(item.id),
          patientId,
          name: String(item.name),
          dose: String(item.dose),
          times: item.times as string[],
          instructions: String(item.instructions),
          active: Boolean(item.active),
          start_date: item.start_date as string | null,
          end_date: item.end_date as string | null,
        });
      for (const item of records.memories ?? [])
        await db.memories.put({
          id: String(item.id),
          patientId,
          title: String(item.title),
          occasion: String(item.occasion),
          occurredOn: item.occurred_on as string | null,
          place: String(item.place),
          summary: String(item.summary),
          visibility: String(item.visibility),
          people: item.people as [],
          media: item.media as [],
        });
      for (const item of records.game_definitions ?? [])
        await db.gameDefinitions.put({
          key: String(item.key),
          name: String(item.name),
          cognitive_domains: item.cognitive_domains as string[],
          min_level: Number(item.min_level),
          max_level: Number(item.max_level),
          is_regional: Boolean(item.is_regional),
        });
      for (const item of records.deleted ?? []) {
        const table =
          item.model === "routine_items"
            ? db.routineItems
            : item.model === "family_members"
              ? db.familyMembers
              : item.model === "memories"
                ? db.memories
                : null;
        if (
          table &&
          (await table.get(String(item.id)))?.patientId === patientId
        )
          await table.delete(String(item.id));
        if (item.model === "routine_items") {
          // Deterministic IDs let us remove cached reminders of deleted rules.
          const { reminderIdFor, dayInTimezone } = await import("./reminders");
          const cached = await db.reminders
            .where("patientId")
            .equals(patientId)
            .toArray();
          for (const row of cached)
            if (
              row.id ===
              reminderIdFor(
                String(item.id),
                dayInTimezone(new Date(row.scheduled_at)),
              )
            )
              await db.reminders.delete(row.id);
        }
      }
      if (reminders.length)
        await db.reminders.bulkPut(
          reminders
            .filter((item) => !pendingReminderIds.has(String(item.id)))
            .map((item) => ({
              id: String(item.id),
              patientId,
              title: typeof item.title === "string" ? item.title : "",
              category:
                typeof item.category === "string" ? item.category : "custom",
              note: typeof item.note === "string" ? item.note : "",
              scheduled_at: String(item.scheduled_at),
              status: String(item.status),
              snoozed_until:
                typeof item.snoozed_until === "string"
                  ? item.snoozed_until
                  : null,
            })),
        );
      if (difficultyStates.length)
        await db.difficultyStates.bulkPut(
          difficultyStates.map((item) => ({
            id: String(item.id),
            patientId,
            gameKey: String(item.game_key),
            level: Number(item.level),
            window: Array.isArray(item.window) ? item.window : [],
            lockedByDoctor: Boolean(item.locked_by_doctor),
            capLevel: item.cap_level == null ? null : Number(item.cap_level),
            minLevel: Number(item.min_level),
            maxLevel: Number(item.max_level),
          })),
        );
    },
  );
}
let running: Promise<boolean> | null = null;
export function syncNow(): Promise<boolean> {
  if (!running)
    running = runSync().finally(() => {
      running = null;
    });
  return running;
}
async function runSync(): Promise<boolean> {
  if (
    isFakeOffline() ||
    (typeof navigator !== "undefined" && !navigator.onLine)
  )
    return false;
  const patientId = await getMeta("patientId");
  const userId = useAuthStore.getState().user?.id;
  if (
    !patientId ||
    (await getMeta("patientUserId")) !== userId ||
    useAuthStore.getState().role !== "patient"
  )
    return false;
  const batch = await nextBatch(new Date(), 50, patientId);
  const sameAccount = () =>
    useAuthStore.getState().user?.id === userId &&
    useAuthStore.getState().role === "patient";
  try {
    if (batch.length) {
      const result = await apiClient<PushResult>("/api/v1/sync/push/", {
        method: "POST",
        body: JSON.stringify({
          items: batch.map((x) => ({
            outbox_id: x.id,
            model: x.model,
            object_id: x.objectId,
            patient_id: x.patientId,
            payload: x.payload,
            idempotency_key: x.idempotencyKey,
          })),
        }),
      });
      if (!sameAccount()) return false;
      await markAccepted(result.accepted.map((x) => x.outbox_id));
      if (
        !(await db.outbox
          .where("model")
          .equals("accessibility")
          .filter((x) => x.patientId === patientId)
          .count())
      )
        await db.meta.delete(`patient:${patientId}:accessibilityPending`);
      const acceptedIds = new Set(
        result.accepted.map((item) => item.outbox_id),
      );
      const acceptedSessions = batch.filter(
        (item) => item.model === "game_session" && acceptedIds.has(item.id),
      );
      if (acceptedSessions.length)
        await db.gameSessions.bulkUpdate(
          acceptedSessions.map((item) => ({
            key: item.objectId,
            changes: { synced: true },
          })),
        );
      for (const item of result.rejected)
        await markRejected(item.outbox_id, item.code, item.message);
    }
    const since = await getMeta("lastPullAt");
    const pull = await apiClient<PullResult>(
      `/api/v1/sync/pull/${since ? `?since=${encodeURIComponent(since)}` : ""}`,
      { method: "GET" },
    );
    if (!sameAccount() || pull.patient_id !== patientId) return false;
    await applyPull(pull.records, patientId);
    if (
      (pull.records.deleted ?? []).some((row) =>
        ["memories", "family_members"].includes(String(row.model)),
      )
    ) {
      const { purgeUnreferencedMedia } = await import("./media");
      await purgeUnreferencedMedia(patientId);
    }
    if (typeof window !== "undefined")
      window.dispatchEvent(new Event("smarana:comfort-updated"));
    await setMeta("lastPullAt", pull.server_time);
    if ((await nextBatch(new Date(), 1, patientId)).length) return runSync();
    return true;
  } catch (error) {
    for (const item of batch)
      await markRetry(
        item.id,
        error instanceof Error ? error.message : "network",
      );
    return false;
  }
}
export function installSyncTriggers(): () => void {
  const run = () => {
    void syncNow();
  };
  const afterWrite = (
    _key: unknown,
    _value: unknown,
    transaction: { on: { (event: "complete", callback: () => void): void } },
  ) => {
    transaction.on("complete", run);
  };
  db.outbox.hook("creating", afterWrite);
  const sessionReady = () => {
    if (running) void running.finally(run);
    else run();
  };
  window.addEventListener("smarana:session-ready", sessionReady);
  window.addEventListener("online", run);
  document.addEventListener("visibilitychange", run);
  const timer = window.setInterval(run, 300_000);
  run();
  return () => {
    db.outbox.hook("creating").unsubscribe(afterWrite);
    window.removeEventListener("smarana:session-ready", sessionReady);
    window.removeEventListener("online", run);
    document.removeEventListener("visibilitychange", run);
    window.clearInterval(timer);
  };
}
export async function pendingOnDevice(): Promise<boolean> {
  return (await db.outbox.count()) > 0 || (await db.outboxDead.count()) > 0;
}
