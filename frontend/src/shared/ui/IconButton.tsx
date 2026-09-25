import type { ButtonHTMLAttributes, PropsWithChildren } from "react";

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  size?: "patient" | "professional";
}

export function IconButton({
  children,
  className = "",
  label,
  size = "professional",
  type = "button",
  ...props
}: PropsWithChildren<IconButtonProps>) {
  return (
    <button
      aria-label={label}
      className={`inline-flex shrink-0 items-center justify-center rounded-control border border-border bg-surface text-text shadow-soft transition duration-fast hover:border-primary/40 hover:bg-calm active:scale-[0.98] disabled:shadow-none ${size === "patient" ? "min-h-touch min-w-[64px]" : "min-h-[44px] min-w-[44px]"} ${className}`}
      type={type}
      {...props}
    >
      {children}
    </button>
  );
}
