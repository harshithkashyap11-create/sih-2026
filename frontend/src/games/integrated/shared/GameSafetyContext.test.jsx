import { act, renderHook } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { GameSafetyContext } from './GameSafetyContext';
import useDifficultyController from './useDifficultyController';
import { useGameSession } from './useGameSession';

const wrapper = ({ children }) => <GameSafetyContext.Provider value={{ maxDifficulty: 2 }}>{children}</GameSafetyContext.Provider>;

test('clinical bounds prevent local nudges and server promotions above the cap', async () => {
  const submitMetrics = vi.fn().mockResolvedValue(1);
  const { result } = renderHook(() => useDifficultyController({ gameId: 'fixture', initialDifficulty: 5, submitMetrics }), { wrapper });
  expect(result.current.difficulty).toBe(2);
  act(() => result.current.stepDifficulty(1));
  expect(result.current.difficulty).toBe(2);
  await act(async () => { await result.current.reportPerformance({}); });
  expect(result.current.difficulty).toBe(2);
});

test('first integrated engine also clamps a server promotion', async () => {
  const ddaClient = { submitRound: vi.fn().mockResolvedValue({ adjustment: 1 }), submitSession: vi.fn(), pendingCount: 0 };
  const { result } = renderHook(() => useGameSession({ gameId: 'fixture', initialDifficulty: 5, ddaClient }), { wrapper });
  expect(result.current.difficulty).toBe(2);
  await act(async () => { await result.current.completeRound({ correct: 1, total: 1, reactionTimeMs: 1000 }); });
  expect(result.current.difficulty).toBe(2);
});
import React from 'react';
