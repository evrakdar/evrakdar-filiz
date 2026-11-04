import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:3001";

type Headers = { Authorization: string };

async function login(request: APIRequestContext, username: string, password: string): Promise<Headers> {
  const response = await request.post(`${apiBaseUrl}/auth/login`, { data: { username, password } });
  expect(response.ok()).toBe(true);

  return { Authorization: `Bearer ${((await response.json()) as { data: { accessToken: string } }).data.accessToken}` };
}

async function context(request: APIRequestContext) {
  const admin = await login(request, "admin", "admin123");
  const editor = await login(request, "editor", "editor123");
  const viewer = await login(request, "viewer", "viewer123");
  const me = await (await request.get(`${apiBaseUrl}/auth/me`, { headers: viewer })).json();
  const departments = await (await request.get(`${apiBaseUrl}/departments`, { headers: admin })).json();
  const folders = await (await request.get(`${apiBaseUrl}/folders/root`, { headers: admin })).json();

  return {
    admin,
    editor,
    viewer,
    folderId: folders.data[0].id as string,
    ownDepartmentId: me.data.department?.id as string | undefined,
    otherDepartmentId: departments.data.find((item: { id: string }) => item.id !== me.data.department?.id).id as string
  };
}

async function createDocument(request: APIRequestContext, headers: Headers, data: Record<string, unknown>) {
  const response = await request.post(`${apiBaseUrl}/documents`, {
    headers,
    data: { documentType: "REPORT", sizeBytes: 1000, ...data }
  });
  expect(response.ok()).toBe(true);

  return ((await response.json()) as { data: { id: string } }).data.id;
}

async function removeDocument(request: APIRequestContext, headers: Headers, id: string) {
  await request.delete(`${apiBaseUrl}/documents/${id}`, { headers });
  await request.delete(`${apiBaseUrl}/trash/documents/${id}`, { headers });
}

function dayFromToday(days: number) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

async function signIn(page: Page, username: string, password: string) {
  await page.goto("/");
  await page.getByLabel("Kullanıcı adı").fill(username);
  await page.getByLabel("Şifre").fill(password);
  await page.getByRole("button", { name: "Giriş yap" }).click();
  await expect(page.getByRole("heading", { name: "Kurumsal doküman merkezi" })).toBeVisible();
}

test("confidential documents stay protected in trash, editing, copying and favorites", async ({ request }) => {
  const ctx = await context(request);
  const name = `Gizli Koruma ${Date.now()}`;
  const id = await createDocument(request, ctx.admin, {
    name,
    folderId: ctx.folderId,
    responsibleDepartmentId: ctx.otherDepartmentId,
    accessLevel: "CONFIDENTIAL"
  });

  try {
    // An editor outside the responsible department cannot touch it, even knowing its id.
    expect((await request.patch(`${apiBaseUrl}/documents/${id}`, { headers: ctx.editor, data: { name: `${name} X` } })).status()).toBe(404);
    expect((await request.post(`${apiBaseUrl}/documents/${id}/copy`, { headers: ctx.editor, data: { folderId: ctx.folderId } })).status()).toBe(404);
    expect((await request.delete(`${apiBaseUrl}/documents/${id}`, { headers: ctx.editor })).status()).toBe(404);
    expect((await request.post(`${apiBaseUrl}/favorites/${id}`, { headers: ctx.viewer })).status()).toBe(404);

    expect((await request.delete(`${apiBaseUrl}/documents/${id}`, { headers: ctx.admin })).ok()).toBe(true);

    // In the trash its name is visible only to people allowed to see it.
    expect(await (await request.get(`${apiBaseUrl}/trash`, { headers: ctx.admin })).text()).toContain(name);
    expect(await (await request.get(`${apiBaseUrl}/trash`, { headers: ctx.viewer })).text()).not.toContain(name);
    expect(await (await request.get(`${apiBaseUrl}/trash`, { headers: ctx.editor })).text()).not.toContain(name);
    expect((await request.post(`${apiBaseUrl}/trash/documents/${id}/restore`, { headers: ctx.editor })).status()).toBe(404);
    expect((await request.delete(`${apiBaseUrl}/trash/documents/${id}`, { headers: ctx.editor })).status()).toBe(404);
  } finally {
    await removeDocument(request, ctx.admin, id);
  }
});

test("folder copy does not carry confidential documents the person cannot see", async ({ request }) => {
  const ctx = await context(request);
  const stamp = Date.now();
  const created = await request.post(`${apiBaseUrl}/folders`, {
    headers: ctx.admin,
    data: { name: `Kopya Kaynak ${stamp}`, parentId: ctx.folderId }
  });
  const sourceId = ((await created.json()) as { data: { id: string } }).data.id;
  const secretId = await createDocument(request, ctx.admin, {
    name: `Gizli Kopya ${stamp}`,
    folderId: sourceId,
    responsibleDepartmentId: ctx.otherDepartmentId,
    accessLevel: "CONFIDENTIAL"
  });
  const openId = await createDocument(request, ctx.admin, {
    name: `Açık Kopya ${stamp}`,
    folderId: sourceId,
    responsibleDepartmentId: ctx.otherDepartmentId
  });
  let copyId = "";

  try {
    const copied = await request.post(`${apiBaseUrl}/folders/${sourceId}/copy`, {
      headers: ctx.editor,
      data: { parentId: ctx.folderId, name: `Kopya Hedef ${stamp}` }
    });
    expect(copied.ok()).toBe(true);
    copyId = ((await copied.json()) as { data: { id: string } }).data.id;

    const children = await (await request.get(`${apiBaseUrl}/folders/${copyId}/children`, { headers: ctx.admin })).json();
    const names = children.data.documents.map((item: { name: string }) => item.name);
    expect(names).toContain(`Açık Kopya ${stamp}`);
    expect(names).not.toContain(`Gizli Kopya ${stamp}`);
  } finally {
    if (copyId) {
      const children = await (await request.get(`${apiBaseUrl}/folders/${copyId}/children`, { headers: ctx.admin })).json();
      for (const item of children.data.documents as Array<{ id: string }>) {
        await removeDocument(request, ctx.admin, item.id);
      }
      await request.delete(`${apiBaseUrl}/folders/${copyId}`, { headers: ctx.admin });
      await request.delete(`${apiBaseUrl}/trash/folders/${copyId}`, { headers: ctx.admin });
    }
    await removeDocument(request, ctx.admin, secretId);
    await removeDocument(request, ctx.admin, openId);
    await request.delete(`${apiBaseUrl}/folders/${sourceId}`, { headers: ctx.admin });
    await request.delete(`${apiBaseUrl}/trash/folders/${sourceId}`, { headers: ctx.admin });
  }
});

test("document details can be edited from the preview panel", async ({ page, request }) => {
  const ctx = await context(request);
  const name = `Düzenlenecek Belge ${Date.now()}`;
  const id = await createDocument(request, ctx.admin, {
    name,
    folderId: ctx.folderId,
    responsibleDepartmentId: ctx.otherDepartmentId,
    validUntil: dayFromToday(5)
  });

  try {
    await signIn(page, "admin", "admin123");
    await page.goto(`/dashboard?documentId=${encodeURIComponent(id)}`);
    await page.getByRole("button", { name: "Bilgileri Düzenle" }).click();

    const form = page.getByRole("form", { name: "Belge bilgileri" });
    await expect(form.getByLabel("Belge adı")).toHaveValue(name);
    await form.getByLabel("Belge adı").fill(`${name} Yeni`);
    await form.getByLabel("Belge türü").selectOption("MINUTES");
    await form.getByLabel("Geçerlilik tarihi").fill(dayFromToday(90));
    await form.getByLabel("Erişim").selectOption("CONFIDENTIAL");
    await form.getByLabel("Açıklama").fill("Yeni açıklama");
    await form.getByRole("button", { name: "Kaydet" }).click();
    await expect(page.getByText("Belge bilgileri güncellendi.")).toBeVisible();
    await expect(page.getByRole("heading", { name: `${name} Yeni` })).toBeVisible();

    const saved = ((await (await request.get(`${apiBaseUrl}/documents/${id}`, { headers: ctx.admin })).json()) as {
      data: { name: string; documentType: string; validUntil: string; accessLevel: string; tags: { description: string } };
    }).data;
    expect(saved.name).toBe(`${name} Yeni`);
    expect(saved.documentType).toBe("MINUTES");
    expect(saved.validUntil.slice(0, 10)).toBe(dayFromToday(90));
    expect(saved.accessLevel).toBe("CONFIDENTIAL");
    expect(saved.tags.description).toBe("Yeni açıklama");

    // The date can also be removed.
    const cleared = await request.patch(`${apiBaseUrl}/documents/${id}`, { headers: ctx.admin, data: { validUntil: null } });
    expect(((await cleared.json()) as { data: { validUntil: string | null } }).data.validUntil).toBeNull();
  } finally {
    await removeDocument(request, ctx.admin, id);
  }
});

test("viewers cannot edit document details", async ({ page, request }) => {
  const ctx = await context(request);
  const id = await createDocument(request, ctx.admin, {
    name: `İzleyici Belgesi ${Date.now()}`,
    folderId: ctx.folderId,
    responsibleDepartmentId: ctx.otherDepartmentId
  });

  try {
    expect((await request.patch(`${apiBaseUrl}/documents/${id}`, { headers: ctx.viewer, data: { name: "x" } })).status()).toBe(403);
    await signIn(page, "viewer", "viewer123");
    await page.goto(`/dashboard?documentId=${encodeURIComponent(id)}`);
    await expect(page.getByRole("heading", { name: "Dosya bilgileri" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Bilgileri Düzenle" })).toHaveCount(0);
  } finally {
    await removeDocument(request, ctx.admin, id);
  }
});

test("departments can be added, renamed and removed, but not while in use", async ({ page, request }) => {
  const ctx = await context(request);
  const name = `Deneme Birimi ${Date.now()}`;

  await signIn(page, "admin", "admin123");
  await page.getByRole("complementary").getByRole("button", { name: "Birimler" }).click();

  const panel = page.getByRole("region", { name: "Birimler" });
  await panel.getByLabel("Yeni birim adı").fill(name);
  await panel.getByRole("button", { name: "Birim ekle" }).click();
  await expect(panel.getByText("Birim eklendi.")).toBeVisible();
  const row = panel.getByRole("listitem").filter({ hasText: name });
  await expect(row).toBeVisible();

  await panel.getByLabel("Yeni birim adı").fill(name.toLocaleLowerCase("tr-TR"));
  await panel.getByRole("button", { name: "Birim ekle" }).click();
  await expect(panel.getByText("Bu adla bir birim zaten var.")).toBeVisible();
  await panel.getByLabel("Yeni birim adı").fill("");

  await row.getByRole("button", { name: "Adını değiştir" }).click();
  await panel.getByLabel(`${name} yeni adı`).fill(`${name} Yeni`);
  await panel.getByRole("listitem").filter({ has: page.getByLabel(`${name} yeni adı`) }).getByRole("button", { name: "Kaydet" }).click();
  await expect(panel.getByText("Birim adı güncellendi.")).toBeVisible();

  const list = await (await request.get(`${apiBaseUrl}/departments`, { headers: ctx.admin })).json();
  const departmentId = list.data.find((item: { name: string }) => item.name === `${name} Yeni`).id as string;
  const documentId = await createDocument(request, ctx.admin, {
    name: `Birim Belgesi ${Date.now()}`,
    folderId: ctx.folderId,
    responsibleDepartmentId: departmentId
  });

  const renamedRow = panel.getByRole("listitem").filter({ hasText: `${name} Yeni` });
  await renamedRow.getByRole("button", { name: "Sil" }).click();
  await expect(panel.getByText(/Bu birim kullanımda/)).toBeVisible();

  await removeDocument(request, ctx.admin, documentId);
  await renamedRow.getByRole("button", { name: "Sil" }).click();
  await expect(panel.getByText("Birim silindi.")).toBeVisible();
  await expect(renamedRow).toHaveCount(0);

  // Only administrators can change departments.
  expect((await request.post(`${apiBaseUrl}/departments`, { headers: ctx.editor, data: { name: `${name} X` } })).status()).toBe(403);
});

test("expired documents have their own list and a document stays valid through its last day", async ({ page, request }) => {
  const ctx = await context(request);
  const stamp = Date.now();
  const expiredName = `Süresi Geçmiş ${stamp}`;
  const todayName = `Bugün Biten ${stamp}`;
  const expiredId = await createDocument(request, ctx.admin, {
    name: expiredName,
    folderId: ctx.folderId,
    responsibleDepartmentId: ctx.otherDepartmentId,
    validUntil: dayFromToday(-1)
  });
  const todayId = await createDocument(request, ctx.admin, {
    name: todayName,
    folderId: ctx.folderId,
    responsibleDepartmentId: ctx.otherDepartmentId,
    validUntil: dayFromToday(0)
  });

  try {
    const expired = await (await request.get(`${apiBaseUrl}/documents/expired?limit=100`, { headers: ctx.viewer })).text();
    const expiring = await (await request.get(`${apiBaseUrl}/documents/expiring-soon?limit=100`, { headers: ctx.viewer })).text();
    expect(expired).toContain(expiredName);
    expect(expired).not.toContain(todayName);
    expect(expiring).toContain(todayName);
    expect(expiring).not.toContain(expiredName);

    await signIn(page, "viewer", "viewer123");
    await page.getByRole("complementary").getByRole("button", { name: "Süresi Geçenler" }).click();
    await expect(page.getByRole("heading", { name: "Süresi Geçenler" })).toBeVisible();
    const row = page.getByRole("row").filter({ hasText: expiredName });
    await expect(row.getByText("Süresi geçti")).toBeVisible();
  } finally {
    await removeDocument(request, ctx.admin, expiredId);
    await removeDocument(request, ctx.admin, todayId);
  }
});
