import { useState } from "react";
import { apiClient } from "../../api/client";
import { dayInTimezone } from "../../db/reminders";

export function ReportsTab({
  patientId,
  clinical = false,
}: {
  patientId: string;
  clinical?: boolean;
}) {
  const [start, setStart] = useState(() =>
    dayInTimezone(new Date(Date.now() - 29 * 86400000)),
  );
  const [end, setEnd] = useState(() => dayInTimezone());
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState(false);
  async function download(emergency: boolean) {
    setBusy(true);
    setProblem(false);
    try {
      const kind = emergency ? "emergency-card" : "report";
      const period = emergency
        ? ""
        : `?from=${encodeURIComponent(start)}&to=${encodeURIComponent(end)}`;
      const blob = await apiClient<Blob>(
        `/api/v1/patients/${patientId}/${kind}/${period}`,
        { method: "GET", responseType: "blob" },
      );
      const url = URL.createObjectURL(blob),
        link = document.createElement("a");
      link.href = url;
      link.download = `smarana-${kind}.pdf`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setProblem(true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="space-y-4">
      <p>Engagement and tracking support, not a diagnosis.</p>
      <p>
        {clinical
          ? "Clinical report includes doctor-only notes."
          : "Caregiver report includes shared care-team notes."}
      </p>
      <div className="flex flex-wrap gap-3">
        <label>
          From{" "}
          <input
            type="date"
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
        </label>
        <label>
          To{" "}
          <input
            type="date"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
          />
        </label>
      </div>
      <button
        className="min-h-[44px] rounded bg-primary p-3 text-primary-text"
        disabled={busy || !start || !end || start > end}
        onClick={() => void download(false)}
      >
        {busy ? "Preparing PDF…" : "Download report"}
      </button>
      {!clinical && (
        <button
          className="ml-3 min-h-[44px] rounded border p-3"
          disabled={busy}
          onClick={() => void download(true)}
        >
          Download emergency card
        </button>
      )}
      {problem && (
        <p role="alert">Could not prepare this PDF. Please try again.</p>
      )}
    </section>
  );
}
