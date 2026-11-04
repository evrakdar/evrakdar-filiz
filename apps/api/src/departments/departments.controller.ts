import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { getAuditContext } from "../audit/audit.types";
import type { AuthenticatedRequest } from "../auth/auth.types";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { DepartmentsService } from "./departments.service";

export type DepartmentInputDto = {
  name?: string;
};

@Controller("departments")
export class DepartmentsController {
  constructor(private readonly departmentsService: DepartmentsService) {}

  @Get()
  findAll() {
    return this.departmentsService.findAll();
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles("ADMIN")
  create(@Req() request: AuthenticatedRequest, @Body() body: DepartmentInputDto) {
    return this.departmentsService.create(body, getAuditContext(request));
  }

  @Patch(":id")
  @UseGuards(RolesGuard)
  @Roles("ADMIN")
  rename(@Param("id") id: string, @Req() request: AuthenticatedRequest, @Body() body: DepartmentInputDto) {
    return this.departmentsService.rename(id, body, getAuditContext(request));
  }

  @Delete(":id")
  @UseGuards(RolesGuard)
  @Roles("ADMIN")
  remove(@Param("id") id: string, @Req() request: AuthenticatedRequest) {
    return this.departmentsService.remove(id, getAuditContext(request));
  }
}
