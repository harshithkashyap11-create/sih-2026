import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";

import { ApiError } from "../../api/client";
import { storeOfflineSecrets, unlockOffline, OfflinePinRecoveryRequired } from "../../db/crypto";
import { renderWithProviders } from "../../test/utils";
import { useAuthStore } from "./authStore";
import { PatientLoginPage } from "./PatientLoginPage";

vi.mock("../../db/schema", () => ({
  setSessionUser: vi.fn(),
  getMeta: vi.fn().mockResolvedValue("RAO1234"),
  setMeta: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../db/crypto", () => ({
  OfflinePinRecoveryRequired: class extends Error {},
  lockOfflineStorage: vi.fn(),
  clearOfflineFailures: vi.fn().mockResolvedValue(undefined),
  offlineLockedUntil: vi.fn().mockResolvedValue(null),
  recordOfflineFailure: vi.fn().mockResolvedValue(null),
  storeOfflineSecrets: vi.fn().mockResolvedValue(undefined),
  unlockOffline: vi.fn().mockResolvedValue(null),
}));

const session = {
  access: "access",
  refresh: "refresh",
  user: {
    id: "1",
    display_name: "Rao Garu",
    email: "",
    phone: "",
    role: "patient" as const,
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  useAuthStore.setState({
    accessToken: null,
    role: null,
    user: null,
  });
});

test("auto-submits after four digits with the remembered login id", async () => {
  const user = userEvent.setup();
  const patientLogin = vi.fn().mockResolvedValue(session);
  useAuthStore.setState({ patientLogin });
  renderWithProviders(<PatientLoginPage />);

  expect(await screen.findByDisplayValue("RAO1234")).toBeVisible();
  for (const digit of ["1", "2", "3", "4"]) {
    await user.click(screen.getByRole("button", { name: digit }));
  }

  await waitFor(() =>
    expect(patientLogin).toHaveBeenCalledWith(
      expect.objectContaining({ login_id: "RAO1234", pin: "1234" }),
    ),
  );
  // The authentication store owns vault setup; the page must not initialize it twice.
  expect(storeOfflineSecrets).not.toHaveBeenCalled();
});

test("offers explicit previous-device-PIN recovery without overwriting saved records", async () => {
  const user = userEvent.setup();
  const patientLogin = vi.fn().mockRejectedValueOnce(new OfflinePinRecoveryRequired()).mockResolvedValueOnce(session);
  useAuthStore.setState({ patientLogin });
  renderWithProviders(<PatientLoginPage />);
  await screen.findByDisplayValue("RAO1234");
  for (const digit of ["1", "2", "3", "4"]) await user.click(screen.getByRole("button", { name: digit }));
  await user.type(await screen.findByLabelText("Previous device PIN"), "5678");
  for (const digit of ["1", "2", "3", "4"]) await user.click(screen.getByRole("button", { name: digit }));
  await waitFor(() => expect(patientLogin).toHaveBeenLastCalledWith(expect.objectContaining({ pin: "1234" }), "5678"));
  expect(storeOfflineSecrets).not.toHaveBeenCalled();
});

test("unlocks from encrypted local credentials when the network is unavailable", async () => {
  const user = userEvent.setup();
  const resumeOfflineSession = vi.fn();
  useAuthStore.setState({
    patientLogin: vi.fn().mockRejectedValue(new TypeError("offline")),
    resumeOfflineSession,
  });
  vi.mocked(unlockOffline).mockResolvedValueOnce({
    refreshToken: "saved-refresh",
    user: session.user,
  });
  renderWithProviders(<PatientLoginPage />);

  await screen.findByDisplayValue("RAO1234");
  for (const digit of ["1", "2", "3", "4"]) {
    await user.click(screen.getByRole("button", { name: digit }));
  }

  await waitFor(() =>
    expect(resumeOfflineSession).toHaveBeenCalledWith(
      "saved-refresh",
      session.user,
    ),
  );
});

test("shows gentle caregiver copy when the PIN is locked", async () => {
  const user = userEvent.setup();
  useAuthStore.setState({
    patientLogin: vi
      .fn()
      .mockRejectedValue(new ApiError(423, { code: "locked" })),
  });
  renderWithProviders(<PatientLoginPage />);

  await screen.findByDisplayValue("RAO1234");
  for (const digit of ["1", "2", "3", "4"]) {
    await user.click(screen.getByRole("button", { name: digit }));
  }

  expect(
    await screen.findByText(
      "Let's take a break. Ask your caregiver for help.",
    ),
  ).toBeVisible();
});
