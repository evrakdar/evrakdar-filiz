import {
  getDocumentById,
  getDocuments,
  getFolderBreadcrumb,
  getFolderChildren,
  getRootFolders
} from "@/lib/api";
import type { DocumentDetailDto, DocumentDto, FolderDto } from "@/lib/api";
import type {
  DashboardData,
  DocumentItem,
  FolderNavigationData,
  MainCategory,
  SubCategory
} from "./types";

// Placeholder until /auth/me answers; the shell replaces it with the signed-in user.
const fallbackUser = {
  firstName: "",
  lastName: "",
  title: "",
  department: ""
};

export async function getApiDashboardData(): Promise<DashboardData> {
  const [rootFoldersResponse, documentsResponse] = await Promise.all([
    getRootFolders(),
    getDocuments({ limit: 20 })
  ]);

  const mainCategories = await Promise.all(
    rootFoldersResponse.data.map(async (folder) => {
      const childrenResponse = await getFolderChildren(folder.id);

      return mapFolderToMainCategory(folder, childrenResponse.data.folders);
    })
  );

  const documents = documentsResponse.data.map(mapDocumentToItem);

  return {
    source: "api",
    currentUser: fallbackUser,
    mainCategories,
    documents,
    favorites: documents.filter((document) => document.isFavorite).slice(0, 3),
    frequentlyUsed: mainCategories.slice(0, 4).map((category) => category.title)
  };
}

export const apiSource = {
  getDashboardData: getApiDashboardData
};

export async function getApiFolderNavigation(folderId: string): Promise<FolderNavigationData> {
  const [childrenResponse, breadcrumbResponse] = await Promise.all([
    getFolderChildren(folderId),
    getFolderBreadcrumb(folderId)
  ]);

  return {
    subCategories: childrenResponse.data.folders.map(mapFolderToSubCategory),
    documents: [
      ...childrenResponse.data.folders.map(mapFolderToDocumentItem),
      ...childrenResponse.data.documents.map(mapDocumentToItem)
    ],
    breadcrumb: breadcrumbResponse.data.map((item) => ({
      id: item.id,
      title: item.name,
      path: item.path
    }))
  };
}

export async function getApiDocumentDetail(documentId: string): Promise<DocumentItem> {
  const documentResponse = await getDocumentById(documentId);

  return mapDocumentDetailToItem(documentResponse.data);
}

function mapFolderToMainCategory(folder: FolderDto, children: FolderDto[]): MainCategory {
  return {
    id: folder.id,
    title: folder.name,
    description: folder.path,
    count: children.length,
    subCategories: children.map(mapFolderToSubCategory)
  };
}

function mapFolderToSubCategory(folder: FolderDto): SubCategory {
  return {
    id: folder.id,
    title: folder.name,
    description: folder.path
  };
}

function mapDocumentToItem(document: DocumentDto): DocumentItem {
  return {
    id: document.id,
    itemType: "document",
    name: document.name,
    size: document.storageBucket === "metadata-only" ? "Kağıt belge" : formatSize(document.sizeBytes),
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

function mapFolderToDocumentItem(folder: FolderDto): DocumentItem {
  return {
    id: folder.id,
    itemType: "folder",
    name: folder.name,
    size: "Klasör",
    date: formatDate(folder.createdAt),
    documentType: "Klasör",
    department: folder.responsibleDepartment?.name ?? "-",
    responsiblePerson: folder.createdBy ? `${folder.createdBy.firstName} ${folder.createdBy.lastName}` : "-",
    validityDate: formatDate(folder.updatedAt),
    isFavorite: false
  };
}

function mapDocumentDetailToItem(document: DocumentDetailDto): DocumentItem {
  return mapDocumentToItem(document);
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
