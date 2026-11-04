import { canViewDocument, viewerFromContext, withDocumentAccess, type DocumentViewer } from "../common/access";
import { Injectable, NotFoundException } from "@nestjs/common";
import { AuditService } from "../audit/audit.service";
import type { AuditRequestContext } from "../audit/audit.types";
import { mapDocument } from "../common/mappers";
import { ok } from "../common/responses";
import { PrismaService } from "../prisma/prisma.service";

const documentIncludes = {
  responsibleDepartment: true,
  responsibleUser: true,
  createdBy: true,
  folder: true
};

@Injectable()
export class FavoritesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService
  ) {}

  async findAll(userId: string, viewer?: DocumentViewer) {
    const favorites = await this.prisma.favorite.findMany({
      where: {
        userId,
        documentId: { not: null },
        document: withDocumentAccess({ deletedAt: null }, viewer)
      },
      include: {
        document: {
          include: documentIncludes
        }
      },
      orderBy: { createdAt: "desc" }
    });

    return ok(favorites.flatMap((favorite) => (favorite.document ? [mapDocument(favorite.document)] : [])));
  }

  async addDocument(userId: string, documentId: string, auditContext?: AuditRequestContext) {
    const startedAt = Date.now();
    const document = await this.ensureDocumentExists(documentId, auditContext);

    const existing = await this.prisma.favorite.findFirst({
      where: {
        userId,
        documentId
      },
      select: { id: true }
    });

    if (!existing) {
      await this.prisma.favorite.create({
        data: {
          userId,
          documentId
        }
      });
    }

    this.auditService.logAsync({
      action: "FAVORITE_ADD",
      entityType: "FAVORITE",
      entityId: documentId,
      entityName: document.name,
      description: "Document added to favorites",
      durationMs: Date.now() - startedAt,
      context: auditContext,
      metadata: {
        documentId,
        alreadyFavorite: Boolean(existing)
      }
    });

    return ok({
      documentId,
      isFavorite: true
    });
  }

  async removeDocument(userId: string, documentId: string, auditContext?: AuditRequestContext) {
    const startedAt = Date.now();
    const document = await this.ensureDocumentExists(documentId, auditContext);

    const deleteResult = await this.prisma.favorite.deleteMany({
      where: {
        userId,
        documentId
      }
    });

    this.auditService.logAsync({
      action: "FAVORITE_REMOVE",
      entityType: "FAVORITE",
      entityId: documentId,
      entityName: document.name,
      description: "Document removed from favorites",
      durationMs: Date.now() - startedAt,
      context: auditContext,
      metadata: {
        documentId,
        removedCount: deleteResult.count
      }
    });

    return ok({
      documentId,
      isFavorite: false
    });
  }

  private async ensureDocumentExists(documentId: string, auditContext?: AuditRequestContext) {
    const document = await this.prisma.document.findFirst({
      where: { id: documentId, deletedAt: null },
      select: {
        id: true,
        name: true,
        accessLevel: true,
        createdById: true,
        responsibleUserId: true,
        responsibleDepartmentId: true
      }
    });

    if (!document || !canViewDocument(viewerFromContext(auditContext), document)) {
      throw new NotFoundException("Belge bulunamadı.");
    }

    return document;
  }
}
