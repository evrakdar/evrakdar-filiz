import { apiFetch, ApiClientError } from "./client";
import { endpoints } from "./endpoints";
import type { ApiResponse, PaginatedResponse } from "./types";

export type AdminUserRole = "ADMIN" | "EDITOR" | "VIEWER";

export type AdminUserDto = {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  title: string | null;
  email: string;
  department?: { id: string; name: string } | null;
  roles: AdminUserRole[];
  isActive?: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AdminUsersQuery = {
  q?: string;
  role?: AdminUserRole | "";
  page?: number;
  limit?: number;
};

export type UpdateAdminUserInput = {
  firstName?: string;
  lastName?: string;
  title?: string | null;
  email?: string;
  username?: string;
  password?: string;
  departmentId?: string | null;
};

export type CreateAdminUserInput = {
  firstName: string;
  lastName: string;
  title?: string | null;
  email: string;
  username: string;
  password: string;
  role: AdminUserRole;
  departmentId?: string | null;
};

export function suggestAdminUserAccount(
  input: { firstName: string; lastName: string; departmentId: string | null },
  token: string
) {
  return apiFetch<ApiResponse<{ username: string; email: string | null }>>(endpoints.adminUsersSuggest, {
    method: "POST",
    body: input,
    authToken: token
  });
}

export function createAdminUser(input: CreateAdminUserInput, token: string) {
  return apiFetch<ApiResponse<AdminUserDto>>(endpoints.adminUsers, {
    method: "POST",
    body: input,
    authToken: token
  });
}

export function getAdminUsers(params: AdminUsersQuery, token: string) {
  return apiFetch<PaginatedResponse<AdminUserDto>>(endpoints.adminUsers, {
    query: params,
    authToken: token
  });
}

export function getAdminUserById(id: string, token: string) {
  return apiFetch<ApiResponse<AdminUserDto>>(endpoints.adminUserById(id), {
    authToken: token
  });
}

export function updateAdminUser(id: string, input: UpdateAdminUserInput, token: string) {
  return apiFetch<ApiResponse<AdminUserDto>>(endpoints.adminUserById(id), {
    method: "PATCH",
    body: input,
    authToken: token
  });
}

export function updateAdminUserRoles(id: string, roles: AdminUserRole[], token: string) {
  return apiFetch<ApiResponse<AdminUserDto>>(endpoints.adminUserRoles(id), {
    method: "PATCH",
    body: { roles },
    authToken: token
  });
}

export function deactivateAdminUser(id: string, token: string) {
  return apiFetch<ApiResponse<{ id: string; isActive: boolean }>>(endpoints.adminUserById(id), {
    method: "DELETE",
    authToken: token
  });
}

export function activateAdminUser(id: string, token: string) {
  return apiFetch<ApiResponse<AdminUserDto>>(endpoints.adminUserActivate(id), {
    method: "POST",
    authToken: token
  });
}

export function removeAdminUser(id: string, token: string) {
  return apiFetch<ApiResponse<{ id: string; removed: boolean }>>(endpoints.adminUserRemove(id), {
    method: "DELETE",
    authToken: token
  });
}

export function getAdminUserErrorMessage(error: unknown) {
  if (error instanceof ApiClientError) {
    if (error.status === 401) {
      return "Oturum doğrulanamadı. Lütfen tekrar giriş yapın.";
    }

    if (error.status === 403) {
      return error.message || "Bu işlem için yetkiniz yok.";
    }

    if (error.status === 409) {
      return error.message || "Bu işlem mevcut ilişkiler nedeniyle tamamlanamadı.";
    }

    return error.message || "İşlem tamamlanamadı.";
  }

  return "İşlem tamamlanamadı.";
}
