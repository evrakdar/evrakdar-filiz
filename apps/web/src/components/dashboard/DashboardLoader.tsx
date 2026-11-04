"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiClientError } from "@/lib/api";
import { clearStoredAuth, getStoredToken } from "@/lib/api/auth-storage";
import { loadDashboardData, type DashboardData } from "@/lib/data-source";
import { ChangePasswordDialog } from "./ChangePasswordDialog";
import { DashboardShell } from "./DashboardShell";

export function DashboardLoader() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [passwordRequired, setPasswordRequired] = useState(false);

  useEffect(() => {
    let isActive = true;

    if (!getStoredToken()) {
      clearStoredAuth();
      router.replace("/");
      return;
    }

    setErrorMessage(null);

    loadDashboardData()
      .then((result) => {
        if (isActive) {
          setData(result);
        }
      })
      .catch((error: unknown) => {
        if (!isActive) {
          return;
        }

        if (error instanceof ApiClientError && error.status === 401) {
          clearStoredAuth();
          router.replace("/");
          return;
        }

        if (error instanceof ApiClientError && (error.payload as { code?: string } | null)?.code === "PASSWORD_CHANGE_REQUIRED") {
          setPasswordRequired(true);
          return;
        }

        setErrorMessage(
          error instanceof TypeError
            ? "Sisteme ulaşılamadı. Lütfen biraz sonra yeniden deneyin."
            : "Doküman verileri yüklenemedi."
        );
      });

    return () => {
      isActive = false;
    };
  }, [router, attempt]);

  if (passwordRequired) {
    return (
      <main className="min-h-screen bg-zinc-100 dark:bg-zinc-950">
        <ChangePasswordDialog
          required
          onChanged={() => {
            setPasswordRequired(false);
            setAttempt((value) => value + 1);
          }}
          onLogout={() => {
            clearStoredAuth();
            router.replace("/");
          }}
        />
      </main>
    );
  }

  if (errorMessage) {
    return (
      <main className="grid min-h-screen place-items-center bg-zinc-100 p-6 dark:bg-zinc-950">
        <div className="max-w-md rounded-md border border-zinc-200 bg-white p-6 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-sm text-zinc-700 dark:text-zinc-200">{errorMessage}</p>
          <button
            type="button"
            onClick={() => setAttempt((value) => value + 1)}
            className="mt-4 h-10 rounded-md bg-brand-800 px-4 text-sm font-semibold text-white transition hover:bg-brand-900"
          >
            Tekrar dene
          </button>
        </div>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="grid min-h-screen place-items-center bg-zinc-100 text-sm text-zinc-500 dark:bg-zinc-950 dark:text-zinc-400">
        Yükleniyor...
      </main>
    );
  }

  return <DashboardShell initialData={data} />;
}
