import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";

import { ApiError } from "../../api/client";
import {
  clearOfflineFailures,
  offlineLockedUntil,
  recordOfflineFailure,
  OfflinePinRecoveryRequired,
  unlockOffline,
  lockOfflineStorage,
} from "../../db/crypto";
import { getMeta, setMeta } from "../../db/schema";
import { Keypad } from "../../shared/ui";
import { useAuthStore } from "./authStore";

const LOGIN_ID_KEY = "patient_login_id";
const DEVICE_ID_KEY = "patient_device_id";

function deviceId(): string {
  const remembered = window.localStorage.getItem(DEVICE_ID_KEY);
  if (remembered) return remembered;
  const created = crypto.randomUUID();
  window.localStorage.setItem(DEVICE_ID_KEY, created);
  return created;
}

function errorCode(error: unknown): string {
  if (
    !(error instanceof ApiError) ||
    typeof error.body !== "object" ||
    !error.body
  ) {
    return "request_not_completed";
  }
  const code = (error.body as { code?: unknown }).code;
  return typeof code === "string" ? code : "request_not_completed";
}

export function PatientLoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const patientLogin = useAuthStore((state) => state.patientLogin);
  const resumeOfflineSession = useAuthStore(
    (state) => state.resumeOfflineSession,
  );
  const refreshSession = useAuthStore((state) => state.refreshSession);
  const [loginId, setLoginId] = useState("");
  const [pin, setPin] = useState("");
  const [messageKey, setMessageKey] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [recoveryPin, setRecoveryPin] = useState("");
  const [needsRecovery, setNeedsRecovery] = useState(false);

  useEffect(() => {
    void getMeta(LOGIN_ID_KEY).then((value) =>
      setLoginId((current) => current || value || ""),
    );
  }, []);

  const submit = async (nextPin: string): Promise<void> => {
    if (!loginId.trim() || submitting) return;
    setSubmitting(true);
    setMessageKey(null);
    try {
      const credentials = {
        login_id: loginId.trim(),
        pin: nextPin,
        device_id: deviceId(),
      };
      if (needsRecovery) await patientLogin(credentials, recoveryPin);
      else await patientLogin(credentials);
      await setMeta(LOGIN_ID_KEY, loginId.trim());
      void navigate("/patient", { replace: true });
    } catch (error) {
      if (error instanceof OfflinePinRecoveryRequired || (needsRecovery && !(error instanceof ApiError))) {
        setNeedsRecovery(true);
        setMessageKey("auth.pinRecoveryHelp");
        setPin("");
        return;
      }
      const code = errorCode(error);
      if (code === "request_not_completed") {
        const lockedUntil = await offlineLockedUntil();
        if (lockedUntil) {
          setMessageKey("auth.locked_caregiver_told");
        } else {
          const candidate = await unlockOffline(nextPin);
          const rememberedLogin = await getMeta(LOGIN_ID_KEY);
          const unlocked = rememberedLogin === loginId.trim() ? candidate : null;
          if (unlocked) {
            await clearOfflineFailures();
            resumeOfflineSession(unlocked.refreshToken, unlocked.user);
            window.addEventListener("online", () => void refreshSession(), {
              once: true,
            });
            void navigate("/patient", { replace: true });
            return;
          }
          lockOfflineStorage();
          const newLock = await recordOfflineFailure();
          setMessageKey(
            newLock ? "auth.locked_caregiver_told" : "auth.pin_no_match",
          );
        }
      } else {
        setMessageKey(
          code === "locked"
            ? "auth.locked_caregiver_told"
            : "auth.pin_no_match",
        );
      }
      setPin("");
    } finally {
      setSubmitting(false);
    }
  };

  const addDigit = (digit: string): void => {
    if (pin.length >= 4) return;
    const nextPin = `${pin}${digit}`;
    setPin(nextPin);
    if (nextPin.length === 4) void submit(nextPin);
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-5 p-4">
      <button
        className="min-h-touch self-start px-3 font-bold"
        type="button"
        onClick={() => void navigate("/")}
      >
        ← {t("auth.back")}
      </button>
      <header className="text-center">
        <h1 className="text-3xl font-bold">{t("auth.patientPinTitle")}</h1>
        <p className="text-muted">{t("auth.patientPinHelp")}</p>
      </header>
      <label className="space-y-2 font-bold">
        <span>{t("auth.loginId")}</span>
        <input
          autoCapitalize="characters"
          className="min-h-touch w-full rounded-card border-2 border-primary bg-surface px-4 text-text"
          value={loginId}
          onChange={(event) => setLoginId(event.target.value)}
        />
      </label>
      <div
        aria-label={t("auth.pinEntered", { count: pin.length })}
        className="flex justify-center gap-4 text-4xl"
        role="status"
      >
        {[0, 1, 2, 3].map((index) => (
          <span aria-hidden="true" key={index}>
            {index < pin.length ? "●" : "○"}
          </span>
        ))}
      </div>
      {messageKey ? (
        <p
          className="rounded-card bg-calm p-4 text-center font-bold"
          role="alert"
        >
          {t(messageKey)}
        </p>
      ) : null}
      <Keypad
        backspaceLabel={t("auth.backspace")}
        disabled={submitting}
        label={t("auth.pinKeypad")}
        onBackspace={() => setPin((value) => value.slice(0, -1))}
        onDigit={addDigit}
      />
      {needsRecovery && <label className="space-y-2 font-bold">
        <span>{t("auth.previousDevicePin")}</span>
        <input type="password" inputMode="numeric" autoComplete="off" maxLength={4} value={recoveryPin} onChange={(event) => setRecoveryPin(event.target.value.replace(/\D/g, ""))} />
      </label>}
      <Link to="/login/user">{t("registration.passwordLogin")}</Link>
      <Link to="/register">{t("registration.create")}</Link>
    </main>
  );
}
