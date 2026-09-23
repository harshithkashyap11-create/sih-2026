import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { apiClient } from "../../api/client";
import { dayInTimezone } from "../../db/reminders";
interface Log {
  id: string;
  mood?: string;
  logged_at?: string;
  date?: string;
  bed_time?: string;
  wake_time?: string;
  quality?: number;
}
export function WellnessTab({
  patientId,
  readOnly = false,
}: {
  patientId: string;
  readOnly?: boolean;
}) {
  const client = useQueryClient();
  const [kind, setKind] = useState("mood");
  const [editing, setEditing] = useState<Log | null>(null);
  const [mood, setMood] = useState("ok");
  const [date, setDate] = useState(() => dayInTimezone());
  const [bed, setBed] = useState("22:00");
  const [wake, setWake] = useState("07:00");
  const [quality, setQuality] = useState(3);
  const key = ["wellness", patientId, kind];
  const url = `/api/v1/patients/${patientId}/${kind}-logs/`;
  const query = useQuery({
    queryKey: key,
    queryFn: () => apiClient<Log[]>(url, { method: "GET" }),
  });
  const save = useMutation({
    mutationFn: () =>
      apiClient(url + (editing ? `${editing.id}/` : ""), {
        method: editing ? "PATCH" : "POST",
        body: JSON.stringify(
          kind === "mood"
            ? {
                mood,
                logged_at: editing?.logged_at ?? new Date().toISOString(),
                device_updated_at: new Date().toISOString(),
              }
            : {
                date,
                bed_time: bed,
                wake_time: wake,
                quality,
                device_updated_at: new Date().toISOString(),
              },
        ),
      }),
    onSuccess: () => {
      setEditing(null);
      void client.invalidateQueries({ queryKey: key });
    },
  });
  return (
    <section className="space-y-4">
      <h2 className="text-xl font-bold">Sleep and mood</h2>
      <label>
        Log type
        <select
          value={kind}
          onChange={(e) => {
            setKind(e.target.value);
            setEditing(null);
          }}
        >
          <option value="mood">Mood</option>
          <option value="sleep">Sleep</option>
        </select>
      </label>
      {!readOnly && (
        <form
          className="grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          {kind === "mood" ? (
            <label>
              Mood
              <select value={mood} onChange={(e) => setMood(e.target.value)}>
                {["great", "good", "ok", "low", "bad"].map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </label>
          ) : (
            <>
              <label>
                Date
                <input
                  required
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </label>
              <label>
                Bedtime
                <input
                  required
                  type="time"
                  value={bed}
                  onChange={(e) => setBed(e.target.value)}
                />
              </label>
              <label>
                Wake time
                <input
                  required
                  type="time"
                  value={wake}
                  onChange={(e) => setWake(e.target.value)}
                />
              </label>
              <label>
                Quality
                <select
                  value={quality}
                  onChange={(e) => setQuality(Number(e.target.value))}
                >
                  {[1, 2, 3, 4, 5].map((q) => (
                    <option key={q}>{q}</option>
                  ))}
                </select>
              </label>
            </>
          )}
          <button disabled={save.isPending}>
            {editing ? "Save correction" : "Add entry"}
          </button>
          {editing && (
            <button type="button" onClick={() => setEditing(null)}>
              Cancel correction
            </button>
          )}
          {save.isError && <p role="alert">We could not save the entry.</p>}
        </form>
      )}
      {query.isPending ? (
        <p>Loading entries…</p>
      ) : query.isError ? (
        <p>Entries unavailable. Doctor access requires consent.</p>
      ) : !query.data.length ? (
        <p>No entries yet.</p>
      ) : (
        <ul>
          {query.data.map((row) => (
            <li className="rounded-card bg-surface p-4" key={row.id}>
              {row.mood
                ? `${row.logged_at} · ${row.mood}`
                : `${row.date} · ${row.bed_time}–${row.wake_time} · Quality ${row.quality}`}
              {!readOnly && (
                <button
                  className="p-3"
                  onClick={() => {
                    setEditing(row);
                    setMood(row.mood ?? "ok");
                    setDate(row.date ?? date);
                    setBed(row.bed_time?.slice(0, 5) ?? bed);
                    setWake(row.wake_time?.slice(0, 5) ?? wake);
                    setQuality(row.quality ?? 3);
                  }}
                >
                  Correct
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
