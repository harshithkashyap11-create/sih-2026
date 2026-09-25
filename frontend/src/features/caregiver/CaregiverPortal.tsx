import { useQuery } from "@tanstack/react-query";
import { lazy, Suspense, useState } from "react";
import { useTranslation } from "react-i18next";
import { Navigate, NavLink, useNavigate, useParams } from "react-router-dom";
import {
  Bell,
  CalendarDays,
  ChevronDown,
  CircleCheck,
  Clock3,
  FileText,
  HeartPulse,
  History,
  Images,
  ListChecks,
  Pill,
  Settings2,
  ShieldAlert,
  Stethoscope,
  UserRound,
  Users,
} from "lucide-react";

import { caregiverApi } from "./api";
import { CARE_TIMEZONE } from "../../db/reminders";
import { PageState, StatusBadge } from "../../shared/ui";

const CheckInPanel = lazy(() =>
  import("./alerts/CheckInPanel").then((module) => ({
    default: module.CheckInPanel,
  })),
);
const NotificationPreferences = lazy(() =>
  import("./alerts/NotificationPreferences").then((module) => ({
    default: module.NotificationPreferences,
  })),
);
const ReportsTab = lazy(() =>
  import("./ReportsTab").then((module) => ({ default: module.ReportsTab })),
);
const ScheduleTab = lazy(() =>
  import("./schedule/ScheduleTab").then((module) => ({
    default: module.ScheduleTab,
  })),
);
const MemoryUploadTab = lazy(() =>
  import("./memories/MemoryUploadTab").then((module) => ({
    default: module.MemoryUploadTab,
  })),
);
const AlertsTab = lazy(() =>
  import("./alerts/AlertsTab").then((module) => ({
    default: module.AlertsTab,
  })),
);
const ProgressTab = lazy(() =>
  import("./progress/ProgressTab").then((module) => ({
    default: module.ProgressTab,
  })),
);
const TimelineTab = lazy(() =>
  import("./TimelineTab").then((module) => ({
    default: module.TimelineTab,
  })),
);
const CareTeamTab = lazy(() =>
  import("./CareTeamTab").then((module) => ({
    default: module.CareTeamTab,
  })),
);
const WellnessTab = lazy(() =>
  import("./WellnessTab").then((module) => ({
    default: module.WellnessTab,
  })),
);
const ProfileTab = lazy(() =>
  import("./profile/ProfileTab").then((module) => ({
    default: module.ProfileTab,
  })),
);

const tabs = [
  ["today", "professional.tabs.today", CalendarDays],
  ["alerts", "professional.tabs.alerts", Bell],
  ["progress", "professional.tabs.progress", ListChecks],
  ["timeline", "professional.tabs.timeline", History],
  ["wellness", "professional.tabs.wellness", HeartPulse],
  ["schedule", "professional.tabs.schedule", Clock3],
  ["memories", "professional.tabs.memories", Images],
  ["reports", "professional.tabs.reports", FileText],
  ["care-team", "professional.tabs.careTeam", Users],
  ["profile", "professional.tabs.profile", UserRound],
  ["practice", "professional.tabs.practice", Settings2],
] as const;

const primaryTabs = tabs.slice(0, 4);
const moreTabs = tabs.slice(4);

function TodayTab({
  patientId,
  lastSeen,
  pendingOnDevice,
}: {
  patientId: string;
  lastSeen: string | null;
  pendingOnDevice: boolean;
}) {
  const { t } = useTranslation();
  const adherence = useQuery({
    queryKey: ["caregiver", patientId, "adherence"],
    queryFn: () => caregiverApi.adherence(patientId),
  });
  if (adherence.isPending)
    return (
      <PageState title={t("professional.loadingReminders")} tone="loading" />
    );
  if (adherence.isError)
    return (
      <PageState
        title={t("professional.adherenceUnavailable")}
        tone="problem"
      />
    );
  const today = adherence.data.days.at(-1);
  const reminders = today?.reminders ?? [];
  const takenCount = reminders.filter((item) => item.status === "taken").length;
  const missedCount = reminders.filter(
    (item) => item.status === "missed",
  ).length;
  return (
    <div className="space-y-6">
      <section
        aria-label={t("professional.todayAtGlance")}
        className="grid gap-3 sm:grid-cols-3"
      >
        <article className="rounded-card border border-border bg-surface p-4 shadow-soft">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-muted">
              {t("professional.scheduled")}
            </p>
            <Pill aria-hidden="true" className="h-5 w-5 text-primary" />
          </div>
          <p className="mt-2 text-3xl font-bold">{reminders.length}</p>
        </article>
        <article className="rounded-card border border-border bg-surface p-4 shadow-soft">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-muted">
              {t("routine.actions.taken")}
            </p>
            <CircleCheck aria-hidden="true" className="h-5 w-5 text-success" />
          </div>
          <p className="mt-2 text-3xl font-bold text-success">{takenCount}</p>
        </article>
        <article
          className={`rounded-card border p-4 shadow-soft ${missedCount ? "border-warn/40 bg-accent-light" : "border-border bg-surface"}`}
        >
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-muted">
              {t("professional.needsAttention")}
            </p>
            <ShieldAlert
              aria-hidden="true"
              className={`h-5 w-5 ${missedCount ? "text-warn" : "text-muted"}`}
            />
          </div>
          <p
            className={`mt-2 text-3xl font-bold ${missedCount ? "text-warn" : "text-muted"}`}
          >
            {missedCount}
          </p>
        </article>
      </section>

      <section className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-border bg-surface-muted px-4 py-3 text-sm">
        <p className="flex items-center gap-2 text-muted">
          <Clock3 aria-hidden="true" className="h-4 w-4" />
          {t("professional.lastSynced")}:{" "}
          {lastSeen
            ? new Date(lastSeen).toLocaleString([], { timeZone: CARE_TIMEZONE })
            : t("professional.notYetSynced")}
        </p>
        <StatusBadge tone={pendingOnDevice ? "warning" : "success"}>
          {pendingOnDevice
            ? t("professional.pendingYes")
            : t("professional.pendingNo")}
        </StatusBadge>
      </section>

      <section className="rounded-card border border-border bg-surface p-5 shadow-soft">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-calm text-primary">
            <Pill aria-hidden="true" className="h-6 w-6" />
          </span>
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.12em] text-primary">
              {t("professional.dailyCare")}
            </p>
            <h2 className="text-xl font-bold">
              {t("professional.todayMedicines")}
            </h2>
          </div>
        </div>
        {today?.reminders.length ? (
          <ul className="mt-3 space-y-3">
            {today.reminders.map((reminder) => (
              <li
                className="rounded-control border border-border bg-bg p-4"
                key={reminder.id}
              >
                <div className="flex flex-wrap justify-between gap-2">
                  <strong>{reminder.title}</strong>
                  <StatusBadge
                    tone={
                      reminder.status === "taken"
                        ? "success"
                        : reminder.status === "missed"
                          ? "warning"
                          : "neutral"
                    }
                  >
                    {t(`professional.status.${reminder.status}`, {
                      defaultValue: reminder.status,
                    })}
                  </StatusBadge>
                </div>
                <p className="text-sm text-muted">
                  {new Date(reminder.scheduled_at).toLocaleTimeString([], {
                    timeZone: CARE_TIMEZONE,
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                  {reminder.responded_at
                    ? ` · ${t("professional.responded")} ${new Date(reminder.responded_at).toLocaleTimeString([], { timeZone: CARE_TIMEZONE, hour: "2-digit", minute: "2-digit" })}`
                    : ""}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 rounded-control bg-surface-muted p-4 text-muted">
            {t("professional.noMedicines")}
          </p>
        )}
      </section>
      <section className="rounded-card border border-border bg-surface p-5 shadow-soft">
        <h2 className="text-xl font-bold">{t("professional.lastSevenDays")}</h2>
        <p className="mt-1 text-sm text-muted">
          {t("professional.completionByDay")}
        </p>
        <div className="mt-4 grid grid-cols-7 gap-2" role="list">
          {adherence.data.days.map((day) => {
            const taken = day.reminders.filter(
              (item) => item.status === "taken",
            ).length;
            return (
              <div
                className="rounded-control bg-surface-muted p-2 text-center"
                key={day.date}
                role="listitem"
              >
                <span className="block text-xs">
                  {new Date(`${day.date}T12:00:00`).toLocaleDateString([], {
                    weekday: "short",
                  })}
                </span>
                <strong>
                  {taken}/{day.reminders.length}
                </strong>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

export function CaregiverPortal() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { patientId, tab = "today" } = useParams();
  const isMoreTab = moreTabs.some(([item]) => item === tab);
  const [toolsOpen, setToolsOpen] = useState(isMoreTab);
  const patients = useQuery({
    queryKey: ["caregiver", "patients"],
    queryFn: caregiverApi.patients,
  });
  if (patients.isPending)
    return (
      <PageState title={t("professional.loadingPatients")} tone="loading" />
    );
  if (patients.isError)
    return (
      <PageState title={t("professional.patientsUnavailable")} tone="problem" />
    );
  if (!patients.data.length)
    return (
      <PageState
        title={t("professional.noPatients")}
        detail={t("professional.noPatientsDetail")}
      />
    );
  const firstPatient = patients.data[0];
  if (!firstPatient) return <PageState title={t("professional.noPatients")} />;
  if (!patientId)
    return <Navigate replace to={`/caregiver/${firstPatient.id}/today`} />;
  const patient = patients.data.find((item) => item.id === patientId);
  if (!patient)
    return <Navigate replace to={`/caregiver/${firstPatient.id}/today`} />;
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4 rounded-card border border-border bg-surface p-5 shadow-soft">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.13em] text-primary">
            <Stethoscope aria-hidden="true" className="h-4 w-4" />
            {t("professional.caregiverPortal")}
          </p>
          <h1 className="mt-1 text-3xl font-bold">{patient.name}</h1>
          <p className="mt-1 text-muted">{t("professional.caregiverIntro")}</p>
        </div>
        <label className="text-sm font-bold text-muted">
          <span className="mb-1 block">{t("professional.patient")}</span>
          <select
            aria-label={t("professional.patient")}
            className="min-h-[48px] rounded-control border border-border bg-bg px-3 font-semibold text-text"
            value={patientId}
            onChange={(event) =>
              void navigate(`/caregiver/${event.target.value}/${tab}`)
            }
          >
            {patients.data.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
                {item.is_primary ? ` · ${t("professional.primary")}` : ""}
              </option>
            ))}
          </select>
        </label>
      </header>
      <nav
        aria-label={t("professional.caregiverSections")}
        className="space-y-3"
      >
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {primaryTabs.map(([item, labelKey, Icon]) => (
            <NavLink
              className={`flex min-h-[48px] items-center justify-center gap-2 rounded-control px-3 font-semibold ${tab === item ? "bg-primary text-primary-text shadow-soft" : "border border-border bg-surface hover:bg-calm"}`}
              key={item}
              to={`/caregiver/${patientId}/${item}`}
            >
              <Icon aria-hidden="true" className="h-5 w-5" />
              {t(labelKey)}
            </NavLink>
          ))}
        </div>
        <details
          className="group rounded-card border border-border bg-surface"
          open={toolsOpen}
          onToggle={(event) => setToolsOpen(event.currentTarget.open)}
        >
          <summary className="flex min-h-[48px] cursor-pointer list-none items-center justify-between gap-3 px-4 font-semibold">
            {t("professional.moreCareTools")}
            <ChevronDown
              aria-hidden="true"
              className="h-5 w-5 transition group-open:rotate-180"
            />
          </summary>
          <div className="grid gap-2 border-t border-border p-3 sm:grid-cols-3">
            {moreTabs.map(([item, labelKey, Icon]) => (
              <NavLink
                className={`flex min-h-[44px] items-center gap-2 rounded-control px-3 text-sm font-semibold ${tab === item ? "bg-primary text-primary-text" : "bg-surface-muted hover:bg-calm"}`}
                key={item}
                to={`/caregiver/${patientId}/${item}`}
              >
                <Icon aria-hidden="true" className="h-4 w-4" />
                {t(labelKey)}
              </NavLink>
            ))}
          </div>
        </details>
      </nav>
      <Suspense
        fallback={<PageState title={t("health.loading")} tone="loading" />}
      >
        {tab === "today" ? (
          <TodayTab
            lastSeen={patient.last_active_at}
            patientId={patientId}
            pendingOnDevice={patient.pending_on_device}
          />
        ) : tab === "schedule" ? (
          <ScheduleTab key={patientId} patientId={patientId} />
        ) : tab === "memories" ? (
          <MemoryUploadTab patientId={patientId} />
        ) : tab === "alerts" ? (
          <>
            <CheckInPanel patientId={patientId} />
            <NotificationPreferences />
            <AlertsTab patientId={patientId} />
          </>
        ) : tab === "progress" ? (
          <ProgressTab patientId={patientId} />
        ) : tab === "timeline" ? (
          <TimelineTab patientId={patientId} />
        ) : tab === "care-team" ? (
          <CareTeamTab patientId={patientId} />
        ) : tab === "wellness" ? (
          <WellnessTab key={patientId} patientId={patientId} />
        ) : tab === "reports" ? (
          <ReportsTab key={patientId} patientId={patientId} />
        ) : tab === "profile" ? (
          <ProfileTab patientId={patientId} />
        ) : (
          <section className="rounded-card bg-surface p-6">
            <h2 className="text-xl font-bold">
              {t("professional.comingSoon")}
            </h2>
            <p>{t("professional.comingSoonDetail")}</p>
          </section>
        )}
      </Suspense>
    </div>
  );
}
