import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  routineRepository,
  isCurrentMedication,
  type Medication,
  type RoutineRepository,
} from "../../../db/repo/routine";
import { BigButton, Card } from "../../../shared/ui";
import { careTime } from "../../../db/reminders";

export function MedicinesPage({
  repo = routineRepository,
}: {
  repo?: RoutineRepository;
}) {
  const { t } = useTranslation();
  const [medicines, setMedicines] = useState<Medication[]>([]);
  const [contact, setContact] = useState<{ name: string; phone: string } | null>(null);
  const [clock, setClock] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setClock(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    let active = true;
    void repo.getCaregiverContact?.().then((person) => {
      if (active) setContact(person);
    }).catch(() => { if (active) setContact(null); });
    return () => { active = false; };
  }, [repo]);
  useEffect(() => {
    let active = true;
    void repo.getMedications().then((items) => {
      if (active) setMedicines(items);
    }).catch(() => { if (active) setMedicines([]); });
    return () => { active = false; };
  }, [repo]);
  const next = useMemo(
    () =>
      medicines
        .filter((medicine) => isCurrentMedication(medicine))
        .flatMap((m) => m.times.map((time) => ({ m, time })))
        .filter(({ time }) => time.slice(0, 5) >= careTime(clock))
        .sort((a, b) => a.time.localeCompare(b.time))[0],
    [medicines, clock],
  );
  return (
    <section className="space-y-5">
      <h1 className="text-3xl font-bold">{t("medicines.title")}</h1>
      {medicines.filter((medicine) => isCurrentMedication(medicine)).map((medicine) => (
        <Card
          key={medicine.id}
          className={
            next?.m.id === medicine.id ? "border-4 border-primary" : ""
          }
        >
          <h2 className="text-2xl font-bold">{medicine.name}</h2>
          <p>{medicine.dose}</p>
          <p>{medicine.times.join(", ")}</p>
          <p>{medicine.instructions}</p>
          {next?.m.id === medicine.id && (
            <strong>{t("medicines.nextDose")}</strong>
          )}
        </Card>
      ))}
      {contact && /^\+?[\d ()-]+$/.test(contact.phone) && <BigButton onClick={() => { window.location.href = `tel:${contact.phone.replace(/[^\d+]/g, "")}`; }}>{t("medicines.askCaregiver", { name: contact.name })}</BigButton>}
    </section>
  );
}
