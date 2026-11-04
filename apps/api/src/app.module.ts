import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { JwtModule } from "@nestjs/jwt";
import { AdminModule } from "./admin/admin.module";
import { AuditModule } from "./audit/audit.module";
import { AuthModule } from "./auth/auth.module";
import { JwtAuthGuard } from "./auth/jwt-auth.guard";
import { DashboardModule } from "./dashboard/dashboard.module";
import { DepartmentsModule } from "./departments/departments.module";
import { DocumentsModule } from "./documents/documents.module";
import { FavoritesModule } from "./favorites/favorites.module";
import { FoldersModule } from "./folders/folders.module";
import { HealthController } from "./health.controller";
import { PrismaModule } from "./prisma/prisma.module";
import { TrashModule } from "./trash/trash.module";

@Module({
  imports: [
    JwtModule,
    PrismaModule,
    AuditModule,
    AdminModule,
    AuthModule,
    DepartmentsModule,
    FoldersModule,
    DocumentsModule,
    FavoritesModule,
    DashboardModule,
    TrashModule
  ],
  controllers: [HealthController],
  // Every route requires a valid login unless it is marked with @Public().
  providers: [{ provide: APP_GUARD, useClass: JwtAuthGuard }]
})
export class AppModule {}
