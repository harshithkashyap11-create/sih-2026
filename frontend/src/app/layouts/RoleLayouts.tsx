import { ConfusedMode } from "../../features/patient/confused/ConfusedMode";
import { useCalmStore } from "../../features/patient/confused/store";
import { SectionHeader } from "../../features/patient/walkthrough/SectionHeader";
import type { PropsWithChildren } from "react";
import { useTranslation } from "react-i18next";
import {
  Link,
  Navigate,
  Outlet,
  useLocation,
  useNavigate,
} from "react-router-dom";

import type { RoleEnum } from "../../api/generated/models";
import { useAuthStore } from "../../features/auth/authStore";
import { useIdleLogout } from "../../shared/hooks/useIdleLogout";
import { useIdlePrompt } from "../../shared/hooks/useIdlePrompt";
import { ConfirmDialog } from "../../shared/ui";
import { SosButton } from "../../features/patient/sos/SosButton";
import { TalkButton } from "../../shared/ui/TalkButton";
import { OfflineChip } from "../../shared/ui/OfflineChip";

export function RequireRole({
  allowed,
  children,
}: PropsWithChildren<{ allowed: RoleEnum[] }>) {
  const role = useAuthStore((state) => state.role);
  return role && allowed.includes(role) ? (
    children
  ) : (
    <Navigate replace to="/" />
  );
}

export function ProLayout() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  useIdleLogout();

  const isDoctor = user?.role === "doctor";
  const homePath = isDoctor ? "/doctor" : "/caregiver";
  const navItems = isDoctor
    ? [{ label: "Dashboard", path: "/doctor" }]
    : [{ label: "Dashboard", path: "/caregiver" }];

  return (
    <div className="pro-layout min-h-screen bg-bg text-text">
      <header className="border-b border-primary/10 bg-surface px-5 shadow-sm">
        <div className="mx-auto flex min-h-[72px] max-w-6xl items-center justify-between gap-4">
          <button
            className="text-left"
            type="button"
            onClick={() => void navigate(homePath)}
          >
            <span className="block text-xs font-bold uppercase tracking-[0.16em] text-muted">
              Smārana care
            </span>
            <strong className="text-lg">{user?.display_name}</strong>
          </button>
          <div className="flex items-center gap-3">
            <span className="hidden rounded-full bg-calm px-3 py-1 text-sm font-semibold text-primary sm:inline-flex">
              {isDoctor ? "Doctor workspace" : "Caregiver workspace"}
            </span>
            <button
              className="min-h-[44px] rounded-full border border-primary/20 px-4 text-sm font-semibold hover:bg-calm"
              type="button"
              onClick={() => void logout().then(() => void navigate("/"))}
            >
              {t("auth.logout")}
            </button>
          </div>
        </div>
      </header>
      <div className="mx-auto grid max-w-6xl gap-6 p-5 md:grid-cols-[13rem_1fr] md:p-8">
        <nav
          aria-label={t("auth.navigation")}
          className="h-fit rounded-card border border-primary/10 bg-surface p-3 shadow-sm"
        >
          <p className="px-3 pb-2 text-xs font-bold uppercase tracking-[0.14em] text-muted">
            Workspace
          </p>
          {navItems.map((item) => {
            const active = location.pathname === item.path;
            return (
              <Link
                className={`flex min-h-[48px] items-center rounded-xl px-3 font-semibold ${active ? "bg-primary text-primary-text" : "text-text hover:bg-calm"}`}
                key={item.path}
                to={item.path}
                aria-current={active ? "page" : undefined}
              >
                <span aria-hidden="true" className="mr-3 text-lg">⌂</span>
                {item.label}
              </Link>
            );
          })}
        </nav>
        <main className="min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export function PatientLayout() {
  const calmMode = useCalmStore((s) => s.calmMode);
  const section = useLocation().pathname.split("/")[2] || "home";
  const { t } = useTranslation();
  const navigate = useNavigate();
  const logout = useAuthStore((state) => state.logout);
  const { confirmPresence, isPromptOpen } = useIdlePrompt(30 * 60 * 1000);
  const navItems = ["home", "play", "wellness", "family", "settings"] as const;
  const navRoutes = [
    "/patient",
    "/patient/games",
    "/patient/calm",
    "/patient/people",
    "/patient/settings",
  ] as const;

  const leave = (): void => {
    void logout().then(() => void navigate("/", { replace: true }));
  };

  return (
    <div
      className={`mx-auto flex min-h-screen max-w-[720px] flex-col patient-layout bg-bg text-text ${calmMode ? "calm-mode" : ""}`}
    >
      <header className="sticky top-0 z-10 grid min-h-touch grid-cols-[1fr_auto_1fr] items-center gap-2 bg-surface px-3 shadow-card">
        <button
          className="min-h-touch justify-self-start px-2 font-bold"
          type="button"
          onClick={() => void navigate(-1)}
        >
          ← {t("auth.back")}
        </button>
        <strong className="text-center">{t("patient.title")}</strong>
        <div className="flex items-center">
          <TalkButton />
        </div>
        <OfflineChip />
      </header>
      <main className="flex-1 p-4 pb-24">
        <SectionHeader key={section} section={section} />
        <ConfusedMode />
        <Link className="block min-h-touch p-4" to="/patient/sleep">
          {t("wellness.title")}
        </Link>
        <Outlet />
      </main>
      <nav
        aria-label={t("patient.navigation")}
        className="fixed inset-x-0 bottom-0 z-10 mx-auto grid min-h-touch max-w-[720px] grid-cols-5 border-t border-primary/20 bg-surface"
      >
        {navItems.map((item, index) => (
          <button
            className="min-h-touch px-1 text-sm font-bold"
            key={item}
            type="button"
            onClick={() => void navigate(navRoutes[index] ?? "/patient")}
          >
            <span aria-hidden="true" className="block text-2xl">
              {item === "home"
                ? "⌂"
                : item === "play"
                  ? "▶"
                  : item === "wellness"
                    ? "♥"
                    : item === "family"
                      ? "♧"
                      : "⚙"}
            </span>
            {t(`patient.nav.${item}`)}
          </button>
        ))}
      </nav>
      <ConfirmDialog
        noLabel={t("patient.idle.no")}
        open={isPromptOpen}
        title={t("patient.idle.title")}
        ttsLabel={t("patient.listen")}
        yesLabel={t("patient.idle.yes")}
        onNo={leave}
        onYes={confirmPresence}
      />
      <SosButton />
    </div>
  );
}

export function RoleHome({ role }: { role: RoleEnum }) {
  const { t } = useTranslation();
  return <h1 className="text-3xl font-bold">{t(`auth.layout.${role}`)}</h1>;
}
