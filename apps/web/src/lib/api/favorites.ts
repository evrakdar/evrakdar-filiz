import { apiFetch } from "./client";
import { endpoints } from "./endpoints";
import type { ApiResponse, DocumentDto } from "./types";

export type FavoriteMutationDto = {
  documentId: string;
  isFavorite: boolean;
};

export function getFavorites(token: string) {
  return apiFetch<ApiResponse<DocumentDto[]>>(endpoints.favorites, {
    authToken: token
  });
}

export function addFavorite(documentId: string, token: string) {
  return apiFetch<ApiResponse<FavoriteMutationDto>>(endpoints.favoriteByDocumentId(documentId), {
    authToken: token,
    method: "POST"
  });
}

export function removeFavorite(documentId: string, token: string) {
  return apiFetch<ApiResponse<FavoriteMutationDto>>(endpoints.favoriteByDocumentId(documentId), {
    authToken: token,
    method: "DELETE"
  });
}
