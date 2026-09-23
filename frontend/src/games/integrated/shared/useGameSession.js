import { useCallback, useContext, useMemo, useRef, useState } from 'react';
import { GameSafetyContext } from './GameSafetyContext.js';
import {
  applyAdjustment,
  buildGameMetrics,
  clampDifficulty,
  createRoundResult,
  summariseRounds,
} from './gameMetrics.js';
import { getDDAClient } from './DDAClient.js';

/**
 * The single place where the SMARANA gameplay loop lives:
 *
 *   round finished -> standard metrics -> DDAClient -> -1/0/+1
 *   -> clamp -> difficulty for the next round
 *
 * Every game uses this hook, so games 7-12 need no new shared plumbing.
 * Games remain fully playable when the DDA service is unreachable: the client
 * resolves to "keep difficulty" instead of throwing.
 */
export function useGameSession({
  gameId,
  initialDifficulty = 1,
  roundsPerSession = 5,
  hintsPerRound = 1,
  ddaClient,
  onSessionEnd,
}) {
  const client = ddaClient ?? getDDAClient();
  const { maxDifficulty } = useContext(GameSafetyContext);

  const [difficulty, setDifficulty] = useState(() => Math.min(maxDifficulty, clampDifficulty(initialDifficulty)));
  const [rounds, setRounds] = useState([]);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastAdjustment, setLastAdjustment] = useState(null);
  const [isFinished, setIsFinished] = useState(false);

  const startedAtRef = useRef(Date.now());
  const finishedRef = useRef(false);
  const busyRef = useRef(false);
  const roundsRef = useRef(rounds);
  roundsRef.current = rounds;

  const roundNumber = rounds.length + 1;
  const isLastRound = roundNumber >= roundsPerSession;

  // hintsPerRound may be a number or a (difficulty) => number mapping, so a
  // game can allow fewer hints as the level rises.
  const hintsAllowed = typeof hintsPerRound === 'function'
    ? hintsPerRound(difficulty)
    : hintsPerRound;
  const hintsRemaining = Math.max(0, hintsAllowed - hintsUsed);

  const consumeHint = useCallback(() => {
    if (hintsRemaining <= 0) return false;
    setHintsUsed((n) => n + 1);
    return true;
  }, [hintsRemaining]);

  /**
   * Record a finished round and ask the DDA service what to do next.
   * Resolves with { result, response, nextDifficulty }.
   */
  const completeRound = useCallback(async (payload = {}) => {
    if (busyRef.current || finishedRef.current) return null;
    busyRef.current = true;
    const result = createRoundResult({
      ...payload,
      round: rounds.length + 1,
      difficulty,
      hintsUsed: payload.hintsUsed ?? hintsUsed,
    });

    const nextRounds = [...rounds, result];
    setRounds(nextRounds);
    setHintsUsed(0);
    setIsSubmitting(true);

    const metrics = buildGameMetrics({
      gameId,
      rounds: nextRounds,
      difficulty,
      startedAt: startedAtRef.current,
      completed: nextRounds.length >= roundsPerSession,
      earlyExit: false,
      gameMetadata: { round: result.round, ...result.extra },
    });

    let response;
    try { response = await client.submitRound(metrics); }
    catch { response = { adjustment: 0, source: 'offline' }; }
    busyRef.current = false;
    const nextDifficulty = Math.min(maxDifficulty, applyAdjustment(difficulty, response.adjustment));

    setIsSubmitting(false);
    setLastAdjustment(response);
    setDifficulty(nextDifficulty);

    return { result, response, nextDifficulty, metrics };
  }, [client, difficulty, gameId, hintsUsed, rounds, roundsPerSession, maxDifficulty]);

  /** Ends the session and records the final event. Safe to call twice. */
  const endSession = useCallback(async ({ earlyExit = false } = {}) => {
    if (finishedRef.current) return null;
    finishedRef.current = true;
    setIsFinished(true);

    const metrics = buildGameMetrics({
      gameId,
      rounds: roundsRef.current,
      difficulty,
      startedAt: startedAtRef.current,
      completed: !earlyExit && rounds.length >= roundsPerSession,
      earlyExit,
    });

    try { await client.submitSession(metrics); }
    catch { finishedRef.current = false; }
    onSessionEnd?.(metrics);
    return metrics;
  }, [client, difficulty, gameId, onSessionEnd, rounds, roundsPerSession]);

  const restart = useCallback(() => {
    client.restart?.();
    finishedRef.current = false;
    startedAtRef.current = Date.now();
    setRounds([]);
    setHintsUsed(0);
    setIsFinished(false);
    setLastAdjustment(null);
  }, [client]);

  const stats = useMemo(() => summariseRounds(rounds), [rounds]);

  return {
    difficulty,
    roundNumber,
    roundsPerSession,
    rounds,
    stats,
    hintsUsed,
    hintsRemaining,
    consumeHint,
    completeRound,
    endSession,
    restart,
    isLastRound,
    isSessionComplete: rounds.length >= roundsPerSession,
    isFinished,
    isSubmitting,
    lastAdjustment,
    pendingSyncCount: client.pendingCount,
  };
}

export default useGameSession;
