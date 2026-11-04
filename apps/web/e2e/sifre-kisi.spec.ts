import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

const api = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:3001";
const STRONG = "Gecici-Sifre-1234";
const RULE = /^(?=.*\p{Lu})(?=.*\p{Ll})(?=.*\p{Nd})(?=.*[^\p{L}\p{N}\s]).{9,}$/u;
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");

async function login(request: APIRequestContext, username: string, password: string) {
  const response = await request.post(`${api}/auth/login`, { data: { username, password } });
  expect(response.ok(), await response.text()).toBe(true);

  return { Authorization: `Bearer ${(await response.json()).data.accessToken}` };
}

async function signIn(page: Page) {
  await page.goto("/");
  await page.getByLabel("Kullanıcı adı").fill("admin");
  await page.getByLabel("Şifre").fill("admin123");
  await page.getByRole("button", { name: "Giriş yap" }).click();
  await expect(page.getByRole("heading", { name: "Kurumsal doküman merkezi" })).toBeVisible();
}

const stamp = () => `${Date.now()}${Math.floor(Math.random() * 1000)}`;

async function addPerson(request: APIRequestContext, admin: Record<string, string>, role = "VIEWER", firstName = "Geçici") {
  const username = `kisi.${stamp()}`;
  const response = await request.post(`${api}/admin/users`, {
    headers: admin,
    data: { firstName, lastName: "Denemesi", username, email: `${username}@okul.test`, password: STRONG, role }
  });
  expect(response.status(), await response.text()).toBe(201);

  return { id: (await response.json()).data.id as string, username };
}

test("the password rule holds wherever a password is given", async ({ request }) => {
  const admin = await login(request, "admin", "admin123");
  const username = `kural.${stamp()}`;
  const add = (password: string) =>
    request.post(`${api}/admin/users`, {
      headers: admin,
      data: { firstName: "Kural", lastName: "Denemesi", username, email: `${username}@okul.test`, password, role: "VIEWER" }
    });

  for (const weak of ["Ab1!abc", "kucukharf1!", "BUYUKHARF1!", "Rakamsiz-Sifre", "Sembolsuz123", "Çok-Uzun1".repeat(10)]) {
    expect((await add(weak)).status(), weak).toBe(400);
  }

  // Turkish letters count as letters, and nine characters are enough.
  expect((await add("Şğı-İöç1a")).status()).toBe(201);
  const person = (await (await request.get(`${api}/admin/users?q=${username}`, { headers: admin })).json()).data[0];

  expect((await request.patch(`${api}/admin/users/${person.id}`, { headers: admin, data: { password: "kisa" } })).status()).toBe(400);
  expect((await request.patch(`${api}/admin/users/${person.id}`, { headers: admin, data: { password: "UzunAmaSembolsuz1" } })).status()).toBe(400);

  const own = await login(request, username, "Şğı-İöç1a");
  const change = (newPassword: string) =>
    request.post(`${api}/auth/change-password`, { headers: own, data: { currentPassword: "Şğı-İöç1a", newPassword } });
  expect((await change("zayifsifre")).status()).toBe(400);
  expect((await change("Guclu-Sifre-99")).status()).toBeLessThan(300);
  await login(request, username, "Guclu-Sifre-99");

  // Passwords set before the rule keep working.
  await login(request, "viewer", "viewer123");
});

test("a new person gets a visible password that follows the rule, and it stays readable after saving", async ({ page, request }) => {
  await signIn(page);
  await page.getByRole("button", { name: "Tüm Kullanıcılar ve Yetkilendirme" }).click();
  await page.getByRole("button", { name: "Yeni kullanıcı" }).click();

  const form = page;
  const field = form.getByLabel("Şifre", { exact: true });
  const first = await field.inputValue();
  expect(first).toHaveLength(13);
  expect(first).toMatch(RULE);
  await expect(field).toHaveAttribute("type", "text");

  await form.getByRole("button", { name: "Yazılanı gizle" }).click();
  await expect(field).toHaveAttribute("type", "password");
  await form.getByRole("button", { name: "Yazılanı göster" }).click();
  await expect(field).toHaveAttribute("type", "text");

  for (let turn = 0; turn < 20; turn += 1) {
    await form.getByRole("button", { name: "Yeniden üret" }).click();
    const made = await field.inputValue();
    expect(made).toHaveLength(13);
    expect(made, "üretilen şifre kurala uymalı").toMatch(RULE);
    expect(made).not.toMatch(/[0O1lI]/);
  }

  const password = await field.inputValue();
  expect(password).not.toBe(first);
  const name = stamp();
  await form.getByLabel("Ad", { exact: true }).fill("Otomatik");
  await form.getByLabel("Soyad").fill(`Şifre${name}`);
  const username = `otomatik.${name}`;
  await form.getByLabel("Kullanıcı adı").fill(username);
  await form.getByLabel("E-posta").fill(`${username}@okul.test`);
  await form.getByRole("button", { name: "Kullanıcıyı ekle" }).click();

  await expect(page.locator("code", { hasText: password })).toBeVisible();
  await login(request, username, password);

  // A weak password typed by hand is stopped before anything is saved.
  await page.getByRole("button", { name: "Yeni kullanıcı" }).click();
  await expect(page.locator("code", { hasText: password })).toHaveCount(0);
  await form.getByLabel("Şifre", { exact: true }).fill("zayif");
  await form.getByRole("button", { name: "Kullanıcıyı ekle" }).click();
  await expect(page.getByText(/Şifre kurala uymuyor/)).toBeVisible();
});

test("the sign-in page and the change dialog can show what was typed", async ({ page }) => {
  await page.goto("/");
  const field = page.getByLabel("Şifre");
  await field.fill("deneme");
  await expect(field).toHaveAttribute("type", "password");
  await page.getByRole("button", { name: "Yazılanı göster" }).click();
  await expect(field).toHaveAttribute("type", "text");

  await field.fill("admin123");
  await page.getByLabel("Kullanıcı adı").fill("admin");
  await page.getByRole("button", { name: "Giriş yap" }).click();
  await expect(page.getByRole("heading", { name: "Kurumsal doküman merkezi" })).toBeVisible();

  await page.getByRole("button", { name: "Şifremi Değiştir" }).click();
  const dialog = page.getByRole("form", { name: "Şifre değiştirme" });
  await expect(dialog.getByRole("button", { name: "Yazılanı göster" })).toHaveCount(3);
  await expect(dialog.getByText(/En az 9 karakter/)).toBeVisible();
});

test("a passive person can be brought back or removed for good", async ({ page, request }) => {
  const admin = await login(request, "admin", "admin123");
  const viewer = await login(request, "viewer", "viewer123");
  const person = await addPerson(request, admin);
  const refused = await request.post(`${api}/auth/login`, { data: { username: person.username, password: STRONG } });
  expect(refused.ok()).toBe(true);

  expect((await request.delete(`${api}/admin/users/${person.id}/permanent`, { headers: admin })).status(), "aktif kişi silinmez").toBe(409);
  expect((await request.post(`${api}/admin/users/${person.id}/activate`, { headers: viewer })).status(), "yetkisiz").toBe(403);
  expect((await request.delete(`${api}/admin/users/${person.id}/permanent`, { headers: viewer })).status(), "yetkisiz").toBe(403);

  expect((await request.delete(`${api}/admin/users/${person.id}`, { headers: admin })).status()).toBeLessThan(300);
  expect((await request.post(`${api}/auth/login`, { data: { username: person.username, password: STRONG } })).status(), "pasif giremez").toBe(401);

  expect((await request.post(`${api}/admin/users/${person.id}/activate`, { headers: admin })).status()).toBe(200);
  await login(request, person.username, STRONG);

  await request.delete(`${api}/admin/users/${person.id}`, { headers: admin });

  await signIn(page);
  await page.getByRole("button", { name: "Tüm Kullanıcılar ve Yetkilendirme" }).click();
  await page.getByPlaceholder("Ad, soyad, kullanıcı adı veya e-posta").fill(person.username);
  const row = page.locator("tbody tr", { hasText: person.username });
  await expect(row.getByText("Pasif", { exact: true })).toBeVisible();
  await expect(row.getByRole("button", { name: "Güncelle" })).toBeHidden();
  await expect(row.getByRole("button", { name: "Pasifleştir" })).toBeHidden();
  await row.getByRole("button", { name: "Aktifleştir" }).click();
  await expect(row.getByText("Aktif", { exact: true })).toBeVisible();
  await row.getByRole("button", { name: "Pasifleştir" }).click({ trial: true });
  await request.delete(`${api}/admin/users/${person.id}`, { headers: admin });
  await page.getByRole("button", { name: "Yenile" }).click();
  page.once("dialog", (dialog) => void dialog.accept());
  await row.getByRole("button", { name: "Sil", exact: true }).click();
  await expect(page.getByText("Kullanıcı silindi.")).toBeVisible();
  await expect(row).toHaveCount(0);

  expect((await request.post(`${api}/auth/login`, { data: { username: person.username, password: STRONG } })).status()).toBe(401);
  expect((await request.get(`${api}/admin/users/${person.id}`, { headers: admin })).status()).toBe(404);
  expect((await (await request.get(`${api}/admin/users?q=${person.username}`, { headers: admin })).json()).data).toHaveLength(0);
  expect((await request.patch(`${api}/admin/users/${person.id}`, { headers: admin, data: { title: "Hayalet" } })).status()).toBe(404);

  // The username and address are free again.
  const again = await request.post(`${api}/admin/users`, {
    headers: admin,
    data: { firstName: "Yeni", lastName: "Kişi", username: person.username, email: `${person.username}@okul.test`, password: STRONG, role: "VIEWER" }
  });
  expect(again.status(), await again.text()).toBe(201);

  // One's own account stays safe.
  const me = (await (await request.get(`${api}/admin/users?q=admin`, { headers: admin })).json()).data.find((user: { username: string }) => user.username === "admin");
  expect((await request.delete(`${api}/admin/users/${me.id}/permanent`, { headers: admin })).status()).toBe(400);
});

test("the role can be changed in the edit window too", async ({ page, request }) => {
  const admin = await login(request, "admin", "admin123");
  const person = await addPerson(request, admin);

  await signIn(page);
  await page.getByRole("button", { name: "Tüm Kullanıcılar ve Yetkilendirme" }).click();
  await page.getByPlaceholder("Ad, soyad, kullanıcı adı veya e-posta").fill(person.username);
  const row = page.locator("tbody tr", { hasText: person.username });
  await row.getByRole("button", { name: "Güncelle" }).click();

  const form = page;
  await expect(form.getByLabel("Yeni şifre")).toHaveValue("");
  await expect(form.getByLabel("Rol", { exact: true })).toHaveValue("VIEWER");
  await form.getByLabel("Rol", { exact: true }).selectOption("EDITOR");
  await form.getByRole("button", { name: "Şifre üret" }).click();
  const password = await form.getByLabel("Yeni şifre").inputValue();
  expect(password).toMatch(RULE);
  await form.getByLabel("Yeni şifre").fill(STRONG);
  await form.getByRole("button", { name: "Değişiklikleri kaydet" }).click();
  await expect(page.getByText("Kullanıcı bilgileri güncellendi.")).toBeVisible();
  await expect(page.locator("code", { hasText: STRONG })).toBeVisible();
  await expect(row.getByLabel(`${person.username} yetki`)).toHaveValue("EDITOR");

  const stored = (await (await request.get(`${api}/admin/users/${person.id}`, { headers: admin })).json()).data;
  expect(stored.roles).toEqual(["EDITOR"]);
});

test("the size of everything stored is counted, old versions and the recycle bin included", async ({ request }) => {
  const admin = await login(request, "admin", "admin123");
  const total = async () => (await (await request.get(`${api}/admin/dashboard/summary`, { headers: admin })).json()).data.totalStorageBytes as number;
  const departments = (await (await request.get(`${api}/departments`, { headers: admin })).json()).data;
  const folders = (await (await request.get(`${api}/folders/root`, { headers: admin })).json()).data;
  const before = await total();

  const uploaded = await request.post(`${api}/documents/upload`, {
    headers: admin,
    multipart: {
      file: { name: "boyut.txt", mimeType: "text/plain", buffer: Buffer.alloc(1000, 97) },
      name: `Boyut ${stamp()}`,
      folderId: folders[0].id,
      documentType: "OTHER",
      responsibleDepartmentId: departments[0].id
    }
  });
  expect(uploaded.ok(), await uploaded.text()).toBe(true);
  const id = (await uploaded.json()).data.id as string;
  expect(await total()).toBe(before + 1000);

  const version = await request.post(`${api}/documents/${id}/new-version`, {
    headers: admin,
    multipart: { file: { name: "boyut.txt", mimeType: "text/plain", buffer: Buffer.alloc(500, 98) } }
  });
  expect(version.ok(), await version.text()).toBe(true);
  expect(await total()).toBe(before + 1500);

  await request.delete(`${api}/documents/${id}`, { headers: admin });
  expect(await total(), "çöpteki dosya da yer kaplar").toBe(before + 1500);

  await request.delete(`${api}/trash/documents/${id}`, { headers: admin });
  expect(await total()).toBe(before);
});

test("file type filter finds its own kind, with or without a search word", async ({ page, request }) => {
  const admin = await login(request, "admin", "admin123");
  const departments = (await (await request.get(`${api}/departments`, { headers: admin })).json()).data;
  const folders = (await (await request.get(`${api}/folders/root`, { headers: admin })).json()).data;
  const mark = stamp();
  const ids: string[] = [];
  const upload = async (name: string, fileName: string, mimeType: string, buffer: Buffer) => {
    const response = await request.post(`${api}/documents/upload`, {
      headers: admin,
      multipart: { file: { name: fileName, mimeType, buffer }, name, folderId: folders[0].id, documentType: "OTHER", responsibleDepartmentId: departments[0].id }
    });
    expect(response.ok(), await response.text()).toBe(true);
    ids.push((await response.json()).data.id);
  };
  await upload(`Filtre Resim ${mark}`, "resim.png", "image/png", PNG);
  await upload(`Filtre Metin ${mark}`, "metin.txt", "text/plain", Buffer.from("metin"));

  const list = async (fileType: string) => {
    const response = await request.get(`${api}/documents?limit=100&fileType=${fileType}`, { headers: admin });
    expect(response.ok(), await response.text()).toBe(true);
    return ((await response.json()).data as Array<{ name: string }>).map((item) => item.name);
  };
  expect(await list("IMAGE")).toContain(`Filtre Resim ${mark}`);
  expect(await list("IMAGE")).not.toContain(`Filtre Metin ${mark}`);
  expect(await list("TEXT")).toContain(`Filtre Metin ${mark}`);
  expect((await request.get(`${api}/documents?fileType=UYDURMA`, { headers: admin })).status()).toBe(400);

  const paperName = `Filtre Kağıt ${mark}`;
  const paper = await request.post(`${api}/documents`, {
    headers: admin,
    data: { name: paperName, folderId: folders[0].id, documentType: "REPORT", responsibleDepartmentId: departments[0].id }
  });
  expect(paper.ok(), await paper.text()).toBe(true);
  ids.push((await paper.json()).data.id);
  expect(await list("PDF"), "kağıt belgenin dosyası yok").not.toContain(paperName);

  await signIn(page);
  await page.getByLabel("Filtre dosya turu").selectOption("IMAGE");
  await expect(page.getByRole("heading", { name: /arama sonuçları|süzülen belgeler/i })).toBeVisible();
  await expect(page.getByText(`Filtre Resim ${mark}`).first()).toBeVisible();
  await expect(page.getByText(`Filtre Metin ${mark}`)).toHaveCount(0);

  await page.getByRole("searchbox").fill(`Filtre Metin ${mark}`);
  await expect(page.getByText(/için .*sonuç bulundu/)).toBeVisible();
  await expect(page.getByRole("cell", { name: `Filtre Metin ${mark}` }), "resim süzgeci metin belgesini getirmez").toHaveCount(0);

  const documentTypes = await page.getByLabel("Filtre dokuman turu").locator("option").allTextContents();
  expect(documentTypes.join(" ")).not.toMatch(/PDF|Word|Excel/);

  for (const id of ids) {
    await request.delete(`${api}/documents/${id}`, { headers: admin });
    await request.delete(`${api}/trash/documents/${id}`, { headers: admin });
  }
});
