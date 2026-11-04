import { Controller, Get, Req } from "@nestjs/common";
import type { AuthenticatedRequest } from "../auth/auth.types";
import { DashboardService } from "./dashboard.service";

@Controller("dashboard")
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get("summary")
  getSummary(@Req() request: AuthenticatedRequest) {
    return this.dashboardService.getSummary(request.user);
  }

  @Get("recent-documents")
  getRecentDocuments(@Req() request: AuthenticatedRequest) {
    return this.dashboardService.getRecentDocuments(request.user);
  }

  @Get("expiring-documents")
  getExpiringDocuments(@Req() request: AuthenticatedRequest) {
    return this.dashboardService.getExpiringDocuments(request.user);
  }
}
