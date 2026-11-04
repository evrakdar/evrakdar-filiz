import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { getAuditContext } from "../audit/audit.types";
import type { AuthenticatedRequest } from "../auth/auth.types";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { DocumentsService } from "./documents.service";
import { assertUploadContentMatches, isAllowedUploadFile } from "./upload-validation";

export type DocumentListQuery = {
  q?: string;
  folderId?: string;
  documentType?: string;
  fileType?: string;
  underFolderId?: string;
  listScope?: string;
  departmentId?: string;
  validUntilFrom?: string;
  validUntilTo?: string;
  sizeMinBytes?: string;
  sizeMaxBytes?: string;
  page?: string;
  limit?: string;
};

export type CreateDocumentMetadataDto = {
  name?: string;
  folderId?: string;
  documentType?: string;
  sizeLabel?: string;
  sizeBytes?: string | number;
  responsibleDepartmentId?: string;
  responsiblePersonId?: string;
  validUntil?: string;
  description?: string;
  accessLevel?: string;
};

export type UploadDocumentDto = Omit<CreateDocumentMetadataDto, "sizeBytes" | "sizeLabel">;
export type UpdateDocumentDto = {
  name?: string;
  folderId?: string;
  accessLevel?: string;
  documentType?: string;
  validUntil?: string | null;
  responsibleDepartmentId?: string;
  responsiblePersonId?: string;
  description?: string | null;
};

export type CopyDocumentDto = {
  folderId?: string;
  name?: string;
};

export type UploadedDocumentFile = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};

type FileResponse = NodeJS.WritableStream & {
  setHeader(name: string, value: string): void;
};

const maxUploadSizeBytes = 20 * 1024 * 1024;

@Controller("documents")
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN", "EDITOR")
  createMetadataOnly(
    @Req() request: AuthenticatedRequest,
    @Body() body: CreateDocumentMetadataDto
  ) {
    return this.documentsService.createMetadataOnly(body, request.user!.sub, getAuditContext(request));
  }

  @Post("upload")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN", "EDITOR")
  @UseInterceptors(
    FileInterceptor("file", {
      limits: { fileSize: maxUploadSizeBytes },
      fileFilter: (_request, file, callback) => {
        if (isAllowedUploadFile(file.originalname, file.mimetype)) {
          callback(null, true);
          return;
        }

        callback(new BadRequestException("Bu dosya türü kabul edilmiyor."), false);
      }
    })
  )
  upload(
    @Req() request: AuthenticatedRequest,
    @UploadedFile() file: UploadedDocumentFile | undefined,
    @Body() body: UploadDocumentDto
  ) {
    if (file) {
      file.originalname = decodeUploadFileName(file.originalname);
      assertUploadContentMatches(file);
    }

    return this.documentsService.uploadDocument(body, file, request.user!.sub, getAuditContext(request));
  }

  @Post(":id/new-version")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN", "EDITOR")
  @UseInterceptors(
    FileInterceptor("file", {
      limits: { fileSize: maxUploadSizeBytes },
      fileFilter: (_request, file, callback) => {
        if (isAllowedUploadFile(file.originalname, file.mimetype)) {
          callback(null, true);
          return;
        }

        callback(new BadRequestException("Bu dosya türü kabul edilmiyor."), false);
      }
    })
  )
  uploadNewVersion(
    @Param("id") id: string,
    @Req() request: AuthenticatedRequest,
    @UploadedFile() file: UploadedDocumentFile | undefined
  ) {
    if (file) {
      file.originalname = decodeUploadFileName(file.originalname);
      assertUploadContentMatches(file);
    }

    return this.documentsService.uploadNewVersion(id, file, request.user!.sub, getAuditContext(request));
  }

  @Get(":id/versions")
  findVersions(@Param("id") id: string, @Req() request: AuthenticatedRequest) {
    return this.documentsService.findVersions(id, request.user);
  }

  @Get(":id/versions/:versionId/download")
  async downloadVersion(
    @Param("id") id: string,
    @Param("versionId") versionId: string,
    @Req() request: AuthenticatedRequest,
    @Res() response: FileResponse
  ) {
    const file = await this.documentsService.getDocumentVersionFile(
      id,
      versionId,
      getAuditContext(request),
      request.user
    );

    response.setHeader("Content-Type", file.mimeType || "application/octet-stream");
    response.setHeader("Content-Disposition", buildContentDisposition("attachment", file.fileName));

    file.stream.pipe(response);
  }

  @Get()
  findAll(@Req() request: AuthenticatedRequest, @Query() query: DocumentListQuery) {
    return this.documentsService.findAll(query, request.user);
  }

  @Get("responsible-options")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN", "EDITOR")
  findResponsibleOptions() {
    return this.documentsService.findResponsibleOptions();
  }

  @Get("my-recent")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN", "EDITOR")
  findMyRecent(
    @Req() request: AuthenticatedRequest,
    @Query() query: Pick<DocumentListQuery, "page" | "limit">
  ) {
    return this.documentsService.findMyRecent(query, request.user!.sub);
  }

  @Get("recent")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN", "EDITOR", "VIEWER")
  findRecent(@Req() request: AuthenticatedRequest, @Query() query: Pick<DocumentListQuery, "page" | "limit">) {
    return this.documentsService.findRecent(query, request.user);
  }

  @Get("expired")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN", "EDITOR", "VIEWER")
  findExpired(@Req() request: AuthenticatedRequest, @Query() query: Pick<DocumentListQuery, "page" | "limit">) {
    return this.documentsService.findExpired(query, request.user);
  }

  @Get("expiring-soon")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN", "EDITOR", "VIEWER")
  findExpiringSoon(@Req() request: AuthenticatedRequest, @Query() query: Pick<DocumentListQuery, "page" | "limit">) {
    return this.documentsService.findExpiringSoon(query, request.user);
  }

  @Patch(":id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN", "EDITOR")
  updateDocument(
    @Param("id") id: string,
    @Req() request: AuthenticatedRequest,
    @Body() body: UpdateDocumentDto
  ) {
    return this.documentsService.updateDocument(id, body, request.user!.sub, getAuditContext(request));
  }

  @Post(":id/copy")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN", "EDITOR")
  copyDocument(
    @Param("id") id: string,
    @Req() request: AuthenticatedRequest,
    @Body() body: CopyDocumentDto
  ) {
    return this.documentsService.copyDocument(id, body, request.user!.sub, getAuditContext(request));
  }

  @Delete(":id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN", "EDITOR")
  softDeleteDocument(@Param("id") id: string, @Req() request: AuthenticatedRequest) {
    return this.documentsService.softDeleteDocument(id, request.user!.sub, getAuditContext(request));
  }

  @Get(":id/preview")
  @UseGuards(JwtAuthGuard)
  previewDocument(@Param("id") id: string, @Req() request: AuthenticatedRequest) {
    return this.documentsService.getWordPreview(id, getAuditContext(request), request.user);
  }

  @Get(":id/file")
  @UseGuards(JwtAuthGuard)
  async streamFile(@Param("id") id: string, @Req() request: AuthenticatedRequest, @Res() response: FileResponse) {
    const file = await this.documentsService.getDocumentFile(id, getAuditContext(request), "DOCUMENT_PREVIEW", request.user);

    response.setHeader("Content-Type", file.document.mimeType || "application/octet-stream");
    response.setHeader("Content-Disposition", buildContentDisposition("inline", file.document.originalFileName));

    file.stream.pipe(response);
  }

  @Get(":id/download")
  @UseGuards(JwtAuthGuard)
  async downloadFile(@Param("id") id: string, @Req() request: AuthenticatedRequest, @Res() response: FileResponse) {
    const file = await this.documentsService.getDocumentFile(id, getAuditContext(request), "DOCUMENT_DOWNLOAD", request.user);

    response.setHeader("Content-Type", file.document.mimeType || "application/octet-stream");
    response.setHeader("Content-Disposition", buildContentDisposition("attachment", file.document.originalFileName));

    file.stream.pipe(response);
  }

  @Get(":id")
  findById(@Param("id") id: string, @Req() request: AuthenticatedRequest) {
    return this.documentsService.findById(id, request.user);
  }
}

// Browsers send file names as UTF-8, the upload parser reads them as latin1.
function decodeUploadFileName(fileName: string) {
  const decoded = Buffer.from(fileName, "latin1").toString("utf8");

  return decoded.includes("\uFFFD") ? fileName : decoded;
}

function buildContentDisposition(type: "inline" | "attachment", fileName: string) {
  const fallbackName = fileName.replace(/[^\x20-\x7E]/g, "_").replace(/"/g, "'");
  const encodedName = encodeURIComponent(fileName);

  return `${type}; filename="${fallbackName}"; filename*=UTF-8''${encodedName}`;
}
