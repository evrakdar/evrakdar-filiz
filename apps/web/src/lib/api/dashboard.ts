import { apiFetch } from "./client";
import { endpoints } from "./endpoints";
import type {
  ApiResponse,
  DashboardSummaryDto,
  DocumentDto
} from "./types";

export function getDashboardSummary() {
  return apiFetch<ApiResponse<DashboardSummaryDto>>(endpoints.dashboardSummary);
}

export function getRecentDocuments() {
  return apiFetch<ApiResponse<DocumentDto[]>>(endpoints.recentDocuments);
}

export function getExpiringDocuments() {
  return apiFetch<ApiResponse<DocumentDto[]>>(endpoints.expiringDocuments);
}

