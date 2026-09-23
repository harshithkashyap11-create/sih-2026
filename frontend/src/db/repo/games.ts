import { useAuthStore } from "../../features/auth/authStore";
import { apiClient } from "../../api/client";
import type {
  DdaResult,
  DifficultyStateData,
  SessionSummary,
} from "../../games/dda";
import {
  activeProfile,
  db,
  getMeta,
  setMeta,
  type CachedGameSession,
} from "../schema";
import type { FatigueReason } from "../../games/engine/fatigue";
import { createOutboxEntry, isFakeOffline } from "../outbox";

export interface GameDefinitionDto {
  key: string;
  name: string;
  cognitive_domains: string[];
  min_level: number;
  max_level: number;
  is_regional: boolean;
}
export interface ResumeState {
  gameKey: string;
  patientId: string;
  seed: string;
  level: number;
  roundIndex: number;
  startedAt: string;
  metrics: {
    correct: number;
    mistakes: number;
    hintsUsed: number;
    reactionTimes: number[];
    answers: Array<{ correct: boolean; reactionMs: number }>;
    rawEvents: unknown[];
  };
  fatigueFlags?: FatigueReason[];
  suppressFatigueUntilRound?: number;
}
export const resumeKey = (patientId: string, gameKey: string): string =>
  `game-resume:${patientId}:${gameKey}`;
export async function listGames(): Promise<GameDefinitionDto[]> {
  const cached = await db.gameDefinitions.toArray();
  if (isFakeOffline() || !navigator.onLine) return cached;
  try {
    const games = await apiClient<GameDefinitionDto[]>("/api/v1/games/", {
      method: "GET",
    });
    await db.transaction("rw", db.gameDefinitions, async () => {
      await db.gameDefinitions.clear();
      await db.gameDefinitions.bulkPut(games);
    });
    return games;
  } catch (error) {
    if (cached.length) return cached;
    throw error;
  }
}
export async function loadResume(
  patientId: string,
  gameKey: string,
): Promise<ResumeState | null> {
  const value = await getMeta(resumeKey(patientId, gameKey));
  return value ? (JSON.parse(value) as ResumeState) : null;
}
export async function saveResume(value: ResumeState): Promise<void> {
  await setMeta(
    resumeKey(value.patientId, value.gameKey),
    JSON.stringify(value),
  );
}
export async function clearResume(
  patientId: string,
  gameKey: string,
): Promise<void> {
  await db.meta.delete(resumeKey(patientId, gameKey));
}
export async function loadLatestResume(): Promise<ResumeState | null> {
  const profile = await activeProfile();
  if (!profile) return null;
  const entries = await db.meta
    .filter(
      (entry) =>
        entry.key.startsWith("game-resume:") &&
        (!profile || entry.key.startsWith(`game-resume:${profile.id}:`)),
    )
    .toArray();
  const states = entries.flatMap((entry) => {
    try {
      return [JSON.parse(entry.value) as ResumeState];
    } catch {
      return [];
    }
  });
  return (
    states.sort(
      (a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt),
    )[0] ?? null
  );
}

export async function abandonResume(value: ResumeState): Promise<void> {
  const endedAt = new Date();
  const times = value.metrics.reactionTimes;
  await db.transaction("rw", db.gameSessions, db.meta, db.outbox, async () => {
    const session: CachedGameSession = {
      id: crypto.randomUUID(),
      patientId: value.patientId,
      gameKey: value.gameKey,
      seed: value.seed,
      level: value.level,
      challengeMode: false,
      startedAt: value.startedAt,
      endedAt: endedAt.toISOString(),
      synced: false,
      metrics: {
        accuracy: value.metrics.correct / Math.max(value.roundIndex, 1),
        mean_reaction_ms:
          times.reduce((sum, item) => sum + item, 0) /
          Math.max(times.length, 1),
        mistakes: value.metrics.mistakes,
        hints_used: value.metrics.hintsUsed,
        rounds: value.roundIndex,
        duration_ms: endedAt.getTime() - Date.parse(value.startedAt),
        completed: false,
        abandoned_reason: "user_exit",
        fatigue_flags: value.fatigueFlags ?? [],
        raw_events: value.metrics.rawEvents,
      },
    };
    await db.gameSessions.put(session);
    await db.outbox.put(
      createOutboxEntry("game_session", session.id, value.patientId, {
        id: session.id,
        patient_id: value.patientId,
        game_key: session.gameKey,
        seed: session.seed,
        level: session.level,
        metrics: session.metrics,
        challenge_mode: session.challengeMode,
        started_at: session.startedAt,
        ended_at: session.endedAt,
        device_updated_at: session.endedAt,
      }),
    );
    await db.meta.delete(resumeKey(value.patientId, value.gameKey));
  });
}
export async function getDifficulty(
  patientId: string,
  game: GameDefinitionDto,
): Promise<DifficultyStateData> {
  const state = await db.difficultyStates
    .where({ patientId, gameKey: game.key })
    .first();
  const profile = await getMeta("gamePatient");
  const patient = profile ? JSON.parse(profile) as { id?: string; maxDifficultyLevel?: number } : null;
  const cap = Math.min(game.max_level, state?.capLevel ?? game.max_level,
    patient?.id === patientId ? patient.maxDifficultyLevel ?? game.max_level : game.max_level);
  return state
    ? {
        level: Math.min(state.level, cap),
        window: state.window as SessionSummary[],
        lockedByDoctor: state.lockedByDoctor,
        capLevel: cap < game.max_level ? cap : state.capLevel,
        minLevel: state.minLevel,
        maxLevel: state.maxLevel,
      }
    : {
        level: game.min_level,
        window: [],
        lockedByDoctor: false,
        capLevel: cap < game.max_level ? cap : null,
        minLevel: game.min_level,
        maxLevel: game.max_level,
      };
}
export async function persistLocalResult(
  patientId: string,
  game: GameDefinitionDto,
  session: CachedGameSession,
  result: DdaResult,
): Promise<void> {
  if (session.guestMode && useAuthStore.getState().role === "caregiver") {
    await apiClient(`/api/v1/patients/${patientId}/game-sessions/`, {
      method: "POST",
      body: JSON.stringify({
        id: session.id,
        game_key: session.gameKey,
        seed: session.seed,
        level: session.level,
        metrics: session.metrics,
        challenge_mode: false,
        guest_mode: true,
        started_at: session.startedAt,
        ended_at: session.endedAt,
      }),
    });
    return;
  }
  const stateId = `${patientId}:${game.key}`;
  await db.transaction(
    "rw",
    db.gameSessions,
    db.difficultyStates,
    db.difficultyChanges,
    db.outbox,
    async () => {
      await db.gameSessions.put(session);
      if (!session.guestMode) {
        await db.difficultyStates.put({
          id: stateId,
          patientId,
          gameKey: game.key,
          level: result.state.level,
          window: result.state.window,
          lockedByDoctor: result.state.lockedByDoctor,
          capLevel: result.state.capLevel,
          minLevel: result.state.minLevel,
          maxLevel: result.state.maxLevel,
        });
        await db.difficultyChanges.put({
          id: crypto.randomUUID(),
          stateId,
          sessionId: session.id,
          fromLevel: result.change.fromLevel,
          toLevel: result.change.toLevel,
          reasonCode: result.change.reasonCode,
          explanation: result.change.explanation,
        });
      }
      const updatedAt = session.endedAt;
      await db.outbox.put(
        createOutboxEntry("game_session", session.id, patientId, {
          id: session.id,
          patient_id: patientId,
          game_key: session.gameKey,
          seed: session.seed,
          level: session.level,
          metrics: session.metrics,
          challenge_mode: session.challengeMode,
          guest_mode: Boolean(session.guestMode),
          started_at: session.startedAt,
          ended_at: session.endedAt,
          device_updated_at: updatedAt,
        }),
      );
      if (!session.guestMode)
        await db.outbox.put(
          createOutboxEntry("difficulty_state", session.id, patientId, {
            id: stateId,
            patient_id: patientId,
            game_key: game.key,
            level: result.state.level,
            window: result.state.window,
            device_updated_at: updatedAt,
          }),
        );
    },
  );
}
