import { Body, Controller, Get, Post, Req } from "@nestjs/common";
import { getAuditContext } from "../audit/audit.types";
import { AuthService } from "./auth.service";
import { AllowPendingPassword } from "./allow-pending-password.decorator";
import type { AuthenticatedRequest, ChangePasswordDto, LoginDto } from "./auth.types";
import { Public } from "./public.decorator";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post("login")
  login(@Req() request: AuthenticatedRequest, @Body() loginDto: LoginDto) {
    return this.authService.login(loginDto, getAuditContext(request));
  }

  @Post("change-password")
  @AllowPendingPassword()
  changePassword(@Req() request: AuthenticatedRequest, @Body() body: ChangePasswordDto) {
    return this.authService.changePassword(request.user!, body, getAuditContext(request));
  }

  @Get("me")
  @AllowPendingPassword()
  me(@Req() request: AuthenticatedRequest) {
    return this.authService.me(request.user!);
  }
}
