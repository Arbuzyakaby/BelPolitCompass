// Упрощённый режим: пояснение простыми словами к каждой строке
const { test, expect, open } = require('./fixtures');

const TABS = ['home', 'compass', 'quiz', 'analytics', 'timeline', 'method', 'about'];
const visibleSimple = (page, scope) =>
  page.evaluate((scope) => Array.from(document.querySelectorAll(`${scope} .simple`)).filter((e) => e.offsetParent !== null).length, scope);

test('по умолчанию пояснения скрыты', async ({ page }) => {
  for (const t of TABS) {
    await open(page, '#' + t);
    expect(await visibleSimple(page, '#' + t), t).toBe(0);
  }
});

test('кнопка «Включить» на главной включает режим и сохраняет его', async ({ page }) => {
  await open(page);
  const btn = page.locator('#easyOffer [data-simple-toggle]');
  await expect(btn).toHaveAttribute('aria-pressed', 'false');
  await btn.click();
  await expect(page.locator('html')).toHaveAttribute('data-simple', 'on');
  await expect(btn).toHaveAttribute('aria-pressed', 'true');
  await expect(btn).toHaveText('Выключить');
  await expect(page.locator('#announcer')).toHaveText('Упрощённый режим включён');
  expect(await visibleSimple(page, '#home')).toBeGreaterThanOrEqual(4);
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-simple', 'on');
});

test('переключатель в настройках и кнопка в подвале управляют тем же режимом', async ({ page }) => {
  await open(page);
  await page.locator('#settingsBtn').click();
  await page.locator('.set-toggle:has(input[name="simple"])').click();
  await expect(page.locator('html')).toHaveAttribute('data-simple', 'on');
  await expect(page.locator('.set-demo')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.locator('.footer [data-simple-toggle]').click();
  await expect(page.locator('html')).not.toHaveAttribute('data-simple', /./);
});

test.describe('с включённым режимом', () => {
  test.use({ prefs: { motion: 'off', simple: true } });

  test('в каждой вкладке есть видимые пояснения', async ({ page }) => {
    for (const t of TABS) {
      await open(page, '#' + t);
      expect(await visibleSimple(page, '#' + t), t).toBeGreaterThanOrEqual(1);
    }
  });

  test('у каждой партии в списке — описание простыми словами', async ({ page }) => {
    await open(page, '#compass');
    const notes = page.locator('#partyList .pcard .simple');
    await expect(notes).toHaveCount(14);
    for (const n of await notes.all()) await expect(n).toBeVisible();
    await expect(page.locator('.pcard[data-id="br"] .simple')).toContainText('Самая большая партия');
  });

  test('пояснение к компасу описывает выбранные оси и меняется вместе с ними', async ({ page }) => {
    await open(page, '#compass');
    const note = page.locator('#compassSimple');
    await expect(note).toContainText('слева — «Восток» (за тесный союз с Россией)');
    await expect(note).toContainText('вверху — «Вертикаль»');
    await page.locator('#swapAxes').click();
    await expect(note).toContainText('слева — «Горизонталь»');
  });

  test('карточка партии: пояснения к статусу, местам и каждой оси', async ({ page }) => {
    await open(page, '#compass');
    await page.locator('.pcard[data-id="bnf"]').click();
    await expect(page.locator('#partyDetail .simple').first()).toContainText('закрыли по решению властей');
    await expect(page.locator('#partyDetail .axisrow .simple')).toHaveCount(4);
    await expect(page.locator('#partyDetail .axisrow .simple').first()).toContainText('очень сильно ближе к «Запад»');
    await expect(page.locator('#partyDetail')).toContainText('У партии нет мест в парламенте');
  });

  test('тест: у вопроса есть пояснение термина и куда сдвинется точка', async ({ page }) => {
    await open(page, '#quiz');
    await page.locator('[data-act="start"]').click();
    await expect(page.locator('#qzSimple')).toBeVisible();
    await expect(page.locator('#qzSimple')).toContainText('Европейский союз (ЕС)');
    await expect(page.locator('#qzSimple')).toContainText('сдвинется к «Запад»');
    await expect(page.locator('.qz-ans .simple').first()).toHaveText('Да, именно так я и думаю');
    // Вопрос про ЕАЭС — девятый
    for (let i = 0; i < 8; i++) await page.keyboard.press('3');
    await expect(page.locator('#qzQ')).toContainText('ЕАЭС');
    await expect(page.locator('#qzSimple')).toContainText('Евразийский экономический союз');
  });

  test('аналитика: пояснение у каждой диаграммы и у каждого счётчика', async ({ page }) => {
    await open(page, '#analytics');
    for (const card of await page.locator('#analytics .card:not(.card--stats)').all()) {
      await expect(card.locator('.simple').first()).toBeVisible();
    }
    await expect(page.locator('#statCards .stat .simple')).toHaveCount(4);
  });

  test('хронология и оси: пояснение у каждого события и полюса', async ({ page }) => {
    await open(page, '#timeline');
    await expect(page.locator('.tl__item .simple')).toHaveCount(11);
    await page.locator('#tab-method').click();
    await expect(page.locator('.mcard .mpole .simple')).toHaveCount(8);
  });

  test('выпадающий список осей объясняет каждую ось', async ({ page }) => {
    await open(page, '#compass');
    await page.locator('#ddXBtn').click();
    await expect(page.locator('#ddX-economy .simple')).toBeVisible();
    await expect(page.locator('#ddX-economy .simple')).toContainText('заводы и магазины');
  });
});
