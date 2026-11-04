"use client";

import { useEffect, useMemo, useState } from "react";
import { FolderOpen, Star } from "lucide-react";
import type {
  DashboardData,
  DocumentItem,
  FolderBreadcrumbItem,
  FolderNavigationData,
  MainCategory,
  SubCategory
} from "@/lib/data-source";
import { loadFolderNavigationAction } from "@/lib/data-source/actions";
import { CategoryCards } from "./CategoryCards";
import { DocumentTable, type RowManagementAction } from "./DocumentTable";

type DashboardHomeProps = {
  data: DashboardData;
  selectedDocument: DocumentItem | null;
  onSelectDocument: (document: DocumentItem) => void;
  onClearSelectedDocument?: () => void;
  listView?: DashboardListView | null;
  onShowHome?: () => void;
  searchQuery?: string;
  favoriteDocuments?: DocumentItem[];
  favoriteIds?: Set<string>;
  pendingFavoriteIds?: Set<string>;
  favoriteError?: string | null;
  onToggleFavorite?: (document: DocumentItem) => void;
  homeResetKey?: number;
  refreshKey?: number;
  canManageItems?: boolean;
  onManageItem?: (document: DocumentItem, action: RowManagementAction) => void;
  onBulkDeleteItems?: (documents: DocumentItem[]) => Promise<void>;
  /** Reports the open category or folder, so that filters can stay inside it. */
  onFolderChange?: (folder: { id: string; name: string } | null) => void;
};

export type DashboardListView = {
  eyebrow?: string;
  title: string;
  description: string;
  documents: DocumentItem[];
  status: "loading" | "ready" | "error" | "unavailable";
  message?: string;
};

export function DashboardHome({
  data,
  selectedDocument,
  onSelectDocument,
  onClearSelectedDocument,
  listView,
  onShowHome,
  searchQuery = "",
  favoriteDocuments,
  favoriteIds,
  pendingFavoriteIds,
  favoriteError,
  onToggleFavorite,
  homeResetKey = 0,
  refreshKey = 0,
  canManageItems = false,
  onManageItem,
  onBulkDeleteItems,
  onFolderChange
}: DashboardHomeProps) {
  const [selectedCategory, setSelectedCategory] = useState<MainCategory | null>(null);
  const [selectedSubCategory, setSelectedSubCategory] = useState<SubCategory | null>(null);
  const [activeBreadcrumb, setActiveBreadcrumb] = useState<FolderBreadcrumbItem[]>([]);
  const [currentSubCategories, setCurrentSubCategories] = useState<SubCategory[] | null>(null);
  const [folderDocuments, setFolderDocuments] = useState<DocumentItem[] | null>(null);
  const [isLoadingFolder, setIsLoadingFolder] = useState(false);
  const [folderError, setFolderError] = useState<string | null>(null);
  const isApiMode = data.source === "api";
  const openFolder = activeBreadcrumb[activeBreadcrumb.length - 1];
  const openFolderId = openFolder?.id;
  const openFolderTitle = openFolder?.title;

  useEffect(() => {
    onFolderChange?.(openFolderId ? { id: openFolderId, name: openFolderTitle ?? "" } : null);
  }, [onFolderChange, openFolderId, openFolderTitle]);

  useEffect(() => {
    setSelectedCategory(null);
    setSelectedSubCategory(null);
    setActiveBreadcrumb([]);
    setCurrentSubCategories(null);
    setFolderDocuments(null);
    setFolderError(null);
    setIsLoadingFolder(false);
  }, [homeResetKey]);

  useEffect(() => {
    const currentFolderId = activeBreadcrumb[activeBreadcrumb.length - 1]?.id;

    if (!refreshKey || !isApiMode || listView || !currentFolderId) {
      return;
    }

    void loadFolderChildren(currentFolderId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  const visibleSubCategories = useMemo(
    () => currentSubCategories ?? selectedCategory?.subCategories ?? [],
    [currentSubCategories, selectedCategory?.subCategories]
  );

  const visibleDocuments = useMemo(() => {
    if (isApiMode) {
      return folderDocuments ?? [];
    }

    if (!selectedCategory || !selectedSubCategory) {
      return [];
    }

    return data.documents;
  }, [data.documents, folderDocuments, isApiMode, selectedCategory, selectedSubCategory]);

  const displayedCategories = useMemo(
    () =>
      data.mainCategories.map((category) =>
        category.id === selectedCategory?.id ? { ...category, subCategories: visibleSubCategories } : category
      ),
    [data.mainCategories, selectedCategory?.id, visibleSubCategories]
  );
  const highlightedSubCategoryId = visibleSubCategories.some(
    (subCategory) => subCategory.id === selectedSubCategory?.id
  )
    ? selectedSubCategory?.id ?? null
    : null;
  const displayedFavorites = favoriteDocuments ?? data.favorites;
  const filteredVisibleDocuments = useMemo(
    () => filterDocuments(visibleDocuments, searchQuery),
    [searchQuery, visibleDocuments]
  );
  const filteredListViewDocuments = useMemo(
    () => (listView ? filterDocuments(listView.documents, searchQuery) : []),
    [listView, searchQuery]
  );
  const shouldShowTable =
    selectedCategory !== null &&
    !isLoadingFolder &&
    !folderError &&
    (filteredVisibleDocuments.length > 0 || (isApiMode && (selectedSubCategory !== null || visibleSubCategories.length === 0)));

  if (listView) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-medium text-brand-800 dark:text-brand-300">{listView.eyebrow ?? "Sol menü"}</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">{listView.title}</h1>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">{listView.description}</p>
          </div>
          <button
            onClick={onShowHome}
            className="w-fit rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            Ana Sayfa
          </button>
        </div>

        {listView.message && listView.status === "ready" && filteredListViewDocuments.length > 0 ? (
          <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
            {listView.message}
          </p>
        ) : null}

        {listView.status === "loading" ? (
          <EmptyState title="Liste yükleniyor" description="Dokümanlar hazırlanıyor." />
        ) : listView.status === "unavailable" ? (
          <EmptyState
            title={listView.title}
            description={listView.message ?? "Bu bölüm bu pakette yok."}
          />
        ) : listView.status === "error" ? (
          <EmptyState title="Liste yüklenemedi" description={listView.message ?? "Sunucudan yanıt alınamadı."} />
        ) : filteredListViewDocuments.length > 0 ? (
          <DocumentTable
            documents={filteredListViewDocuments}
            selectedDocumentId={selectedDocument?.id}
            onSelectDocument={onSelectDocument}
            favoriteIds={favoriteIds}
            pendingFavoriteIds={pendingFavoriteIds}
            onToggleFavorite={onToggleFavorite}
            canManage={canManageItems}
            onManageItem={onManageItem}
            onBulkDeleteItems={onBulkDeleteItems}
          />
        ) : (
          <EmptyState title="Doküman bulunamadı" description={listView.message ?? "Bu listede doküman yok."} />
        )}
      </div>
    );
  }

  async function handleSelectCategory(category: MainCategory) {
    onClearSelectedDocument?.();
    setSelectedCategory(category);
    setSelectedSubCategory(isApiMode ? null : category.subCategories[0] ?? null);
    setActiveBreadcrumb([{ id: category.id, title: category.title, path: category.description }]);
    setCurrentSubCategories(category.subCategories);
    setFolderDocuments(null);
    setFolderError(null);

    if (!isApiMode) {
      return;
    }

    await loadFolderChildren(category.id);
  }

  async function handleSelectSubCategory(subCategory: SubCategory) {
    onClearSelectedDocument?.();
    setSelectedSubCategory(subCategory);
    setActiveBreadcrumb((current) => {
      const root =
        current[0] ??
        (selectedCategory
          ? { id: selectedCategory.id, title: selectedCategory.title, path: selectedCategory.description }
          : null);

      return root
        ? [root, { id: subCategory.id, title: subCategory.title, path: subCategory.description }]
        : [{ id: subCategory.id, title: subCategory.title, path: subCategory.description }];
    });
    setFolderDocuments(null);

    if (!isApiMode) {
      return;
    }

    await loadFolderChildren(subCategory.id);
  }

  async function loadFolderChildren(folderId: string) {
    setIsLoadingFolder(true);
    setFolderError(null);

    try {
      const nextFolder = await loadFolderNavigationAction(folderId);
      applyFolderNavigation(nextFolder);
    } catch {
      setFolderError("Klasör içeriği yüklenemedi. Lütfen yeniden deneyin.");
    } finally {
      setIsLoadingFolder(false);
    }
  }

  function applyFolderNavigation(nextFolder: FolderNavigationData) {
    const rootFolder = nextFolder.breadcrumb[0];
    const currentFolder = nextFolder.breadcrumb[nextFolder.breadcrumb.length - 1];
    const rootCategory = data.mainCategories.find((category) => category.id === rootFolder?.id) ?? null;

    setSelectedCategory(rootCategory);
    setSelectedSubCategory(
      currentFolder && currentFolder.id !== rootFolder?.id
        ? {
            id: currentFolder.id,
            title: currentFolder.title,
            description: currentFolder.path ?? currentFolder.title
          }
        : null
    );
    setCurrentSubCategories(nextFolder.subCategories);
    setFolderDocuments(nextFolder.documents);
    setActiveBreadcrumb(nextFolder.breadcrumb);
  }

  function handleBreadcrumbRootClick() {
    onClearSelectedDocument?.();
    setSelectedCategory(null);
    setSelectedSubCategory(null);
    setActiveBreadcrumb([]);
    setCurrentSubCategories(null);
    setFolderDocuments(null);
    setFolderError(null);
  }

  async function handleBreadcrumbFolderClick(folder: FolderBreadcrumbItem, index: number) {
    onClearSelectedDocument?.();

    if (!isApiMode) {
      const rootFolder = activeBreadcrumb[0];
      const rootCategory = data.mainCategories.find((category) => category.id === rootFolder?.id) ?? null;

      setSelectedCategory(rootCategory);
      setSelectedSubCategory(
        index > 0
          ? {
              id: folder.id,
              title: folder.title,
              description: folder.path ?? folder.title
            }
          : null
      );
      setActiveBreadcrumb(activeBreadcrumb.slice(0, index + 1));
      setFolderDocuments(index > 0 ? data.documents : null);
      return;
    }

    await loadFolderChildren(folder.id);
  }

  async function handleSelectTableItem(document: DocumentItem) {
    if (document.itemType !== "folder") {
      onSelectDocument(document);
      return;
    }

    onClearSelectedDocument?.();
    setFolderDocuments(null);

    if (isApiMode) {
      await loadFolderChildren(document.id);
      return;
    }

    setSelectedSubCategory({
      id: document.id,
      title: document.name,
      description: document.name
    });
    setActiveBreadcrumb((current) => [...current, { id: document.id, title: document.name }]);
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-brand-800 dark:text-brand-300">Anasayfa</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
          Kurumsal doküman merkezi
        </h1>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          Favoriler, sık kullanılan klasörler ve kategori bazlı doküman listeleri gösteriliyor.
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-md border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mb-4 flex items-center gap-2">
            <Star className="h-4 w-4 fill-brand-800 text-brand-800 dark:text-brand-300" />
            <h2 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">Favoriler</h2>
          </div>
          <div className="grid max-h-[22rem] gap-2 overflow-y-auto pr-1">
            {displayedFavorites.length > 0 ? (
              displayedFavorites.map((document) => (
                <button
                  key={document.id}
                  onClick={() => onSelectDocument(document)}
                  className="rounded-md border border-zinc-100 px-3 py-2 text-left text-sm text-zinc-700 transition hover:border-brand-800 hover:bg-brand-50 dark:border-zinc-800 dark:text-zinc-200 dark:hover:bg-brand-950/30"
                >
                  {document.name}
                </button>
              ))
            ) : (
              <p className="rounded-md border border-dashed border-zinc-200 px-3 py-2 text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                Henüz favori doküman yok.
              </p>
            )}
            {favoriteError ? <p className="text-xs text-brand-700">{favoriteError}</p> : null}
          </div>
        </section>

        <section className="rounded-md border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mb-4 flex items-center gap-2">
            <FolderOpen className="h-4 w-4 text-brand-800 dark:text-brand-300" />
            <h2 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">Sık Kullanılanlar</h2>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {data.frequentlyUsed.map((item) => (
              <button
                key={item}
                onClick={() => {
                  const category = data.mainCategories.find((candidate) => candidate.title === item);

                  if (category) {
                    void handleSelectCategory(category);
                  }
                }}
                className="rounded-md border border-zinc-100 px-3 py-2 text-left text-sm text-zinc-700 transition hover:border-brand-800 hover:bg-brand-50 dark:border-zinc-800 dark:text-zinc-200 dark:hover:bg-brand-950/30"
              >
                {item}
              </button>
            ))}
          </div>
        </section>
      </div>

      <CategoryCards
        categories={displayedCategories}
        selectedCategoryId={selectedCategory?.id ?? null}
        selectedSubCategoryId={highlightedSubCategoryId}
        onSelectCategory={handleSelectCategory}
        onSelectSubCategory={handleSelectSubCategory}
      />

      {selectedCategory ? (
        <BreadcrumbBar
          breadcrumb={activeBreadcrumb}
          onRootClick={handleBreadcrumbRootClick}
          onFolderClick={handleBreadcrumbFolderClick}
        />
      ) : null}

      {!selectedCategory ? (
        <EmptyState
          title="Ana kategori seçilmedi"
          description="Dokümanları listelemek için önce ana menü kartlarından birini seç."
        />
      ) : isLoadingFolder ? (
        <EmptyState
          title="Klasör içeriği yükleniyor"
          description="Alt klasörler ve belgeler yükleniyor."
        />
      ) : folderError ? (
        <EmptyState title="İçerik yüklenemedi" description={folderError} />
      ) : !isApiMode && !selectedSubCategory ? (
        <EmptyState
          title="Alt kategori seçilmedi"
          description="Klasör ve dosyaları görmek için seçili ana kategori altından bir alt kategori seç."
        />
      ) : isApiMode && !selectedSubCategory && visibleDocuments.length === 0 && visibleSubCategories.length > 0 ? (
        <EmptyState
          title="Alt klasör seçilmedi"
          description="Bu ana kategori altındaki klasörlerden birini seçerek dosyaları listeleyebilirsiniz."
        />
      ) : shouldShowTable ? (
        <DocumentTable
          documents={filteredVisibleDocuments}
          selectedDocumentId={selectedDocument?.id}
          onSelectDocument={handleSelectTableItem}
          favoriteIds={favoriteIds}
          pendingFavoriteIds={pendingFavoriteIds}
          onToggleFavorite={onToggleFavorite}
          canManage={canManageItems}
          onManageItem={onManageItem}
          onBulkDeleteItems={onBulkDeleteItems}
        />
      ) : (
        <EmptyState
          title="Bu klasör boş"
          description="Seçili klasör altında gösterilecek alt klasör veya doküman bulunamadı."
        />
      )}
    </div>
  );
}

function filterDocuments(documents: DocumentItem[], searchQuery: string) {
  const normalizedQuery = searchQuery.trim().toLocaleLowerCase("tr-TR");

  if (!normalizedQuery) {
    return documents;
  }

  return documents.filter((document) =>
    [document.name, document.documentType, document.department, document.responsiblePerson]
      .join(" ")
      .toLocaleLowerCase("tr-TR")
      .includes(normalizedQuery)
  );
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <section className="grid min-h-56 place-items-center rounded-md border border-dashed border-zinc-300 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
      <div>
        <FolderOpen className="mx-auto h-8 w-8 text-zinc-400" />
        <h3 className="mt-4 text-sm font-semibold text-zinc-900 dark:text-zinc-50">{title}</h3>
        <p className="mt-2 max-w-md text-sm text-zinc-500 dark:text-zinc-400">{description}</p>
      </div>
    </section>
  );
}

function BreadcrumbBar({
  breadcrumb,
  onRootClick,
  onFolderClick
}: {
  breadcrumb: FolderBreadcrumbItem[];
  onRootClick: () => void;
  onFolderClick: (folder: FolderBreadcrumbItem, index: number) => void;
}) {
  return (
    <nav
      aria-label="Kategori yolu"
      className="flex flex-wrap items-center gap-2 rounded-md border border-zinc-200 bg-white px-4 py-3 text-sm dark:border-zinc-800 dark:bg-zinc-900"
    >
      <span className="font-medium text-zinc-500 dark:text-zinc-400">Konum:</span>
      <button
        onClick={onRootClick}
        className="font-medium text-brand-800 dark:text-brand-300 transition hover:text-brand-900 hover:underline"
      >
        Ana dizin
      </button>
      {breadcrumb.map((folder, index) => (
        <span key={folder.id} className="flex items-center gap-2">
          <span className="text-zinc-400">/</span>
          <button
            onClick={() => onFolderClick(folder, index)}
            className="font-medium text-brand-800 dark:text-brand-300 transition hover:text-brand-900 hover:underline"
          >
            {folder.title}
          </button>
        </span>
      ))}
    </nav>
  );
}
