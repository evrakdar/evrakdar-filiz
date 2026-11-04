import { expect, test, type APIRequestContext } from "@playwright/test";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:3001";

async function login(request: APIRequestContext, username: string, password: string) {
  const response = await request.post(`${apiBaseUrl}/auth/login`, { data: { username, password } });
  expect(response.ok()).toBe(true);

  return ((await response.json()) as { data: { accessToken: string } }).data.accessToken;
}

test("nothing can be read without signing in", async ({ request }) => {
  for (const path of ["/documents", "/documents?q=rapor", "/folders/root", "/dashboard/summary", "/departments", "/favorites", "/trash"]) {
    const response = await request.get(`${apiBaseUrl}${path}`);
    expect(response.status(), path).toBe(401);
  }

  expect((await request.get(`${apiBaseUrl}/health`)).ok()).toBe(true);
});

test("paid features are not part of this edition", async ({ request }) => {
  const token = await login(request, "admin", "admin123");
  const headers = { Authorization: `Bearer ${token}` };

  for (const path of ["/admin/audit-logs", "/admin/search/jobs", "/documents/pending-approvals", "/documents/any/approvals"]) {
    const response = await request.get(`${apiBaseUrl}${path}`, { headers });
    expect([404], path).toContain(response.status());
  }
});

test("confidential documents stay hidden from other departments", async ({ request }) => {
  const adminToken = await login(request, "admin", "admin123");
  const viewerToken = await login(request, "viewer", "viewer123");
  const adminHeaders = { Authorization: `Bearer ${adminToken}` };
  const viewerHeaders = { Authorization: `Bearer ${viewerToken}` };

  const me = await (await request.get(`${apiBaseUrl}/auth/me`, { headers: viewerHeaders })).json();
  const departments = await (await request.get(`${apiBaseUrl}/departments`, { headers: adminHeaders })).json();
  const otherDepartment = departments.data.find((item: { id: string }) => item.id !== me.data.department?.id);
  const folders = await (await request.get(`${apiBaseUrl}/folders/root`, { headers: adminHeaders })).json();
  const folderId = folders.data[0].id;

  const created = await request.post(`${apiBaseUrl}/documents`, {
    headers: adminHeaders,
    data: {
      name: `Gizli Test ${Date.now()}`,
      folderId,
      documentType: "REPORT",
      sizeBytes: 1000,
      responsibleDepartmentId: otherDepartment.id,
      accessLevel: "CONFIDENTIAL"
    }
  });
  expect(created.ok()).toBe(true);
  const documentId = ((await created.json()) as { data: { id: string } }).data.id;

  try {
    expect((await request.get(`${apiBaseUrl}/documents/${documentId}`, { headers: adminHeaders })).status()).toBe(200);
    expect((await request.get(`${apiBaseUrl}/documents/${documentId}`, { headers: viewerHeaders })).status()).toBe(404);

    const children = await (await request.get(`${apiBaseUrl}/folders/${folderId}/children`, { headers: viewerHeaders })).text();
    expect(children).not.toContain(documentId);
  } finally {
    await request.delete(`${apiBaseUrl}/documents/${documentId}`, { headers: adminHeaders });
    await request.delete(`${apiBaseUrl}/trash/documents/${documentId}`, { headers: adminHeaders });
  }
});

test("keeps Turkish characters in uploaded file names", async ({ request }) => {
  const token = await login(request, "admin", "admin123");
  const headers = { Authorization: `Bearer ${token}` };
  const departments = await (await request.get(`${apiBaseUrl}/departments`, { headers })).json();
  const folders = await (await request.get(`${apiBaseUrl}/folders/root`, { headers })).json();
  const fileName = "İç Tetkik Şablonu Çğüöı.pdf";

  const response = await request.post(`${apiBaseUrl}/documents/upload`, {
    headers,
    multipart: {
      file: { name: fileName, mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n") },
      name: `Türkçe Dosya Adı ${Date.now()}`,
      folderId: folders.data[0].id,
      documentType: "OTHER",
      responsibleDepartmentId: departments.data[0].id
    }
  });
  expect(response.ok()).toBe(true);

  const document = ((await response.json()) as { data: { id: string; originalFileName: string } }).data;

  try {
    expect(document.originalFileName).toBe(fileName);
  } finally {
    await request.delete(`${apiBaseUrl}/documents/${document.id}`, { headers });
    await request.delete(`${apiBaseUrl}/trash/documents/${document.id}`, { headers });
  }
});
