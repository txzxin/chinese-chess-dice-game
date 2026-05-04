const { test, expect } = require("@playwright/test");

test("loads the board and rolls the dice", async ({ page }) => {
  await page.goto("file:///D:/CodeProjects/Codex/chinese-chess-dice-game/index.html");

  await expect(page.getByRole("heading", { name: "象棋骰子" })).toBeVisible();
  await expect(page.locator(".square")).toHaveCount(32);
  await expect(page.locator("#hpValue")).toHaveText("7/7");

  await page.getByRole("button", { name: "掷骰子" }).click();
  await expect(page.locator("#diceValue")).not.toHaveText("-", { timeout: 5000 });
  await expect(page.locator("#logList li").first()).toContainText(/掷出|开炮|冲锋|攻击|没有触发|登上/);
});
