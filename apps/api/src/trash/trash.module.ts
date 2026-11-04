import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { AuditModule } from "../audit/audit.module";
import { StorageModule } from "../storage/storage.module";
import { PrismaModule } from "../prisma/prisma.module";
import { TrashController } from "./trash.controller";
import { TrashService } from "./trash.service";

@Module({
  imports: [PrismaModule, AuditModule, JwtModule, StorageModule],
  controllers: [TrashController],
  providers: [TrashService]
})
export class TrashModule {}
