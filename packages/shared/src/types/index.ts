export type ISODateString = string;

export type ApiResponse<T> = {
  data: T;
};

export type PaginatedResponse<T> = ApiResponse<T[]> & {
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export type DepartmentDto = {
  id: string;
  name: string;
  code: string;
  createdAt: ISODateString;
  updatedAt: ISODateString;
};

export type UserSummaryDto = {
  id: string;
  firstName: string;
  lastName: string;
  title: string | null;
  email: string;
};

export type FolderDto = {
  id: string;
  name: string;
  parentId: string | null;
  path: string;
  level: number;
  responsibleDepartment: DepartmentDto | null;
  createdBy: UserSummaryDto | null;
  createdAt: ISODateString;
  updatedAt: ISODateString;
};

export type DocumentTypeDto =
  | "REPORT"
  | "PRESENTATION"
  | "GUIDE"
  | "FORM"
  | "MINUTES"
  | "OTHER";

export type DocumentSearchSizeFilterDto = {
  sizeMinBytes?: number;
  sizeMaxBytes?: number;
};

export type AccessLevelDto = "PUBLIC" | "DEPARTMENT" | "CONFIDENTIAL";

export type DocumentDto = {
  id: string;
  folderId: string;
  name: string;
  originalFileName: string;
  mimeType: string;
  sizeBytes: string;
  documentType: DocumentTypeDto;
  validUntil: ISODateString | null;
  revisionNo: string;
  accessLevel: AccessLevelDto;
  tags: unknown;
  storageBucket: string;
  storageKey: string;
  responsibleDepartment: DepartmentDto | null;
  responsibleUser: UserSummaryDto | null;
  createdBy: UserSummaryDto | null;
  folder: {
    id: string;
    name: string;
    path: string;
  } | null;
  createdAt: ISODateString;
  updatedAt: ISODateString;
};

export type DocumentDetailDto = DocumentDto;

export type DocumentVersionDto = {
  id: string;
  documentId: string;
  versionNo: string;
  originalFileName: string | null;
  sizeBytes: string;
  createdBy: UserSummaryDto | null;
  createdAt: ISODateString;
  isActive: boolean;
};

export type TrashDocumentDto = DocumentDto & {
  itemType: "document";
  deletedAt: ISODateString;
  deletedBy: UserSummaryDto | null;
};

export type TrashFolderDto = FolderDto & {
  itemType: "folder";
  deletedAt: ISODateString;
  deletedBy: UserSummaryDto | null;
};

export type TrashListDto = {
  documents: TrashDocumentDto[];
  folders: TrashFolderDto[];
};

export type BreadcrumbItemDto = {
  id: string;
  name: string;
  path: string;
};

export type FolderChildrenDto = {
  folders: FolderDto[];
  documents: DocumentDto[];
};

export type DashboardSummaryDto = {
  totalDocuments: number;
  totalFolders: number;
  expiringDocuments: number;
};
