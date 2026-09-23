/**
 * Shared difficulty + DDA controller for games 7-12.
 *
 * This is an ADDITIVE adapter, not a second DDA system. It owns only
 * (a) the bounded difficulty integer and (b) the call into whatever metric
 * submission function you hand it. Wire `submitMetrics` to the project's
 * existing DDA client / metrics util.
 *
 * Contract expected from submitMetrics(payload), resolving to any of:
 *   -1 | 0 | 1
 *   { adjustment: -1 | 0 | 1 }
 *   { difficulty_delta } | { delta } | { data: { adjustment } }
 * Any rejection, timeout or unparseable value is treated as 0 (no change).
 */
import { useCallback, useContext, useRef, useState } from 'react';
import { GameSafetyContext } from './GameSafetyContext.js';

export const MIN_DIFFICULTY = 1;
export const MAX_DIFFICULTY = 5;

export function clampDifficulty(level, min = MIN_DIFFICULTY, max = MAX_DIFFICULTY) {
  const n = Math.round(Number(level));
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

export function normalizeAdjustment(response) {
  let value = response;
  if (value && typeof value === 'object') {
    if ('adjustment' in value) value = value.adjustment;
    else if ('difficulty_delta' in value) value = value.difficulty_delta;
    else if ('delta' in value) value = value.delta;
    else if (value.data && typeof value.data === 'object') return normalizeAdjustment(value.data);
    else return 0;
  }
  return typeof value === 'number' && [-1, 0, 1].includes(value) ? value : 0;
}

export default function useDifficultyController({
  gameId,
  initialDifficulty = 2,
  submitMetrics,
  min = MIN_DIFFICULTY,
  max = MAX_DIFFICULTY,
  onAdjustment,
}) {
  const { maxDifficulty } = useContext(GameSafetyContext);
  max = Math.min(max, maxDifficulty);
  const [difficulty, setDifficultyState] = useState(() => clampDifficulty(initialDifficulty, min, max));
  const [lastAdjustment, setLastAdjustment] = useState(0);
  const [syncState, setSyncState] = useState('idle'); // idle | sending | ok | offline
  const difficultyRef = useRef(difficulty);
  difficultyRef.current = difficulty;

  const setDifficulty = useCallback(
    (next) => {
      const raw = typeof next === 'function' ? next(difficultyRef.current) : next;
      const value = clampDifficulty(raw, min, max);
      difficultyRef.current = value;
      setDifficultyState(value);
      return value;
    },
    [min, max]
  );

  /** Local nudge without the backend (e.g. give more support after repeated errors). */
  const stepDifficulty = useCallback((delta) => setDifficulty(difficultyRef.current + delta), [setDifficulty]);

  /** Send standard metrics through the DDA abstraction and apply the bounded result. Never throws. */
  const reportPerformance = useCallback(
    async (payload) => {
      const enriched = { ...payload, game_id: gameId, difficulty: difficultyRef.current };
      if (typeof submitMetrics !== 'function') {
        setSyncState('offline');
        return 0;
      }
      setSyncState('sending');
      try {
        const adjustment = normalizeAdjustment(await submitMetrics(enriched));
        setSyncState('ok');
        setLastAdjustment(adjustment);
        if (adjustment !== 0) setDifficulty(difficultyRef.current + adjustment);
        if (onAdjustment) onAdjustment(adjustment, difficultyRef.current);
        return adjustment;
      } catch {
        setSyncState('offline'); // keep playing at the current difficulty
        setLastAdjustment(0);
        return 0;
      }
    },
    [gameId, submitMetrics, setDifficulty, onAdjustment]
  );

  return { difficulty, setDifficulty, stepDifficulty, reportPerformance, lastAdjustment, syncState };
}
