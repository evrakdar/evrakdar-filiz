"use client";

import { getDocumentTypeLabel as getTypeLabel } from "@/lib/document-labels";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode
} from "react";
import { createPortal } from "react-dom";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Clipboard,
  Copy,
  FileImage,
  FileQuestion,
  FileSpreadsheet,
  FileText,
  FileType2,
  FolderOpen,
  Home,
  MoreHorizontal,
  Presentation,
  RefreshCw,
  Scissors,
  Trash2
} from "lucide-react";
import {
  copyDocument,
  copyFolder,
  createFolder,
  deleteDocument,
  deleteFolder,
  getFolderBreadcrumb,
  getFolderById,
  getFolderChildren,
  getRootFolders,
  updateDocument,
  updateFolder,
  type BreadcrumbItemDto,
  type DocumentDto,
  type FolderDto
} from "@/lib/api";
import type { DocumentItem } from "@/lib/mock-data";
import { FolderTreeView, type FolderTreeSelection } from "./FolderTreeView";

type FileExplorerPanelProps = {
  token: string | null;
  canManage: boolean;
  canManageTopLevel?: boolean;
  onSelectDocument: (document: DocumentItem) => void;
  onClearSelectedDocument: () => void;
  onUploadToFolder?: (folder: FolderDto) => void;
  /** Reports the open folder, so that filters can stay inside it. */
  onFolderChange?: (folder: { id: string; name: string } | null) => void;
};

type ExplorerItem =
  | {
      itemType: "folder";
      folder: FolderDto;
      id: string;
      name: string;
      path: string;
      updatedAt: string;
    }
  | {
      itemType: "document";
      document: DocumentDto;
      id: string;
      name: string;
      updatedAt: string;
    };

type ExplorerAction =
  | "document-rename"
  | "document-move"
  | "document-delete"
  | "folder-create-child"
  | "folder-create-root"
  | "folder-rename"
  | "folder-move"
  | "folder-delete";

type ClipboardState = {
  mode: "cut" | "copy";
  items: ExplorerItem[];
};

type FolderOption = {
  id: string;
  name: string;
  path: string;
  depth: number;
};

type DialogState = {
  action: ExplorerAction;
  item: ExplorerItem;
};

type MenuState = {
  x: number;
  y: number;
  item: ExplorerItem | null;
};

type SortField = "name" | "type" | "size" | "owner" | "date";
type SortDirection = "asc" | "desc";

export function FileExplorerPanel({
  token,
  canManage,
  canManageTopLevel = false,
  onSelectDocument,
  onClearSelectedDocument,
  onUploadToFolder,
  onFolderChange
}: FileExplorerPanelProps) {
  const regionRef = useRef<HTMLElement | null>(null);
  const selectAllCheckboxRef = useRef<HTMLInputElement | null>(null);
  const dragItemsRef = useRef<ExplorerItem[]>([]);
  const dragTargetFolderIdRef = useRef<string | null>(null);
  const dropHandledRef = useRef(false);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [currentFolder, setCurrentFolder] = useState<FolderDto | null>(null);
  const openFolderId = currentFolder?.id;
  const openFolderName = currentFolder?.name;

  useEffect(() => {
    onFolderChange?.(openFolderId ? { id: openFolderId, name: openFolderName ?? "" } : null);
  }, [onFolderChange, openFolderId, openFolderName]);

  const [breadcrumb, setBreadcrumb] = useState<BreadcrumbItemDto[]>([]);
  const [folders, setFolders] = useState<FolderDto[]>([]);
  const [documents, setDocuments] = useState<DocumentDto[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState<string | null>(null);
  const [clipboardState, setClipboardState] = useState<ClipboardState | null>(null);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [lastSelectedKey, setLastSelectedKey] = useState<string | null>(null);
  const [menuState, setMenuState] = useState<MenuState | null>(null);
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [dialogName, setDialogName] = useState("");
  const [targetFolderId, setTargetFolderId] = useState("");
  const [folderOptions, setFolderOptions] = useState<FolderOption[]>([]);
  const [isLoadingFolderOptions, setIsLoadingFolderOptions] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [backStack, setBackStack] = useState<Array<string | null>>([]);
  const [forwardStack, setForwardStack] = useState<Array<string | null>>([]);
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);

  const visibleItems = useMemo<ExplorerItem[]>(
    () => [
      ...folders.map((folder) => ({
        itemType: "folder" as const,
        folder,
        id: folder.id,
        name: folder.name,
        path: folder.path,
        updatedAt: folder.updatedAt
      })),
      ...documents.map((document) => ({
        itemType: "document" as const,
        document,
        id: document.id,
        name: document.name,
        updatedAt: document.updatedAt
      }))
    ],
    [documents, folders]
  );

  const items = useMemo(() => sortExplorerItems(visibleItems, sortField, sortDirection), [
    sortDirection,
    sortField,
    visibleItems
  ]);

  const selectedItems = useMemo(
    () => items.filter((item) => selectedKeys.has(getItemKey(item))),
    [items, selectedKeys]
  );
  const allVisibleSelected = items.length > 0 && selectedItems.length === items.length;
  const partiallySelected = selectedItems.length > 0 && selectedItems.length < items.length;

  const currentFolderItem = useMemo<ExplorerItem | null>(() => {
    if (!currentFolder) {
      return null;
    }

    return {
      itemType: "folder",
      folder: currentFolder,
      id: currentFolder.id,
      name: currentFolder.name,
      path: currentFolder.path,
      updatedAt: currentFolder.updatedAt
    };
  }, [currentFolder]);

  useEffect(() => {
    if (selectAllCheckboxRef.current) {
      selectAllCheckboxRef.current.indeterminate = partiallySelected;
    }
  }, [partiallySelected]);

  const clearSelection = useCallback(() => {
    setSelectedKeys(new Set());
    setLastSelectedKey(null);
  }, []);

  const loadRoot = useCallback(
    async (successMessage?: string) => {
      setStatus("loading");
      setMessage(successMessage ?? null);
      setCurrentFolderId(null);
      setCurrentFolder(null);
      setBreadcrumb([]);
      clearSelection();
      onClearSelectedDocument();

      try {
        const response = await getRootFolders();
        setFolders(response.data);
        setDocuments([]);
        setStatus("ready");
      } catch {
        setFolders([]);
        setDocuments([]);
        setStatus("error");
        setMessage("Ana klasörler yüklenemedi.");
      }
    },
    [clearSelection, onClearSelectedDocument]
  );

  const loadFolder = useCallback(
    async (folderId: string, successMessage?: string) => {
      setStatus("loading");
      setMessage(successMessage ?? null);
      setCurrentFolderId(folderId);
      clearSelection();
      onClearSelectedDocument();

      try {
        const [childrenResponse, breadcrumbResponse, folderResponse] = await Promise.all([
          getFolderChildren(folderId),
          getFolderBreadcrumb(folderId),
          getFolderById(folderId)
        ]);
        setFolders(childrenResponse.data.folders);
        setDocuments(childrenResponse.data.documents);
        setBreadcrumb(breadcrumbResponse.data);
        setCurrentFolder(folderResponse.data);
        setStatus("ready");
      } catch {
        setFolders([]);
        setDocuments([]);
        setCurrentFolder(null);
        setStatus("error");
        setMessage("Klasör içeriği yüklenemedi.");
      }
    },
    [clearSelection, onClearSelectedDocument]
  );

  useEffect(() => {
    void loadRoot();
    // Explorer paneli sadece ilk açılışta Root'tan başlar; parent re-render navigasyonu sıfırlamamalı.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadLocation(folderId: string | null, successMessage?: string) {
    if (folderId) {
      await loadFolder(folderId, successMessage);
      return;
    }

    await loadRoot(successMessage);
  }

  async function navigateTo(folderId: string | null) {
    setBackStack((previous) => [...previous, currentFolderId]);
    setForwardStack([]);
    await loadLocation(folderId);
  }

  async function navigateFromTree(folder: FolderTreeSelection | null) {
    await navigateTo(folder?.id ?? null);
  }

  function treeFolderToExplorerItem(folder: FolderTreeSelection): ExplorerItem {
    return {
      itemType: "folder",
      folder,
      id: folder.id,
      name: folder.name,
      path: folder.path,
      updatedAt: folder.updatedAt
    };
  }

  async function goBack() {
    const previous = backStack.at(-1);
    if (previous === undefined) {
      return;
    }

    setBackStack((stack) => stack.slice(0, -1));
    setForwardStack((stack) => [currentFolderId, ...stack]);
    await loadLocation(previous);
  }

  async function goForward() {
    const next = forwardStack[0];
    if (next === undefined) {
      return;
    }

    setForwardStack((stack) => stack.slice(1));
    setBackStack((stack) => [...stack, currentFolderId]);
    await loadLocation(next);
  }

  async function goUp() {
    if (breadcrumb.length <= 1) {
      await navigateTo(null);
      return;
    }

    await navigateTo(breadcrumb[breadcrumb.length - 2].id);
  }

  async function reloadCurrent(successMessage?: string) {
    await loadLocation(currentFolderId, successMessage);
  }

  function openItem(item: ExplorerItem) {
    setMenuState(null);
    if (item.itemType === "folder") {
      void navigateTo(item.id);
      return;
    }

    onSelectDocument(mapDocumentToItem(item.document));
  }

  function previewDocument(item: ExplorerItem) {
    if (item.itemType === "folder") {
      onClearSelectedDocument();
      return;
    }

    onSelectDocument(mapDocumentToItem(item.document));
  }

  function selectItem(event: MouseEvent, item: ExplorerItem, index: number) {
    const key = getItemKey(item);
    const isRange = event.shiftKey && lastSelectedKey;
    const isToggle = event.ctrlKey || event.metaKey;

    if (isRange) {
      const lastIndex = items.findIndex((candidate) => getItemKey(candidate) === lastSelectedKey);
      const start = Math.min(lastIndex, index);
      const end = Math.max(lastIndex, index);
      const rangeKeys = items.slice(start, end + 1).map(getItemKey);
      setSelectedKeys((previous) => new Set([...previous, ...rangeKeys]));
    } else if (isToggle) {
      setSelectedKeys((previous) => {
        const next = new Set(previous);
        if (next.has(key)) {
          next.delete(key);
        } else {
          next.add(key);
        }
        return next;
      });
      setLastSelectedKey(key);
    } else {
      setSelectedKeys(new Set([key]));
      setLastSelectedKey(key);
    }

    previewDocument(item);
  }

  function openContextMenu(event: MouseEvent, item: ExplorerItem | null) {
    event.preventDefault();
    event.stopPropagation();
    const width = 224;
    const height = item ? 320 : 160;
    const padding = 8;
    const x = Math.max(padding, Math.min(event.clientX, window.innerWidth - width - padding));
    const y = Math.max(padding, Math.min(event.clientY, window.innerHeight - height - padding));
    setMenuState({ x, y, item });
  }

  function openCreateFolder() {
    if (currentFolderItem) {
      void openDialog("folder-create-child", currentFolderItem);
    } else if (canManageTopLevel) {
      // The top level has no folder of its own; the dialog only needs something to hang the action on.
      void openDialog("folder-create-root", { itemType: "folder", id: "", name: "", path: "", updatedAt: "" } as ExplorerItem);
    }
  }

  async function openDialog(action: ExplorerAction, item: ExplorerItem) {
    setMenuState(null);
    if (!canManage) {
      setMessage("Bu işlem için yetkiniz yok.");
      return;
    }

    setDialog({ action, item });
    setDialogName(action === "folder-create-child" || action === "folder-create-root" ? "" : item.name);
    setTargetFolderId("");
    setMessage(null);

    if (action === "document-move" || action === "folder-move") {
      await loadFolderOptions(item);
    } else {
      setFolderOptions([]);
    }
  }

  async function loadFolderOptions(item: ExplorerItem) {
    setIsLoadingFolderOptions(true);

    try {
      const options = await loadAllFolderOptions();
      const filteredOptions =
        item.itemType === "folder"
          ? options.filter((option) => option.id !== item.id && !option.path.startsWith(`${item.path}/`))
          : options;
      setFolderOptions(filteredOptions);
      setTargetFolderId(filteredOptions[0]?.id ?? "");
    } catch {
      setFolderOptions([]);
      setMessage("Klasör seçenekleri yüklenemedi.");
    } finally {
      setIsLoadingFolderOptions(false);
    }
  }

  async function submitDialog() {
    if (!dialog || !token) {
      setMessage("Oturum bulunamadı. Lütfen yeniden giriş yapın.");
      return;
    }

    setIsSubmitting(true);
    setMessage(null);

    try {
      const name = dialogName.trim();
      const deletedCurrentFolder =
        dialog.action === "folder-delete" && currentFolderId !== null && dialog.item.id === currentFolderId;
      const parentAfterDelete = breadcrumb.length > 1 ? breadcrumb[breadcrumb.length - 2].id : null;

      if (dialog.action === "document-rename") {
        await updateDocument(dialog.item.id, { name }, token);
      } else if (dialog.action === "document-move") {
        await updateDocument(dialog.item.id, { folderId: targetFolderId }, token);
      } else if (dialog.action === "document-delete") {
        await deleteDocument(dialog.item.id, token);
        onClearSelectedDocument();
      } else if (dialog.action === "folder-create-root") {
        await createFolder({ name }, token);
      } else if (dialog.action === "folder-create-child") {
        await createFolder({ name, parentId: dialog.item.id }, token);
      } else if (dialog.action === "folder-rename") {
        await updateFolder(dialog.item.id, { name }, token);
      } else if (dialog.action === "folder-move") {
        await updateFolder(dialog.item.id, { parentId: targetFolderId }, token);
      } else if (dialog.action === "folder-delete") {
        await deleteFolder(dialog.item.id, token);
      }

      const successMessage = getSuccessMessage(dialog.action);
      setDialog(null);

      if (deletedCurrentFolder) {
        await loadLocation(parentAfterDelete, successMessage);
      } else {
        await reloadCurrent(successMessage);
      }
    } catch (error) {
      setMessage(getExplorerErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  function closeDialog() {
    if (isSubmitting) {
      return;
    }

    setDialog(null);
    setDialogName("");
    setTargetFolderId("");
    setFolderOptions([]);
  }

  function setClipboard(mode: ClipboardState["mode"], targetItems: ExplorerItem[]) {
    if (!canManage) {
      setMessage("Bu işlem için yetkiniz yok.");
      return;
    }

    setMenuState(null);
    setClipboardState({ mode, items: targetItems });
    setMessage(`${targetItems.length} öğe ${mode === "cut" ? "kesildi" : "kopyalandı"}. Hedef klasöre gidip Yapıştır deyin.`);
  }

  async function pasteClipboard(targetFolderId = currentFolderId) {
    if (!clipboardState || !token) {
      return;
    }

    if (!targetFolderId) {
      setMessage("Ana dizine yapıştırılamıyor. Bir klasörün içine girin.");
      return;
    }

    setStatus("loading");
    setMessage(null);

    try {
      for (const item of clipboardState.items) {
        if (item.itemType === "document") {
          if (clipboardState.mode === "cut") {
            await updateDocument(item.id, { folderId: targetFolderId }, token);
          } else {
            await copyDocument(item.id, { folderId: targetFolderId }, token);
          }
        } else if (clipboardState.mode === "cut") {
          await updateFolder(item.id, { parentId: targetFolderId }, token);
        } else {
          await copyFolder(item.id, { parentId: targetFolderId }, token);
        }
      }

      if (clipboardState.mode === "cut") {
        setClipboardState(null);
      }

      await reloadCurrent(clipboardState.mode === "cut" ? "Öğe taşındı." : "Öğe kopyalandı.");
    } catch (error) {
      setStatus("ready");
      setMessage(getExplorerErrorMessage(error));
    }
  }

  async function deleteSelectedItems() {
    if (!canManage || !token || selectedItems.length === 0) {
      return;
    }

    if (!window.confirm(`${selectedItems.length} öğeyi silmek istiyor musunuz?`)) {
      return;
    }

    setStatus("loading");
    setMessage(null);

    try {
      for (const item of selectedItems) {
        if (item.itemType === "document") {
          await deleteDocument(item.id, token);
        } else {
          await deleteFolder(item.id, token);
        }
      }

      onClearSelectedDocument();
      await reloadCurrent(`${selectedItems.length} öğe silindi.`);
    } catch (error) {
      setStatus("ready");
      setMessage(getExplorerErrorMessage(error));
    }
  }

  async function moveItemsToFolder(targetFolderId: string) {
    if (!canManage || !token || dragItemsRef.current.length === 0) {
      return;
    }

    setStatus("loading");
    setMessage(null);

    try {
      for (const item of dragItemsRef.current) {
        if (item.itemType === "document") {
          await updateDocument(item.id, { folderId: targetFolderId }, token);
        } else {
          await updateFolder(item.id, { parentId: targetFolderId }, token);
        }
      }

      await reloadCurrent("Öğe taşındı.");
    } catch (error) {
      setStatus("ready");
      setMessage(getExplorerErrorMessage(error));
    } finally {
      dragItemsRef.current = [];
      dragTargetFolderIdRef.current = null;
      dropHandledRef.current = false;
      setDragOverKey(null);
    }
  }

  function startDrag(event: React.DragEvent, item: ExplorerItem) {
    if (!canManage) {
      event.preventDefault();
      return;
    }

    const selected = selectedKeys.has(getItemKey(item)) ? selectedItems : [item];
    dragItemsRef.current = selected;
    dragTargetFolderIdRef.current = null;
    dropHandledRef.current = false;
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", selected.map((selectedItem) => selectedItem.name).join(", "));
  }

  function finishDrag() {
    const targetFolderId = dragTargetFolderIdRef.current;
    if (!dropHandledRef.current && targetFolderId) {
      void moveItemsToFolder(targetFolderId);
      return;
    }

    dragItemsRef.current = [];
    dragTargetFolderIdRef.current = null;
    dropHandledRef.current = false;
    setDragOverKey(null);
  }

  function canDropInto(target: ExplorerItem | FolderDto | null) {
    if (!canManage || !target || dragItemsRef.current.length === 0) {
      return false;
    }

    const targetFolder = "itemType" in target ? (target.itemType === "folder" ? target.folder : null) : target;
    if (!targetFolder) {
      return false;
    }

    return dragItemsRef.current.every((item) => {
      if (item.itemType === "document") {
        return true;
      }

      return item.id !== targetFolder.id && !targetFolder.path.startsWith(`${item.path}/`);
    });
  }

  function handleKeyboard(event: KeyboardEvent<HTMLElement>) {
    if (isEditableTarget(event.target)) {
      return;
    }

    const key = event.key.toLowerCase();

    if ((event.ctrlKey || event.metaKey) && key === "a") {
      event.preventDefault();
      setSelectedKeys(new Set(items.map(getItemKey)));
      setLastSelectedKey(items.at(-1) ? getItemKey(items[items.length - 1]) : null);
    } else if ((event.ctrlKey || event.metaKey) && key === "c") {
      event.preventDefault();
      if (selectedItems.length > 0) {
        setClipboard("copy", selectedItems);
      }
    } else if ((event.ctrlKey || event.metaKey) && key === "x") {
      event.preventDefault();
      if (selectedItems.length > 0) {
        setClipboard("cut", selectedItems);
      }
    } else if ((event.ctrlKey || event.metaKey) && key === "v") {
      event.preventDefault();
      void pasteClipboard();
    } else if (event.key === "Delete") {
      event.preventDefault();
      void deleteSelectedItems();
    } else if (event.key === "F2") {
      event.preventDefault();
      if (selectedItems.length === 1) {
        const item = selectedItems[0];
        void openDialog(item.itemType === "folder" ? "folder-rename" : "document-rename", item);
      }
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (selectedItems.length === 1) {
        openItem(selectedItems[0]);
      }
    } else if (event.key === "Backspace") {
      event.preventDefault();
      void goUp();
    } else if (event.key === "Escape") {
      event.preventDefault();
      setMenuState(null);
      clearSelection();
    }
  }

  function toggleSort(field: SortField) {
    setSortField((current) => {
      if (current === field) {
        setSortDirection((direction) => (direction === "asc" ? "desc" : "asc"));
        return current;
      }

      setSortDirection("asc");
      return field;
    });
  }

  function toggleAllVisibleItems() {
    if (allVisibleSelected) {
      clearSelection();
      return;
    }

    setSelectedKeys(new Set(items.map((item) => getItemKey(item))));
    setLastSelectedKey(items.at(-1) ? getItemKey(items.at(-1)!) : null);
  }

  const selectedCount = selectedItems.length;
  const pasteDisabled = !canManage || !clipboardState || !currentFolderId || status === "loading";
  const breadcrumbFolderIds = breadcrumb.map((item) => item.id);

  return (
    <section
      ref={regionRef}
      role="region"
      aria-label="Dosya ve Klasörler"
      tabIndex={0}
      onKeyDown={handleKeyboard}
      onContextMenu={(event) => {
        if ((event.target as HTMLElement).closest("[data-explorer-row='true']")) {
          return;
        }
        openContextMenu(event, null);
      }}
      className="space-y-4 outline-none"
    >
      <div className="rounded-md border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <h1 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">Dosya ve Klasörler</h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Klasörleri ve belgeleri dosya gezgini gibi yönetin.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <ToolbarButton label="Geri" icon={<ArrowLeft className="h-4 w-4" />} disabled={backStack.length === 0} onClick={() => void goBack()} />
            <ToolbarButton label="İleri" icon={<ArrowRight className="h-4 w-4" />} disabled={forwardStack.length === 0} onClick={() => void goForward()} />
            <ToolbarButton label="Üst klasör" icon={<ArrowUp className="h-4 w-4" />} disabled={!currentFolderId} onClick={() => void goUp()} />
            <ToolbarButton label="Ana dizin" icon={<Home className="h-4 w-4" />} onClick={() => void navigateTo(null)} />
            <ToolbarButton label="Yenile" icon={<RefreshCw className="h-4 w-4" />} onClick={() => void reloadCurrent()} />
            <ToolbarButton
              label="Yeni Klasör"
              disabled={!canManage || (!currentFolderItem && !canManageTopLevel)}
              onClick={openCreateFolder}
            />
            <ToolbarButton
              label="Bu klasöre belge yükle"
              disabled={!canManage || !currentFolder}
              onClick={() => currentFolder && onUploadToFolder?.(currentFolder)}
            />
            <ToolbarButton
              label="Yapıştır"
              icon={<Clipboard className="h-4 w-4" />}
              primary
              disabled={pasteDisabled}
              onClick={() => void pasteClipboard()}
            />
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3 2xl:flex-row 2xl:items-center 2xl:justify-between">
          <nav aria-label="Explorer yolu" className="flex flex-wrap items-center gap-2 text-sm">
            <button
              type="button"
              onClick={() => void navigateTo(null)}
              className="rounded-md border border-zinc-200 px-3 py-1.5 font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              Ana dizin
            </button>
            {breadcrumb.map((item) => (
              <span key={item.id} className="flex items-center gap-2">
                <span className="text-zinc-400">/</span>
                <button
                  type="button"
                  onClick={() => void navigateTo(item.id)}
                  className="rounded-md px-2 py-1 font-medium text-zinc-700 transition hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  {item.name}
                </button>
              </span>
            ))}
          </nav>

          <div className="flex flex-wrap items-center gap-2">
            {selectedCount > 0 ? (
              <>
                <span className="rounded-md bg-zinc-100 px-3 py-2 text-sm font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                  {selectedCount} öğe seçildi
                </span>
                <ToolbarButton label="Kopyala" icon={<Copy className="h-4 w-4" />} disabled={!canManage} onClick={() => setClipboard("copy", selectedItems)} />
                <ToolbarButton label="Kes" icon={<Scissors className="h-4 w-4" />} disabled={!canManage} onClick={() => setClipboard("cut", selectedItems)} />
                <ToolbarButton label="Taşı" disabled={!canManage} onClick={() => setClipboard("cut", selectedItems)} />
                {selectedCount === 1 ? (
                  <ToolbarButton
                    label="Yeniden Adlandır"
                    disabled={!canManage}
                    onClick={() => void openDialog(selectedItems[0].itemType === "folder" ? "folder-rename" : "document-rename", selectedItems[0])}
                  />
                ) : null}
                <ToolbarButton label="Sil" danger icon={<Trash2 className="h-4 w-4" />} disabled={!canManage} onClick={() => void deleteSelectedItems()} />
              </>
            ) : (
              <>
                <span className="rounded-md bg-zinc-100 px-3 py-2 text-sm font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                  {currentFolder?.name ?? "Ana dizin"}
                </span>
                <ToolbarButton
                  label="Yeniden Adlandır"
                  disabled={!canManage || !currentFolderItem}
                  onClick={() => currentFolderItem && void openDialog("folder-rename", currentFolderItem)}
                />
                <ToolbarButton
                  label="Taşı"
                  disabled={!canManage || !currentFolderItem}
                  onClick={() => currentFolderItem && void openDialog("folder-move", currentFolderItem)}
                />
                <ToolbarButton
                  label="Sil"
                  danger
                  disabled={!canManage || !currentFolderItem}
                  onClick={() => currentFolderItem && void openDialog("folder-delete", currentFolderItem)}
                />
              </>
            )}
          </div>
        </div>

        {clipboardState ? (
          <p className="mt-3 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-200">
            Pano: {clipboardState.mode === "cut" ? "Kes" : "Kopyala"} - {clipboardState.items.map((item) => item.name).join(", ")}
          </p>
        ) : null}
        {message ? (
          <p className="mt-3 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200">
            {message}
          </p>
        ) : null}
      </div>

      <div className="grid gap-4 xl:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="min-w-0">
          <div className="sticky top-4 space-y-2">
            <div className="rounded-md border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <h2 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">Klasör Ağacı</h2>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                Ana dizinden başlayarak klasörleri genişletin.
              </p>
            </div>
            <FolderTreeView
              selectedFolderId={currentFolderId}
              expandedFolderIds={breadcrumbFolderIds}
              onSelectFolder={(folder) => void navigateFromTree(folder)}
              onFolderContextMenu={(event, folder) => openContextMenu(event, folder ? treeFolderToExplorerItem(folder) : null)}
              canDropOnFolder={(folder) => canDropInto(folder)}
              dragOverFolderId={dragOverKey?.startsWith("tree-folder:") ? dragOverKey.replace("tree-folder:", "") : null}
              onDragTargetChange={(folderId) => setDragOverKey(folderId ? `tree-folder:${folderId}` : null)}
              onDropOnFolder={(folder) => void moveItemsToFolder(folder.id)}
            />
          </div>
        </aside>

        <div className="min-w-0">
      <div
        className="overflow-hidden rounded-md border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
        onContextMenu={(event) => {
          if ((event.target as HTMLElement).closest("[data-explorer-row='true']")) {
            return;
          }
          openContextMenu(event, null);
        }}
        onDragOver={(event) => {
          if (!currentFolder || !canDropInto(currentFolder)) {
          return;
        }
        event.preventDefault();
          dragTargetFolderIdRef.current = currentFolder.id;
        setDragOverKey("current-folder");
      }}
        onDragLeave={() => setDragOverKey(null)}
        onDrop={(event) => {
          event.preventDefault();
          dropHandledRef.current = true;
          if (currentFolder) {
            void moveItemsToFolder(currentFolder.id);
          }
        }}
      >
        <div
          className={`flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800 ${
            dragOverKey === "current-folder" ? "bg-brand-50 dark:bg-brand-950/20" : ""
          }`}
        >
          <div>
            <h2 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">{breadcrumb.at(-1)?.name ?? "Ana dizin"}</h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {folders.length} klasör, {documents.length} dosya
            </p>
          </div>
        </div>

        {status === "loading" ? (
          <div className="grid min-h-64 place-items-center text-sm text-zinc-500 dark:text-zinc-400">
            Klasör içeriği yükleniyor...
          </div>
        ) : status === "error" ? (
          <div className="grid min-h-64 place-items-center px-6 py-12 text-center">
            <div>
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">İçerik yüklenemedi</h3>
              <button
                type="button"
                onClick={() => void reloadCurrent()}
                className="mt-4 rounded-md bg-brand-800 px-3 py-2 text-sm font-medium text-white transition hover:bg-brand-900"
              >
                Tekrar dene
              </button>
            </div>
          </div>
        ) : items.length === 0 ? (
          <div className="grid min-h-64 place-items-center px-6 py-12 text-center">
            <div>
              <FolderOpen className="mx-auto h-10 w-10 text-zinc-400" />
              <h3 className="mt-4 text-sm font-semibold text-zinc-900 dark:text-zinc-50">Bu klasör boş</h3>
              <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">Alt klasör veya doküman bulunmuyor.</p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto" aria-label="Dosya gezgini liste alanı">
            <table aria-label="Dosya gezgini listesi" className="w-full min-w-[980px] border-collapse text-sm">
              <thead
                onContextMenu={(event) => openContextMenu(event, null)}
                className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-950 dark:text-zinc-400"
              >
                <tr>
                  <th className="w-36 px-4 py-3">
                    <label className="flex items-center gap-2">
                      <input
                        ref={selectAllCheckboxRef}
                        checked={allVisibleSelected}
                        onChange={toggleAllVisibleItems}
                        type="checkbox"
                        className="h-4 w-4 rounded border-zinc-300 text-brand-800 dark:text-brand-300"
                        aria-label="Tümünü seç"
                      />
                      <span>Tümünü Seç</span>
                    </label>
                  </th>
                  <SortableHeader field="name" activeField={sortField} direction={sortDirection} onSort={toggleSort}>
                    Ad
                  </SortableHeader>
                  <SortableHeader field="type" activeField={sortField} direction={sortDirection} onSort={toggleSort}>
                    Tür
                  </SortableHeader>
                  <SortableHeader field="size" activeField={sortField} direction={sortDirection} onSort={toggleSort}>
                    Boyut
                  </SortableHeader>
                  <SortableHeader field="owner" activeField={sortField} direction={sortDirection} onSort={toggleSort}>
                    Sorumlu
                  </SortableHeader>
                  <SortableHeader field="date" activeField={sortField} direction={sortDirection} onSort={toggleSort}>
                    Tarih
                  </SortableHeader>
                  <th className="w-20 px-4 py-3">İşlem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {items.map((item, index) => {
                  const itemKey = getItemKey(item);
                  const selected = selectedKeys.has(itemKey);
                  const Icon = getItemIcon(item);

                  return (
                    <tr
                      key={itemKey}
                      data-explorer-row="true"
                      draggable={canManage}
                      onClick={(event) => selectItem(event, item, index)}
                      onDoubleClick={() => openItem(item)}
                      onContextMenu={(event) => openContextMenu(event, item)}
                      onDragStart={(event) => startDrag(event, item)}
                      onDragEnd={() => {
                        finishDrag();
                      }}
                      onDragOver={(event) => {
                        if (!canDropInto(item)) {
                          return;
                        }
                        event.preventDefault();
                        if (item.itemType === "folder") {
                          dragTargetFolderIdRef.current = item.id;
                        }
                        setDragOverKey(itemKey);
                      }}
                      onDragLeave={() => setDragOverKey(null)}
                      onDrop={(event) => {
                        event.preventDefault();
                        if (item.itemType === "folder" && canDropInto(item)) {
                          dropHandledRef.current = true;
                          void moveItemsToFolder(item.id);
                        }
                      }}
                      className={`cursor-pointer bg-white transition dark:bg-zinc-900 ${
                        selected
                          ? "bg-brand-50 text-brand-950 dark:bg-brand-950/40 dark:text-brand-50"
                          : "hover:bg-brand-50/50 dark:hover:bg-brand-950/20"
                      } ${dragOverKey === itemKey ? "outline outline-2 outline-brand-800" : ""}`}
                    >
                      <td className="px-4 py-3">
                        <input
                          checked={selected}
                          onClick={(event) => event.stopPropagation()}
                          onChange={() => {
                            setSelectedKeys((current) => {
                              const next = new Set(current);

                              if (next.has(itemKey)) {
                                next.delete(itemKey);
                              } else {
                                next.add(itemKey);
                              }

                              return next;
                            });
                            setLastSelectedKey(itemKey);
                          }}
                          type="checkbox"
                          className="h-4 w-4 rounded border-zinc-300 text-brand-800 dark:text-brand-300"
                          aria-label={`${item.name} satırını seç`}
                        />
                      </td>
                      <td className="w-[34%] px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Icon className={`h-4 w-4 shrink-0 ${item.itemType === "folder" ? "text-amber-600" : "text-zinc-500"}`} />
                          <span className="font-medium text-zinc-900 dark:text-zinc-100">{item.name}</span>
                        </div>
                      </td>
                      <td className="w-[16%] px-4 py-3 text-zinc-600 dark:text-zinc-300">
                        {item.itemType === "folder" ? "Klasör" : getDocumentTypeLabel(item.document)}
                      </td>
                      <td className="w-[12%] px-4 py-3 text-zinc-600 dark:text-zinc-300">
                        {item.itemType === "folder" ? "-" : formatSize(item.document.sizeBytes)}
                      </td>
                      <td className="w-[22%] px-4 py-3 text-zinc-600 dark:text-zinc-300">{getOwnerLabel(item)}</td>
                      <td className="w-[12%] px-4 py-3 text-zinc-600 dark:text-zinc-300">{formatDate(item.updatedAt)}</td>
                      <td className="w-20 px-4 py-3">
                        <ExplorerActionsMenu
                          item={item}
                          canManage={canManage}
                          onOpen={() => openItem(item)}
                          onCut={() => setClipboard("cut", [item])}
                          onCopy={() => setClipboard("copy", [item])}
                          onAction={(action) => void openDialog(action, item)}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
        </div>
      </div>

      {menuState ? (
        <FloatingMenu x={menuState.x} y={menuState.y} onClose={() => setMenuState(null)}>
          {menuState.item ? (
            <ExplorerMenuItems
              item={menuState.item}
              canManage={canManage}
              onOpen={() => openItem(menuState.item!)}
              onCut={() => setClipboard("cut", [menuState.item!])}
              onCopy={() => setClipboard("copy", [menuState.item!])}
              onAction={(action) => void openDialog(action, menuState.item!)}
            />
          ) : (
            <EmptyMenuItems
              canManage={canManage}
              canPaste={!pasteDisabled}
              hasCurrentFolder={Boolean(currentFolderItem) || canManageTopLevel}
              onCreateFolder={openCreateFolder}
              onPaste={() => void pasteClipboard()}
              onRefresh={() => void reloadCurrent()}
            />
          )}
        </FloatingMenu>
      ) : null}

      {dialog ? (
        <ExplorerDialog
          state={dialog}
          name={dialogName}
          targetFolderId={targetFolderId}
          folderOptions={folderOptions}
          isLoadingFolders={isLoadingFolderOptions}
          isSubmitting={isSubmitting}
          onNameChange={setDialogName}
          onTargetFolderChange={setTargetFolderId}
          onSubmit={submitDialog}
          onClose={closeDialog}
        />
      ) : null}
    </section>
  );
}

function ExplorerActionsMenu({
  item,
  canManage,
  onOpen,
  onCut,
  onCopy,
  onAction
}: {
  item: ExplorerItem;
  canManage: boolean;
  onOpen: () => void;
  onCut: () => void;
  onCopy: () => void;
  onAction: (action: ExplorerAction) => void;
}) {
  const detailsRef = useRef<HTMLDetailsElement | null>(null);
  const summaryRef = useRef<HTMLElement | null>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  function positionMenu() {
    const summary = summaryRef.current;
    if (!summary) {
      return;
    }

    const rect = summary.getBoundingClientRect();
    const width = 224;
    const estimatedHeight = item.itemType === "folder" && canManage ? 320 : canManage ? 280 : 48;
    const padding = 8;

    setPosition({
      x: Math.max(padding, Math.min(rect.right - width, window.innerWidth - width - padding)),
      y: Math.max(padding, Math.min(rect.bottom + 6, window.innerHeight - estimatedHeight - padding))
    });
  }

  useEffect(() => {
    function closeOnOutsideClick(event: PointerEvent) {
      const details = detailsRef.current;
      if (!details?.open || details.contains(event.target as Node)) {
        return;
      }

      details.open = false;
    }

    function closeOnEscape(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape" && detailsRef.current?.open) {
        detailsRef.current.open = false;
      }
    }

    window.addEventListener("pointerdown", closeOnOutsideClick);
    window.addEventListener("keydown", closeOnEscape);
    window.addEventListener("resize", positionMenu);
    window.addEventListener("scroll", positionMenu, true);

    return () => {
      window.removeEventListener("pointerdown", closeOnOutsideClick);
      window.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("resize", positionMenu);
      window.removeEventListener("scroll", positionMenu, true);
    };
  });

  function closeMenu() {
    if (detailsRef.current) {
      detailsRef.current.open = false;
    }
  }

  return (
    <details
      ref={detailsRef}
      className="inline-block"
      onClick={(event) => event.stopPropagation()}
      onToggle={() => {
        if (detailsRef.current?.open) {
          positionMenu();
        }
      }}
    >
      <summary
        ref={summaryRef}
        aria-label={`Explorer işlemleri: ${item.name}`}
        className="grid h-8 w-8 cursor-pointer list-none place-items-center rounded-md border border-zinc-200 text-zinc-500 transition hover:bg-zinc-50 hover:text-brand-800 [&::-webkit-details-marker]:hidden dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
      >
        <MoreHorizontal className="h-4 w-4" />
      </summary>
      <div
        role="menu"
        style={{ left: position.x, top: position.y }}
        className="fixed z-[80] w-56 rounded-md border border-zinc-200 bg-white p-1 text-sm shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
      >
        <ExplorerMenuItems
          item={item}
          canManage={canManage}
          onOpen={() => {
            closeMenu();
            onOpen();
          }}
          onCut={() => {
            closeMenu();
            onCut();
          }}
          onCopy={() => {
            closeMenu();
            onCopy();
          }}
          onAction={(action) => {
            closeMenu();
            onAction(action);
          }}
        />
      </div>
    </details>
  );
}

function FloatingMenu({
  x,
  y,
  onClose,
  children
}: {
  x: number;
  y: number;
  onClose: () => void;
  children: ReactNode;
}) {
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState({ x, y });

  useLayoutEffect(() => {
    const menu = menuRef.current;
    if (!menu) {
      return;
    }

    const rect = menu.getBoundingClientRect();
    const padding = 8;
    setPosition({
      x: Math.max(padding, Math.min(x, window.innerWidth - rect.width - padding)),
      y: Math.max(padding, Math.min(y, window.innerHeight - rect.height - padding))
    });
  }, [x, y]);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (menuRef.current?.contains(event.target as Node)) {
        return;
      }
      onClose();
    }

    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", onClose);
    window.addEventListener("scroll", onClose, true);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", onClose);
      window.removeEventListener("scroll", onClose, true);
    };
  }, [onClose]);

  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      style={{ left: position.x, top: position.y }}
      className="fixed z-[80] w-56 rounded-md border border-zinc-200 bg-white p-1 text-sm shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
    >
      {children}
    </div>,
    document.body
  );
}

function ExplorerMenuItems({
  item,
  canManage,
  onOpen,
  onCut,
  onCopy,
  onAction
}: {
  item: ExplorerItem;
  canManage: boolean;
  onOpen: () => void;
  onCut: () => void;
  onCopy: () => void;
  onAction: (action: ExplorerAction) => void;
}) {
  return (
    <>
      <MenuButton onClick={onOpen}>Aç</MenuButton>
      {canManage ? (
        <>
          {item.itemType === "folder" ? (
            <MenuButton onClick={() => onAction("folder-create-child")}>Yeni Alt Klasör</MenuButton>
          ) : null}
          <MenuButton onClick={() => onAction(item.itemType === "folder" ? "folder-rename" : "document-rename")}>
            Yeniden Adlandır
          </MenuButton>
          <MenuButton onClick={onCut}>
            <span className="inline-flex items-center gap-2">
              <Scissors className="h-3.5 w-3.5" />
              Kes
            </span>
          </MenuButton>
          <MenuButton onClick={onCopy}>
            <span className="inline-flex items-center gap-2">
              <Copy className="h-3.5 w-3.5" />
              Kopyala
            </span>
          </MenuButton>
          <MenuButton onClick={() => onAction(item.itemType === "folder" ? "folder-move" : "document-move")}>
            Taşı
          </MenuButton>
          <MenuButton danger onClick={() => onAction(item.itemType === "folder" ? "folder-delete" : "document-delete")}>
            Sil
          </MenuButton>
        </>
      ) : null}
    </>
  );
}

function EmptyMenuItems({
  canManage,
  canPaste,
  hasCurrentFolder,
  onCreateFolder,
  onPaste,
  onRefresh
}: {
  canManage: boolean;
  canPaste: boolean;
  hasCurrentFolder: boolean;
  onCreateFolder: () => void;
  onPaste: () => void;
  onRefresh: () => void;
}) {
  return (
    <>
      <MenuButton disabled={!canManage || !hasCurrentFolder} onClick={onCreateFolder}>
        Yeni Klasör
      </MenuButton>
      <MenuButton disabled={!canPaste} onClick={onPaste}>
        Yapıştır
      </MenuButton>
      <MenuButton onClick={onRefresh}>Yenile</MenuButton>
    </>
  );
}

function ExplorerDialog({
  state,
  name,
  targetFolderId,
  folderOptions,
  isLoadingFolders,
  isSubmitting,
  onNameChange,
  onTargetFolderChange,
  onSubmit,
  onClose
}: {
  state: DialogState;
  name: string;
  targetFolderId: string;
  folderOptions: FolderOption[];
  isLoadingFolders: boolean;
  isSubmitting: boolean;
  onNameChange: (value: string) => void;
  onTargetFolderChange: (value: string) => void;
  onSubmit: () => void;
  onClose: () => void;
}) {
  const needsName = ["document-rename", "folder-create-child", "folder-create-root", "folder-rename"].includes(state.action);
  const needsFolder = ["document-move", "folder-move"].includes(state.action);
  const isDelete = ["document-delete", "folder-delete"].includes(state.action);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-zinc-950/50 px-4">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="explorer-dialog-title"
        className="w-full max-w-lg rounded-md border border-zinc-200 bg-white p-5 shadow-xl dark:border-zinc-800 dark:bg-zinc-900"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="explorer-dialog-title" className="text-base font-semibold text-zinc-950 dark:text-zinc-50">
              {getDialogTitle(state.action)}
            </h2>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{state.item.name}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-md border border-zinc-200 px-2 py-1 text-sm text-zinc-600 transition hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Kapat
          </button>
        </div>

        <div className="mt-5 space-y-4">
          {needsName ? (
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-200">
              {state.action === "folder-create-child" || state.action === "folder-create-root" ? "Yeni klasör adı" : "Yeni ad"}
              <input
                value={name}
                onChange={(event) => onNameChange(event.target.value)}
                className="mt-2 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-950 outline-none transition focus:border-brand-800 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
                placeholder="Ad girin"
              />
            </label>
          ) : null}

          {needsFolder ? (
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-200">
              Hedef klasör
              <select
                value={targetFolderId}
                onChange={(event) => onTargetFolderChange(event.target.value)}
                disabled={isLoadingFolders || folderOptions.length === 0}
                className="mt-2 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-950 outline-none transition focus:border-brand-800 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
              >
                {folderOptions.map((folder) => (
                  <option key={folder.id} value={folder.id}>
                    {"-".repeat(folder.depth)} {folder.path}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {isDelete ? (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200">
              Silinen belgeler Geri Dönüşüm Kutusu'na gider. Klasörler yalnızca boşsa silinir.
            </p>
          ) : null}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-md border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            Vazgeç
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={isSubmitting || (needsName && name.trim().length === 0) || (needsFolder && !targetFolderId)}
            className="rounded-md bg-brand-800 px-3 py-2 text-sm font-medium text-white transition hover:bg-brand-900 disabled:cursor-wait disabled:opacity-60"
          >
            {isSubmitting ? "İşleniyor..." : isDelete ? "Onayla" : "Kaydet"}
          </button>
        </div>
      </section>
    </div>
  );
}

function ToolbarButton({
  label,
  icon,
  primary = false,
  danger = false,
  disabled = false,
  onClick
}: {
  label: string;
  icon?: ReactNode;
  primary?: boolean;
  danger?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${
        primary
          ? "bg-brand-800 text-white hover:bg-brand-900"
          : danger
            ? "border border-red-200 text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/30"
            : "border border-zinc-200 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function SortableHeader({
  field,
  activeField,
  direction,
  onSort,
  children
}: {
  field: SortField;
  activeField: SortField;
  direction: SortDirection;
  onSort: (field: SortField) => void;
  children: ReactNode;
}) {
  const active = field === activeField;

  return (
    <th className="px-4 py-3">
      <button
        type="button"
        onClick={() => onSort(field)}
        className="inline-flex items-center gap-1 font-semibold transition hover:text-brand-800"
      >
        {children}
        <span aria-hidden="true" className="text-[10px]">
          {active ? (direction === "asc" ? "▲" : "▼") : "↕"}
        </span>
      </button>
    </th>
  );
}

function MenuButton({
  children,
  danger = false,
  disabled = false,
  onClick
}: {
  children: ReactNode;
  danger?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`block w-full rounded px-3 py-2 text-left transition disabled:cursor-not-allowed disabled:opacity-50 ${
        danger
          ? "text-red-700 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-950/30"
          : "text-zinc-700 hover:bg-zinc-50 dark:text-zinc-200 dark:hover:bg-zinc-800"
      }`}
    >
      {children}
    </button>
  );
}

async function loadAllFolderOptions() {
  const rootResponse = await getRootFolders();
  const options: FolderOption[] = [];

  for (const folder of rootResponse.data) {
    await collectFolderOptions(folder, 0, options);
  }

  return options;
}

async function collectFolderOptions(folder: FolderDto, depth: number, options: FolderOption[]) {
  options.push({
    id: folder.id,
    name: folder.name,
    path: folder.path,
    depth
  });

  const response = await getFolderChildren(folder.id);
  for (const child of response.data.folders) {
    await collectFolderOptions(child, depth + 1, options);
  }
}

function mapDocumentToItem(document: DocumentDto): DocumentItem {
  return {
    id: document.id,
    itemType: "document",
    name: document.name,
    size: formatSize(document.sizeBytes),
    date: formatDate(document.createdAt),
    documentType: document.documentType,
    department: document.responsibleDepartment?.name ?? "-",
    responsiblePerson: document.responsibleUser
      ? `${document.responsibleUser.firstName} ${document.responsibleUser.lastName}`
      : "-",
    validityDate: document.validUntil ? formatDate(document.validUntil) : "-",
    isFavorite: false,
    originalFileName: document.originalFileName,
    mimeType: document.mimeType,
    storageBucket: document.storageBucket,
    storageKey: document.storageKey,
  };
}

function sortExplorerItems(items: ExplorerItem[], field: SortField, direction: SortDirection) {
  const multiplier = direction === "asc" ? 1 : -1;

  return [...items].sort((first, second) => {
    if (first.itemType !== second.itemType) {
      return first.itemType === "folder" ? -1 : 1;
    }

    const firstValue = getSortValue(first, field);
    const secondValue = getSortValue(second, field);

    if (typeof firstValue === "number" && typeof secondValue === "number") {
      return (firstValue - secondValue) * multiplier;
    }

    return String(firstValue).localeCompare(String(secondValue), "tr-TR", { sensitivity: "base" }) * multiplier;
  });
}

function getSortValue(item: ExplorerItem, field: SortField) {
  if (field === "name") {
    return item.name;
  }

  if (field === "type") {
    return item.itemType === "folder" ? "Klasör" : getDocumentTypeLabel(item.document);
  }

  if (field === "size") {
    return item.itemType === "folder" ? 0 : Number(item.document.sizeBytes);
  }

  if (field === "owner") {
    return getOwnerLabel(item);
  }

  return new Date(item.updatedAt).getTime();
}

function getItemKey(item: ExplorerItem) {
  return `${item.itemType}:${item.id}`;
}

function getItemIcon(item: ExplorerItem) {
  if (item.itemType === "folder") {
    return FolderOpen;
  }

  const mimeType = item.document.mimeType.toLowerCase();
  const name = (item.document.originalFileName ?? item.document.name).toLowerCase();

  if (mimeType.includes("pdf") || name.endsWith(".pdf")) {
    return FileText;
  }

  if (mimeType.includes("word") || name.endsWith(".doc") || name.endsWith(".docx")) {
    return FileType2;
  }

  if (mimeType.includes("sheet") || name.endsWith(".xls") || name.endsWith(".xlsx")) {
    return FileSpreadsheet;
  }

  if (mimeType.includes("presentation") || name.endsWith(".ppt") || name.endsWith(".pptx")) {
    return Presentation;
  }

  if (mimeType.includes("image") || name.endsWith(".png") || name.endsWith(".jpg") || name.endsWith(".jpeg")) {
    return FileImage;
  }

  return FileQuestion;
}

function getDocumentTypeLabel(document: DocumentDto) {
  return getTypeLabel(document.documentType);
}

function getOwnerLabel(item: ExplorerItem) {
  if (item.itemType === "folder") {
    return item.folder.responsibleDepartment?.name ?? "-";
  }

  if (item.document.responsibleUser) {
    return `${item.document.responsibleUser.firstName} ${item.document.responsibleUser.lastName}`;
  }

  return item.document.responsibleDepartment?.name ?? "-";
}

function isEditableTarget(target: EventTarget) {
  const element = target as HTMLElement;

  return Boolean(element.closest("input, textarea, select, button, [contenteditable='true']"));
}

function getDialogTitle(action: ExplorerAction) {
  const labels: Record<ExplorerAction, string> = {
    "document-rename": "Dokümanı yeniden adlandır",
    "document-move": "Dokümanı taşı",
    "document-delete": "Dokümanı sil",
    "folder-create-child": "Yeni alt klasör oluştur",
    "folder-create-root": "Yeni ana klasör oluştur",
    "folder-rename": "Klasörü yeniden adlandır",
    "folder-move": "Klasörü taşı",
    "folder-delete": "Klasörü sil"
  };

  return labels[action];
}

function getSuccessMessage(action: ExplorerAction) {
  const labels: Record<ExplorerAction, string> = {
    "document-rename": "Doküman adı güncellendi.",
    "document-move": "Doküman hedef klasöre taşındı.",
    "document-delete": "Doküman listeden kaldırıldı.",
    "folder-create-child": "Alt klasör oluşturuldu.",
    "folder-create-root": "Ana klasör oluşturuldu.",
    "folder-rename": "Klasör adı güncellendi.",
    "folder-move": "Klasör hedef konuma taşındı.",
    "folder-delete": "Boş klasör silindi."
  };

  return labels[action];
}

function getExplorerErrorMessage(error: unknown) {
  if (error instanceof Error) {
    const messages: Record<string, string> = {
      "Klasör boş olmadan silinemez.": "Klasörü silmeden önce içeriğini boşaltın.",
      "Klasör kendi içine taşınamaz.": "Klasör kendi içine taşınamaz.",
      "Klasör kendi alt klasörüne taşınamaz.": "Klasör kendi alt klasörüne taşınamaz.",
      "Klasör kendi içine kopyalanamaz.": "Klasör kendi içine kopyalanamaz.",
      "Klasör kendi alt klasörüne kopyalanamaz.": "Klasör kendi alt klasörüne kopyalanamaz.",
      "Bu konumda aynı adda bir klasör var.": "Hedef klasörde aynı isimde klasör var.",
      "Bu klasörde aynı adda bir belge var.": "Hedef klasörde aynı isimde doküman var."
    };

    return messages[error.message] ?? error.message;
  }

  return "İşlem tamamlanamadı.";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("tr-TR").format(new Date(value));
}

function formatSize(value: string) {
  const size = Number(value);

  if (!Number.isFinite(size)) {
    return value;
  }

  if (size >= 1024 * 1024 * 1024) {
    return `${(size / 1024 / 1024 / 1024).toFixed(2)} GB`;
  }

  if (size >= 1024 * 1024) {
    return `${(size / 1024 / 1024).toFixed(2)} MB`;
  }

  if (size >= 1024) {
    return `${Math.round(size / 1024)} KB`;
  }

  return `${size} B`;
}
