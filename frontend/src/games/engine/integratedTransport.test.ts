import { beforeEach, describe, expect, it, vi } from "vitest";
import { createIntegratedTransport, recoverIntegratedCheckpoint, type PerformanceEvent } from "./integratedTransport";
import type { GameDefinitionDto } from "../../db/repo/games";
const mocks = vi.hoisted(() => ({ api: vi.fn(), persist: vi.fn(), getMeta: vi.fn(), setMeta: vi.fn(), remove: vi.fn(), existing: vi.fn(), offline: vi.fn() }));
vi.mock("../../api/client", () => ({ apiClient: mocks.api }));
vi.mock("../../db/schema", () => ({ getMeta: mocks.getMeta, setMeta: mocks.setMeta, db: { meta: { delete: mocks.remove }, gameSessions: { get: mocks.existing } } }));
vi.mock("../../db/outbox", () => ({ isFakeOffline: mocks.offline }));
vi.mock("../../db/sync", () => ({ syncNow: vi.fn().mockResolvedValue(true) }));
vi.mock("../../db/repo/games", () => ({ persistLocalResult: mocks.persist, getDifficulty: vi.fn().mockResolvedValue({ level: 1, window: [], minLevel: 1, maxLevel: 5, lockedByDoctor: false, capLevel: null }) }));
const game: GameDefinitionDto = { key: "visual_search", name: "Visual Search", min_level: 1, max_level: 5, cognitive_domains: ["attention"], is_regional: false };
const event: PerformanceEvent = { game_id: game.key, difficulty: 1, accuracy: 1, reaction_time_ms: 1000, errors: 0, hints_used: 0, completed: false, early_exit: false, session_duration_sec: 30, rounds_completed: 3, timestamp: new Date().toISOString() };
beforeEach(() => { vi.clearAllMocks(); mocks.offline.mockReturnValue(false); mocks.persist.mockResolvedValue(undefined); mocks.api.mockResolvedValue({ adjustment: 1 }); });
describe("authenticated shared game transport", () => {
  it("persists duration safety flags and stops before another round", async () => {
    const onFatigue = vi.fn();
    const client = createIntegratedTransport("patient-fixture", game, false, { sessionCapMinutes: 1, onFatigue });
    await client.submitMetrics({ ...event, session_duration_sec: 60 });
    expect(onFatigue).toHaveBeenCalledOnce();
    expect(mocks.persist.mock.calls[0]?.[2]).toMatchObject({ metrics: { completed: false, fatigue_flags: ["session_cap"] } });
    expect(mocks.api).not.toHaveBeenCalled();
  });
  it("records a session-cap exit even before the first checkpoint", async () => {
    const client = createIntegratedTransport("patient-fixture", game);
    await client.exit("session_cap");
    expect(mocks.persist).toHaveBeenCalledOnce();
    expect(mocks.persist.mock.calls[0]?.[2]).toMatchObject({ metrics: { fatigue_flags: ["session_cap"], completed: false } });
  });
  it("applies real backend round responses and holds on unavailable or invalid inference", async () => {
    const client = createIntegratedTransport("patient-fixture", game);
    expect(await client.submitMetrics(event)).toBe(1);
    expect(mocks.api).toHaveBeenCalledWith("/api/v1/game-events/", expect.objectContaining({ method: "POST" }));
    mocks.api.mockResolvedValue({ adjustment: 12 });
    expect(await client.submitMetrics(event)).toBe(0);
    mocks.api.mockRejectedValue(new Error("offline"));
    expect(await client.submitMetrics(event)).toBe(0);
    expect(mocks.setMeta).toHaveBeenCalled();
  });
  it("serializes overlapping completion and exit into one outbox session", async () => {
    const client = createIntegratedTransport("patient-fixture", game);
    await Promise.all([client.submitSession({ ...event, completed: true }), client.submitSession({ ...event, early_exit: true }), client.exit()]);
    expect(mocks.persist).toHaveBeenCalledOnce();
    expect(mocks.persist.mock.calls[0]?.[2]).toMatchObject({ metrics: { completed: true, rounds: 3 } });
  });
  it("practice keeps gameplay separate from live adaptation", async () => {
    const client = createIntegratedTransport("patient-fixture", game, true);
    expect(await client.submitMetrics(event)).toBe(0);
    expect(mocks.api).not.toHaveBeenCalled();
    await client.submitSession({ ...event, completed: true });
    expect(mocks.persist.mock.calls[0]?.[2]).toMatchObject({ guestMode: true });
  });
  it("recovers an interrupted encrypted checkpoint as an early exit", async () => {
    mocks.getMeta.mockResolvedValue(JSON.stringify({ id: "checkpoint-fixture", startedAt: "2026-09-17T00:00:00Z", event, guestMode: true }));
    mocks.existing.mockResolvedValue(undefined);
    await recoverIntegratedCheckpoint("patient-fixture", game);
    expect(mocks.persist.mock.calls[0]?.[2]).toMatchObject({ id: "checkpoint-fixture", guestMode: true, metrics: { completed: false, abandoned_reason: "user_exit" } });
    expect(mocks.remove).toHaveBeenCalled();
  });
  it("discards malformed checkpoints without blocking a new game", async () => {
    mocks.getMeta.mockResolvedValue("{invalid");
    await expect(recoverIntegratedCheckpoint("patient-fixture", game)).resolves.toBeUndefined();
    expect(mocks.persist).not.toHaveBeenCalled();
    expect(mocks.remove).toHaveBeenCalled();
  });
});
