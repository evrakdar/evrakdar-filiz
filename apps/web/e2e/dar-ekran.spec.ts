import { expect, test, type Page } from "@playwright/test";

async function signIn(page: Page) {
  await page.goto("/");
  await page.getByLabel(/Kullanıcı/).fill("admin");
  await page.getByLabel("Şifre").fill("admin123");
  await page.getByRole("button", { name: /Giriş/ }).first().click();
  await expect(page.getByRole("heading", { name: "Kurumsal doküman merkezi" })).toBeVisible();
}

for (const [label, width] of [["half of a desktop screen", 960], ["a tablet", 768], ["a phone", 390]] as const) {
  test(`every screen can be reached on ${label}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await signIn(page);

    const openMenu = page.getByRole("button", { name: "Menüyü aç" });
    await expect(openMenu).toBeVisible();

    await openMenu.click();
    const menu = page.getByRole("dialog", { name: "Menü" });
    await menu.getByRole("button", { name: "Birimler" }).click();
    await expect(menu).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Birimler" }).first()).toBeVisible();

    await openMenu.click();
    await menu.getByRole("button", { name: "Son Eklenenler" }).click();
    await expect(page.getByRole("heading", { name: "Son Eklenenler" })).toBeVisible();

    // Nothing sticks out sideways.
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);

    await openMenu.click();
    await page.keyboard.press("Escape");
    await expect(menu).toHaveCount(0);

    await openMenu.click();
    await menu.getByRole("button", { name: "Menüyü kapat" }).click();
    await expect(menu).toHaveCount(0);

    await openMenu.click();
    await menu.getByRole("button", { name: "Şifremi Değiştir" }).click();
    await expect(menu).toHaveCount(0);
    await expect(page.getByRole("heading", { name: /Şifre/ }).first()).toBeVisible();
  });
}

test("the side menu stays in place on a wide screen", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page);

  await expect(page.getByRole("button", { name: "Menüyü aç", exact: true })).toBeHidden();
  await page.getByRole("button", { name: "Son Eklenenler" }).click();
  await expect(page.getByRole("heading", { name: "Son Eklenenler" })).toBeVisible();
});
