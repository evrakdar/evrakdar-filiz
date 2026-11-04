import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

const api = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:3001";
type Auth = { Authorization: string };
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");

async function login(request: APIRequestContext, username: string, password: string): Promise<Auth> {
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

/** Two categories, a folder inside the first one, and a picture in each. */
async function arrange(request: APIRequestContext, admin: Auth) {
  const mark = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const roots = (await (await request.get(`${api}/folders/root`, { headers: admin })).json()).data as Array<{ id: string; name: string }>;
  const departments = (await (await request.get(`${api}/departments`, { headers: admin })).json()).data as Array<{ id: string }>;
  const [first, second] = roots;
  const child = await request.post(`${api}/folders`, { headers: admin, data: { name: `Alt ${mark}`, parentId: first.id, responsibleDepartmentId: departments[0].id } });
  expect(child.ok(), await child.text()).toBe(true);
  const childId = (await child.json()).data.id as string;
  const ids: string[] = [];
  const upload = async (name: string, folderId: string, extra: Record<string, string> = {}) => {
    const response = await request.post(`${api}/documents/upload`, {
      headers: admin,
      multipart: {
        file: { name: "resim.png", mimeType: "image/png", buffer: PNG },
        name,
        folderId,
        documentType: "OTHER",
        responsibleDepartmentId: departments[0].id,
        ...extra
      }
    });
    expect(response.ok(), await response.text()).toBe(true);
    const id = (await response.json()).data.id as string;
    ids.push(id);
    return id;
  };

  const inFirst = `Kapsam Birinci ${mark}`;
  const inChild = `Kapsam Alt ${mark}`;
  const inSecond = `Kapsam İkinci ${mark}`;
  await upload(inFirst, first.id);
  await upload(inChild, childId);
  await upload(inSecond, second.id);

  return { mark, first, second, childId, ids, upload, inFirst, inChild, inSecond, departments };
}

async function cleanUp(request: APIRequestContext, admin: Auth, ids: string[], folderId: string) {
  for (const id of ids) {
    await request.delete(`${api}/documents/${id}`, { headers: admin });
    await request.delete(`${api}/trash/documents/${id}`, { headers: admin });
  }

  await request.delete(`${api}/folders/${folderId}`, { headers: admin });
  await request.delete(`${api}/trash/folders/${folderId}`, { headers: admin });
}

test("the server keeps filters inside a folder and its subfolders", async ({ request }) => {
  const admin = await login(request, "admin", "admin123");
  const setup = await arrange(request, admin);
  const names = async (query: string) => {
    const response = await request.get(`${api}/documents?limit=100&${query}`, { headers: admin });
    expect(response.ok(), await response.text()).toBe(true);
    return ((await response.json()).data as Array<{ name: string }>).map((item) => item.name);
  };

  const inside = await names(`underFolderId=${setup.first.id}&fileType=IMAGE`);
  expect(inside).toContain(setup.inFirst);
  expect(inside, "alt klasördeki de gelir").toContain(setup.inChild);
  expect(inside, "başka kategorideki gelmez").not.toContain(setup.inSecond);

  const deeper = await names(`underFolderId=${setup.childId}`);
  expect(deeper).toContain(setup.inChild);
  expect(deeper).not.toContain(setup.inFirst);

  expect(await names("underFolderId=olmayan-klasor")).toEqual([]);
  expect((await request.get(`${api}/documents?listScope=uydurma`, { headers: admin })).status()).toBe(400);

  await cleanUp(request, admin, setup.ids, setup.childId);
});

test("the lists keep filters inside them", async ({ request }) => {
  const admin = await login(request, "admin", "admin123");
  const editor = await login(request, "editor", "editor123");
  const setup = await arrange(request, admin);
  const names = async (auth: Auth, query: string) =>
    ((await (await request.get(`${api}/documents?limit=100&${query}`, { headers: auth })).json()).data as Array<{ name: string }>).map((item) => item.name);

  const day = (offset: number) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);
  const expired = `Kapsam Süresi Geçmiş ${setup.mark}`;
  const expiring = `Kapsam Yaklaşan ${setup.mark}`;
  await setup.upload(expired, setup.first.id, { validUntil: day(-5) });
  await setup.upload(expiring, setup.first.id, { validUntil: day(5) });

  const expiredList = await names(admin, "listScope=expired&fileType=IMAGE");
  expect(expiredList).toContain(expired);
  expect(expiredList).not.toContain(expiring);
  expect(expiredList).not.toContain(setup.inFirst);

  const expiringList = await names(admin, "listScope=expiring&fileType=IMAGE");
  expect(expiringList).toContain(expiring);
  expect(expiringList).not.toContain(expired);

  expect(await names(admin, "listScope=mine&fileType=IMAGE")).toContain(setup.inFirst);
  expect(await names(editor, "listScope=mine&fileType=IMAGE"), "başkasının eklediği gelmez").not.toContain(setup.inFirst);

  await cleanUp(request, admin, setup.ids, setup.childId);
});

test("nobody sees a confidential document through the new routes", async ({ request }) => {
  const admin = await login(request, "admin", "admin123");
  const viewer = await login(request, "viewer", "viewer123");
  const setup = await arrange(request, admin);
  const viewerMe = (await (await request.get(`${api}/auth/me`, { headers: viewer })).json()).data as { department?: { id: string } | null; departmentId?: string | null };
  const viewerDepartment = viewerMe.department?.id ?? viewerMe.departmentId;
  const other = setup.departments.find((department) => department.id !== viewerDepartment)!;
  const secret = `Kapsam Gizli ${setup.mark}`;
  const day = new Date(Date.now() + 5 * 86_400_000).toISOString().slice(0, 10);
  await setup.upload(secret, setup.first.id, { accessLevel: "CONFIDENTIAL", responsibleDepartmentId: other.id, validUntil: day });

  for (const query of [`underFolderId=${setup.first.id}`, "listScope=expiring"]) {
    const visible = ((await (await request.get(`${api}/documents?limit=100&${query}`, { headers: viewer })).json()).data as Array<{ name: string }>).map((item) => item.name);
    expect(visible, query).not.toContain(secret);
    const forAdmin = ((await (await request.get(`${api}/documents?limit=100&${query}`, { headers: admin })).json()).data as Array<{ name: string }>).map((item) => item.name);
    expect(forAdmin, query).toContain(secret);
  }

  await cleanUp(request, admin, setup.ids, setup.childId);
});

test("on screen, filters stay in the open category and the person comes back to it", async ({ page, request }) => {
  const admin = await login(request, "admin", "admin123");
  const setup = await arrange(request, admin);

  await signIn(page);
  // The "frequently used" shortcut opens the category just like its card.
  await page.getByRole("button", { name: setup.first.name, exact: true }).first().click();
  await expect(page.getByRole("button", { name: `Alt ${setup.mark}` }).first()).toBeVisible();

  await page.getByLabel("Filtre dosya turu").selectOption("IMAGE");
  await expect(page.getByRole("heading", { name: `${setup.first.name} içinde süzülen belgeler` })).toBeVisible();
  await expect(page.getByRole("cell", { name: setup.inFirst })).toBeVisible();
  await expect(page.getByRole("cell", { name: setup.inChild })).toBeVisible();
  await expect(page.getByRole("cell", { name: setup.inSecond })).toHaveCount(0);

  // The search box looks through everything, and leaves the place alone.
  await page.getByRole("searchbox").fill(setup.inSecond);
  await expect(page.getByRole("heading", { name: "Tüm sistemde arama sonuçları" })).toBeVisible();
  await expect(page.getByRole("cell", { name: setup.inSecond })).toBeVisible();
  await page.getByRole("searchbox").fill("");
  await expect(page.getByRole("heading", { name: `${setup.first.name} içinde süzülen belgeler` })).toBeVisible();

  await page.getByRole("button", { name: "Filtreleri temizle" }).click();
  await expect(page.getByRole("button", { name: `Alt ${setup.mark}` }).first(), "aynı kategoride kalır").toBeVisible();

  await cleanUp(request, admin, setup.ids, setup.childId);
});

test("on the explorer, filters stay in the open folder and the folder stays open", async ({ page, request }) => {
  const admin = await login(request, "admin", "admin123");
  const setup = await arrange(request, admin);

  await signIn(page);
  await page.getByRole("button", { name: "Dosya ve Klasörler" }).click();
  const explorer = page.getByRole("region", { name: /Dosya ve Klas/ });
  await expect(explorer).toBeVisible();
  await explorer.getByText(setup.first.name, { exact: true }).first().dblclick();
  await expect(explorer.getByText(`Alt ${setup.mark}`).first()).toBeVisible();

  await page.getByLabel("Filtre dosya turu").selectOption("IMAGE");
  await expect(page.getByRole("heading", { name: `${setup.first.name} içinde süzülen belgeler` })).toBeVisible();
  await expect(page.getByRole("cell", { name: setup.inSecond })).toHaveCount(0);

  await page.getByRole("button", { name: "Filtreleri temizle" }).click();
  await expect(explorer.getByText(`Alt ${setup.mark}`).first(), "klasör açık kalır").toBeVisible();

  await cleanUp(request, admin, setup.ids, setup.childId);
});

test("a side menu list keeps its name and its limits while filtering", async ({ page }) => {
  await signIn(page);
  await page.getByRole("button", { name: "Süresi Geçenler" }).click();
  await page.getByLabel("Filtre dosya turu").selectOption("PDF");
  await expect(page.getByRole("heading", { name: "Süresi Geçenler içinde süzülen belgeler" })).toBeVisible();

  // Between document screens the filter stays and follows.
  await page.getByRole("button", { name: "Son Eklenenler" }).click();
  await expect(page.getByRole("heading", { name: "Son Eklenenler içinde süzülen belgeler" })).toBeVisible();
  await expect(page.getByLabel("Filtre dosya turu")).toHaveValue("PDF");
});

test("chosen filters show as labels that can be removed one by one or all together", async ({ page }) => {
  await signIn(page);
  const labels = page.getByLabel("Seçili filtreler");
  await expect(labels).toHaveCount(0);

  await page.getByLabel("Filtre dosya turu").selectOption("EXCEL");
  await page.getByLabel("Filtre dokuman turu").selectOption("REPORT");
  await page.getByLabel("Başlangıç tarihi").fill("2026-03-12");
  await expect(labels.getByText("Dosya türü: Excel")).toBeVisible();
  await expect(labels.getByText("Doküman türü: Rapor")).toBeVisible();
  await expect(labels.getByText("Başlangıç: 12.03.2026")).toBeVisible();

  await page.getByRole("button", { name: "Doküman türü filtresini kaldır" }).click();
  await expect(labels.getByText("Doküman türü: Rapor")).toHaveCount(0);
  await expect(labels.getByText("Dosya türü: Excel"), "ötekiler kalır").toBeVisible();
  await expect(page.getByLabel("Filtre dokuman turu")).toHaveValue("");

  await page.getByRole("button", { name: "Filtreleri temizle" }).click();
  await expect(labels).toHaveCount(0);
  await expect(page.getByLabel("Filtre dosya turu")).toHaveValue("");
  await expect(page.getByRole("heading", { name: "Kurumsal doküman merkezi" })).toBeVisible();
});

test("screens without documents have no filters, and open even if a filter was on", async ({ page }) => {
  await signIn(page);
  await page.getByLabel("Filtre dosya turu").selectOption("PDF");
  await expect(page.getByRole("heading", { name: "Süzülen belgeler" })).toBeVisible();

  for (const [menu, heading] of [
    ["Yönetici Paneli", "Yönetici Paneli"],
    ["Birimler", "Birimler"],
    ["Geri Dönüşüm Kutusu", "Silinen dosya ve klasörler"],
    ["Veri Girişi", "Veri Girişi"]
  ]) {
    await page.locator("aside").getByRole("button", { name: menu }).click();
    await expect(page.getByRole("heading", { name: heading, level: 1 })).toBeVisible();
    await expect(page.getByLabel("Filtre dosya turu"), menu).toHaveCount(0);
  }

  await page.locator("aside").getByRole("button", { name: "Son Eklenenler" }).click();
  await expect(page.getByLabel("Filtre dosya turu"), "filtre panele girince temizlendi").toHaveValue("");
});
