import { screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderWithProviders } from "../../test/utils";
import { TalkButton } from "./TalkButton";
import { performAction } from "../../voice/actions";
import { routeWithFallback } from "../../voice/fallback";
vi.mock("../../db/schema", async (original) => ({
  ...(await original<typeof import("../../db/schema")>()),
  activeProfile: vi.fn().mockResolvedValue({ id: "audit-patient" }),
  getMeta: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../../db/repo/patient", () => ({
  patientRepository: { getFamilyMembers: vi.fn().mockResolvedValue([]) },
}));
vi.mock("../../voice/actions", () => ({
  performAction: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../../voice/fallback", () => ({ routeWithFallback: vi.fn() }));
beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.unstubAllGlobals());
const chat = {
  intent: "general_chat" as const,
  slots: { response: "Memory helps us remember." },
  requiresConfirm: false,
};
function deferred() {
  let resolve!: (value: typeof chat) => void;
  vi.mocked(routeWithFallback).mockReturnValue(
    new Promise((r) => (resolve = r)),
  );
  return () => resolve(chat);
}
async function submit(user: ReturnType<typeof userEvent.setup>, text: string) {
  await user.type(screen.getByRole("textbox", { name: "Your request" }), text);
  await user.click(screen.getByRole("button", { name: "Send" }));
}
it("closing aborts delayed work and no stale action executes", async () => {
  const resolve = deferred();
  const user = userEvent.setup();
  renderWithProviders(<TalkButton />);
  await user.click(screen.getByRole("button", { name: /Talk/ }));
  await submit(user, "What is memory?");
  await waitFor(() => expect(routeWithFallback).toHaveBeenCalledOnce());
  const signal = vi.mocked(routeWithFallback).mock.calls[0]?.[2];
  await user.click(screen.getByRole("button", { name: "Stop" }));
  expect(signal?.aborted).toBe(true);
  await act(async () => {
    resolve();
    await Promise.resolve();
  });
  expect(performAction).not.toHaveBeenCalled();
  expect(screen.queryByRole("textbox")).toBeNull();
});
it("second typed command supersedes the first, rather than executing both", async () => {
  const resolve = deferred();
  const user = userEvent.setup();
  renderWithProviders(<TalkButton />);
  await user.click(screen.getByRole("button", { name: /Talk/ }));
  await submit(user, "What is memory?");
  await waitFor(() => expect(routeWithFallback).toHaveBeenCalledOnce());
  const signal = vi.mocked(routeWithFallback).mock.calls[0]?.[2];
  await submit(user, "Show my progress");
  expect(signal?.aborted).toBe(true);
  await act(async () => {
    resolve();
    await Promise.resolve();
  });
  await waitFor(() => expect(performAction).toHaveBeenCalledOnce());
  expect(performAction).toHaveBeenCalledWith(
    expect.objectContaining({
      intent: "open_section",
      slots: { section: "progress" },
    }),
    expect.anything(),
  );
});
it("Talk stops processing before a delayed action fires", async () => {
  const resolve = deferred();
  const user = userEvent.setup();
  renderWithProviders(<TalkButton />);
  await user.click(screen.getByRole("button", { name: /Talk/ }));
  await submit(user, "What is memory?");
  await waitFor(() => expect(routeWithFallback).toHaveBeenCalledOnce());
  await user.click(screen.getByRole("button", { name: /Talk/ }));
  await act(async () => {
    resolve();
    await Promise.resolve();
  });
  expect(performAction).not.toHaveBeenCalled();
});
it("unmount aborts processing and suppresses late side effects", async () => {
  const resolve = deferred();
  const user = userEvent.setup();
  const view = renderWithProviders(<TalkButton />);
  await user.click(screen.getByRole("button", { name: /Talk/ }));
  await submit(user, "What is memory?");
  await waitFor(() => expect(routeWithFallback).toHaveBeenCalledOnce());
  view.unmount();
  await act(async () => {
    resolve();
    await Promise.resolve();
  });
  expect(performAction).not.toHaveBeenCalled();
});
it("deterministic games and negation never request a model", async () => {
  const user = userEvent.setup();
  renderWithProviders(<TalkButton />);
  await user.click(screen.getByRole("button", { name: /Talk/ }));
  await submit(user, "Open Memory Match");
  await waitFor(() => expect(performAction).toHaveBeenCalledOnce());
  await submit(user, "Do not open games");
  expect(routeWithFallback).not.toHaveBeenCalled();
  expect(performAction).toHaveBeenCalledOnce();
});
it("repeat replays response without rerunning the prior action", async () => {
  vi.mocked(performAction).mockImplementationOnce(async (_command, context) => {
    await context.tts.speak("Opening progress.");
  });
  const user = userEvent.setup();
  renderWithProviders(<TalkButton />);
  await user.click(screen.getByRole("button", { name: /Talk/ }));
  await submit(user, "Show my progress");
  await waitFor(() =>
    expect(screen.getByText("Opening progress.")).toBeInTheDocument(),
  );
  await submit(user, "Repeat that");
  expect(screen.getByText("Opening progress.")).toBeInTheDocument();
  expect(performAction).toHaveBeenCalledOnce();
});
it("closing cancels active browser synthesis", async () => {
  const synthesis = { cancel: vi.fn(), getVoices: () => [], speak: vi.fn() };
  vi.stubGlobal("speechSynthesis", synthesis);
  vi.stubGlobal(
    "SpeechSynthesisUtterance",
    class {
      constructor(public text: string) {}
    },
  );
  vi.mocked(performAction).mockImplementationOnce(async (_command, context) => {
    await context.tts.speak("Opening progress.");
  });
  const user = userEvent.setup();
  renderWithProviders(<TalkButton />);
  await user.click(screen.getByRole("button", { name: /Talk/ }));
  await submit(user, "Show my progress");
  await waitFor(() => expect(synthesis.speak).toHaveBeenCalledOnce());
  const before = synthesis.cancel.mock.calls.length;
  await user.click(screen.getByRole("button", { name: "Stop" }));
  expect(synthesis.cancel.mock.calls.length).toBeGreaterThan(before);
});
