import { expect, test, type Page } from "@playwright/test";

import { TestFixtureCleanup } from "./helpers/fixture-cleanup";

const adminUsername = "admin";
const adminPassword = "admin123";
const editorUsername = "editor";
const editorPassword = "editor123";
const viewerUsername = "viewer";
const viewerPassword = "viewer123";
const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:3001";
const fixtureCleanup = new TestFixtureCleanup(apiBaseUrl);

test.beforeEach(async ({ context, page }) => {
  fixtureCleanup.reset();
  await fixtureCleanup.cleanupKnownFixtures(page);
  await context.clearCookies();
  await page.goto("/");
  await page.evaluate(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
});

test.afterEach(async ({ page }) => {
  await fixtureCleanup.cleanup(page);
});

test("redirects unauthenticated dashboard visits to login", async ({ page }) => {
  await page.goto("/dashboard");

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: "Sisteme giriş" })).toBeVisible();
});

test("shows an error for invalid credentials", async ({ page }) => {
  await page.goto("/");

  await page.getByLabel("Kullanıcı adı").fill(adminUsername);
  await page.getByLabel("Şifre").fill("wrong-password");
  await page.getByRole("button", { name: "Giriş yap" }).click();

  await expect(page.getByText("Kullanıcı adı veya şifre hatalı.")).toBeVisible();
  await expect(page).toHaveURL(/\/$/);
});

test("allows viewers to browse but blocks document entry", async ({ page }) => {
  const documentName = `Viewer Search Dokuman ${Date.now()}`;
  await createMetadataDocumentViaApi(page, documentName, { description: "Viewer global search smoke" });

  await loginAs(page, viewerUsername, viewerPassword);

  const sidebar = page.getByRole("complementary");
  await expect(sidebar.getByText(/Viewer/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Yönetici Paneli" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /lem Kay/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Arama Yönetimi" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Yetkilendirme/ })).toHaveCount(0);
  await expect(page.getByText(/• Kullanıcı/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Veri Girişi" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Son Eklediklerim" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Onay Bekleyenler" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Son Eklenenler" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Tarihi Geçecek Olanlar" })).toBeVisible();

  await searchGlobally(page, documentName);
  await expect(page.getByRole("row").filter({ hasText: documentName })).toBeVisible();
  await clearGlobalSearch(page);

  await page.getByRole("button", { name: "Son Eklenenler" }).click();
  await expect(page.getByRole("heading", { name: "Son Eklenenler" })).toBeVisible();
  await expect(page.getByText(/kayıt listeleniyor|Doküman bulunamadı/)).toBeVisible();

  await page.getByRole("button", { name: "Ana Sayfa", exact: true }).click();
  await openErasmusDocuments(page);
});

test("shows editor role label and editor sidebar menu access", async ({ page }) => {
  const documentName = `Editor Search Dokuman ${Date.now()}`;
  await createMetadataDocumentViaApi(page, documentName, { description: "Editor report search smoke" });

  await loginAs(page, editorUsername, editorPassword);

  await expect(page.getByText("Demo Editor")).toBeVisible();
  await expect(page.getByRole("button", { name: "Yönetici Paneli" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /lem Kay/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Arama Yönetimi" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Yetkilendirme/ })).toHaveCount(0);
  await expect(page.getByText(/• Düzenleyici/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Veri Girişi" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Son Eklediklerim" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Son Eklenenler" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Tarihi Geçecek Olanlar" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Onay Bekleyenler" })).toHaveCount(0);

  await page.getByRole("button", { name: "Son Eklediklerim" }).click();
  await expect(page.getByRole("heading", { name: "Son Eklediklerim" })).toBeVisible();
  await expect(page.getByText(/Dok.*man bulunamad|kay.*t listeleniyor/)).toBeVisible();

  await searchGlobally(page, documentName);
  await expect(page.getByRole("row").filter({ hasText: documentName })).toBeVisible();
});

test("opens admin dashboard stats for admins only", async ({ page }) => {
  await loginAsAdmin(page);

  await expect(page.getByRole("button", { name: "Yönetici Paneli" })).toBeVisible();
  await page.getByRole("button", { name: "Yönetici Paneli" }).click();

  const adminDashboard = page.getByRole("region", { name: "Yönetici Paneli" });
  await expect(adminDashboard.getByRole("heading", { name: "Yönetici Paneli" })).toBeVisible();
  await expect(adminDashboard.getByText("Akademik", { exact: true })).toBeVisible();
  await expect(adminDashboard.getByText(/dari/)).toBeVisible();
  await expect(adminDashboard.getByText(/Kalite/)).toBeVisible();
  await expect(adminDashboard.getByText("Sistem & Yönetim")).toBeVisible();
  await expect(adminDashboard.getByText(/Toplam kullan/)).toBeVisible();
  await expect(adminDashboard.getByText("Yönetici", { exact: true }).first()).toBeVisible();
  await expect(adminDashboard.getByText("Düzenleyici", { exact: true }).first()).toBeVisible();
  await expect(adminDashboard.getByText("Kullanıcı", { exact: true }).first()).toBeVisible();
  await expect(adminDashboard.getByRole("heading", { name: "Dosya türü istatistikleri" })).toBeVisible();
  if (await adminDashboard.getByRole("table").count()) {
    await expect(adminDashboard.getByRole("table")).toBeVisible();
  } else {
    await expect(adminDashboard.getByText(/Dosya.*verisi yok/)).toBeVisible();
  }
});

test("searches document metadata globally and opens preview", async ({ page }) => {
  const documentName = `Global Search Dokuman ${Date.now()}`;
  await createMetadataDocumentViaApi(page, documentName, {
    description: "Global metadata KRG report smoke"
  });

  await loginAsAdmin(page);

  await searchGlobally(page, documentName);
  const resultRow = page.getByRole("row").filter({ hasText: documentName });
  await expect(resultRow).toBeVisible();
  await resultRow.click();
  await expect(page.getByText("Dosya bilgileri")).toBeVisible();

  await searchGlobally(page, "REPORT");
  await expect(page.getByRole("table")).toBeVisible();

  await searchGlobally(page, "KRG");
  await expect(page.getByRole("table")).toBeVisible();

  await searchGlobally(page, `xqzv-no-match-${Date.now()}-zzzz`);
  await expect(page.getByRole("heading", { name: /Dok.*man bulunamad/ })).toBeVisible();

  await clearGlobalSearch(page);
  await expect(page.getByRole("heading", { name: /Kurumsal/ })).toBeVisible();
});

test("manages users and permissions as admin", async ({ page }) => {
  await loginAsAdmin(page);

  await expect(page.getByRole("button", { name: /Yetkilendirme/ })).toBeVisible();
  await page.getByRole("button", { name: /Yetkilendirme/ }).click();

  const panel = page.getByRole("region", { name: /Yetkilendirme/ });
  await expect(panel.getByRole("heading", { name: /Yetkilendirme/ })).toBeVisible();

  await panel.getByLabel("Arama").fill("editor");
  await expect(panel.getByRole("cell", { name: "editor", exact: true })).toBeVisible();
  await panel.getByLabel("Arama").fill("demo e");
  await expect(panel.getByRole("cell", { name: "editor", exact: true })).toBeVisible();

  let editorRow = panel.getByRole("row").filter({ hasText: "editor" });
  const initialRole = await editorRow.getByLabel("editor yetki").inputValue();

  if (initialRole !== "EDITOR") {
    page.once("dialog", (dialog) => dialog.accept());
    await editorRow.getByLabel("editor yetki").selectOption("EDITOR");
    await expect(panel.getByText("Kullanıcı yetkisi güncellendi.")).toBeVisible();
  }

  await panel.getByLabel("Rol filtresi").selectOption("EDITOR");
  await expect(panel.getByRole("cell", { name: "editor", exact: true })).toBeVisible();

  editorRow = panel.getByRole("row").filter({ hasText: "editor" });
  const originalTitle = (await editorRow.getByRole("cell").nth(1).textContent())?.trim() ?? "";
  const temporaryTitle = `E2E Editor ${Date.now()}`;

  await editorRow.getByRole("button", { name: "Güncelle" }).click();
  await panel.getByLabel(/nvan/).fill(temporaryTitle);
  await panel.getByRole("button", { name: "Değişiklikleri kaydet" }).click();
  await expect(panel.getByText("Kullanıcı bilgileri güncellendi.")).toBeVisible();
  await expect(editorRow.getByText(temporaryTitle)).toBeVisible();

  await editorRow.getByRole("button", { name: "Güncelle" }).click();
  await panel.getByLabel(/nvan/).fill(originalTitle === "-" ? "" : originalTitle);
  await panel.getByRole("button", { name: "Değişiklikleri kaydet" }).click();
  await expect(panel.getByText("Kullanıcı bilgileri güncellendi.")).toBeVisible();

  page.once("dialog", (dialog) => dialog.accept());
  await editorRow.getByLabel("editor yetki").selectOption("VIEWER");
  await expect(panel.getByText("Kullanıcı yetkisi güncellendi.")).toBeVisible();
  await panel.getByLabel("Rol filtresi").selectOption("VIEWER");
  editorRow = panel.getByRole("row").filter({ hasText: "editor" });
  await expect(editorRow.getByLabel("editor yetki")).toHaveValue("VIEWER");

  page.once("dialog", (dialog) => dialog.accept());
  await editorRow.getByLabel("editor yetki").selectOption("EDITOR");
  await expect(panel.getByText("Kullanıcı yetkisi güncellendi.")).toBeVisible();
  await panel.getByLabel("Rol filtresi").selectOption("EDITOR");
  editorRow = panel.getByRole("row").filter({ hasText: "editor" });
  await expect(editorRow.getByLabel("editor yetki")).toHaveValue("EDITOR");

  await panel.getByLabel("Arama").fill("admin");
  await panel.getByLabel("Rol filtresi").selectOption("");
  const adminRow = panel.getByRole("row").filter({ hasText: "admin" });
  await expect(adminRow.getByRole("button", { name: "Pasifleştir" })).toBeDisabled();
});

test("logs in, preserves session after refresh, navigates dashboard, and logs out", async ({ page }) => {
  const documentName = `Session Erasmus Dokuman ${Date.now()}`;
  await createMetadataDocumentViaApi(page, documentName);

  await page.goto("/");

  await page.getByLabel("Kullanıcı adı").fill(adminUsername);
  await page.getByLabel("Şifre").fill(adminPassword);
  await page.getByRole("button", { name: "Giriş yap" }).click();

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: /Kurumsal/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Sık Kullanılanlar" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Çıkış Yap" })).toBeVisible();
  await expect(page.getByText("Demo Admin")).toBeVisible();
  await expect(page.getByText(/• Yönetici/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Veri Girişi" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Son Eklediklerim" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Son Eklenenler" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Tarihi Geçecek Olanlar" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Onay Bekleyenler" })).toHaveCount(0);

  await expect
    .poll(() =>
      page.evaluate(() => ({
        hasToken: Boolean(window.localStorage.getItem("evrakdar_access_token")),
        storedUser: JSON.parse(window.localStorage.getItem("evrakdar_user") ?? "null")?.username
      }))
    )
    .toEqual({ hasToken: true, storedUser: adminUsername });

  await page.reload();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: /Kurumsal/ })).toBeVisible();

  await openErasmusDocuments(page, documentName);
  await expect(page.getByLabel("Kategori yolu")).toBeVisible();
  await expect(page.getByText(/kayıt listeleniyor/)).toBeVisible();
  await page.getByRole("cell", { name: documentName, exact: true }).click();
  await expect(page.getByText("Dosya bilgileri")).toBeVisible();
  await page.getByRole("button", { name: "Ana sayfaya dön" }).click();
  await expect(page.getByRole("heading", { name: /Kurumsal/ })).toBeVisible();
  await expect(page.getByRole("searchbox")).toHaveValue("");
  await expect(page.getByText("Dosya bilgileri")).toHaveCount(0);

  await page.getByRole("button", { name: "Çıkış Yap" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: "Sisteme giriş" })).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => Boolean(window.localStorage.getItem("evrakdar_access_token"))))
    .toBe(false);
});

test("adds a new user from the admin panel and the user can sign in", async ({ page }) => {
  const stamp = Date.now();
  const username = `e2e.user.${stamp}`;
  const password = "E2e-Password-123";

  await loginAsAdmin(page);
  await page.getByRole("button", { name: /Yetkilendirme/ }).click();

  const panel = page.getByRole("region", { name: /Yetkilendirme/ });
  await panel.getByRole("button", { name: "Yeni kullanıcı" }).click();
  await panel.getByLabel("Ad", { exact: true }).fill("E2E");
  await panel.getByLabel("Soyad").fill("Kullanıcı");
  await panel.getByLabel("E-posta").fill(`${username}@example.com`);
  await panel.getByLabel("Kullanıcı adı").fill(username);
  await panel.getByLabel("Şifre", { exact: true }).fill(password);
  await panel.getByLabel("Rol", { exact: true }).selectOption("VIEWER");
  await panel.getByRole("button", { name: "Kullanıcıyı ekle" }).click();
  await expect(panel.getByText("Yeni kullanıcı eklendi.")).toBeVisible();

  // The new user is asked to pick their own password; the warning stays until they do.
  await page.evaluate(() => window.localStorage.clear());
  await page.goto("/");
  await page.getByLabel("Kullanıcı adı").fill(username);
  await page.getByLabel("Şifre").fill(password);
  await page.getByRole("button", { name: "Giriş yap" }).click();
  const banner = page.getByRole("alert").filter({ hasText: "şifre kullanıyorsunuz" });
  await expect(banner).toBeVisible();

  await banner.getByRole("button", { name: "Şifrenizi değiştirin" }).click();
  const dialog = page.getByRole("form", { name: "Şifre değiştirme" });
  await dialog.getByLabel("Mevcut şifre").fill("yanlis-sifre-123");
  await dialog.getByLabel("Yeni şifre", { exact: true }).fill(`${password}-yeni`);
  await dialog.getByLabel("Yeni şifre (tekrar)").fill(`${password}-yeni`);
  await dialog.getByRole("button", { name: "Şifreyi kaydet" }).click();
  await expect(dialog.getByText("Mevcut şifre yanlış.")).toBeVisible();

  await dialog.getByLabel("Mevcut şifre").fill(password);
  await dialog.getByRole("button", { name: "Şifreyi kaydet" }).click();
  await expect(page.getByText("Şifreniz değiştirildi.")).toBeVisible();
  await expect(banner).toHaveCount(0);

  const oldLogin = await page.request.post(`${apiBaseUrl}/auth/login`, { data: { username, password } });
  expect(oldLogin.status()).toBe(401);
  const newLogin = await page.request.post(`${apiBaseUrl}/auth/login`, { data: { username, password: `${password}-yeni` } });
  expect(newLogin.ok()).toBe(true);

  const token = await getAdminToken(page);
  const list = await page.request.get(`${apiBaseUrl}/admin/users`, {
    headers: { Authorization: `Bearer ${token}` },
    params: { q: username }
  });
  const created = ((await list.json()) as { data: Array<{ id: string }> }).data[0];
  await page.request.delete(`${apiBaseUrl}/admin/users/${encodeURIComponent(created.id)}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
});

test("opens the document panel from a shared link", async ({ page }) => {
  const documentName = `Global Search Dokuman Paylasim ${Date.now()}`;
  await createMetadataDocumentViaApi(page, documentName, { description: "Shared link smoke" });
  const search = await page.request.get(`${apiBaseUrl}/documents`, {
    headers: await adminHeaders(page),
    params: { q: documentName }
  });
  const documentId = ((await search.json()) as { data: Array<{ id: string }> }).data[0].id;

  await loginAsAdmin(page);
  await page.goto(`/dashboard?documentId=${encodeURIComponent(documentId)}`);
  await expect(page.getByRole("heading", { name: documentName })).toBeVisible();
});

test("persists document favorites after refresh", async ({ page }) => {
  const documentName = `Favorite Erasmus Dokuman ${Date.now()}`;
  await createMetadataDocumentViaApi(page, documentName);

  await loginAsAdmin(page);
  await openErasmusDocuments(page, documentName);

  let favoriteButton = favoriteButtonFor(page, documentName);
  await expect(favoriteButton).toBeVisible();

  if ((await favoriteButton.getAttribute("aria-label")) === "Favoriden çıkar") {
    await favoriteButton.click();
    await expect(favoriteButton).toBeEnabled();
    await expect(favoriteButton).toHaveAttribute("aria-label", "Favoriye ekle");

    await page.reload();
    await openErasmusDocuments(page, documentName);
    favoriteButton = favoriteButtonFor(page, documentName);
    await expect(favoriteButton).toHaveAttribute("aria-label", "Favoriye ekle");
  }

  await favoriteButton.click();
  await expect(favoriteButton).toBeEnabled();
    await expect(favoriteButton).toHaveAttribute("aria-label", "Favoriden çıkar");

  await page.reload();
  await openErasmusDocuments(page, documentName);
  favoriteButton = favoriteButtonFor(page, documentName);
  await expect(favoriteButton).toHaveAttribute("aria-label", "Favoriden çıkar");

  await favoriteButton.click();
  await expect(favoriteButton).toBeEnabled();
  await expect(favoriteButton).toHaveAttribute("aria-label", "Favoriye ekle");

  await page.reload();
  await openErasmusDocuments(page, documentName);
  favoriteButton = favoriteButtonFor(page, documentName);
  await expect(favoriteButton).toHaveAttribute("aria-label", "Favoriye ekle");
});

test("opens sidebar document list modes and returns to dashboard navigation", async ({ page }) => {
  await loginAsAdmin(page);

  await page.getByRole("button", { name: "Son Eklenenler" }).click();
  await expect(page.getByRole("heading", { name: "Son Eklenenler" })).toBeVisible();
  await expect(page.getByText(/kayıt listeleniyor|Doküman bulunamadı/)).toBeVisible();

  await page.getByRole("button", { name: "Tarihi Geçecek Olanlar" }).click();
  await expect(page.getByRole("heading", { name: "Tarihi Geçecek Olanlar" })).toBeVisible();
  await expect(page.getByText(/kayıt listeleniyor|Doküman bulunamadı/)).toBeVisible();

  await page.getByRole("button", { name: "Ana Sayfa", exact: true }).click();
  await openErasmusDocuments(page);
});

test("navigates folders like a file explorer and preserves location after search", async ({ page }) => {
  const suffix = Date.now();
  const categoryDocumentName = `Category Explorer Dokuman ${suffix}`;
  const folderDocumentName = `Folder Explorer Dokuman ${suffix}`;
  const token = await getAdminToken(page);
  const rootFolder = (await getRootFolders(page))[0];
  const childFolder = await createFolderViaApi(page, token, `Explorer Child ${suffix}`, rootFolder.id);
  await createMetadataDocumentInFolderViaApi(page, token, categoryDocumentName, rootFolder.id);
  await createMetadataDocumentInFolderViaApi(page, token, folderDocumentName, childFolder.id);

  await loginAsAdmin(page);

  await openDashboardCategory(page, rootFolder.name);

  const categoryTable = page.getByRole("table");
  await expect(categoryTable.getByRole("cell", { name: childFolder.name, exact: true })).toBeVisible();
  await expect(categoryTable.getByRole("cell", { name: categoryDocumentName, exact: true })).toBeVisible();
  const firstRows = await categoryTable.getByRole("row").evaluateAll((rows) =>
    rows.slice(1, 4).map((row) => row.textContent ?? "")
  );
  expect(firstRows.every((text) => text.includes("Klas"))).toBe(true);
  await expect(page.getByText("Dosya bilgileri")).toHaveCount(0);

  await categoryTable.getByRole("cell", { name: childFolder.name, exact: true }).click();
  await expect(page.getByLabel("Kategori yolu")).toContainText("Ana dizin");
  await expect(page.getByLabel("Kategori yolu")).toContainText(rootFolder.name);
  await expect(page.getByLabel("Kategori yolu")).toContainText(childFolder.name);
  await expect(page.getByText("Dosya bilgileri")).toHaveCount(0);
  await expect(page.getByRole("cell", { name: folderDocumentName, exact: true })).toBeVisible();

  await page.getByRole("cell", { name: folderDocumentName, exact: true }).click();
  await expect(page.getByText("Dosya bilgileri")).toBeVisible();

  await page.getByLabel("Kategori yolu").getByRole("button", { name: rootFolder.name }).click();
  await expect(page.getByText("Dosya bilgileri")).toHaveCount(0);
  await expect(page.getByRole("cell", { name: childFolder.name, exact: true })).toBeVisible();

  await searchGlobally(page, folderDocumentName);
  await expect(page.getByRole("row").filter({ hasText: folderDocumentName })).toBeVisible();
  await clearGlobalSearch(page);
  await expect(page.getByLabel("Kategori yolu")).toContainText(rootFolder.name);
  await expect(page.getByRole("cell", { name: childFolder.name, exact: true })).toBeVisible();

  await page.getByLabel("Kategori yolu").getByRole("button", { name: "Ana dizin" }).click();
  await expect(page.getByRole("heading", { name: /Kurumsal/ })).toBeVisible();
});

test("allows viewers to use folder explorer navigation as read-only", async ({ page }) => {
  const token = await getAdminToken(page);
  const rootFolder = (await getRootFolders(page))[0];
  const childFolder = await createFolderViaApi(page, token, `Viewer Child ${Date.now()}`, rootFolder.id);
  await loginAs(page, viewerUsername, viewerPassword);

  await openDashboardCategory(page, rootFolder.name);
  await page.getByRole("cell", { name: childFolder.name, exact: true }).click();
  await expect(page.getByLabel("Kategori yolu")).toContainText(childFolder.name);
  await expect(page.getByRole("table").or(page.getByText(/Bu (klas|kategori)/))).toBeVisible();
  await expect(page.getByRole("button", { name: "Veri Girişi" })).toHaveCount(0);
  await expect(page.locator("summary[aria-label*='Sat']")).toHaveCount(0);
});

test("opens independent file explorer and manages items", async ({ page }) => {
  const suffix = Date.now();
  const documentName = `Explorer Doc ${suffix}`;
  const renamedDocumentName = `Explorer Doc Renamed ${suffix}`;
  const folderName = `Explorer Empty ${suffix}`;
  const renamedFolderName = `Explorer Empty Renamed ${suffix}`;
  const token = await getAdminToken(page);
  const rootFolder = (await getRootFolders(page))[0];
  const sourceFolder = await createFolderViaApi(page, token, `Explorer Source ${suffix}`, rootFolder.id);
  const targetFolder = await createFolderViaApi(page, token, `Explorer Target ${suffix}`, rootFolder.id);

  await createMetadataDocumentInFolderViaApi(page, token, documentName, sourceFolder.id);
  await createFolderViaApi(page, token, folderName, sourceFolder.id);

  await loginAsAdmin(page);
  await expect(page.getByRole("button", { name: /Dosya ve Klasörler/ })).toBeVisible();
  await page.getByRole("button", { name: /Dosya ve Klasörler/ }).click();

  const explorer = page.getByRole("region", { name: "Dosya ve Klasörler" });
  await expect(explorer.getByRole("heading", { name: "Dosya ve Klasörler" })).toBeVisible();
  await expect(explorer.getByLabel("Explorer yolu").getByRole("button", { name: "Ana dizin" })).toBeVisible();
  await expect(explorer.getByRole("row").filter({ hasText: rootFolder.name })).toBeVisible();

  await openExplorerFolder(page, rootFolder.name);
  await openExplorerFolder(page, sourceFolder.name);
  await expect(explorer.getByRole("cell", { name: documentName, exact: true })).toBeVisible();
  await expect(explorer.getByRole("cell", { name: folderName, exact: true })).toBeVisible();

  await explorer.getByRole("row").filter({ hasText: folderName }).click();
  await expect(page.getByText("Dosya bilgileri")).toHaveCount(0);
  await explorer.getByRole("row").filter({ hasText: documentName }).click();
  await expect(page.getByRole("heading", { name: "Dosya bilgileri" })).toBeVisible();

  await openExplorerActions(page, folderName);
  await page.locator("details[open]").getByRole("button", { name: "Yeniden Adlandır" }).click();
  await page.getByRole("dialog").locator("input").fill(renamedFolderName);
  await page.getByRole("button", { name: "Kaydet" }).click();
  await expect(explorer.getByText("Klasör adı güncellendi.")).toBeVisible();
  await expect(explorer.getByRole("cell", { name: renamedFolderName, exact: true })).toBeVisible();

  await openExplorerActions(page, renamedFolderName);
  await page.locator("details[open]").getByRole("button", { name: "Sil" }).click();
  await page.getByRole("button", { name: "Onayla" }).click();
  await expect(explorer.getByText("Boş klasör silindi.")).toBeVisible();
  await expect(explorer.getByRole("cell", { name: renamedFolderName, exact: true })).toHaveCount(0);

  await openExplorerActions(page, documentName);
  await page.locator("details[open]").getByRole("button", { name: "Yeniden Adlandır" }).click();
  await page.getByRole("dialog").locator("input").fill(renamedDocumentName);
  await page.getByRole("button", { name: "Kaydet" }).click();
  await expect(explorer.getByText("Doküman adı güncellendi.")).toBeVisible();
  await expect(explorer.getByRole("cell", { name: renamedDocumentName, exact: true })).toBeVisible();

  await openExplorerActions(page, renamedDocumentName);
  await page.locator("details[open]").getByRole("button", { name: "Kes" }).click();
  await explorer.getByLabel("Explorer yolu").getByRole("button", { name: rootFolder.name }).click();
  await openExplorerFolder(page, new RegExp(targetFolder!.name));
  await explorer.getByRole("button", { name: "Yapıştır" }).click();
  await expect(explorer.getByText("Öğe taşındı.")).toBeVisible();
  await expect(explorer.getByRole("cell", { name: renamedDocumentName, exact: true })).toBeVisible();

  await openExplorerActions(page, renamedDocumentName);
  await page.locator("details[open]").getByRole("button", { name: "Kopyala" }).click();
  await explorer.getByRole("button", { name: "Yapıştır" }).click();
  await expect(explorer.getByText("Öğe kopyalandı.")).toBeVisible();
  await expect(explorer.getByRole("cell", { name: `${renamedDocumentName} - Kopya`, exact: true })).toBeVisible();
  await trackDocumentByName(page, `${renamedDocumentName} - Kopya`);
});

test("manages documents and empty folders from row actions", async ({ page }) => {
  const suffix = Date.now();
  const documentName = `Manage Doc ${suffix}`;
  const renamedDocumentName = `Managed Doc Renamed ${suffix}`;
  const childFolderName = `Manage Child ${suffix}`;
  const renamedFolderName = `Manage Child Renamed ${suffix}`;
  const token = await getAdminToken(page);
  const rootFolder = (await getRootFolders(page))[0];
  const sourceFolder = await createFolderViaApi(page, token, `Manage Source ${suffix}`, rootFolder.id);
  const targetFolder = await createFolderViaApi(page, token, `Manage Target ${suffix}`, rootFolder.id);
  await createMetadataDocumentInFolderViaApi(page, token, documentName, sourceFolder.id);

  await loginAsAdmin(page);
  await openDashboardCategory(page, rootFolder.name);
  await page.getByRole("cell", { name: sourceFolder.name, exact: true }).click();
  await expect(page.getByRole("cell", { name: documentName, exact: true })).toBeVisible();

  await openRowActions(page, documentName);
  await page.getByRole("button", { name: /Yeniden/ }).click();
  await page.getByRole("dialog").locator("input").fill(renamedDocumentName);
  await page.getByRole("button", { name: "Kaydet" }).click();
  await expect(page.getByRole("dialog").getByText(/g.*ncellendi/)).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Kapat", exact: true }).click();
  await expect(page.getByRole("cell", { name: renamedDocumentName, exact: true })).toBeVisible();

  await openRowActions(page, renamedDocumentName);
  await page.locator("details[open]").getByRole("button", { name: /Ta/ }).click();
  await page.getByLabel(/Hedef klas/).selectOption(targetFolder.id);
  await page.getByRole("button", { name: "Kaydet" }).click();
  await expect(page.getByRole("dialog").getByText(/hedef klas/)).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Kapat", exact: true }).click();
  await expect(page.getByRole("cell", { name: renamedDocumentName, exact: true })).toHaveCount(0);

  await page.getByLabel("Kategori yolu").getByRole("button", { name: rootFolder.name }).click();
  await page.getByRole("cell", { name: targetFolder.name, exact: true }).click();
  await expect(page.getByRole("cell", { name: renamedDocumentName, exact: true })).toBeVisible();

  await openRowActions(page, renamedDocumentName);
  await page.getByRole("button", { name: "Sil" }).click();
  await page.getByRole("button", { name: "Onayla" }).click();
  await expect(page.getByRole("dialog").getByText(/kald/)).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Kapat", exact: true }).click();
  await expect(page.getByRole("cell", { name: renamedDocumentName, exact: true })).toHaveCount(0);

  await page.getByLabel("Kategori yolu").getByRole("button", { name: rootFolder.name }).click();
  await openRowActions(page, sourceFolder.name);
  await page.getByRole("button", { name: /Yeni Alt/ }).click();
  await page.getByRole("dialog").locator("input").fill(childFolderName);
  await page.getByRole("button", { name: "Kaydet" }).click();
  await expect(page.getByRole("dialog").getByText(/Alt klas/)).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Kapat", exact: true }).click();
  await trackFolderByName(page, childFolderName);

  await page.getByRole("cell", { name: sourceFolder.name, exact: true }).click();
  await expect(page.getByRole("cell", { name: childFolderName, exact: true })).toBeVisible();
  await openRowActions(page, childFolderName);
  await page.getByRole("button", { name: /Yeniden/ }).click();
  await page.getByRole("dialog").locator("input").fill(renamedFolderName);
  await page.getByRole("button", { name: "Kaydet" }).click();
  await expect(page.getByRole("dialog").getByText(/g.*ncellendi/)).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Kapat", exact: true }).click();
  await expect(page.getByRole("cell", { name: renamedFolderName, exact: true })).toBeVisible();

  await openRowActions(page, renamedFolderName);
  await page.locator("details[open]").getByRole("button", { name: /Ta/ }).click();
  await page.getByLabel(/Hedef klas/).selectOption(targetFolder.id);
  await page.getByRole("button", { name: "Kaydet" }).click();
  await expect(page.getByRole("dialog").getByText(/hedef konuma/)).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Kapat", exact: true }).click();
  await expect(page.getByRole("cell", { name: renamedFolderName, exact: true })).toHaveCount(0);

  await page.getByLabel("Kategori yolu").getByRole("button", { name: rootFolder.name }).click();
  await page.getByRole("cell", { name: targetFolder.name, exact: true }).click();
  await expect(page.getByRole("cell", { name: renamedFolderName, exact: true })).toBeVisible();
  await openRowActions(page, renamedFolderName);
  await page.getByRole("button", { name: "Sil" }).click();
  await page.getByRole("button", { name: "Onayla" }).click();
  await expect(page.getByRole("dialog").getByText(/silindi/)).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Kapat", exact: true }).click();
  await expect(page.getByRole("cell", { name: renamedFolderName, exact: true })).toHaveCount(0);

});

test("creates a metadata-only document entry and shows it in recent documents", async ({ page }) => {
  const targetFolder = (await getRootFolders(page))[0];
  await loginAsAdmin(page);

  const documentName = `E2E Metadata Dokümanı ${Date.now()}`;

  await page.getByRole("button", { name: "Veri Girişi" }).click();
  await expect(page.getByRole("heading", { name: "Veri Girişi" })).toBeVisible();

  await expect(page.getByLabel("Klasör seçimi")).toBeEnabled();
  await expect(page.getByLabel("Sorumlu birim")).toBeEnabled();

  await page.getByRole("radio", { name: /Kağıt belge/ }).check();
  await expect(page.getByRole("radio", { name: /Kağıt belge/ })).toBeChecked();
  await page.locator("form").getByRole("button", { name: targetFolder.name, exact: true }).click();
  await expect(page.getByLabel("Klasör seçimi")).not.toHaveValue("");

  await page.getByLabel("Doküman adı").fill(documentName);
  await page.getByLabel("Doküman türü").selectOption("REPORT");
  await expect(page.getByLabel("Boyut byte")).toHaveCount(0);
  await page.getByLabel("Geçerlilik tarihi").fill("2026-12-31");
  await page.getByLabel("Açıklama").fill("Playwright metadata-only smoke kaydı.");
  await page.getByRole("button", { name: "Kağıt belgeyi kaydet" }).click();

  await expect(page.getByText(/Doküman kaydı oluşturuldu/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Son Eklenenler" })).toBeVisible();
  await expect(page.getByRole("cell", { name: documentName, exact: true })).toBeVisible();
  await trackDocumentByName(page, documentName);
});

test("uploads a document file as editor and shows it in recent documents", async ({ page }) => {
  const uploadFolder = (await getRootFolders(page))[0];
  await loginAs(page, editorUsername, editorPassword);

  const documentName = `E2E Upload Dokümanı ${Date.now()}`;

  await page.getByRole("button", { name: "Veri Girişi" }).click();
  await expect(page.getByRole("heading", { name: "Veri Girişi" })).toBeVisible();
  await expect(page.getByRole("radio", { name: /Dosya ile doküman yükle/ })).toBeChecked();
  await expect(page.getByLabel("Klasör seçimi")).toBeEnabled();
  await expect(page.getByLabel("Sorumlu birim")).toBeEnabled();
  await page.locator("form").getByRole("button", { name: uploadFolder.name, exact: true }).click();
  await expect(page.getByLabel("Klasör seçimi")).not.toHaveValue("");

  await page.getByLabel("Dosya seçimi").setInputFiles({
    name: "e2e-upload-smoke.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4\n% Evrakdar Playwright upload smoke\n")
  });
  await expect(page.getByText(/Seçilen dosya: e2e-upload-smoke\.pdf/)).toBeVisible();

  await page.getByLabel("Doküman adı").fill(documentName);
  await page.getByLabel("Doküman türü").selectOption("REPORT");
  await page.getByLabel("Geçerlilik tarihi").fill("2026-12-31");
  await page.getByLabel("Açıklama").fill("Playwright dosya upload smoke kaydı.");
  await page.getByRole("button", { name: "Dosya ile doküman yükle" }).click();

  await expect(page.getByRole("heading", { name: "Son Eklenenler" })).toBeVisible();
  await expect(page.getByText(/Doküman kaydı oluşturuldu/)).toBeVisible();
  await expect(page.getByRole("cell", { name: documentName, exact: true })).toBeVisible();
  await trackDocumentByName(page, documentName);

  await page.getByRole("button", { name: "Son Eklediklerim" }).click();
  await expect(page.getByRole("heading", { name: "Son Eklediklerim" })).toBeVisible();
  await expect(page.getByRole("cell", { name: documentName, exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("heading", { name: /Kurumsal/ })).toBeVisible();
  await openErasmusDocuments(page, documentName);
  await expect(page.getByRole("cell", { name: documentName, exact: true })).toBeVisible();

  await page.getByRole("cell", { name: documentName, exact: true }).click();
  await expect(page.getByRole("heading", { name: "Dosya bilgileri" })).toBeVisible();
  const previewPanel = page.locator("aside").filter({ hasText: "Dosya bilgileri" });
  await expect(previewPanel.getByRole("button", { name: "İndir" })).toBeEnabled();
  await expect(page.getByRole("heading", { name: "Versiyonlar" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Onaya Gönder" })).toHaveCount(0);
});

test("toggles dark and light mode preference", async ({ page }) => {
  await loginAsAdmin(page);

  const darkModeButton = page.getByRole("button", { name: "Koyu temayı aç" });
  await darkModeButton.click();

  await expect
    .poll(() =>
      page.evaluate(() => ({
        storedTheme: window.localStorage.getItem("evrakdar_theme"),
        isDark: document.documentElement.classList.contains("dark")
      }))
    )
    .toEqual({ storedTheme: "dark", isDark: true });

  await page.reload();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.classList.contains("dark")))
    .toBe(true);

  await page.getByRole("button", { name: "Açık temayı aç" }).click();
  await expect
    .poll(() =>
      page.evaluate(() => ({
        storedTheme: window.localStorage.getItem("evrakdar_theme"),
        isDark: document.documentElement.classList.contains("dark")
      }))
    )
    .toEqual({ storedTheme: "light", isDark: false });
});

test("clears invalid tokens and returns to login", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => {
    window.localStorage.setItem("evrakdar_access_token", "invalid-token");
    window.localStorage.setItem(
      "evrakdar_user",
      JSON.stringify({
        id: "invalid",
        username: "admin",
        firstName: "Demo",
        lastName: "Admin",
        email: "admin@example.com",
        roles: ["ADMIN"]
      })
    );
  });

  await page.goto("/dashboard");

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: "Sisteme giriş" })).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => Boolean(window.localStorage.getItem("evrakdar_access_token"))))
    .toBe(false);
});

async function loginAsAdmin(page: Page) {
  await loginAs(page, adminUsername, adminPassword);
}

async function loginAs(page: Page, username: string, password: string) {
  await page.goto("/");

  await page.getByLabel("Kullanıcı adı").fill(username);
  await page.getByLabel("Şifre").fill(password);
  await page.getByRole("button", { name: "Giriş yap" }).click();

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: /Kurumsal/ })).toBeVisible();
}

async function createMetadataDocumentViaApi(
  page: Page,
  name: string,
  options: {
    description?: string;
    folderNameIncludes?: string[];
  } = {}
) {
  const token = await getAdminToken(page);
  const folder = options.folderNameIncludes
    ? await findFolder(page, options.folderNameIncludes)
    : (await getRootFolders(page))[0];
  const department = await getDepartment(page, "KRG");

  const response = await page.request.post(`${apiBaseUrl}/documents`, {
    headers: {
      Authorization: `Bearer ${token}`
    },
    data: {
      name,
      folderId: folder.id,
      documentType: "REPORT",
      sizeLabel: "1 MB",
      sizeBytes: 1048576,
      responsibleDepartmentId: department.id,
      validUntil: "2027-12-31",
      description: options.description ?? "Playwright smoke metadata kaydı."
    }
  });

  expect(response.ok()).toBe(true);
  const payload = (await response.json()) as { data?: { id?: string } };
  fixtureCleanup.trackDocument(payload.data?.id);

  return name;
}

async function createMetadataDocumentInFolderViaApi(
  page: Page,
  token: string,
  name: string,
  folderId: string
) {
  const department = await getDepartment(page, "KRG");

  const response = await page.request.post(`${apiBaseUrl}/documents`, {
    headers: {
      Authorization: `Bearer ${token}`
    },
    data: {
      name,
      folderId,
      documentType: "REPORT",
      sizeLabel: "1 MB",
      sizeBytes: 1048576,
      responsibleDepartmentId: department.id,
      validUntil: "2027-12-31",
      description: "Playwright file explorer smoke kaydı."
    }
  });

  expect(response.ok()).toBe(true);
  const payload = (await response.json()) as { data?: { id?: string } };
  fixtureCleanup.trackDocument(payload.data?.id);

  return name;
}

async function createFolderViaApi(page: Page, token: string, name: string, parentId: string) {
  const response = await page.request.post(`${apiBaseUrl}/folders`, {
    headers: {
      Authorization: `Bearer ${token}`
    },
    data: {
      name,
      parentId
    }
  });

  expect(response.ok()).toBe(true);

  const payload = (await response.json()) as { data?: FolderTestDto };
  expect(payload.data?.id).toBeTruthy();
  fixtureCleanup.trackFolder(payload.data?.id);

  return payload.data!;
}

async function trackDocumentByName(page: Page, name: string) {
  const response = await page.request.get(`${apiBaseUrl}/documents`, {
    headers: await adminHeaders(page),
    params: {
      q: name,
      limit: "100"
    }
  });
  expect(response.ok()).toBe(true);

  const payload = (await response.json()) as { data?: Array<{ id: string; name: string }> };
  const document = payload.data?.find((item) => item.name === name);
  expect(document?.id).toBeTruthy();
  fixtureCleanup.trackDocument(document?.id);
}

async function trackFolderByName(page: Page, name: string) {
  const roots = await getRootFolders(page);
  const folder = await findDescendantFolder(page, roots, name);
  expect(folder?.id).toBeTruthy();
  fixtureCleanup.trackFolder(folder?.id);
}

let cachedAdminToken: string | null = null;

// Every API read now requires a login, so test helpers call the API as the demo admin.
async function adminHeaders(page: Page) {
  cachedAdminToken ??= await getAdminToken(page);

  return { Authorization: `Bearer ${cachedAdminToken}` };
}

async function getAdminToken(page: Page) {
  const response = await page.request.post(`${apiBaseUrl}/auth/login`, {
    data: {
      username: adminUsername,
      password: adminPassword
    }
  });

  expect(response.ok()).toBe(true);

  const payload = (await response.json()) as { data?: { accessToken?: string } };
  const token = payload.data?.accessToken;
  expect(token).toBeTruthy();

  return token!;
}

async function getDepartment(page: Page, code: string) {
  const response = await page.request.get(`${apiBaseUrl}/departments`, { headers: await adminHeaders(page) });
  expect(response.ok()).toBe(true);

  const payload = (await response.json()) as { data?: Array<{ id: string; code: string; name: string }> };
  const department = payload.data?.find((item) => item.code === code) ?? payload.data?.[0];
  expect(department).toBeTruthy();

  return department!;
}

async function findFolder(page: Page, nameIncludes: string[]) {
  const roots = await getRootFolders(page);
  let candidates = roots;
  let selected: FolderTestDto | null = null;

  for (const fragment of nameIncludes) {
    const next = await findDescendantFolder(page, candidates, fragment);

    if (!next) {
      const parent = selected ?? roots[0];
      selected = await createFolderViaApi(page, await getAdminToken(page), getFixtureFolderName(fragment), parent.id);
      candidates = await getChildFolders(page, selected.id);
      continue;
    }

    selected = next;
    candidates = await getChildFolders(page, selected.id);
  }

  return selected ?? roots[0];
}

async function findDescendantFolder(page: Page, startFolders: FolderTestDto[], nameIncludes: string) {
  const queue = [...startFolders];
  const normalizedNeedle = normalizeForSearch(nameIncludes);

  while (queue.length > 0) {
    const folder = queue.shift()!;

    if (normalizeForSearch(folder.name).includes(normalizedNeedle)) {
      return folder;
    }

    queue.push(...(await getChildFolders(page, folder.id)));
  }

  return null;
}

async function getRootFolders(page: Page) {
  const response = await page.request.get(`${apiBaseUrl}/folders/root`, { headers: await adminHeaders(page) });
  expect(response.ok()).toBe(true);

  const payload = (await response.json()) as { data?: FolderTestDto[] };
  expect(payload.data?.length ?? 0).toBeGreaterThan(0);

  return payload.data!;
}

async function getChildFolders(page: Page, folderId: string) {
  const response = await page.request.get(`${apiBaseUrl}/folders/${encodeURIComponent(folderId)}/children`, { headers: await adminHeaders(page) });
  expect(response.ok()).toBe(true);

  const payload = (await response.json()) as { data?: { folders?: FolderTestDto[] } };

  return payload.data?.folders ?? [];
}

type FolderTestDto = {
  id: string;
  name: string;
};

function normalizeForSearch(value: string) {
  return value.toLocaleLowerCase("tr-TR");
}

async function openErasmusDocuments(page: Page, expectedDocumentName?: string) {
  const folder = (await getRootFolders(page))[0];
  await openDashboardCategory(page, folder.name);
  if (expectedDocumentName) {
    await expect(page.getByRole("cell", { name: expectedDocumentName, exact: true })).toBeVisible();
  } else {
    await expect(page.getByRole("table").or(page.getByText(/Bu klas/))).toBeVisible();
  }
}

async function openDashboardCategory(page: Page, folderName: string) {
  const categoryButton = page
    .locator("main")
    .getByRole("button", { name: new RegExp(`^${escapeRegExp(folderName)} \\d`) });

  if ((await categoryButton.count()) === 0) {
    await page.getByRole("button", { name: "Ana sayfaya dön" }).click();
  }

  await expect(page.getByRole("heading", { name: /Kurumsal/ })).toBeVisible();
  await expect(categoryButton).toBeVisible();
  await categoryButton.click();
}

function getFixtureFolderName(fragment: string) {
  const normalized = normalizeForSearch(fragment);

  if (normalized.includes("erasmus")) {
    return "Erasmus+ Bilgi Paketleri";
  }

  if (normalized.includes("anket")) {
    return "Anket Raporları";
  }

  if (normalized.includes("tan")) {
    return "Tanıtım Sunumları";
  }

  return fragment;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function favoriteButtonFor(page: Page, documentName: string) {
  return page.getByRole("row").filter({ hasText: documentName }).getByRole("button", { name: /Favori/ });
}

async function openRowActions(page: Page, rowText: string | RegExp) {
  const row = page.getByRole("row").filter({ hasText: rowText });
  await expect(row).toBeVisible();
  await row.locator("summary").click();
}

async function openExplorerFolder(page: Page, folderName: string | RegExp) {
  const explorer = page.getByRole("region", { name: "Dosya ve Klasörler" });
  const row = explorer.getByRole("row").filter({ hasText: folderName });
  await expect(row).toBeVisible();
  await row.dblclick();
}

async function openExplorerActions(page: Page, rowText: string | RegExp) {
  const explorer = page.getByRole("region", { name: "Dosya ve Klasörler" });
  const row = explorer.getByRole("row").filter({ hasText: rowText });
  await expect(row).toBeVisible();
  await row.locator("summary").click();
}

async function searchGlobally(page: Page, query: string) {
  await page.getByRole("searchbox").fill(query);
  await expect(page.getByRole("heading", { name: /arama sonuçları|süzülen belgeler/i })).toBeVisible();
}

async function clearGlobalSearch(page: Page) {
  await page.getByRole("searchbox").fill("");
  await expect(page.getByRole("heading", { name: /Kurumsal/ })).toBeVisible();
}


