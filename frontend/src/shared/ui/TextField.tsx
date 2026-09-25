import { useId } from "react";
import type { InputHTMLAttributes } from "react";

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
  error?: string;
}

export function TextField({
  className = "",
  error,
  hint,
  id,
  label,
  ...props
}: TextFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const messageId = `${inputId}-message`;

  return (
    <div className="grid gap-2">
      <label className="text-sm font-bold text-text" htmlFor={inputId}>
        {label}
      </label>
      <input
        aria-describedby={hint || error ? messageId : undefined}
        aria-invalid={Boolean(error)}
        className={`min-h-[52px] w-full rounded-control border border-border bg-surface px-4 text-text placeholder:text-muted/80 hover:border-primary/40 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 ${error ? "border-danger" : ""} ${className}`}
        id={inputId}
        {...props}
      />
      {(hint || error) && (
        <span
          className={`text-sm ${error ? "font-semibold text-danger" : "text-muted"}`}
          id={messageId}
          role={error ? "alert" : undefined}
        >
          {error ?? hint}
        </span>
      )}
    </div>
  );
}
