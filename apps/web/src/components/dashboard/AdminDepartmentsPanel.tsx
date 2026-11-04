"use client";

import { useCallback, useEffect, useState } from "react";
import {
  createDepartment,
  deleteDepartment,
  getDepartments,
  renameDepartment,
  type DepartmentDto
} from "@/lib/api";

type AdminDepartmentsPanelProps = {
  token: string | null;
  onChanged?: (departments: DepartmentDto[]) => void;
};

const fieldClass =
  "w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-brand-700 focus:ring-2 focus:ring-brand-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:ring-brand-950";

export function AdminDepartmentsPanel({ token, onChanged }: AdminDepartmentsPanelProps) {
  const [departments, setDepartments] = useState<DepartmentDto[]>([]);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const load = useCallback(async () => {
    const response = await getDepartments();

    setDepartments(response.data);
    onChanged?.(response.data);
  }, [onChanged]);

  useEffect(() => {
    load().catch((loadError: unknown) => {
      setError(loadError instanceof Error ? loadError.message : "Birimler yüklenemedi.");
    });
  }, [load]);

  async function run(action: () => Promise<unknown>, successMessage: string) {
    if (!token) {
      setError("Oturum bulunamadı. Lütfen yeniden giriş yapın.");
      return;
    }

    setIsBusy(true);
    setMessage(null);
    setError(null);

    try {
      await action();
      await load();
      setMessage(successMessage);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "İşlem tamamlanamadı.");
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <section className="space-y-5" aria-label="Birimler">
      <div>
        <p className="text-sm font-medium text-brand-800 dark:text-brand-300">Yönetim</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">Birimler</h1>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          Kurumunuzun birimlerini buradan yönetin. Gizli belgeleri yalnız sorumlu birimdeki kişiler görür.
        </p>
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void run(async () => {
            await createDepartment(newName, token ?? "");
            setNewName("");
          }, "Birim eklendi.");
        }}
        className="flex flex-col gap-3 rounded-md border border-zinc-200 bg-white p-4 sm:flex-row sm:items-end dark:border-zinc-800 dark:bg-zinc-900"
      >
        <label className="flex-1 text-sm font-medium text-zinc-700 dark:text-zinc-200">
          Yeni birim adı
          <input required value={newName} onChange={(event) => setNewName(event.target.value)} className={`mt-2 ${fieldClass}`} />
        </label>
        <button
          type="submit"
          disabled={isBusy}
          className="rounded-md bg-brand-800 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-900 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Birim ekle
        </button>
      </form>

      {message ? (
        <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800 dark:border-green-900 dark:bg-green-950 dark:text-green-200">
          {message}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          {error}
        </div>
      ) : null}

      <ul className="divide-y divide-zinc-200 overflow-hidden rounded-md border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
        {departments.map((department) => (
          <li key={department.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            {editingId === department.id ? (
              <input
                aria-label={`${department.name} yeni adı`}
                value={editingName}
                onChange={(event) => setEditingName(event.target.value)}
                className={`max-w-sm ${fieldClass}`}
              />
            ) : (
              <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{department.name}</span>
            )}
            <div className="flex gap-2">
              {editingId === department.id ? (
                <>
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() =>
                      void run(async () => {
                        await renameDepartment(department.id, editingName, token ?? "");
                        setEditingId(null);
                      }, "Birim adı güncellendi.")
                    }
                    className="rounded-md bg-brand-800 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-brand-900 disabled:opacity-60"
                  >
                    Kaydet
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingId(null)}
                    className="rounded-md border border-zinc-200 px-3 py-1.5 text-sm text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                  >
                    Vazgeç
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(department.id);
                      setEditingName(department.name);
                    }}
                    className="rounded-md border border-zinc-200 px-3 py-1.5 text-sm text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                  >
                    Adını değiştir
                  </button>
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => void run(() => deleteDepartment(department.id, token ?? ""), "Birim silindi.")}
                    className="rounded-md border border-red-200 px-3 py-1.5 text-sm text-red-700 transition hover:bg-red-50 disabled:opacity-60 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/40"
                  >
                    Sil
                  </button>
                </>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
