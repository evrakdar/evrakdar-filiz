import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

const api = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:3001";

async function login(request: APIRequestContext, username: string, password: string) {
  const response = await request.post(`${api}/auth/login`, { data: { username, password } });
  expect(response.ok()).toBe(true);

  return { Authorization: `Bearer ${(await response.json()).data.accessToken}` };
}

async function signIn(page: Page) {
  await page.goto("/");
  await page.getByLabel("Kullanıcı adı").fill("admin");
  await page.getByLabel("Şifre").fill("admin123");
  await page.getByRole("button", { name: "Giriş yap" }).click();
  await expect(page.getByRole("heading", { name: "Kurumsal doküman merkezi" })).toBeVisible();
}

test("only the administrator adds, renames or removes a top-level folder", async ({ request }) => {
  const admin = await login(request, "admin", "admin123");
  const editor = await login(request, "editor", "editor123");
  const name = `Ana Klasör ${Date.now()}`;

  expect((await request.post(`${api}/folders`, { headers: editor, data: { name } })).status()).toBe(403);

  const created = await request.post(`${api}/folders`, { headers: admin, data: { name } });
  expect(created.status()).toBe(201);
  const { id } = (await created.json()).data;

  expect((await request.post(`${api}/folders`, { headers: admin, data: { name } })).status(), "aynı ad ikinci kez olmaz").toBe(409);
  expect((await request.patch(`${api}/folders/${id}`, { headers: editor, data: { name: `${name} x` } })).status()).toBe(403);
  expect((await request.delete(`${api}/folders/${id}`, { headers: editor })).status()).toBe(403);

  // Inside a top-level folder an editor works as before.
  const child = await request.post(`${api}/folders`, { headers: editor, data: { name: "Alt", parentId: id } });
  expect(child.status()).toBe(201);
  expect((await request.delete(`${api}/folders/${id}`, { headers: admin })).status(), "dolu klasör silinmez").toBe(409);

  const childId = (await child.json()).data.id;
  expect((await request.delete(`${api}/folders/${childId}`, { headers: editor })).ok()).toBe(true);
  expect((await request.patch(`${api}/folders/${id}`, { headers: admin, data: { name: `${name} y` } })).ok()).toBe(true);
  expect((await request.delete(`${api}/folders/${id}`, { headers: admin })).ok()).toBe(true);
});

test("the home page keeps to two rows and the panel still adds up", async ({ page, request }) => {
  const admin = await login(request, "admin", "admin123");
  const stamp = Date.now();
  const ids: string[] = [];

  try {
    for (let index = 0; index < 8; index += 1) {
      const response = await request.post(`${api}/folders`, { headers: admin, data: { name: `Zz Kart ${stamp} ${index}` } });
      expect(response.status()).toBe(201);
      ids.push((await response.json()).data.id);
    }

    const roots = (await (await request.get(`${api}/folders/root`, { headers: admin })).json()).data as { name: string }[];
    const more = page.getByRole("button", { name: `Tümünü gör (${roots.length})` });

    await signIn(page);
    await expect(more).toBeVisible();
    await expect(page.getByRole("button", { name: new RegExp(`Zz Kart ${stamp} 7`) })).toHaveCount(0);
    await more.click();
    await expect(page.getByRole("button", { name: new RegExp(`Zz Kart ${stamp} 7`) })).toBeVisible();
    await page.getByRole("button", { name: "Daha az göster" }).click();
    await expect(more).toBeVisible();

    await page.locator("aside").first().getByRole("button", { name: "Yönetici Paneli" }).click();
    await expect(page.getByText(`Diğer (${roots.length - 8} klasör)`)).toBeVisible();
  } finally {
    for (const id of ids) {
      await request.delete(`${api}/folders/${id}`, { headers: admin });
    }
  }
});

test("the administrator can add a top-level folder from the explorer", async ({ page, request }) => {
  const admin = await login(request, "admin", "admin123");
  const name = `Ekrandan Klasör ${Date.now()}`;

  await signIn(page);
  await page.locator("aside").first().getByRole("button", { name: "Dosya ve Klasörler" }).click();
  await page.getByRole("button", { name: "Yeni Klasör" }).first().click();
  await page.getByLabel("Yeni klasör adı").fill(name);
  await page.getByRole("dialog").getByRole("button", { name: /Kaydet|Oluştur|Onayla|Tamam/ }).click();
  await expect(page.getByText("Ana klasör oluşturuldu.")).toBeVisible();

  const roots = (await (await request.get(`${api}/folders/root`, { headers: admin })).json()).data as { id: string; name: string }[];
  const created = roots.find((folder) => folder.name === name);
  expect(created).toBeTruthy();
  await request.delete(`${api}/folders/${created!.id}`, { headers: admin });
});
