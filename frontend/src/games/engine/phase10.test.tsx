vi.mock("../../db/media", () => ({
  privateMediaUrl: (url: string) => Promise.resolve(url),
}));
import {
  act,
  fireEvent,
  renderHook,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { defaultPack } from "../../content/packs";
import { demoTap } from "../modules/demo_tap";
import { useGameSession } from "./useGameSession";
import { useCalmStore } from "../../features/patient/confused/store";
import { ConfusedMode } from "../../features/patient/confused/ConfusedMode";
import { speak } from "../../shared/hooks/useTts";
import { renderWithProviders } from "../../test/utils";
const mocks = vi.hoisted(() => ({
  save: vi.fn(),
  persist: vi.fn(),
  clear: vi.fn(),
}));
vi.mock("../../db/repo/games", () => ({
  getDifficulty: () =>
    Promise.resolve({
      level: 1,
      window: [],
      lockedByDoctor: false,
      capLevel: null,
      minLevel: 1,
      maxLevel: 10,
    }),
  persistLocalResult: mocks.persist,
}));
vi.mock("../../db/repo/gameResume", () => ({
  loadResume: () => Promise.resolve(null),
  saveResume: mocks.save,
  clearResume: mocks.clear,
}));
vi.mock("../../db/repo/patient", () => ({
  patientRepository: {
    getFamilyMembers: () => Promise.resolve([{ photoUrl: "/family.jpg" }]),
  },
}));
const game = {
  key: "demo_tap",
  name: "Demo",
  cognitive_domains: [],
  min_level: 1,
  max_level: 10,
  is_regional: false,
};
beforeEach(() => {
  vi.clearAllMocks();
  useCalmStore.setState({ calmMode: false });
});
afterEach(() => {
  useCalmStore.setState({ calmMode: false });
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
test("calm mode pauses answers and hints, resumes without creating a session", async () => {
  const { result } = renderHook(() =>
    useGameSession(demoTap, game, "patient", defaultPack, false),
  );
  await waitFor(() => expect(result.current.ready).toBe(true));
  act(() => useCalmStore.getState().setCalmMode(true));
  act(() => {
    result.current.answer({ value: result.current.round?.expected });
    result.current.hint();
  });
  expect(result.current.roundIndex).toBe(0);
  expect(mocks.persist).not.toHaveBeenCalled();
  act(() => useCalmStore.getState().setCalmMode(false));
  act(() => result.current.answer({ value: result.current.round?.expected }));
  expect(result.current.roundIndex).toBe(1);
});
test("practice leaves normal resume untouched and persists a guest session", async () => {
  let clock = Date.now();
  vi.spyOn(Date, "now").mockImplementation(() => (clock += 500));
  const { result } = renderHook(() =>
    useGameSession(demoTap, game, "patient", defaultPack, false, 20, true),
  );
  await waitFor(() => expect(result.current.ready).toBe(true));
  for (let i = 0; i < 3; i++)
    act(() => result.current.answer({ value: result.current.round?.expected }));
  await waitFor(() => expect(mocks.persist).toHaveBeenCalled());
  expect(mocks.persist.mock.calls[0]?.[2]).toMatchObject({ guestMode: true });
  expect(mocks.save).not.toHaveBeenCalled();
  expect(mocks.clear).not.toHaveBeenCalled();
});
test("confused button enables slow speech and only offers SOS after explicit call", async () => {
  const sos = vi.fn();
  window.addEventListener("smarana:open-sos-confirm", sos);
  const speech = { cancel: vi.fn(), speak: vi.fn() };
  vi.stubGlobal("speechSynthesis", speech);
  class Utterance {
    rate = 1;
    lang = "";
    constructor(public text: string) {}
  }
  vi.stubGlobal("SpeechSynthesisUtterance", Utterance);
  renderWithProviders(<ConfusedMode />);
  fireEvent.click(
    screen.getByRole("button", { name: "I feel confused / I need a break" }),
  );
  expect(screen.getByRole("dialog")).toBeInTheDocument();
  expect(await screen.findByAltText("A familiar face")).toHaveAttribute(
    "src",
    "/family.jpg",
  );
  speak("Hello");
  expect(speech.speak).toHaveBeenLastCalledWith(
    expect.objectContaining({ rate: 0.7 }),
  );
  expect(sos).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Call my caregiver" }));
  expect(sos).toHaveBeenCalledTimes(1);
  window.removeEventListener("smarana:open-sos-confirm", sos);
});
