import { useState } from "react";
import { useTranslation } from "react-i18next";

import type { Reminder, ReminderAction } from "../../../db/repo/routine";
import { BigButton, Card, ConfirmDialog } from "../../../shared/ui";

export function ReminderCard({
  reminder,
  onRespond,
}: {
  reminder: Reminder;
  onRespond: (action: ReminderAction) => void;
}) {
  const { t } = useTranslation();
  const [confirmSkip, setConfirmSkip] = useState(false);
  const act = (action: ReminderAction) =>
    action === "skipped" && reminder.category === "medicine"
      ? setConfirmSkip(true)
      : onRespond(action);
  return (
    <Card className="space-y-4">
      <div>
        <p className="text-lg font-bold">
          {new Date(reminder.scheduled_at).toLocaleTimeString([], {
            timeZone: CARE_TIMEZONE,
            hour: "numeric",
            minute: "2-digit",
          })}
        </p>
        <h2 className="text-2xl font-bold">{reminder.title}</h2>
        {reminder.note && <p>{reminder.note}</p>}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {(["taken", "later", "skipped", "help"] as const).map((action) => (
          <BigButton
            key={action}
            variant={action === "taken" ? "primary" : "secondary"}
            onClick={() => act(action)}
          >
            {t(`routine.actions.${action}`)}
          </BigButton>
        ))}
      </div>
      {reminder.status === "help" ? (
        <a
          className="block min-h-touch rounded-card bg-accent px-5 py-4 text-center font-bold"
          href="tel:"
        >
          {t("routine.callCaregiver")}
        </a>
      ) : null}
      <ConfirmDialog
        open={confirmSkip}
        title={t("routine.skipTitle")}
        yesLabel={t("routine.skipYes")}
        noLabel={t("routine.cancel")}
        onYes={() => {
          setConfirmSkip(false);
          onRespond("skipped");
        }}
        onNo={() => setConfirmSkip(false)}
      />
    </Card>
  );
}
import { CARE_TIMEZONE } from "../../../db/reminders";
