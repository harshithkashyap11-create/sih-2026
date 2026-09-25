import { PrivateImage } from "../../../shared/ui/PrivateImage";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { memoriesRepository } from "../../../db/repo/memories";
import type { CachedMemory } from "../../../db/schema";
import { PageState } from "../../../shared/ui";
import { BookHeart, ChevronRight, Images, Sparkles } from "lucide-react";

export function MemoriesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [memories, setMemories] = useState<CachedMemory[] | null>(null);
  useEffect(() => {
    void memoriesRepository
      .list()
      .then(setMemories)
      .catch(() => setMemories([]));
  }, []);
  if (!memories)
    return <PageState title={t("memories.loading")} tone="loading" />;
  return (
    <section className="space-y-6">
      <header>
        <p className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.13em] text-primary">
          <BookHeart aria-hidden="true" className="h-4 w-4" />
          {t("home.tiles.memories")}
        </p>
        <h1 className="mt-1 text-3xl font-bold sm:text-4xl">
          {t("memories.title")}
        </h1>
      </header>
      <button
        className="group flex min-h-touch w-full items-center justify-between gap-4 rounded-card bg-primary px-5 py-4 text-left font-bold text-primary-text shadow-card hover:-translate-y-0.5 hover:shadow-lift"
        type="button"
        onClick={() => void navigate("/patient/memories/quiz")}
      >
        <span className="flex items-center gap-3">
          <Sparkles aria-hidden="true" className="h-6 w-6" />
          {t("quiz.start")}
        </span>
        <ChevronRight
          aria-hidden="true"
          className="h-6 w-6 transition group-hover:translate-x-1"
        />
      </button>
      {memories.length ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {memories.map((memory) => (
            <button
              className="group block min-h-touch w-full text-left"
              key={memory.id}
              type="button"
              onClick={() => void navigate(`/patient/memories/${memory.id}`)}
            >
              <span className="block h-full overflow-hidden rounded-card border border-border bg-surface shadow-soft transition duration-fast group-hover:-translate-y-0.5 group-hover:border-primary group-hover:shadow-card">
                {memory.media[0]?.url ? (
                  <PrivateImage
                    alt=""
                    className="aspect-[16/9] w-full object-cover"
                    src={memory.media[0].url}
                  />
                ) : (
                  <span
                    aria-hidden="true"
                    className="flex aspect-[16/9] w-full items-center justify-center bg-lavender text-primary"
                  >
                    <Images className="h-12 w-12" />
                  </span>
                )}
                <div className="p-5">
                  <span className="text-2xl font-bold">{memory.title}</span>
                  <p className="mt-2 text-muted">
                    {memory.occasion} · {memory.occurredOn}
                  </p>
                </div>
              </span>
            </button>
          ))}
        </div>
      ) : (
        <PageState title={t("memories.empty")} detail={t("app.welcome")} />
      )}
    </section>
  );
}
