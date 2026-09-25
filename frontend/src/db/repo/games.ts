import { useAuthStore } from "../../features/auth/authStore";
import { apiClient } from "../../api/client";
import type {
  DdaResult,
  DifficultyStateData,
  SessionSummary,
} from "../../games/dda";
import { db, getMeta, type CachedGameSession } from "../schema";
import { createOutboxEntry, isFakeOffline } from "../outbox";

export type { ResumeState } from "./gameResume";

export interface GameDefinitionDto {
  key: string;
  name: string;
  cognitive_domains: string[];
  min_level: number;
  max_level: number;
  is_regional: boolean;
}
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
export async function getDifficulty(
  patientId: string,
  game: GameDefinitionDto,
): Promise<DifficultyStateData> {
  const state = await db.difficultyStates
    .where({ patientId, gameKey: game.key })
    .first();
  const profile = await getMeta("gamePatient");
  const patient = profile
    ? (JSON.parse(profile) as { id?: string; maxDifficultyLevel?: number })
    : null;
  const cap = Math.min(
    game.max_level,
    state?.capLevel ?? game.max_level,
    patient?.id === patientId
      ? (patient.maxDifficultyLevel ?? game.max_level)
      : game.max_level,
  );
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
