import { forwardRef, type SelectHTMLAttributes } from "react";

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string;
  error?: string;
};

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, id, className = "", children, ...rest }, ref) => (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-foreground">
          {label}
        </label>
      )}
      <select
        ref={ref}
        id={id}
        className={`rounded-lg border bg-surface px-2.5 py-2 text-sm text-foreground outline-none transition-colors duration-150 focus:border-primary focus:ring-[3px] focus:ring-accent-subtle disabled:bg-surface-muted disabled:text-muted ${
          error ? "border-error" : "border-border"
        } ${className}`}
        {...rest}
      >
        {children}
      </select>
      {error && <p className="text-sm text-error">{error}</p>}
    </div>
  ),
);
Select.displayName = "Select";
