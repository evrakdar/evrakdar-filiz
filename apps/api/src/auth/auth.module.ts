import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { AuditModule } from "../audit/audit.module";
import { PrismaModule } from "../prisma/prisma.module";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { JwtAuthGuard } from "./jwt-auth.guard";

@Module({
  imports: [AuditModule, PrismaModule, JwtModule],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard]
})
export class AuthModule {}
