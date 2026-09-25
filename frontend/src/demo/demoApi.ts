type DemoRole = "patient" | "caregiver" | "doctor" | "admin";

type DemoUser = {
  id: string;
  display_name: string;
  email: string;
  phone: string;
  role: DemoRole;
};

type DemoSession = {
  access: string;
  refresh: string;
  user: DemoUser;
};

const DEMO_PASSWORD = "SmaranaDemo123!";

const users: Record<DemoRole, DemoUser> = {
  patient: {
    id: "demo-user-rao",
    display_name: "Rao",
    email: "",
    phone: "",
    role: "patient",
  },
  caregiver: {
    id: "demo-caregiver-priya",
    display_name: "Priya",
    email: "priya@example.com",
    phone: "",
    role: "caregiver",
  },
  doctor: {
    id: "demo-doctor-deka",
    display_name: "Dr. Deka",
    email: "deka@example.com",
    phone: "",
    role: "doctor",
  },
  admin: {
    id: "demo-admin",
    display_name: "Administrator",
    email: "admin",
    phone: "",
    role: "admin",
  },
};

const sessions = Object.fromEntries(
  Object.entries(users).map(([role, user]) => [
    role,
    {
      access: `smarana-demo-access-${role}`,
      refresh: `smarana-demo-refresh-${role}`,
      user,
    },
  ]),
) as Record<DemoRole, DemoSession>;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function unauthorized(): Response {
  return json(
    {
      code: "credentials_not_verified",
      detail: "credentials_not_verified",
    },
    401,
  );
}

function parseBody(options: RequestInit): Record<string, unknown> {
  if (typeof options.body !== "string") return {};
  try {
    const parsed: unknown = JSON.parse(options.body);
    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function roleForAccessToken(headers: Headers): DemoRole | null {
  const authorization = headers.get("Authorization");
  const match = Object.entries(sessions).find(
    ([, session]) => authorization === `Bearer ${session.access}`,
  );
  return (match?.[0] as DemoRole | undefined) ?? null;
}

export function isDemoMode(): boolean {
  return import.meta.env.VITE_DEMO_MODE === "1";
}

/**
 * Returns a synthetic response only for explicitly enabled demo builds.
 * Returning null delegates to the real API transport.
 */
export function demoApiResponse(
  url: string,
  options: RequestInit,
  headers: Headers,
): Response | null {
  if (!isDemoMode()) return null;

  const { pathname } = new URL(url, window.location.origin);
  const method = (options.method ?? "GET").toUpperCase();
  const body = parseBody(options);

  if (method === "POST" && pathname === "/api/v1/auth/patient/login/") {
    return body.login_id === "RAO1234" && body.pin === "1234"
      ? json(sessions.patient)
      : unauthorized();
  }

  if (method === "POST" && pathname === "/api/v1/auth/login/") {
    const identifier = body.email_or_phone;
    const role =
      identifier === "priya@example.com"
        ? "caregiver"
        : identifier === "deka@example.com"
          ? "doctor"
          : identifier === "admin"
            ? "admin"
            : null;
    return role && body.password === DEMO_PASSWORD
      ? json(sessions[role])
      : unauthorized();
  }

  if (method === "POST" && pathname === "/api/v1/auth/refresh/") {
    const session = Object.values(sessions).find(
      (candidate) => candidate.refresh === body.refresh,
    );
    return session
      ? json({ access: session.access, refresh: session.refresh })
      : unauthorized();
  }

  if (method === "POST" && pathname === "/api/v1/auth/logout/") {
    return new Response(null, { status: 204 });
  }

  const role = roleForAccessToken(headers);
  if (!role) return unauthorized();

  if (method === "GET" && pathname === "/api/v1/auth/me/") {
    return json({
      user: users[role],
      role,
      preferences: { theme: "system", font_scale: "1.0", language: "en" },
      assignments: {},
    });
  }

  if (method === "PATCH" && pathname === "/api/v1/auth/me/preferences/") {
    return json({ theme: "system", font_scale: "1.0", language: body.language ?? "en" });
  }

  if (method === "GET" && pathname === "/api/v1/patients/") {
    return json({
      results: [
        {
          id: "demo-patient-rao",
          name: "Rao",
          is_primary: true,
          last_active_at: new Date().toISOString(),
          pending_on_device: false,
        },
      ],
      next: null,
    });
  }

  return null;
}
