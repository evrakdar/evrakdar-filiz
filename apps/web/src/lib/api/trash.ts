import { apiFetch } from "./client";
import { endpoints } from "./endpoints";
import type { ApiResponse, DocumentDto, FolderDto, TrashListDto } from "./types";

export function getTrashItems(token: string) {
  return apiFetch<ApiResponse<TrashListDto>>(endpoints.trash, {
    authToken: token
  });
}

export function restoreTrashDocument(id: string, token: string) {
  return apiFetch<ApiResponse<DocumentDto>>(endpoints.trashDocumentRestore(id), {
    method: "POST",
    authToken: token
  });
}

export function permanentlyDeleteTrashDocument(id: string, token: string) {
  return apiFetch<ApiResponse<{ id: string; deleted: boolean }>>(endpoints.trashDocumentPermanentDelete(id), {
    method: "DELETE",
    authToken: token
  });
}

export function restoreTrashFolder(id: string, token: string) {
  return apiFetch<ApiResponse<FolderDto>>(endpoints.trashFolderRestore(id), {
    method: "POST",
    authToken: token
  });
}

export function permanentlyDeleteTrashFolder(id: string, token: string) {
  return apiFetch<ApiResponse<{ id: string; deleted: boolean }>>(endpoints.trashFolderPermanentDelete(id), {
    method: "DELETE",
    authToken: token
  });
}
