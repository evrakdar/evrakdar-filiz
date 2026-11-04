import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { AuditModule } from "../audit/audit.module";
import { FoldersController } from "./folders.controller";
import { FoldersService } from "./folders.service";

@Module({
  imports: [JwtModule, AuditModule],
  controllers: [FoldersController],
  providers: [FoldersService, JwtAuthGuard, RolesGuard]
})
export class FoldersModule {}
