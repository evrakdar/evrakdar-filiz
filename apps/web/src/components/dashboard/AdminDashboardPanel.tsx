"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiClientError, getAdminDashboardSummary, type AdminDashboardSummaryDto } from "@/lib/api";

type AdminDashboardPanelProps = {
  token: string | null;
};

/** Cards shown before the rest are added up as one. */
const VISIBLE_CATEGORIES = 8;

export function AdminDashboardPanel({ token }: AdminDashboardPanelProps) {
  const [summary, setSummary] = useState<AdminDashboardSummaryDto | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  const loadSummary = useCallback(async () => {
    if (!token) {
      setSummary(null);
      setStatus("error");
      setError("Yönetici paneli verilerini görmek için oturum doğrulaması gerekir.");
      return;
    }

    setStatus("loading");
    setError(null);

    try {
      const response = await getAdminDashboardSummary(token);
      setSummary(response.data);
      setStatus("ready");
    } catch (loadError) {
      setSummary(null);
      setStatus("error");
      setError(getAdminDashboardErrorMessage(loadError));
    }
  }, [token]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  const allCategories = summary?.categoryDocumentCounts ?? [];
  const otherCategories = allCategories.slice(VISIBLE_CATEGORIES);
  const categories =
    otherCategories.length > 0
      ? [
          ...allCategories.slice(0, VISIBLE_CATEGORIES),
          {
            key: "diger",
            name: `Diğer (${otherCategories.length} klasör)`,
            documentCount: otherCategories.reduce((total, category) => total + category.documentCount, 0)
          }
        ]
      : allCategories;
  const roleCounts = summary?.userRoleCounts ?? {
    admin: 0,
    editor: 0,
    user: 0,
    total: 0
  };
  const fileTypeStats = summary?.fileTypeStats ?? [];

  return (
    <section className="space-y-6" aria-label="Yönetici Paneli">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-medium text-brand-800 dark:text-brand-300">Yönetim</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
            Yönetici Paneli
          </h1>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            Kategori, kullanıcı rolü ve dosya türü istatistikleri.
          </p>
        </div>
        <button
          onClick={loadSummary}
          className="w-fit rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          Tekrar dene
        </button>
      </div>

      {status === "loading" ? (
        <PanelMessage title="İstatistikler yükleniyor" description="Yönetici paneli verileri hazırlanıyor." />
      ) : null}

      {status === "error" ? (
        <PanelMessage
          title="Yönetici paneli yüklenemedi"
          description={error ?? "Sunucudan yanıt alınamadı."}
          actionLabel="Tekrar dene"
          onAction={loadSummary}
        />
      ) : null}

      {status === "ready" ? (
        <>
          <div>
            <h2 className="text-base font-semibold text-zinc-950 dark:text-zinc-50">Kategori doküman sayıları</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {categories.map((category) => (
                <StatCard
                  key={category.key}
                  label={category.name}
                  value={category.documentCount.toLocaleString("tr-TR")}
                  description="Toplam doküman"
                />
              ))}
            </div>
          </div>

          <div>
            <h2 className="text-base font-semibold text-zinc-950 dark:text-zinc-50">Kullanıcı rol istatistikleri</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard label="Yönetici" value={roleCounts.admin.toLocaleString("tr-TR")} description="Her işi yapabilir" />
              <StatCard label="Düzenleyici" value={roleCounts.editor.toLocaleString("tr-TR")} description="Veri girişi yapabilir" />
              <StatCard label="Kullanıcı" value={roleCounts.user.toLocaleString("tr-TR")} description="Belgeleri görür ve indirir" />
              <StatCard label="Toplam kullanıcı" value={roleCounts.total.toLocaleString("tr-TR")} description="Benzersiz kullanıcı" />
            </div>
          </div>

          <div>
            <h2 className="text-base font-semibold text-zinc-950 dark:text-zinc-50">Dosya türü istatistikleri</h2>
            <div className="mt-3 overflow-hidden rounded-md border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
              {fileTypeStats.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
                    <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-950 dark:text-zinc-400">
                      <tr>
                        <th className="px-4 py-3 font-semibold">Dosya türü</th>
                        <th className="px-4 py-3 font-semibold">Dosya sayısı</th>
                        <th className="px-4 py-3 font-semibold">Toplam boyut</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                      {fileTypeStats.map((stat) => (
                        <tr key={stat.fileType}>
                          <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-100">{stat.fileType}</td>
                          <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">
                            {stat.documentCount.toLocaleString("tr-TR")}
                          </td>
                          <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">
                            {formatBytes(stat.totalSizeBytes)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
                      <tr>
                        <td className="px-4 py-3 font-semibold">Toplam</td>
                        <td className="px-4 py-3 font-semibold">
                          {fileTypeStats.reduce((sum, stat) => sum + stat.documentCount, 0).toLocaleString("tr-TR")}
                        </td>
                        <td className="px-4 py-3 font-semibold">
                          {formatBytes(fileTypeStats.reduce((sum, stat) => sum + stat.totalSizeBytes, 0))}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              ) : (
                <PanelMessage title="Dosya türü verisi yok" description="Henüz istatistik üretilecek doküman bulunmuyor." />
              )}
            </div>
            <p className="mt-3 text-sm text-zinc-700 dark:text-zinc-200">
              Sistemde kapladığı toplam alan: <span className="font-semibold">{formatBytes(summary?.totalStorageBytes ?? 0)}</span>
              <span className="text-zinc-500 dark:text-zinc-400"> (eski sürümler ve geri dönüşüm kutusu dahil)</span>
            </p>
          </div>
        </>
      ) : null}
    </section>
  );
}

function StatCard({ label, value, description }: { label: string; value: string; description: string }) {
  return (
    <div className="rounded-md border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">{label}</p>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">{value}</p>
      <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">{description}</p>
    </div>
  );
}

function PanelMessage({
  title,
  description,
  actionLabel,
  onAction
}: {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="rounded-md border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{title}</h2>
      <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">{description}</p>
      {actionLabel && onAction ? (
        <button
          onClick={onAction}
          className="mt-4 rounded-md bg-brand-800 px-3 py-2 text-sm font-medium text-white transition hover:bg-brand-900"
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}

function getAdminDashboardErrorMessage(error: unknown) {
  if (error instanceof ApiClientError) {
    if (error.status === 401) {
      return "Oturum doğrulanamadı. Lütfen tekrar giriş yapın.";
    }

    if (error.status === 403) {
      return "Bu ekran için yetkiniz yok.";
    }

    return error.message;
  }

  return "Yönetici paneli verileri alınamadı.";
}

function formatBytes(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB"];
  let size = value;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return `${size.toLocaleString("tr-TR", {
    maximumFractionDigits: unitIndex === 0 ? 0 : 2
  })} ${units[unitIndex]}`;
}
