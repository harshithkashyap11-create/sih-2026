import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { expect, test, vi } from "vitest";
import { DoctorAlertsTab } from "./DoctorAlertsTab";

const api = vi.hoisted(() => ({ alerts: vi.fn(), dismiss: vi.fn() }));
vi.mock("../caregiver/api", () => ({ caregiverApi: { alerts: api.alerts } }));
vi.mock("../../api/client", () => ({ apiClient: api.dismiss }));

test("doctor can read patient alert details and dismiss with a review note", async () => {
  api.alerts.mockResolvedValue([{ id: "alert-fixture", title: "Missed reminders", explanation: "Three reminders need review", severity: "high", status: "open", triggered_at: "2026-09-18T02:30:00Z", evidence: { reminder_ids: ["reminder-fixture"] } }]);
  api.dismiss.mockResolvedValue({});
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><DoctorAlertsTab patientId="patient-fixture" /></QueryClientProvider>);
  expect(await screen.findByText("Three reminders need review")).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Review note"), { target: { value: "Reviewed with care team" } });
  fireEvent.click(screen.getByRole("button", { name: "Dismiss alert" }));
  await waitFor(() => expect(api.dismiss).toHaveBeenCalledWith("/api/v1/alerts/alert-fixture/dismiss/", { method: "POST", body: JSON.stringify({ note: "Reviewed with care team" }) }));
  client.clear();
});
