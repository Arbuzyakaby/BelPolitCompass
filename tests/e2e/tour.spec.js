// Тур для новичков и приглашение при первом визите
const { test, expect, open, currentTab } = require('./fixtures');

test.describe('первый визит', () => {
  test.use({ tourDone: false });

  test('появляется приглашение; «Не сейчас» прячет его навсегда', async ({ page }) => {
    await open(page);
    const invite = page.locator('.tour-invite');
    await expect(invite).toBeVisible({ timeout: 4000 });
    await invite.locator('[data-i="later"]').first().click();
    await expect(invite).toBeHidden();
    expect(await page.evaluate(() => localStorage.getItem('bpc-tour'))).toBe('later');
    await page.reload();
    await page.waitForTimeout(1800);
    await expect(invite).toBeHidden();
  });

  test('«Показать» запускает тур', async ({ page }) => {
    await open(page);
    await page.locator('.tour-invite [data-i="start"]').click({ timeout: 4000 });
    await expect(page.locator('.tour__pop')).toBeVisible();
    await expect(page.locator('#tourCount')).toHaveText('Шаг 1 из 12');
  });
});

test('тур проходит по вкладкам и завершается переходом к тесту', async ({ page }) => {
  await open(page);
  await page.locator('#helpBtn').click();
  await expect(page.locator('html')).toHaveClass(/has-tour/);
  const next = page.locator('.tour__nav [data-t="next"]');
  const seen = new Set();
  for (let i = 0; i < 11; i++) {
    await next.click();
    await expect(page.locator('#tourCount')).toHaveText(`Шаг ${i + 2} из 12`);
    await page.waitForTimeout(120);
    seen.add(await currentTab(page));
  }
  expect([...seen]).toEqual(expect.arrayContaining(['home', 'compass', 'quiz', 'analytics']));
  await expect(next).toHaveText('Пройти тест');
  await next.click();
  await expect(page.locator('html')).not.toHaveClass(/has-tour/);
  expect(await currentTab(page)).toBe('quiz');
  expect(await page.evaluate(() => localStorage.getItem('bpc-tour'))).toBe('done');
});

test('стрелки листают тур, Esc закрывает и возвращает фокус', async ({ page }) => {
  await open(page);
  await page.locator('#helpBtn').click();
  await expect(page.locator('#tourCount')).toHaveText('Шаг 1 из 12');
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#tourCount')).toHaveText('Шаг 2 из 12');
  await page.keyboard.press('ArrowLeft');
  await expect(page.locator('#tourCount')).toHaveText('Шаг 1 из 12');
  await page.keyboard.press('Escape');
  await expect(page.locator('.tour__pop')).toBeHidden();
  await expect(page.locator('#helpBtn')).toBeFocused();
});

test('шаг про компас подсвечивает элемент на вкладке «Компас»', async ({ page }) => {
  await open(page);
  await page.locator('#helpBtn').click();
  for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowRight');
  await expect(page.locator('#tourTitle')).toHaveText('Выберите, что сравнивать');
  expect(await currentTab(page)).toBe('compass');
  await expect(page.locator('.compass-controls')).toBeInViewport();
});

test('тур не даёт фокусу уйти за пределы карточки (Tab по кругу)', async ({ page }) => {
  await open(page);
  await page.locator('#helpBtn').click();
  await page.keyboard.press('ArrowRight');
  for (let i = 0; i < 5; i++) {
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => !!document.activeElement.closest('.tour__pop'))).toBe(true);
  }
});
