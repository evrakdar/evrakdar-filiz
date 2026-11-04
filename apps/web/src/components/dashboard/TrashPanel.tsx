"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FileText, FolderOpen, RefreshCw, RotateCcw, Trash2 } from "lucide-react";
import {
  getTrashItems,
  permanentlyDeleteTrashDocument,
  permanentlyDeleteTrashFolder,
  restoreTrashDocument,
  restoreTrashFolder,
  type TrashDocumentDto,
  type TrashFolderDto
} from "@/lib/api";

type TrashPanelProps = {
  token: string | null;
  canManage: boolean;
};

type TrashItem =
  | (TrashDocumentDto & { itemType: "document" })
  | (TrashFolderDto & { itemType: "folder" });

export function TrashPanel({ token, canManage }: TrashPanelProps) {
  const [items, setItems] = useState<TrashItem[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const selectAllCheckboxRef = useRef<HTMLInputElement | null>(null);

  const sortedItems = useMemo(
    () =>
      [...items].sort((first, second) => {
        const firstDeletedAt = first.deletedAt ? new Date(first.deletedAt).getTime() : 0;
        const secondDeletedAt = second.deletedAt ? new Date(second.deletedAt).getTime() : 0;
        return secondDeletedAt - firstDeletedAt;
      }),
    [items]
  );
  const selectedItems = useMemo(
    () => sortedItems.filter((item) => selectedKeys.has(getTrashItemKey(item))),
    [selectedKeys, sortedItems]
  );
  const allVisibleSelected = sortedItems.length > 0 && selectedItems.length === sortedItems.length;
  const partiallySelected = selectedItems.length > 0 && selectedItems.length < sortedItems.length;

  useEffect(() => {
    void loadTrash();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (selectAllCheckboxRef.current) {
      selectAllCheckboxRef.current.indeterminate = partiallySelected;
    }
  }, [partiallySelected]);

  useEffect(() => {
    const visibleKeys = new Set(sortedItems.map((item) => getTrashItemKey(item)));
    setSelectedKeys((current) => new Set([...current].filter((key) => visibleKeys.has(key))));
  }, [sortedItems]);

  async function loadTrash(successMessage?: string) {
    if (!token) {
      setItems([]);
      setStatus("error");
      setMessage("Geri dönüşüm kutusu için oturum bilgisi bulunamadı.");
      return;
    }

    setStatus("loading");
    setMessage(successMessage ?? null);

    try {
      const response = await getTrashItems(token);
      setItems([...response.data.folders, ...response.data.documents]);
      setSelectedKeys(new Set());
      setStatus("ready");
    } catch (error) {
      setItems([]);
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Geri dönüşüm kutusu yüklenemedi.");
    }
  }

  async function handleRestore(item: TrashItem) {
    if (!token || !canManage) {
      setMessage("Bu işlem için yetkiniz yok.");
      return;
    }

    setPendingId(item.id);
    setMessage(null);

    try {
      await restoreTrashItem(item, token);

      await loadTrash(`${item.name} geri yüklendi.`);
    } catch (error) {
      setMessage(getTrashErrorMessage(error));
    } finally {
      setPendingId(null);
    }
  }

  async function handlePermanentDelete(item: TrashItem) {
    if (!token || !canManage) {
      setMessage("Bu işlem için yetkiniz yok.");
      return;
    }

    if (!window.confirm(`${item.name} kalıcı olarak silinsin mi? Bu işlem geri alınamaz.`)) {
      return;
    }

    setPendingId(item.id);
    setMessage(null);

    try {
      await permanentlyDeleteTrashItem(item, token);

      await loadTrash(`${item.name} kalıcı olarak silindi.`);
    } catch (error) {
      setMessage(getTrashErrorMessage(error));
    } finally {
      setPendingId(null);
    }
  }

  async function handleBulkRestore() {
    if (!token || !canManage || selectedItems.length === 0) {
      setMessage("Bu işlem için yetkiniz yok.");
      return;
    }

    setPendingId("bulk");
    setMessage(null);

    try {
      for (const item of selectedItems) {
        await restoreTrashItem(item, token);
      }

      await loadTrash(`${selectedItems.length} kayıt geri yüklendi.`);
    } catch (error) {
      setMessage(getTrashErrorMessage(error));
    } finally {
      setPendingId(null);
    }
  }

  async function handleBulkPermanentDelete() {
    if (!token || !canManage || selectedItems.length === 0) {
      setMessage("Bu işlem için yetkiniz yok.");
      return;
    }

    if (!window.confirm(`${selectedItems.length} kayıt kalıcı olarak silinsin mi? Bu işlem geri alınamaz.`)) {
      return;
    }

    setPendingId("bulk");
    setMessage(null);

    try {
      for (const item of selectedItems) {
        await permanentlyDeleteTrashItem(item, token);
      }

      await loadTrash(`${selectedItems.length} kayıt kalıcı olarak silindi.`);
    } catch (error) {
      setMessage(getTrashErrorMessage(error));
    } finally {
      setPendingId(null);
    }
  }

  function toggleAllVisible() {
    setSelectedKeys(allVisibleSelected ? new Set() : new Set(sortedItems.map((item) => getTrashItemKey(item))));
  }

  function toggleSelection(item: TrashItem) {
    const itemKey = getTrashItemKey(item);

    setSelectedKeys((current) => {
      const next = new Set(current);

      if (next.has(itemKey)) {
        next.delete(itemKey);
      } else {
        next.add(itemKey);
      }

      return next;
    });
  }

  return (
    <section
      aria-label="Geri Dönüşüm Kutusu"
      className="rounded-md border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-zinc-200 p-5 dark:border-zinc-800">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-800 dark:text-brand-300">Geri Dönüşüm Kutusu</p>
          <h1 className="mt-2 text-xl font-semibold text-zinc-950 dark:text-zinc-50">Silinen dosya ve klasörler</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Soft delete ile kaldırılan kayıtları buradan görüntüleyebilir, yetkiniz varsa geri yükleyebilir veya kalıcı silebilirsiniz.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {selectedItems.length > 0 ? (
            <>
              <span className="rounded-md bg-zinc-100 px-3 py-2 text-sm font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                {selectedItems.length} kayıt seçildi
              </span>
              {canManage ? (
                <>
                  <button
                    type="button"
                    disabled={pendingId === "bulk"}
                    onClick={() => void handleBulkRestore()}
                    className="inline-flex items-center gap-2 rounded-md border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-wait disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Seçilenleri Geri Yükle
                  </button>
                  <button
                    type="button"
                    disabled={pendingId === "bulk"}
                    onClick={() => void handleBulkPermanentDelete()}
                    className="inline-flex items-center gap-2 rounded-md border border-red-200 px-3 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50 disabled:cursor-wait disabled:opacity-60 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/30"
                  >
                    <Trash2 className="h-4 w-4" />
                    Seçilenleri Kalıcı Sil
                  </button>
                </>
              ) : null}
            </>
          ) : null}
          <button
            type="button"
            onClick={() => void loadTrash()}
            className="inline-flex items-center gap-2 rounded-md border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            <RefreshCw className="h-4 w-4" />
            Yenile
          </button>
        </div>
      </div>

      {message ? (
        <p className="mx-5 mt-5 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200">
          {message}
        </p>
      ) : null}

      {status === "loading" ? (
        <div className="grid min-h-64 place-items-center px-6 py-12 text-sm text-zinc-500 dark:text-zinc-400">
          Silinen kayıtlar yükleniyor...
        </div>
      ) : status === "error" ? (
        <div className="grid min-h-64 place-items-center px-6 py-12 text-center">
          <div>
            <p className="text-sm font-semibold text-red-700 dark:text-red-300">Geri dönüşüm kutusu yüklenemedi.</p>
            <button
              type="button"
              onClick={() => void loadTrash()}
              className="mt-3 rounded-md bg-brand-800 px-3 py-2 text-sm font-medium text-white transition hover:bg-brand-900"
            >
              Tekrar dene
            </button>
          </div>
        </div>
      ) : sortedItems.length === 0 ? (
        <div className="grid min-h-64 place-items-center px-6 py-12 text-center">
          <div>
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-md bg-zinc-100 dark:bg-zinc-800">
              <Trash2 className="h-5 w-5 text-zinc-400" />
            </div>
            <h2 className="mt-4 text-sm font-semibold text-zinc-900 dark:text-zinc-50">Geri dönüşüm kutusu boş</h2>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">Silinen dosya veya klasör bulunmuyor.</p>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-[900px] w-full border-collapse text-sm">
            <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-950 dark:text-zinc-400">
              <tr>
                <th className="w-36 px-5 py-3">
                  <label className="flex items-center gap-2">
                    <input
                      ref={selectAllCheckboxRef}
                      checked={allVisibleSelected}
                      onChange={toggleAllVisible}
                      type="checkbox"
                      className="h-4 w-4 rounded border-zinc-300 text-brand-800 dark:text-brand-300"
                      aria-label="Tümünü seç"
                    />
                    <span>Tümünü Seç</span>
                  </label>
                </th>
                <th className="px-5 py-3">Ad</th>
                <th className="px-5 py-3">Tür</th>
                <th className="px-5 py-3">Konum</th>
                <th className="px-5 py-3">Silen</th>
                <th className="px-5 py-3">Silinme tarihi</th>
                <th className="px-5 py-3">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {sortedItems.map((item) => {
                const Icon = item.itemType === "folder" ? FolderOpen : FileText;
                const disabled = Boolean(pendingId) || !canManage;
                const itemKey = getTrashItemKey(item);

                return (
                  <tr key={itemKey} className="transition hover:bg-zinc-50 dark:hover:bg-zinc-950/70">
                    <td className="px-5 py-3">
                      <input
                        checked={selectedKeys.has(itemKey)}
                        onChange={() => toggleSelection(item)}
                        type="checkbox"
                        className="h-4 w-4 rounded border-zinc-300 text-brand-800 dark:text-brand-300"
                        aria-label={`${item.name} satırını seç`}
                      />
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <Icon className="h-4 w-4 shrink-0 text-zinc-400" />
                        <span className="font-medium text-zinc-900 dark:text-zinc-100">{item.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-zinc-600 dark:text-zinc-300">
                      {item.itemType === "folder" ? "Klasör" : "Doküman"}
                    </td>
                    <td className="px-5 py-3 text-zinc-600 dark:text-zinc-300">
                      {item.itemType === "folder" ? item.path : item.folder?.path ?? "-"}
                    </td>
                    <td className="px-5 py-3 text-zinc-600 dark:text-zinc-300">
                      {item.deletedBy ? `${item.deletedBy.firstName} ${item.deletedBy.lastName}` : "-"}
                    </td>
                    <td className="px-5 py-3 text-zinc-600 dark:text-zinc-300">{formatDate(item.deletedAt)}</td>
                    <td className="px-5 py-3">
                      {canManage ? (
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={disabled}
                            onClick={() => void handleRestore(item)}
                            className="inline-flex items-center gap-1 rounded-md border border-zinc-200 px-2 py-1 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-wait disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                            Geri Yükle
                          </button>
                          <button
                            type="button"
                            disabled={disabled}
                            onClick={() => void handlePermanentDelete(item)}
                            className="inline-flex items-center gap-1 rounded-md border border-red-200 px-2 py-1 text-xs font-medium text-red-700 transition hover:bg-red-50 disabled:cursor-wait disabled:opacity-60 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/30"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Kalıcı Sil
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-zinc-500 dark:text-zinc-400">Sadece görüntüleme</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

async function restoreTrashItem(item: TrashItem, token: string) {
  if (item.itemType === "folder") {
    await restoreTrashFolder(item.id, token);
    return;
  }

  await restoreTrashDocument(item.id, token);
}

async function permanentlyDeleteTrashItem(item: TrashItem, token: string) {
  if (item.itemType === "folder") {
    await permanentlyDeleteTrashFolder(item.id, token);
    return;
  }

  await permanentlyDeleteTrashDocument(item.id, token);
}

function getTrashItemKey(item: TrashItem) {
  return `${item.itemType}:${item.id}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function getTrashErrorMessage(error: unknown) {
  if (error instanceof Error) {
    const messages: Record<string, string> = {
      "Önce belgenin klasörünü geri alın.": "Önce dokümanın bulunduğu klasörü geri yükleyin.",
      "Önce üst klasörü geri alın.": "Önce üst klasörü geri yükleyin.",
      "Bu klasörde aynı adda bir belge var.": "Hedef klasörde aynı isimde doküman var.",
      "Bu konumda aynı adda bir klasör var.": "Hedef klasörde aynı isimde klasör var.",
      "Klasör boş olmadan kalıcı silinemez.": "Klasörü kalıcı silmeden önce içeriğini boşaltın."
    };

    return messages[error.message] ?? error.message;
  }

  return "İşlem tamamlanamadı.";
}
