// Вкладки: все разделы на одной странице, но видна только выбранная
const { test, expect, open, currentTab, visiblePanels } = require('./fixtures');

const TABS = ['home', 'compass', 'quiz', 'analytics', 'timeline', 'method', 'about'];

test('семь вкладок с ролями ARIA', async ({ page }) => {
  await open(page);
  const tabs = page.locator('#tabs [role="tab"]');
  await expect(tabs).toHaveCount(7);
  await expect(page.locator('#tab-home')).toHaveAttribute('aria-selected', 'true');
  for (const t of TABS.slice(1)) await expect(page.locator('#tab-' + t)).toHaveAttribute('aria-selected', 'false');
  // Роуминг tabindex: в ленту вкладок попадаем одним Tab
  await expect(page.locator('#tabs [role="tab"][tabindex="0"]')).toHaveCount(1);
});

test('нажатие на вкладку показывает её панель, меняет адрес и прячет остальные', async ({ page }) => {
  await open(page);
  for (const t of TABS) {
    await page.locator('#tab-' + t).click();
    await expect(page.locator('#' + t)).toBeVisible();
    expect(await visiblePanels(page)).toEqual([t]);
    await expect(page.locator('#tab-' + t)).toHaveAttribute('aria-selected', 'true');
    expect(new URL(page.url()).hash).toBe('#' + t);
  }
});

test('прямая ссылка открывает нужную вкладку сразу, без мигания главной', async ({ page }) => {
  await page.addInitScript(() => {
    document.addEventListener('DOMContentLoaded', () => (window.__tabAtDom = document.documentElement.dataset.tab));
  });
  await open(page, '#quiz');
  expect(await page.evaluate(() => window.__tabAtDom)).toBe('quiz');
  expect(await visiblePanels(page)).toEqual(['quiz']);
});

test('якорь внутри вкладки: #faq открывает «О проекте» и показывает вопросы', async ({ page }) => {
  await open(page, '#faq');
  expect(await currentTab(page)).toBe('about');
  await expect(page.locator('#faq')).toBeInViewport();
});

test('ссылка на якорь с другой вкладки переключает вкладку и прокручивает к цели', async ({ page }) => {
  await open(page, '#home');
  await page.locator('.footer a[href="#cite"]').click();
  expect(await currentTab(page)).toBe('about');
  await expect(page.locator('#cite')).toBeInViewport();
});

test('кнопки «Назад» и «Вперёд» браузера переключают вкладки', async ({ page }) => {
  await open(page);
  await page.locator('#tab-compass').click();
  await page.locator('#tab-analytics').click();
  await page.goBack();
  await expect.poll(() => currentTab(page)).toBe('compass');
  await page.goBack();
  await expect.poll(() => currentTab(page)).toBe('home');
  await page.goForward();
  await expect.poll(() => currentTab(page)).toBe('compass');
});

test('клавиатура в ленте вкладок: стрелки, Home, End', async ({ page }) => {
  await open(page);
  await page.locator('#tab-home').focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#tab-compass')).toBeFocused();
  expect(await currentTab(page)).toBe('compass');
  await page.keyboard.press('End');
  await expect(page.locator('#tab-about')).toBeFocused();
  expect(await currentTab(page)).toBe('about');
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#tab-home')).toBeFocused();
  await page.keyboard.press('ArrowLeft');
  await expect(page.locator('#tab-about')).toBeFocused();
  await page.keyboard.press('Home');
  expect(await currentTab(page)).toBe('home');
});

test('кнопка «Пройти тест» на главной ведёт во вкладку теста и переносит фокус', async ({ page }) => {
  await open(page);
  await page.locator('.hero__cta .btn--primary').click();
  expect(await currentTab(page)).toBe('quiz');
  await expect(page.locator('#quiz')).toBeFocused();
});

test('«Дальше» и «Назад» внизу вкладки ведут к соседним', async ({ page }) => {
  await open(page, '#quiz');
  await page.locator('#quiz .pager__link--next').click();
  expect(await currentTab(page)).toBe('analytics');
  await page.locator('#analytics .pager__link--prev').click();
  expect(await currentTab(page)).toBe('quiz');
  await expect(page.locator('#home .pager__link--prev')).toHaveCount(0);
  await expect(page.locator('#about .pager__link--next')).toHaveCount(0);
});

test('смена вкладки прокручивает к началу страницы', async ({ page }) => {
  await open(page, '#about');
  await page.mouse.wheel(0, 3000);
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(500);
  await page.locator('#tab-method').click();
  await expect.poll(() => page.evaluate(() => scrollY)).toBeLessThan(5);
});

test('ссылка «Перейти к содержимому» переводит фокус в открытую вкладку', async ({ page }) => {
  // Прямая ссылка #analytics по стандарту ставит фокус на саму панель —
  // поэтому приходим на вкладку «изнутри» страницы и начинаем с начала документа
  await open(page);
  await page.evaluate(() => window.BPCTabs.go('#analytics', { focus: false }));
  await page.evaluate(() => document.activeElement && document.activeElement.blur());
  await page.keyboard.press('Tab');
  await expect(page.locator('.skip-link')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#analytics')).toBeFocused();
});

test('логотип и кнопка «Наверх» возвращают на главную', async ({ page }) => {
  await open(page, '#timeline');
  await page.locator('.nav .brand').click();
  expect(await currentTab(page)).toBe('home');
  await page.locator('#tab-method').click();
  await page.locator('.to-top').click();
  expect(await currentTab(page)).toBe('home');
});

test('экранный диктор слышит смену вкладки', async ({ page }) => {
  await open(page);
  await page.locator('#tab-timeline').click();
  await expect(page.locator('#announcer')).toHaveText('Открыта вкладка «История»');
});

test('на телефоне активная вкладка прокручивается в видимую часть ленты', async ({ page }) => {
  test.skip(page.viewportSize().width > 1080, 'лента прокручивается только на узких экранах');
  await open(page, '#about');
  const tab = page.locator('#tab-about');
  const box = await tab.boundingBox();
  expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize().width + 1);
  expect(box.x).toBeGreaterThanOrEqual(-1);
});
