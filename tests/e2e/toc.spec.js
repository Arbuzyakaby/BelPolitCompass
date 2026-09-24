// Новое содержание раздела «О проекте»
const { test, expect, open, isNarrow } = require('./fixtures');

test('15 пунктов в четырёх группах, заголовки разделов пронумерованы', async ({ page }) => {
  await open(page, '#about');
  await expect(page.locator('.toc__list a')).toHaveCount(15);
  await expect(page.locator('.toc__group')).toHaveCount(4);
  await expect(page.locator('#about-sim h3 .about__num')).toHaveText('05');
  await expect(page.locator('#cite h3 .about__num')).toHaveText('14');
});

test('компьютер: содержание раскрыто, не сворачивается и остаётся на экране при прокрутке', async ({ page }) => {
  test.skip(isNarrow(page), 'раскладка компьютера');
  await open(page, '#about');
  const box = page.locator('#tocBox');
  await expect(box).toHaveAttribute('open', '');
  await page.locator('.toc__summary').click();
  await expect(box).toHaveAttribute('open', '');
  await page.locator('.toc__list a[href="#glossary"]').click();
  await expect(page.locator('#glossary')).toBeInViewport();
  await expect(page.locator('#toc')).toBeInViewport();
});

test('текущий пункт подсвечивается при прокрутке и помечен aria-current', async ({ page }) => {
  await open(page, '#about');
  await expect(page.locator('.toc__list a.is-active')).toHaveAttribute('href', '#about-why');
  await page.evaluate(() => {
    const t = document.querySelector('#about-limits');
    window.scrollTo(0, t.getBoundingClientRect().top + scrollY - 120);
  });
  await expect(page.locator('.toc__list a[aria-current="location"]')).toHaveAttribute('href', '#about-limits');
  await expect(page.locator('#tocCurrent')).toHaveText('Ограничения');
  const w = await page.evaluate(() => parseFloat(document.querySelector('#tocMeter').style.width));
  expect(w).toBeCloseTo((7 / 15) * 100, 0);
});

test('в конце раздела активен последний пункт', async ({ page }) => {
  await open(page, '#about');
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await expect(page.locator('.toc__list a.is-active')).toHaveAttribute('href', '#about-help');
});

test('телефон: компактная плашка с текущим пунктом, раскрывается и закрывается после выбора', async ({ page }) => {
  test.skip(!isNarrow(page), 'раскладка телефона');
  await open(page, '#about');
  const box = page.locator('#tocBox');
  await expect(box).not.toHaveAttribute('open', '');
  await expect(page.locator('#tocCurrent')).toBeVisible();
  await page.locator('.toc__summary').click();
  await expect(box).toHaveAttribute('open', '');
  await page.locator('.toc__list a[href="#faq"]').click();
  await expect(box).not.toHaveAttribute('open', '');
  await expect(page.locator('#faq')).toBeInViewport();
  await expect(page.locator('#tocCurrent')).toHaveText('Частые вопросы');
  // Плашка «прилипает» под шапкой
  const top = await page.locator('#toc').evaluate((el) => el.getBoundingClientRect().top);
  const nav = await page.locator('#nav').evaluate((el) => el.getBoundingClientRect().bottom);
  expect(Math.abs(top - nav)).toBeLessThan(20);
});
