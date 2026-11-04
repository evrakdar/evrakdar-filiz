import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { getAuditContext } from "../audit/audit.types";
import type { AuthenticatedRequest } from "../auth/auth.types";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { AdminService } from "./admin.service";

export type SuggestAccountDto = {
  firstName?: string;
  lastName?: string;
  departmentId?: string | null;
};

export type AdminUsersQuery = {
  q?: string;
  role?: string;
  page?: string;
  limit?: string;
};

export type UpdateAdminUserDto = {
  firstName?: string;
  lastName?: string;
  title?: string | null;
  email?: string;
  username?: string;
  password?: string | null;
  departmentId?: string | null;
};

export type CreateAdminUserDto = {
  firstName?: string;
  lastName?: string;
  title?: string | null;
  email?: string;
  username?: string;
  password?: string;
  role?: string;
  departmentId?: string | null;
};

export type UpdateAdminUserRolesDto = {
  roles?: string[];
};

@Controller("admin")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("ADMIN")
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get("dashboard/summary")
  getDashboardSummary() {
    return this.adminService.getDashboardSummary();
  }

  @Get("users")
  findUsers(@Query() query: AdminUsersQuery) {
    return this.adminService.findUsers(query);
  }

  @Post("users/suggest")
  @HttpCode(200)
  suggestAccount(@Body() body: SuggestAccountDto) {
    return this.adminService.suggestAccount(body);
  }

  @Post("users")
  createUser(@Req() request: AuthenticatedRequest, @Body() body: CreateAdminUserDto) {
    return this.adminService.createUser(body, getAuditContext(request));
  }

  @Get("users/:id")
  findUserById(@Param("id") id: string) {
    return this.adminService.findUserById(id);
  }

  @Patch("users/:id")
  updateUser(
    @Req() request: AuthenticatedRequest,
    @Param("id") id: string,
    @Body() body: UpdateAdminUserDto
  ) {
    return this.adminService.updateUser(id, body, getAuditContext(request));
  }

  @Patch("users/:id/roles")
  updateUserRoles(
    @Req() request: AuthenticatedRequest,
    @Param("id") id: string,
    @Body() body: UpdateAdminUserRolesDto
  ) {
    return this.adminService.updateUserRoles(id, body, request.user!.sub, getAuditContext(request));
  }

  @Delete("users/:id")
  deleteUser(@Req() request: AuthenticatedRequest, @Param("id") id: string) {
    return this.adminService.deleteUser(id, request.user!.sub, getAuditContext(request));
  }

  @Post("users/:id/activate")
  @HttpCode(200)
  activateUser(@Req() request: AuthenticatedRequest, @Param("id") id: string) {
    return this.adminService.activateUser(id, getAuditContext(request));
  }

  @Delete("users/:id/permanent")
  removeUser(@Req() request: AuthenticatedRequest, @Param("id") id: string) {
    return this.adminService.removeUser(id, request.user!.sub, getAuditContext(request));
  }
}
