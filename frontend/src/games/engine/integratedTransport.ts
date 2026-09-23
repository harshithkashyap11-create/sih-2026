import { apiClient } from "../../api/client";
import { db, getMeta, setMeta, type CachedGameSession } from "../../db/schema";
import { getDifficulty, persistLocalResult, type GameDefinitionDto } from "../../db/repo/games";
import { isFakeOffline } from "../../db/outbox";
import { syncNow } from "../../db/sync";
import { type DdaResult } from "../dda";

export interface PerformanceEvent {
  game_id: string; difficulty: number; accuracy: number; reaction_time_ms: number;
  errors: number; hints_used: number; completed: boolean; early_exit: boolean;
  session_duration_sec: number; rounds_completed: number; timestamp: string;
  meta?: Record<string, unknown>; game_metadata?: Record<string, unknown>;
  fatigue_flags?: string[];
}
export function sessionMetrics(event: PerformanceEvent) {
  return { accuracy: event.accuracy, mean_reaction_ms: event.reaction_time_ms,
    mistakes: event.errors, hints_used: event.hints_used, rounds: event.rounds_completed,
    duration_ms: event.session_duration_sec * 1000, completed: event.completed && !event.early_exit,
    abandoned_reason: event.early_exit ? "user_exit" : null, fatigue_flags: event.fatigue_flags ?? [],
    raw_events: [{ ...event }] };
}
export function createIntegratedTransport(patientId: string, game: GameDefinitionDto, guestMode = false,
  options: { sessionCapMinutes?: number; onFatigue?: () => void } = {}) {
  let id = crypto.randomUUID();
  let startedAt = new Date().toISOString();
  let finished = false;
  let latest: PerformanceEvent | null = null;
  let observedRounds = 0;
  let observedErrors = 0;
  let consecutiveErrorRounds = 0;
  let saving: Promise<{ adjustment: number; source: string }> | null = null;
  let queue: Promise<{ adjustment: number; source: string }> = Promise.resolve({ adjustment: 0, source: "idle" });
  const enqueue = (event: PerformanceEvent) => {
    queue = queue.catch(() => ({ adjustment: 0, source: "offline" })).then(() => submit(event));
    return queue;
  };
  const checkpointKey = () => `integrated-game:${patientId}:${game.key}`;
  async function submit(event: PerformanceEvent): Promise<{ adjustment: number; source: string }> {
    if (event.game_id !== game.key) throw new Error("Mismatched game event");
    if (finished) return { adjustment: 0, source: "saved" };
    const fatigue = [...(event.fatigue_flags ?? [])];
    if (event.session_duration_sec >= (options.sessionCapMinutes ?? 20) * 60) fatigue.push("session_cap");
    if (event.rounds_completed > observedRounds) {
      consecutiveErrorRounds = event.rounds_completed === observedRounds + 1 && event.errors > observedErrors
        ? consecutiveErrorRounds + 1 : 0;
      observedRounds = event.rounds_completed;
      observedErrors = event.errors;
    }
    if (consecutiveErrorRounds >= 4) fatigue.push("consecutive_mistakes");
    if (fatigue.length) {
      event = { ...event, fatigue_flags: [...new Set(fatigue)], early_exit: true, completed: false };
      options.onFatigue?.();
    }
    if (saving) {
      await saving;
      return finished ? { adjustment: 0, source: "saved" } : submit(event);
    }
    latest = event;
    await setMeta(checkpointKey(), JSON.stringify({ id, startedAt, event, guestMode }));
    if (!event.completed && !event.early_exit) {
      if (guestMode || isFakeOffline() || !navigator.onLine) return { adjustment: 0, source: "offline" };
      try {
        const response = await apiClient<{ adjustment: number }>("/api/v1/game-events/", {
          method: "POST", signal: AbortSignal.timeout(4000),
          body: JSON.stringify({ ...event, id: crypto.randomUUID(), session_id: id }),
        });
        const adjustment = [-1, 0, 1].includes(response?.adjustment) ? response.adjustment : 0;
        return { adjustment, source: "server" };
      } catch { return { adjustment: 0, source: "offline" }; }
    }
    saving = (async () => {
      const state = await getDifficulty(patientId, game);
      const session: CachedGameSession = { id, patientId, gameKey: game.key, seed: id,
        level: Math.max(game.min_level, Math.min(game.max_level, event.difficulty)),
        challengeMode: false, guestMode, startedAt, endedAt: new Date().toISOString(),
        synced: false, metrics: sessionMetrics(event) };
      // Backend owns adaptation; unavailable transport conservatively holds difficulty.
      const held: DdaResult = { state, change: { fromLevel: state.level, toLevel: state.level,
        reasonCode: "hold", explanation: "Awaiting server evaluation." }, messageKey: "dda.same_next_time" };
      await persistLocalResult(patientId, game, session, held);
      finished = true;
      await db.meta.delete(checkpointKey());
      if (!isFakeOffline() && navigator.onLine) void syncNow().catch(() => false);
      return { adjustment: 0, source: "outbox" };
    })();
    try { return await saving; } finally { saving = null; }
  }
  return {
    get pendingCount() { return finished ? 1 : 0; },
    submitRound: async (event: PerformanceEvent) => {
      try { return await enqueue(event); } catch { return { adjustment: 0, source: "offline" }; }
    },
    submitSession: enqueue,
    submitMetrics: async (event: PerformanceEvent) => (await enqueue(event)).adjustment,
    async exit(reason?: string) {
      if (saving) await saving;
      if (!finished) await enqueue({ ...(latest ?? {
        game_id: game.key, difficulty: game.min_level, accuracy: 0, reaction_time_ms: 0,
        errors: 0, hints_used: 0, session_duration_sec: (Date.now() - Date.parse(startedAt)) / 1000,
        rounds_completed: 0, timestamp: new Date().toISOString(),
      }), fatigue_flags: reason ? [reason] : latest?.fatigue_flags, completed: false, early_exit: true });
    },
    restart() { id = crypto.randomUUID(); startedAt = new Date().toISOString(); finished = false; latest = null; saving = null; observedRounds = 0; observedErrors = 0; consecutiveErrorRounds = 0; },
  };
}
// Existing session API safely evaluates the persisted session. This boundary deliberately
// does not introduce a second DDA transport or ML model in the game components.
export async function gameAvailability(): Promise<GameDefinitionDto[]> {
  return apiClient<GameDefinitionDto[]>("/api/v1/games/", { method: "GET" });
}

/** Close a interrupted checkpoint before a new session replaces its encrypted record. */
export async function recoverIntegratedCheckpoint(patientId: string, game: GameDefinitionDto): Promise<void> {
  const key = `integrated-game:${patientId}:${game.key}`;
  const raw = await getMeta(key);
  if (!raw) return;
  let checkpoint: { id: string; startedAt: string; event: PerformanceEvent; guestMode?: boolean };
  try { checkpoint = JSON.parse(raw) as typeof checkpoint; } catch { await db.meta.delete(key); return; }
  if (!checkpoint?.event || checkpoint.event.game_id !== game.key || !checkpoint.id ||
      !Number.isFinite(Date.parse(checkpoint.startedAt)) || !Number.isFinite(Date.parse(checkpoint.event.timestamp))) {
    await db.meta.delete(key);
    return;
  }
  if (await db.gameSessions.get(checkpoint.id)) { await db.meta.delete(key); return; }
  const state = await getDifficulty(patientId, game);
  const event = checkpoint.event.completed ? checkpoint.event : { ...checkpoint.event, completed: false, early_exit: true };
  await persistLocalResult(patientId, game, { id: checkpoint.id, patientId, gameKey: game.key,
    seed: checkpoint.id, level: event.difficulty, challengeMode: false,
    guestMode: checkpoint.guestMode ?? false, startedAt: checkpoint.startedAt,
    endedAt: event.timestamp, synced: false, metrics: sessionMetrics(event),
  }, { state, change: { fromLevel: state.level, toLevel: state.level, reasonCode: "hold",
    explanation: "Awaiting server evaluation." }, messageKey: "dda.same_next_time" });
  await db.meta.delete(key);
}
