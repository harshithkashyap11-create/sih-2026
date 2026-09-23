import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { apiClient } from "../../api/client";
import { caregiverApi, type CareAlert } from "../caregiver/api";
import { CARE_TIMEZONE } from "../../db/reminders";

function DoctorAlert({ alert, onChanged }: { alert: CareAlert; onChanged: () => void }) {
  const [note, setNote] = useState("");
  const dismiss = useMutation({
    mutationFn: () => apiClient(`/api/v1/alerts/${alert.id}/dismiss/`, {
      method: "POST", body: JSON.stringify({ note }),
    }),
    onSuccess: onChanged,
  });
  return <article className="rounded border p-4 space-y-2">
    <h3 className="font-bold">{alert.title}</h3>
    <p>{alert.severity} · {alert.status}</p>
    <time dateTime={alert.triggered_at}>{new Date(alert.triggered_at).toLocaleString([], { timeZone: CARE_TIMEZONE })}</time>
    <p>{alert.explanation}</p>
    {alert.notes && <p>Note: {alert.notes}</p>}
    <details><summary>Evidence</summary><pre className="whitespace-pre-wrap break-all">{JSON.stringify(alert.evidence, null, 2)}</pre></details>
    {alert.status !== "dismissed" && <>
      <label className="block">Review note<input className="ml-2 border" value={note} onChange={(event) => setNote(event.target.value)} /></label>
      <button type="button" className="rounded bg-primary px-4 py-2 text-white" disabled={dismiss.isPending} onClick={() => dismiss.mutate()}>Dismiss alert</button>
      {dismiss.isError && <p role="alert">Could not dismiss this alert. Please try again.</p>}
    </>}
  </article>;
}

export function DoctorAlertsTab({ patientId }: { patientId: string }) {
  const client = useQueryClient();
  const key = ["doctor", patientId, "alerts"];
  const query = useQuery({ queryKey: key, queryFn: () => caregiverApi.alerts(patientId), refetchInterval: 30_000 });
  if (query.isPending) return <p>Loading alerts…</p>;
  if (query.isError) return <p role="alert">Could not load patient alerts.</p>;
  return <section className="space-y-4">{query.data.length ? query.data.map((alert) => <DoctorAlert key={alert.id} alert={alert} onChanged={() => {
    void client.invalidateQueries({ queryKey: key });
    void client.invalidateQueries({ queryKey: ["doctor", "dashboard"] });
  }} />) : <p>No patient alerts.</p>}</section>;
}
