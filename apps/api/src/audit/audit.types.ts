import type { AuthenticatedRequest } from "../auth/auth.types";

export type AuditAction =
  | "LOGIN"
  | "LOGOUT"
  | "DOCUMENT_CREATE"
  | "DOCUMENT_METADATA_CREATE"
  | "DOCUMENT_UPLOAD"
  | "DOCUMENT_VERSION_UPLOAD"
  | "DOCUMENT_DOWNLOAD"
  | "DOCUMENT_PREVIEW"
  | "DOCUMENT_SHARE"
  | "DOCUMENT_UPDATE"
  | "DOCUMENT_RENAME"
  | "DOCUMENT_MOVE"
  | "DOCUMENT_COPY"
  | "DOCUMENT_SOFT_DELETE"
  | "DOCUMENT_RESTORE"
  | "DOCUMENT_PERMANENT_DELETE"
  | "FOLDER_CREATE"
  | "FOLDER_RENAME"
  | "FOLDER_MOVE"
  | "FOLDER_COPY"
  | "FOLDER_DELETE"
  | "FOLDER_RESTORE"
  | "FOLDER_PERMANENT_DELETE"
  | "FAVORITE_ADD"
  | "FAVORITE_REMOVE"
  | "DEPARTMENT_CHANGE"
  | "ADMIN_USER_CREATE"
  | "ADMIN_USER_UPDATE"
  | "ADMIN_USER_ROLE_UPDATE"
  | "ADMIN_USER_DEACTIVATE"
  | "ADMIN_USER_ACTIVATE"
  | "ADMIN_USER_REMOVE"
  | "OCR_COMPLETED"
  | "OCR_FAILED"
  | "APPROVAL_EVENT";

export type AuditEntityType =
  | "AUTH"
  | "DOCUMENT"
  | "DOCUMENT_VERSION"
  | "FOLDER"
  | "FAVORITE"
  | "USER"
  | "DEPARTMENT"
  | "OCR"
  | "SEARCH"
  | "APPROVAL";

export type AuditRequestContext = {
  userId?: string | null;
  username?: string | null;
  roles?: string[];
  departmentId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
};

export type AuditLogInput = {
  action: AuditAction;
  entityType: AuditEntityType;
  entityId?: string | null;
  entityName?: string | null;
  description?: string | null;
  success?: boolean;
  durationMs?: number | null;
  metadata?: Record<string, unknown> | null;
  context?: AuditRequestContext | null;
};

export function getAuditContext(request: AuthenticatedRequest | undefined): AuditRequestContext {
  const headers = request?.headers ?? {};

  return {
    userId: request?.user?.sub ?? null,
    username: request?.user?.username ?? null,
    roles: request?.user?.roles ?? [],
    departmentId: request?.user?.departmentId ?? null,
    // request.ip honours the TRUST_PROXY setting in main.ts; raw forwarding headers are spoofable.
    ip: request?.ip ?? request?.socket?.remoteAddress ?? null,
    userAgent: getHeaderValue(headers["user-agent"]) ?? null
  };
}

function getHeaderValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}
