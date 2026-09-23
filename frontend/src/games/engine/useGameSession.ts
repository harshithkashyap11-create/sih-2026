import { useCalmStore } from "../../features/patient/confused/store";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ContentPack } from "../../content/packs";
import {
  clearResume,
  getDifficulty,
  loadResume,
  persistLocalResult,
  saveResume,
  type GameDefinitionDto,
  type ResumeState,
} from "../../db/repo/games";
import type { CachedGameSession } from "../../db/schema";
import { nextDifficulty, sessionLevel, type DifficultyStateData } from "../dda";
import { type Answer, type GameModule } from "./types";
import { buildRoundAtIndex, recordAnswer } from "./sessionCore";
import { detectFatigue } from "./fatigue";

export interface GameSessionController<R> {
  ready: boolean;
  round: R | null;
  roundIndex: number;
  totalRounds: number;
  messageKey: string | null;
  breakOpen: boolean;
  answer(answer: Answer): void;
  hint(): void;
  acceptBreak(): void;
  continuePlaying(): void;
  restart(): void;
}
const newMetrics = (): ResumeState["metrics"] => ({
  correct: 0,
  mistakes: 0,
  hintsUsed: 0,
  reactionTimes: [],
  answers: [],
  rawEvents: [],
});

export function useGameSession<R>(
  module: GameModule<R>,
  game: GameDefinitionDto,
  patientId: string,
  content: ContentPack,
  challengeMode: boolean,
  sessionCapMinutes = 20,
  guestMode = false,
): GameSessionController<R> {
  const calmMode = useCalmStore((s) => s.calmMode);
  const [resume, setResumeState] = useState<ResumeState | null>(null);
  const [difficulty, setDifficulty] = useState<DifficultyStateData | null>(
    null,
  );
  const [messageKey, setMessageKey] = useState<string | null>(null);
  const [breakOpen, setBreakOpen] = useState(false);
  const roundStarted = useRef(0);
  useEffect(() => {
    if (!calmMode) roundStarted.current = Date.now();
  }, [calmMode]);
  const start = useCallback(async () => {
    const storedDifficulty = await getDifficulty(patientId, game);
    const override = new URLSearchParams(window.location.search).get("level");
    const requested = Number(override);
    const level = Math.min(storedDifficulty.capLevel ?? game.max_level, game.max_level,
      override && Number.isFinite(requested) && !storedDifficulty.lockedByDoctor
        ? Math.max(game.min_level, Math.round(requested))
        : sessionLevel(storedDifficulty, challengeMode));
    const existing = guestMode ? null : await loadResume(patientId, module.key);
    const value = existing ? { ...existing, level: Math.min(existing.level, storedDifficulty.capLevel ?? game.max_level, game.max_level) } : {
      gameKey: module.key,
      patientId,
      seed: crypto.randomUUID(),
      level,
      roundIndex: 0,
      startedAt: new Date().toISOString(),
      metrics: newMetrics(),
    };
    setDifficulty(storedDifficulty);
    setResumeState(value);
    roundStarted.current = Date.now();
    if (!guestMode) await saveResume(value);
  }, [challengeMode, game, module.key, patientId, guestMode]);
  // The async repository read is the external subscription that initializes this session.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void start();
  }, [start]);
  const round = useMemo(() => {
    if (!resume) return null;
    return buildRoundAtIndex(module, resume, content);
  }, [content, module, resume]);
  const finish = useCallback(
    async (
      finalResume: ResumeState,
      completed = true,
      abandonedReason: "break_prompt" | null = null,
    ) => {
      if (!difficulty) return;
      const endedAt = new Date();
      const times = finalResume.metrics.reactionTimes;
      const summary = {
        level: finalResume.level,
        accuracy:
          finalResume.metrics.correct / Math.max(finalResume.roundIndex, 1),
        meanReactionMs:
          times.reduce((a, b) => a + b, 0) / Math.max(times.length, 1),
        mistakes: finalResume.metrics.mistakes,
        hintsUsed: finalResume.metrics.hintsUsed,
        rounds: finalResume.roundIndex,
        completed,
        challengeMode,
        guestMode,
        fatigueFlagged: Boolean(finalResume.fatigueFlags?.length),
      };
      const local = nextDifficulty(difficulty, summary);
      const session: CachedGameSession = {
        id: crypto.randomUUID(),
        patientId,
        gameKey: module.key,
        seed: finalResume.seed,
        level: finalResume.level,
        challengeMode,
        guestMode,
        startedAt: finalResume.startedAt,
        endedAt: endedAt.toISOString(),
        synced: false,
        metrics: {
          accuracy: summary.accuracy,
          mean_reaction_ms: summary.meanReactionMs,
          mistakes: summary.mistakes,
          hints_used: summary.hintsUsed,
          rounds: summary.rounds,
          duration_ms: endedAt.getTime() - Date.parse(finalResume.startedAt),
          completed,
          abandoned_reason: abandonedReason,
          fatigue_flags: finalResume.fatigueFlags ?? [],
          raw_events: finalResume.metrics.rawEvents,
        },
      };
      await persistLocalResult(patientId, game, session, local);
      setBreakOpen(false);
      setMessageKey(local.messageKey);
      if (!guestMode) await clearResume(patientId, module.key);
    },
    [challengeMode, difficulty, game, module.key, patientId, guestMode],
  );
  const answer = useCallback(
    (value: Answer) => {
      if (
        !resume ||
        !round ||
        useCalmStore.getState().calmMode ||
        calmMode ||
        breakOpen
      )
        return;
      const next = recordAnswer(
        module,
        round,
        resume,
        value,
        Date.now() - roundStarted.current,
      );
      const nextIndex = next.roundIndex;
      const fatigueFlags = detectFatigue({
        events: next.metrics.answers,
        startedAt: next.startedAt,
        sessionCapMinutes,
      });
      const flagged = fatigueFlags.length
        ? {
            ...next,
            fatigueFlags: [
              ...new Set([...(next.fatigueFlags ?? []), ...fatigueFlags]),
            ],
          }
        : next;
      setResumeState(flagged);
      const canPrompt =
        fatigueFlags.length > 0 &&
        nextIndex > (resume.suppressFatigueUntilRound ?? 0);
      if (canPrompt) {
        setBreakOpen(true);
        if (!guestMode) void saveResume(flagged);
      } else if (nextIndex >= module.roundsForLevel(resume.level))
        void finish(flagged);
      else {
        roundStarted.current = Date.now();
        if (!guestMode) void saveResume(flagged);
      }
    },
    [
      finish,
      module,
      resume,
      round,
      sessionCapMinutes,
      guestMode,
      calmMode,
      breakOpen,
    ],
  );
  const hint = useCallback(() => {
    if (!resume || calmMode) return;
    const next = {
      ...resume,
      metrics: { ...resume.metrics, hintsUsed: resume.metrics.hintsUsed + 1 },
    };
    setResumeState(next);
    if (!guestMode) void saveResume(next);
  }, [resume, guestMode, calmMode]);
  const acceptBreak = useCallback(() => {
    if (resume) void finish(resume, false, "break_prompt");
  }, [finish, resume]);
  const continuePlaying = useCallback(() => {
    if (!resume || calmMode) return;
    const next = {
      ...resume,
      suppressFatigueUntilRound: resume.roundIndex + 3,
    };
    setBreakOpen(false);
    if (resume.roundIndex >= module.roundsForLevel(resume.level))
      void finish(next);
    else {
      roundStarted.current = Date.now();
      setResumeState(next);
      if (!guestMode) void saveResume(next);
    }
  }, [finish, module, resume, guestMode, calmMode]);
  const restart = useCallback(() => {
    setMessageKey(null);
    setResumeState(null);
    void start();
  }, [start]);
  return {
    ready: Boolean(resume && difficulty),
    round,
    roundIndex: resume?.roundIndex ?? 0,
    totalRounds: resume ? module.roundsForLevel(resume.level) : 0,
    messageKey,
    breakOpen,
    answer,
    hint,
    acceptBreak,
    continuePlaying,
    restart,
  };
}
