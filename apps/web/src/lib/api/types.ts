import type {
  ApiResponse,
  BreadcrumbItemDto,
  DashboardSummaryDto,
  DepartmentDto,
  DocumentDetailDto,
  DocumentDto,
  DocumentVersionDto,
  DocumentSearchSizeFilterDto,
  DocumentTypeDto,
  FolderChildrenDto,
  FolderDto,
  PaginatedResponse,
  TrashDocumentDto,
  TrashFolderDto,
  TrashListDto
} from "@evrakdar/shared";

export type {
  ApiResponse,
  BreadcrumbItemDto,
  DashboardSummaryDto,
  DepartmentDto,
  DocumentDetailDto,
  DocumentDto,
  DocumentVersionDto,
  DocumentSearchSizeFilterDto,
  DocumentTypeDto,
  FolderChildrenDto,
  FolderDto,
  PaginatedResponse,
  TrashDocumentDto,
  TrashFolderDto,
  TrashListDto
};

export type ApiErrorPayload = {
  statusCode?: number;
  message?: string | string[];
  error?: string;
};

export type DocumentsQueryParams = {
  q?: string;
  folderId?: string;
  documentType?: DocumentTypeDto;
  fileType?: string;
  underFolderId?: string;
  listScope?: string;
  departmentId?: string;
  validUntilFrom?: string;
  validUntilTo?: string;
  sizeMinBytes?: number;
  sizeMaxBytes?: number;
  page?: number;
  limit?: number;
} & DocumentSearchSizeFilterDto;

export type CreateDocumentMetadataInput = {
  name: string;
  folderId: string;
  documentType: DocumentTypeDto;
  sizeLabel?: string;
  sizeBytes: number;
  responsibleDepartmentId: string;
  responsiblePersonId?: string;
  validUntil?: string;
  description?: string;
  accessLevel?: AccessLevelDto;
};

export type AccessLevelDto = "PUBLIC" | "DEPARTMENT" | "CONFIDENTIAL";

export type UpdateDocumentInput = {
  name?: string;
  folderId?: string;
  accessLevel?: AccessLevelDto;
  documentType?: DocumentTypeDto;
  validUntil?: string | null;
  responsibleDepartmentId?: string;
  responsiblePersonId?: string;
  description?: string | null;
};

export type ResponsibleOptionDto = {
  id: string;
  name: string;
  department: string | null;
};

export type CopyDocumentInput = {
  folderId: string;
  name?: string;
};

export type CreateFolderInput = {
  name: string;
  parentId?: string;
};

export type UpdateFolderInput = {
  name?: string;
  parentId?: string;
};

export type CopyFolderInput = {
  parentId: string;
  name?: string;
};
