"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { isStrongPassword, PASSWORD_RULE_TEXT } from "@/lib/password";

const defaultInputClass =
  "w-full rounded-md border border-zinc-200 bg-white px-3 py-2 pr-10 text-sm text-zinc-900 outline-none transition focus:border-brand-700 focus:ring-2 focus:ring-brand-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:ring-brand-950";

/** Its name must not contain the word for password: screen readers and tests find the field by that word. */
export function PasswordToggle({ visible, onToggle }: { visible: boolean; onToggle: () => void }) {
  const Icon = visible ? EyeOff : Eye;

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={visible ? "Yazılanı gizle" : "Yazılanı göster"}
      aria-pressed={visible}
      className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-zinc-500 transition hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

type PasswordFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
  placeholder?: string;
  required?: boolean;
  /** A password the system has just made up is meant to be read, so it starts out visible. */
  startVisible?: boolean;
  /** Shows the rule under the field, in red while what is typed breaks it. */
  showRule?: boolean;
  action?: { label: string; onClick: () => void };
};

export function PasswordField({
  label,
  value,
  onChange,
  autoComplete = "new-password",
  placeholder,
  required,
  startVisible = false,
  showRule = false,
  action
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(startVisible);
  const breaksRule = value.length > 0 && !isStrongPassword(value.trim());

  return (
    <div className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
      <label className="block">
        {label}
        <span className="relative mt-2 block">
          <input
            type={visible ? "text" : "password"}
            value={value}
            placeholder={placeholder}
            autoComplete={autoComplete}
            required={required}
            spellCheck={false}
            onChange={(event) => onChange(event.target.value)}
            className={defaultInputClass}
          />
          <PasswordToggle visible={visible} onToggle={() => setVisible((current) => !current)} />
        </span>
      </label>
      {showRule ? (
        <p className={`mt-1 text-xs font-normal ${breaksRule ? "text-red-700 dark:text-red-300" : "text-zinc-500 dark:text-zinc-400"}`}>
          {PASSWORD_RULE_TEXT}
        </p>
      ) : null}
      {action ? (
        <button
          type="button"
          onClick={() => {
            action.onClick();
            setVisible(true);
          }}
          className="mt-2 rounded-md border border-zinc-200 px-2 py-1 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          {action.label}
        </button>
      ) : null}
    </div>
  );
}
