import { FavouriteButton } from "./FavouriteButton";
import { gameLabel } from "../../../content/game-labels";
/* eslint-disable react-refresh/only-export-components -- patient lookup is shared by the adjacent game route. */
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { apiClient } from "../../../api/client";
import { getMeta, setMeta } from "../../../db/schema";
import { isFakeOffline } from "../../../db/outbox";
import { listGames, type GameDefinitionDto } from "../../../db/repo/games";
import { gameCatalog as games } from "../../../games/registry";
import { selectDailyGames } from "../../../games/dailySession";
import { db } from "../../../db/schema";
import {
  loadLatestResume,
  type ResumeState,
} from "../../../games/engine/resume";
import { Brain, Clock3, Gamepad2, MapPin, Play, Sparkles } from "lucide-react";
import { PageState, StatusBadge } from "../../../shared/ui";

const challengeKey = `games-challenge:${new Date().toISOString().slice(0, 10)}`;
export function GamesPage() {
  const { t } = useTranslation();
  const [daily, setDaily] = useState<string[]>([]);
  const [region, setRegion] = useState("AS");
  const [definitions, setDefinitions] = useState<GameDefinitionDto[]>([]);
  const [resume, setResume] = useState<ResumeState | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [challenge, setChallenge] = useState(
    () => sessionStorage.getItem(challengeKey) === "true",
  );
  useEffect(() => {
    void Promise.all([listGames(), loadLatestResume(), currentPatient()])
      .then(async ([items, interrupted, patient]) => {
        setRegion(patient.region);
        const history = await db.gameSessions
          .where("patientId")
          .equals(patient.id)
          .toArray();
        setDaily(selectDailyGames(games, history).map((game) => game.key));
        setDefinitions(items);
        setResume(interrupted);
      })
      .catch(() => {
        setDefinitions(
          games.map((game) => ({
            key: game.key,
            name: game.name,
            cognitive_domains: game.domains,
            min_level: game.minDifficulty,
            max_level: game.maxDifficulty,
            is_regional: true,
          })),
        );
        setFailed(true);
      })
      .finally(() => setLoading(false));
  }, []);
  if (loading)
    return <PageState title={t("games.loadingList")} tone="loading" />;
  const visibleDefinitions = definitions.filter((item) =>
    games.some((game) => game.enabled && game.key === item.key),
  );
  return (
    <section className="space-y-6">
      <header>
        <p className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.13em] text-primary">
          <Brain aria-hidden="true" className="h-4 w-4" />
          {t("games.adaptiveBadge")}
        </p>
        <h1 className="mt-1 text-3xl font-bold sm:text-4xl">
          {t("games.title")}
        </h1>
      </header>
      <div className="rounded-card border border-primary/20 bg-calm p-5">
        <p className="text-xl font-bold">
          {t("games.catalogSummary", { count: visibleDefinitions.length })}
        </p>
        <p className="mt-2 text-base">{t("games.adaptiveSummary")}</p>
      </div>
      {failed && (
        <p className="mb-4 rounded-card bg-warning/20 p-4">
          {t("games.offlineList")}
        </p>
      )}
      {resume && (
        <Link
          className="group flex min-h-touch items-center justify-between gap-4 rounded-card border border-success/20 bg-calm p-5 text-xl font-bold shadow-soft hover:-translate-y-0.5 hover:shadow-card"
          to={`/patient/games/${resume.gameKey}`}
        >
          <span>
            <span className="block text-sm font-normal text-muted">
              {t("games.resumeTitle")}
            </span>
            {games.find((item) => item.key === resume.gameKey)?.name ??
              t("games.continue")}
          </span>
          <Play aria-hidden="true" className="h-7 w-7 text-primary" />
        </Link>
      )}
      <label className="flex min-h-touch items-center gap-4 rounded-card border border-border bg-surface p-4 text-xl font-bold shadow-soft">
        <input
          checked={challenge}
          className="h-7 w-7"
          type="checkbox"
          onChange={(event) => {
            setChallenge(event.target.checked);
            sessionStorage.setItem(challengeKey, String(event.target.checked));
          }}
        />
        {t("games.challenge")}
      </label>
      <section aria-label={t("games.dailyTitle")}>
        <h2 className="mb-3 text-2xl font-bold">{t("games.dailyTitle")}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {daily
            .filter((key) => definitions.some((game) => game.key === key))
            .map((key) => {
              const entry = games.find((game) => game.key === key)!;
              return (
                <Link
                  key={key}
                  className="flex min-h-touch items-center gap-3 rounded-card border border-primary/30 bg-surface p-4 font-bold shadow-soft hover:border-primary hover:bg-calm"
                  to={entry.route}
                >
                  <Sparkles
                    aria-hidden="true"
                    className="h-5 w-5 text-accent"
                  />
                  {t(entry.nameKey, { defaultValue: entry.name })}
                </Link>
              );
            })}
        </div>
      </section>
      <div className="grid gap-4 sm:grid-cols-2">
        {visibleDefinitions.map((game) => {
          const entry = games.find((item) => item.key === game.key)!;
          return (
            <article
              className="flex flex-col rounded-card border border-border bg-surface p-5 shadow-soft transition duration-fast hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-card"
              key={game.key}
            >
              <div className="mb-4 flex items-start justify-between gap-3">
                <span
                  aria-hidden="true"
                  className="flex h-12 w-12 items-center justify-center rounded-2xl bg-calm text-primary"
                >
                  <Gamepad2 className="h-6 w-6" />
                </span>
                <FavouriteButton kind="game" id={game.key} />
              </div>
              <Link
                className="group flex flex-1 flex-col rounded-control"
                to={`/patient/games/${game.key}`}
              >
                <span className="text-xl font-bold">
                  {gameLabel(game.key, game.name, region)}
                </span>
                <span className="mt-2 block flex-1 text-base font-normal text-muted">
                  {t(entry.descriptionKey, { defaultValue: game.name })}
                </span>
                <span className="mt-4 flex flex-wrap gap-2">
                  <StatusBadge tone="success">
                    {t("games.adaptiveBadge")}
                  </StatusBadge>
                  {game.cognitive_domains[0] ? (
                    <StatusBadge tone="info">
                      {t(`games.domains.${game.cognitive_domains[0]}`, {
                        defaultValue: game.cognitive_domains[0],
                      })}
                    </StatusBadge>
                  ) : null}
                  {game.is_regional ? (
                    <StatusBadge tone="neutral">
                      <MapPin aria-hidden="true" className="mr-1 h-3.5 w-3.5" />
                      {t("games.regional")}
                    </StatusBadge>
                  ) : null}
                </span>
                <span className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-4 font-bold text-primary">
                  <span className="inline-flex items-center gap-2 text-sm font-normal text-muted">
                    <Clock3 aria-hidden="true" className="h-4 w-4" />
                    {t("games.duration", {
                      minutes: entry.estimatedDurationMin,
                    })}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    {t("games.continue")}
                    <Play aria-hidden="true" className="h-4 w-4" />
                  </span>
                </span>
              </Link>
              <Link
                className="mt-2 inline-flex min-h-[44px] items-center justify-center rounded-control bg-surface-muted px-3 text-sm font-bold hover:bg-calm"
                to={`/patient/games/${game.key}?practice=true`}
              >
                {t("games.practice")}
              </Link>
            </article>
          );
        })}
      </div>
      {visibleDefinitions.length === 0 && (
        <PageState title={t("games.empty")} />
      )}
    </section>
  );
}
interface GamePatient {
  maxDifficultyLevel?: number;
  id: string;
  sessionCapMinutes: number;
  region: string;
  language: string;
  knownPlaces?: string[];
  useMemoriesInQuiz?: boolean;
}
export async function currentPatient(): Promise<GamePatient> {
  const cached = await getMeta("gamePatient");
  if ((isFakeOffline() || !navigator.onLine) && cached)
    return JSON.parse(cached) as GamePatient;
  try {
    const response = await apiClient<{
      results: Array<{
        id: string;
        session_cap_minutes: number | null;
        max_difficulty_level?: number | null;
        region?: string;
        language?: string;
      }>;
    }>("/api/v1/patients/", { method: "GET" });
    if (!response.results[0]) throw new Error("Patient unavailable");
    const patient = {
      id: response.results[0].id,
      sessionCapMinutes: response.results[0].session_cap_minutes ?? 20,
      maxDifficultyLevel: response.results[0].max_difficulty_level ?? 5,
      region: response.results[0].region || "AS",
      language: response.results[0].language ?? "en",
      knownPlaces: [] as string[],
      useMemoriesInQuiz: cached
        ? Boolean((JSON.parse(cached) as GamePatient).useMemoriesInQuiz)
        : false,
    };
    try {
      const profile = await apiClient<{
        known_places: Array<string | { name?: string; title?: string }>;
      }>(`/api/v1/patients/${patient.id}/profile/`, { method: "GET" });
      patient.knownPlaces = (profile.known_places ?? [])
        .map((place) =>
          typeof place === "string" ? place : (place.name ?? place.title ?? ""),
        )
        .filter(Boolean);
    } catch {
      /* The patient card still supports games when profile refresh is unavailable. */
    }
    await setMeta("gamePatient", JSON.stringify(patient));
    return patient;
  } catch (error) {
    if (cached) return JSON.parse(cached) as GamePatient;
    throw error;
  }
}
