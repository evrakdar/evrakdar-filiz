import { apiFetch } from "./client";
import { API_BASE_URL, endpoints } from "./endpoints";
import type {
  ApiResponse,
  CopyDocumentInput,
  CreateDocumentMetadataInput,
  DocumentDetailDto,
  DocumentDto,
  DocumentVersionDto,
  DocumentsQueryParams,
  PaginatedResponse,
  UpdateDocumentInput
} from "./types";

export function getDocuments(params: DocumentsQueryParams = {}) {
  return apiFetch<PaginatedResponse<DocumentDto>>(endpoints.documents, {
    query: params
  });
}

export function getMyRecentDocuments(token: string, params: Pick<DocumentsQueryParams, "page" | "limit"> = {}) {
  return apiFetch<PaginatedResponse<DocumentDto>>(endpoints.myRecentDocuments, {
    authToken: token,
    query: params
  });
}

export function getRecentDocumentList(token: string, params: Pick<DocumentsQueryParams, "page" | "limit"> = {}) {
  return apiFetch<PaginatedResponse<DocumentDto>>(endpoints.recentDocumentsList, {
    authToken: token,
    query: params
  });
}

export function getExpiredDocuments(token: string, params: Pick<DocumentsQueryParams, "page" | "limit"> = {}) {
  return apiFetch<PaginatedResponse<DocumentDto>>(endpoints.expiredDocuments, {
    authToken: token,
    query: params
  });
}

export function getExpiringSoonDocuments(token: string, params: Pick<DocumentsQueryParams, "page" | "limit"> = {}) {
  return apiFetch<PaginatedResponse<DocumentDto>>(endpoints.expiringSoonDocuments, {
    authToken: token,
    query: params
  });
}

export function getDocumentById(id: string) {
  return apiFetch<ApiResponse<DocumentDetailDto>>(endpoints.documentById(id));
}

export function createDocumentMetadata(input: CreateDocumentMetadataInput, token: string) {
  return apiFetch<ApiResponse<DocumentDto>>(endpoints.documents, {
    method: "POST",
    authToken: token,
    body: input
  });
}

export function uploadDocument(formData: FormData, token: string) {
  return apiFetch<ApiResponse<DocumentDto>>(endpoints.documentUpload, {
    method: "POST",
    authToken: token,
    body: formData
  });
}

export function updateDocument(id: string, input: UpdateDocumentInput, token: string) {
  return apiFetch<ApiResponse<DocumentDto>>(endpoints.documentById(id), {
    method: "PATCH",
    authToken: token,
    body: input
  });
}

export function copyDocument(id: string, input: CopyDocumentInput, token: string) {
  return apiFetch<ApiResponse<DocumentDto>>(endpoints.documentCopy(id), {
    method: "POST",
    authToken: token,
    body: input
  });
}

export function deleteDocument(id: string, token: string) {
  return apiFetch<ApiResponse<DocumentDto>>(endpoints.documentById(id), {
    method: "DELETE",
    authToken: token
  });
}

/** Word files are shown as a simple page: the text and images, without the page layout. */
export function getDocumentPreviewHtml(id: string, token: string) {
  return apiFetch<ApiResponse<{ html: string }>>(endpoints.documentPreview(id), { authToken: token });
}

export function getDocumentFileBlob(id: string, token: string) {
  return fetchDocumentBlob(endpoints.documentFile(id), token);
}

export function downloadDocumentFileBlob(id: string, token: string) {
  return fetchDocumentBlob(endpoints.documentDownload(id), token);
}

export function getDocumentVersions(id: string, token: string) {
  return apiFetch<ApiResponse<DocumentVersionDto[]>>(endpoints.documentVersions(id), {
    authToken: token
  });
}

export function uploadDocumentVersion(id: string, formData: FormData, token: string) {
  return apiFetch<ApiResponse<DocumentDto>>(endpoints.documentNewVersion(id), {
    method: "POST",
    authToken: token,
    body: formData
  });
}

export function downloadDocumentVersionFileBlob(id: string, versionId: string, token: string) {
  return fetchDocumentBlob(endpoints.documentVersionDownload(id, versionId), token);
}

async function fetchDocumentBlob(path: string, token: string) {
  const response = await fetch(new URL(path, API_BASE_URL).toString(), {
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) {
    throw new Error(response.status === 404 ? "Bu kayıt için dosya bulunamadı." : "Dosya alınamadı.");
  }

  return response.blob();
}
