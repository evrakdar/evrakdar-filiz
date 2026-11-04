import type { APIResponse, Page } from "@playwright/test";

type DocumentPayload = {
  id: string;
  name: string;
};

type FolderPayload = {
  id: string;
  name: string;
  path?: string | null;
};

type TrashPayload = {
  data?: {
    documents?: Array<DocumentPayload & { folder?: { path?: string | null } | null }>;
    folders?: FolderPayload[];
  };
};

const testDocumentPrefixes = [
  "Viewer Search Dokuman",
  "Editor Search Dokuman",
  "Global Search Dokuman",
  "Session Erasmus Dokuman",
  "Favorite Erasmus Dokuman",
  "Category Explorer Dokuman",
  "Folder Explorer Dokuman",
  "Explorer Managed Doc",
  "Explorer Managed Doc Renamed",
  "Explorer Doc",
  "Manage Doc",
  "Managed Doc Renamed",
  "E2E Metadata Dokümanı",
  "E2E Upload Dokümanı",
  "UX Menu Doc",
  "Runtime "
];

const testFolderPrefixes = [
  "Explorer Child",
  "Viewer Child",
  "Explorer Source",
  "Explorer Target",
  "Explorer Managed Folder",
  "Manage Source",
  "Manage Target",
  "Manage Child",
  "Manage Child Renamed",
  "UX Toolbar",
  "Runtime "
];

export class TestFixtureCleanup {
  private readonly apiBaseUrl: string;
  private readonly documentIds = new Set<string>();
  private readonly folderIds: string[] = [];

  constructor(apiBaseUrl: string) {
    this.apiBaseUrl = apiBaseUrl;
  }

  reset() {
    this.documentIds.clear();
    this.folderIds.length = 0;
  }

  trackDocument(id: string | null | undefined) {
    if (id) {
      this.documentIds.add(id);
    }
  }

  trackFolder(id: string | null | undefined) {
    if (id && !this.folderIds.includes(id)) {
      this.folderIds.push(id);
    }
  }

  async cleanup(page: Page) {
    const token = await this.getAdminToken(page);
    await this.cleanupTracked(page, token);
    await this.cleanupKnownFixtures(page, token);
    this.reset();
  }

  async cleanupKnownFixtures(page: Page, token?: string) {
    const activeToken = token ?? (await this.getAdminToken(page));
    await this.cleanupKnownDocuments(page, activeToken);
    await this.cleanupKnownFolders(page, activeToken);
    await this.cleanupKnownTrashItems(page, activeToken);
  }

  private async cleanupTracked(page: Page, token: string) {
    for (const documentId of [...this.documentIds].reverse()) {
      await this.softDeleteDocument(page, documentId, token);
      await this.permanentlyDeleteDocument(page, documentId, token);
    }

    for (const folderId of [...this.folderIds].reverse()) {
      await this.softDeleteFolder(page, folderId, token);
      await this.permanentlyDeleteFolder(page, folderId, token);
    }
  }

  private async cleanupKnownDocuments(page: Page, token: string) {
    const documentIds = new Set<string>();

    for (const prefix of testDocumentPrefixes) {
      const response = await page.request.get(`${this.apiBaseUrl}/documents`, {
        headers: await this.authHeaders(page),
        params: {
          q: prefix,
          limit: "100"
        }
      });

      if (!response.ok()) {
        continue;
      }

      const payload = (await response.json()) as { data?: DocumentPayload[] };

      for (const document of payload.data ?? []) {
        if (document.name.startsWith(prefix)) {
          documentIds.add(document.id);
        }
      }
    }

    for (const documentId of documentIds) {
      await this.softDeleteDocument(page, documentId, token);
      await this.permanentlyDeleteDocument(page, documentId, token);
    }
  }

  private async cleanupKnownFolders(page: Page, token: string) {
    const folders = await this.collectFolders(page);
    const fixtureRoots = folders.filter((folder) => testFolderPrefixes.some((prefix) => folder.name.startsWith(prefix)));
    const fixtureRootPaths = fixtureRoots.map((folder) => folder.path).filter(Boolean) as string[];
    const testFolders = folders.filter(
      (folder) =>
        fixtureRoots.some((root) => root.id === folder.id) ||
        fixtureRootPaths.some((path) => Boolean(folder.path?.startsWith(`${path}/`)))
    );

    testFolders.sort((first, second) => getFolderDepth(second) - getFolderDepth(first));

    for (const folder of testFolders) {
      await this.cleanupDirectFolderDocuments(page, folder.id, token);
    }

    for (const folder of testFolders) {
      await this.softDeleteFolder(page, folder.id, token);
    }

    await this.cleanupKnownTrashItems(page, token);
  }

  private async cleanupKnownTrashItems(page: Page, token: string) {
    const response = await page.request.get(`${this.apiBaseUrl}/trash`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (!response.ok()) {
      return;
    }

    const payload = (await response.json()) as TrashPayload;
    const documents = payload.data?.documents ?? [];
    const folders = payload.data?.folders ?? [];
    const fixtureRoots = folders.filter((folder) => testFolderPrefixes.some((prefix) => folder.name.startsWith(prefix)));
    const fixtureRootPaths = fixtureRoots.map((folder) => folder.path).filter(Boolean) as string[];

    for (const document of documents) {
      if (
        testDocumentPrefixes.some((prefix) => document.name.startsWith(prefix)) ||
        fixtureRootPaths.some((path) => Boolean(document.folder?.path?.startsWith(path)))
      ) {
        await this.permanentlyDeleteDocument(page, document.id, token);
      }
    }

    const targetFolders = folders.filter(
      (folder) =>
        fixtureRoots.some((root) => root.id === folder.id) ||
        fixtureRootPaths.some((path) => Boolean(folder.path?.startsWith(`${path}/`)))
    );

    targetFolders.sort((first, second) => getFolderDepth(second) - getFolderDepth(first));

    for (const folder of targetFolders) {
      await this.permanentlyDeleteFolder(page, folder.id, token);
    }
  }

  private async collectFolders(page: Page) {
    const rootResponse = await page.request.get(`${this.apiBaseUrl}/folders/root`, { headers: await this.authHeaders(page) });

    if (!rootResponse.ok()) {
      return [];
    }

    const rootPayload = (await rootResponse.json()) as { data?: FolderPayload[] };
    const allFolders = [...(rootPayload.data ?? [])];
    const queue = [...allFolders];
    const visitedIds = new Set(allFolders.map((folder) => folder.id));

    while (queue.length > 0) {
      const folder = queue.shift()!;
      const response = await page.request.get(`${this.apiBaseUrl}/folders/${encodeURIComponent(folder.id)}/children`, { headers: await this.authHeaders(page) });

      if (!response.ok()) {
        continue;
      }

      const payload = (await response.json()) as { data?: { folders?: FolderPayload[] } };
      const children = (payload.data?.folders ?? []).filter((child) => !visitedIds.has(child.id));
      children.forEach((child) => visitedIds.add(child.id));
      allFolders.push(...children);
      queue.push(...children);
    }

    return allFolders;
  }

  private async cleanupDirectFolderDocuments(page: Page, folderId: string, token: string) {
    const response = await page.request.get(`${this.apiBaseUrl}/folders/${encodeURIComponent(folderId)}/children`, { headers: await this.authHeaders(page) });

    if (!response.ok()) {
      return;
    }

    const payload = (await response.json()) as { data?: { documents?: DocumentPayload[] } };

    for (const document of payload.data?.documents ?? []) {
      await this.softDeleteDocument(page, document.id, token);
      await this.permanentlyDeleteDocument(page, document.id, token);
    }
  }

  private cachedToken: string | null = null;

  private async authHeaders(page: Page) {
    this.cachedToken ??= await this.getAdminToken(page);

    return { Authorization: `Bearer ${this.cachedToken}` };
  }

  private async getAdminToken(page: Page) {
    const response = await page.request.post(`${this.apiBaseUrl}/auth/login`, {
      data: {
        username: "admin",
        password: "admin123"
      }
    });

    await expectCleanupOk(response, "admin token");
    const payload = (await response.json()) as { data?: { accessToken?: string } };

    if (!payload.data?.accessToken) {
      throw new Error("Admin token alınamadı.");
    }

    return payload.data.accessToken;
  }

  private async softDeleteDocument(page: Page, id: string, token: string) {
    await acceptCleanupStatuses(
      page.request.delete(`${this.apiBaseUrl}/documents/${encodeURIComponent(id)}`, {
        headers: { Authorization: `Bearer ${token}` }
      }),
      "document soft delete"
    );
  }

  private async permanentlyDeleteDocument(page: Page, id: string, token: string) {
    await acceptCleanupStatuses(
      page.request.delete(`${this.apiBaseUrl}/trash/documents/${encodeURIComponent(id)}`, {
        headers: { Authorization: `Bearer ${token}` }
      }),
      "document permanent delete"
    );
  }

  private async softDeleteFolder(page: Page, id: string, token: string) {
    await acceptCleanupStatuses(
      page.request.delete(`${this.apiBaseUrl}/folders/${encodeURIComponent(id)}`, {
        headers: { Authorization: `Bearer ${token}` }
      }),
      "folder soft delete"
    );
  }

  private async permanentlyDeleteFolder(page: Page, id: string, token: string) {
    await acceptCleanupStatuses(
      page.request.delete(`${this.apiBaseUrl}/trash/folders/${encodeURIComponent(id)}`, {
        headers: { Authorization: `Bearer ${token}` }
      }),
      "folder permanent delete"
    );
  }
}

function getFolderDepth(folder: FolderPayload) {
  return (folder.path ?? folder.name).split("/").length;
}

async function expectCleanupOk(response: APIResponse, action: string) {
  if (!response.ok()) {
    throw new Error(`${action} failed: ${response.status()} ${await response.text()}`);
  }
}

async function acceptCleanupStatuses(responsePromise: Promise<APIResponse>, action: string) {
  const response = await responsePromise;

  if (response.ok() || response.status() === 404) {
    return;
  }

  throw new Error(`${action} failed: ${response.status()} ${await response.text()}`);
}
