import { forwardRef, type InputHTMLAttributes } from "react";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  error?: string;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, id, className = "", ...rest }, ref) => (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={id} className="text-sm font-medium">
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={id}
        className={`rounded border px-3 py-2 text-sm outline-none focus:border-gray-500 disabled:bg-surface-muted disabled:text-muted ${
          error ? "border-error" : "border-border"
        } ${className}`}
        {...rest}
      />
      {error && <p className="text-sm text-error">{error}</p>}
    </div>
  ),
);
Input.displayName = "Input";
