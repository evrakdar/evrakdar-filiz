import { apiFetch } from "./client";
import { endpoints } from "./endpoints";
import type { ApiResponse } from "./types";

export type AdminCategoryDocumentCountDto = {
  key: string;
  name: string;
  documentCount: number;
};

export type AdminUserRoleCountsDto = {
  admin: number;
  editor: number;
  user: number;
  total: number;
};

export type AdminFileTypeStatDto = {
  fileType: string;
  documentCount: number;
  totalSizeBytes: number;
};

export type AdminDashboardSummaryDto = {
  categoryDocumentCounts: AdminCategoryDocumentCountDto[];
  userRoleCounts: AdminUserRoleCountsDto;
  totalStorageBytes: number;
  fileTypeStats: AdminFileTypeStatDto[];
};

export function getAdminDashboardSummary(token: string) {
  return apiFetch<ApiResponse<AdminDashboardSummaryDto>>(endpoints.adminDashboardSummary, {
    authToken: token
  });
}
