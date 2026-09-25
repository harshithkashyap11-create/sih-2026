import type { PropsWithChildren } from "react";

type StatusTone = "neutral" | "success" | "warning" | "danger" | "info";

const toneClasses: Record<StatusTone, string> = {
  neutral: "bg-surface-muted text-muted",
  success: "bg-calm text-success",
  warning: "bg-accent-light text-warn",
  danger: "bg-danger/10 text-danger",
  info: "bg-lavender text-info",
};

export function StatusBadge({
  children,
  tone = "neutral",
}: PropsWithChildren<{ tone?: StatusTone }>) {
  return (
    <span
      className={`inline-flex min-h-8 items-center rounded-pill px-3 py-1 text-sm font-bold ${toneClasses[tone]}`}
    >
      {children}
    </span>
  );
}
