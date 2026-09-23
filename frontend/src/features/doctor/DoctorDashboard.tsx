import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { doctorApi, type DoctorPatientCard } from "./api";
import { CARE_TIMEZONE } from "../../db/reminders";

function PatientCard({ patient }: { patient: DoctorPatientCard }) {
  return (
    <article className="rounded-card bg-surface p-5 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-xl font-bold">{patient.name}</h2>
        <span
          className={`rounded-full px-3 py-1 text-sm font-semibold engagement-${patient.engagement_status}`}
        >
          {patient.engagement_status}
        </span>
      </div>
      <dl className="my-4 grid gap-2 text-sm">
        <div>
          <dt className="text-muted">Open flags</dt>
          <dd className="font-bold">{patient.flag_count}</dd>
        </div>
        <div>
          <dt className="text-muted">Last completed session</dt>
          <dd className="font-bold">
            {patient.last_session_at
              ? new Date(patient.last_session_at).toLocaleDateString([], { timeZone: CARE_TIMEZONE })
              : "No sessions yet"}
          </dd>
        </div>
      </dl>
      <Link
        className="inline-flex min-h-[44px] items-center rounded bg-primary px-4 text-white"
        to={`/doctor/patients/${patient.id}/overview`}
      >
        View patient
      </Link>
    </article>
  );
}

export function DoctorDashboard() {
  const dashboard = useQuery({
    queryKey: ["doctor", "dashboard"],
    queryFn: doctorApi.dashboard,
  });
  if (dashboard.isPending) return <p>Loading your patients…</p>;
  if (dashboard.isError) return <p>We could not load your dashboard.</p>;
  return (
    <section className="space-y-7">
      <header>
        <p className="text-sm font-semibold uppercase text-muted">Doctor portal</p>
        <h1 className="text-3xl font-bold">Patients</h1>
      </header>
      {dashboard.data.needs_attention.length > 0 && (
        <section className="rounded-card bg-warning/20 p-5">
          <h2 className="text-xl font-bold">Needs attention</h2>
          <ul className="mt-2 space-y-1">
            {dashboard.data.needs_attention.map((patient) => (
              <li key={patient.id}>
                <Link to={`/doctor/patients/${patient.id}/alerts`}>
                  {patient.name} · {patient.flag_count} open {patient.flag_count === 1 ? "flag" : "flags"}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {dashboard.data.patients.map((patient) => (
          <PatientCard key={patient.id} patient={patient} />
        ))}
      </div>
      {dashboard.data.patients.length === 0 && <p>No assigned patients yet.</p>}
      <section>
        <h2 className="text-xl font-bold">Reviews due</h2>
        <p>
          {dashboard.data.reviews_due.length
            ? `${dashboard.data.reviews_due.length} reviews due`
            : "No reviews due."}
        </p>
      </section>
    </section>
  );
}
