import { fireEvent, screen, waitFor } from "@testing-library/react";
import { Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { renderWithProviders } from "../../test/utils";
import { CaregiverPortal } from "./CaregiverPortal";
import { ScheduleTab } from "./schedule/ScheduleTab";

const patient = {
  id: "p1",
  name: "Rao",
  is_primary: true,
  last_active_at: "2026-09-14T08:00:00Z",
  pending_on_device: true,
};
const json = (body: unknown, status = 200) =>
  Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn((input: RequestInfo | URL) => {
      const url = input instanceof Request ? input.url : input.toString();
      if (url.endsWith("/patients/"))
        return json([
          patient,
          { ...patient, id: "p2", name: "Mira", is_primary: false },
        ]);
      if (url.includes("adherence"))
        return json({
          days: Array.from({ length: 7 }, (_, index) => ({
            date: `2026-09-${8 + index}`,
            reminders:
              index === 6
                ? [
                    {
                      id: "r1",
                      title: "Morning tablet",
                      category: "medicine",
                      scheduled_at: "2026-09-14T08:00:00Z",
                      status: "taken",
                      responded_at: "2026-09-14T08:05:00Z",
                    },
                  ]
                : [],
          })),
          summary: { taken: 1 },
        });
      return json([]);
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

function Location() {
  return <output>{useLocation().pathname}</output>;
}

test("switching patient updates the URL and today shows status chips", async () => {
  renderWithProviders(
    <Routes>
      <Route
        path="/caregiver/:patientId/:tab"
        element={
          <>
            <CaregiverPortal />
            <Location />
          </>
        }
      />
    </Routes>,
    { route: "/caregiver/p1/today" },
  );
  expect(await screen.findByText("Morning tablet")).toBeInTheDocument();
  expect(screen.getByText("Taken", { selector: "span" })).toBeInTheDocument();
  expect(screen.getByText("Pending on device: Yes")).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Patient"), {
    target: { value: "p2" },
  });
  expect(await screen.findByText("/caregiver/p2/today")).toBeInTheDocument();
});

test("schedule submits expected payload and hides doctor edit action", async () => {
  const fetchMock = vi.mocked(fetch);
  fetchMock.mockImplementation((input, init) => {
    if (
      (input instanceof Request ? input.url : input.toString()).includes(
        "routine-conflicts",
      )
    )
      return json({ warnings: [] });
    if (init?.method === "POST") {
      const body = typeof init.body === "string" ? init.body : "{}";
      const parsed = JSON.parse(body) as Record<string, unknown>;
      return json(
        { id: "new", ...parsed, source: "caregiver", set_by: "Priya" },
        201,
      );
    }
    return json([
      {
        id: "d1",
        title: "Prescription",
        category: "medicine",
        time_of_day: "09:00:00",
        days_of_week: [0],
        start_date: "2026-09-14",
        end_date: null,
        icon: "",
        note: "",
        source: "doctor",
        set_by: "Dr. Deka",
      },
    ]);
  });
  renderWithProviders(<ScheduleTab patientId="p1" />);
  expect(await screen.findByText("🔒 Set by Dr. Deka")).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Edit" }),
  ).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Title"), {
    target: { value: "Evening tea" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save routine item" }));
  await waitFor(() =>
    expect(
      fetchMock.mock.calls.some(
        ([input, options]) =>
          (input instanceof Request ? input.url : input.toString()).endsWith(
            "routine-items/",
          ) && options?.method === "POST",
      ),
    ).toBe(true),
  );
  const post = fetchMock.mock.calls.find(
    ([input, options]) =>
      (input instanceof Request ? input.url : input.toString()).endsWith(
        "routine-items/",
      ) && options?.method === "POST",
  );
  expect(post?.[0]).toBe("/api/v1/patients/p1/routine-items/");
  expect(typeof post?.[1]?.body === "string" ? post[1].body : "").toContain(
    '"title":"Evening tea"',
  );
});

test("routine conflict requires confirmation before creating an item", async () => {
  const fetchMock = vi.mocked(fetch);
  fetchMock.mockImplementation((input, init) => {
    const url = input instanceof Request ? input.url : input.toString();
    if (url.endsWith("routine-conflicts/"))
      return json({ warnings: [{ id: "nearby", title: "Morning water" }] });
    if (init?.method === "POST") return json({ id: "new" }, 201);
    return json([]);
  });
  renderWithProviders(<ScheduleTab patientId="p1" />);
  fireEvent.change(screen.getByLabelText("Title"), {
    target: { value: "Morning tea" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save routine item" }));
  expect(
    await screen.findByRole("dialog", { name: "Routine conflicts" }),
  ).toBeInTheDocument();
  const creations = () =>
    fetchMock.mock.calls.filter(
      ([input, options]) =>
        (input instanceof Request ? input.url : input.toString()).endsWith(
          "routine-items/",
        ) && options?.method === "POST",
    );
  expect(creations()).toHaveLength(0);
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(creations()).toHaveLength(0);
  fireEvent.click(screen.getByRole("button", { name: "Save routine item" }));
  expect(
    await screen.findByRole("dialog", { name: "Routine conflicts" }),
  ).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Save anyway" }));
  await waitFor(() => expect(creations()).toHaveLength(1));
});
