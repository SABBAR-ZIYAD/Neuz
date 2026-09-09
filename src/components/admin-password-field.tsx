"use client";
import { useId, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
export function AdminPasswordField({
  label,
  name,
  autoComplete,
  minLength,
  disabled,
}: {
  label: string;
  name: string;
  autoComplete: string;
  minLength?: number;
  disabled?: boolean;
}) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  return (
    <div className="admin-wide admin-password-field">
      <label htmlFor={id}>{label}</label>
      <div className="admin-password-control">
        <input
          id={id}
          name={name}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          required
          minLength={minLength}
          maxLength={256}
          disabled={disabled}
        />
        <button
          type="button"
          className="admin-password-toggle"
          aria-label={(visible ? "Masquer : " : "Afficher : ") + label}
          aria-controls={id}
          onClick={() => setVisible(!visible)}
          disabled={disabled}
        >
          {visible ? (
            <EyeOff size={19} aria-hidden="true" />
          ) : (
            <Eye size={19} aria-hidden="true" />
          )}
        </button>
      </div>
    </div>
  );
}
