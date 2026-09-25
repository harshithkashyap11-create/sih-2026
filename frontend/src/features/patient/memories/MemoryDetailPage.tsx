import { FavouriteButton } from "../games/FavouriteButton";
import { useEffect, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getMeta, setMeta } from "../../../db/schema";
import type { CachedMemory } from "../../../db/schema";
import { useTts } from "../../../shared/hooks/useTts";
import { BigButton, Card, PageState, PhotoStrip } from "../../../shared/ui";
import { memoriesRepository } from "../../../db/repo/memories";
import { BookHeart, Volume2 } from "lucide-react";

export function MemoryDetailPage() {
  const initialMemory = useLocation().state as CachedMemory | null;
  const { memoryId } = useParams();
  const [memory, setMemory] = useState(initialMemory);
  const [loading, setLoading] = useState(!initialMemory);
  const [loadProblem, setLoadProblem] = useState(false);
  const { t } = useTranslation();
  const speak = useTts();
  useEffect(() => {
    let cancelled = false;
    if (!memory && memoryId)
      void memoriesRepository
        .get(memoryId)
        .then((item) => {
          if (!cancelled) setMemory(item ?? null);
        })
        .catch(() => {
          if (!cancelled) setLoadProblem(true);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    return () => {
      cancelled = true;
    };
  }, [memory, memoryId]);
  useEffect(() => {
    if (!memory) return;
    void getMeta("memoryEngagement")
      .then((value) => {
        const events = JSON.parse(value ?? "{}") as Record<string, string>;
        events[memory.id] = new Date().toISOString();
        return setMeta("memoryEngagement", JSON.stringify(events));
      })
      .catch(() => undefined);
  }, [memory]);
  if (!memory)
    return (
      <PageState
        tone={loading ? "loading" : loadProblem ? "problem" : "empty"}
        title={t(
          loading
            ? "memories.loading"
            : loadProblem
              ? "auth.errors.request_not_completed"
              : "memories.empty",
        )}
      />
    );
  return (
    <article className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.13em] text-primary">
            <BookHeart aria-hidden="true" className="h-4 w-4" />
            {t("memories.title")}
          </p>
          <h1 className="mt-1 text-3xl font-bold sm:text-4xl">
            {memory.title}
          </h1>
        </div>
        <FavouriteButton kind="memory" id={memory.id} />
      </header>
      <PhotoStrip label={t("memories.photos")} photos={memory.media} />
      <Card className="space-y-5 border-l-4 border-l-accent bg-accent-light/30">
        <p className="text-2xl leading-relaxed">{memory.summary}</p>
        <BigButton
          className="flex items-center justify-center gap-3 text-center"
          onClick={() => speak(memory.summary)}
        >
          <Volume2 aria-hidden="true" className="h-6 w-6" />
          {t("memories.read")}
        </BigButton>
      </Card>
      {memory.people.length ? (
        <div className="flex flex-wrap gap-2">
          {memory.people.map((person) => (
            <span
              className="rounded-pill bg-lavender px-4 py-2 font-semibold"
              key={person.id}
            >
              {person.name} · {person.relationship}
            </span>
          ))}
        </div>
      ) : null}
    </article>
  );
}
