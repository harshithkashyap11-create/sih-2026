import { create } from "zustand";

import {
  v1AuthLoginCreate,
  v1AuthLogoutCreate,
  v1AuthPatientLoginCreate,
  v1AuthRefreshCreate,
} from "../../api/generated/smarana";
import type {
  LoginResponse,
  PatientLogin,
  ProfessionalLogin,
  RoleEnum,
  UserSummary,
} from "../../api/generated/models";
import {
  apiClient,
  ApiError,
  setApiAccessToken,
  setApiRefreshHandler,
} from "../../api/client";
import {
  clearOfflineSecrets,
  revokeOfflineAccess,
  storeOfflineSecrets,
  changeOfflinePin,
  lockOfflineStorage,
  updateEncryptedRefreshToken,
} from "../../db/crypto";

import { activatePatient, setSessionUser } from "../../db/schema";

let refreshToken: string | null = null;
let refreshPromise: Promise<string | null> | null = null;

interface AuthState {
  accessToken: string | null;
  user: UserSummary | null;
  role: RoleEnum | null;
  login: (
    credentials: ProfessionalLogin,
    offlinePin?: string,
  ) => Promise<LoginResponse>;
  patientLogin: (credentials: PatientLogin, previousPin?: string) => Promise<LoginResponse>;
  setSession: (session: LoginResponse) => void;
  clearSession: () => void;
  resumeOfflineSession: (refresh: string, user: UserSummary) => void;
  refreshSession: () => Promise<string | null>;
  logout: () => Promise<void>;
}

function applySession(session: LoginResponse): void {
  setSessionUser(session.user.id);
  refreshToken = session.refresh;
  setApiAccessToken(session.access);
  useAuthStore.setState({
    accessToken: session.access,
    user: session.user,
    role: session.user.role,
  });
}

function clearSession(): void {
  lockOfflineStorage();
  setSessionUser(null);
  refreshToken = null;
  setApiAccessToken(null);
  useAuthStore.setState({ accessToken: null, user: null, role: null });
}

async function refreshAccessToken(): Promise<string | null> {
  const token = refreshToken;
  if (!token) {
    clearSession();
    return null;
  }

  refreshPromise ??= (async () => {
    try {
      const rotated = await v1AuthRefreshCreate(
        { refresh: token },
        { skipAuthRefresh: true },
      );
      if (refreshToken !== token) return null;
      refreshToken = rotated.refresh;
      await updateEncryptedRefreshToken(rotated.refresh);
      setApiAccessToken(rotated.access);
      useAuthStore.setState({ accessToken: rotated.access });
      return rotated.access;
    } catch (error) {
      if (
        refreshToken === token &&
        error instanceof ApiError &&
        [400, 401, 403].includes(error.status)
      ) {
        clearSession();
        await revokeOfflineAccess();
      }
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

export const useAuthStore = create<AuthState>(() => ({
  accessToken: null,
  user: null,
  role: null,
  login: async (credentials, offlinePin) => {
    const session = await v1AuthLoginCreate(credentials, {
      skipAuthRefresh: true,
    });
    if (session.user.role === "patient") {
      setApiAccessToken(session.access);
      try {
        const patients = await apiClient<{ results: Array<{ id: string }> }>(
          "/api/v1/patients/",
          { method: "GET" },
        );
        const patient = patients.results[0];
        if (!patient) throw new Error("Patient profile unavailable");
        await storeOfflineSecrets(
          offlinePin || credentials.password,
          session.refresh,
          session.user,
        );
        applySession(session);
        await activatePatient(patient.id, session.user.id);
      } catch (error) {
        clearSession();
        throw error;
      }
      return session;
    }
    applySession(session);
    return session;
  },
  patientLogin: async (credentials, previousPin) => {
    const session = await v1AuthPatientLoginCreate(credentials, {
      skipAuthRefresh: true,
    });
    setApiAccessToken(session.access);
    try {
      const patients = await apiClient<{ results: Array<{ id: string }> }>(
        "/api/v1/patients/",
        { method: "GET" },
      );
      const patient = patients.results[0];
      if (!patient) throw new Error("Patient profile unavailable");
      if (previousPin) await changeOfflinePin(previousPin, credentials.pin, session.user.id);
      await storeOfflineSecrets(credentials.pin, session.refresh, session.user);
      applySession(session);
      await activatePatient(patient.id, session.user.id);
    } catch (error) {
      clearSession();
      throw error;
    }
    return session;
  },
  setSession: applySession,
  clearSession,
  resumeOfflineSession: (refresh, user) => {
    setSessionUser(user.id);
    refreshToken = refresh;
    setApiAccessToken(null);
    useAuthStore.setState({ accessToken: null, user, role: "patient" });
  },
  refreshSession: refreshAccessToken,
  logout: async () => {
    const token = refreshToken;
    const access = useAuthStore.getState().accessToken;
    clearSession();
    await clearOfflineSecrets();
    if (!token || !access) return;

    try {
      await v1AuthLogoutCreate(
        { refresh: token },
        {
          headers: { Authorization: `Bearer ${access}` },
          skipAuthRefresh: true,
        },
      );
    } catch {
      // Local session removal is authoritative even when server revocation is unavailable.
    }
  },
}));

if (typeof window !== "undefined")
  window.addEventListener("smarana:vault-locked", clearSession);
setApiRefreshHandler(refreshAccessToken);
