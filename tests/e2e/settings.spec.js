// Настройки: панель, вкладки, основные параметры, данные
const { test, expect, open } = require('./fixtures');

test('шестерёнка открывает настройки на вкладке «Основные», Esc закрывает и возвращает фокус', async ({ page }) => {
  await open(page);
  await page.locator('#settingsBtn').click();
  await expect(page.locator('#settings')).toBeVisible();
  await expect(page.locator('#stab-main')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#spane-main')).toBeVisible();
  await expect(page.locator('#spane-a11y')).toBeHidden();
  await page.keyboard.press('Escape');
  await expect(page.locator('#settings')).toBeHidden();
  await expect(page.locator('#settingsBtn')).toBeFocused();
});

test('кнопка спецвозможностей открывает нужную вкладку настроек', async ({ page }) => {
  await open(page);
  await page.locator('#a11yBtn').click();
  await expect(page.locator('#stab-a11y')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#spane-a11y')).toBeVisible();
  await expect(page.locator('#presets .preset')).toHaveCount(6);
});

test('вкладки настроек переключаются стрелками', async ({ page }) => {
  await open(page);
  await page.locator('#settingsBtn').click();
  await page.locator('#stab-main').focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#stab-a11y')).toBeFocused();
  await expect(page.locator('#spane-a11y')).toBeVisible();
  await page.keyboard.press('End');
  await expect(page.locator('#spane-data')).toBeVisible();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#spane-main')).toBeVisible();
});

test('тёмная тема применяется сразу и до отрисовки после перезагрузки', async ({ page }) => {
  await open(page);
  await page.locator('#settingsBtn').click();
  await page.locator('input[name="theme"][value="dark"] + span').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(bg).toBe('rgb(14, 17, 22)');
  await page.addInitScript(() => {
    document.addEventListener('readystatechange', () => {
      if (document.readyState === 'interactive' && !window.__themeAtParse) window.__themeAtParse = document.documentElement.dataset.theme;
    });
  });
  await page.reload();
  expect(await page.evaluate(() => window.__themeAtParse)).toBe('dark');
});

test('размер текста: четыре ступени меняют кегль', async ({ page }) => {
  await open(page);
  const size = () => page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('.section__lead, .hero__lead')).fontSize));
  const base = await size();
  await page.locator('#settingsBtn').click();
  const sizes = [];
  for (const v of ['lg', 'xl', 'xxl']) {
    await page.locator(`input[name="fs"][value="${v}"] + span`).click();
    await expect(page.locator('html')).toHaveAttribute('data-fs', v);
    sizes.push(await size());
  }
  expect(sizes[0]).toBeGreaterThan(base);
  expect(sizes[1]).toBeGreaterThan(sizes[0]);
  expect(sizes[2]).toBeGreaterThan(sizes[1]);
});

test('подсказки «Как читать» выключаются', async ({ page }) => {
  await open(page, '#compass');
  await expect(page.locator('#compass .hint')).toBeVisible();
  await page.evaluate(() => window.BPCSettings.open('main'));
  await page.locator('.set-toggle:has(input[name="hints"])').click();
  await expect(page.locator('html')).toHaveAttribute('data-hints', 'off');
  await page.keyboard.press('Escape');
  await expect(page.locator('#compass .hint')).toBeHidden();
});

test('режим анимаций «Выключены»', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('bpc-settings', '{}'));
  await open(page);
  await page.locator('#settingsBtn').click();
  await page.locator('input[name="motion"][value="off"] + span').click();
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'off');
  expect(await page.evaluate(() => localStorage.getItem('bpc-settings'))).toBe('{"motion":"off"}');
});

test('настройки из Alpha 0.3 переносятся (контраст-флаг, старая тема)', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('bpc-settings', JSON.stringify({ contrast: 'high', fs: 'xl' }));
    localStorage.setItem('bpc-theme', 'dark');
  });
  await open(page);
  await expect(page.locator('html')).toHaveAttribute('data-contrast', 'high');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('html')).toHaveAttribute('data-fs', 'xl');
});

test('«Сбросить все настройки» возвращает значения по умолчанию', async ({ page }) => {
  await open(page);
  await page.evaluate(() => window.BPCSettings.set({ theme: 'dark', simple: true, contrast: 'max' }));
  await page.evaluate(() => window.BPCSettings.open('data'));
  await page.locator('[data-set="prefs"]').click();
  await expect(page.locator('html')).not.toHaveAttribute('data-theme', /./);
  await expect(page.locator('html')).not.toHaveAttribute('data-simple', /./);
  await expect(page.locator('#setMsg')).toHaveText('Все настройки сброшены.');
});

test('«Удалить все данные» требует подтверждения и очищает хранилище', async ({ page }) => {
  await open(page, '#quiz');
  await page.locator('[data-act="start"]').click();
  await page.keyboard.press('1');
  await page.evaluate(() => window.BPCSettings.open('data'));
  await expect(page.locator('#dataStatus')).toContainText('ответы теста (1 из 40)');
  const btn = page.locator('[data-set="all"]');
  await btn.click();
  await expect(btn).toHaveText('Нажмите ещё раз — удалить всё');
  await Promise.all([page.waitForEvent('load'), btn.click()]);
  const keys = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('bpc-')));
  expect(keys).toEqual([]);
});

test('«Удалить ответы теста» возвращает тест к началу', async ({ page }) => {
  await open(page, '#quiz');
  await page.locator('[data-act="start"]').click();
  await page.keyboard.press('1');
  await page.evaluate(() => window.BPCSettings.open('data'));
  const btn = page.locator('[data-set="quiz"]');
  await btn.click();
  await btn.click();
  await expect(page.locator('#setMsg')).toHaveText('Ответы теста удалены.');
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-act="start"]')).toBeVisible();
});

test('«Вернуть оси по умолчанию»', async ({ page }) => {
  await open(page, '#compass');
  await page.locator('#swapAxes').click();
  await page.evaluate(() => window.BPCSettings.open('data'));
  await page.locator('[data-set="axes"]').click();
  await page.keyboard.press('Escape');
  await expect(page.locator('#lblRight')).toHaveText('Запад');
});

test('щелчок по затемнению закрывает панель', async ({ page }) => {
  await open(page);
  await page.locator('#settingsBtn').click();
  const vw = page.viewportSize().width;
  test.skip(vw <= 600, 'на телефоне панель во весь экран');
  await page.mouse.click(10, page.viewportSize().height / 2);
  await expect(page.locator('#settings')).toBeHidden();
});
