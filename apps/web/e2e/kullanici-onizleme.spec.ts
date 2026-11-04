import { createRequire } from "node:module";
import { resolve } from "node:path";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

const api = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:3001";
const JSZip = createRequire(resolve(process.cwd(), "package.json"))("jszip");

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

async function buildDocx(text: string): Promise<Buffer> {
  const zip = new JSZip();
  zip.file("[Content_Types].xml", '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
  zip.file("_rels/.rels", '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="r1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
  zip.file("word/document.xml", `<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>${text}</w:t></w:r></w:p></w:body></w:document>`);

  return zip.generateAsync({ type: "nodebuffer" });
}

const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");

test("names and titles are written properly, whatever was typed", async ({ request }) => {
  const admin = await login(request, "admin", "admin123");
  const stamp = String(Date.now());
  const created = await request.post(`${api}/admin/users`, {
    headers: admin,
    data: {
      firstName: "şükrü İLAYDA",
      lastName: "ıŞIK",
      title: "müdür YARDIMCISI",
      username: `yazim.${stamp}`,
      email: `yazim.${stamp}@okul.test`,
      password: "Gecici-Sifre-1234",
      role: "VIEWER"
    }
  });
  expect(created.status(), await created.text()).toBe(201);
  const user = (await created.json()).data;
  expect(user.firstName).toBe("Şükrü İlayda");
  expect(user.lastName).toBe("Işık");
  expect(user.title).toBe("Müdür Yardımcısı");

  for (const [typed, expected] of [
    ["BT uzmanı", "BT Uzmanı"],
    ["kalite ve akreditasyon SORUMLUSU", "Kalite ve Akreditasyon Sorumlusu"],
    ["prof.dr. iç denetçi", "Prof.Dr. İç Denetçi"],
    ["ve ile başlayan", "Ve ile Başlayan"]
  ]) {
    const updated = await request.patch(`${api}/admin/users/${user.id}`, { headers: admin, data: { title: typed } });
    expect((await updated.json()).data.title).toBe(expected);
  }
});

test("a free username is suggested and can be changed by hand", async ({ page, request }) => {
  const admin = await login(request, "admin", "admin123");
  const stamp = String(Date.now());
  const departments = (await (await request.get(`${api}/departments`, { headers: admin })).json()).data;
  const suggest = async (departmentId?: string) =>
    (await (await request.post(`${api}/admin/users/suggest`, { headers: admin, data: { firstName: "Ayşe Nur", lastName: `Yılmaz ${stamp}`, departmentId } })).json()).data.username as string;

  const free = await suggest();
  expect(free).toBe(`ayse.nur.yilmaz.${stamp}`);

  const addTaken = (username: string) =>
    request.post(`${api}/admin/users`, {
      headers: admin,
      data: { firstName: "Ayşe Nur", lastName: `Yılmaz ${stamp}`, username, email: `${username}@okul.test`, password: "Gecici-Sifre-1234", role: "VIEWER" }
    });

  await addTaken(free);
  const code = String(departments[0].code).toLocaleLowerCase("tr-TR");
  expect(await suggest(departments[0].id)).toContain(`${free}.`);
  expect(await suggest()).toBe(`${free}2`);
  expect(code.length).toBeGreaterThan(0);

  const viewer = await login(request, "viewer", "viewer123");
  expect((await request.post(`${api}/admin/users/suggest`, { headers: viewer, data: { firstName: "A", lastName: "B" } })).status()).toBe(403);

  await signIn(page);
  await page.getByRole("button", { name: "Tüm Kullanıcılar ve Yetkilendirme" }).click();
  await page.getByRole("button", { name: "Yeni kullanıcı" }).click();

  const form = page;
  // Role and department come before the username and password.
  const roleBox = await form.getByLabel("Rol", { exact: true }).first().boundingBox();
  const usernameBox = await form.getByLabel("Kullanıcı adı").boundingBox();
  expect(roleBox!.y).toBeLessThan(usernameBox!.y);

  await form.getByLabel("Ad", { exact: true }).fill("Ayşe Nur");
  await form.getByLabel("Soyad").fill(`Çelik ${stamp}`);
  await expect(form.getByLabel("Kullanıcı adı")).toHaveValue(`ayse.nur.celik.${stamp}`);

  await form.getByLabel("Kullanıcı adı").fill("elle.yazildi");
  await form.getByLabel("Soyad").fill(`Öztürk ${stamp}`);
  await page.waitForTimeout(800);
  await expect(form.getByLabel("Kullanıcı adı")).toHaveValue("elle.yazildi");
});

test("pictures, text and Word files open in the preview", async ({ page, request }) => {
  const admin = await login(request, "admin", "admin123");
  const viewer = await login(request, "viewer", "viewer123");
  const stamp = String(Date.now());
  const departments = (await (await request.get(`${api}/departments`, { headers: admin })).json()).data;
  const folders = (await (await request.get(`${api}/folders/root`, { headers: admin })).json()).data;
  const ids: string[] = [];
  const upload = async (name: string, fileName: string, mimeType: string, buffer: Buffer, accessLevel?: string) => {
    const response = await request.post(`${api}/documents/upload`, {
      headers: admin,
      multipart: {
        file: { name: fileName, mimeType, buffer },
        name,
        folderId: folders[0].id,
        documentType: "OTHER",
        responsibleDepartmentId: departments.find((d: { code: string }) => d.code !== "YON")?.id ?? departments[0].id,
        ...(accessLevel ? { accessLevel } : {})
      }
    });
    expect(response.ok(), await response.text()).toBe(true);
    const id = (await response.json()).data.id as string;
    ids.push(id);
    return id;
  };

  const wordId = await upload(`Önizleme Word ${stamp}`, "belge.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", await buildDocx(`ŞİKAYET ÇÖZÜM ${stamp}`));
  await upload(`Önizleme Resim ${stamp}`, "resim.png", "image/png", PNG);
  // Old Windows Notepad file in the Turkish code page: ş and ğ must not break.
  await upload(`Önizleme Metin ${stamp}`, "eski.txt", "text/plain", Buffer.from([0xfe, 0x69, 0x6b, 0x61, 0x79, 0x65, 0x74, 0x20, 0xf0, 0x20, 0x31]));
  const secretId = await upload(`Önizleme Gizli ${stamp}`, "gizli.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", await buildDocx("gizli"), "CONFIDENTIAL");

  const preview = await request.get(`${api}/documents/${wordId}/preview`, { headers: admin });
  expect(preview.status()).toBe(200);
  if ((preview.headers()["content-type"] ?? "").includes("pdf")) {
    expect((await preview.body()).subarray(0, 5).toString()).toBe("%PDF-");
  } else {
    expect((await preview.json()).data.html).toContain(`ŞİKAYET ÇÖZÜM ${stamp}`);
  }

  expect((await request.get(`${api}/documents/${secretId}/preview`, { headers: viewer })).status(), "gizli belge önizlenemez").toBe(404);
  expect((await request.get(`${api}/documents/${wordId}/preview`)).status(), "girişsiz önizlenemez").toBe(401);

  await signIn(page);
  await page.getByRole("button", { name: "Son Eklenenler" }).click();

  await page.getByText(`Önizleme Resim ${stamp}`).first().click();
  await expect(page.getByAltText("Belge görseli")).toBeVisible();

  await page.getByText(`Önizleme Metin ${stamp}`).first().click();
  await expect(page.locator("pre", { hasText: "şikayet ğ 1" })).toBeVisible();

  await page.getByText(`Önizleme Word ${stamp}`).first().click();
  await expect(page.getByTitle("Belge önizleme")).toBeVisible({ timeout: 30_000 });

  for (const id of ids) {
    await request.delete(`${api}/documents/${id}`, { headers: admin });
    await request.delete(`${api}/trash/documents/${id}`, { headers: admin });
  }
});

test("nothing technical or English shows on the screens", async ({ page, request }) => {
  const admin = await login(request, "admin", "admin123");
  const mistaken = await request.get(`${api}/documents/olmayan-belge`, { headers: admin });
  expect((await mistaken.json()).message).toBe("Belge bulunamadı.");
  const wrongLogin = await request.post(`${api}/auth/login`, { data: { username: "kimse", password: "yanlis" } });
  expect((await wrongLogin.json()).message).toBe("Kullanıcı adı veya şifre yanlış.");

  await signIn(page);
  await expect(page.locator("button[aria-label='Bildirimler'], svg.lucide-bell")).toHaveCount(0);

  const words = /\b(OCR|Meilisearch|reindex|indeksle|metadata|mock|fallback|API|job|Entity|backend|MVP)\b/i;
  const menu = await page.locator("aside").first().getByRole("button").allTextContents();

  for (const label of menu.filter((item) => item.trim() && !["Çıkış Yap", "Şifremi Değiştir"].includes(item.trim()))) {
    await page.locator("aside").first().getByRole("button", { name: label.trim(), exact: true }).click();
    await page.waitForTimeout(600);
    const text = await page.locator("main").innerText();
    expect(text.match(words)?.[0] ?? null, `${label} ekranı`).toBeNull();
  }
});
