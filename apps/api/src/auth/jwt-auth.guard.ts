import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import { PrismaService } from "../prisma/prisma.service";
import { ALLOW_PENDING_PASSWORD_KEY } from "./allow-pending-password.decorator";
import { getJwtSecret } from "./auth.config";
import type { AuthenticatedRequest, JwtPayload } from "./auth.types";
import { isLocalOnlyInstall } from "./install-mode";
import { IS_PUBLIC_KEY } from "./public.decorator";

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector
  ) {}

  async canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass()
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    // Already verified by the global guard during this request.
    if (request.user) {
      return true;
    }

    const token = getBearerToken(request.headers.authorization);

    if (!token) {
      throw new UnauthorizedException("Oturum bulunamadı. Lütfen giriş yapın.");
    }

    let payload: JwtPayload;

    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: getJwtSecret()
      });
    } catch {
      throw new UnauthorizedException("Oturumun süresi doldu. Lütfen yeniden giriş yapın.");
    }

    // Re-read the user so deactivated accounts and role changes take effect immediately.
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        username: true,
        isActive: true,
        departmentId: true,
        mustChangePassword: true,
        roles: { select: { role: { select: { name: true } } } }
      }
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException("Bu hesap kapalı.");
    }

    const allowsPendingPassword = this.reflector.getAllAndOverride<boolean>(ALLOW_PENDING_PASSWORD_KEY, [
      context.getHandler(),
      context.getClass()
    ]);

    if (user.mustChangePassword && !allowsPendingPassword && !isLocalOnlyInstall()) {
      throw new ForbiddenException({
        statusCode: 403,
        code: "PASSWORD_CHANGE_REQUIRED",
        message: "Devam etmek için şifrenizi değiştirin."
      });
    }

    request.user = {
      sub: user.id,
      username: user.username,
      roles: user.roles.map((userRole) => userRole.role.name),
      departmentId: user.departmentId
    };

    return true;
  }
}

function getBearerToken(authorizationHeader: string | undefined) {
  const [type, token] = authorizationHeader?.split(" ") ?? [];

  return type === "Bearer" && token ? token : null;
}
