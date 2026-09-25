// Печать и работа без JavaScript: весь сайт — одна длинная страница
const { test, expect, open, visiblePanels } = require('./fixtures');

test('при печати видны все вкладки, а шапка и подвал скрыты', async ({ page }) => {
  await open(page);
  await page.emulateMedia({ media: 'print' });
  expect(await visiblePanels(page)).toEqual(['home', 'compass', 'quiz', 'analytics', 'timeline', 'method', 'about']);
  await expect(page.locator('#nav')).toBeHidden();
  await expect(page.locator('.pager').first()).toBeHidden();
});

test('без JavaScript все разделы показываются подряд, ссылки меню ведут к ним', async ({ browser }) => {
  const ctx = await browser.newContext({ javaScriptEnabled: false });
  const page = await ctx.newPage();
  await page.route(/fonts\./, (r) => r.abort());
  await page.goto('/');
  for (const id of ['home', 'compass', 'quiz', 'analytics', 'timeline', 'method', 'about']) {
    await expect(page.locator('#' + id)).toBeVisible();
  }
  await expect(page.locator('.simple').first()).toBeHidden();
  await page.locator('#tab-about').click();
  await expect(page.locator('#about')).toBeInViewport();
  await ctx.close();
});
