import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

const api = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:3001";
type Auth = { Authorization: string };

async function login(request: APIRequestContext, username: string, password: string): Promise<Auth> {
  const response = await request.post(`${api}/auth/login`, { data: { username, password } });
  expect(response.ok(), await response.text()).toBe(true);

  return { Authorization: `Bearer ${(await response.json()).data.accessToken}` };
}

async function signIn(page: Page, username: string, password: string) {
  await page.goto("/");
  await page.getByLabel("Kullanıcı adı").fill(username);
  await page.getByLabel("Şifre").fill(password);
  await page.getByRole("button", { name: "Giriş yap" }).click();
  await expect(page.getByRole("heading", { name: "Kurumsal doküman merkezi" })).toBeVisible();
}

const PAGES = ["İşlem Kayıtları", "Onay Bekleyenler", "Arama Yönetimi", "E-posta Hatırlatma", "Kurum Ayarları"];

test("the full edition pages are for the administrator, closed at first, and remembered", async ({ page }) => {
  await signIn(page, "admin", "admin123");
  const toggle = page.getByRole("button", { name: "Tam Sürüm Sayfaları" });
  await expect(toggle).toBeVisible();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator("aside").getByRole("button", { name: "Kurum Ayarları" })).toHaveCount(0);

  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator("aside").getByRole("button", { name: "Kurum Ayarları" })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("button", { name: "Tam Sürüm Sayfaları" })).toHaveAttribute("aria-expanded", "true");
  await page.getByRole("button", { name: "Tam Sürüm Sayfaları" }).click();
  await page.reload();
  await expect(page.getByRole("button", { name: "Tam Sürüm Sayfaları" })).toHaveAttribute("aria-expanded", "false");
});

for (const [username, password] of [
  ["editor", "editor123"],
  ["viewer", "viewer123"]
]) {
  test(`${username} sees neither the sample pages nor the roles page`, async ({ page }) => {
    await signIn(page, username, password);
    await expect(page.getByRole("button", { name: "Tam Sürüm Sayfaları" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Roller ve Yetkiler" })).toHaveCount(0);
  });
}

test("every sample page says it is a sample, cannot be used, and asks nothing of the server", async ({ page }) => {
  await signIn(page, "admin", "admin123");
  await page.getByRole("button", { name: "Tam Sürüm Sayfaları" }).click();

  for (const title of PAGES) {
    await page.locator("aside").getByRole("button", { name: title }).click();
    const panel = page.getByRole("region", { name: title });
    await expect(panel.getByRole("heading", { name: title, level: 1 })).toBeVisible();

    const calls: string[] = [];
    const record = (request: { url(): string; method(): string; resourceType(): string }) => {
      if (["xhr", "fetch"].includes(request.resourceType())) {
        calls.push(`${request.method()} ${request.url()}`);
      }
    };
    page.on("request", record);

    await expect(panel.getByRole("note")).toContainText("Bu bir örnek görünümdür. Tam sürümde çalışır.");
    await expect(panel.getByRole("link", { name: "bilgi@evrakdar.com" })).toHaveAttribute("href", "mailto:bilgi@evrakdar.com");
    await expect(page.getByLabel("Filtre dosya turu"), "bu ekranda filtre olmaz").toHaveCount(0);

    // Nothing inside the sample can be reached, whether by mouse or keyboard.
    const buttons = panel.locator("[inert] button");
    const count = await buttons.count();

    for (let index = 0; index < count; index += 1) {
      await expect(buttons.nth(index)).toBeDisabled();
    }

    await page.waitForTimeout(400);
    page.off("request", record);
    expect(calls, `${title} sunucuya istek göndermemeli`).toEqual([]);
  }
});

test("the roles page matches what each role can really do", async ({ page, request }) => {
  const tokens = {
    Yönetici: await login(request, "admin", "admin123"),
    Düzenleyici: await login(request, "editor", "editor123"),
    Kullanıcı: await login(request, "viewer", "viewer123")
  };
  const me = async (auth: Auth) => (await (await request.get(`${api}/auth/me`, { headers: auth })).json()).data as { department?: { id: string } | null; departmentId?: string | null };
  const taken = new Set<string>();

  for (const auth of [tokens.Düzenleyici, tokens.Kullanıcı]) {
    const person = await me(auth);
    const id = person.department?.id ?? person.departmentId;

    if (id) {
      taken.add(id);
    }
  }

  const departments = (await (await request.get(`${api}/departments`, { headers: tokens.Yönetici })).json()).data as Array<{ id: string }>;
  const otherDepartment = departments.find((department) => !taken.has(department.id)) ?? departments[0];
  const folders = (await (await request.get(`${api}/folders/root`, { headers: tokens.Yönetici })).json()).data as Array<{ id: string }>;
  const uploaded = await request.post(`${api}/documents/upload`, {
    headers: tokens.Yönetici,
    multipart: {
      file: { name: "gizli.txt", mimeType: "text/plain", buffer: Buffer.from("gizli") },
      name: `Rol Tablosu Gizli ${Date.now()}`,
      folderId: folders[0].id,
      documentType: "OTHER",
      responsibleDepartmentId: otherDepartment.id,
      accessLevel: "CONFIDENTIAL"
    }
  });
  expect(uploaded.ok(), await uploaded.text()).toBe(true);
  const secretId = (await uploaded.json()).data.id as string;

  const none = "olmayan-kayit";
  // A refused request answers 403. Anything else means the door was open, even if the made-up record is not found.
  type Probe = (auth: Auth) => Promise<number>;
  const get = (path: string): Probe => async (auth) => (await request.get(`${api}${path}`, { headers: auth })).status();
  const post = (path: string): Probe => async (auth) => (await request.post(`${api}${path}`, { headers: auth, data: {} })).status();
  const patch = (path: string): Probe => async (auth) => (await request.patch(`${api}${path}`, { headers: auth, data: {} })).status();
  const remove = (path: string): Probe => async (auth) => (await request.delete(`${api}${path}`, { headers: auth })).status();

  const probes: Record<string, Probe[]> = {
    "Belgeleri görme": [get("/documents?limit=1")],
    "Belge indirme": [get(`/documents/${none}/download`)],
    "Belge bağlantısı paylaşma": [get(`/documents/${none}`)],
    "Favorilere ekleme": [post(`/favorites/${none}`)],
    "Belge ekleme": [post("/documents"), post("/documents/upload")],
    "Belge bilgilerini düzenleme, taşıma, kopyalama": [patch(`/documents/${none}`), post(`/documents/${none}/copy`)],
    "Dosyayı yenisiyle değiştirme": [post(`/documents/${none}/new-version`)],
    "Belge silme": [remove(`/documents/${none}`)],
    "Klasör ekleme": [post("/folders")],
    "Klasör düzenleme, taşıma, kopyalama": [patch(`/folders/${none}`), post(`/folders/${none}/copy`)],
    "Klasör silme": [remove(`/folders/${none}`)],
    "Geri alma": [post(`/trash/documents/${none}/restore`), post(`/trash/folders/${none}/restore`)],
    "Kalıcı silme": [remove(`/trash/documents/${none}`), remove(`/trash/folders/${none}`)],
    "Birim ekleme, düzenleme, silme": [post("/departments"), patch(`/departments/${none}`), remove(`/departments/${none}`)],
    "Kullanıcıları görme, ekleme, düzenleme, rol verme": [get("/admin/users"), post("/admin/users"), patch(`/admin/users/${none}`), patch(`/admin/users/${none}/roles`)],
    "Yönetici Paneli": [get("/admin/dashboard/summary")]
  };

  await signIn(page, "admin", "admin123");
  await page.getByRole("button", { name: "Roller ve Yetkiler" }).click();
  const panel = page.getByRole("region", { name: "Roller ve Yetkiler" });
  await expect(panel.getByText("Rol eklemek ve yetkileri değiştirmek tam sürümdedir.")).toBeVisible();

  const boxes = panel.getByRole("checkbox");
  const total = await boxes.count();
  const seen = new Set<string>();
  expect(total).toBeGreaterThan(0);

  for (let index = 0; index < total; index += 1) {
    const box = boxes.nth(index);
    await expect(box, "kutular değiştirilemez").toBeDisabled();
    const name = (await box.getAttribute("aria-label")) ?? "";
    const [row, role] = name.split(": ") as [string, keyof typeof tokens];
    const shown = await box.isChecked();
    seen.add(row);

    if (row === "Bütün gizli belgeleri görme") {
      expect((await request.get(`${api}/documents/${secretId}`, { headers: tokens[role] })).status() === 200, name).toBe(shown);
      continue;
    }

    expect(probes[row], `${row} için sınama yok`).toBeTruthy();

    for (const probe of probes[row]) {
      expect((await probe(tokens[role])) !== 403, name).toBe(shown);
    }
  }

  expect([...seen].sort()).toEqual([...Object.keys(probes), "Bütün gizli belgeleri görme"].sort());

  await request.delete(`${api}/documents/${secretId}`, { headers: tokens.Yönetici });
  await request.delete(`${api}/trash/documents/${secretId}`, { headers: tokens.Yönetici });
});

test("the user form points to the roles page", async ({ page }) => {
  await signIn(page, "admin", "admin123");
  await page.getByRole("button", { name: "Tüm Kullanıcılar ve Yetkilendirme" }).click();
  await page.getByRole("button", { name: "Yeni kullanıcı" }).click();
  await page.getByRole("button", { name: "Hangi rol ne yapabilir?" }).click();
  await expect(page.getByRole("heading", { name: "Roller ve Yetkiler", level: 1 })).toBeVisible();
});
