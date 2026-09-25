import { useAuthStore } from "../../auth/authStore";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { db, getMeta, setMeta } from "../../../db/schema";
import { createOutboxEntry } from "../../../db/outbox";
import { BigButton, Card } from "../../../shared/ui";
import { useEffect, useState } from "react";

type CheckIn = { id: string; requested_by: string; answer: string | null };
export function CheckInCard() {
  const { t } = useTranslation();
  const userId = useAuthStore((state) => state.user?.id);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState(false);
  const query = useQuery({
    queryKey: ["patient", userId, "checkins"],
    queryFn: async () => {
      const rows = JSON.parse((await getMeta("checkins")) ?? "[]") as CheckIn[];
      return rows.find((x) => !x.answer) ?? null;
    },
  });
  const { refetch } = query;
  useEffect(() => {
    const refresh = () => {
      void refetch();
    };
    window.addEventListener("smarana:comfort-updated", refresh);
    return () => window.removeEventListener("smarana:comfort-updated", refresh);
  }, [refetch]);
  const row = query.data;
  if (!row) return null;
  async function answer(value: string) {
    if (!row || busy) return;
    setBusy(true);
    setProblem(false);
    try {
      const patientId = await getMeta("patientId");
      if (!patientId) throw new Error("No patient");
      const id = crypto.randomUUID(),
        stamp = new Date().toISOString();
      await db.transaction("rw", db.meta, db.outbox, async () => {
        const rows = JSON.parse(
          (await getMeta("checkins")) ?? "[]",
        ) as CheckIn[];
        await setMeta(
          "checkins",
          JSON.stringify(
            rows.map((x) => (x.id === row.id ? { ...x, answer: value } : x)),
          ),
        );
        await db.outbox.put(
          createOutboxEntry("checkin_response", id, patientId, {
            id,
            patient_id: patientId,
            checkin: row.id,
            answer: value,
            responded_at: stamp,
            device_updated_at: stamp,
          }),
        );
      });
      await query.refetch();
    } catch {
      setProblem(true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card className="space-y-4 border-l-4 border-l-lavender">
      <h2 className="text-2xl font-bold">
        {t("checkin.question", { name: row.requested_by })}
      </h2>
      <BigButton disabled={busy} onClick={() => void answer("okay")}>
        {t("checkin.okay")}
      </BigButton>
      <BigButton
        disabled={busy}
        variant="secondary"
        onClick={() => void answer("need_help")}
      >
        {t("checkin.help")}
      </BigButton>
      {problem && <p role="alert">{t("health.unavailable")}</p>}
    </Card>
  );
}
