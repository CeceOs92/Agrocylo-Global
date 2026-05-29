import * as React from "react";
import { cn } from "@/lib/utils";
import { Label } from "./label";

interface ExtraProps {
  /** Optional label rendered above the input. */
  label?: React.ReactNode;
  /** Optional helper text below the input. */
  hint?: React.ReactNode;
  /** Optional error message; styles the input red and replaces hint. */
  error?: React.ReactNode;
}

function Input({
  className,
  type,
  label,
  hint,
  error,
  id,
  ...props
}: React.ComponentProps<"input"> & ExtraProps) {
  const generatedId = React.useId();
  const inputId = id ?? generatedId;

  const inputEl = (
    <input
      id={inputId}
      type={type}
      data-slot="input"
      aria-invalid={!!error || undefined}
      className={cn(
        "file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground border-input flex h-12 w-full rounded-md border bg-transparent px-4 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:opacity-50 md:text-sm",
        "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
        "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
        className,
      )}
      {...props}
    />
  );

  // Plain input — when no label/hint/error props supplied
  if (label == null && hint == null && error == null) {
    return inputEl;
  }

  return (
    <div className="grid w-full gap-1.5">
      {label != null && <Label htmlFor={inputId}>{label}</Label>}
      {inputEl}
      {error != null ? (
        <p className="text-destructive text-xs">{error}</p>
      ) : hint != null ? (
        <p className="text-muted-foreground text-xs">{hint}</p>
      ) : null}
    </div>
  );
}

export { Input };
