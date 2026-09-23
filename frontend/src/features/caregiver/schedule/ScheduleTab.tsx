import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../../api/client";
import { FormEvent, useState } from "react";

import { caregiverApi, type RoutineItem, type RoutinePayload } from "../api";

const categories = [
  "medicine",
  "water",
  "meal",
  "doctor_visit",
  "game",
  "walk",
  "call",
  "sleep",
  "custom",
];
const categoryIcons: Record<string, string> = {
  medicine: "💊",
  water: "💧",
  meal: "🍲",
  doctor_visit: "🩺",
  game: "🧩",
  walk: "🚶",
  call: "☎",
  sleep: "🌙",
  custom: "●",
};
const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const emptyForm = (): RoutinePayload => ({
  title: "",
  category: "custom",
  time_of_day: "08:00",
  days_of_week: [0, 1, 2, 3, 4, 5, 6],
  start_date: dayInTimezone(),
  end_date: null,
  icon: "",
  note: "",
});

export function ScheduleTab({ patientId }: { patientId: string }) {
  const queryClient = useQueryClient();
  const queryKey = ["caregiver", patientId, "routine"];
  const routine = useQuery({
    queryKey,
    queryFn: () => caregiverApi.routine(patientId),
  });
  const [form, setForm] = useState<RoutinePayload>(emptyForm);
  const [warnings, setWarnings] = useState<
    Array<{ id: string; title: string }>
  >([]);
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: () =>
      editing
        ? caregiverApi.updateRoutine(patientId, editing, form)
        : caregiverApi.createRoutine(patientId, form),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<RoutineItem[]>(queryKey);
      if (!editing)
        queryClient.setQueryData<RoutineItem[]>(queryKey, [
          ...(previous ?? []),
          { ...form, id: "pending", source: "caregiver", set_by: null },
        ]);
      return { previous };
    },
    onError: (_error, _variables, context) =>
      queryClient.setQueryData(queryKey, context?.previous),
    onSettled: () => void queryClient.invalidateQueries({ queryKey }),
    onSuccess: () => {
      setEditing(null);
      setForm(emptyForm());
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => caregiverApi.deleteRoutine(patientId, id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey }),
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (form.title.trim() && form.days_of_week.length) {
      setChecking(true);
      setCheckError(false);
      void apiClient<{ warnings: Array<{ id: string; title: string }> }>(
        `/api/v1/patients/${patientId}/routine-conflicts/`,
        { method: "POST", body: JSON.stringify({ ...form, item_id: editing }) },
      )
        .then((result) => {
          if (result.warnings.length) setWarnings(result.warnings);
          else save.mutate();
        })
        .catch(() => setCheckError(true))
        .finally(() => setChecking(false));
    }
  };
  const beginEdit = (item: RoutineItem) => {
    setEditing(item.id);
    setForm({
      title: item.title,
      category: item.category,
      time_of_day: item.time_of_day.slice(0, 5),
      days_of_week: item.days_of_week,
      start_date: item.start_date,
      end_date: item.end_date,
      icon: item.icon,
      note: item.note,
    });
  };

  return (
    <div className="space-y-6">
      <section className="rounded-card bg-surface p-5 shadow-card">
        <h2 className="text-xl font-bold">
          {editing ? "Edit routine item" : "Add to routine"}
        </h2>
        <form onSubmit={submit}>
          <fieldset
            disabled={checking || warnings.length > 0 || save.isPending}
            className="mt-4 grid gap-4 sm:grid-cols-2"
          >
            <label className="grid gap-1">
              Title
              <input
                required
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </label>
            <label className="grid gap-1">
              Category
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              >
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {categoryIcons[category]} {category.replace("_", " ")}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1">
              Time
              <input
                required
                type="time"
                value={form.time_of_day}
                onChange={(e) =>
                  setForm({ ...form, time_of_day: e.target.value })
                }
              />
            </label>
            <label className="grid gap-1 sm:col-span-2">
              Note
              <textarea
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
              />
            </label>
            <fieldset className="sm:col-span-2">
              <legend>Days</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {dayNames.map((day, index) => (
                  <button
                    aria-pressed={form.days_of_week.includes(index)}
                    className="rounded-full border px-3 py-2 aria-pressed:bg-primary aria-pressed:text-white"
                    key={day}
                    type="button"
                    onClick={() =>
                      setForm({
                        ...form,
                        days_of_week: form.days_of_week.includes(index)
                          ? form.days_of_week.filter((value) => value !== index)
                          : [...form.days_of_week, index].sort(),
                      })
                    }
                  >
                    {day}
                  </button>
                ))}
              </div>
              {!form.days_of_week.length && (
                <p className="text-sm text-red-700">Choose at least one day.</p>
              )}
            </fieldset>
            <button
              className="rounded-card bg-primary px-4 py-3 font-bold text-white"
              disabled={checking || save.isPending || !form.days_of_week.length}
              type="submit"
            >
              Save routine item
            </button>
          </fieldset>
        </form>
      </section>
      {save.isError && <p role="alert">We could not save this routine item.</p>}
      {checkError && (
        <p role="alert">We could not check for conflicts. Please try again.</p>
      )}
      {warnings.length > 0 && (
        <section
          role="dialog"
          aria-modal="true"
          aria-label="Routine conflicts"
          className="rounded-card bg-surface p-5"
        >
          <h2>Nearby routine items</h2>
          <ul>
            {warnings.map((w) => (
              <li key={w.id}>{w.title}</li>
            ))}
          </ul>
          <p>These items occur within ten minutes. Save anyway?</p>
          <button
            disabled={save.isPending}
            onClick={() => {
              setWarnings([]);
              save.mutate();
            }}
          >
            Save anyway
          </button>
          <button onClick={() => setWarnings([])}>Cancel</button>
        </section>
      )}
      <section>
        <h2 className="text-xl font-bold">Routine</h2>
        {routine.isPending ? (
          <p>Loading routine…</p>
        ) : routine.isError ? (
          <p>We could not load the routine.</p>
        ) : !routine.data?.length ? (
          <p>No routine items yet.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {routine.data.map((item) => (
              <li
                className="flex items-center justify-between rounded-card bg-surface p-4"
                key={item.id}
              >
                <div>
                  <strong>
                    {categoryIcons[item.category]} {item.title}
                  </strong>
                  <p className="text-sm text-muted">
                    {item.time_of_day.slice(0, 5)} ·{" "}
                    {item.days_of_week.map((day) => dayNames[day]).join(", ")}
                  </p>
                  {item.source === "doctor" && (
                    <p>🔒 Set by {item.set_by || "doctor"}</p>
                  )}
                </div>
                {item.source !== "doctor" && item.id !== "pending" && (
                  <div>
                    <button
                      disabled={
                        checking || warnings.length > 0 || save.isPending
                      }
                      className="px-3 py-2"
                      onClick={() => beginEdit(item)}
                    >
                      Edit
                    </button>
                    <button
                      className="px-3 py-2 text-red-700"
                      onClick={() => remove.mutate(item.id)}
                    >
                      Delete
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
import { dayInTimezone } from "../../../db/reminders";
