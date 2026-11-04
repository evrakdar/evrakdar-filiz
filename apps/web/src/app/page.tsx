"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LockKeyhole, UserRound } from "lucide-react";
import { PasswordToggle } from "@/components/dashboard/PasswordField";
import { ApiClientError, getMe, login } from "@/lib/api";
import { APP_NAME, ORG_NAME } from "@/lib/brand";
import { ProductCredit } from "@/lib/product-credit";
import { ProductMark } from "@/lib/product-mark";
import {
  clearStoredAuth,
  getStoredToken,
  setStoredAuth
} from "@/lib/api/auth-storage";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);

  useEffect(() => {
    const token = getStoredToken();

    if (!token) {
      setIsCheckingSession(false);
      return;
    }

    getMe(token)
      .then((response) => {
        setStoredAuth({
          accessToken: token,
          user: response.data
        });
        router.replace("/dashboard");
      })
      .catch(() => {
        clearStoredAuth();
        setIsCheckingSession(false);
      });
  }, [router]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const response = await login(username, password);

      setStoredAuth(response.data);
      router.push("/dashboard");
    } catch (error) {
      setErrorMessage(getLoginErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isCheckingSession) {
    return (
      <main className="grid min-h-screen place-items-center bg-zinc-100 text-sm text-zinc-500 dark:bg-zinc-950 dark:text-zinc-400">
        Oturum kontrol ediliyor...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-100 dark:bg-zinc-950">
      <div className="grid min-h-screen lg:grid-cols-[1fr_520px]">
        <section className="hidden flex-col justify-between bg-brand2-950 p-12 text-white lg:flex">
          <div>
            <div className="grid h-12 w-12 place-items-center rounded-md bg-brand-800 text-lg font-bold"><ProductMark /></div>
            <p className="mt-8 text-sm font-semibold uppercase tracking-[0.24em] text-brand-200">{APP_NAME}</p>
            <h1 className="mt-4 max-w-2xl text-4xl font-semibold leading-tight">
              Kurumsal dokümanlar için sade ve güvenli yönetim merkezi.
            </h1>
            <p className="mt-5 max-w-xl text-sm leading-6 text-zinc-300">
              Klasörler, belge bilgileri, geçerlilik tarihleri ve gizli belge desteği tek yerde.
            </p>
          </div>
          <p className="text-xs text-zinc-500">{ORG_NAME}</p>
        </section>

        <section className="flex items-center justify-center p-6">
          <div className="w-full max-w-md">
            <div className="mb-8 lg:hidden">
              <div className="grid h-12 w-12 place-items-center rounded-md bg-brand-800 text-lg font-bold text-white">
                <ProductMark />
              </div>
            </div>

            <div className="rounded-md border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand-800 dark:text-brand-300">{APP_NAME}</p>
                <h2 className="mt-3 text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">Sisteme giriş</h2>
                <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                  Kullanıcı adı ve şifrenizle giriş yapın.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="mt-8 space-y-5">
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-200">
                  Kullanıcı adı
                  <span className="relative mt-2 block">
                    <UserRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                    <input
                      type="text"
                      value={username}
                      onChange={(event) => setUsername(event.target.value)}
                      autoComplete="username"
                      className="h-11 w-full rounded-md border border-zinc-200 bg-zinc-50 pl-10 pr-3 text-sm outline-none transition focus:border-brand-800 focus:bg-white dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:bg-zinc-950"
                    />
                  </span>
                </label>

                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-200">
                  Şifre
                  <span className="relative mt-2 block">
                    <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                    <input
                      type={passwordVisible ? "text" : "password"}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      autoComplete="current-password"
                      className="h-11 w-full rounded-md border border-zinc-200 bg-zinc-50 pl-10 pr-10 text-sm outline-none transition focus:border-brand-800 focus:bg-white dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:bg-zinc-950"
                    />
                    <PasswordToggle visible={passwordVisible} onToggle={() => setPasswordVisible((current) => !current)} />
                  </span>
                </label>

                {errorMessage ? (
                  <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                    {errorMessage}
                  </p>
                ) : null}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="h-11 w-full rounded-md bg-brand-800 text-sm font-semibold text-white transition hover:bg-brand-900 disabled:cursor-not-allowed disabled:bg-zinc-400"
                >
                  {isSubmitting ? "Giriş yapılıyor..." : "Giriş yap"}
                </button>
              </form>
            </div>
            <ProductCredit className="mt-4 text-center text-xs text-zinc-500 dark:text-zinc-400" />
          </div>
        </section>
      </div>
    </main>
  );
}

function getLoginErrorMessage(error: unknown) {
  if (error instanceof ApiClientError) {
    if (error.status === 401) {
      return "Kullanıcı adı veya şifre hatalı.";
    }

    if (error.status === 429) {
      return error.message;
    }

    return error.message;
  }

  if (error instanceof TypeError) {
    return "Sisteme ulaşılamadı. Lütfen biraz sonra yeniden deneyin.";
  }

  return "Giriş yapılırken beklenmeyen bir hata oluştu.";
}
