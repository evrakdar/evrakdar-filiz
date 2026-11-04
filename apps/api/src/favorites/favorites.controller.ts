import { Controller, Delete, Get, Param, Post, Req, UseGuards } from "@nestjs/common";
import { getAuditContext } from "../audit/audit.types";
import type { AuthenticatedRequest } from "../auth/auth.types";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { FavoritesService } from "./favorites.service";

@Controller("favorites")
@UseGuards(JwtAuthGuard)
export class FavoritesController {
  constructor(private readonly favoritesService: FavoritesService) {}

  @Get()
  findAll(@Req() request: AuthenticatedRequest) {
    return this.favoritesService.findAll(request.user!.sub, request.user);
  }

  @Post(":documentId")
  add(@Req() request: AuthenticatedRequest, @Param("documentId") documentId: string) {
    return this.favoritesService.addDocument(request.user!.sub, documentId, getAuditContext(request));
  }

  @Delete(":documentId")
  remove(@Req() request: AuthenticatedRequest, @Param("documentId") documentId: string) {
    return this.favoritesService.removeDocument(request.user!.sub, documentId, getAuditContext(request));
  }
}
