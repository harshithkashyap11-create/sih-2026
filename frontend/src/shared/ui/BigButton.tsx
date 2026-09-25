import type { ButtonHTMLAttributes, PropsWithChildren } from "react";

interface BigButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "accent" | "quiet" | "soft" | "danger";
}

export function BigButton({
  children,
  className = "",
  type = "button",
  variant = "primary",
  ...props
}: PropsWithChildren<BigButtonProps>) {
  const variantClasses = {
    primary:
      "border-primary bg-primary text-primary-text shadow-soft hover:-translate-y-0.5 hover:shadow-card",
    secondary:
      "border-border bg-surface text-text hover:border-primary hover:bg-calm",
    accent:
      "border-accent bg-accent text-text shadow-soft hover:-translate-y-0.5 hover:shadow-card",
    quiet: "border-transparent bg-surface-muted text-text hover:bg-calm",
    soft: "border-primary/20 bg-calm text-primary hover:border-primary/40 hover:bg-calm",
    danger: "border-danger bg-danger text-primary-text shadow-soft hover:-translate-y-0.5 hover:shadow-card",
  }[variant];

  return (
    <button
      className={`min-h-touch w-full rounded-control border-2 px-5 py-3 text-left font-bold transition duration-fast ease-out active:translate-y-0 active:scale-[0.99] active:shadow-none disabled:translate-y-0 disabled:shadow-none ${variantClasses} ${className}`}
      type={type}
      {...props}
    >
      {children}
    </button>
  );
}
