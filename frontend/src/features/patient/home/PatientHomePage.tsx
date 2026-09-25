import { CheckInCard } from "./CheckInCard";
import { SuggestionCard } from "./SuggestionCard";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import {
  Brain,
  CalendarCheck,
  HeartPulse,
  Images,
  Leaf,
  Pill,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";

import {
  patientRepository,
  type PatientRepository,
} from "../../../db/repo/patient";
import { useAuthStore } from "../../auth/authStore";
import { useAppContext } from "../../../app/context";
import {
  BigButton,
  Card,
  IconTile,
  OrientationCard,
  PageState,
} from "../../../shared/ui";
import { abandonResume, loadLatestResume } from "../../../games/engine/resume";
import { TalkButton } from "../../../shared/ui/TalkButton";
import { springs } from "../../../shared/motion/tokens";

const primaryTiles = [
  ["games", Brain],
  ["memories", Images],
  ["routine", CalendarCheck],
] as const;

const supportTiles = [
  ["medicines", Pill],
  ["calm", Leaf],
  ["people", Users],
  ["progress", TrendingUp],
] as const;

export function PatientHomePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const userId = useAuthStore((state) => state.user?.id);
  const name = useAuthStore((state) => state.user?.display_name ?? "");
  const { repos } = useAppContext();
  const repo =
    (repos.patient as PatientRepository | undefined) ?? patientRepository;
  const orientation = useQuery({
    queryKey: ["patient", userId, "orientation"],
    queryFn: () => repo.getOrientation(),
  });
  const interrupted = useQuery({
    queryKey: ["games", userId, "interrupted"],
    queryFn: loadLatestResume,
    enabled: orientation.isSuccess,
  });

  if (orientation.isPending)
    return <PageState title={t("health.loading")} tone="loading" />;
  if (orientation.isError)
    return <PageState title={t("health.unavailable")} tone="problem" />;

  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
      initial={false}
      transition={springs.gentle}
    >
      <header className="flex items-start justify-between gap-4 pt-2">
        <div>
          <p className="mb-1 flex items-center gap-2 text-sm font-bold uppercase tracking-[0.14em] text-primary">
            <Sparkles aria-hidden="true" className="h-4 w-4" />
            {t("app.eyebrow")}
          </p>
          <h1 className="text-balance text-3xl font-bold leading-tight sm:text-4xl">
            {t(`home.greeting_${orientation.data.greeting_key}`, { name })}
          </h1>
          <p className="mt-2 text-lg text-muted">{t("home.choose")}</p>
        </div>
        <span
          aria-hidden="true"
          className="hidden h-14 w-14 shrink-0 items-center justify-center rounded-full bg-accent-light text-warn sm:flex"
        >
          <HeartPulse className="h-7 w-7" />
        </span>
      </header>

      <TalkButton presentation="hero" />
      <CheckInCard />
      <OrientationCard orientation={orientation.data} />
      <SuggestionCard />
      {interrupted.data ? (
        <Card
          aria-labelledby="resume-game-title"
          className="space-y-4 border-l-4 border-l-accent"
        >
          <h2 id="resume-game-title" className="text-2xl font-bold">
            {t("games.resumeTitle")}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <BigButton
              onClick={() =>
                void navigate(`/patient/games/${interrupted.data?.gameKey}`)
              }
            >
              {t("games.continue")}
            </BigButton>
            <BigButton
              variant="secondary"
              onClick={() => {
                const resume = interrupted.data;
                if (!resume) return;
                void abandonResume(resume).then(() => {
                  void interrupted.refetch();
                  void navigate(`/patient/games/${resume.gameKey}`);
                });
              }}
            >
              {t("games.startOver")}
            </BigButton>
          </div>
        </Card>
      ) : null}
      <section aria-labelledby="home-sections" className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <h2 id="home-sections" className="text-2xl font-bold">
            {t("home.choose")}
          </h2>
          <span aria-hidden="true" className="h-px flex-1 bg-border" />
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {primaryTiles.map(([key, Icon]) => (
            <IconTile
              key={key}
              className="min-h-28 flex-col items-start justify-between sm:min-h-40"
              icon={<Icon aria-hidden="true" className="h-7 w-7" />}
              label={t(`home.tiles.${key}`)}
              onClick={() => void navigate(`/patient/${key}`)}
            />
          ))}
        </div>
      </section>
      <section
        aria-label={t("landing.settings")}
        className="grid grid-cols-2 gap-3"
      >
        {supportTiles.map(([key, Icon]) => (
          <IconTile
            key={key}
            className="border-transparent bg-surface-muted shadow-none hover:bg-surface"
            icon={<Icon aria-hidden="true" className="h-6 w-6" />}
            label={t(`home.tiles.${key}`)}
            onClick={() => void navigate(`/patient/${key}`)}
          />
        ))}
      </section>
    </motion.div>
  );
}
