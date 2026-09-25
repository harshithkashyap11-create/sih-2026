import { afterEach, describe, expect, test, vi } from "vitest";

import { apiClient } from "../api/client";
import { demoApiResponse } from "./demoApi";

function request(
  path: string,
  body?: Record<string, unknown>,
  access?: string,
): Response | null {
  const headers = new Headers();
  if (access) headers.set("Authorization", `Bearer ${access}`);
  return demoApiResponse(
    path,
    {
      method: body ? "POST" : "GET",
      body: body ? JSON.stringify(body) : undefined,
    },
    headers,
  );
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

test("delegates to the real transport when demo mode is disabled", () => {
  vi.stubEnv("VITE_DEMO_MODE", "0");
  expect(
    request("/api/v1/auth/patient/login/", {
      login_id: "RAO1234",
      pin: "1234",
    }),
  ).toBeNull();
});

test("accepts only the documented patient demo credentials", async () => {
  vi.stubEnv("VITE_DEMO_MODE", "1");
  const accepted = request("/api/v1/auth/patient/login/", {
    login_id: "RAO1234",
    pin: "1234",
  });
  expect(accepted?.status).toBe(200);
  expect(await accepted?.json()).toMatchObject({
    user: { display_name: "Rao", role: "patient" },
  });

  const rejected = request("/api/v1/auth/patient/login/", {
    login_id: "RAO1234",
    pin: "9999",
  });
  expect(rejected?.status).toBe(401);
});

test("apiClient uses the demo response without contacting the network", async () => {
  vi.stubEnv("VITE_DEMO_MODE", "1");
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);

  const session = await apiClient<{ user: { role: string } }>(
    "/api/v1/auth/patient/login/",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ login_id: "RAO1234", pin: "1234" }),
      skipAuthRefresh: true,
    },
  );

  expect(session.user.role).toBe("patient");
  expect(fetchMock).not.toHaveBeenCalled();
});

describe.each([
  ["priya@example.com", "caregiver"],
  ["deka@example.com", "doctor"],
  ["admin", "admin"],
])("professional demo login for %s", (identifier, role) => {
  test(`creates a ${role} session with the documented password`, async () => {
    vi.stubEnv("VITE_DEMO_MODE", "1");
    const response = request("/api/v1/auth/login/", {
      email_or_phone: identifier,
      password: "SmaranaDemo123!",
    });
    expect(response?.status).toBe(200);
    expect(await response?.json()).toMatchObject({ user: { role } });
  });

  test("rejects a different password", () => {
    vi.stubEnv("VITE_DEMO_MODE", "1");
    expect(
      request("/api/v1/auth/login/", {
        email_or_phone: identifier,
        password: "wrong",
      })?.status,
    ).toBe(401);
  });
});

test("serves the demo patient list only to a demo session", async () => {
  vi.stubEnv("VITE_DEMO_MODE", "1");
  expect(request("/api/v1/patients/")?.status).toBe(401);

  const response = request(
    "/api/v1/patients/",
    undefined,
    "smarana-demo-access-patient",
  );
  expect(response?.status).toBe(200);
  expect(await response?.json()).toMatchObject({
    results: [{ id: "demo-patient-rao", name: "Rao" }],
  });
});

test("rotates only issued demo refresh tokens", async () => {
  vi.stubEnv("VITE_DEMO_MODE", "1");
  const accepted = request("/api/v1/auth/refresh/", {
    refresh: "smarana-demo-refresh-doctor",
  });
  expect(accepted?.status).toBe(200);
  expect(await accepted?.json()).toEqual({
    access: "smarana-demo-access-doctor",
    refresh: "smarana-demo-refresh-doctor",
  });
  expect(
    request("/api/v1/auth/refresh/", { refresh: "not-issued" })?.status,
  ).toBe(401);
});
