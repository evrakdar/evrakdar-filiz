import { ConflictException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { AuditService } from "../audit/audit.service";
import type { AuditRequestContext } from "../audit/audit.types";
import { canViewDocument, viewerFromContext, withDocumentAccess, type DocumentViewer } from "../common/access";
import { mapDocument, mapFolder } from "../common/mappers";
import { ok } from "../common/responses";
import { StorageService } from "../storage/storage.service";
import { PrismaService } from "../prisma/prisma.service";

const documentIncludes = {
  responsibleDepartment: true,
  responsibleUser: true,
  createdBy: true,
  deletedBy: true,
  folder: true
};

const folderIncludes = {
  responsibleDepartment: true,
  createdBy: true,
  deletedBy: true
};

@Injectable()
export class TrashService {
  private readonly logger = new Logger(TrashService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly storageService: StorageService
  ) {}

  async findAll(viewer?: DocumentViewer) {
    const [documents, folders] = await Promise.all([
      this.prisma.document.findMany({
        where: withDocumentAccess({ deletedAt: { not: null } }, viewer),
        include: documentIncludes,
        orderBy: [{ deletedAt: "desc" }]
      }),
      this.prisma.folder.findMany({
        where: { deletedAt: { not: null } },
        include: folderIncludes,
        orderBy: [{ deletedAt: "desc" }]
      })
    ]);

    return ok({
      documents: documents.map(mapTrashDocument),
      folders: folders.map(mapTrashFolder)
    });
  }

  async restoreDocument(id: string, userId: string, auditContext?: AuditRequestContext) {
    const startedAt = Date.now();
    const document = await this.getDeletedDocument(id, auditContext);
    const folder = await this.prisma.folder.findFirst({
      where: { id: document.folderId, deletedAt: null },
      select: { id: true }
    });

    if (!folder) {
      throw new ConflictException("Önce belgenin klasörünü geri alın.");
    }

    const nameConflict = await this.prisma.document.findFirst({
      where: {
        folderId: document.folderId,
        name: document.name,
        deletedAt: null,
        id: { not: document.id }
      },
      select: { id: true }
    });

    if (nameConflict) {
      throw new ConflictException("Bu klasörde aynı adda bir belge var.");
    }

    const restoredDocument = await this.prisma.document.update({
      where: { id },
      data: {
        deletedAt: null,
        deletedById: null
      },
      include: documentIncludes
    });

    this.auditService.logAsync({
      action: "DOCUMENT_RESTORE",
      entityType: "DOCUMENT",
      entityId: restoredDocument.id,
      entityName: restoredDocument.name,
      description: "Document restored from trash",
      durationMs: Date.now() - startedAt,
      context: auditContext,
      metadata: {
        userId,
        folderId: restoredDocument.folderId
      }
    });

    return ok(mapDocument(restoredDocument));
  }

  async permanentlyDeleteDocument(id: string, userId: string, auditContext?: AuditRequestContext) {
    const startedAt = Date.now();
    const document = await this.getDeletedDocument(id, auditContext);
    const bucket = this.storageService.getBucketName();
    const versions = await this.prisma.documentVersion.findMany({
      where: { documentId: id },
      select: { storageBucket: true, storageKey: true }
    });
    const storageKeys = new Set(
      [{ storageBucket: document.storageBucket, storageKey: document.storageKey }, ...versions]
        .filter((item) => item.storageBucket === bucket && item.storageKey)
        .map((item) => item.storageKey)
    );

    await this.prisma.document.delete({
      where: { id }
    });
    await this.removeUnreferencedObjects([...storageKeys]);
    this.auditService.logAsync({
      action: "DOCUMENT_PERMANENT_DELETE",
      entityType: "DOCUMENT",
      entityId: document.id,
      entityName: document.name,
      description: "Document permanently deleted",
      durationMs: Date.now() - startedAt,
      context: auditContext,
      metadata: {
        userId,
        folderId: document.folderId
      }
    });

    return ok({ id, deleted: true });
  }

  async restoreFolder(id: string, userId: string, auditContext?: AuditRequestContext) {
    const startedAt = Date.now();
    const folder = await this.getDeletedFolder(id);

    if (folder.parentId) {
      const parent = await this.prisma.folder.findFirst({
        where: { id: folder.parentId, deletedAt: null },
        select: { id: true }
      });

      if (!parent) {
        throw new ConflictException("Önce üst klasörü geri alın.");
      }
    }

    const nameConflict = await this.prisma.folder.findFirst({
      where: {
        parentId: folder.parentId,
        name: folder.name,
        deletedAt: null,
        id: { not: folder.id }
      },
      select: { id: true }
    });

    if (nameConflict) {
      throw new ConflictException("Bu konumda aynı adda bir klasör var.");
    }

    const restoredFolder = await this.prisma.folder.update({
      where: { id },
      data: {
        deletedAt: null,
        deletedById: null
      },
      include: folderIncludes
    });

    this.auditService.logAsync({
      action: "FOLDER_RESTORE",
      entityType: "FOLDER",
      entityId: restoredFolder.id,
      entityName: restoredFolder.name,
      description: "Folder restored from trash",
      durationMs: Date.now() - startedAt,
      context: auditContext,
      metadata: {
        userId,
        parentId: restoredFolder.parentId,
        path: restoredFolder.path
      }
    });

    return ok(mapFolder(restoredFolder));
  }

  async permanentlyDeleteFolder(id: string, userId: string, auditContext?: AuditRequestContext) {
    const startedAt = Date.now();
    const folder = await this.getDeletedFolder(id);
    const [childCount, documentCount] = await Promise.all([
      this.prisma.folder.count({ where: { parentId: id } }),
      this.prisma.document.count({ where: { folderId: id } })
    ]);

    if (childCount > 0 || documentCount > 0) {
      throw new ConflictException("Klasör boş olmadan kalıcı silinemez.");
    }

    await this.prisma.folder.delete({
      where: { id }
    });
    this.auditService.logAsync({
      action: "FOLDER_PERMANENT_DELETE",
      entityType: "FOLDER",
      entityId: folder.id,
      entityName: folder.name,
      description: "Folder permanently deleted",
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

  /** Copies share storage objects, so only delete files no other document or version still points to. */
  private async removeUnreferencedObjects(storageKeys: string[]) {
    for (const storageKey of storageKeys) {
      try {
        const [documentRefs, versionRefs] = await Promise.all([
          this.prisma.document.count({ where: { storageKey } }),
          this.prisma.documentVersion.count({ where: { storageKey } })
        ]);

        if (documentRefs === 0 && versionRefs === 0) {
          await this.storageService.removeObject(storageKey);
        }
      } catch (error) {
        this.logger.warn(`Stored file could not be removed (${storageKey}): ${String(error)}`);
      }
    }
  }

  private async getDeletedDocument(id: string, auditContext?: AuditRequestContext) {
    const document = await this.prisma.document.findFirst({
      where: { id, deletedAt: { not: null } },
      include: documentIncludes
    });

    if (!document || !canViewDocument(viewerFromContext(auditContext), document)) {
      throw new NotFoundException("Belge çöp kutusunda bulunamadı.");
    }

    return document;
  }

  private async getDeletedFolder(id: string) {
    const folder = await this.prisma.folder.findFirst({
      where: { id, deletedAt: { not: null } },
      include: folderIncludes
    });

    if (!folder) {
      throw new NotFoundException("Klasör çöp kutusunda bulunamadı.");
    }

    return folder;
  }
}

function mapTrashDocument(
  document: Prisma.DocumentGetPayload<{ include: typeof documentIncludes }>
) {
  return {
    ...mapDocument(document),
    itemType: "document" as const,
    deletedAt: document.deletedAt,
    deletedBy: document.deletedBy ? mapTrashUser(document.deletedBy) : null
  };
}

function mapTrashFolder(folder: Prisma.FolderGetPayload<{ include: typeof folderIncludes }>) {
  return {
    ...mapFolder(folder),
    itemType: "folder" as const,
    deletedAt: folder.deletedAt,
    deletedBy: folder.deletedBy ? mapTrashUser(folder.deletedBy) : null
  };
}

function mapTrashUser(user: { id: string; firstName: string; lastName: string; title: string | null; email: string }) {
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    title: user.title,
    email: user.email
  };
}
