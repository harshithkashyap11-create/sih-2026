import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { doctorApi, type DoctorPatientCard } from "./api";
import { CARE_TIMEZONE } from "../../db/reminders";

function PatientCard({ patient }: { patient: DoctorPatientCard }) {
  const statusLabel = patient.engagement_status === "active"
    ? "Active"
    : patient.engagement_status === "quiet"
      ? "Quiet"
      : "Inactive";
  return (
    <article className="group rounded-card border border-primary/10 bg-surface p-5 shadow-card transition-transform hover:-translate-y-0.5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted">Patient</p>
          <h2 className="mt-1 text-xl font-bold">{patient.name}</h2>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-sm font-semibold ${patient.engagement_status === "active" ? "bg-success/15 text-success" : patient.engagement_status === "quiet" ? "bg-warn/15 text-warn" : "bg-bg text-muted"}`}
        >
          {statusLabel}
        </span>
      </div>
      <dl className="my-5 grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-xl bg-bg p-3">
          <dt className="text-muted">Open flags</dt>
          <dd className={`mt-1 text-xl font-bold ${patient.flag_count ? "text-warn" : "text-success"}`}>{patient.flag_count}</dd>
        </div>
        <div className="rounded-xl bg-bg p-3">
          <dt className="text-muted">Last completed session</dt>
          <dd className="mt-1 font-bold">
            {patient.last_session_at
              ? new Date(patient.last_session_at).toLocaleDateString([], { timeZone: CARE_TIMEZONE })
              : "No sessions yet"}
          </dd>
        </div>
      </dl>
      <Link
        className="inline-flex min-h-[44px] items-center rounded-xl bg-primary px-4 font-semibold text-primary-text transition-colors group-hover:bg-primary/90"
        to={`/doctor/patients/${patient.id}/overview`}
      >
        Open patient →
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
  const totalFlags = dashboard.data.patients.reduce((sum, patient) => sum + patient.flag_count, 0);
  const activePatients = dashboard.data.patients.filter((patient) => patient.engagement_status === "active").length;
  return (
    <section className="space-y-8">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-primary">Doctor portal</p>
          <h1 className="mt-1 text-4xl font-bold tracking-tight">Good morning</h1>
          <p className="mt-2 max-w-xl text-muted">A quick view of your assigned patients and the work that needs your attention.</p>
        </div>
        <p className="rounded-full bg-surface px-4 py-2 text-sm font-semibold text-muted shadow-sm">
          {new Intl.DateTimeFormat([], { dateStyle: "medium" }).format(new Date())}
        </p>
      </header>
      <div className="grid gap-3 sm:grid-cols-3">
        <article className="rounded-card border border-primary/10 bg-surface p-4 shadow-sm"><p className="text-sm text-muted">Assigned patients</p><p className="mt-1 text-3xl font-bold">{dashboard.data.patients.length}</p></article>
        <article className="rounded-card border border-primary/10 bg-surface p-4 shadow-sm"><p className="text-sm text-muted">Active this week</p><p className="mt-1 text-3xl font-bold text-success">{activePatients}</p></article>
        <article className="rounded-card border border-primary/10 bg-surface p-4 shadow-sm"><p className="text-sm text-muted">Open flags</p><p className={`mt-1 text-3xl font-bold ${totalFlags ? "text-warn" : "text-success"}`}>{totalFlags}</p></article>
      </div>
      {dashboard.data.needs_attention.length > 0 && (
        <section className="rounded-card border border-warn/30 bg-warn/10 p-5">
          <div className="flex items-start justify-between gap-3">
            <div><p className="text-xs font-bold uppercase tracking-[0.14em] text-warn">Priority queue</p><h2 className="mt-1 text-xl font-bold">Needs attention</h2></div>
            <span className="rounded-full bg-warn/20 px-3 py-1 text-sm font-bold text-warn">{dashboard.data.needs_attention.length}</span>
          </div>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {dashboard.data.needs_attention.map((patient) => (
              <li className="rounded-xl bg-surface/70 p-3" key={patient.id}>
                <Link className="font-semibold text-primary underline-offset-4 hover:underline" to={`/doctor/patients/${patient.id}/alerts`}>
                  {patient.name} · {patient.flag_count} open {patient.flag_count === 1 ? "flag" : "flags"} →
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      <div className="flex items-end justify-between gap-3">
        <div><h2 className="text-2xl font-bold">Your patients</h2><p className="mt-1 text-sm text-muted">Select a patient to review care, progress, and notes.</p></div>
        <span className="text-sm font-semibold text-muted">{dashboard.data.patients.length} total</span>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {dashboard.data.patients.map((patient) => (
          <PatientCard key={patient.id} patient={patient} />
        ))}
      </div>
      {dashboard.data.patients.length === 0 && <p>No assigned patients yet.</p>}
      <section className="rounded-card border border-primary/10 bg-surface p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-muted">Follow-up</p><h2 className="mt-1 text-xl font-bold">Reviews due</h2></div><span className="rounded-full bg-calm px-3 py-1 text-sm font-bold text-primary">{dashboard.data.reviews_due.length}</span></div>
        <p className="mt-3 text-muted">
          {dashboard.data.reviews_due.length
            ? `${dashboard.data.reviews_due.length} reviews due`
            : "No reviews due."}
        </p>
      </section>
    </section>
  );
}
