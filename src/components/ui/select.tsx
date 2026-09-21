import { forwardRef, type SelectHTMLAttributes } from "react";

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string;
  error?: string;
};

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, id, className = "", children, ...rest }, ref) => (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={id} className="text-sm font-medium">
          {label}
        </label>
      )}
      <select
        ref={ref}
        id={id}
        className={`rounded border px-2 py-1.5 text-sm outline-none focus:border-gray-500 disabled:bg-surface-muted disabled:text-muted ${
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
