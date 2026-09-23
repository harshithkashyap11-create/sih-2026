import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useState } from "react";

import { doctorApi } from "./api";
import { CARE_TIMEZONE, dayInTimezone } from "../../db/reminders";

const formText = (value: FormDataEntryValue | null): string =>
  typeof value === "string" ? value : "";
const recordText = (value: unknown): string => typeof value === "string" ? value : "";
const recordInput = (value: unknown): string | number =>
  typeof value === "string" || typeof value === "number" ? value : "";

export function MetricsTab({ patientId }: { patientId: string }) {
  const [window, setWindow] = useState(30);
  const query = useQuery({ queryKey: ["doctor", patientId, "metrics", window], queryFn: () => doctorApi.metrics(patientId, window) });
  return <div className="space-y-4">
    <p className="rounded bg-warning/20 p-3">These descriptive trends support review and are not a diagnosis.</p>
    <label>Window <select value={window} onChange={(event) => setWindow(Number(event.target.value))}>
      {[7, 30, 90].map((days) => <option key={days} value={days}>{days} days</option>)}
    </select></label>
    {query.isPending ? <p>Loading metrics…</p> : query.isError ? <p>Metrics could not be loaded.</p> : <>
      <div className="grid gap-3 md:grid-cols-2">{query.data.domains.map((row) => <article className="rounded border p-3" key={row.domain}>
        <h3 className="font-bold">{row.domain}</h3><p>{row.sessions} sessions · {row.trend.replace("_", " ")}</p>
        {row.mean_accuracy != null && <div aria-label={`${row.domain} mean accuracy chart`} className="mt-2 h-3 rounded bg-bg"><div className="h-3 rounded bg-primary" style={{ width: `${Math.round(row.mean_accuracy * 100)}%` }} /></div>}
      </article>)}</div>
      <table className="w-full"><thead><tr><th>Game</th><th>Level</th><th>Date</th></tr></thead><tbody>
        {query.data.sessions?.map((row) => <tr key={row.id}><td>{row.game}</td><td>{row.level}</td><td>{new Date(row.ended_at).toLocaleDateString([], { timeZone: CARE_TIMEZONE })}</td></tr>)}
      </tbody></table>
    </>}
  </div>;
}

export function DifficultyTab({ patientId }: { patientId: string }) {
  const client = useQueryClient();
  const query = useQuery({ queryKey: ["doctor", patientId, "difficulty"], queryFn: () => doctorApi.difficulty(patientId) });
  const mutation = useMutation({ mutationFn: ({ gameKey, body }: { gameKey: string; body: object }) => doctorApi.overrideDifficulty(patientId, gameKey, body), onSuccess: () => client.invalidateQueries({ queryKey: ["doctor", patientId, "difficulty"] }) });
  if (query.isPending) return <p>Loading difficulty…</p>;
  if (query.isError) return <p>Difficulty history could not be loaded.</p>;
  return <div className="space-y-4">{query.data.map((game) => <article className="rounded border p-4" key={game.game_key}>
    <h3 className="font-bold">{game.game_name} · level {game.level}</h3>
    <p>{game.locked ? "Locked by doctor" : "Adaptive"}{game.cap_level ? ` · cap ${game.cap_level}` : ""}</p>
    <ul>{game.changes.map((change) => <li key={change.id}>{change.explanation}{change.session_id ? ` · session ${change.session_id}` : ""}</li>)}</ul>
    <form className="mt-3 flex flex-wrap gap-2" onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); mutation.mutate({ gameKey: game.game_key, body: { action: data.get("action"), value: data.get("value") ? Number(data.get("value")) : null, reason: data.get("reason") } }); }}>
      <select name="action" aria-label="Action"><option value="set_level">Set level</option><option value="lock">Lock</option><option value="unlock">Unlock</option><option value="cap">Cap</option></select>
      <input name="value" aria-label="Level" min="1" max="10" type="number" />
      <input name="reason" aria-label="Reason" placeholder="Clinical reason" required />
      <button disabled={mutation.isPending} className="rounded bg-primary px-3 text-white">Apply</button>
      {mutation.isError && <p role="alert">Difficulty could not be changed. Check the level and try again.</p>}
      {mutation.isSuccess && <p role="status">Difficulty updated.</p>}
    </form>
  </article>)}</div>;
}

export function RoutineTab({ patientId }: { patientId: string }) {
  const client = useQueryClient();
  const query = useQuery({ queryKey: ["doctor", patientId, "medications"], queryFn: () => doctorApi.medications(patientId) });
  const mutation = useMutation({ mutationFn: (body: object) => doctorApi.createMedication(patientId, body), onSuccess: () => client.invalidateQueries({ queryKey: ["doctor", patientId, "medications"] }) });
  const assignments = useQuery({ queryKey: ["doctor", patientId, "assignments"], queryFn: () => doctorApi.assignments(patientId) });
  const games = useQuery({ queryKey: ["games"], queryFn: doctorApi.games });
  const assign = useMutation({ mutationFn: (body: object) => doctorApi.createAssignment(patientId, body), onSuccess: () => client.invalidateQueries({ queryKey: ["doctor", patientId, "assignments"] }) });
  const submit = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const data = new FormData(event.currentTarget); mutation.mutate({ name: data.get("name"), dose: data.get("dose"), times: formText(data.get("times")).split(",").map((value) => value.trim()), instructions: data.get("instructions"), active: true, start_date: dayInTimezone() }); };
  return <div className="space-y-4"><h3 className="font-bold">Medications</h3><form className="grid gap-2" onSubmit={submit}>
    <input name="name" aria-label="Medication" placeholder="Medication" required /><input name="dose" aria-label="Dose" placeholder="Dose" required />
    <input name="times" aria-label="08:00, 20:00" placeholder="08:00, 20:00" required /><textarea name="instructions" aria-label="Instructions" placeholder="Instructions" />
    <button disabled={mutation.isPending} className="rounded bg-primary p-2 text-white">Add medication</button>
    {mutation.isError && <p role="alert">Medication could not be saved. Check the dose times and try again.</p>}
    {mutation.isSuccess && <p role="status">Medication saved.</p>}
    {query.isError && <p role="alert">Medications could not be loaded.</p>}
  </form>{query.isPending ? <p>Loading medications…</p> : query.data?.map((row) => <p key={row.id}><strong>{row.name}</strong> {row.dose} · {row.times.join(", ")}</p>)}
    <h3 className="font-bold">Exercise assignments</h3>
    <form className="grid gap-2" onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); assign.mutate({ game: data.get("game"), start_level: Number(data.get("start_level")), target_minutes: Number(data.get("target_minutes")), times_per_week: Number(data.get("times_per_week")), time_slot: data.get("time_slot"), review_date: data.get("review_date"), active: true, notes: data.get("notes") }); }}>
      <select name="game" aria-label="Game" required>{games.data?.map((game) => <option key={game.id} value={game.id}>{game.name}</option>)}</select>
      <input name="start_level" type="number" min="1" max="10" defaultValue="1" aria-label="Start level" />
      <input name="target_minutes" type="number" min="1" defaultValue="10" aria-label="Target minutes" />
      <input name="times_per_week" type="number" min="1" max="7" defaultValue="3" aria-label="Times per week" />
      <select name="time_slot" aria-label="Time slot"><option value="morning">Morning</option><option value="afternoon">Afternoon</option><option value="evening">Evening</option></select>
      <input name="review_date" type="date" required aria-label="Review date" /><textarea name="notes" aria-label="Assignment notes" placeholder="Assignment notes" />
      <button disabled={assign.isPending || games.isPending || games.isError} className="rounded bg-primary p-2 text-white">Assign exercise</button>
      {assign.isError && <p role="alert">Exercise could not be assigned. Check the values and try again.</p>}
      {assign.isSuccess && <p role="status">Exercise assigned.</p>}
      {games.isError && <p role="alert">Games could not be loaded.</p>}
      {assignments.isError && <p role="alert">Assignments could not be loaded.</p>}
    </form>
    {assignments.data?.map((row) => <p key={row.id}><strong>{row.game_name}</strong> · {row.completion.done_this_week}/{row.completion.planned_this_week} this week · review {new Date(row.review_date).toLocaleDateString([], { timeZone: CARE_TIMEZONE })}</p>)}
  </div>;
}

export function NotesTab({ patientId }: { patientId: string }) {
  const client = useQueryClient();
  const query = useQuery({ queryKey: ["doctor", patientId, "notes"], queryFn: () => doctorApi.notes(patientId) });
  const mutation = useMutation({ mutationFn: (body: object) => doctorApi.createNote(patientId, body), onSuccess: () => client.invalidateQueries({ queryKey: ["doctor", patientId, "notes"] }) });
  return <div className="space-y-4"><form className="grid gap-2" onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); mutation.mutate({ category: data.get("category"), status_summary: data.get("status"), text: data.get("text"), visibility: data.get("visibility") }); }}>
    <select name="category" aria-label="Note category"><option value="general">General</option><option value="cognitive">Cognitive</option><option value="medication">Medication</option></select>
    <input name="status" aria-label="Status summary" placeholder="Status summary" /><textarea name="text" aria-label="Doctor note" placeholder="Doctor note" required />
    <select name="visibility" aria-label="Note visibility"><option value="doctor_only">Doctor only</option><option value="care_team">Care team</option><option value="patient_visible">Patient visible</option></select>
    <button disabled={mutation.isPending} className="rounded bg-primary p-2 text-white">Save note</button>
    {mutation.isError && <p role="alert">Note could not be saved. Please try again.</p>}
    {mutation.isSuccess && <p role="status">Note saved.</p>}
    {query.isPending && <p role="status">Loading notes…</p>}
    {query.isError && <p role="alert">Notes could not be loaded.</p>}
  </form>{query.data?.map((note) => <article className="rounded border p-3" key={note.id}><strong>{note.status_summary || note.category}</strong><p>{note.text}</p><small>{note.author_name} · {note.visibility}</small></article>)}</div>;
}

export function OverviewTab({ patientId }: { patientId: string }) {
  const client = useQueryClient();
  const query = useQuery({ queryKey: ["doctor", patientId, "baseline"], queryFn: () => doctorApi.baseline(patientId) });
  const mutation = useMutation({ mutationFn: (body: object) => doctorApi.saveBaseline(patientId, body), onSuccess: (baseline) => {
    client.setQueryData(["doctor", patientId, "baseline"], baseline);
    void client.invalidateQueries({ queryKey: ["doctor", patientId] });
  } });
  return <form key={recordText(query.data?.updated_at)} className="grid gap-2" onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); mutation.mutate({ allergies: data.get("allergies"), diagnoses: data.get("diagnoses"), visual_limits: data.get("visual_limits"), motor_limits: data.get("motor_limits"), ideal_session_minutes: Number(data.get("ideal_session_minutes")) || null, max_difficulty_level: Number(data.get("max_difficulty_level")) || null }); }}>
    <p>Ideal session minutes is advisory. Gameplay uses the separately configured session time limit.</p>
    <p>Baseline entered by doctor{recordText(query.data?.recorded_by_name) ? `: ${recordText(query.data?.recorded_by_name)}` : ""}</p>
    <textarea name="allergies" defaultValue={recordText(query.data?.allergies)} aria-label="Allergies" placeholder="Allergies" />
    <textarea name="diagnoses" defaultValue={recordText(query.data?.diagnoses)} aria-label="Clinical diagnosis (entered by doctor)" placeholder="Clinical diagnosis (entered by doctor)" />
    <input name="visual_limits" defaultValue={recordText(query.data?.visual_limits)} aria-label="Visual limits" placeholder="Visual limits" /><input name="motor_limits" defaultValue={recordText(query.data?.motor_limits)} aria-label="Motor limits" placeholder="Motor limits" />
    <input name="ideal_session_minutes" defaultValue={recordInput(query.data?.ideal_session_minutes)} type="number" aria-label="Ideal session minutes" placeholder="Ideal session minutes" /><input name="max_difficulty_level" defaultValue={recordInput(query.data?.max_difficulty_level)} type="number" aria-label="Maximum difficulty" placeholder="Maximum difficulty" />
    <button disabled={mutation.isPending || query.isPending || query.isError} className="rounded bg-primary p-2 text-white">Save baseline</button>
    {query.isPending && <p role="status">Loading baseline…</p>}
    {query.isError && <p role="alert">Baseline could not be loaded. Please reload before editing.</p>}
    {mutation.isError && <p role="alert">Baseline could not be saved. Check the values and try again.</p>}
    {mutation.isSuccess && <p role="status">Baseline saved.</p>}
  </form>;
}
