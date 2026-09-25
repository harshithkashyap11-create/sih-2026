import { AlertCircle, Inbox, LoaderCircle } from "lucide-react";

type PageStateTone = "loading" | "empty" | "problem";

interface PageStateProps {
  detail?: string;
  title: string;
  tone?: PageStateTone;
}

const icons = {
  loading: LoaderCircle,
  empty: Inbox,
  problem: AlertCircle,
};

export function PageState({ detail, title, tone = "empty" }: PageStateProps) {
  const Icon = icons[tone];
  return (
    <section
      aria-live={tone === "loading" ? "polite" : undefined}
      className="rounded-card border border-border bg-surface px-6 py-10 text-center shadow-soft"
      role={tone === "problem" ? "alert" : "status"}
    >
      <Icon
        aria-hidden="true"
        className={`mx-auto h-10 w-10 ${tone === "problem" ? "text-danger" : "text-primary"} ${tone === "loading" ? "animate-spin" : ""}`}
      />
      <h2 className="mt-4 text-xl font-bold">{title}</h2>
      {detail ? (
        <p className="mx-auto mt-2 max-w-md text-muted">{detail}</p>
      ) : null}
    </section>
  );
}
