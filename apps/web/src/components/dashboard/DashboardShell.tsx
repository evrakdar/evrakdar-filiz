"use client";

import { APP_NAME, APP_TAGLINE, ORG_NAME } from "@/lib/brand";
import { ProductCredit } from "@/lib/product-credit";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  addFavorite,
  createFolder,
  deleteDocument,
  deleteFolder,
  getDepartments,
  getDocuments,
  getExpiredDocuments,
  getExpiringSoonDocuments,
  getFavorites,
  getFolderChildren,
  getRootFolders,
  getMe,
  getMyRecentDocuments,
  getRecentDocumentList,
  removeFavorite,
  updateDocument,
  updateFolder,
  type AuthUserDto,
  type DepartmentDto,
  type DocumentDto,
  type FolderDto
} from "@/lib/api";
import {
  clearStoredAuth,
  getStoredToken,
  getStoredUser,
  setStoredAuth
} from "@/lib/api/auth-storage";
import { getRoleLabel, hasAnyRole } from "@/lib/auth/roles";
import { getInitialDashboardData, type DashboardData, type DocumentItem } from "@/lib/data-source";
import type { UserProfile } from "@/lib/mock-data";
import { loadDocumentDetailAction } from "@/lib/data-source/actions";
import { AdminDashboardPanel } from "./AdminDashboardPanel";
import { ChangePasswordDialog } from "./ChangePasswordDialog";
import { AdminDepartmentsPanel } from "./AdminDepartmentsPanel";
import { AdminUsersPanel } from "./AdminUsersPanel";
import { DocumentEntryPanel } from "./DocumentEntryPanel";
import { FileExplorerPanel } from "./FileExplorerPanel";
import { DashboardHome, type DashboardListView } from "./DashboardHome";
import type { RowManagementAction } from "./DocumentTable";
import { AdminRolesInfoPanel } from "./AdminRolesInfoPanel";
import { FullEditionPage } from "./full-edition/FullEditionPage";
import { Header } from "./Header";
import { emptySearchFilters, type SearchFilters } from "./FiltersBar";
import { PreviewPanel } from "./PreviewPanel";
import { TrashPanel } from "./TrashPanel";
import {
  isFullEditionPage,
  Sidebar,
  sidebarMenuLabels,
  unsupportedSidebarMenuKeys,
  type SidebarMenuKey
} from "./Sidebar";

type DashboardShellProps = {
  initialData?: DashboardData;
};

type ManagementDialogState = {
  item: DocumentItem;
  action: RowManagementAction;
};

type FolderOption = {
  id: string;
  name: string;
  path: string;
  depth: number;
};

export function DashboardShell({ initialData }: DashboardShellProps) {
  const router = useRouter();
  const dashboardData = initialData ?? getInitialDashboardData();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<DocumentItem | null>(null);
  const [authUser, setAuthUser] = useState<AuthUserDto | null>(() => getStoredUser());
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [favoriteDocuments, setFavoriteDocuments] = useState<DocumentItem[] | null>(null);
  const [pendingFavoriteIds, setPendingFavoriteIds] = useState<Set<string>>(new Set());
  const [favoriteError, setFavoriteError] = useState<string | null>(null);
  const [activeSidebarMenuKey, setActiveSidebarMenuKey] = useState<SidebarMenuKey | null>(null);
  const [listView, setListView] = useState<DashboardListView | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [searchFilters, setSearchFilters] = useState<SearchFilters>(emptySearchFilters);
  const [departments, setDepartments] = useState<DepartmentDto[]>([]);
  const [globalSearchView, setGlobalSearchView] = useState<DashboardListView | null>(null);
  const [homeFolder, setHomeFolder] = useState<{ id: string; name: string } | null>(null);
  const [explorerFolder, setExplorerFolder] = useState<{ id: string; name: string } | null>(null);
  const [homeResetKey, setHomeResetKey] = useState(0);
  const [managementRefreshKey, setManagementRefreshKey] = useState(0);
  const [managementDialog, setManagementDialog] = useState<ManagementDialogState | null>(null);
  const [managementName, setManagementName] = useState("");
  const [managementTargetFolderId, setManagementTargetFolderId] = useState("");
  const [managementFolderOptions, setManagementFolderOptions] = useState<FolderOption[]>([]);
  const [isLoadingManagementFolders, setIsLoadingManagementFolders] = useState(false);
  const [isSubmittingManagementAction, setIsSubmittingManagementAction] = useState(false);
  const [managementMessage, setManagementMessage] = useState<string | null>(null);
  const [managementError, setManagementError] = useState<string | null>(null);
  const [documentEntryInitialFolder, setDocumentEntryInitialFolder] = useState<FolderDto | null>(null);

  useEffect(() => {
    const token = getStoredToken();
    let isActive = true;

    if (!token) {
      clearStoredAuth();
      router.replace("/");
      return;
    }

    const activeToken = token;

    async function verifySession() {
      try {
        const response = await getMe(activeToken);

        if (!isActive) {
          return;
        }

        setAuthUser(response.data);
        setStoredAuth({
          accessToken: activeToken,
          user: response.data
        });

        if (dashboardData.source === "api") {
          await loadFavorites(activeToken);
        }

        if (isActive) {
          setIsCheckingSession(false);
        }

        // A shared link (?documentId=...) opens that document's panel.
        const sharedDocumentId = new URLSearchParams(window.location.search).get("documentId");

        if (sharedDocumentId && dashboardData.source === "api") {
          loadDocumentDetailAction(sharedDocumentId)
            .then((detail) => {
              if (isActive) {
                setSelectedDocument(detail);
              }
            })
            .catch(() => undefined);
        }
      } catch {
        if (!isActive) {
          return;
        }

        clearStoredAuth();
        router.replace("/");
      }
    }

    async function loadFavorites(activeToken: string) {
      try {
        const response = await getFavorites(activeToken);

        if (!isActive) {
          return;
        }

        const documents = response.data.map((document) => mapApiDocumentToItem(document, true));
        setFavoriteDocuments(documents);
        setFavoriteIds(new Set(documents.map((document) => document.id)));
        setFavoriteError(null);
      } catch {
        if (!isActive) {
          return;
        }

        setFavoriteDocuments([]);
        setFavoriteIds(new Set());
        setFavoriteError("Favoriler yüklenemedi.");
      }
    }

    verifySession();

    return () => {
      isActive = false;
    };
  }, [dashboardData.source, router]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 350);

    return () => window.clearTimeout(timeout);
  }, [searchQuery]);

  useEffect(() => {
    let isActive = true;

    async function loadDepartments() {
      if (dashboardData.source !== "api") {
        setDepartments([]);
        return;
      }

      try {
        const response = await getDepartments();

        if (isActive) {
          setDepartments(response.data);
        }
      } catch {
        if (isActive) {
          setDepartments([]);
        }
      }
    }

    loadDepartments();

    return () => {
      isActive = false;
    };
  }, [dashboardData.source]);

  const showFilters = isDocumentScreen(activeSidebarMenuKey);
  const scope = getFilterScope(activeSidebarMenuKey, homeFolder, explorerFolder);
  const scopeLabel = scope.label;
  const scopeFolderId = scope.underFolderId;
  const scopeList = scope.listScope;

  useEffect(() => {
    let isActive = true;
    const trimmedQuery = debouncedSearchQuery.trim();
    // A chosen filter is enough on its own, nobody has to type something to use it.
    const hasActiveFilter = showFilters && Object.values(searchFilters).some(Boolean);

    if (dashboardData.source !== "api" || (!trimmedQuery && !hasActiveFilter)) {
      setGlobalSearchView(null);
      return;
    }

    // The search box looks through everything. Filters alone stay where the person is looking.
    const title = trimmedQuery ? "Tüm sistemde arama sonuçları" : scopeLabel ? `${scopeLabel} içinde süzülen belgeler` : "Süzülen belgeler";
    const subject = trimmedQuery ? `"${trimmedQuery}" için` : "Seçilen filtreler için";
    const activeFilters = hasActiveFilter ? searchFilters : emptySearchFilters;
    const eyebrow = trimmedQuery ? "Arama" : "Filtreler";

    setGlobalSearchView({
      eyebrow,
      title,
      description: `${subject} sonuçlar listeleniyor.`,
      documents: [],
      status: "loading"
    });

    async function searchDocuments() {
      try {
        const response = await getDocuments({
          q: trimmedQuery || undefined,
          underFolderId: trimmedQuery ? undefined : scopeFolderId,
          listScope: trimmedQuery ? undefined : scopeList,
          documentType: activeFilters.documentType || undefined,
          fileType: activeFilters.fileType || undefined,
          departmentId: activeFilters.departmentId || undefined,
          validUntilFrom: activeFilters.validUntilFrom || undefined,
          validUntilTo: activeFilters.validUntilTo || undefined,
          ...getSizeFilterParams(activeFilters.size),
          page: 1,
          limit: 100
        });

        if (!isActive) {
          return;
        }

        const total = response.meta.total;

        setGlobalSearchView({
          eyebrow,
          title,
          description: `${subject} ${total.toLocaleString("tr-TR")} sonuç bulundu.${total > 100 ? " İlk 100 gösteriliyor." : ""}`,
          documents: response.data.map((document) => mapApiDocumentToItem(document, favoriteIds.has(document.id))),
          status: "ready",
          message: response.data.length === 0 ? "Sonuç bulunamadı." : undefined
        });
      } catch {
        if (!isActive) {
          return;
        }

        setGlobalSearchView({
          eyebrow,
          title,
          description: `${subject} arama yapılamadı.`,
          documents: [],
          status: "error",
          message: "Arama sonuçları yüklenemedi."
        });
      }
    }

    searchDocuments();

    return () => {
      isActive = false;
    };
  }, [dashboardData.source, debouncedSearchQuery, favoriteIds, scopeFolderId, scopeLabel, scopeList, searchFilters, showFilters]);

  const currentUser = useMemo(
    () => (authUser ? mapAuthUserToProfile(authUser) : dashboardData.currentUser),
    [authUser, dashboardData.currentUser]
  );
  const canCreateDocuments = authUser ? hasDocumentEntryAccess(authUser.roles) : false;
  const canManageItems = authUser ? hasDocumentManagementAccess(authUser.roles) : false;
  const canOpenAdminDashboard = authUser ? hasAdminDashboardAccess(authUser.roles) : false;
  const canOpenAdminUsers = authUser ? hasAdminUsersAccess(authUser.roles) : false;
  const isAdminDashboardOpen = activeSidebarMenuKey === "admin-dashboard" && canOpenAdminDashboard;
  const isAdminUsersOpen = activeSidebarMenuKey === "admin-users" && canOpenAdminUsers;
  const isRolesInfoOpen = activeSidebarMenuKey === "admin-roles-info" && canOpenAdminUsers;
  const fullEditionPage = canOpenAdminUsers && activeSidebarMenuKey && isFullEditionPage(activeSidebarMenuKey) ? activeSidebarMenuKey : null;
  const isAdminDepartmentsOpen = activeSidebarMenuKey === "admin-departments" && canOpenAdminUsers;
  const isFileExplorerOpen = activeSidebarMenuKey === "file-explorer";
  const isTrashOpen = activeSidebarMenuKey === "trash";
  const isDocumentEntryOpen = activeSidebarMenuKey === "data-entry" && canCreateDocuments;

  async function handleSelectDocument(document: DocumentItem) {
    if (document.itemType === "folder") {
      setSelectedDocument(null);
      return;
    }

    if (dashboardData.source !== "api") {
      setSelectedDocument(document);
      return;
    }

    try {
      const detail = await loadDocumentDetailAction(document.id);
      setSelectedDocument(detail);
    } catch {
      setSelectedDocument(document);
    }
  }

  async function handleDocumentChanged(documentId: string) {
    try {
      setSelectedDocument(await loadDocumentDetailAction(documentId));
    } catch {
      setSelectedDocument(null);
    }

    setManagementRefreshKey((value) => value + 1);

    if (
      activeSidebarMenuKey &&
      !isAdminDashboardOpen &&
      !isAdminUsersOpen &&
      !isAdminDepartmentsOpen &&
      !isFileExplorerOpen &&
      !isTrashOpen &&
      !isDocumentEntryOpen
    ) {
      await refreshActiveListView(activeSidebarMenuKey);
    }
  }

  async function handleToggleFavorite(document: DocumentItem) {
    if (dashboardData.source !== "api" || document.itemType === "folder") {
      return;
    }

    const token = getStoredToken();

    if (!token) {
      return;
    }

    const wasFavorite = favoriteIds.has(document.id);
    const previousIds = favoriteIds;
    const previousDocuments = favoriteDocuments;
    const nextIds = new Set(favoriteIds);
    const nextDocuments = favoriteDocuments ? [...favoriteDocuments] : [];

    if (wasFavorite) {
      nextIds.delete(document.id);
      setFavoriteDocuments(nextDocuments.filter((favorite) => favorite.id !== document.id));
    } else {
      nextIds.add(document.id);

      if (!nextDocuments.some((favorite) => favorite.id === document.id)) {
        setFavoriteDocuments([document, ...nextDocuments]);
      }
    }

    setFavoriteIds(nextIds);
    setFavoriteError(null);
    setPendingFavoriteIds((current) => new Set(current).add(document.id));

    try {
      if (wasFavorite) {
        await removeFavorite(document.id, token);
      } else {
        await addFavorite(document.id, token);
      }
    } catch {
      setFavoriteIds(previousIds);
      setFavoriteDocuments(previousDocuments);
      setFavoriteError("Favori durumu kaydedilemedi.");
    } finally {
      setPendingFavoriteIds((current) => {
        const next = new Set(current);
        next.delete(document.id);
        return next;
      });
    }
  }

  async function handleOpenManagementDialog(item: DocumentItem, action: RowManagementAction) {
    if (!canManageItems || dashboardData.source !== "api") {
      return;
    }

    setManagementDialog({ item, action });
    setManagementName(action === "folder-create-child" ? "" : item.name);
    setManagementTargetFolderId("");
    setManagementMessage(null);
    setManagementError(null);

    if (action === "document-move" || action === "folder-move") {
      await loadManagementFolderOptions(item);
    } else {
      setManagementFolderOptions([]);
    }
  }

  function closeManagementDialog() {
    if (isSubmittingManagementAction) {
      return;
    }

    setManagementDialog(null);
    setManagementMessage(null);
    setManagementError(null);
    setManagementFolderOptions([]);
    setManagementTargetFolderId("");
    setManagementName("");
  }

  async function handleBulkDeleteItems(items: DocumentItem[]) {
    if (!canManageItems || dashboardData.source !== "api") {
      throw new Error("Bu işlem için yetkiniz yok.");
    }

    const token = getStoredToken();

    if (!token) {
      throw new Error("Oturum bulunamadı. Lütfen yeniden giriş yapın.");
    }

    const itemIds = new Set(items.map((item) => item.id));

    for (const item of items) {
      if (item.itemType === "folder") {
        await deleteFolder(item.id, token);
      } else {
        await deleteDocument(item.id, token);
      }
    }

    setSelectedDocument((current) => (current && itemIds.has(current.id) ? null : current));

    if (globalSearchView) {
      setGlobalSearchView({
        ...globalSearchView,
        documents: globalSearchView.documents.filter((document) => !itemIds.has(document.id))
      });
    }

    setManagementRefreshKey((value) => value + 1);

    if (
      activeSidebarMenuKey &&
      !isAdminDashboardOpen &&
      !isAdminUsersOpen &&
      !isAdminDepartmentsOpen &&
      !isFileExplorerOpen &&
      !isTrashOpen &&
      !isDocumentEntryOpen
    ) {
      await refreshActiveListView(activeSidebarMenuKey);
    }
  }

  async function loadManagementFolderOptions(item: DocumentItem) {
    setIsLoadingManagementFolders(true);

    try {
      const options = await loadAllFolderOptions();
      const currentFolderOption = options.find((option) => option.id === item.id);
      const filteredOptions =
        item.itemType === "folder" && currentFolderOption
          ? options.filter(
              (option) => option.id !== item.id && !option.path.startsWith(`${currentFolderOption.path}/`)
            )
          : options;

      setManagementFolderOptions(filteredOptions);
      setManagementTargetFolderId(filteredOptions[0]?.id ?? "");
    } catch {
      setManagementFolderOptions([]);
      setManagementError("Klasör seçenekleri yüklenemedi.");
    } finally {
      setIsLoadingManagementFolders(false);
    }
  }

  async function handleSubmitManagementAction() {
    if (!managementDialog) {
      return;
    }

    const token = getStoredToken();

    if (!token) {
      setManagementError("Oturum bulunamad?. L?tfen yeniden giri? yap?n.");
      return;
    }

    setIsSubmittingManagementAction(true);
    setManagementMessage(null);
    setManagementError(null);

    try {
      const { item, action } = managementDialog;
      const name = managementName.trim();

      if (action === "document-rename") {
        await updateDocument(item.id, { name }, token);
      } else if (action === "document-move") {
        await updateDocument(item.id, { folderId: managementTargetFolderId }, token);
      } else if (action === "document-delete") {
        await deleteDocument(item.id, token);
      } else if (action === "folder-create-child") {
        await createFolder({ name, parentId: item.id }, token);
      } else if (action === "folder-rename") {
        await updateFolder(item.id, { name }, token);
      } else if (action === "folder-move") {
        await updateFolder(item.id, { parentId: managementTargetFolderId }, token);
      } else if (action === "folder-delete") {
        await deleteFolder(item.id, token);
      }

      setManagementMessage(getManagementSuccessMessage(action));
      setSelectedDocument((current) => (current?.id === item.id ? null : current));
      if (globalSearchView && item.itemType === "document") {
        setGlobalSearchView({
          ...globalSearchView,
          documents:
            action === "document-delete"
              ? globalSearchView.documents.filter((document) => document.id !== item.id)
              : globalSearchView.documents.map((document) =>
                  document.id === item.id && action === "document-rename"
                    ? { ...document, name: managementName.trim() }
                    : document
                )
        });
      }
      setManagementRefreshKey((value) => value + 1);

      if (
        activeSidebarMenuKey &&
        !isAdminDashboardOpen &&
        !isAdminUsersOpen &&
        !isAdminDepartmentsOpen &&
        !isFileExplorerOpen &&
        !isTrashOpen &&
        !isDocumentEntryOpen
      ) {
        await refreshActiveListView(activeSidebarMenuKey);
      }
    } catch (error) {
      setManagementError(getManagementErrorMessage(error));
    } finally {
      setIsSubmittingManagementAction(false);
    }
  }

  async function refreshActiveListView(key: SidebarMenuKey) {
    if (dashboardData.source !== "api" || unsupportedSidebarMenuKeys.includes(key)) {
      return;
    }

    try {
      const response = await loadSidebarDocuments(key);
      setListView({
        title: sidebarMenuLabels[key],
        description: getListDescription(key),
        documents: response.data.map((document) => mapApiDocumentToItem(document, favoriteIds.has(document.id))),
        status: "ready",
        message: "Liste g?ncellendi."
      });
    } catch {
      setListView((current) =>
        current
          ? {
              ...current,
              status: "error",
              message: "Liste yenilenemedi."
            }
          : current
      );
    }
  }

  async function handleSelectSidebarMenu(key: SidebarMenuKey) {
    setActiveSidebarMenuKey(key);
    setSelectedDocument(null);
    setDocumentEntryInitialFolder(null);
    // A search belongs to the moment it was typed in. Filters follow the person only between document screens.
    setSearchQuery("");
    setDebouncedSearchQuery("");
    setGlobalSearchView(null);

    if (!isDocumentScreen(key)) {
      setSearchFilters(emptySearchFilters);
    }

    if (key === "admin-dashboard") {
      if (!canOpenAdminDashboard) {
        setListView({
          title: sidebarMenuLabels[key],
          description: "Bu ekran için yetkiniz yok.",
          documents: [],
          status: "unavailable",
          message: "Bu ekran için yetkiniz yok."
        });
        return;
      }

      setListView(null);
      return;
    }

    if (key === "admin-departments") {
      if (!canOpenAdminUsers) {
        setListView({
          title: sidebarMenuLabels[key],
          description: "Bu ekran için yetkiniz yok.",
          documents: [],
          status: "unavailable",
          message: "Bu ekran için yetkiniz yok."
        });
        return;
      }

      setListView(null);
      return;
    }

    if (key === "admin-roles-info" || isFullEditionPage(key)) {
      setListView(
        canOpenAdminUsers
          ? null
          : {
              title: sidebarMenuLabels[key],
              description: "Bu ekran için yetkiniz yok.",
              documents: [],
              status: "unavailable",
              message: "Bu ekran için yetkiniz yok."
            }
      );
      return;
    }

    if (key === "admin-users") {
      if (!canOpenAdminUsers) {
        setListView({
          title: sidebarMenuLabels[key],
          description: "Bu ekran için yetkiniz yok.",
          documents: [],
          status: "unavailable",
          message: "Bu ekran için yetkiniz yok."
        });
        return;
      }

      setListView(null);
      return;
    }

    if (key === "file-explorer") {
      setListView(null);
      return;
    }

    if (key === "trash") {
      setListView(null);
      return;
    }

    if (key === "data-entry") {
      if (!canCreateDocuments) {
        setListView({
          title: sidebarMenuLabels[key],
          description: "Belge eklemek için ek yetki gerekir.",
          documents: [],
          status: "unavailable",
          message: "Bu işlem için yetkiniz yok."
        });
        return;
      }

      setListView(null);
      return;
    }

    if (unsupportedSidebarMenuKeys.includes(key)) {
      setListView({
        title: sidebarMenuLabels[key],
        description: "Bu alan bu pakette yok.",
        documents: [],
        status: "unavailable",
        message: "Bu bölüm bu pakette yok."
      });
      return;
    }

    setListView({
      title: sidebarMenuLabels[key],
      description: getListDescription(key),
      documents: dashboardData.source === "api" ? [] : getMockListDocuments(key, dashboardData),
      status: dashboardData.source === "api" ? "loading" : "ready"
    });

    if (dashboardData.source !== "api") {
      return;
    }

    try {
      const response = await loadSidebarDocuments(key);
      setListView({
        title: sidebarMenuLabels[key],
        description: getListDescription(key),
        documents: response.data.map((document) => mapApiDocumentToItem(document, favoriteIds.has(document.id))),
        status: "ready"
      });
    } catch {
      if (key === "my-recent" || key === "recent" || key === "expiring" || key === "expired") {
        setListView({
          title: sidebarMenuLabels[key],
          description: getListDescription(key),
          documents: [],
          status: "error",
          message:
            key === "my-recent"
              ? "Son eklediğiniz dokümanlar yüklenemedi."
              : key === "recent"
                ? "Son eklenen dokümanlar yüklenemedi."
                : key === "expired"
                  ? "Süresi geçen dokümanlar yüklenemedi."
                  : "Tarihi geçecek dokümanlar yüklenemedi."
        });
        return;
      }

      setListView({
        title: sidebarMenuLabels[key],
        description: getListDescription(key),
        documents: [],
        status: "unavailable",
        message: "Liste yüklenemedi. Lütfen yeniden deneyin."
      });
    }
  }

  function handleShowHome() {
    setActiveSidebarMenuKey(null);
    setListView(null);
    setSelectedDocument(null);
    setSearchQuery("");
    setDebouncedSearchQuery("");
    setGlobalSearchView(null);
    setSearchFilters(emptySearchFilters);
    setHomeResetKey((value) => value + 1);
  }

  function handleSearchQueryChange(value: string) {
    setSearchQuery(value);
    setSelectedDocument(null);
  }

  function handleLogout() {
    setAuthUser(null);
    setSelectedDocument(null);
    setFavoriteDocuments(null);
    setFavoriteIds(new Set());
    clearStoredAuth();
    router.replace("/");
  }

  async function handleDocumentEntryCreated(document: DocumentItem) {
    setSelectedDocument(null);
    setDocumentEntryInitialFolder(null);
    setActiveSidebarMenuKey("recent");
    setListView({
      title: sidebarMenuLabels.recent,
      description: getListDescription("recent"),
      documents: [],
      status: dashboardData.source === "api" ? "loading" : "ready",
      message: dashboardData.source === "api" ? undefined : "Doküman kaydı oluşturuldu."
    });

    if (dashboardData.source !== "api") {
      setListView({
        title: sidebarMenuLabels.recent,
        description: getListDescription("recent"),
        documents: [document],
        status: "ready",
        message: "Doküman kaydı oluşturuldu."
      });
      return;
    }

    try {
      const response = await loadSidebarDocuments("recent");
      setListView({
        title: sidebarMenuLabels.recent,
        description: getListDescription("recent"),
        documents: response.data.map((item) => mapApiDocumentToItem(item, favoriteIds.has(item.id))),
        status: "ready",
        message: "Doküman kaydı oluşturuldu ve liste yenilendi."
      });
    } catch {
      setListView({
        title: sidebarMenuLabels.recent,
        description: getListDescription("recent"),
        documents: [],
        status: "error",
        message: `Doküman kaydı oluşturuldu ancak liste yenilenemedi: ${document.name}`
      });
    }
  }

  function handleUploadToExplorerFolder(folder: FolderDto) {
    setSelectedDocument(null);
    setListView(null);
    setGlobalSearchView(null);
    setSearchQuery("");
    setDebouncedSearchQuery("");
    setDocumentEntryInitialFolder(folder);
    setActiveSidebarMenuKey("data-entry");
  }

  async function loadSidebarDocuments(key: SidebarMenuKey) {
    if (key === "my-recent") {
      const token = getStoredToken();

      if (!token) {
        throw new Error("Oturum bulunamadı. Lütfen yeniden giriş yapın.");
      }

      return getMyRecentDocuments(token, { page: 1, limit: 20 });
    }

    const token = getStoredToken();

    if (!token) {
      throw new Error("Oturum bulunamadı. Lütfen yeniden giriş yapın.");
    }

    if (key === "recent") {
      return getRecentDocumentList(token, { page: 1, limit: 20 });
    }

    if (key === "expired") {
      return getExpiredDocuments(token, { page: 1, limit: 20 });
    }

    return getExpiringSoonDocuments(token, { page: 1, limit: 20 });
  }

  if (isCheckingSession) {
    return (
      <main className="grid min-h-screen place-items-center bg-zinc-100 text-sm text-zinc-500 dark:bg-zinc-950 dark:text-zinc-400">
        Oturum doğrulanıyor...
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-100 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50">
      <div className="flex min-h-screen">
        <Sidebar
          user={currentUser}
          roles={authUser?.roles ?? []}
          collapsed={sidebarCollapsed}
          activeMenuKey={activeSidebarMenuKey}
          onToggle={() => setSidebarCollapsed((value) => !value)}
          onLogout={handleLogout}
          onChangePassword={() => setIsPasswordDialogOpen(true)}
          onSelectMenuItem={handleSelectSidebarMenu}
          mobileOpen={isMobileMenuOpen}
          onMobileClose={() => setIsMobileMenuOpen(false)}
        />
        <div className="flex min-w-0 flex-1">
          <div className="flex min-w-0 flex-1 flex-col">
            <Header
              searchQuery={searchQuery}
              filters={searchFilters}
              showFilters={showFilters}
              departments={departments}
              onSearchQueryChange={handleSearchQueryChange}
              onFiltersChange={setSearchFilters}
              onShowHome={handleShowHome}
              onLogout={handleLogout}
              onOpenMenu={() => setIsMobileMenuOpen(true)}
            />
            {authUser?.mustChangePassword ? (
              <div
                role="alert"
                data-password-banner
                className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-200 bg-amber-50 px-6 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
              >
                <span>Hazır ya da geçici bir şifre kullanıyorsunuz. Sistemi ağa açmadan önce şifrenizi değiştirin.</span>
                <button
                  type="button"
                  onClick={() => setIsPasswordDialogOpen(true)}
                  className="rounded-md bg-amber-700 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-amber-800"
                >
                  Şifrenizi değiştirin
                </button>
              </div>
            ) : null}
            {passwordMessage ? (
              <div className="border-b border-emerald-200 bg-emerald-50 px-6 py-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
                {passwordMessage}
              </div>
            ) : null}
            {isPasswordDialogOpen ? (
              <ChangePasswordDialog
                onClose={() => setIsPasswordDialogOpen(false)}
                onChanged={(user) => {
                  setAuthUser(user);
                  setIsPasswordDialogOpen(false);
                  setPasswordMessage("Şifreniz değiştirildi.");
                }}
              />
            ) : null}
            <main className="flex-1 overflow-x-hidden px-4 py-4 lg:px-6 lg:py-6">
              {isFileExplorerOpen ? (
                <div hidden={Boolean(globalSearchView)}>
                <FileExplorerPanel
                  token={getStoredToken()}
                  canManage={dashboardData.source === "api" && canManageItems}
                  canManageTopLevel={Boolean(authUser?.roles.includes("ADMIN"))}
                  onSelectDocument={handleSelectDocument}
                  onClearSelectedDocument={() => setSelectedDocument(null)}
                  onUploadToFolder={handleUploadToExplorerFolder}
                  onFolderChange={setExplorerFolder}
                />
                </div>
              ) : null}
              {!globalSearchView && isAdminDashboardOpen ? (
                <AdminDashboardPanel token={getStoredToken()} />
              ) : !globalSearchView && isRolesInfoOpen ? (
                <AdminRolesInfoPanel />
              ) : !globalSearchView && fullEditionPage ? (
                <FullEditionPage page={fullEditionPage} />
              ) : !globalSearchView && isAdminUsersOpen ? (
                <AdminUsersPanel token={getStoredToken()} currentUserId={authUser?.id} onOpenRoles={() => void handleSelectSidebarMenu("admin-roles-info")} />
              ) : !globalSearchView && isAdminDepartmentsOpen ? (
                <AdminDepartmentsPanel token={getStoredToken()} onChanged={setDepartments} />
              ) : isFileExplorerOpen && !globalSearchView ? null : !globalSearchView && isTrashOpen ? (
                <TrashPanel token={getStoredToken()} canManage={dashboardData.source === "api" && canManageItems} />
              ) : !globalSearchView && isDocumentEntryOpen ? (
                <DocumentEntryPanel
                  data={dashboardData}
                  token={getStoredToken()}
                  initialFolder={documentEntryInitialFolder}
                  onCancel={handleShowHome}
                  onCreated={handleDocumentEntryCreated}
                />
              ) : (
                <DashboardHome
                  data={dashboardData}
                  selectedDocument={selectedDocument}
                  onSelectDocument={handleSelectDocument}
                  onClearSelectedDocument={() => setSelectedDocument(null)}
                  listView={globalSearchView ?? listView}
                  onShowHome={handleShowHome}
                  onFolderChange={setHomeFolder}
                  searchQuery={globalSearchView ? "" : searchQuery}
                  favoriteDocuments={dashboardData.source === "api" ? favoriteDocuments ?? [] : undefined}
                  favoriteIds={dashboardData.source === "api" ? favoriteIds : undefined}
                  pendingFavoriteIds={dashboardData.source === "api" ? pendingFavoriteIds : undefined}
                  favoriteError={dashboardData.source === "api" ? favoriteError : null}
                  onToggleFavorite={dashboardData.source === "api" ? handleToggleFavorite : undefined}
                  homeResetKey={homeResetKey}
                  refreshKey={managementRefreshKey}
                  canManageItems={dashboardData.source === "api" && canManageItems}
                  onManageItem={handleOpenManagementDialog}
                  onBulkDeleteItems={handleBulkDeleteItems}
                />
              )}
            </main>
            <footer className="border-t border-zinc-200 bg-white px-6 py-3 text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
              <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1">
                <span>{APP_NAME} {APP_TAGLINE} · {ORG_NAME}</span>
                <ProductCredit />
              </div>
            </footer>
          </div>
          {selectedDocument ? (
            <PreviewPanel
              document={selectedDocument}
              onClose={() => setSelectedDocument(null)}
              onDocumentChanged={handleDocumentChanged}
            />
          ) : null}
        </div>
      </div>
      {managementDialog ? (
        <ManagementDialog
          state={managementDialog}
          name={managementName}
          targetFolderId={managementTargetFolderId}
          folderOptions={managementFolderOptions}
          isLoadingFolders={isLoadingManagementFolders}
          isSubmitting={isSubmittingManagementAction}
          message={managementMessage}
          error={managementError}
          onNameChange={setManagementName}
          onTargetFolderChange={setManagementTargetFolderId}
          onSubmit={handleSubmitManagementAction}
          onClose={closeManagementDialog}
        />
      ) : null}
    </div>
  );
}

function ManagementDialog({
  state,
  name,
  targetFolderId,
  folderOptions,
  isLoadingFolders,
  isSubmitting,
  message,
  error,
  onNameChange,
  onTargetFolderChange,
  onSubmit,
  onClose
}: {
  state: ManagementDialogState;
  name: string;
  targetFolderId: string;
  folderOptions: FolderOption[];
  isLoadingFolders: boolean;
  isSubmitting: boolean;
  message: string | null;
  error: string | null;
  onNameChange: (value: string) => void;
  onTargetFolderChange: (value: string) => void;
  onSubmit: () => void;
  onClose: () => void;
}) {
  const needsName = ["document-rename", "folder-create-child", "folder-rename"].includes(state.action);
  const needsFolder = ["document-move", "folder-move"].includes(state.action);
  const isDelete = ["document-delete", "folder-delete"].includes(state.action);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-zinc-950/50 px-4">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="management-dialog-title"
        className="w-full max-w-lg rounded-md border border-zinc-200 bg-white p-5 shadow-xl dark:border-zinc-800 dark:bg-zinc-900"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="management-dialog-title" className="text-base font-semibold text-zinc-950 dark:text-zinc-50">
              {getManagementTitle(state.action)}
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
              {state.action === "folder-create-child" ? "Yeni klasör adı" : "Yeni ad"}
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
              {isLoadingFolders ? <span className="mt-2 block text-xs text-zinc-500">Klasörler yükleniyor...</span> : null}
            </label>
          ) : null}

          {isDelete ? (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200">
              Bu işlem geri yüklenebilir altyapıyı koruyacak şekilde uygulanır. Klasör silme sadece boş klasörlerde
              çalışır.
            </p>
          ) : null}

          {message ? (
            <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">
              {message}
            </p>
          ) : null}
          {error ? (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200">
              {error}
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
            Vazge?
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={isSubmitting || (needsFolder && !targetFolderId)}
            className="rounded-md bg-brand-800 px-3 py-2 text-sm font-medium text-white transition hover:bg-brand-900 disabled:cursor-wait disabled:opacity-60"
          >
            {isSubmitting ? "İşleniyor..." : isDelete ? "Onayla" : "Kaydet"}
          </button>
        </div>
      </section>
    </div>
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

  const childrenResponse = await getFolderChildren(folder.id);

  for (const child of childrenResponse.data.folders) {
    await collectFolderOptions(child, depth + 1, options);
  }
}

function getManagementTitle(action: RowManagementAction) {
  const labels: Record<RowManagementAction, string> = {
    "document-rename": "Dokümanı yeniden adlandır",
    "document-move": "Dokümanı taşı",
    "document-delete": "Dokümanı sil",
    "folder-create-child": "Yeni alt klasör oluştur",
    "folder-rename": "Klasörü yeniden adlandır",
    "folder-move": "Klasörü taşı",
    "folder-delete": "Klasörü sil"
  };

  return labels[action];
}

function getManagementSuccessMessage(action: RowManagementAction) {
  const labels: Record<RowManagementAction, string> = {
    "document-rename": "Doküman adı güncellendi.",
    "document-move": "Doküman hedef klasöre taşındı.",
    "document-delete": "Doküman listelerden kaldırıldı.",
    "folder-create-child": "Alt klasör oluşturuldu.",
    "folder-rename": "Klasör adı güncellendi.",
    "folder-move": "Klasör hedef konuma taşındı.",
    "folder-delete": "Boş klasör silindi."
  };

  return labels[action];
}

function getManagementErrorMessage(error: unknown) {
  if (error instanceof Error) {
    if (error.message === "Klasör boş olmadan silinemez.") {
      return "Klasörü silmeden önce alt klasör ve dokümanlarını taşımalısınız.";
    }

    if (error.message === "Bu konumda aynı adda bir klasör var.") {
      return "Hedef klasörde aynı isimde bir klasör zaten var.";
    }

    return error.message;
  }

  return "İşlem tamamlanamadı.";
}

function mapAuthUserToProfile(user: AuthUserDto): UserProfile {
  const department = user.department
    ? `${user.department.code} - ${user.department.name}`
    : "Birim bilgisi yok";
  const roleLabel = getRoleLabel(user.roles);

  return {
    firstName: user.firstName,
    lastName: user.lastName,
    title: roleLabel ? `${user.title ?? "Kullanıcı"} • ${roleLabel}` : user.title ?? "Kullanıcı",
    department
  };
}

function hasDocumentEntryAccess(roles: string[]) {
  return hasAnyRole(roles, ["ADMIN", "EDITOR"]);
}

function hasDocumentManagementAccess(roles: string[]) {
  return hasAnyRole(roles, ["ADMIN", "EDITOR"]);
}

function hasAdminDashboardAccess(roles: string[]) {
  return hasAnyRole(roles, ["ADMIN"]);
}

function hasAdminUsersAccess(roles: string[]) {
  return hasAnyRole(roles, ["ADMIN"]);
}

function getListDescription(key: SidebarMenuKey) {
  if (key === "my-recent") {
    return "Son eklediğiniz dokümanlar listeleniyor.";
  }

  if (key === "recent") {
    return "Sisteme son eklenen dokümanlar listeleniyor.";
  }

  if (key === "expiring") {
    return "Geçerlilik veya güncelleme tarihi yaklaşan dokümanlar listeleniyor.";
  }

  if (key === "expired") {
    return "Geçerlilik tarihi geçmiş dokümanlar listeleniyor. Yenileyin ya da bilgilerini güncelleyin.";
  }

  return "Bu liste bu pakette yok.";
}

function getMockListDocuments(key: SidebarMenuKey, data: DashboardData) {
  if (key === "my-recent") {
    return data.documents.slice(0, 6);
  }

  if (key === "recent") {
    return data.documents.slice(0, 8);
  }

  if (key === "expiring") {
    return data.documents.slice(0, 5);
  }

  return [];
}

function mapApiDocumentToItem(document: DocumentDto, isFavorite = false): DocumentItem {
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
    isFavorite,
    originalFileName: document.originalFileName,
    mimeType: document.mimeType,
    storageBucket: document.storageBucket,
    storageKey: document.storageKey,
  };
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("tr-TR").format(new Date(value));
}

function formatSize(value: string) {
  const size = Number(value);

  if (!Number.isFinite(size)) {
    return value;
  }

  if (size >= 1024 * 1024) {
    return `${(size / 1024 / 1024).toFixed(2)} MB`;
  }

  if (size >= 1024) {
    return `${Math.round(size / 1024)} KB`;
  }

  return `${size} B`;
}

function isDocumentScreen(key: SidebarMenuKey | null) {
  return (
    key === null || key === "file-explorer" || key === "my-recent" || key === "recent" || key === "expiring" || key === "expired"
  );
}

/** Where the person is looking, for the filters to stay inside. */
function getFilterScope(
  key: SidebarMenuKey | null,
  homeFolder: { id: string; name: string } | null,
  explorerFolder: { id: string; name: string } | null
): { label: string | null; underFolderId?: string; listScope?: string } {
  switch (key) {
    case "file-explorer":
      return explorerFolder ? { label: explorerFolder.name, underFolderId: explorerFolder.id } : { label: "Dosya ve Klasörler" };
    case "my-recent":
      return { label: "Son Eklediklerim", listScope: "mine" };
    case "recent":
      return { label: "Son Eklenenler" };
    case "expiring":
      return { label: "Tarihi Geçecek Olanlar", listScope: "expiring" };
    case "expired":
      return { label: "Süresi Geçenler", listScope: "expired" };
    default:
      return homeFolder ? { label: homeFolder.name, underFolderId: homeFolder.id } : { label: null };
  }
}

function getSizeFilterParams(sizeFilter: SearchFilters["size"]) {
  if (sizeFilter === "lt-1mb") {
    return { sizeMaxBytes: 1024 * 1024 - 1 };
  }

  if (sizeFilter === "1mb-3mb") {
    return {
      sizeMinBytes: 1024 * 1024 + 1,
      sizeMaxBytes: 3 * 1024 * 1024 - 1
    };
  }

  if (sizeFilter === "gt-5mb") {
    return { sizeMinBytes: 5 * 1024 * 1024 + 1 };
  }

  return {};
}
