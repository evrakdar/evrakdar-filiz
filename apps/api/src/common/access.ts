import { AccessLevel, Prisma } from "@prisma/client";
import type { AuditRequestContext } from "../audit/audit.types";
import type { JwtPayload } from "../auth/auth.types";

/**
 * Document visibility rules.
 *
 * - PUBLIC and DEPARTMENT: visible to every signed-in user of the institution.
 *   (DEPARTMENT is the historical default; per-department isolation can be enabled later.)
 * - CONFIDENTIAL: visible only to admins, the creator, the responsible person and
 *   members of the responsible department.
 */
export type DocumentViewer = Pick<JwtPayload, "sub" | "roles" | "departmentId"> | null | undefined;

/** The signed-in person behind a request context. Missing context means no special access. */
export function viewerFromContext(context: AuditRequestContext | null | undefined): DocumentViewer {
  return context?.userId
    ? { sub: context.userId, roles: context.roles ?? [], departmentId: context.departmentId ?? null }
    : null;
}

export function isAdmin(viewer: DocumentViewer) {
  return Boolean(viewer?.roles?.includes("ADMIN"));
}

export function documentAccessWhere(viewer: DocumentViewer): Prisma.DocumentWhereInput {
  if (isAdmin(viewer)) {
    return {};
  }

  const allowed: Prisma.DocumentWhereInput[] = [{ accessLevel: { not: AccessLevel.CONFIDENTIAL } }];

  if (viewer?.sub) {
    allowed.push({ createdById: viewer.sub }, { responsibleUserId: viewer.sub });
  }

  if (viewer?.departmentId) {
    allowed.push({ responsibleDepartmentId: viewer.departmentId });
  }

  return { OR: allowed };
}

export function canViewDocument(
  viewer: DocumentViewer,
  document: {
    accessLevel: AccessLevel;
    createdById: string | null;
    responsibleUserId: string | null;
    responsibleDepartmentId: string | null;
  }
) {
  if (document.accessLevel !== AccessLevel.CONFIDENTIAL || isAdmin(viewer)) {
    return true;
  }

  if (!viewer?.sub) {
    return false;
  }

  return (
    document.createdById === viewer.sub ||
    document.responsibleUserId === viewer.sub ||
    (Boolean(viewer.departmentId) && document.responsibleDepartmentId === viewer.departmentId)
  );
}

export function withDocumentAccess(
  where: Prisma.DocumentWhereInput,
  viewer: DocumentViewer
): Prisma.DocumentWhereInput {
  const access = documentAccessWhere(viewer);

  if (Object.keys(access).length === 0) {
    return where;
  }

  const existingAnd = Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : [];

  return {
    ...where,
    AND: [...existingAnd, access]
  };
}

export function parseAccessLevel(value: unknown): AccessLevel | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  if (typeof value === "string" && (Object.values(AccessLevel) as string[]).includes(value)) {
    return value as AccessLevel;
  }

  return undefined;
}
