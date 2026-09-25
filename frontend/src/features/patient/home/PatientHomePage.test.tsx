vi.mock("../../../db/media", () => ({
  privateMediaUrl: (url: string) => Promise.resolve(url),
}));
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import type { Orientation, PatientRepository } from "../../../db/repo/patient";
import { renderWithProviders } from "../../../test/utils";
import { PatientHomePage } from "./PatientHomePage";

const { loadLatestResume, abandonResume } = vi.hoisted(() => ({
  loadLatestResume: vi.fn(),
  abandonResume: vi.fn(),
}));
vi.mock("../../../games/engine/resume", () => ({
  loadLatestResume,
  abandonResume,
}));

beforeEach(() => {
  loadLatestResume.mockResolvedValue(null);
  abandonResume.mockResolvedValue(undefined);
});

const base: Orientation = {
  greeting_key: "morning",
  day: "Saturday",
  date: "September 12, 2026",
  time: "9:00 AM",
  home_label: "Guwahati home",
  next_activity: {
    id: "r1",
    title: "Morning tea",
    scheduled_for: "2026-09-12T10:00:00+05:30",
  },
  family_member: {
    id: "f1",
    name: "Mina",
    relationship: "Daughter",
    photo_url: "/media/mina.jpg",
  },
};

function renderHome(orientation: Orientation) {
  const patient: PatientRepository = {
    getOrientation: () => Promise.resolve(orientation),
  };
  return renderWithProviders(<PatientHomePage />, { repos: { patient } });
}

test("renders the voice-first home, next activity, family photo, and seven destinations", async () => {
  renderHome(base);
  expect(await screen.findByText("Morning tea")).toBeVisible();
  expect(screen.getByRole("img", { name: "Mina" })).toBeVisible();
  expect(screen.getByRole("button", { name: /Talk/ })).toBeVisible();
  for (const label of [
    "Games",
    "Memories",
    "Today's routine",
    "Medicines",
    "Calm",
    "My people",
    "Progress",
  ]) {
    expect(screen.getByRole("button", { name: label })).toBeVisible();
  }
});

test("uses friendly copy when there is no next activity", async () => {
  renderHome({ ...base, next_activity: null });
  expect(
    await screen.findByText("Nothing planned right now. Enjoy your day."),
  ).toBeVisible();
});

test("offers an interrupted game and records start over before hiding it", async () => {
  const resume = {
    gameKey: "memory_match",
    patientId: "patient",
    seed: "same-seed",
    level: 2,
    roundIndex: 3,
    startedAt: "2026-09-14T10:00:00Z",
    metrics: {
      correct: 2,
      mistakes: 1,
      hintsUsed: 0,
      reactionTimes: [500, 600, 700],
      answers: [
        { correct: true, reactionMs: 500 },
        { correct: true, reactionMs: 600 },
        { correct: false, reactionMs: 700 },
      ],
      rawEvents: [],
    },
  };
  loadLatestResume.mockResolvedValueOnce(resume).mockResolvedValueOnce(null);
  const user = userEvent.setup();
  renderHome(base);
  expect(await screen.findByText("Continue your game?")).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Start over" }));
  expect(abandonResume).toHaveBeenCalledWith(resume);
  await waitFor(() =>
    expect(screen.queryByText("Continue your game?")).not.toBeInTheDocument(),
  );
});
