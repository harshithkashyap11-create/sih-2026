import type { ButtonHTMLAttributes, ReactNode } from "react";

interface IconTileProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "children"
> {
  icon: ReactNode;
  label: string;
}

export function IconTile({
  className = "",
  icon,
  label,
  type = "button",
  ...props
}: IconTileProps) {
  return (
    <button
      className={`group min-h-touch flex w-full items-center gap-4 rounded-card border border-border bg-surface px-5 py-4 text-left font-bold text-text shadow-soft transition duration-fast hover:-translate-y-0.5 hover:border-primary hover:shadow-card ${className}`}
      type={type}
      {...props}
    >
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-calm text-[1.7rem] text-primary transition duration-fast group-hover:bg-primary group-hover:text-primary-text">
        {icon}
      </span>
      <span>{label}</span>
    </button>
  );
}
