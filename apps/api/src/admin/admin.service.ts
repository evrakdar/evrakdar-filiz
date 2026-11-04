import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { hash } from "bcryptjs";
import { randomBytes } from "node:crypto";
import { AuditService } from "../audit/audit.service";
import type { AuditRequestContext } from "../audit/audit.types";
import { assertStrongPassword } from "../common/password-rules";
import { parsePagination } from "../common/query";
import { ok, paginated } from "../common/responses";
import { PrismaService } from "../prisma/prisma.service";
import type {
  AdminUsersQuery,
  CreateAdminUserDto,
  SuggestAccountDto,
  UpdateAdminUserDto,
  UpdateAdminUserRolesDto
} from "./admin.controller";
import { formatTitleCase, nameParts } from "../common/names";

type FolderSummary = {
  id: string;
  name: string;
  parentId: string | null;
};

type DocumentSummary = {
  folderId: string;
  name: string;
  originalFileName: string;
  mimeType: string;
  sizeBytes: bigint;
  storageBucket: string;
};

const rolePriority = ["ADMIN", "EDITOR", "VIEWER"] as const;
const allowedUserRoles = new Set<string>(rolePriority);

const adminUserInclude = {
  department: true,
  roles: {
    include: {
      role: true
    }
  }
};

const mimeTypeFallbacks: Record<string, string> = {
  "application/pdf": "PDF",
  "application/msword": "DOC",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "DOCX",
  "application/vnd.ms-excel": "XLS",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "XLSX",
  "application/vnd.ms-powerpoint": "PPT",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "PPTX",
  "image/jpeg": "JPG",
  "image/png": "PNG",
  "text/plain": "TXT"
};

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService
  ) {}

  async getDashboardSummary() {
    const [folders, documents, users, storage] = await Promise.all([
      this.prisma.folder.findMany({
        where: { deletedAt: null },
        select: {
          id: true,
          name: true,
          parentId: true
        }
      }),
      this.prisma.document.findMany({
        where: { deletedAt: null },
        select: {
          folderId: true,
          name: true,
          originalFileName: true,
          mimeType: true,
          sizeBytes: true,
          storageBucket: true
        }
      }),
      this.prisma.user.findMany({
        where: { deletedAt: null },
        select: {
          id: true,
          roles: {
            select: {
              role: {
                select: {
                  name: true
                }
              }
            }
          }
        }
      }),
      // Every stored file: old versions and the recycle bin take up room as well.
      this.prisma.documentVersion.aggregate({
        where: { storageBucket: { not: "metadata-only" } },
        _sum: { sizeBytes: true }
      })
    ]);

    return ok({
      categoryDocumentCounts: buildCategoryDocumentCounts(folders, documents),
      userRoleCounts: buildUserRoleCounts(users),
      fileTypeStats: buildFileTypeStats(documents),
      totalStorageBytes: Number(storage._sum.sizeBytes ?? 0n)
    });
  }

  async findUsers(query: AdminUsersQuery) {
    const pagination = parsePagination(query.page, query.limit);
    const where = buildUserWhere(query);

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        include: adminUserInclude,
        orderBy: [{ createdAt: "desc" }],
        skip: pagination.skip,
        take: pagination.limit
      }),
      this.prisma.user.count({ where })
    ]);

    return paginated(users.map(mapAdminUser), {
      page: pagination.page,
      limit: pagination.limit,
      total,
      totalPages: Math.ceil(total / pagination.limit)
    });
  }

  async findUserById(id: string) {
    const user = await this.findExistingUser(id);

    return ok(mapAdminUser(user));
  }

  /** A free username for a new person. The person adding them can still change it. */
  async suggestAccount(body: SuggestAccountDto) {
    const parts = [...nameParts(body.firstName ?? ""), ...nameParts(body.lastName ?? "")];

    if (parts.length === 0) {
      return ok({ username: "", email: null });
    }

    const base = parts.join(".");
    const department = body.departmentId
      ? await this.prisma.department.findUnique({ where: { id: body.departmentId }, select: { code: true } })
      : null;
    const code = department ? nameParts(department.code).join("") : "";
    const candidates = [base, ...(code ? [`${base}.${code}`] : [])];
    const username = await this.firstFreeUsername(candidates, base);

    return ok({ username, email: null });
  }

  private async firstFreeUsername(candidates: string[], base: string) {
    for (const candidate of candidates) {
      if (!(await this.prisma.user.findUnique({ where: { username: candidate }, select: { id: true } }))) {
        return candidate;
      }
    }

    for (let number = 2; ; number += 1) {
      const candidate = `${base}${number}`;

      if (!(await this.prisma.user.findUnique({ where: { username: candidate }, select: { id: true } }))) {
        return candidate;
      }
    }
  }

  async createUser(body: CreateAdminUserDto, auditContext?: AuditRequestContext) {
    const startedAt = Date.now();
    const firstName = formatTitleCase(parseRequiredString(body.firstName, "firstName"));
    const lastName = formatTitleCase(parseRequiredString(body.lastName, "lastName"));
    const username = parseRequiredString(body.username, "username");
    const email = parseEmail(body.email);
    const password = parseOptionalPassword(body.password);
    const roleName = parseRequiredString(body.role, "role");

    if (!password) {
      throw new BadRequestException("Şifre girin.");
    }

    validateRoleName(roleName);

    const role = await this.prisma.role.findUnique({ where: { name: roleName } });

    if (!role) {
      throw new BadRequestException("Seçilen rol geçersiz.");
    }

    const departmentId = await this.parseDepartmentId(body.departmentId);

    try {
      const createdUser = await this.prisma.user.create({
        data: {
          firstName,
          lastName,
          username,
          email,
          title: formatJobTitle(body.title),
          passwordHash: await hash(password, 10),
          isActive: true,
          mustChangePassword: true,
          departmentId,
          roles: { create: { roleId: role.id } }
        },
        include: adminUserInclude
      });

      this.auditService.logAsync({
        action: "ADMIN_USER_CREATE",
        entityType: "USER",
        entityId: createdUser.id,
        entityName: createdUser.username,
        description: "Kullanıcı eklendi",
        durationMs: Date.now() - startedAt,
        context: auditContext,
        metadata: { role: roleName, roleLabel: roleLabelOf(roleName), personName: fullName(createdUser) }
      });

      return ok(mapAdminUser(createdUser));
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException("Bu kullanıcı adı veya e-posta zaten kayıtlı.");
      }

      throw error;
    }
  }

  private async parseDepartmentId(value: string | null | undefined) {
    const departmentId = value?.trim();

    if (!departmentId) {
      return null;
    }

    const department = await this.prisma.department.findUnique({
      where: { id: departmentId },
      select: { id: true }
    });

    if (!department) {
      throw new BadRequestException("Seçilen birim geçersiz.");
    }

    return department.id;
  }

  async updateUser(id: string, body: UpdateAdminUserDto, auditContext?: AuditRequestContext) {
    const startedAt = Date.now();
    const existing = await this.findExistingUser(id);

    const data = await parseUpdateUserData(body);

    if (Object.hasOwn(body, "departmentId")) {
      const departmentId = await this.parseDepartmentId(body.departmentId);

      data.department = departmentId ? { connect: { id: departmentId } } : { disconnect: true };
    }

    if (data.passwordHash) {
      // A password set by someone else is temporary; one's own new password is final.
      data.mustChangePassword = auditContext?.userId !== id;
    }

    if (Object.keys(data).length === 0) {
      throw new BadRequestException("Değiştirilecek bir bilgi girin.");
    }

    try {
      const updatedUser = await this.prisma.user.update({
        where: { id },
        data,
        include: adminUserInclude
      });

      const changes = describeUserChanges(existing, updatedUser);
      const credentialChanged = Boolean(data.passwordHash);

      // Saving a form without changing anything is not an event worth recording.
      if (changes.length > 0 || credentialChanged) {
        this.auditService.logAsync({
          action: "ADMIN_USER_UPDATE",
          entityType: "USER",
          entityId: updatedUser.id,
          entityName: updatedUser.username,
          description: "Kullanıcı bilgileri güncellendi",
          durationMs: Date.now() - startedAt,
          context: auditContext,
          metadata: { personName: fullName(updatedUser), changes, credentialChanged }
        });
      }

      return ok(mapAdminUser(updatedUser));
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException("Bu kullanıcı adı veya e-posta zaten kayıtlı.");
      }

      throw error;
    }
  }

  async updateUserRoles(
    id: string,
    body: UpdateAdminUserRolesDto,
    currentUserId: string,
    auditContext?: AuditRequestContext
  ) {
    const startedAt = Date.now();
    const requestedRoles = parseRequestedRoles(body.roles);

    return this.prisma.$transaction(async (transaction) => {
      const user = await transaction.user.findUnique({
        where: { id },
        include: adminUserInclude
      });

      if (!user || user.deletedAt) {
        throw new NotFoundException("Kullanıcı bulunamadı.");
      }

      const currentRoles = user.roles.map((userRole) => userRole.role.name);
      const removesAdminRole = currentRoles.includes("ADMIN") && !requestedRoles.includes("ADMIN");

      if (removesAdminRole) {
        await this.ensureAdminRoleCanBeRemoved(transaction, id, currentUserId);
      }

      const roles = await transaction.role.findMany({
        where: {
          name: {
            in: requestedRoles
          }
        }
      });

      if (roles.length !== requestedRoles.length) {
        throw new BadRequestException("Seçilen rol bulunamadı.");
      }

      await transaction.userRole.deleteMany({
        where: { userId: id }
      });

      await transaction.userRole.createMany({
        data: roles.map((role) => ({
          userId: id,
          roleId: role.id
        }))
      });

      const updatedUser = await transaction.user.findUniqueOrThrow({
        where: { id },
        include: adminUserInclude
      });

      this.auditService.logAsync({
        action: "ADMIN_USER_ROLE_UPDATE",
        entityType: "USER",
        entityId: updatedUser.id,
        entityName: updatedUser.username,
        description: "Kullanıcının rolü değiştirildi",
        durationMs: Date.now() - startedAt,
        context: auditContext,
        metadata: {
          personName: fullName(updatedUser),
          previousRoles: currentRoles,
          nextRoles: requestedRoles,
          previousRoleLabels: currentRoles.map(roleLabelOf),
          nextRoleLabels: requestedRoles.map(roleLabelOf)
        }
      });

      return ok(mapAdminUser(updatedUser));
    });
  }

  async deleteUser(id: string, currentUserId: string, auditContext?: AuditRequestContext) {
    const startedAt = Date.now();
    if (id === currentUserId) {
      throw new BadRequestException("Kendi hesabınızı silemezsiniz.");
    }

    return this.prisma.$transaction(async (transaction) => {
      const user = await transaction.user.findUnique({
        where: { id },
        include: adminUserInclude
      });

      if (!user || user.deletedAt) {
        throw new NotFoundException("Kullanıcı bulunamadı.");
      }

      const isAdmin = user.roles.some((userRole) => userRole.role.name === "ADMIN");

      if (isAdmin) {
        const activeAdminCount = await countActiveAdmins(transaction);

        if (activeAdminCount <= 1) {
          throw new ConflictException("Son yönetici silinemez.");
        }
      }

      const updatedUser = await transaction.user.update({
        where: { id },
        data: { isActive: false },
        include: adminUserInclude
      });

      this.auditService.logAsync({
        action: "ADMIN_USER_DEACTIVATE",
        entityType: "USER",
        entityId: updatedUser.id,
        entityName: updatedUser.username,
        description: "Kullanıcı pasifleştirildi",
        durationMs: Date.now() - startedAt,
        context: auditContext,
        metadata: {
          personName: fullName(updatedUser),
          isActive: updatedUser.isActive
        }
      });

      return ok({
        id: updatedUser.id,
        isActive: updatedUser.isActive
      });
    });
  }

  /** Lets a passive person back in, with the role and password they had. */
  async activateUser(id: string, auditContext?: AuditRequestContext) {
    const existing = await this.findExistingUser(id);
    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: { isActive: true },
      include: adminUserInclude
    });

    this.auditService.logAsync({
      action: "ADMIN_USER_ACTIVATE",
      entityType: "USER",
      entityId: updatedUser.id,
      entityName: updatedUser.username,
      description: "Kullanıcı yeniden aktifleştirildi",
      context: auditContext,
      metadata: { personName: fullName(updatedUser), wasActive: existing.isActive }
    });

    return ok(mapAdminUser(updatedUser));
  }

  /**
   * Takes a passive person off the lists for good. The row stays so old records keep their name;
   * the username and address are set free, and the account can never be signed in to again.
   */
  async removeUser(id: string, currentUserId: string, auditContext?: AuditRequestContext) {
    if (id === currentUserId) {
      throw new BadRequestException("Kendi hesabınızı silemezsiniz.");
    }

    const existing = await this.findExistingUser(id);
    if (existing.isActive) {
      throw new ConflictException("Önce kullanıcıyı pasifleştirin.");
    }

    await this.prisma.user.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        username: `silindi.${id}`,
        email: `silindi.${id}@silindi.invalid`,
        passwordHash: await hash(randomBytes(32).toString("hex"), 10),
        mustChangePassword: false,
        department: { disconnect: true },
        roles: { deleteMany: {} }
      }
    });

    this.auditService.logAsync({
      action: "ADMIN_USER_REMOVE",
      entityType: "USER",
      entityId: id,
      entityName: existing.username,
      description: "Kullanıcı listeden silindi",
      context: auditContext,
      metadata: { personName: fullName(existing) }
    });

    return ok({ id, removed: true });
  }

  private async findExistingUser(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: adminUserInclude
    });

    if (!user || user.deletedAt) {
      throw new NotFoundException("Kullanıcı bulunamadı.");
    }

    return user;
  }

  private async ensureAdminRoleCanBeRemoved(
    transaction: Prisma.TransactionClient,
    targetUserId: string,
    currentUserId: string
  ) {
    const activeAdminCount = await countActiveAdmins(transaction);

    if (targetUserId === currentUserId && activeAdminCount <= 1) {
      throw new BadRequestException("Kendi yönetici rolünüzü kaldıramazsınız.");
    }

    if (activeAdminCount <= 1) {
      throw new ConflictException("Son yöneticinin rolü değiştirilemez.");
    }
  }
}

type AdminUserWithRoles = Prisma.UserGetPayload<{
  include: typeof adminUserInclude;
}>;

function roleLabelOf(role: string) {
  const labels: Record<string, string> = { ADMIN: "Yönetici", EDITOR: "Düzenleyici", VIEWER: "Kullanıcı" };

  return labels[role] ?? role;
}

function fullName(user: { firstName: string; lastName: string }) {
  return `${user.firstName} ${user.lastName}`;
}

/** Old and new values for the record. The password is left out on purpose; only the fact that it changed is kept. */
function describeUserChanges(before: AdminUserWithRoles, after: AdminUserWithRoles) {
  const fields: Array<[string, (user: AdminUserWithRoles) => string | null]> = [
    ["Ad", (user) => user.firstName],
    ["Soyad", (user) => user.lastName],
    ["Ünvan", (user) => user.title],
    ["E-posta", (user) => user.email],
    ["Kullanıcı adı", (user) => user.username],
    ["Birim", (user) => user.department?.name ?? null]
  ];

  return fields.flatMap(([field, read]) =>
    read(before) === read(after) ? [] : [{ field, from: read(before) ?? "-", to: read(after) ?? "-" }]
  );
}

function mapAdminUser(user: AdminUserWithRoles) {
  return {
    id: user.id,
    username: user.username,
    firstName: user.firstName,
    lastName: user.lastName,
    title: user.title,
    email: user.email,
    department: user.department ? { id: user.department.id, name: user.department.name } : null,
    roles: user.roles.map((userRole) => userRole.role.name).sort(),
    isActive: user.isActive,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
}

function buildUserWhere(query: AdminUsersQuery): Prisma.UserWhereInput {
  const where: Prisma.UserWhereInput = { deletedAt: null };
  const q = query.q?.trim();
  const role = query.role?.trim();

  if (q) {
    const terms = q.split(/\s+/).filter(Boolean);
    where.AND = terms.map((term) => ({
      OR: buildUserSearchConditions(term)
    }));
  }

  if (role) {
    validateRoleName(role);
    where.roles = {
      some: {
        role: {
          name: role
        }
      }
    };
  }

  return where;
}

function buildUserSearchConditions(term: string): Prisma.UserWhereInput[] {
  return createSearchTermVariants(term).flatMap((variant) => [
    { firstName: { contains: variant, mode: "insensitive" } },
    { lastName: { contains: variant, mode: "insensitive" } },
    { username: { contains: variant, mode: "insensitive" } },
    { email: { contains: variant, mode: "insensitive" } }
  ]);
}

function createSearchTermVariants(term: string) {
  const normalizedTerm = term.trim();
  const variants = new Set([normalizedTerm]);
  const replacements: Array<[RegExp, string]> = [
    [/i/g, "ı"],
    [/ı/g, "i"],
    [/g/g, "ğ"],
    [/ğ/g, "g"],
    [/u/g, "ü"],
    [/ü/g, "u"],
    [/o/g, "ö"],
    [/ö/g, "o"],
    [/c/g, "ç"],
    [/ç/g, "c"],
    [/s/g, "ş"],
    [/ş/g, "s"]
  ];

  for (const [pattern, replacement] of replacements) {
    variants.add(normalizedTerm.toLocaleLowerCase("tr-TR").replace(pattern, replacement));
  }

  return Array.from(variants).filter(Boolean);
}

async function parseUpdateUserData(body: UpdateAdminUserDto): Promise<Prisma.UserUpdateInput> {
  const data: Prisma.UserUpdateInput = {};

  if (Object.hasOwn(body, "firstName")) {
    data.firstName = formatTitleCase(parseRequiredString(body.firstName, "firstName"));
  }

  if (Object.hasOwn(body, "lastName")) {
    data.lastName = formatTitleCase(parseRequiredString(body.lastName, "lastName"));
  }

  if (Object.hasOwn(body, "title")) {
    data.title = formatJobTitle(body.title);
  }

  if (Object.hasOwn(body, "email")) {
    data.email = parseEmail(body.email);
  }

  if (Object.hasOwn(body, "username")) {
    data.username = parseRequiredString(body.username, "username");
  }

  if (Object.hasOwn(body, "password")) {
    const password = parseOptionalPassword(body.password);

    if (password) {
      data.passwordHash = await hash(password, 10);
    }
  }

  return data;
}

function parseRequestedRoles(roles: string[] | undefined) {
  if (!Array.isArray(roles) || roles.length === 0) {
    throw new BadRequestException("En az bir rol seçin.");
  }

  const normalizedRoles = roles.map((role) => role.trim().toUpperCase());
  const uniqueRoles = new Set(normalizedRoles);

  if (uniqueRoles.size !== normalizedRoles.length) {
    throw new BadRequestException("Aynı rol iki kez seçilemez.");
  }

  for (const role of uniqueRoles) {
    validateRoleName(role);
  }

  return Array.from(uniqueRoles);
}

function validateRoleName(role: string) {
  if (!allowedUserRoles.has(role)) {
    throw new BadRequestException("Seçilen rol geçersiz.");
  }
}

function parseRequiredString(value: string | undefined, fieldName: string) {
  const parsed = value?.trim();

  if (!parsed) {
    throw new BadRequestException("Zorunlu alanları doldurun.");
  }

  return parsed;
}

function parseOptionalString(value: string | null | undefined) {
  const parsed = value?.trim();

  return parsed || null;
}

function formatJobTitle(value: string | null | undefined) {
  const title = parseOptionalString(value);

  return title ? formatTitleCase(title, { jobTitle: true }) : title;
}

function parseOptionalPassword(value: string | null | undefined) {
  const password = value?.trim();

  if (!password) {
    return null;
  }

  assertStrongPassword(password);

  return password;
}

function parseEmail(value: string | undefined) {
  const email = parseRequiredString(value, "email");

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new BadRequestException("E-posta adresi geçersiz.");
  }

  return email;
}

async function countActiveAdmins(transaction: Prisma.TransactionClient) {
  return transaction.user.count({
    where: {
      isActive: true,
      roles: {
        some: {
          role: {
            name: "ADMIN"
          }
        }
      }
    }
  });
}

function isUniqueConstraintError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

function buildCategoryDocumentCounts(folders: FolderSummary[], documents: DocumentSummary[]) {
  const childrenByParentId = new Map<string, FolderSummary[]>();

  for (const folder of folders) {
    if (!folder.parentId) {
      continue;
    }

    const siblings = childrenByParentId.get(folder.parentId) ?? [];
    siblings.push(folder);
    childrenByParentId.set(folder.parentId, siblings);
  }

  return folders
    .filter((folder) => folder.parentId === null)
    .sort((first, second) => first.name.localeCompare(second.name, "tr"))
    .map((rootFolder) => {
      const folderIds = getDescendantFolderIds(rootFolder.id, childrenByParentId);

      return {
        key: rootFolder.id,
        name: rootFolder.name,
        documentCount: documents.filter((document) => folderIds.has(document.folderId)).length
      };
    });
}

function getDescendantFolderIds(rootFolderId: string, childrenByParentId: Map<string, FolderSummary[]>) {
  const folderIds = new Set<string>();
  const pendingFolderIds = [rootFolderId];

  while (pendingFolderIds.length > 0) {
    const folderId = pendingFolderIds.pop()!;
    folderIds.add(folderId);

    for (const child of childrenByParentId.get(folderId) ?? []) {
      pendingFolderIds.push(child.id);
    }
  }

  return folderIds;
}

function buildUserRoleCounts(
  users: Array<{
    id: string;
    roles: Array<{ role: { name: string } }>;
  }>
) {
  const counts = {
    admin: 0,
    editor: 0,
    user: 0,
    total: users.length
  };

  for (const user of users) {
    const roleNames = user.roles.map((userRole) => userRole.role.name);
    const highestRole = rolePriority.find((role) => roleNames.includes(role));

    if (highestRole === "ADMIN") {
      counts.admin += 1;
    } else if (highestRole === "EDITOR") {
      counts.editor += 1;
    } else if (highestRole === "VIEWER") {
      counts.user += 1;
    }
  }

  return counts;
}

function buildFileTypeStats(documents: DocumentSummary[]) {
  const statsByFileType = new Map<string, { documentCount: number; totalSizeBytes: number }>();

  for (const document of documents) {
    const fileType = getFileType(document);
    const existing = statsByFileType.get(fileType) ?? {
      documentCount: 0,
      totalSizeBytes: 0
    };

    existing.documentCount += 1;
    existing.totalSizeBytes += Number(document.sizeBytes ?? 0n);
    statsByFileType.set(fileType, existing);
  }

  return Array.from(statsByFileType.entries())
    .map(([fileType, stats]) => ({
      fileType,
      documentCount: stats.documentCount,
      totalSizeBytes: stats.totalSizeBytes
    }))
    .sort((left, right) => {
      if (right.documentCount !== left.documentCount) {
        return right.documentCount - left.documentCount;
      }

      return left.fileType.localeCompare(right.fileType);
    });
}

function getFileType(document: DocumentSummary) {
  if (document.storageBucket === "metadata-only") {
    return "Kağıt belge";
  }

  return (
    getExtensionType(document.originalFileName) ??
    getExtensionType(document.name) ??
    getMimeTypeFallback(document.mimeType) ??
    "UNKNOWN"
  );
}

function getExtensionType(value: string | null | undefined) {
  const trimmedValue = value?.trim();

  if (!trimmedValue) {
    return null;
  }

  const lastSegment = trimmedValue.split(/[\\/]/).pop() ?? trimmedValue;
  const extensionIndex = lastSegment.lastIndexOf(".");

  if (extensionIndex <= 0 || extensionIndex === lastSegment.length - 1) {
    return null;
  }

  return lastSegment.slice(extensionIndex + 1).toUpperCase();
}

function getMimeTypeFallback(mimeType: string | null | undefined) {
  const normalizedMimeType = mimeType?.trim().toLowerCase();

  if (!normalizedMimeType) {
    return null;
  }

  if (mimeTypeFallbacks[normalizedMimeType]) {
    return mimeTypeFallbacks[normalizedMimeType];
  }

  const subtype = normalizedMimeType.split("/")[1];

  return subtype ? subtype.replace(/[^a-z0-9]+/g, "_").toUpperCase() : null;
}
