import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { getAuditContext } from "../audit/audit.types";
import type { AuthenticatedRequest } from "../auth/auth.types";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { FoldersService } from "./folders.service";

export type CreateFolderDto = {
  name?: string;
  parentId?: string;
};

export type UpdateFolderDto = {
  name?: string;
  parentId?: string | null;
};

export type CopyFolderDto = {
  name?: string;
  parentId?: string;
};

@Controller("folders")
export class FoldersController {
  constructor(private readonly foldersService: FoldersService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN", "EDITOR")
  createFolder(@Req() request: AuthenticatedRequest, @Body() body: CreateFolderDto) {
    return this.foldersService.createFolder(body, request.user!.sub, getAuditContext(request), request.user!.roles);
  }

  @Get("root")
  findRoot() {
    return this.foldersService.findRoot();
  }

  @Get(":id")
  findById(@Param("id") id: string) {
    return this.foldersService.findById(id);
  }

  @Get(":id/children")
  findChildren(@Param("id") id: string, @Req() request: AuthenticatedRequest) {
    return this.foldersService.findChildren(id, request.user);
  }

  @Get(":id/breadcrumb")
  findBreadcrumb(@Param("id") id: string) {
    return this.foldersService.findBreadcrumb(id);
  }

  @Patch(":id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN", "EDITOR")
  updateFolder(
    @Param("id") id: string,
    @Req() request: AuthenticatedRequest,
    @Body() body: UpdateFolderDto
  ) {
    return this.foldersService.updateFolder(id, body, request.user!.sub, getAuditContext(request), request.user!.roles);
  }

  @Post(":id/copy")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN", "EDITOR")
  copyFolder(
    @Param("id") id: string,
    @Req() request: AuthenticatedRequest,
    @Body() body: CopyFolderDto
  ) {
    return this.foldersService.copyFolder(id, body, request.user!.sub, getAuditContext(request));
  }

  @Delete(":id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN", "EDITOR")
  deleteFolder(@Param("id") id: string, @Req() request: AuthenticatedRequest) {
    return this.foldersService.deleteFolder(id, request.user!.sub, getAuditContext(request), request.user!.roles);
  }
}
