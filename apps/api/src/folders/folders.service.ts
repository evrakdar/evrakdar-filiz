import { viewerFromContext, withDocumentAccess, type DocumentViewer } from "../common/access";
import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { AuditService } from "../audit/audit.service";
import type { AuditAction, AuditRequestContext } from "../audit/audit.types";
import { mapDocument, mapFolder } from "../common/mappers";
import { ok } from "../common/responses";
import { PrismaService } from "../prisma/prisma.service";
import type { CopyFolderDto, CreateFolderDto, UpdateFolderDto } from "./folders.controller";

const folderIncludes = {
  responsibleDepartment: true,
  createdBy: true
};

const documentIncludes = {
  responsibleDepartment: true,
  responsibleUser: true,
  createdBy: true,
  folder: true
};

type FolderWithIncludes = Prisma.FolderGetPayload<{ include: typeof folderIncludes }>;

type BreadcrumbFolder = {
  id: string;
  name: string;
  parentId: string | null;
  path: string;
};

@Injectable()
export class FoldersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService
  ) {}

  async createFolder(body: CreateFolderDto, userId: string, auditContext?: AuditRequestContext, roles: string[] = []) {
    const startedAt = Date.now();
    const name = parseRequiredString(body.name, "name");
    const parentId = body.parentId?.trim() || null;

    if (!parentId) {
      ensureCanChangeTopLevel(roles);
    }

    const parent = parentId ? await this.getExistingFolder(parentId) : null;

    await this.ensureFolderNameAvailable(parent?.id ?? null, name);

    const folder = await this.prisma.folder.create({
      data: {
        name,
        parentId: parent?.id ?? null,
        path: parent ? joinPath(parent.path, name) : `/${name}`,
        level: parent ? parent.level + 1 : 0,
        responsibleDepartmentId: parent?.responsibleDepartmentId ?? null,
        createdById: userId
      },
      include: folderIncludes
    });

    this.auditService.logAsync({
      action: "FOLDER_CREATE",
      entityType: "FOLDER",
      entityId: folder.id,
      entityName: folder.name,
      description: "Folder created",
      durationMs: Date.now() - startedAt,
      context: auditContext,
      metadata: {
        parentId: parent?.id ?? null,
        path: folder.path
      }
    });

    return ok(mapFolder(folder));
  }

  async findRoot() {
    const folders = await this.prisma.folder.findMany({
      where: { parentId: null, deletedAt: null },
      include: folderIncludes,
      orderBy: [{ name: "asc" }]
    });

    return ok(folders.map(mapFolder));
  }

  async findById(id: string) {
    const folder = await this.prisma.folder.findFirst({
      where: { id, deletedAt: null },
      include: folderIncludes
    });

    if (!folder) {
      throw new NotFoundException("Klasör bulunamadı.");
    }

    return ok(mapFolder(folder));
  }

  async findChildren(id: string, viewer?: DocumentViewer) {
    await this.ensureFolderExists(id);

    const [folders, documents] = await Promise.all([
      this.prisma.folder.findMany({
        where: { parentId: id, deletedAt: null },
        include: folderIncludes,
        orderBy: [{ name: "asc" }]
      }),
      this.prisma.document.findMany({
        where: withDocumentAccess({ folderId: id, deletedAt: null }, viewer),
        include: documentIncludes,
        orderBy: [{ createdAt: "desc" }]
      })
    ]);

    return ok({
      folders: folders.map(mapFolder),
      documents: documents.map(mapDocument)
    });
  }

  async findBreadcrumb(id: string) {
    const breadcrumb = [];
    let currentId: string | null = id;

    while (currentId) {
      const folder: BreadcrumbFolder | null = await this.prisma.folder.findFirst({
        where: { id: currentId, deletedAt: null },
        select: {
          id: true,
          name: true,
          parentId: true,
          path: true
        }
      });

      if (!folder) {
        if (currentId === id) {
          throw new NotFoundException("Klasör bulunamadı.");
        }

        break;
      }

      breadcrumb.unshift({
        id: folder.id,
        name: folder.name,
        path: folder.path
      });
      currentId = folder.parentId;
    }

    return ok(breadcrumb);
  }

  async updateFolder(id: string, body: UpdateFolderDto, userId: string, auditContext?: AuditRequestContext, roles: string[] = []) {
    const startedAt = Date.now();
    const folder = await this.getExistingFolder(id);

    if (folder.parentId === null) {
      ensureCanChangeTopLevel(roles);
    }

    const nextName = body.name?.trim();
    const nextParentId = body.parentId?.trim();
    const shouldRename = nextName !== undefined;
    const shouldMove = nextParentId !== undefined;

    if (!shouldRename && !shouldMove) {
      throw new BadRequestException("Değiştirilecek bir bilgi girin.");
    }

    if (shouldRename && !nextName) {
      throw new BadRequestException("Ad boş olamaz.");
    }

    const targetParent = shouldMove ? await this.getMoveTargetParent(folder, nextParentId) : null;
    const finalParentId = targetParent ? targetParent.id : folder.parentId;
    const finalName = nextName ?? folder.name;

    await this.ensureFolderNameAvailable(finalParentId, finalName, folder.id);

    const previousPath = folder.path;
    const previousLevel = folder.level;
    const nextPath = targetParent ? joinPath(targetParent.path, finalName) : replaceLastPathSegment(folder.path, finalName);
    const nextLevel = targetParent ? targetParent.level + 1 : folder.level;

    const updatedFolder = await this.prisma.$transaction(async (transaction) => {
      const updated = await transaction.folder.update({
        where: { id },
        data: {
          ...(shouldRename ? { name: finalName } : {}),
          ...(targetParent ? { parentId: targetParent.id } : {}),
          path: nextPath,
          level: nextLevel
        },
        include: folderIncludes
      });

      const descendants = await transaction.folder.findMany({
        where: { path: { startsWith: `${previousPath}/` }, deletedAt: null },
        select: {
          id: true,
          path: true,
          level: true
        }
      });

      for (const descendant of descendants) {
        await transaction.folder.update({
          where: { id: descendant.id },
          data: {
            path: descendant.path.replace(previousPath, nextPath),
            level: nextLevel + (descendant.level - previousLevel)
          }
        });
      }

      return updated;
    });

    const action: AuditAction = shouldMove && finalParentId !== folder.parentId ? "FOLDER_MOVE" : "FOLDER_RENAME";
    this.auditService.logAsync({
      action,
      entityType: "FOLDER",
      entityId: updatedFolder.id,
      entityName: updatedFolder.name,
      description: action === "FOLDER_MOVE" ? "Folder moved" : "Folder renamed",
      durationMs: Date.now() - startedAt,
      context: auditContext,
      metadata: {
        userId,
        previousName: folder.name,
        nextName: updatedFolder.name,
        previousParentId: folder.parentId,
        nextParentId: updatedFolder.parentId,
        previousPath,
        nextPath
      }
    });

    return ok(mapFolder(updatedFolder));
  }

  async copyFolder(id: string, body: CopyFolderDto, userId: string, auditContext?: AuditRequestContext) {
    const startedAt = Date.now();
    const sourceFolder = await this.getExistingFolder(id);
    const parentId = parseRequiredString(body.parentId, "parentId");
    const targetParent = await this.getCopyTargetParent(sourceFolder, parentId);
    const requestedName = body.name?.trim();
    const copyName = requestedName || (await this.getAvailableFolderCopyName(sourceFolder.name, targetParent.id));

    await this.ensureFolderNameAvailable(targetParent.id, copyName);

    const copiedDocumentIds: string[] = [];
    const copiedRootFolder = await this.prisma.$transaction(async (transaction) => {
      const copySubtree = async (
        source: Pick<FolderWithIncludes, "id" | "name" | "responsibleDepartmentId">,
        parent: Pick<FolderWithIncludes, "id" | "path" | "level">,
        nameOverride?: string
      ): Promise<FolderWithIncludes> => {
        const folderName = nameOverride ?? source.name;
        const copiedFolder = await transaction.folder.create({
          data: {
            name: folderName,
            parentId: parent.id,
            path: joinPath(parent.path, folderName),
            level: parent.level + 1,
            responsibleDepartmentId: source.responsibleDepartmentId,
            createdById: userId
          },
          include: folderIncludes
        });

        const documents = await transaction.document.findMany({
          where: withDocumentAccess({ folderId: source.id, deletedAt: null }, viewerFromContext(auditContext))
        });

        for (const document of documents) {
          const copiedDocument = await transaction.document.create({
            data: {
              folderId: copiedFolder.id,
              name: document.name,
              originalFileName: document.originalFileName,
              mimeType: document.mimeType,
              sizeBytes: document.sizeBytes,
              documentType: document.documentType,
              responsibleDepartmentId: document.responsibleDepartmentId,
              responsibleUserId: document.responsibleUserId,
              validUntil: document.validUntil,
              revisionNo: document.revisionNo,
              accessLevel: document.accessLevel,
              tags: buildCopiedDocumentTags(document.tags, document.id),
              storageBucket: document.storageBucket,
              storageKey: document.storageKey,
              createdById: userId
            }
          });
          copiedDocumentIds.push(copiedDocument.id);

          const sourceVersion = await transaction.documentVersion.findFirst({
            where: { documentId: document.id, versionNo: document.revisionNo }
          });

          if (sourceVersion) {
            await transaction.documentVersion.create({
              data: {
                documentId: copiedDocument.id,
                versionNo: sourceVersion.versionNo,
                originalFileName: sourceVersion.originalFileName,
                mimeType: sourceVersion.mimeType,
                storageBucket: sourceVersion.storageBucket,
                storageKey: sourceVersion.storageKey,
                sizeBytes: sourceVersion.sizeBytes,
                extractedText: sourceVersion.extractedText,
                createdById: userId
              }
            });
          }
        }

        const childFolders = await transaction.folder.findMany({
          where: { parentId: source.id, deletedAt: null },
          include: folderIncludes,
          orderBy: [{ name: "asc" }]
        });

        for (const childFolder of childFolders) {
          await copySubtree(childFolder, copiedFolder);
        }

        return copiedFolder;
      };

      return copySubtree(sourceFolder, targetParent, copyName);
    });


    this.auditService.logAsync({
      action: "FOLDER_COPY",
      entityType: "FOLDER",
      entityId: copiedRootFolder.id,
      entityName: copiedRootFolder.name,
      description: "Folder copied",
      durationMs: Date.now() - startedAt,
      context: auditContext,
      metadata: {
        userId,
        sourceFolderId: sourceFolder.id,
        targetParentId: targetParent.id,
        copiedDocumentCount: copiedDocumentIds.length
      }
    });

    return ok(mapFolder(copiedRootFolder));
  }

  async deleteFolder(id: string, userId: string, auditContext?: AuditRequestContext, roles: string[] = []) {
    const startedAt = Date.now();
    const folder = await this.getExistingFolder(id);

    if (folder.parentId === null) {
      ensureCanChangeTopLevel(roles);
    }

    const [childCount, documentCount] = await Promise.all([
      this.prisma.folder.count({ where: { parentId: id, deletedAt: null } }),
      this.prisma.document.count({ where: { folderId: id, deletedAt: null } })
    ]);

    if (childCount > 0 || documentCount > 0) {
      throw new ConflictException("Klasör boş olmadan silinemez.");
    }

    const deletedFolder = await this.prisma.folder.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        deletedById: userId
      },
      include: folderIncludes
    });

    this.auditService.logAsync({
      action: "FOLDER_DELETE",
      entityType: "FOLDER",
      entityId: deletedFolder.id,
      entityName: deletedFolder.name,
      description: "Empty folder moved to trash",
      durationMs: Date.now() - startedAt,
      context: auditContext,
      metadata: {
        userId,
        parentId: folder.parentId,
        path: folder.path
      }
    });

    return ok({ id, deleted: true });
  }

  private async getMoveTargetParent(folder: FolderWithIncludes, parentId: string | undefined) {
    if (!parentId) {
      throw new BadRequestException("Üst klasör seçin.");
    }

    if (parentId === folder.id) {
      throw new BadRequestException("Klasör kendi içine taşınamaz.");
    }

    const parent = await this.getExistingFolder(parentId);

    if (parent.path === folder.path || parent.path.startsWith(`${folder.path}/`)) {
      throw new BadRequestException("Klasör kendi alt klasörüne taşınamaz.");
    }

    return parent;
  }

  private async getCopyTargetParent(folder: FolderWithIncludes, parentId: string | undefined) {
    if (!parentId) {
      throw new BadRequestException("Üst klasör seçin.");
    }

    if (parentId === folder.id) {
      throw new BadRequestException("Klasör kendi içine kopyalanamaz.");
    }

    const parent = await this.getExistingFolder(parentId);

    if (parent.path === folder.path || parent.path.startsWith(`${folder.path}/`)) {
      throw new BadRequestException("Klasör kendi alt klasörüne kopyalanamaz.");
    }

    return parent;
  }

  private async ensureFolderNameAvailable(parentId: string | null, name: string, currentFolderId?: string) {
    const conflict = await this.prisma.folder.findFirst({
      where: {
        parentId,
        name,
        deletedAt: null,
        ...(currentFolderId ? { id: { not: currentFolderId } } : {})
      },
      select: { id: true }
    });

    if (conflict) {
      throw new ConflictException("Bu konumda aynı adda bir klasör var.");
    }
  }

  private async getAvailableFolderCopyName(name: string, parentId: string | null) {
    const baseName = `${name} - Kopya`;

    for (let index = 0; index < 100; index += 1) {
      const candidate = index === 0 ? baseName : `${baseName} ${index + 1}`;
      const conflict = await this.prisma.folder.findFirst({
        where: {
          parentId,
          name: candidate,
          deletedAt: null
        },
        select: { id: true }
      });

      if (!conflict) {
        return candidate;
      }
    }

    return `${baseName} ${Date.now()}`;
  }

  private async getExistingFolder(id: string) {
    const folder = await this.prisma.folder.findFirst({
      where: { id, deletedAt: null },
      include: folderIncludes
    });

    if (!folder) {
      throw new NotFoundException("Klasör bulunamadı.");
    }

    return folder;
  }

  private async ensureFolderExists(id: string) {
    const folder = await this.prisma.folder.findFirst({
      where: { id, deletedAt: null },
      select: { id: true }
    });

    if (!folder) {
      throw new NotFoundException("Klasör bulunamadı.");
    }
  }
}

function parseRequiredString(value: string | undefined, fieldName: string) {
  const parsed = value?.trim();

  if (!parsed) {
    throw new BadRequestException("Zorunlu alanları doldurun.");
  }

  return parsed;
}

function ensureCanChangeTopLevel(roles: string[]) {
  if (!roles.includes("ADMIN")) {
    throw new ForbiddenException("Ana klasörleri yalnız yönetici ekleyebilir ya da değiştirebilir.");
  }
}

function joinPath(parentPath: string, name: string) {
  return `${parentPath}/${name}`;
}

function replaceLastPathSegment(path: string, name: string) {
  const segments = path.split("/");
  segments[segments.length - 1] = name;

  return segments.join("/");
}

function buildCopiedDocumentTags(tags: Prisma.JsonValue, sourceDocumentId: string): Prisma.InputJsonObject {
  const current = toJsonObject(tags);

  return {
    ...current,
    copiedFromDocumentId: sourceDocumentId,
    copiedAt: new Date().toISOString()
  };
}

function toJsonObject(value: Prisma.JsonValue): Prisma.InputJsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Prisma.InputJsonObject;
}
