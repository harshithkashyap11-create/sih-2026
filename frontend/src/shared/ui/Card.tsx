import type { HTMLAttributes, PropsWithChildren } from "react";

export function Card({
  children,
  className = "",
  ...props
}: PropsWithChildren<HTMLAttributes<HTMLElement>>) {
  return (
    <div
      className={`rounded-card border border-border bg-surface p-5 shadow-soft ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
