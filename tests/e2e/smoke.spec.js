// Базовая проверка: страница открывается без ошибок, версия и модули на месте
const { test, expect, open, visiblePanels } = require('./fixtures');

test('страница загружается: заголовок, версия, все модули', async ({ page }) => {
  await open(page);
  await expect(page).toHaveTitle(/BelPolitCompass/);
  await expect(page.locator('.hero__title')).toHaveText('Политический компас Беларуси');
  await expect(page.locator('.hero__meta [data-version]')).toHaveText('Alpha 0.5');
  await expect(page.locator('.hero__meta [data-updated]')).not.toBeEmpty();
  const apis = await page.evaluate(() =>
    ['BPC', 'BPCBoot', 'BPCCore', 'BPCTabs', 'BPCApp', 'BPCQuiz', 'BPCSettings', 'BPCA11y', 'BPCTour', 'BPCFun'].filter((k) => !window[k])
  );
  expect(apis).toEqual([]);
});

test('на <html> есть класс js и выбранная вкладка, видна только одна панель', async ({ page }) => {
  await open(page);
  await expect(page.locator('html')).toHaveClass(/\bjs\b/);
  await expect(page.locator('html')).toHaveAttribute('data-tab', 'home');
  expect(await visiblePanels(page)).toEqual(['home']);
});

test('14 партий в списке, на компасе и в мини-компасе', async ({ page }) => {
  await open(page);
  await expect(page.locator('#partyList .pcard')).toHaveCount(14);
  await expect(page.locator('#dots .pdot:not(.pdot--me)')).toHaveCount(14);
  await expect(page.locator('#heroPlane .mdot')).toHaveCount(14);
});

for (const tab of ['home', 'compass', 'quiz', 'analytics', 'timeline', 'method', 'about']) {
  test(`вкладка «${tab}»: нет горизонтальной прокрутки страницы`, async ({ page }) => {
    await open(page, '#' + tab);
    await page.waitForTimeout(150);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
}

test('системное «уменьшить движение» выключает анимации', async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.route(/fonts\./, (r) => r.abort());
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'off');
  await ctx.close();
});

test('недоступное хранилище (приватный режим) не ломает страницу', async ({ browser }) => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route(/fonts\./, (r) => r.abort());
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw new Error('SecurityError');
      },
    });
  });
  await page.goto('/#compass');
  await expect(page.locator('#compass')).toBeVisible();
  await expect(page.locator('#dots .pdot:not(.pdot--me)')).toHaveCount(14);
  expect(errors).toEqual([]);
  await ctx.close();
});

test('самый узкий экран 320 px: шапка помещается, логотип не сжимается', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 320, height: 640 } });
  const page = await ctx.newPage();
  await page.route(/fonts\./, (r) => r.abort());
  await page.goto('/');
  const mark = await page.locator('.nav .brand__mark').boundingBox();
  expect(mark.width).toBeGreaterThanOrEqual(20);
  const right = await page.locator('#settingsBtn').boundingBox();
  expect(right.x + right.width).toBeLessThanOrEqual(320);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await ctx.close();
});
