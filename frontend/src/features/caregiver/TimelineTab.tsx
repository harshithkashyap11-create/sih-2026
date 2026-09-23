import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { apiClient } from "../../api/client";
export function TimelineTab({ patientId }: { patientId: string }) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const query = useQuery({
    queryKey: ["timeline", patientId, from, to],
    queryFn: () =>
      apiClient<Array<{ id: string; kind: string; at: string; title: string }>>(
        `/api/v1/patients/${patientId}/timeline/?${new URLSearchParams({ ...(from ? { from } : {}), ...(to ? { to } : {}) })}`,
        { method: "GET" },
      ),
  });
  return (
    <section>
      <h2 className="text-xl font-bold">Timeline</h2>
      <div className="flex gap-3">
        <label>
          From
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label>
          To
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
      </div>
      {query.isPending ? (
        <p>Loading timeline…</p>
      ) : query.isError ? (
        <p>We could not load the timeline.</p>
      ) : !query.data.length ? (
        <p>No events in this period.</p>
      ) : (
        <ol className="space-y-3">
          {query.data.map((event) => (
            <li
              className="rounded-card bg-surface p-4"
              key={`${event.kind}:${event.id}`}
            >
              <time>{new Date(event.at).toLocaleString([], { timeZone: CARE_TIMEZONE })}</time>
              <p>
                {event.kind.replaceAll("_", " ")} · {event.title}
              </p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
import { CARE_TIMEZONE } from "../../db/reminders";
