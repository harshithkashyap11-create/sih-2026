import { gameByKey } from "../../../games/registry";
import { useAuthStore } from "../../auth/authStore";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { activeProfile, db, getMeta } from "../../../db/schema";
import { favourites, suggestActivity } from "../games/favourites";
export function SuggestionCard() {
  const userId = useAuthStore((state) => state.user?.id);
  const { t } = useTranslation();
  const suggestion = useQuery({
    queryKey: ["activity-suggestion", userId],
    staleTime: 0,
    queryFn: async () => {
      const profile = await activeProfile();
      if (!profile) return null;
      const sessions = await db.gameSessions
        .where("patientId")
        .equals(profile.id)
        .toArray();
      const memories = await db.quizAttempts
        .where("patientId")
        .equals(profile.id)
        .toArray();
      const memoryViews = JSON.parse(
        (await getMeta("memoryEngagement")) ?? "{}",
      ) as Record<string, string>;
      const value = suggestActivity(
        new Date(),
        JSON.parse((await getMeta("exerciseAssignments")) ?? "[]") as Array<{
          id: string;
          due: string;
          slot?: string;
        }>,
        await favourites(),
        [
          ...Object.entries(memoryViews).map(([id, at]) => ({
            kind: "memory",
            id,
            at,
          })),
          ...sessions.map((item) => ({
            kind: "game",
            id: item.gameKey,
            at: item.endedAt,
          })),
          ...memories.map((item) => ({
            kind: "memory",
            id: item.memoryId ?? "",
            at: item.attemptedAt,
          })),
        ],
      );
      if (!value) return null;
      const title =
        value.id === "calm"
          ? t("home.tiles.calm")
          : value.kind === "game"
            ? gameByKey(value.id)?.name
            : (await db.memories.get(value.id))?.title;
      return { ...value, title };
    },
  });
  const value = suggestion.data;
  if (!value) return null;
  return (
    <Link
      className="group block min-h-touch rounded-card border border-primary/20 bg-calm p-5 text-xl font-bold shadow-soft hover:-translate-y-0.5 hover:shadow-card"
      to={
        value.id === "calm"
          ? "/patient/calm"
          : `/patient/${value.kind === "game" ? "games" : "memories"}/${value.id}`
      }
    >
      <span className="text-sm uppercase tracking-[0.12em] text-primary">
        {t("newGames.suggestion")}
      </span>
      <span className="mt-1 block text-2xl">
        {value.title}{" "}
        <span
          aria-hidden="true"
          className="transition duration-fast group-hover:translate-x-1"
        >
          →
        </span>
      </span>
    </Link>
  );
}
