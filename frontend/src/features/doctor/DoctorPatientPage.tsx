import { useQuery } from "@tanstack/react-query";
import { Navigate, useNavigate, useParams } from "react-router-dom";

import { WellnessTab } from "../caregiver/WellnessTab";
import { ReportsTab } from "../caregiver/ReportsTab";
import { doctorApi } from "./api";
import { DoctorAlertsTab } from "./DoctorAlertsTab";
import { DifficultyTab, MetricsTab, NotesTab, OverviewTab, RoutineTab } from "./PatientTabs";

const tabs = [
  ["wellness", "Sleep & Mood"],
  ["overview", "Overview"],
  ["metrics", "Metrics"],
  ["difficulty", "Difficulty"],
  ["routine-medicines", "Routine & Medicines"],
  ["notes", "Notes"],
  ["alerts", "Alerts"],
  ["report", "Report"],
] as const;

export function DoctorPatientPage() {
  const navigate = useNavigate();
  const { patientId = "", tab } = useParams();
  const patient = useQuery({
    queryKey: ["doctor", "patient", patientId],
    queryFn: () => doctorApi.patient(patientId),
    enabled: Boolean(patientId),
  });
  if (!tab) return <Navigate replace to={`/doctor/patients/${patientId}/overview`} />;
  const selected = tabs.find(([key]) => key === tab);
  if (!selected) return <Navigate replace to={`/doctor/patients/${patientId}/overview`} />;
  if (patient.isPending) return <p>Loading patient…</p>;
  if (patient.isError) return <p>Patient not found or no longer assigned.</p>;
  return (
    <section className="space-y-5">
      <header>
        <button type="button" onClick={() => void navigate("/doctor")}>
          ← All patients
        </button>
        <h1 className="mt-2 text-3xl font-bold">{patient.data.name}</h1>
        <p className="text-muted">
          {patient.data.age === null ? "Age not recorded" : `Age ${patient.data.age}`}
          {patient.data.primary_caregiver_name
            ? ` · Primary caregiver: ${patient.data.primary_caregiver_name}`
            : ""}
        </p>
      </header>
      <nav aria-label="Patient sections" className="flex gap-2 overflow-x-auto">
        {tabs.map(([key, label]) => (
          <button
            aria-current={tab === key ? "page" : undefined}
            className="whitespace-nowrap rounded-full px-4 py-2 aria-[current=page]:bg-primary aria-[current=page]:text-white"
            key={key}
            type="button"
            onClick={() => void navigate(`/doctor/patients/${patientId}/${key}`)}
          >
            {label}
          </button>
        ))}
      </nav>
      <div className="rounded-card bg-surface p-6">
        <h2 className="text-xl font-bold">{selected[1]}</h2>
        <div className="mt-4">
          {tab === "wellness" && <WellnessTab patientId={patientId} readOnly />}
          {tab === "overview" && <OverviewTab patientId={patientId} />}
          {tab === "metrics" && <MetricsTab patientId={patientId} />}
          {tab === "difficulty" && <DifficultyTab patientId={patientId} />}
          {tab === "routine-medicines" && <RoutineTab patientId={patientId} />}
          {tab === "notes" && <NotesTab patientId={patientId} />}
          {tab === "alerts" && <DoctorAlertsTab patientId={patientId} />}
          {tab === "report" && <ReportsTab key={patientId} patientId={patientId} clinical />}
        </div>
      </div>
    </section>
  );
}
