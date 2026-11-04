import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { AuditModule } from "../audit/audit.module";
import { StorageModule } from "../storage/storage.module";
import { DocumentsController } from "./documents.controller";
import { DocumentsService } from "./documents.service";

@Module({
  imports: [JwtModule, AuditModule, StorageModule],
  controllers: [DocumentsController],
  providers: [DocumentsService, JwtAuthGuard, RolesGuard]
})
export class DocumentsModule {}
