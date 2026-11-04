import { Controller, Delete, Get, Param, Post, Req, UseGuards } from "@nestjs/common";
import { getAuditContext } from "../audit/audit.types";
import type { AuthenticatedRequest } from "../auth/auth.types";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { TrashService } from "./trash.service";

@Controller("trash")
@UseGuards(JwtAuthGuard)
export class TrashController {
  constructor(private readonly trashService: TrashService) {}

  @Get()
  findAll(@Req() request: AuthenticatedRequest) {
    return this.trashService.findAll(request.user);
  }

  @Post("documents/:id/restore")
  @UseGuards(RolesGuard)
  @Roles("ADMIN", "EDITOR")
  restoreDocument(@Param("id") id: string, @Req() request: AuthenticatedRequest) {
    return this.trashService.restoreDocument(id, request.user!.sub, getAuditContext(request));
  }

  @Delete("documents/:id")
  @UseGuards(RolesGuard)
  @Roles("ADMIN", "EDITOR")
  permanentlyDeleteDocument(@Param("id") id: string, @Req() request: AuthenticatedRequest) {
    return this.trashService.permanentlyDeleteDocument(id, request.user!.sub, getAuditContext(request));
  }

  @Post("folders/:id/restore")
  @UseGuards(RolesGuard)
  @Roles("ADMIN", "EDITOR")
  restoreFolder(@Param("id") id: string, @Req() request: AuthenticatedRequest) {
    return this.trashService.restoreFolder(id, request.user!.sub, getAuditContext(request));
  }

  @Delete("folders/:id")
  @UseGuards(RolesGuard)
  @Roles("ADMIN", "EDITOR")
  permanentlyDeleteFolder(@Param("id") id: string, @Req() request: AuthenticatedRequest) {
    return this.trashService.permanentlyDeleteFolder(id, request.user!.sub, getAuditContext(request));
  }
}
