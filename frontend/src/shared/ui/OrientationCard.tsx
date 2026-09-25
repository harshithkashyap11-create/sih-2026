import { PrivateImage } from "./PrivateImage";
import { useTranslation } from "react-i18next";
import type { Orientation } from "../../db/repo/patient";
import { Card } from "./Card";
import { CalendarDays, Clock3, MapPin } from "lucide-react";

export function OrientationCard({ orientation }: { orientation: Orientation }) {
  const { t, i18n } = useTranslation();
  const now = new Date();
  const locale = i18n.resolvedLanguage ?? "en";
  const day = now.toLocaleDateString(locale, {
    weekday: "long",
    timeZone: "Asia/Kolkata",
  });
  const date = now.toLocaleDateString(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "Asia/Kolkata",
  });
  const time = now.toLocaleTimeString(locale, {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  });
  const member = orientation.family_member;
  return (
    <Card className="overflow-hidden p-0 text-[1.05rem] leading-snug">
      <div className="grid gap-3 border-b border-border bg-surface-muted px-5 py-4 sm:grid-cols-[1fr_auto] sm:items-center">
        <div className="flex items-start gap-3">
          <CalendarDays
            aria-hidden="true"
            className="mt-0.5 h-6 w-6 shrink-0 text-primary"
          />
          <div>
            <p className="font-bold">
              {day}, {date}
            </p>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-muted">
              <span className="inline-flex items-center gap-1.5">
                <Clock3 aria-hidden="true" className="h-4 w-4" />
                {time}
              </span>
              {orientation.home_label ? (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin aria-hidden="true" className="h-4 w-4" />
                  {orientation.home_label}
                </span>
              ) : null}
            </p>
          </div>
        </div>
      </div>
      <div className="p-5">
        <p className="text-sm font-bold uppercase tracking-[0.13em] text-primary">
          {t("home.nextActivity")}
        </p>
        <p className="mt-1 text-2xl font-bold leading-tight">
          {orientation.next_activity?.title ?? t("home.noNextActivity")}
        </p>
      </div>
      {member ? (
        <div className="mx-5 mb-5 flex items-center gap-4 rounded-card bg-lavender p-4">
          {member.photo_url ? (
            <PrivateImage
              className="h-20 w-20 shrink-0 rounded-full object-cover"
              src={member.photo_url}
              alt={member.name}
            />
          ) : (
            <span
              aria-hidden="true"
              className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-calm text-3xl"
            >
              ☺
            </span>
          )}
          <p>
            {t("home.familyPhoto", {
              name: member.name,
              relationship: member.relationship,
            })}
          </p>
        </div>
      ) : null}
    </Card>
  );
}
