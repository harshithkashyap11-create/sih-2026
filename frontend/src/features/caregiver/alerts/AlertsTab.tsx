import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { caregiverApi, type CareAlert } from "../api";
import { CARE_TIMEZONE } from "../../../db/reminders";

function Evidence({ evidence }: { evidence: Record<string, unknown> }) {
  const reminders = Array.isArray(evidence.reminder_ids)
    ? evidence.reminder_ids
    : [];
  const changes = Array.isArray(evidence.difficulty_change_ids)
    ? evidence.difficulty_change_ids
    : [];
  const sessionId =
    typeof evidence.session_id === "string" ? evidence.session_id : null;
  if (!reminders.length && !changes.length && !sessionId) return null;
  return (
    <div className="text-sm text-muted">
      <span>Evidence: </span>
      {reminders.length ? (
        reminders.map((id, index) => (
          <a
            className="mr-2 underline"
            href={`#reminder-${String(id)}`}
            key={String(id)}
          >
            reminder {index + 1}
          </a>
        ))
      ) : changes.length ? (
        changes.map((id, index) => (
          <a
            className="mr-2 underline"
            href={`#difficulty-change-${String(id)}`}
            key={String(id)}
          >
            difficulty change {index + 1}
          </a>
        ))
      ) : (
        <a className="underline" href={`#session-${sessionId}`}>
          game session
        </a>
      )}
    </div>
  );
}

function AlertCard({
  alert,
  onChanged,
}: {
  alert: CareAlert;
  onChanged: () => void;
}) {
  const [note, setNote] = useState("");
  const acknowledge = useMutation({
    mutationFn: () => caregiverApi.acknowledgeAlert(alert.id, note),
    onSuccess: onChanged,
  });
  const forward = useMutation({
    mutationFn: () => caregiverApi.forwardAlert(alert.id),
    onSuccess: onChanged,
  });
  return (
    <article
      className={`rounded-card border-l-4 bg-surface p-4 ${alert.severity === "high" ? "border-danger" : "border-warning"}`}
    >
      <div className="flex justify-between gap-3">
        <h3 className="text-lg font-bold">{alert.title}</h3>
        <time dateTime={alert.triggered_at}>
          {new Date(alert.triggered_at).toLocaleString([], { timeZone: CARE_TIMEZONE })}
        </time>
      </div>
      <p className="my-2">{alert.explanation}</p>
      <Evidence evidence={alert.evidence} />
      {alert.status === "open" && (
        <div className="mt-3 space-y-2">
          <label className="block">
            Acknowledgement note
            <input
              className="ml-2"
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </label>
          <button
            className="rounded bg-primary px-4 py-2 text-white"
            disabled={acknowledge.isPending}
            onClick={() => acknowledge.mutate()}
          >
            Acknowledge
          </button>
          <button
            className="ml-2 rounded border border-primary px-4 py-2 disabled:opacity-50"
            disabled={!alert.can_forward || forward.isPending}
            title={!alert.can_forward ? "No doctor is assigned" : undefined}
            onClick={() => forward.mutate()}
          >
            Forward to doctor
          </button>
        </div>
      )}
      {alert.notes && <p className="mt-2 text-sm">Note: {alert.notes}</p>}
    </article>
  );
}

export function AlertsTab({ patientId }: { patientId: string }) {
  const client = useQueryClient();
  const key = ["caregiver", patientId, "alerts"];
  const alerts = useQuery({
    queryKey: key,
    queryFn: () => caregiverApi.alerts(patientId),
    refetchInterval: 30_000,
  });
  if (alerts.isPending) return <p>Loading alerts…</p>;
  if (alerts.isError) return <p>We could not load alerts right now.</p>;
  const open = alerts.data.filter((item) => item.status === "open");
  const reviewed = alerts.data.filter((item) => item.status !== "open");
  const changed = () => void client.invalidateQueries({ queryKey: key });
  return (
    <section className="space-y-5">
      <h2 className="text-2xl font-bold">Alerts</h2>
      {open.some((item) => item.rule_key === "sos") && (
        <div
          role="alert"
          className="rounded-card bg-danger p-4 text-xl font-bold text-white"
        >
          Emergency help requested — please check now.
        </div>
      )}
      <section>
        <h3 className="mb-3 text-xl font-bold">Open</h3>
        {open.length ? (
          <div className="space-y-3">
            {open.map((alert) => (
              <AlertCard alert={alert} key={alert.id} onChanged={changed} />
            ))}
          </div>
        ) : (
          <p>No open alerts.</p>
        )}
      </section>
      <section>
        <h3 className="mb-3 text-xl font-bold">Acknowledged and forwarded</h3>
        {reviewed.length ? (
          <div className="space-y-3">
            {reviewed.map((alert) => (
              <AlertCard alert={alert} key={alert.id} onChanged={changed} />
            ))}
          </div>
        ) : (
          <p>No reviewed alerts yet.</p>
        )}
      </section>
    </section>
  );
}
