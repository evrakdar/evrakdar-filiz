import { apiFetch } from "./client";
import { endpoints } from "./endpoints";
import type { ApiResponse, DepartmentDto, ResponsibleOptionDto } from "./types";

export function getDepartments() {
  return apiFetch<ApiResponse<DepartmentDto[]>>(endpoints.departments);
}


export function getResponsibleOptions() {
  return apiFetch<ApiResponse<ResponsibleOptionDto[]>>(endpoints.documentResponsibleOptions);
}

export function createDepartment(name: string, token: string) {
  return apiFetch<ApiResponse<DepartmentDto>>(endpoints.departments, {
    method: "POST",
    authToken: token,
    body: { name }
  });
}

export function renameDepartment(id: string, name: string, token: string) {
  return apiFetch<ApiResponse<DepartmentDto>>(endpoints.departmentById(id), {
    method: "PATCH",
    authToken: token,
    body: { name }
  });
}

export function deleteDepartment(id: string, token: string) {
  return apiFetch<ApiResponse<{ id: string; deleted: boolean }>>(endpoints.departmentById(id), {
    method: "DELETE",
    authToken: token
  });
}
