import type { FatigueReason } from "../../games/engine/fatigue";
import { createOutboxEntry } from "../outbox";
import {
  activeProfile,
  db,
  getMeta,
  setMeta,
  type CachedGameSession,
} from "../schema";

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
        entry.key.startsWith(`game-resume:${profile.id}:`),
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
