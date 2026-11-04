import { apiFetch } from "./client";
import { endpoints } from "./endpoints";
import type {
  ApiResponse,
  BreadcrumbItemDto,
  CopyFolderInput,
  CreateFolderInput,
  FolderChildrenDto,
  FolderDto,
  UpdateFolderInput
} from "./types";

export function getRootFolders() {
  return apiFetch<ApiResponse<FolderDto[]>>(endpoints.rootFolders);
}

export function getFolderById(id: string) {
  return apiFetch<ApiResponse<FolderDto>>(endpoints.folderById(id));
}

export function getFolderChildren(id: string) {
  return apiFetch<ApiResponse<FolderChildrenDto>>(endpoints.folderChildren(id));
}

export function getFolderBreadcrumb(id: string) {
  return apiFetch<ApiResponse<BreadcrumbItemDto[]>>(endpoints.folderBreadcrumb(id));
}

export function createFolder(input: CreateFolderInput, token: string) {
  return apiFetch<ApiResponse<FolderDto>>(endpoints.folders, {
    method: "POST",
    authToken: token,
    body: input
  });
}

export function updateFolder(id: string, input: UpdateFolderInput, token: string) {
  return apiFetch<ApiResponse<FolderDto>>(endpoints.folderById(id), {
    method: "PATCH",
    authToken: token,
    body: input
  });
}

export function copyFolder(id: string, input: CopyFolderInput, token: string) {
  return apiFetch<ApiResponse<FolderDto>>(endpoints.folderCopy(id), {
    method: "POST",
    authToken: token,
    body: input
  });
}

export function deleteFolder(id: string, token: string) {
  return apiFetch<ApiResponse<{ id: string; deleted: boolean }>>(endpoints.folderById(id), {
    method: "DELETE",
    authToken: token
  });
}
