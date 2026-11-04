"use client";

import { useState } from "react";
import { changePassword, type AuthUserDto } from "@/lib/api";
import { getStoredToken, setStoredAuth } from "@/lib/api/auth-storage";
import { isStrongPassword, PASSWORD_RULE_TEXT } from "@/lib/password";
import { PasswordField } from "./PasswordField";

type ChangePasswordDialogProps = {
  /** Required means there is no way to skip it, only to sign out. */
  required?: boolean;
  onClose?: () => void;
  onChanged: (user: AuthUserDto) => void;
  onLogout?: () => void;
};

export function ChangePasswordDialog({ required = false, onClose, onChanged, onLogout }: ChangePasswordDialogProps) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!isStrongPassword(newPassword.trim())) {
      setError(`Yeni şifre kurala uymuyor. ${PASSWORD_RULE_TEXT}`);
      return;
    }

    if (newPassword !== repeatPassword) {
      setError("Yeni şifreler birbiriyle aynı değil.");
      return;
    }

    const token = getStoredToken();

    if (!token) {
      setError("Oturum bulunamadı. Lütfen yeniden giriş yapın.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await changePassword(currentPassword, newPassword.trim(), token);

      setStoredAuth({ accessToken: token, user: response.data });
      onChanged(response.data);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Şifre değiştirilemedi.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-zinc-950/60 p-4">
      <form
        onSubmit={handleSubmit}
        aria-label="Şifre değiştirme"
        className="w-full max-w-md space-y-4 rounded-md border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-900"
      >
        <div>
          <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">Şifremi değiştir</h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {required
              ? "Devam etmeden önce kendinize ait bir şifre belirleyin."
              : "Yeni şifrenizi aşağıdaki kurala göre belirleyin."}
          </p>
        </div>

        <PasswordField label="Mevcut şifre" autoComplete="current-password" required value={currentPassword} onChange={setCurrentPassword} />
        <PasswordField label="Yeni şifre" required showRule value={newPassword} onChange={setNewPassword} />
        <PasswordField label="Yeni şifre (tekrar)" required value={repeatPassword} onChange={setRepeatPassword} />

        {error ? (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
            {error}
          </p>
        ) : null}

        <div className="flex justify-end gap-2">
          {required && onLogout ? (
            <button
              type="button"
              onClick={onLogout}
              className="rounded-md border border-zinc-200 px-4 py-2 text-sm text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              Çıkış yap
            </button>
          ) : null}
          {!required && onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-zinc-200 px-4 py-2 text-sm text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              Vazgeç
            </button>
          ) : null}
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-md bg-brand-800 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-900 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Kaydediliyor..." : "Şifreyi kaydet"}
          </button>
        </div>
      </form>
    </div>
  );
}
