import { forwardRef, type InputHTMLAttributes } from "react";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  error?: string;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, id, className = "", ...rest }, ref) => (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-foreground">
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={id}
        className={`rounded-lg border bg-surface px-3 py-2.5 text-sm text-foreground outline-none transition-colors duration-150 placeholder:text-muted focus:border-primary focus:ring-[3px] focus:ring-accent-subtle disabled:bg-surface-muted disabled:text-muted ${
          error ? "border-error" : "border-border"
        } ${className}`}
        {...rest}
      />
      {error && <p className="text-sm text-error">{error}</p>}
    </div>
  ),
);
Input.displayName = "Input";
