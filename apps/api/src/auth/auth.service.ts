import { assertStrongPassword } from "../common/password-rules";
import { BadRequestException, ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { compare, hash } from "bcryptjs";
import { AuditService } from "../audit/audit.service";
import type { AuditRequestContext } from "../audit/audit.types";
import { mapDepartment } from "../common/mappers";
import { ok } from "../common/responses";
import { PrismaService } from "../prisma/prisma.service";
import { getJwtExpiresIn, getJwtSecret } from "./auth.config";
import { LoginRateLimiter } from "./login-rate-limiter";
import type { ChangePasswordDto, JwtPayload, LoginDto } from "./auth.types";
import { DEFAULT_PASSWORD, isLocalOnlyInstall } from "./install-mode";

@Injectable()
export class AuthService {
  private readonly rateLimiter = new LoginRateLimiter();

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly auditService: AuditService
  ) {}

  async login(loginDto: LoginDto, context: AuditRequestContext = {}) {
    const startedAt = Date.now();
    const username = loginDto.username?.trim();
    const password = loginDto.password;

    if (!username || !password) {
      this.auditService.logAsync({
        action: "LOGIN",
        entityType: "AUTH",
        entityId: username ?? "unknown",
        entityName: username ?? null,
        description: "Login failed: missing credentials",
        success: false,
        durationMs: Date.now() - startedAt,
        context: { ...context, username: username ?? null },
        metadata: { reason: "missing_credentials" }
      });
      throw new UnauthorizedException("Kullanıcı adı ve şifre girin.");
    }

    const limiterKeys = [`user:${username.toLowerCase()}`, ...(context.ip ? [`ip:${context.ip}`] : [])];
    this.rateLimiter.assertAllowed(limiterKeys);

    const user = await this.findUserByUsername(username);

    if (!user || !user.isActive) {
      this.auditService.logAsync({
        action: "LOGIN",
        entityType: "AUTH",
        entityId: username,
        entityName: username,
        description: "Login failed",
        success: false,
        durationMs: Date.now() - startedAt,
        context: { ...context, username },
        metadata: { reason: "invalid_user_or_inactive" }
      });
      this.rateLimiter.recordFailure(limiterKeys);
      throw new UnauthorizedException("Kullanıcı adı veya şifre yanlış.");
    }

    const isPasswordValid = await compare(password, user.passwordHash);

    if (!isPasswordValid) {
      this.auditService.logAsync({
        action: "LOGIN",
        entityType: "AUTH",
        entityId: user.id,
        entityName: user.username,
        description: "Login failed",
        success: false,
        durationMs: Date.now() - startedAt,
        context: { ...context, userId: user.id, username: user.username },
        metadata: { reason: "invalid_password" }
      });
      this.rateLimiter.recordFailure(limiterKeys);
      throw new UnauthorizedException("Kullanıcı adı veya şifre yanlış.");
    }

    // The default password is public. Once the system is reachable from the network it must not open any door.
    if (password === DEFAULT_PASSWORD && !isLocalOnlyInstall()) {
      throw new ForbiddenException(
        "Sistem ağa açık olduğu için hazır şifreyle giriş kapalı. Kurulum dosyasını yeniden çalıştırın, size yeni bir şifre verilecek."
      );
    }

    const userSummary = mapAuthUser(user);
    const payload: JwtPayload = {
      sub: user.id,
      username: user.username,
      roles: userSummary.roles
    };
    const accessToken = await this.jwtService.signAsync(payload, {
      secret: getJwtSecret(),
      expiresIn: getJwtExpiresIn() as `${number}h`
    });
    this.rateLimiter.reset([`user:${username.toLowerCase()}`]);
    this.auditService.logAsync({
      action: "LOGIN",
      entityType: "AUTH",
      entityId: user.id,
      entityName: user.username,
      description: "Login succeeded",
      durationMs: Date.now() - startedAt,
      context: {
        ...context,
        userId: user.id,
        username: user.username,
        roles: userSummary.roles
      }
    });

    return ok({
      accessToken,
      user: userSummary
    });
  }

  async me(payload: JwtPayload) {
    const user = await this.findUserById(payload.sub);

    if (!user || !user.isActive) {
      throw new UnauthorizedException("Bu hesap kapalı.");
    }

    return ok(mapAuthUser(user));
  }

  async changePassword(payload: JwtPayload, body: ChangePasswordDto, context: AuditRequestContext = {}) {
    const currentPassword = body.currentPassword ?? "";
    const newPassword = body.newPassword?.trim() ?? "";
    const limiterKeys = [`user:${payload.username.toLowerCase()}`];

    this.rateLimiter.assertAllowed(limiterKeys);

    const user = await this.findUserById(payload.sub);

    if (!user || !user.isActive) {
      throw new UnauthorizedException("Bu hesap kapalı.");
    }

    if (!(await compare(currentPassword, user.passwordHash))) {
      this.rateLimiter.recordFailure(limiterKeys);
      throw new BadRequestException("Mevcut şifre yanlış.");
    }

    assertStrongPassword(newPassword);

    if (newPassword === currentPassword) {
      throw new BadRequestException("Yeni şifre eskisiyle aynı olamaz.");
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await hash(newPassword, 10),
        mustChangePassword: false
      },
      include: authUserInclude
    });

    this.auditService.logAsync({
      action: "ADMIN_USER_UPDATE",
      entityType: "USER",
      entityId: user.id,
      entityName: user.username,
      description: "Kişi kendi şifresini değiştirdi",
      context,
      metadata: { personName: `${user.firstName} ${user.lastName}`, credentialChanged: true }
    });

    return ok(mapAuthUser(updatedUser));
  }

  private findUserByUsername(username: string) {
    return this.prisma.user.findUnique({
      where: { username },
      include: authUserInclude
    });
  }

  private findUserById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      include: authUserInclude
    });
  }
}

const authUserInclude = {
  department: true,
  roles: {
    include: {
      role: true
    },
    orderBy: {
      role: {
        name: "asc"
      }
    }
  }
} as const;

type AuthUser = Awaited<ReturnType<AuthService["findUserById"]>>;
type ExistingAuthUser = NonNullable<AuthUser>;

function mapAuthUser(user: ExistingAuthUser) {
  return {
    id: user.id,
    username: user.username,
    firstName: user.firstName,
    lastName: user.lastName,
    title: user.title,
    email: user.email,
    department: user.department ? mapDepartment(user.department) : null,
    roles: user.roles.map((userRole) => userRole.role.name),
    mustChangePassword: user.mustChangePassword,
    passwordChangeRequired: user.mustChangePassword && !isLocalOnlyInstall()
  };
}
