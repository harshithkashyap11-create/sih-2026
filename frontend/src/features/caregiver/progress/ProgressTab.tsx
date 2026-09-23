import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { summarizeGameParticipation } from "../../../games/analytics";
import { caregiverApi } from "../api";
import { CARE_TIMEZONE } from "../../../db/reminders";

export function ProgressTab({ patientId }: { patientId: string }) {
  const [days, setDays] = useState<7 | 30>(7);
  const [openedAt] = useState(() => Date.now());
  const client = useQueryClient();
  const sessions = useQuery({
    queryKey: ["caregiver", patientId, "sessions"],
    queryFn: () => caregiverApi.gameSessions(patientId),
  });
  const changes = useQuery({
    queryKey: ["caregiver", patientId, "difficulty"],
    queryFn: () => caregiverApi.difficultyChanges(patientId),
  });
  const notes = useQuery({
    queryKey: ["caregiver", patientId, "notes"],
    queryFn: () => caregiverApi.notes(patientId),
  });
  const addNote = useMutation({
    mutationFn: (text: string) => caregiverApi.createNote(patientId, text),
    onSuccess: () =>
      client.invalidateQueries({ queryKey: ["caregiver", patientId, "notes"] }),
  });
  if (sessions.isPending || changes.isPending || notes.isPending)
    return <p>Loading progress…</p>;
  if (sessions.isError || changes.isError || notes.isError)
    return <p>We could not load progress right now.</p>;
  const cutoff = openedAt - days * 86_400_000;
  const participation = summarizeGameParticipation(sessions.data, cutoff);
  const chartData = [...sessions.data]
    .filter((row) => Date.parse(row.ended_at) >= cutoff)
    .reverse()
    .map((row) => ({
      date: new Date(row.ended_at).toLocaleDateString([], { timeZone: CARE_TIMEZONE }),
      accuracy: Math.round((row.metrics.accuracy ?? 0) * 100),
      reaction: row.metrics.mean_reaction_ms ?? 0,
    }));
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const text = new FormData(form).get("note");
    if (typeof text === "string" && text.trim())
      addNote.mutate(text.trim(), { onSuccess: () => form.reset() });
  };
  return (
    <section className="space-y-6">
      <div className="rounded-card bg-warning/20 p-4">
        <strong>Supportive overview</strong>
        <p>
          These patterns help the care team plan support. They are not a
          diagnosis.
        </p>
      </div>
      <div>
        <button
          aria-pressed={days === 7}
          className="rounded px-4 py-2 aria-pressed:bg-primary aria-pressed:text-white"
          onClick={() => setDays(7)}
        >
          7 days
        </button>
        <button
          aria-pressed={days === 30}
          className="rounded px-4 py-2 aria-pressed:bg-primary aria-pressed:text-white"
          onClick={() => setDays(30)}
        >
          30 days
        </button>
      </div>
      <dl className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-card border p-4"><dt>Games played</dt><dd>{participation.played}</dd></div>
        <div className="rounded-card border p-4"><dt>Sessions completed</dt><dd>{participation.completed}</dd></div>
        <div className="rounded-card border p-4"><dt>Average accuracy in completed sessions</dt><dd>{participation.averageAccuracy === null ? "Not enough completed sessions" : `${Math.round(participation.averageAccuracy * 100)}%`}</dd></div>
        <div className="rounded-card border p-4"><dt>Hints per round</dt><dd>{participation.hintsPerRound.toFixed(1)}</dd></div>
      </dl>
      {chartData.length ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <div role="img" aria-label="Accuracy trend chart" className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Line
                  name="Accuracy (%)"
                  dataKey="accuracy"
                  stroke="#20615b"
                  strokeWidth={3}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div
            role="img"
            aria-label="Response time trend chart"
            className="h-64"
          >
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Line
                  name="Response time (ms)"
                  dataKey="reaction"
                  stroke="#8a5a24"
                  strokeWidth={3}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="text-sm">
            <span className="text-primary">● Accuracy</span> ·{" "}
            <span className="text-warning">● Response time</span>
          </p>
        </div>
      ) : (
        <p>No game sessions in this period yet.</p>
      )}
      <section>
        <h2 className="text-xl font-bold">Sessions</h2>
        {sessions.data.length ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th>Game</th>
                  <th>Date</th>
                  <th>Level</th>
                  <th>Completed</th>
                </tr>
              </thead>
              <tbody>
                {sessions.data.map((row) => (
                  <tr key={row.id}>
                    <td>{row.game_name}</td>
                    <td>{new Date(row.ended_at).toLocaleDateString([], { timeZone: CARE_TIMEZONE })}</td>
                    <td>{row.level}</td>
                    <td>{row.metrics.completed === false ? "No" : "Yes"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p>No sessions recorded yet.</p>
        )}
      </section>
      <section>
        <h2 className="text-xl font-bold">Difficulty changes</h2>
        {changes.data.length ? (
          <ul>
            {changes.data.map((row) => (
              <li className="my-2 rounded-card bg-surface p-3" key={row.id}>
                <strong>
                  {row.game_name}: level {row.from_level} to {row.to_level}
                </strong>
                <p>{row.explanation}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p>No difficulty changes yet.</p>
        )}
      </section>
      <section>
        <h2 className="text-xl font-bold">Caregiver notes</h2>
        <form className="my-3 flex gap-2" onSubmit={submit}>
          <label className="flex-1">
            Note
            <textarea className="block w-full" name="note" required />
          </label>
          <button
            className="self-end rounded bg-primary px-4 py-2 text-white"
            disabled={addNote.isPending}
            type="submit"
          >
            Add note
          </button>
        </form>
        {notes.data.length ? (
          <ul>
            {notes.data.map((note) => (
              <li className="my-2 rounded-card bg-surface p-3" key={note.id}>
                {note.text}
                <small className="block text-muted">
                  {note.author_name} ·{" "}
                  {new Date(note.created_at).toLocaleString([], { timeZone: CARE_TIMEZONE })}
                </small>
              </li>
            ))}
          </ul>
        ) : (
          <p>No caregiver notes yet.</p>
        )}
      </section>
    </section>
  );
}
