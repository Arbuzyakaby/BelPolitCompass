// Главная жалоба Alpha 0.3: на телефонах не листались списки.
// Проверяем настоящими касаниями (протокол Chromium).
const { test, expect, open, swipeUp, touchDrag, isNarrow } = require('./fixtures');

test.describe('касания', () => {
  test.skip(({ hasTouch }) => !hasTouch, 'только для устройств с сенсорным экраном');

  test('телефон: список партий раскрыт целиком и листается вместе со страницей', async ({ page }) => {
    test.skip(!isNarrow(page), 'раскладка телефона');
    await open(page, '#compass');
    const list = page.locator('#partyList');
    const inner = await list.evaluate((l) => l.scrollHeight - l.clientHeight);
    expect(inner, 'внутри списка нет своей прокрутки-ловушки').toBeLessThanOrEqual(1);
    await list.scrollIntoViewIfNeeded();
    const y0 = await page.evaluate(() => scrollY);
    await swipeUp(page, list);
    expect(await page.evaluate(() => scrollY)).toBeGreaterThan(y0 + 100);
  });

  test('телефон: карточка партии листается пальцем вместе со страницей', async ({ page }) => {
    test.skip(!isNarrow(page), 'раскладка телефона');
    await open(page, '#compass');
    await page.locator('.pcard[data-id="br"]').click();
    const card = page.locator('.pd__scroll');
    expect(await card.evaluate((s) => s.scrollHeight - s.clientHeight)).toBeLessThanOrEqual(1);
    const y0 = await page.evaluate(() => scrollY);
    await swipeUp(page, card, 300);
    expect(await page.evaluate(() => scrollY)).toBeGreaterThan(y0 + 100);
  });

  test('планшет: список внутри карточки листается пальцем (регрессия Alpha 0.3)', async ({ page }) => {
    test.skip(isNarrow(page), 'раскладка компьютера с сенсорным экраном');
    await open(page, '#compass');
    const list = page.locator('#partyList');
    await list.scrollIntoViewIfNeeded();
    expect(await list.evaluate((l) => l.scrollHeight - l.clientHeight)).toBeGreaterThan(50);
    await swipeUp(page, list, 200);
    expect(await list.evaluate((l) => l.scrollTop)).toBeGreaterThan(50);
  });

  test('планшет: карточка партии листается пальцем после переворота', async ({ page }) => {
    test.skip(isNarrow(page), 'раскладка компьютера с сенсорным экраном');
    await open(page, '#compass');
    await page.evaluate(() => window.BPCSettings.set({ motion: 'full' }));
    await page.locator('.pcard[data-id="kpb"]').click();
    await expect(page.locator('#flip')).not.toHaveClass(/is-3d/, { timeout: 3000 });
    const card = page.locator('.pd__scroll');
    await swipeUp(page, card, 200);
    expect(await card.evaluate((s) => s.scrollTop)).toBeGreaterThan(50);
  });

  test('горизонтальный свайп по карточке листает партии, вертикальный — нет', async ({ page }) => {
    await open(page, '#compass');
    await page.locator('.pcard[data-id="br"]').click();
    const b = await page.locator('.pd__hero').boundingBox();
    const y = b.y + b.height / 2;
    await touchDrag(page, { x: b.x + b.width * 0.8, y }, { x: b.x + b.width * 0.1, y });
    await expect(page.locator('.pd__name')).toHaveText('КПБ');
  });

  test('панель настроек листается пальцем', async ({ page }) => {
    await open(page);
    await page.locator('#a11yBtn').click();
    const body = page.locator('#sheetBody');
    const room = await body.evaluate((b) => b.scrollHeight - b.clientHeight);
    test.skip(room < 50, 'всё помещается на экране');
    await swipeUp(page, body, 250);
    expect(await body.evaluate((b) => b.scrollTop)).toBeGreaterThan(30);
  });

  test('матрица близости: первое касание показывает сходство, второе открывает партию', async ({ page }) => {
    await open(page, '#analytics');
    const cell = page.locator('.mx-c[data-a="br"][data-b="kpb"]');
    await cell.scrollIntoViewIfNeeded();
    await cell.tap();
    await expect(page.locator('.mx-tip')).toContainText('сходство');
    await cell.tap();
    await expect(page.locator('.pd__name')).toHaveText('КПБ');
  });

  test('лента вкладок листается вбок пальцем', async ({ page }) => {
    test.skip(page.viewportSize().width > 1080, 'на широком экране все вкладки помещаются');
    await open(page);
    const list = page.locator('#tabs');
    const room = await list.evaluate((l) => l.scrollWidth - l.clientWidth);
    test.skip(room < 20, 'все вкладки помещаются');
    const b = await list.boundingBox();
    await touchDrag(page, { x: b.x + b.width * 0.85, y: b.y + b.height / 2 }, { x: b.x + b.width * 0.15, y: b.y + b.height / 2 });
    expect(await list.evaluate((l) => l.scrollLeft)).toBeGreaterThan(20);
  });
});

test('на узком экране вкладки рейтинга видны целиком (без скрытой прокрутки)', async ({ page }) => {
  await open(page, '#analytics');
  const seg = page.locator('#barsTabs');
  expect(await seg.evaluate((s) => s.scrollWidth - s.clientWidth)).toBeLessThanOrEqual(1);
  for (const b of await seg.locator('.seg__btn').all()) await expect(b).toBeVisible();
});

test('кнопки и ссылки не меньше 24 × 24 (WCAG 2.5.8)', async ({ page }) => {
  for (const tab of ['home', 'compass', 'analytics']) {
    await open(page, '#' + tab);
    const small = await page.evaluate(() =>
      Array.from(document.querySelectorAll('.tabpanel.is-active button, .tabpanel.is-active a, .nav button, .nav a'))
        .filter((el) => {
          const r = el.getBoundingClientRect();
          if (!r.width || !r.height || el.closest('.pdot, .mx-c, .data-table')) return false;
          // Ссылки внутри текста WCAG не требует увеличивать
          if (el.tagName === 'A' && el.closest('p')) return false;
          const hit = el.classList.contains('mdot') ? r.width + 20 : Math.min(r.width, r.height);
          return hit < 24;
        })
        .map((el) => el.className || el.tagName)
    );
    expect(small, tab).toEqual([]);
  }
});
