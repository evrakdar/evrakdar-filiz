import { getApiDocumentDetail, getApiFolderNavigation } from "./api-source";

// These run in the browser so the signed-in user's token is sent with the request.
export async function loadFolderNavigationAction(folderId: string) {
  return getApiFolderNavigation(folderId);
}

export async function loadDocumentDetailAction(documentId: string) {
  return getApiDocumentDetail(documentId);
}
