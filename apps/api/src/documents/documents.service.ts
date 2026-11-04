import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { AccessLevel, DocumentType, Prisma } from "@prisma/client";
import crypto from "node:crypto";
import { AuditService } from "../audit/audit.service";
import type { AuditAction, AuditRequestContext } from "../audit/audit.types";
import {
  canViewDocument,
  parseAccessLevel,
  viewerFromContext,
  withDocumentAccess,
  type DocumentViewer
} from "../common/access";
import { daysFromToday, startOfToday } from "../common/dates";
import { mapDocument } from "../common/mappers";
import { parseOptionalDate, parsePagination } from "../common/query";
import { ok, paginated } from "../common/responses";
import { StorageService } from "../storage/storage.service";
import { PrismaService } from "../prisma/prisma.service";
import { extractSearchableText, foldSearchText, renderWordPreview } from "./text-extraction";
import type {
  CreateDocumentMetadataDto,
  CopyDocumentDto,
  DocumentListQuery,
  UploadedDocumentFile,
  UpdateDocumentDto,
  UploadDocumentDto
} from "./documents.controller";

const documentIncludes = {
  responsibleDepartment: true,
  responsibleUser: true,
  createdBy: true,
  folder: true
};

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly auditService: AuditService
  ) {}

  async createMetadataOnly(body: CreateDocumentMetadataDto, userId: string, auditContext?: AuditRequestContext) {
    const startedAt = Date.now();
    const name = parseRequiredString(body.name, "name");
    const folderId = parseRequiredString(body.folderId, "folderId");
    const responsibleDepartmentId = parseRequiredString(
      body.responsibleDepartmentId,
      "responsibleDepartmentId"
    );
    const documentType = this.parseDocumentType(parseRequiredString(body.documentType, "documentType"));
    const sizeBytes = parseSizeBytes(body.sizeBytes);
    const validUntil = parseOptionalDate(body.validUntil, "validUntil");

    const [folder, department, responsibleUser] = await Promise.all([
      this.prisma.folder.findFirst({ where: { id: folderId, deletedAt: null } }),
      this.prisma.department.findUnique({ where: { id: responsibleDepartmentId } }),
      body.responsiblePersonId
        ? this.prisma.user.findUnique({ where: { id: body.responsiblePersonId } })
        : this.prisma.user.findUnique({ where: { id: userId } })
    ]);

    if (!folder) {
      throw new NotFoundException("Klasör bulunamadı.");
    }

    if (!department) {
      throw new NotFoundException("Birim bulunamadı.");
    }

    if (!responsibleUser) {
      throw new NotFoundException("Sorumlu kişi bulunamadı.");
    }

    const createdDocument = await this.prisma.document.create({
      data: {
        folderId,
        name,
        originalFileName: buildOriginalFileName(name, documentType),
        mimeType: getMimeType(documentType),
        sizeBytes,
        documentType,
        responsibleDepartmentId,
        responsibleUserId: responsibleUser.id,
        validUntil,
        accessLevel: parseAccessLevel(body.accessLevel) ?? AccessLevel.DEPARTMENT,
        tags: buildMetadataTags(body),
        storageBucket: "metadata-only",
        storageKey: `metadata-only/${Date.now()}-${slugify(name)}`,
        createdById: userId
      },
      include: documentIncludes
    });

    this.auditService.logAsync({
      action: "DOCUMENT_METADATA_CREATE",
      entityType: "DOCUMENT",
      entityId: createdDocument.id,
      entityName: createdDocument.name,
      description: "Metadata-only document created",
      durationMs: Date.now() - startedAt,
      context: auditContext,
      metadata: {
        folderId,
        documentType,
        responsibleDepartmentId
      }
    });

    return ok(mapDocument(createdDocument));
  }

  async uploadDocument(
    body: UploadDocumentDto,
    file: UploadedDocumentFile | undefined,
    userId: string,
    auditContext?: AuditRequestContext
  ) {
    const startedAt = Date.now();
    if (!file?.buffer || file.size <= 0) {
      throw new BadRequestException("Dosya seçin.");
    }

    const name = parseRequiredString(body.name, "name");
    const folderId = parseRequiredString(body.folderId, "folderId");
    const responsibleDepartmentId = parseRequiredString(
      body.responsibleDepartmentId,
      "responsibleDepartmentId"
    );
    const documentType = this.parseDocumentType(parseRequiredString(body.documentType, "documentType"));
    const validUntil = parseOptionalDate(body.validUntil, "validUntil");

    const [folder, department, responsibleUser] = await Promise.all([
      this.prisma.folder.findFirst({ where: { id: folderId, deletedAt: null } }),
      this.prisma.department.findUnique({ where: { id: responsibleDepartmentId } }),
      body.responsiblePersonId
        ? this.prisma.user.findUnique({ where: { id: body.responsiblePersonId } })
        : this.prisma.user.findUnique({ where: { id: userId } })
    ]);

    if (!folder) {
      throw new NotFoundException("Klasör bulunamadı.");
    }

    if (!department) {
      throw new NotFoundException("Birim bulunamadı.");
    }

    if (!responsibleUser) {
      throw new NotFoundException("Sorumlu kişi bulunamadı.");
    }

    const storageBucket = this.storageService.getBucketName();
    const storageKey = buildUploadStorageKey(file.originalname);

    await this.storageService.uploadBuffer({
      key: storageKey,
      buffer: file.buffer,
      size: file.size,
      contentType: file.mimetype
    });

    const createdDocument = await this.prisma.document.create({
      data: {
        folderId,
        name,
        originalFileName: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: BigInt(file.size),
        documentType,
        responsibleDepartmentId,
        responsibleUserId: responsibleUser.id,
        validUntil,
        accessLevel: parseAccessLevel(body.accessLevel) ?? AccessLevel.DEPARTMENT,
        tags: buildUploadTags(body, file),
        storageBucket,
        storageKey,
        createdById: userId
      },
      include: documentIncludes
    });

    await this.createDocumentVersion({
      documentId: createdDocument.id,
      versionNo: createdDocument.revisionNo,
      originalFileName: file.originalname,
      mimeType: file.mimetype,
      storageBucket,
      storageKey,
      sizeBytes: BigInt(file.size),
      createdById: userId
    });
    this.indexFileText(createdDocument.id, createdDocument.revisionNo, file);
    this.auditService.logAsync({
      action: "DOCUMENT_UPLOAD",
      entityType: "DOCUMENT",
      entityId: createdDocument.id,
      entityName: createdDocument.name,
      description: "Document uploaded",
      durationMs: Date.now() - startedAt,
      context: auditContext,
      metadata: {
        folderId,
        documentType,
        fileName: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: file.size
      }
    });

    return ok(mapDocument(createdDocument));
  }

  async uploadNewVersion(
    documentId: string,
    file: UploadedDocumentFile | undefined,
    userId: string,
    auditContext?: AuditRequestContext
  ) {
    const startedAt = Date.now();

    if (!file?.buffer || file.size <= 0) {
      throw new BadRequestException("Dosya seçin.");
    }

    const existingDocument = await this.getExistingDocument(documentId, auditContext);
    const hasStoredFile = existingDocument.storageBucket === this.storageService.getBucketName();
    const storageBucket = this.storageService.getBucketName();
    const storageKey = buildUploadStorageKey(file.originalname);
    // A record without a file gets its first file as version 1.
    const nextVersionNo = hasStoredFile ? getNextVersionNo(existingDocument.revisionNo) : existingDocument.revisionNo;

    await this.storageService.uploadBuffer({
      key: storageKey,
      buffer: file.buffer,
      size: file.size,
      contentType: file.mimetype
    });

    if (hasStoredFile) {
      await this.createDocumentVersion({
        documentId: existingDocument.id,
        versionNo: existingDocument.revisionNo,
        originalFileName: existingDocument.originalFileName,
        mimeType: existingDocument.mimeType,
        storageBucket: existingDocument.storageBucket,
        storageKey: existingDocument.storageKey,
        sizeBytes: existingDocument.sizeBytes,
        createdById: existingDocument.createdById ?? userId
      });
    }

    const updatedDocument = await this.prisma.$transaction(async (transaction) => {
      // Search looks only at the current file.
      await transaction.documentVersion.updateMany({
        where: { documentId },
        data: { extractedText: null }
      });
      await transaction.documentVersion.create({
        data: {
          documentId,
          versionNo: nextVersionNo,
          originalFileName: file.originalname,
          mimeType: file.mimetype,
          storageBucket,
          storageKey,
          sizeBytes: BigInt(file.size),
          createdById: userId
        }
      });

      return transaction.document.update({
        where: { id: documentId },
        data: {
          originalFileName: file.originalname,
          mimeType: file.mimetype,
          sizeBytes: BigInt(file.size),
          revisionNo: nextVersionNo,
          tags: buildUploadTagsFromExisting(existingDocument.tags, file),
          storageBucket,
          storageKey
        },
        include: documentIncludes
      });
    });

    this.indexFileText(documentId, nextVersionNo, file);
    this.auditService.logAsync({
      action: "DOCUMENT_UPLOAD",
      entityType: "DOCUMENT",
      entityId: updatedDocument.id,
      entityName: updatedDocument.name,
      description: "Document version uploaded",
      durationMs: Date.now() - startedAt,
      context: auditContext,
      metadata: {
        versionNo: nextVersionNo,
        fileName: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: file.size
      }
    });

    return ok(mapDocument(updatedDocument));
  }

  async findVersions(id: string, viewer?: DocumentViewer) {
    const document = await this.prisma.document.findFirst({
      where: { id, deletedAt: null },
      include: {
        createdBy: true,
        versions: {
          include: { createdBy: true },
          orderBy: [{ createdAt: "desc" }]
        }
      }
    });

    if (!document || !canViewDocument(viewer, document)) {
      throw new NotFoundException("Belge bulunamadı.");
    }

    if (document.storageBucket !== this.storageService.getBucketName()) {
      return ok([]);
    }

    const versions = document.versions.map((version) => ({
      id: version.id,
      documentId: version.documentId,
      versionNo: version.versionNo,
      originalFileName: version.originalFileName,
      sizeBytes: version.sizeBytes.toString(),
      createdBy: mapVersionUser(version.createdBy),
      createdAt: version.createdAt,
      isActive: version.versionNo === document.revisionNo
    }));

    // Documents uploaded before version history existed have no version record yet.
    if (!versions.some((version) => version.versionNo === document.revisionNo)) {
      versions.unshift({
        id: document.id,
        documentId: document.id,
        versionNo: document.revisionNo,
        originalFileName: document.originalFileName,
        sizeBytes: document.sizeBytes.toString(),
        createdBy: mapVersionUser(document.createdBy),
        createdAt: document.updatedAt,
        isActive: true
      });
    }

    return ok(versions.sort(compareVersionsDescending));
  }

  async getWordPreview(id: string, auditContext?: AuditRequestContext, viewer?: DocumentViewer) {
    const { document, stream } = await this.getDocumentFile(id, auditContext, "DOCUMENT_PREVIEW", viewer);

    if (!document.originalFileName.toLowerCase().endsWith(".docx")) {
      throw new BadRequestException("Bu dosya burada açılmıyor. İndirip açabilirsiniz.");
    }

    const chunks: Buffer[] = [];

    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }

    try {
      return ok({ html: await renderWordPreview(Buffer.concat(chunks)) });
    } catch {
      throw new BadRequestException("Dosya okunamadı. İndirip açmayı deneyin.");
    }
  }

  async getDocumentVersionFile(
    id: string,
    versionId: string,
    auditContext?: AuditRequestContext,
    viewer?: DocumentViewer
  ) {
    const startedAt = Date.now();
    const document = await this.prisma.document.findFirst({
      where: { id, deletedAt: null }
    });

    if (!document || !canViewDocument(viewer, document)) {
      throw new NotFoundException("Belge bulunamadı.");
    }

    const version =
      versionId === document.id
        ? null
        : await this.prisma.documentVersion.findFirst({ where: { id: versionId, documentId: id } });

    if (versionId !== document.id && !version) {
      throw new NotFoundException("Belgenin bu sürümü bulunamadı.");
    }

    const stream = await this.storageService.getObject(version?.storageKey ?? document.storageKey);
    const versionNo = version?.versionNo ?? document.revisionNo;
    const originalFileName = version?.originalFileName ?? document.originalFileName;

    this.auditService.logAsync({
      action: "DOCUMENT_DOWNLOAD",
      entityType: "DOCUMENT_VERSION",
      entityId: version?.id ?? document.id,
      entityName: document.name,
      description: "Document version downloaded",
      durationMs: Date.now() - startedAt,
      context: auditContext,
      metadata: { documentId: document.id, versionNo, originalFileName }
    });

    return {
      fileName: buildVersionFileName(originalFileName, versionNo),
      mimeType: version?.mimeType ?? document.mimeType,
      stream
    };
  }

  private async createDocumentVersion(data: {
    documentId: string;
    versionNo: string;
    originalFileName?: string | null;
    mimeType?: string | null;
    storageBucket: string;
    storageKey: string;
    sizeBytes: bigint;
    extractedText?: string | null;
    createdById: string | null;
  }) {
    await this.prisma.documentVersion.upsert({
      where: {
        documentId_versionNo: {
          documentId: data.documentId,
          versionNo: data.versionNo
        }
      },
      update: {},
      create: data
    });
  }

  /** Reads the file's text in the background. A file that cannot be read still uploads normally. */
  private indexFileText(documentId: string, versionNo: string, file: UploadedDocumentFile) {
    void extractSearchableText(file)
      .then((extractedText) =>
        extractedText
          ? this.prisma.documentVersion.updateMany({
              where: { documentId, versionNo },
              data: { extractedText }
            })
          : undefined
      )
      .catch((error: unknown) => {
        this.logger.warn(`Text could not be read from a document (${documentId}): ${String(error)}`);
      });
  }

  async findAll(query: DocumentListQuery, viewer?: DocumentViewer) {
    const pagination = parsePagination(query.page, query.limit);

    const where = withDocumentAccess(withConditions(this.buildWhere(query), await this.buildScopeConditions(query, viewer)), viewer);

    const [items, total] = await Promise.all([
      this.prisma.document.findMany({
        where,
        include: documentIncludes,
        orderBy: [{ createdAt: "desc" }],
        skip: pagination.skip,
        take: pagination.limit
      }),
      this.prisma.document.count({ where })
    ]);

    return paginated(items.map(mapDocument), {
        page: pagination.page,
        limit: pagination.limit,
        total,
        totalPages: Math.ceil(total / pagination.limit)
    });
  }

  async findMyRecent(query: Pick<DocumentListQuery, "page" | "limit">, userId: string) {
    const pagination = parsePagination(query.page, query.limit);
    const where: Prisma.DocumentWhereInput = { createdById: userId, deletedAt: null };

    const [items, total] = await Promise.all([
      this.prisma.document.findMany({
        where,
        include: documentIncludes,
        orderBy: [{ createdAt: "desc" }],
        skip: pagination.skip,
        take: pagination.limit
      }),
      this.prisma.document.count({ where })
    ]);

    return paginated(items.map(mapDocument), {
      page: pagination.page,
      limit: pagination.limit,
      total,
      totalPages: Math.ceil(total / pagination.limit)
    });
  }

  async findRecent(query: Pick<DocumentListQuery, "page" | "limit">, viewer?: DocumentViewer) {
    const pagination = parsePagination(query.page, query.limit);
    const where = withDocumentAccess({ deletedAt: null }, viewer);

    const [items, total] = await Promise.all([
      this.prisma.document.findMany({
        where,
        include: documentIncludes,
        orderBy: [{ createdAt: "desc" }],
        skip: pagination.skip,
        take: pagination.limit
      }),
      this.prisma.document.count({ where })
    ]);

    return paginated(items.map(mapDocument), {
      page: pagination.page,
      limit: pagination.limit,
      total,
      totalPages: Math.ceil(total / pagination.limit)
    });
  }

  async findExpired(query: Pick<DocumentListQuery, "page" | "limit">, viewer?: DocumentViewer) {
    const pagination = parsePagination(query.page, query.limit);
    const where = withDocumentAccess(
      {
        deletedAt: null,
        ...expiredDocumentsWhere()
      },
      viewer
    );

    const [items, total] = await Promise.all([
      this.prisma.document.findMany({
        where,
        include: documentIncludes,
        orderBy: [{ validUntil: "desc" }, { createdAt: "desc" }],
        skip: pagination.skip,
        take: pagination.limit
      }),
      this.prisma.document.count({ where })
    ]);

    return paginated(items.map(mapDocument), {
      page: pagination.page,
      limit: pagination.limit,
      total,
      totalPages: Math.ceil(total / pagination.limit)
    });
  }

  async findExpiringSoon(query: Pick<DocumentListQuery, "page" | "limit">, viewer?: DocumentViewer) {
    const pagination = parsePagination(query.page, query.limit);
    const where = withDocumentAccess(
      {
        deletedAt: null,
        ...expiringDocumentsWhere()
      },
      viewer
    );

    const [items, total] = await Promise.all([
      this.prisma.document.findMany({
        where,
        include: documentIncludes,
        orderBy: [{ validUntil: "asc" }, { createdAt: "desc" }],
        skip: pagination.skip,
        take: pagination.limit
      }),
      this.prisma.document.count({ where })
    ]);

    return paginated(items.map(mapDocument), {
      page: pagination.page,
      limit: pagination.limit,
      total,
      totalPages: Math.ceil(total / pagination.limit)
    });
  }

  /** Who can be named responsible. Names only: staff do not need each other's addresses for this. */
  async findResponsibleOptions() {
    const users = await this.prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, firstName: true, lastName: true, department: { select: { name: true } } },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }]
    });

    return ok(
      users.map((user) => ({
        id: user.id,
        name: `${user.firstName} ${user.lastName}`.trim(),
        department: user.department?.name ?? null
      }))
    );
  }

  async updateDocument(
    id: string,
    body: UpdateDocumentDto,
    userId: string,
    auditContext?: AuditRequestContext
  ) {
    const startedAt = Date.now();
    const currentDocument = await this.getExistingDocument(id, auditContext);
    const data: Prisma.DocumentUpdateInput = {};
    const nextName = body.name?.trim();
    const nextFolderId = body.folderId?.trim();

    if (nextName !== undefined) {
      if (!nextName) {
        throw new BadRequestException("Ad boş olamaz.");
      }

      data.name = nextName;
    }

    if (nextFolderId !== undefined) {
      if (!nextFolderId) {
        throw new BadRequestException("Klasör seçin.");
      }

      const folder = await this.prisma.folder.findFirst({
        where: { id: nextFolderId, deletedAt: null },
        select: { id: true }
      });

      if (!folder) {
        throw new NotFoundException("Klasör bulunamadı.");
      }

      data.folder = {
        connect: { id: nextFolderId }
      };
    }

    if (body.accessLevel !== undefined) {
      const accessLevel = parseAccessLevel(body.accessLevel);

      if (!accessLevel) {
        throw new BadRequestException("Erişim seçimi geçersiz.");
      }

      data.accessLevel = accessLevel;
    }

    if (body.documentType !== undefined) {
      data.documentType = this.parseDocumentType(body.documentType);
    }

    if (body.validUntil !== undefined) {
      data.validUntil = body.validUntil ? parseOptionalDate(body.validUntil, "validUntil") : null;
    }

    if (body.responsibleDepartmentId !== undefined) {
      const department = await this.prisma.department.findUnique({
        where: { id: body.responsibleDepartmentId },
        select: { id: true }
      });

      if (!department) {
        throw new NotFoundException("Birim bulunamadı.");
      }

      data.responsibleDepartment = { connect: { id: department.id } };
    }

    if (body.responsiblePersonId !== undefined) {
      const person = await this.prisma.user.findFirst({
        where: { id: body.responsiblePersonId, isActive: true },
        select: { id: true }
      });

      if (!person) {
        throw new NotFoundException("Sorumlu kişi bulunamadı.");
      }

      data.responsibleUser = { connect: { id: person.id } };
    }

    if (body.description !== undefined) {
      data.tags = { ...toJsonObject(currentDocument.tags), description: body.description?.trim() || null };
    }

    if (Object.keys(data).length === 0) {
      throw new BadRequestException("Değiştirilecek bir bilgi girin.");
    }

    const finalFolderId = nextFolderId ?? currentDocument.folderId;
    const finalName = nextName ?? currentDocument.name;
    await this.ensureDocumentNameAvailable(finalFolderId, finalName, id);

    const updatedDocument = await this.prisma.document.update({
      where: { id },
      data,
      include: documentIncludes
    });

    const renamed = nextName !== undefined && nextName !== currentDocument.name;
    const moved = nextFolderId !== undefined && nextFolderId !== currentDocument.folderId;
    const detailsChanged =
      body.accessLevel !== undefined ||
      body.documentType !== undefined ||
      body.validUntil !== undefined ||
      body.responsibleDepartmentId !== undefined ||
      body.responsiblePersonId !== undefined ||
      body.description !== undefined;
    const action: AuditAction = detailsChanged
      ? "DOCUMENT_UPDATE"
      : moved && !renamed
        ? "DOCUMENT_MOVE"
        : renamed && !moved
          ? "DOCUMENT_RENAME"
          : "DOCUMENT_MOVE";

    this.auditService.logAsync({
      action,
      entityType: "DOCUMENT",
      entityId: updatedDocument.id,
      entityName: updatedDocument.name,
      description: detailsChanged
        ? "Document details updated"
        : moved && renamed
          ? "Document renamed and moved"
          : moved
            ? "Document moved"
            : "Document renamed",
      durationMs: Date.now() - startedAt,
      context: auditContext,
      metadata: {
        userId,
        previousName: currentDocument.name,
        nextName: updatedDocument.name,
        previousFolderId: currentDocument.folderId,
        nextFolderId: updatedDocument.folderId
      }
    });

    return ok(mapDocument(updatedDocument));
  }

  async copyDocument(
    id: string,
    body: CopyDocumentDto,
    userId: string,
    auditContext?: AuditRequestContext
  ) {
    const startedAt = Date.now();
    const sourceDocument = await this.getExistingDocument(id, auditContext);
    const folderId = parseRequiredString(body.folderId, "folderId");

    const folder = await this.prisma.folder.findFirst({
      where: { id: folderId, deletedAt: null },
      select: { id: true }
    });

    if (!folder) {
      throw new NotFoundException("Klasör bulunamadı.");
    }

    const requestedName = body.name?.trim();
    const name = requestedName || (await this.getAvailableDocumentCopyName(sourceDocument.name, folderId));
    await this.ensureDocumentNameAvailable(folderId, name);

    const copiedDocument = await this.prisma.document.create({
      data: {
        folderId,
        name,
        originalFileName: sourceDocument.originalFileName,
        mimeType: sourceDocument.mimeType,
        sizeBytes: sourceDocument.sizeBytes,
        documentType: sourceDocument.documentType,
        responsibleDepartmentId: sourceDocument.responsibleDepartmentId,
        responsibleUserId: sourceDocument.responsibleUserId,
        validUntil: sourceDocument.validUntil,
        revisionNo: sourceDocument.revisionNo,
        accessLevel: sourceDocument.accessLevel,
        tags: buildCopyTags(sourceDocument.tags, sourceDocument.id),
        storageBucket: sourceDocument.storageBucket,
        storageKey: sourceDocument.storageKey,
        createdById: userId
      },
      include: documentIncludes
    });

    const sourceVersion = await this.prisma.documentVersion.findFirst({
      where: { documentId: sourceDocument.id, versionNo: sourceDocument.revisionNo }
    });

    if (sourceVersion) {
      await this.createDocumentVersion({
        documentId: copiedDocument.id,
        versionNo: sourceVersion.versionNo,
        originalFileName: sourceVersion.originalFileName,
        mimeType: sourceVersion.mimeType,
        storageBucket: sourceVersion.storageBucket,
        storageKey: sourceVersion.storageKey,
        sizeBytes: sourceVersion.sizeBytes,
        extractedText: sourceVersion.extractedText,
        createdById: userId
      });
    }

    this.auditService.logAsync({
      action: "DOCUMENT_COPY",
      entityType: "DOCUMENT",
      entityId: copiedDocument.id,
      entityName: copiedDocument.name,
      description: "Document copied",
      durationMs: Date.now() - startedAt,
      context: auditContext,
      metadata: {
        userId,
        sourceDocumentId: sourceDocument.id,
        sourceFolderId: sourceDocument.folderId,
        targetFolderId: folderId
      }
    });

    return ok(mapDocument(copiedDocument));
  }

  async softDeleteDocument(id: string, userId: string, auditContext?: AuditRequestContext) {
    const startedAt = Date.now();
    const currentDocument = await this.getExistingDocument(id, auditContext);
    const deletedAt = new Date();

    const deletedDocument = await this.prisma.document.update({
      where: { id },
      data: {
        deletedAt,
        deletedById: userId
      },
      include: documentIncludes
    });

    this.auditService.logAsync({
      action: "DOCUMENT_SOFT_DELETE",
      entityType: "DOCUMENT",
      entityId: deletedDocument.id,
      entityName: deletedDocument.name,
      description: "Belge geri dönüşüm kutusuna taşındı.",
      durationMs: Date.now() - startedAt,
      context: auditContext,
      metadata: {
        folderId: currentDocument.folderId,
        deletedAt
      }
    });

    return ok(mapDocument(deletedDocument));
  }

  async findById(id: string, viewer?: DocumentViewer) {
    const document = await this.prisma.document.findFirst({
      where: { id, deletedAt: null },
      include: documentIncludes
    });

    if (!document || !canViewDocument(viewer, document)) {
      throw new NotFoundException("Belge bulunamadı.");
    }

    return ok(mapDocument(document));
  }

  async getDocumentFile(
    id: string,
    auditContext?: AuditRequestContext,
    auditAction: AuditAction = "DOCUMENT_PREVIEW",
    viewer?: DocumentViewer
  ) {
    const startedAt = Date.now();
    const document = await this.prisma.document.findFirst({
      where: { id, deletedAt: null },
      include: documentIncludes
    });

    if (!document || !canViewDocument(viewer, document)) {
      throw new NotFoundException("Belge bulunamadı.");
    }

    if (document.storageBucket !== this.storageService.getBucketName() || !document.storageKey) {
      throw new NotFoundException("Belgenin dosyası bulunamadı.");
    }

    const stream = await this.storageService.getObject(document.storageKey);

    this.auditService.logAsync({
      action: auditAction,
      entityType: "DOCUMENT",
      entityId: document.id,
      entityName: document.name,
      description: auditAction === "DOCUMENT_DOWNLOAD" ? "Document downloaded" : "Document previewed",
      durationMs: Date.now() - startedAt,
      context: auditContext,
      metadata: {
        originalFileName: document.originalFileName,
        mimeType: document.mimeType
      }
    });

    return {
      document: mapDocument(document),
      stream
    };
  }

  private async getExistingDocument(id: string, auditContext?: AuditRequestContext) {
    const document = await this.prisma.document.findFirst({
      where: { id, deletedAt: null },
      include: documentIncludes
    });

    if (!document || !canViewDocument(viewerFromContext(auditContext), document)) {
      throw new NotFoundException("Belge bulunamadı.");
    }

    return document;
  }

  private async ensureDocumentNameAvailable(folderId: string, name: string, currentDocumentId?: string) {
    const conflict = await this.prisma.document.findFirst({
      where: {
        folderId,
        name,
        deletedAt: null,
        ...(currentDocumentId ? { id: { not: currentDocumentId } } : {})
      },
      select: { id: true }
    });

    if (conflict) {
      throw new ConflictException("Bu klasörde aynı adda bir belge var.");
    }
  }

  private async getAvailableDocumentCopyName(name: string, folderId: string) {
    const baseName = `${name} - Kopya`;

    for (let index = 0; index < 100; index += 1) {
      const candidate = index === 0 ? baseName : `${baseName} ${index + 1}`;
      const conflict = await this.prisma.document.findFirst({
        where: {
          folderId,
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

  /** Narrows a list to where the person is looking: a folder with everything under it, or one of the side menu lists. */
  private async buildScopeConditions(query: DocumentListQuery, viewer?: DocumentViewer) {
    const conditions: Prisma.DocumentWhereInput[] = [];

    if (query.underFolderId) {
      conditions.push({ folderId: { in: await this.findFolderSubtreeIds(query.underFolderId) } });
    }

    if (query.listScope) {
      conditions.push(listScopeWhere(query.listScope, viewer));
    }

    return conditions;
  }

  private async findFolderSubtreeIds(folderId: string) {
    const rows = await this.prisma.$queryRaw<Array<{ id: string }>>`
      WITH RECURSIVE subtree AS (
        SELECT id FROM "Folder" WHERE id = ${folderId} AND "deletedAt" IS NULL
        UNION ALL
        SELECT child.id FROM "Folder" child
        JOIN subtree ON child."parentId" = subtree.id
        WHERE child."deletedAt" IS NULL
      )
      SELECT id FROM subtree
    `;

    return rows.map((row) => row.id);
  }

  private buildWhere(query: DocumentListQuery): Prisma.DocumentWhereInput {
    const where: Prisma.DocumentWhereInput = { deletedAt: null };

    if (query.q) {
      const matchingDocumentTypes = getMatchingDocumentTypes(query.q);
      where.OR = [
        { name: { contains: query.q, mode: "insensitive" } },
        { originalFileName: { contains: query.q, mode: "insensitive" } },
        { mimeType: { contains: query.q, mode: "insensitive" } },
        { responsibleDepartment: { name: { contains: query.q, mode: "insensitive" } } },
        { responsibleDepartment: { code: { contains: query.q, mode: "insensitive" } } },
        { responsibleUser: { firstName: { contains: query.q, mode: "insensitive" } } },
        { responsibleUser: { lastName: { contains: query.q, mode: "insensitive" } } },
        { responsibleUser: { email: { contains: query.q, mode: "insensitive" } } },
        { tags: { string_contains: query.q } },
        { versions: { some: { extractedText: { contains: foldSearchText(query.q) } } } },
        ...(matchingDocumentTypes.length > 0 ? [{ documentType: { in: matchingDocumentTypes } }] : [])
      ];
    }

    if (query.folderId) {
      where.folderId = query.folderId;
    }

    if (query.documentType) {
      where.documentType = this.parseDocumentType(query.documentType);
    }

    if (query.fileType) {
      where.AND = [...(Array.isArray(where.AND) ? where.AND : []), buildFileTypeFilter(query.fileType)];
    }

    if (query.departmentId) {
      where.responsibleDepartmentId = query.departmentId;
    }

    const validUntilFrom = parseOptionalDate(query.validUntilFrom, "validUntilFrom");
    const validUntilTo = parseOptionalDate(query.validUntilTo, "validUntilTo");

    if (validUntilFrom || validUntilTo) {
      where.validUntil = {
        ...(validUntilFrom ? { gte: validUntilFrom } : {}),
        ...(validUntilTo ? { lte: validUntilTo } : {})
      };
    }

    const sizeMinBytes = parseOptionalBigInt(query.sizeMinBytes, "sizeMinBytes");
    const sizeMaxBytes = parseOptionalBigInt(query.sizeMaxBytes, "sizeMaxBytes");

    if (sizeMinBytes !== undefined || sizeMaxBytes !== undefined) {
      where.sizeBytes = {
        ...(sizeMinBytes !== undefined ? { gte: sizeMinBytes } : {}),
        ...(sizeMaxBytes !== undefined ? { lte: sizeMaxBytes } : {})
      };
    }

    return where;
  }

  private parseDocumentType(value: string): DocumentType {
    if (!Object.values(DocumentType).includes(value as DocumentType)) {
      throw new BadRequestException("Belge türü geçersiz.");
    }

    return value as DocumentType;
  }
}

function getMatchingDocumentTypes(value: string) {
  const normalizedValue = value.trim().toLocaleUpperCase("tr-TR");

  if (!normalizedValue) {
    return [];
  }

  const typeAliases: Record<DocumentType, string[]> = {
    REPORT: ["REPORT", "RAPOR", "PDF"],
    PRESENTATION: ["PRESENTATION", "SUNUM", "PPT", "PPTX"],
    GUIDE: ["GUIDE", "KILAVUZ", "KILAVUZ", "REHBER"],
    FORM: ["FORM", "WORD", "DOC", "DOCX"],
    MINUTES: ["MINUTES", "TUTANAK"],
    OTHER: ["OTHER", "DIGER", "DİĞER", "EXCEL", "XLS", "XLSX"]
  };

  return Object.values(DocumentType).filter((type) =>
    typeAliases[type].some((alias) => alias.includes(normalizedValue) || normalizedValue.includes(alias))
  );
}

function parseOptionalBigInt(value: string | undefined, fieldName: string) {
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);

  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new BadRequestException("Sayı geçersiz.");
  }

  return BigInt(parsed);
}

function parseRequiredString(value: string | undefined, fieldName: string) {
  const parsed = value?.trim();

  if (!parsed) {
    throw new BadRequestException("Zorunlu alanları doldurun.");
  }

  return parsed;
}

function parseSizeBytes(value: CreateDocumentMetadataDto["sizeBytes"]) {
  if (value === undefined || value === null || value === "") {
    return BigInt(0);
  }

  const parsed = Number(value);

  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new BadRequestException("Dosya boyutu geçersiz.");
  }

  return BigInt(parsed);
}

function buildMetadataTags(body: CreateDocumentMetadataDto): Prisma.InputJsonObject {
  return {
    source: "metadata-only",
    sizeLabel: body.sizeLabel?.trim() ?? null,
    description: body.description?.trim() ?? null
  };
}

function buildUploadTags(body: UploadDocumentDto, file: UploadedDocumentFile): Prisma.InputJsonObject {
  return {
    source: "upload",
    sizeLabel: formatSizeLabel(file.size),
    description: body.description?.trim() ?? null,
    originalFileName: file.originalname
  };
}

function buildUploadTagsFromExisting(currentTags: Prisma.JsonValue, file: UploadedDocumentFile): Prisma.InputJsonObject {
  return {
    ...toJsonObject(currentTags),
    source: "upload",
    sizeLabel: formatSizeLabel(file.size),
    originalFileName: file.originalname
  };
}

function getNextVersionNo(currentVersionNo: string) {
  const parsed = Number(currentVersionNo);

  return Number.isInteger(parsed) && parsed > 0 ? String(parsed + 1) : `${currentVersionNo}.1`;
}

function compareVersionsDescending(
  left: { versionNo: string; createdAt: Date },
  right: { versionNo: string; createdAt: Date }
) {
  const leftVersion = Number(left.versionNo);
  const rightVersion = Number(right.versionNo);

  if (Number.isFinite(leftVersion) && Number.isFinite(rightVersion) && leftVersion !== rightVersion) {
    return rightVersion - leftVersion;
  }

  return right.createdAt.getTime() - left.createdAt.getTime();
}

function mapVersionUser(user: { id: string; firstName: string; lastName: string; title: string | null; email: string } | null) {
  if (!user) {
    return null;
  }

  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    title: user.title,
    email: user.email
  };
}

function buildVersionFileName(fileName: string, versionNo: string) {
  const extension = fileName.includes(".") ? `.${fileName.split(".").pop()}` : "";
  const baseName = extension ? fileName.slice(0, -extension.length) : fileName;

  return `${baseName}-v${versionNo}${extension}`;
}

function buildCopyTags(currentTags: Prisma.JsonValue, sourceDocumentId: string): Prisma.InputJsonObject {
  const current = toJsonObject(currentTags);

  return {
    ...current,
    copiedFromDocumentId: sourceDocumentId,
    copiedAt: new Date().toISOString()
  };
}

function buildOriginalFileName(name: string, documentType: DocumentType) {
  return `${slugify(name)}${getExtension(documentType)}`;
}

function getExtension(documentType: DocumentType) {
  const extensions: Record<DocumentType, string> = {
    REPORT: ".pdf",
    PRESENTATION: ".pptx",
    GUIDE: ".pdf",
    FORM: ".docx",
    MINUTES: ".docx",
    OTHER: ".bin"
  };

  return extensions[documentType];
}

function getMimeType(documentType: DocumentType) {
  const mimeTypes: Record<DocumentType, string> = {
    REPORT: "application/pdf",
    PRESENTATION: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    GUIDE: "application/pdf",
    FORM: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    MINUTES: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    OTHER: "application/octet-stream"
  };

  return mimeTypes[documentType];
}

/** What the file type filter on the screens means. Paper records have no file, so they never match. */
const FILE_TYPE_FILTERS: Record<string, { mimeTypes: string[]; extensions: string[] }> = {
  PDF: { mimeTypes: ["application/pdf"], extensions: [".pdf"] },
  WORD: {
    mimeTypes: ["application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
    extensions: [".doc", ".docx"]
  },
  EXCEL: {
    mimeTypes: ["application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
    extensions: [".xls", ".xlsx"]
  },
  POWERPOINT: {
    mimeTypes: ["application/vnd.ms-powerpoint", "application/vnd.openxmlformats-officedocument.presentationml.presentation"],
    extensions: [".ppt", ".pptx"]
  },
  TEXT: { mimeTypes: ["text/plain"], extensions: [".txt"] },
  IMAGE: { mimeTypes: ["image/png", "image/jpeg"], extensions: [".png", ".jpg", ".jpeg"] }
};

/** "Expired" and "expiring soon" mean the same thing on their own lists and when filtering inside them. */
function expiredDocumentsWhere(): Prisma.DocumentWhereInput {
  return { validUntil: { lt: startOfToday() } };
}

function expiringDocumentsWhere(): Prisma.DocumentWhereInput {
  return { validUntil: { gte: startOfToday(), lte: daysFromToday(30) } };
}

function listScopeWhere(listScope: string, viewer?: DocumentViewer): Prisma.DocumentWhereInput {
  switch (listScope) {
    case "mine":
      return { createdById: viewer?.sub ?? "kimse" };
    case "expired":
      return expiredDocumentsWhere();
    case "expiring":
      return expiringDocumentsWhere();
    default:
      throw new BadRequestException("Seçilen liste geçersiz.");
  }
}

function withConditions(where: Prisma.DocumentWhereInput, conditions: Prisma.DocumentWhereInput[]): Prisma.DocumentWhereInput {
  return conditions.length > 0 ? { AND: [where, ...conditions] } : where;
}

function buildFileTypeFilter(fileType: string): Prisma.DocumentWhereInput {
  const filter = FILE_TYPE_FILTERS[fileType];

  if (!filter) {
    throw new BadRequestException("Seçilen dosya türü geçersiz.");
  }

  return {
    storageBucket: { not: "metadata-only" },
    OR: [
      { mimeType: { in: filter.mimeTypes } },
      ...filter.extensions.map((extension) => ({ originalFileName: { endsWith: extension, mode: "insensitive" as const } }))
    ]
  };
}

function slugify(value: string) {
  return value
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "document";
}

function buildUploadStorageKey(fileName: string) {
  const safeName = slugifyFileName(fileName);

  return `documents/${Date.now()}-${crypto.randomUUID()}-${safeName}`;
}

function slugifyFileName(fileName: string) {
  const extension = fileName.includes(".") ? `.${fileName.split(".").pop()?.toLowerCase()}` : "";
  const baseName = extension ? fileName.slice(0, -extension.length) : fileName;

  return `${slugify(baseName)}${extension}`;
}

function formatSizeLabel(sizeBytes: number) {
  if (sizeBytes >= 1024 * 1024) {
    return `${(sizeBytes / 1024 / 1024).toFixed(2)} MB`;
  }

  if (sizeBytes >= 1024) {
    return `${Math.round(sizeBytes / 1024)} KB`;
  }

  return `${sizeBytes} B`;
}

function toJsonObject(value: Prisma.JsonValue): Prisma.InputJsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Prisma.InputJsonObject;
}

