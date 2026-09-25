// Автоматический аудит доступности (axe-core, WCAG 2.2 A/AA) каждой вкладки
const AxeBuilder = require('@axe-core/playwright').default;
const { test, expect, open } = require('./fixtures');

const TABS = ['home', 'compass', 'quiz', 'analytics', 'timeline', 'method', 'about'];

async function audit(page, include) {
  let b = new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']);
  if (include) b = b.include(include);
  const r = await b.analyze();
  return r.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`);
}

for (const tab of TABS) {
  test(`axe: вкладка «${tab}» без нарушений`, async ({ page }) => {
    await open(page, '#' + tab);
    expect(await audit(page)).toEqual([]);
  });
}

test.describe('тёмная тема', () => {
  test.use({ prefs: { motion: 'off', theme: 'dark' } });
  for (const tab of ['home', 'compass', 'analytics', 'about']) {
    test(`axe: «${tab}» в тёмной теме`, async ({ page }) => {
      await open(page, '#' + tab);
      expect(await audit(page)).toEqual([]);
    });
  }
});

test.describe('упрощённый режим и максимальный контраст', () => {
  test.use({ prefs: { motion: 'off', simple: true, contrast: 'max', tables: true } });
  for (const tab of ['home', 'compass', 'quiz', 'analytics']) {
    test(`axe: «${tab}»`, async ({ page }) => {
      await open(page, '#' + tab);
      expect(await audit(page)).toEqual([]);
    });
  }
});

test('axe: открытая карточка партии', async ({ page }) => {
  await open(page, '#compass');
  await page.locator('.pcard[data-id="ogp"]').click();
  expect(await audit(page, '#flip')).toEqual([]);
});

test('axe: идущий тест и результат', async ({ page }) => {
  await open(page, '#quiz');
  await page.locator('[data-act="start"]').click();
  expect(await audit(page, '#quiz')).toEqual([]);
  for (let i = 0; i < 40; i++) await page.keyboard.press('2');
  await expect(page.locator('.qz-result')).toBeVisible();
  expect(await audit(page, '#quiz')).toEqual([]);
});

for (const pane of ['main', 'a11y', 'data']) {
  test(`axe: панель настроек «${pane}»`, async ({ page }) => {
    await open(page);
    await page.evaluate((p) => window.BPCSettings.open(p), pane);
    expect(await audit(page, '#settings')).toEqual([]);
  });
}

test('axe: тур для новичков', async ({ page }) => {
  await open(page);
  await page.locator('#helpBtn').click();
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(300);
  expect(await audit(page, '.tour__pop')).toEqual([]);
});
