import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { AuditModule } from "../audit/audit.module";
import { PrismaModule } from "../prisma/prisma.module";
import { FavoritesController } from "./favorites.controller";
import { FavoritesService } from "./favorites.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

@Module({
  imports: [PrismaModule, JwtModule, AuditModule],
  controllers: [FavoritesController],
  providers: [FavoritesService, JwtAuthGuard]
})
export class FavoritesModule {}
