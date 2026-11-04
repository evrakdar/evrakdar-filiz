"use client";

import { getDocumentTypeLabel } from "@/lib/document-labels";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { FileText, FolderOpen, MoreHorizontal, Star } from "lucide-react";
import type { DocumentItem } from "@/lib/mock-data";

type DocumentTableProps = {
  documents: DocumentItem[];
  selectedDocumentId?: string;
  onSelectDocument: (document: DocumentItem) => void;
  favoriteIds?: Set<string>;
  pendingFavoriteIds?: Set<string>;
  onToggleFavorite?: (document: DocumentItem) => void;
  canManage?: boolean;
  onManageItem?: (document: DocumentItem, action: RowManagementAction) => void;
  onBulkDeleteItems?: (documents: DocumentItem[]) => Promise<void>;
};

export type RowManagementAction =
  | "document-rename"
  | "document-move"
  | "document-delete"
  | "folder-create-child"
  | "folder-rename"
  | "folder-move"
  | "folder-delete";

type SortField = "name" | "size" | "date" | "documentType" | "owner" | "validityDate";
type SortDirection = "asc" | "desc";

const sortableColumns: Array<{ field: SortField; label: string }> = [
  { field: "name", label: "Dosya adı" },
  { field: "size", label: "Boyutu" },
  { field: "date", label: "Tarih" },
  { field: "documentType", label: "Doküman türü" },
  { field: "owner", label: "Sorumlu birim ve kişi" },
  { field: "validityDate", label: "Geçerlilik / güncelleme" }
];

export function DocumentTable({
  documents,
  selectedDocumentId,
  onSelectDocument,
  favoriteIds,
  pendingFavoriteIds,
  onToggleFavorite,
  canManage = false,
  onManageItem,
  onBulkDeleteItems
}: DocumentTableProps) {
  const [localFavoriteIds, setLocalFavoriteIds] = useState(() =>
    new Set(documents.filter((document) => document.isFavorite).map((document) => document.id))
  );
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [bulkStatus, setBulkStatus] = useState<"idle" | "pending">("idle");
  const [bulkMessage, setBulkMessage] = useState<string | null>(null);
  const selectAllCheckboxRef = useRef<HTMLInputElement | null>(null);
  const activeFavoriteIds = favoriteIds ?? localFavoriteIds;

  const sortedDocuments = useMemo(
    () =>
      [...documents].sort((first, second) => {
        const firstGroup = first.itemType === "folder" ? 0 : 1;
        const secondGroup = second.itemType === "folder" ? 0 : 1;

        if (firstGroup !== secondGroup) {
          return firstGroup - secondGroup;
        }

        const result = compareDocuments(first, second, sortField);
        return sortDirection === "asc" ? result : -result;
      }),
    [documents, sortDirection, sortField]
  );

  useEffect(() => {
    if (!favoriteIds) {
      setLocalFavoriteIds(new Set(documents.filter((document) => document.isFavorite).map((document) => document.id)));
    }
  }, [documents, favoriteIds]);

  useEffect(() => {
    const visibleIds = new Set(sortedDocuments.map((document) => document.id));
    setSelectedIds((current) => new Set([...current].filter((id) => visibleIds.has(id))));
  }, [sortedDocuments]);

  const selectedDocuments = useMemo(
    () => sortedDocuments.filter((document) => selectedIds.has(document.id)),
    [selectedIds, sortedDocuments]
  );
  const allVisibleSelected = sortedDocuments.length > 0 && selectedIds.size === sortedDocuments.length;
  const partiallySelected = selectedIds.size > 0 && selectedIds.size < sortedDocuments.length;

  useEffect(() => {
    if (selectAllCheckboxRef.current) {
      selectAllCheckboxRef.current.indeterminate = partiallySelected;
    }
  }, [partiallySelected]);

  function toggleSort(field: SortField) {
    if (field === sortField) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortField(field);
    setSortDirection("asc");
  }

  function toggleFavorite(document: DocumentItem) {
    if (onToggleFavorite) {
      onToggleFavorite(document);
      return;
    }

    setLocalFavoriteIds((current) => {
      const next = new Set(current);

      if (next.has(document.id)) {
        next.delete(document.id);
      } else {
        next.add(document.id);
      }

      return next;
    });
  }

  function toggleSelection(documentId: string) {
    setSelectedIds((current) => {
      const next = new Set(current);

      if (next.has(documentId)) {
        next.delete(documentId);
      } else {
        next.add(documentId);
      }

      return next;
    });
  }

  function toggleAllVisible() {
    setSelectedIds(allVisibleSelected ? new Set() : new Set(sortedDocuments.map((document) => document.id)));
  }

  async function handleBulkDelete() {
    if (!onBulkDeleteItems || selectedDocuments.length === 0 || bulkStatus === "pending") {
      return;
    }

    if (!window.confirm(`${selectedDocuments.length} kayıt silinsin mi?`)) {
      return;
    }

    setBulkStatus("pending");
    setBulkMessage(null);

    try {
      await onBulkDeleteItems(selectedDocuments);
      setSelectedIds(new Set());
      setBulkMessage(`${selectedDocuments.length} kayıt silindi.`);
    } catch (error) {
      setBulkMessage(error instanceof Error ? error.message : "Toplu işlem tamamlanamadı.");
    } finally {
      setBulkStatus("idle");
    }
  }

  return (
    <section className="overflow-hidden rounded-md border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <div>
          <h3 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">Klasör ve dosyalar</h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {documents.length} kayıt listeleniyor
            {selectedIds.size > 0 ? `, ${selectedIds.size} seçili` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {selectedDocuments.length > 0 ? (
            <>
              <span className="rounded-md bg-zinc-100 px-3 py-2 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                {selectedDocuments.length} kayıt seçildi
              </span>
              {canManage && onBulkDeleteItems ? (
                <button
                  type="button"
                  disabled={bulkStatus === "pending"}
                  onClick={() => void handleBulkDelete()}
                  className="rounded-md border border-red-200 px-3 py-2 text-xs font-medium text-red-700 transition hover:bg-red-50 disabled:cursor-wait disabled:opacity-60 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/30"
                >
                  Seçilenleri Sil
                </button>
              ) : null}
            </>
          ) : null}
          <button className="rounded-md border border-zinc-200 px-3 py-2 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800">
            Sayfa başına 100 tane
          </button>
        </div>
      </div>

      {bulkMessage ? (
        <p className="mx-4 mt-3 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200">
          {bulkMessage}
        </p>
      ) : null}

      {documents.length === 0 ? (
        <div className="grid min-h-64 place-items-center px-6 py-12 text-center">
          <div>
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-md bg-zinc-100 dark:bg-zinc-800">
              <FileText className="h-5 w-5 text-zinc-400" />
            </div>
            <h3 className="mt-4 text-sm font-semibold text-zinc-900 dark:text-zinc-50">Bu kategoride dosya yok</h3>
            <p className="mt-2 max-w-sm text-sm text-zinc-500 dark:text-zinc-400">
              Seçilen kategori veya filtrelere uygun klasör/dosya bulunamadı.
            </p>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-[980px] w-full border-collapse text-sm">
            <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-950 dark:text-zinc-400">
              <tr>
                <th className="w-36 px-4 py-3">
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
                {sortableColumns.map((column) => (
                  <th key={column.field} className="px-4 py-3">
                    <button
                      onClick={() => toggleSort(column.field)}
                      className="flex items-center gap-1 font-semibold transition hover:text-brand-800"
                    >
                      {column.label}
                      {sortField === column.field ? (
                        <span aria-hidden="true">{sortDirection === "asc" ? "↑" : "↓"}</span>
                      ) : null}
                    </button>
                  </th>
                ))}
                {canManage ? <th className="w-24 px-4 py-3">İşlem</th> : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {sortedDocuments.map((document) => {
                const isSelected = document.id === selectedDocumentId;
                const isFavorite = activeFavoriteIds.has(document.id);
                const isFavoritePending = pendingFavoriteIds?.has(document.id) ?? false;
                const isChecked = selectedIds.has(document.id);
                const RowIcon = document.itemType === "folder" ? FolderOpen : FileText;

                return (
                  <tr
                    key={document.id}
                    onClick={() => onSelectDocument(document)}
                    className={`cursor-pointer transition hover:bg-brand-50/50 dark:hover:bg-brand-950/20 ${
                      isSelected ? "bg-brand-50 dark:bg-brand-950/30" : "bg-white dark:bg-zinc-900"
                    }`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={(event) => {
                            event.stopPropagation();
                            toggleFavorite(document);
                          }}
                          disabled={isFavoritePending}
                          className="text-zinc-400 transition hover:text-brand-800 disabled:cursor-wait disabled:opacity-60"
                          aria-label={isFavorite ? "Favoriden çıkar" : "Favoriye ekle"}
                          aria-pressed={isFavorite}
                        >
                          <Star
                            className={`h-4 w-4 ${isFavorite ? "fill-brand-800 text-brand-800 dark:text-brand-300" : ""}`}
                          />
                        </button>
                        <input
                          checked={isChecked}
                          onChange={() => toggleSelection(document.id)}
                          onClick={(event) => event.stopPropagation()}
                          type="checkbox"
                          className="h-4 w-4 rounded border-zinc-300 text-brand-800 dark:text-brand-300"
                          aria-label={document.itemType === "folder" ? "Klasör satırını seç" : "Doküman satırını seç"}
                        />
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <RowIcon className="h-4 w-4 shrink-0 text-zinc-400" />
                        <span className="font-medium text-zinc-900 dark:text-zinc-100">{document.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">{document.size}</td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">{document.date}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                        {getDocumentTypeLabel(document.documentType)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">
                      <span className="block font-medium text-zinc-800 dark:text-zinc-100">{document.department}</span>
                      <span className="text-xs text-zinc-500 dark:text-zinc-400">{document.responsiblePerson}</span>
                    </td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">
                      {document.validityDate}
                      {document.itemType === "document" && isPastValidityDate(document.validityDate) ? (
                        <span className="ml-2 inline-block rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-950 dark:text-red-300">
                          Süresi geçti
                        </span>
                      ) : null}
                    </td>
                    {canManage ? (
                      <td className="px-4 py-3">
                        <RowActionsMenu document={document} onManageItem={onManageItem} />
                      </td>
                    ) : null}
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

function RowActionsMenu({
  document,
  onManageItem
}: {
  document: DocumentItem;
  onManageItem?: (document: DocumentItem, action: RowManagementAction) => void;
}) {
  return (
    <details className="relative inline-block" onClick={(event) => event.stopPropagation()}>
      <summary
        className="grid h-8 w-8 cursor-pointer list-none place-items-center rounded-md border border-zinc-200 text-zinc-500 transition hover:bg-zinc-50 hover:text-brand-800 [&::-webkit-details-marker]:hidden dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        aria-label={`Satır işlemleri: ${document.name}`}
      >
        <MoreHorizontal className="h-4 w-4" />
      </summary>
      <div className="absolute right-0 z-20 mt-2 w-48 rounded-md border border-zinc-200 bg-white p-1 text-sm shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
        {document.itemType === "folder" ? (
          <>
            <MenuButton onClick={() => onManageItem?.(document, "folder-create-child")}>Yeni Alt Klasör</MenuButton>
            <MenuButton onClick={() => onManageItem?.(document, "folder-rename")}>Yeniden Adlandır</MenuButton>
            <MenuButton onClick={() => onManageItem?.(document, "folder-move")}>Taşı</MenuButton>
            <MenuButton danger onClick={() => onManageItem?.(document, "folder-delete")}>Sil</MenuButton>
          </>
        ) : (
          <>
            <MenuButton onClick={() => onManageItem?.(document, "document-rename")}>Yeniden Adlandır</MenuButton>
            <MenuButton onClick={() => onManageItem?.(document, "document-move")}>Taşı</MenuButton>
            <MenuButton danger onClick={() => onManageItem?.(document, "document-delete")}>Sil</MenuButton>
          </>
        )}
      </div>
    </details>
  );
}

function MenuButton({
  children,
  danger = false,
  onClick
}: {
  children: ReactNode;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`block w-full rounded px-3 py-2 text-left transition ${
        danger
          ? "text-red-700 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-950/30"
          : "text-zinc-700 hover:bg-zinc-50 dark:text-zinc-200 dark:hover:bg-zinc-800"
      }`}
    >
      {children}
    </button>
  );
}

function compareDocuments(first: DocumentItem, second: DocumentItem, field: SortField) {
  if (field === "size") {
    return parseSize(first.size) - parseSize(second.size);
  }

  if (field === "date") {
    return parseDate(first.date) - parseDate(second.date);
  }

  if (field === "validityDate") {
    return parseDate(first.validityDate) - parseDate(second.validityDate);
  }

  return getSortValue(first, field).localeCompare(getSortValue(second, field), "tr", {
    sensitivity: "base"
  });
}

function getSortValue(document: DocumentItem, field: SortField) {
  if (field === "owner") {
    return `${document.department} ${document.responsiblePerson}`;
  }

  return String(document[field]);
}

function parseSize(value: string) {
  if (value === "Klasör") {
    return 0;
  }

  const amount = Number(value.replace(",", ".").match(/[\d.]+/)?.[0] ?? 0);

  if (value.includes("MB")) {
    return amount * 1024 * 1024;
  }

  if (value.includes("KB")) {
    return amount * 1024;
  }

  return amount;
}

function parseDate(value: string) {
  const [day, month, year] = value.split(".").map(Number);

  if (!day || !month || !year) {
    return 0;
  }

  return new Date(year, month - 1, day).getTime();
}

function isPastValidityDate(value: string) {
  const match = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(value);

  if (!match) {
    return false;
  }

  const today = new Date();

  return new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1])) < new Date(today.getFullYear(), today.getMonth(), today.getDate());
}
