import { expect, test, type Page } from "@playwright/test";
import { TestFixtureCleanup } from "./helpers/fixture-cleanup";

const adminUsername = "admin";
const adminPassword = "admin123";
const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:3001";
const fixtureCleanup = new TestFixtureCleanup(apiBaseUrl);

test.beforeEach(async ({ page }) => {
  fixtureCleanup.reset();
  await fixtureCleanup.cleanupKnownFixtures(page);
});

test.afterEach(async ({ page }) => {
  await fixtureCleanup.cleanup(page);
});

test("supports explorer toolbar, fixed menus, and keyboard selection", async ({ page }) => {
  const suffix = Date.now();
  const toolbarFolderName = `UX Toolbar ${suffix}`;
  const toolbarFolderRenamed = `UX Toolbar Renamed ${suffix}`;
  const documentName = `UX Menu Doc ${suffix}`;

  const token = await getAdminToken(page);
  const targetFolder = (await getRootFolders(page))[0];
  await createMetadataDocumentInFolderViaApi(page, token, documentName, targetFolder.id);

  await loginAsAdmin(page);
  await page.getByRole("button", { name: /Dosya ve Klas/ }).click();

  const explorer = page.getByRole("region", { name: /Dosya ve Klas/ });
  await openExplorerFolder(page, targetFolder.name);

  await openExplorerActions(page, documentName);
  await assertMenuInsideViewport(page.locator("details[open]").getByRole("menu"), page);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu")).toHaveCount(0);

  await explorer.getByLabel("Tümünü seç").check();
  await expect(explorer.getByText(/öğe seçildi/i)).toBeVisible();
  await explorer.getByLabel("Tümünü seç").uncheck();
  await expect(explorer.getByText(/öğe seçildi/i)).toHaveCount(0);

  await explorer.getByRole("button", { name: "Yeni Klasör" }).click();
  await page.getByRole("dialog").locator("input").fill(toolbarFolderName);
  await page.getByRole("button", { name: "Kaydet" }).click();
  await expect(explorer.getByText(/Alt klas/)).toBeVisible();
  await expect(explorer.getByRole("cell", { name: toolbarFolderName, exact: true })).toBeVisible();
  await trackFolderByName(page, toolbarFolderName);

  await openExplorerFolder(page, toolbarFolderName);
  await explorer.getByRole("button", { name: /Yeniden/ }).click();
  await page.getByRole("dialog").locator("input").fill(toolbarFolderRenamed);
  await page.getByRole("button", { name: "Kaydet" }).click();
  await expect(explorer.getByText(/Klas.*g.*ncellendi/)).toBeVisible();
  await expect(explorer.getByLabel("Explorer yolu")).toContainText(toolbarFolderRenamed);

  await explorer.getByRole("button", { name: "Sil" }).click();
  await page.getByRole("button", { name: "Onayla" }).click();
  await expect(explorer.getByText(/Bo.*klas.*silindi/)).toBeVisible();
  await expect(explorer.getByRole("cell", { name: toolbarFolderRenamed, exact: true })).toHaveCount(0);

  await page.getByRole("button", { name: "Geri Dönüşüm Kutusu" }).click();
  const trash = page.getByRole("region", { name: "Geri Dönüşüm Kutusu" });
  const trashRow = trash.getByRole("row").filter({ hasText: toolbarFolderRenamed });
  await expect(trashRow).toBeVisible();
  await trashRow.getByRole("button", { name: "Geri Yükle" }).click();
  await expect(trash.getByText(/geri yüklendi/i)).toBeVisible();

  await page.getByRole("button", { name: /Dosya ve Klas/ }).click();
  await openExplorerFolder(page, targetFolder.name);
  await expect(explorer.getByRole("cell", { name: toolbarFolderRenamed, exact: true })).toBeVisible();

  await openExplorerActions(page, toolbarFolderRenamed);
  await page.getByRole("menu").getByRole("button", { name: "Sil" }).click();
  await page.getByRole("button", { name: "Onayla" }).click();

  await page.getByRole("button", { name: "Geri Dönüşüm Kutusu" }).click();
  const cleanupRow = trash.getByRole("row").filter({ hasText: toolbarFolderRenamed });
  await expect(cleanupRow).toBeVisible();
  page.once("dialog", (dialog) => void dialog.accept());
  await cleanupRow.getByRole("button", { name: "Kalıcı Sil" }).click();
  await expect(cleanupRow).toHaveCount(0);

  await page.getByRole("button", { name: /Dosya ve Klas/ }).click();
  await openExplorerFolder(page, targetFolder.name);

  // The folder's list arrives a moment after it opens; selecting too early selects nothing.
  await expect(async () => {
    await explorer.press("Control+A");
    await expect(explorer.getByText(/öğe seçildi/i)).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: 10_000 });
  await explorer.press("Escape");
  await expect(explorer.getByText(/öğe seçildi/i)).toHaveCount(0);
  await explorer.press("Backspace");
  await expect(explorer.getByLabel("Explorer yolu")).toContainText("Ana dizin");
});

async function loginAsAdmin(page: Page) {
  await page.goto("/");
  await page.getByLabel("Kullanıcı adı").fill(adminUsername);
  await page.getByLabel("Şifre").fill(adminPassword);
  await page.getByRole("button", { name: "Giriş yap" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

async function openExplorerFolder(page: Page, folderName: string | RegExp) {
  const explorer = page.getByRole("region", { name: /Dosya ve Klas/ });
  const row = explorer.getByRole("row").filter({ hasText: folderName });
  await expect(row).toBeVisible();
  await row.dblclick();
}

async function openExplorerActions(page: Page, rowText: string | RegExp) {
  const explorer = page.getByRole("region", { name: /Dosya ve Klas/ });
  const row = explorer.getByRole("row").filter({ hasText: rowText });
  await expect(row).toBeVisible();
  await row.locator("summary").click();
}

async function assertMenuInsideViewport(menu: ReturnType<Page["locator"]>, page: Page) {
  await expect(menu).toBeVisible();
  await expect
    .poll(async () => {
      const viewport = page.viewportSize();
      const box = await menu.evaluate((element) => {
        const rect = element.getBoundingClientRect();

        return {
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height
        };
      });

      if (!viewport) {
        return false;
      }

      return (
        box.x >= 0 &&
        box.y >= 0 &&
        box.x + box.width <= viewport.width &&
        box.y + box.height <= viewport.height
      );
    })
    .toBe(true);
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
  expect(payload.data?.accessToken).toBeTruthy();

  return payload.data!.accessToken!;
}

async function createMetadataDocumentInFolderViaApi(page: Page, token: string, name: string, folderId: string) {
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
      description: "Playwright explorer UX smoke kaydı."
    }
  });

  expect(response.ok()).toBe(true);
  const payload = (await response.json()) as { data?: { id?: string } };
  fixtureCleanup.trackDocument(payload.data?.id);
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
  const payload = (await response.json()) as { data?: { id?: string } };
  fixtureCleanup.trackFolder(payload.data?.id);
}

async function trackFolderByName(page: Page, name: string) {
  const roots = await getRootFolders(page);
  const folder = await findDescendantFolder(page, roots, name);
  expect(folder?.id).toBeTruthy();
  fixtureCleanup.trackFolder(folder?.id);
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
    selected = await findDescendantFolder(page, candidates, fragment);
    expect(selected).toBeTruthy();
    candidates = await getChildFolders(page, selected!.id);
  }

  return selected ?? roots[0];
}

async function findDescendantFolder(page: Page, startFolders: FolderTestDto[], nameIncludes: string) {
  const queue = [...startFolders];
  const normalizedNeedle = nameIncludes.toLocaleLowerCase("tr-TR");

  while (queue.length > 0) {
    const folder = queue.shift()!;

    if (folder.name.toLocaleLowerCase("tr-TR").includes(normalizedNeedle)) {
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
