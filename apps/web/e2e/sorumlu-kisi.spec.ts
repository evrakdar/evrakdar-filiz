import { expect, test, type APIRequestContext } from "@playwright/test";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:3001";

async function login(request: APIRequestContext, username: string, password: string) {
  const response = await request.post(`${apiBaseUrl}/auth/login`, { data: { username, password } });
  expect(response.ok()).toBe(true);

  return { Authorization: `Bearer ${((await response.json()) as { data: { accessToken: string } }).data.accessToken}` };
}

test("a document's responsible person can be chosen and changed", async ({ page, request }) => {
  const admin = await login(request, "admin", "admin123");
  const viewer = await login(request, "viewer", "viewer123");

  expect((await request.get(`${apiBaseUrl}/documents/responsible-options`, { headers: viewer })).status()).toBe(403);
  const people = (await (await request.get(`${apiBaseUrl}/documents/responsible-options`, { headers: admin })).json()).data as Array<{
    id: string;
    name: string;
  }>;
  const editorEntry = people.find((person) => person.name.includes("Editor"));
  expect(editorEntry).toBeTruthy();
  expect(JSON.stringify(people)).not.toMatch(/passwordHash|email/i);

  const departments = (await (await request.get(`${apiBaseUrl}/departments`, { headers: admin })).json()).data;
  const folders = (await (await request.get(`${apiBaseUrl}/folders/root`, { headers: admin })).json()).data;
  const name = `Sorumlu Denemesi ${Date.now()}`;
  const created = await request.post(`${apiBaseUrl}/documents`, {
    headers: admin,
    data: { name, folderId: folders[0].id, documentType: "REPORT", responsibleDepartmentId: departments[0].id }
  });
  expect(created.ok()).toBe(true);
  const id = (await created.json()).data.id as string;

  const unknown = await request.patch(`${apiBaseUrl}/documents/${id}`, { headers: admin, data: { responsiblePersonId: "yok" } });
  expect(unknown.status()).toBe(404);

  await page.goto("/");
  await page.getByLabel("Kullanıcı adı").fill("admin");
  await page.getByLabel("Şifre").fill("admin123");
  await page.getByRole("button", { name: "Giriş yap" }).click();
  await page.getByRole("button", { name: "Son Eklenenler" }).click();
  await page.getByText(name).first().click();
  await page.getByRole("button", { name: "Bilgileri Düzenle" }).click();
  await page.getByLabel("Sorumlu kişi").selectOption(editorEntry!.id);
  await page.getByRole("button", { name: "Kaydet" }).click();
  await expect(page.getByLabel("Sorumlu kişi")).toHaveCount(0);

  const saved = (await (await request.get(`${apiBaseUrl}/documents/${id}`, { headers: admin })).json()).data;
  expect(saved.responsibleUser.id).toBe(editorEntry!.id);

  await request.delete(`${apiBaseUrl}/documents/${id}`, { headers: admin });
  await request.delete(`${apiBaseUrl}/trash/documents/${id}`, { headers: admin });
});
