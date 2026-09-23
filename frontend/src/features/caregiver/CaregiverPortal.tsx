import { useQuery } from "@tanstack/react-query";
import { Navigate, useNavigate, useParams } from "react-router-dom";

import { CheckInPanel } from "./alerts/CheckInPanel";
import { NotificationPreferences } from "./alerts/NotificationPreferences";
import { ReportsTab } from "./ReportsTab";
import { caregiverApi } from "./api";
import { ScheduleTab } from "./schedule/ScheduleTab";
import { MemoryUploadTab } from "./memories/MemoryUploadTab";
import { AlertsTab } from "./alerts/AlertsTab";
import { ProgressTab } from "./progress/ProgressTab";
import { TimelineTab } from "./TimelineTab";
import { CareTeamTab } from "./CareTeamTab";
import { WellnessTab } from "./WellnessTab";
import { ProfileTab } from "./profile/ProfileTab";
import { CARE_TIMEZONE } from "../../db/reminders";

const tabs = [
  "practice",
  "today",
  "timeline",
  "wellness",
  "progress",
  "alerts",
  "schedule",
  "memories",
  "reports",
  "care-team",
  "profile",
] as const;

function TodayTab({
  patientId,
  lastSeen,
  pendingOnDevice,
}: {
  patientId: string;
  lastSeen: string | null;
  pendingOnDevice: boolean;
}) {
  const adherence = useQuery({
    queryKey: ["caregiver", patientId, "adherence"],
    queryFn: () => caregiverApi.adherence(patientId),
  });
  if (adherence.isPending) return <p>Loading today’s reminders…</p>;
  if (adherence.isError) return <p>We could not load adherence right now.</p>;
  const today = adherence.data.days.at(-1);
  return (
    <div className="space-y-5">
      <p className="text-sm text-muted">
        Last synced:{" "}
        {lastSeen ? new Date(lastSeen).toLocaleString([], { timeZone: CARE_TIMEZONE }) : "Not yet synced"}
      </p>
      <p className="text-sm text-muted">
        Pending on device: {pendingOnDevice ? "Yes" : "No"}
      </p>
      <section>
        <h2 className="text-xl font-bold">Today’s medicines</h2>
        {today?.reminders.length ? (
          <ul className="mt-3 space-y-3">
            {today.reminders.map((reminder) => (
              <li className="rounded-card bg-surface p-4" key={reminder.id}>
                <div className="flex justify-between">
                  <strong>{reminder.title}</strong>
                  <span
                    className={`rounded-full px-3 py-1 text-sm font-bold status-${reminder.status}`}
                  >
                    {reminder.status}
                  </span>
                </div>
                <p className="text-sm text-muted">
                  {new Date(reminder.scheduled_at).toLocaleTimeString([], {
                    timeZone: CARE_TIMEZONE,
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                  {reminder.responded_at
                    ? ` · Responded ${new Date(reminder.responded_at).toLocaleTimeString([], { timeZone: CARE_TIMEZONE, hour: "2-digit", minute: "2-digit" })}`
                    : ""}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p>No medicine reminders today.</p>
        )}
      </section>
      <section>
        <h2 className="text-xl font-bold">Last 7 days</h2>
        <div className="mt-3 grid grid-cols-7 gap-2">
          {adherence.data.days.map((day) => {
            const taken = day.reminders.filter(
              (item) => item.status === "taken",
            ).length;
            return (
              <div
                className="rounded bg-surface p-2 text-center"
                key={day.date}
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
  const navigate = useNavigate();
  const { patientId, tab = "today" } = useParams();
  const patients = useQuery({
    queryKey: ["caregiver", "patients"],
    queryFn: caregiverApi.patients,
  });
  if (patients.isPending) return <p>Loading your patients…</p>;
  if (patients.isError) return <p>We could not load your patients.</p>;
  if (!patients.data.length) return <p>No assigned patients yet.</p>;
  const firstPatient = patients.data[0];
  if (!firstPatient) return <p>No assigned patients yet.</p>;
  if (!patientId)
    return <Navigate replace to={`/caregiver/${firstPatient.id}/today`} />;
  const patient = patients.data.find((item) => item.id === patientId);
  if (!patient)
    return <Navigate replace to={`/caregiver/${firstPatient.id}/today`} />;
  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase text-muted">
            Caregiver portal
          </p>
          <h1 className="text-3xl font-bold">{patient.name}</h1>
        </div>
        <label>
          Patient
          <select
            aria-label="Patient"
            className="ml-2"
            value={patientId}
            onChange={(event) =>
              void navigate(`/caregiver/${event.target.value}/${tab}`)
            }
          >
            {patients.data.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
                {item.is_primary ? " · Primary" : ""}
              </option>
            ))}
          </select>
        </label>
      </header>
      <nav
        aria-label="Caregiver sections"
        className="flex gap-2 overflow-x-auto"
      >
        {tabs.map((item) => (
          <button
            aria-current={tab === item ? "page" : undefined}
            className="whitespace-nowrap rounded-full px-4 py-2 aria-[current=page]:bg-primary aria-[current=page]:text-white"
            key={item}
            onClick={() => void navigate(`/caregiver/${patientId}/${item}`)}
          >
            {item
              .split("-")
              .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
              .join(" ")}
          </button>
        ))}
      </nav>
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
        <><CheckInPanel patientId={patientId} /><NotificationPreferences /><AlertsTab patientId={patientId} /></>
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
          <h2 className="text-xl font-bold">Coming in this phase</h2>
          <p>This section will be available soon.</p>
        </section>
      )}
    </div>
  );
}
