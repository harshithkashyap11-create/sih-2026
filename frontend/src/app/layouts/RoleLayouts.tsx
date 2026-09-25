import { ConfusedMode } from "../../features/patient/confused/ConfusedMode";
import { useCalmStore } from "../../features/patient/confused/store";
import { SectionHeader } from "../../features/patient/walkthrough/SectionHeader";
import { Suspense } from "react";
import { useTranslation } from "react-i18next";
import {
  Link,
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
} from "react-router-dom";
import {
  ArrowLeft,
  CalendarCheck,
  Gamepad2,
  HeartHandshake,
  Home,
  Images,
  LogOut,
  Settings,
  Stethoscope,
} from "lucide-react";

import type { RoleEnum } from "../../api/generated/models";
import { useAuthStore } from "../../features/auth/authStore";
import { useIdleLogout } from "../../shared/hooks/useIdleLogout";
import { useIdlePrompt } from "../../shared/hooks/useIdlePrompt";
import { ConfirmDialog, PageState } from "../../shared/ui";
import { SosButton } from "../../features/patient/sos/SosButton";
import { OfflineChip } from "../../shared/ui/OfflineChip";

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
    ? [{ label: t("auth.dashboard"), path: "/doctor" }]
    : [{ label: t("auth.dashboard"), path: "/caregiver" }];

  return (
    <div className="pro-layout min-h-screen bg-bg text-text">
      <a
        className="sr-focusable rounded-control bg-primary px-4 py-3 font-bold text-primary-text"
        href="#main-content"
      >
        {t("professional.skipMain")}
      </a>
      <header className="glass-surface sticky top-0 z-30 border-x-0 border-t-0 px-5">
        <div className="mx-auto flex min-h-[76px] max-w-7xl items-center justify-between gap-4">
          <button
            className="flex items-center gap-3 rounded-control text-left"
            type="button"
            onClick={() => void navigate(homePath)}
          >
            <span
              className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-primary-text shadow-soft"
              aria-hidden="true"
            >
              {isDoctor ? (
                <Stethoscope className="h-6 w-6" />
              ) : (
                <HeartHandshake className="h-6 w-6" />
              )}
            </span>
            <span>
              <span className="block text-xs font-bold uppercase tracking-[0.16em] text-primary">
                {t("professional.careBrand")}
              </span>
              <strong className="block text-lg leading-tight">
                {user?.display_name}
              </strong>
            </span>
          </button>
          <div className="flex items-center gap-3">
            <span className="hidden rounded-pill bg-calm px-3 py-1 text-sm font-semibold text-primary sm:inline-flex">
              {isDoctor
                ? t("professional.doctorWorkspace")
                : t("professional.caregiverWorkspace")}
            </span>
            <button
              aria-label={t("auth.logout")}
              className="flex min-h-[44px] items-center gap-2 rounded-pill border border-border bg-surface px-4 text-sm font-semibold hover:border-primary hover:bg-calm"
              type="button"
              onClick={() => void logout().then(() => void navigate("/"))}
            >
              <LogOut aria-hidden="true" className="h-4 w-4" />
              {t("auth.logout")}
            </button>
          </div>
        </div>
      </header>
      <div className="mx-auto grid max-w-7xl gap-6 p-4 sm:p-6 md:grid-cols-[14rem_1fr] md:p-8">
        <nav
          aria-label={t("auth.navigation")}
          className="h-fit rounded-card border border-border bg-surface p-3 shadow-soft md:sticky md:top-28"
        >
          <p className="px-3 pb-2 text-xs font-bold uppercase tracking-[0.14em] text-muted">
            {t("professional.workspace")}
          </p>
          {navItems.map((item) => {
            const active = location.pathname === item.path;
            return (
              <Link
                className={`flex min-h-[48px] items-center rounded-control px-3 font-semibold ${active ? "bg-primary text-primary-text shadow-soft" : "text-text hover:bg-calm"}`}
                key={item.path}
                to={item.path}
                aria-current={active ? "page" : undefined}
              >
                <Home aria-hidden="true" className="mr-3 h-5 w-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <main className="min-w-0" id="main-content" tabIndex={-1}>
          <Suspense
            fallback={<PageState title={t("health.loading")} tone="loading" />}
          >
            <Outlet />
          </Suspense>
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
  const location = useLocation();
  const logout = useAuthStore((state) => state.logout);
  const { confirmPresence, isPromptOpen } = useIdlePrompt(30 * 60 * 1000);
  const focusedTask =
    /^\/patient\/games\/[^/]+$/.test(location.pathname) ||
    location.pathname === "/patient/memories/quiz";
  const isHome = location.pathname === "/patient";
  const navItems = [
    {
      key: "home",
      labelKey: "patient.nav.home",
      route: "/patient",
      icon: Home,
      end: true,
    },
    {
      key: "play",
      labelKey: "patient.nav.play",
      route: "/patient/games",
      icon: Gamepad2,
      end: false,
    },
    {
      key: "memories",
      labelKey: "home.tiles.memories",
      route: "/patient/memories",
      icon: Images,
      end: false,
    },
    {
      key: "routine",
      labelKey: "home.tiles.routine",
      route: "/patient/routine",
      icon: CalendarCheck,
      end: false,
    },
    {
      key: "settings",
      labelKey: "patient.nav.settings",
      route: "/patient/settings",
      icon: Settings,
      end: false,
    },
  ] as const;

  const leave = (): void => {
    void logout().then(() => void navigate("/", { replace: true }));
  };

  return (
    <div
      className={`patient-layout mx-auto flex min-h-screen max-w-[820px] flex-col bg-bg text-text ${focusedTask ? "patient-task-layout" : ""} ${calmMode ? "calm-mode" : ""}`}
    >
      <a
        className="sr-focusable rounded-control bg-primary px-4 py-3 font-bold text-primary-text"
        href="#patient-content"
      >
        {t("professional.skipMain")}
      </a>
      <header className="glass-surface sticky top-0 z-30 grid min-h-touch grid-cols-[1fr_auto_1fr] items-center gap-2 border-x-0 border-t-0 px-3 sm:px-5">
        {!isHome ? (
          <button
            aria-label={t("auth.back")}
            className="flex min-h-touch items-center gap-2 justify-self-start rounded-control px-2 font-bold hover:bg-calm"
            type="button"
            onClick={() => void navigate(-1)}
          >
            <ArrowLeft aria-hidden="true" className="h-6 w-6" />
            <span className="hidden sm:inline">{t("auth.back")}</span>
          </button>
        ) : (
          <span />
        )}
        <Link
          className="flex items-center gap-2 rounded-control px-2 py-1"
          to="/patient"
        >
          <span
            aria-hidden="true"
            className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary text-primary-text"
          >
            <HeartHandshake className="h-5 w-5" />
          </span>
          <strong className="text-center">{t("patient.title")}</strong>
        </Link>
        <div className="justify-self-end">
          <OfflineChip />
        </div>
      </header>
      <main
        className="flex-1 p-4 pb-24 sm:p-6"
        id="patient-content"
        tabIndex={-1}
      >
        {!isHome && !focusedTask ? (
          <SectionHeader key={section} section={section} />
        ) : null}
        <ConfusedMode />
        <Suspense
          fallback={<PageState title={t("health.loading")} tone="loading" />}
        >
          <Outlet />
        </Suspense>
      </main>
      {!focusedTask ? (
        <nav
          aria-label={t("patient.navigation")}
          className="glass-surface fixed inset-x-2 bottom-2 z-20 mx-auto grid min-h-touch max-w-[790px] grid-cols-5 overflow-hidden rounded-card p-1.5"
        >
          {navItems.map(({ end, icon: Icon, key, labelKey, route }) => (
            <NavLink
              aria-label={t(labelKey)}
              className={({ isActive }) =>
                `flex min-h-touch flex-col items-center justify-center gap-1 rounded-control px-1 text-sm font-bold ${isActive ? "bg-primary text-primary-text shadow-soft" : "text-muted hover:bg-calm hover:text-text"}`
              }
              end={end}
              key={key}
              to={route}
            >
              <Icon aria-hidden="true" className="h-6 w-6" />
              <span>{t(labelKey)}</span>
            </NavLink>
          ))}
        </nav>
      ) : null}
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
