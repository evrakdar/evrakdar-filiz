"use client";

import { useEffect, useMemo, useState, type MouseEvent } from "react";
import { ChevronDown, ChevronRight, Folder, FolderOpen, Home } from "lucide-react";
import { getFolderChildren, getRootFolders, type FolderDto } from "@/lib/api";

export type FolderTreeSelection = FolderDto;

type FolderTreeViewProps = {
  selectedFolderId: string | null;
  expandedFolderIds?: string[];
  onSelectFolder: (folder: FolderTreeSelection | null) => void;
  onFolderContextMenu?: (event: MouseEvent, folder: FolderTreeSelection | null) => void;
  onDropOnFolder?: (folder: FolderTreeSelection) => void;
  canDropOnFolder?: (folder: FolderTreeSelection) => boolean;
  onDragTargetChange?: (folderId: string | null) => void;
  dragOverFolderId?: string | null;
  rootLabel?: string;
  className?: string;
  showRoot?: boolean;
  /** Change this number after folders change, to read them again without closing what is open. */
  refreshKey?: number;
};

type FolderTreeState = {
  rootFolders: FolderDto[];
  childrenByFolderId: Record<string, FolderDto[]>;
  expandedIds: Set<string>;
  loadingIds: Set<string>;
  loadedIds: Set<string>;
  status: "loading" | "ready" | "error";
};

export function FolderTreeView({
  selectedFolderId,
  expandedFolderIds = [],
  onSelectFolder,
  onFolderContextMenu,
  onDropOnFolder,
  canDropOnFolder,
  onDragTargetChange,
  dragOverFolderId,
  rootLabel = "Ana dizin",
  className = "",
  showRoot = true,
  refreshKey = 0
}: FolderTreeViewProps) {
  const [tree, setTree] = useState<FolderTreeState>({
    rootFolders: [],
    childrenByFolderId: {},
    expandedIds: new Set(expandedFolderIds),
    loadingIds: new Set(),
    loadedIds: new Set(),
    status: "loading"
  });
  const expandedKey = expandedFolderIds.join("|");

  useEffect(() => {
    let isActive = true;

    if (refreshKey === 0) {
      setTree((current) => ({ ...current, status: "loading" }));
    }

    getRootFolders()
      .then((response) => {
        if (!isActive) {
          return;
        }

        setTree((current) => ({
          ...current,
          rootFolders: response.data,
          status: "ready"
        }));
      })
      .catch(() => {
        if (isActive) {
          setTree((current) => ({ ...current, rootFolders: [], status: "error" }));
        }
      });

    return () => {
      isActive = false;
    };
  }, [refreshKey]);

  useEffect(() => {
    if (refreshKey === 0) {
      return;
    }

    setTree((current) => ({ ...current, loadedIds: new Set(), loadingIds: new Set() }));

    for (const folderId of tree.expandedIds) {
      void loadChildren(folderId);
    }
    // Only a new `refreshKey` reads the open folders again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  useEffect(() => {
    if (expandedFolderIds.length === 0) {
      return;
    }

    setTree((current) => ({
      ...current,
      expandedIds: new Set([...current.expandedIds, ...expandedFolderIds])
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expandedKey]);

  useEffect(() => {
    for (const folderId of expandedFolderIds) {
      if (!tree.loadedIds.has(folderId) && !tree.loadingIds.has(folderId)) {
        void loadChildren(folderId);
      }
    }
    // `expandedKey` intentionally drives lazy loading for the current breadcrumb path.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expandedKey, tree.loadedIds, tree.loadingIds]);

  const selectedPathIds = useMemo(() => new Set(expandedFolderIds), [expandedFolderIds]);

  async function toggleFolder(folder: FolderDto) {
    const isExpanded = tree.expandedIds.has(folder.id);

    if (isExpanded) {
      setTree((current) => ({
        ...current,
        expandedIds: removeFromSet(current.expandedIds, folder.id)
      }));
      return;
    }

    setTree((current) => ({
      ...current,
      expandedIds: new Set(current.expandedIds).add(folder.id)
    }));

    if (!tree.loadedIds.has(folder.id)) {
      await loadChildren(folder.id);
    }
  }

  async function selectFolder(folder: FolderDto) {
    onSelectFolder(folder);

    if (!tree.expandedIds.has(folder.id)) {
      setTree((current) => ({
        ...current,
        expandedIds: new Set(current.expandedIds).add(folder.id)
      }));
    }

    if (!tree.loadedIds.has(folder.id)) {
      await loadChildren(folder.id);
    }
  }

  async function loadChildren(folderId: string) {
    setTree((current) => ({
      ...current,
      loadingIds: new Set(current.loadingIds).add(folderId)
    }));

    try {
      const response = await getFolderChildren(folderId);
      setTree((current) => ({
        ...current,
        childrenByFolderId: {
          ...current.childrenByFolderId,
          [folderId]: response.data.folders
        },
        loadedIds: new Set(current.loadedIds).add(folderId),
        loadingIds: removeFromSet(current.loadingIds, folderId)
      }));
    } catch {
      setTree((current) => ({
        ...current,
        loadingIds: removeFromSet(current.loadingIds, folderId)
      }));
    }
  }

  return (
    <div className={`rounded-md border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900 ${className}`}>
      {showRoot ? (
        <button
          type="button"
          onClick={() => onSelectFolder(null)}
          onContextMenu={(event) => onFolderContextMenu?.(event, null)}
          className={`mb-2 flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm font-medium transition ${
            selectedFolderId === null
              ? "bg-brand-100 text-brand-950 ring-1 ring-brand-200 dark:bg-brand-950/60 dark:text-brand-50 dark:ring-brand-900"
              : "text-zinc-700 hover:bg-zinc-50 dark:text-zinc-200 dark:hover:bg-zinc-800"
          }`}
        >
          <Home className="h-4 w-4" />
          {rootLabel}
        </button>
      ) : null}

      {tree.status === "loading" ? (
        <p className="px-2 py-3 text-xs text-zinc-500 dark:text-zinc-400">Klasörler yükleniyor...</p>
      ) : tree.status === "error" ? (
        <p className="px-2 py-3 text-xs text-red-700 dark:text-red-300">Klasör ağacı yüklenemedi.</p>
      ) : tree.rootFolders.length === 0 ? (
        <p className="px-2 py-3 text-xs text-zinc-500 dark:text-zinc-400">Klasör bulunamadı.</p>
      ) : (
        <div className="grid gap-1">
          {tree.rootFolders.map((folder) => (
            <FolderTreeNode
              key={folder.id}
              folder={folder}
              tree={tree}
              selectedFolderId={selectedFolderId}
              selectedPathIds={selectedPathIds}
              dragOverFolderId={dragOverFolderId}
              onSelect={selectFolder}
              onToggle={toggleFolder}
              onFolderContextMenu={onFolderContextMenu}
              onDropOnFolder={onDropOnFolder}
              canDropOnFolder={canDropOnFolder}
              onDragTargetChange={onDragTargetChange}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function FolderTreeNode({
  folder,
  tree,
  selectedFolderId,
  selectedPathIds,
  dragOverFolderId,
  depth = 0,
  onSelect,
  onToggle,
  onFolderContextMenu,
  onDropOnFolder,
  canDropOnFolder,
  onDragTargetChange
}: {
  folder: FolderDto;
  tree: FolderTreeState;
  selectedFolderId: string | null;
  selectedPathIds: Set<string>;
  dragOverFolderId?: string | null;
  depth?: number;
  onSelect: (folder: FolderDto) => void | Promise<void>;
  onToggle: (folder: FolderDto) => void | Promise<void>;
  onFolderContextMenu?: (event: MouseEvent, folder: FolderTreeSelection | null) => void;
  onDropOnFolder?: (folder: FolderTreeSelection) => void;
  canDropOnFolder?: (folder: FolderTreeSelection) => boolean;
  onDragTargetChange?: (folderId: string | null) => void;
}) {
  const isSelected = selectedFolderId === folder.id;
  const isExpanded = tree.expandedIds.has(folder.id) || selectedPathIds.has(folder.id);
  const isLoading = tree.loadingIds.has(folder.id);
  const isLoaded = tree.loadedIds.has(folder.id);
  const children = tree.childrenByFolderId[folder.id] ?? [];
  const isDropTarget = dragOverFolderId === folder.id;
  const canDrop = canDropOnFolder?.(folder) ?? false;
  const FolderIcon = isExpanded ? FolderOpen : Folder;

  return (
    <div className="grid gap-1">
      <div className="flex items-center gap-1" style={{ paddingLeft: depth * 14 }}>
        <button
          type="button"
          onClick={() => void onToggle(folder)}
          className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-zinc-500 transition hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
          aria-label={`${folder.name} klasörünü ${isExpanded ? "kapat" : "aç"}`}
        >
          {isLoading ? (
            <span className="text-xs">...</span>
          ) : isExpanded ? (
            <ChevronDown className="h-4 w-4 transition-transform duration-150" />
          ) : (
            <ChevronRight className="h-4 w-4 transition-transform duration-150" />
          )}
        </button>
        <button
          type="button"
          onClick={() => void onSelect(folder)}
          onContextMenu={(event) => onFolderContextMenu?.(event, folder)}
          onDragOver={(event) => {
            if (!canDrop) {
              return;
            }

            event.preventDefault();
            onDragTargetChange?.(folder.id);
          }}
          onDragLeave={() => {
            if (isDropTarget) {
              onDragTargetChange?.(null);
            }
          }}
          onDrop={(event) => {
            if (!canDrop) {
              return;
            }

            event.preventDefault();
            onDragTargetChange?.(null);
            onDropOnFolder?.(folder);
          }}
          className={`flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition ${
            isSelected
              ? "bg-brand-100 font-semibold text-brand-950 ring-1 ring-brand-200 dark:bg-brand-950/60 dark:text-brand-50 dark:ring-brand-900"
              : isDropTarget
                ? "bg-amber-50 text-amber-900 ring-1 ring-amber-300 dark:bg-amber-950/40 dark:text-amber-100 dark:ring-amber-800"
                : "text-zinc-700 hover:bg-zinc-50 dark:text-zinc-200 dark:hover:bg-zinc-800"
          }`}
        >
          <FolderIcon className={`h-4 w-4 shrink-0 ${isExpanded ? "text-amber-600" : "text-amber-500"}`} />
          <span className="truncate">{folder.name}</span>
        </button>
      </div>
      {isExpanded && children.length > 0 ? (
        <div className="grid gap-1 overflow-hidden transition-all duration-150 ease-out">
          {children.map((child) => (
            <FolderTreeNode
              key={child.id}
              folder={child}
              tree={tree}
              selectedFolderId={selectedFolderId}
              selectedPathIds={selectedPathIds}
              dragOverFolderId={dragOverFolderId}
              depth={depth + 1}
              onSelect={onSelect}
              onToggle={onToggle}
              onFolderContextMenu={onFolderContextMenu}
              onDropOnFolder={onDropOnFolder}
              canDropOnFolder={canDropOnFolder}
              onDragTargetChange={onDragTargetChange}
            />
          ))}
        </div>
      ) : null}
      {isExpanded && isLoaded && children.length === 0 ? (
        <p className="rounded-md px-2 py-1 text-xs text-zinc-500 dark:text-zinc-400" style={{ marginLeft: (depth + 2) * 14 }}>
          Alt klasör yok.
        </p>
      ) : null}
    </div>
  );
}

function removeFromSet<T>(set: Set<T>, value: T) {
  const next = new Set(set);
  next.delete(value);
  return next;
}
