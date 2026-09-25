// Alpha 0.6: 3D-пролёт, «Приватность», новые пасхалки, реклама RuPolitCompass, Sand-Blasted Glass
const { test, expect, open } = require('./fixtures');

const found = (page) => page.evaluate(() => window.BPCFun.found());
const typeKeys = (page, word) =>
  page.evaluate((w) => {
    for (const key of w) document.body.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
  }, word);

/* ---------- 3D-пролёт ---------- */
test.describe('3D-пролёт при первом заходе', () => {
  test.use({ prefs: { motion: 'full' }, introDone: false });

  test('показывается на главной, пропускается кнопкой и больше не появляется', async ({ page }) => {
    await open(page);
    const intro = page.locator('.intro');
    await expect(intro).toBeVisible();
    await expect(intro).toHaveAttribute('role', 'dialog');
    await expect(page.locator('.intro__pin')).toHaveCount(14);
    await expect(page.locator('.intro__skip')).toBeFocused();
    await page.locator('.intro__skip').click();
    await expect(intro).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem('bpc-intro'))).toBe('done');
    // Пропустивший пролёт вянок не получает
    expect(await found(page)).not.toContain('vyanok');
    await page.reload();
    await page.waitForFunction(() => window.BPCIntro);
    await expect(page.locator('.intro')).toHaveCount(0);
  });

  test('любая клавиша пропускает; досмотревший до конца находит вянок', async ({ page }) => {
    await open(page);
    await expect(page.locator('.intro')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('.intro')).toHaveCount(0);
    // Повтор из настроек, досматриваем
    await page.evaluate(() => window.BPCIntro.play(true));
    await expect(page.locator('.intro')).toBeVisible();
    await expect.poll(() => found(page), { timeout: 12000 }).toContain('vyanok');
    await expect(page.locator('.intro')).toHaveCount(0);
  });

  test('прямая ссылка на вкладку пролёт не показывает', async ({ page }) => {
    await open(page, '#compass');
    await page.waitForTimeout(300);
    await expect(page.locator('.intro')).toHaveCount(0);
  });
});

test.describe('первый визит целиком: пролёт, потом тур', () => {
  test.use({ prefs: { motion: 'full' }, introDone: false, tourDone: false });
  test('приглашение в тур ждёт окончания пролёта', async ({ page }) => {
    await open(page);
    await expect(page.locator('.intro')).toBeVisible();
    await page.waitForTimeout(1800);
    await expect(page.locator('.tour-invite')).toBeHidden();
    await page.locator('.intro__skip').click();
    await expect(page.locator('.tour-invite')).toBeVisible({ timeout: 4000 });
  });
});

test.describe('без полных анимаций', () => {
  test.use({ prefs: { motion: 'off' }, introDone: false });
  test('пролёт не показывается совсем', async ({ page }) => {
    await open(page);
    await page.waitForTimeout(300);
    await expect(page.locator('.intro')).toHaveCount(0);
  });
});

test.describe('пролёт выключен в настройках', () => {
  test.use({ prefs: { motion: 'full', intro: false }, introDone: false });
  test('не показывается', async ({ page }) => {
    await open(page);
    await page.waitForTimeout(300);
    await expect(page.locator('.intro')).toHaveCount(0);
  });
});

/* ---------- Приватность ---------- */
test('вкладка «Приватность»: факты, переключатели и список сохранённого', async ({ page }) => {
  await open(page);
  await page.locator('#settingsBtn').click();
  await page.locator('#stab-privacy').click();
  await expect(page.locator('#spane-privacy')).toBeVisible();
  await expect(page.locator('.privacy-facts li')).toHaveCount(4);
  for (const name of ['rememberQuiz', 'rememberAxes', 'webFonts']) {
    await expect(page.locator(`#spane-privacy input[name="${name}"]`)).toBeChecked();
  }
  await expect(page.locator('#privacyList')).toContainText('Настройки сайта');
});

test('запрет запоминать ответы теста удаляет их и больше не сохраняет', async ({ page }) => {
  await open(page, '#quiz');
  await page.locator('[data-act="start"]').click();
  await page.keyboard.press('1');
  await expect.poll(() => page.evaluate(() => localStorage.getItem(window.BPCQuiz.key))).not.toBeNull();
  await page.evaluate(() => window.BPCSettings.set({ rememberQuiz: false }));
  expect(await page.evaluate(() => localStorage.getItem(window.BPCQuiz.key))).toBeNull();
  await page.keyboard.press('2');
  await page.waitForTimeout(400);
  expect(await page.evaluate(() => localStorage.getItem(window.BPCQuiz.key))).toBeNull();
  // Включили обратно — текущие ответы сохраняются сразу
  await page.evaluate(() => window.BPCSettings.set({ rememberQuiz: true }));
  expect(await page.evaluate(() => localStorage.getItem(window.BPCQuiz.key))).not.toBeNull();
});

test('запрет запоминать оси: выбор не попадает в хранилище', async ({ page }) => {
  await open(page, '#compass');
  await page.evaluate(() => window.BPCSettings.set({ rememberAxes: false }));
  await page.locator('#swapAxes').click();
  expect(await page.evaluate(() => [localStorage.getItem('bpc-ax'), localStorage.getItem('bpc-ay')])).toEqual([null, null]);
});

test('шрифты Google подключаются только с разрешения', async ({ page }) => {
  await open(page);
  await expect(page.locator('link#bpcFonts')).toHaveCount(1);
  await page.evaluate(() => window.BPCSettings.set({ webFonts: false }));
  await expect(page.locator('link[href^="https://fonts.g"]')).toHaveCount(0);
  await page.reload();
  await page.waitForFunction(() => window.BPCSettings);
  await expect(page.locator('link[href^="https://fonts.g"]')).toHaveCount(0);
});

/* ---------- Новые пасхалки ---------- */
test('дранікі, бульба и купалле находятся с клавиатуры', async ({ page }) => {
  await open(page);
  await page.waitForFunction(() => window.BPCFun);
  await typeKeys(page, 'драники');
  await expect.poll(() => found(page)).toContain('draniki');
  await page.keyboard.type('bulba');
  await expect.poll(() => found(page)).toContain('bulba');
  await typeKeys(page, 'купалле');
  await expect.poll(() => found(page)).toContain('vyanok');
});

test('три нажатия в центр компаса — саламяны павук', async ({ page }) => {
  await open(page, '#compass');
  const plane = page.locator('#plane');
  await plane.scrollIntoViewIfNeeded();
  const b = await plane.boundingBox();
  const center = { x: b.width / 2, y: b.height / 2 };
  for (let i = 0; i < 2; i++) await plane.click({ position: center });
  expect(await found(page)).not.toContain('pavuk');
  await plane.click({ position: center });
  await expect.poll(() => found(page)).toContain('pavuk');
});

test('нажатия мимо центра павука не зовут', async ({ page }) => {
  await open(page, '#compass');
  const plane = page.locator('#plane');
  await plane.scrollIntoViewIfNeeded();
  const b = await plane.boundingBox();
  for (let i = 0; i < 3; i++) await plane.click({ position: { x: b.width * 0.8, y: b.height * 0.8 } });
  expect(await found(page)).not.toContain('pavuk');
});

/* ---------- Реклама и стекло ---------- */
test('блок RuPolitCompass: подписан как проект автора, ссылка безопасна', async ({ page }) => {
  await open(page);
  const promo = page.locator('.promo');
  await expect(promo).toBeVisible();
  await expect(promo).toContainText('Другой проект автора');
  const link = promo.locator('a');
  await expect(link).toHaveAttribute('href', 'https://rupolitcompass.website/');
  await expect(link).toHaveAttribute('rel', /noopener/);
  await expect(link).toHaveAttribute('rel', /noreferrer/);
});

test('Sand-Blasted Glass: у стекла есть зерно и размытие, при контрасте оно сплошное', async ({ page }) => {
  await open(page, '#compass');
  const glass = () =>
    page.evaluate(() => {
      const cs = getComputedStyle(document.querySelector('.compass-panel.glass'));
      return { img: cs.backgroundImage, blur: cs.backdropFilter };
    });
  let g = await glass();
  expect(g.img).toContain('data:image/svg+xml');
  expect(g.blur).toContain('blur');
  await page.evaluate(() => window.BPCSettings.set({ contrast: 'high' }));
  g = await glass();
  expect(g.img).toBe('none');
  expect(g.blur).toBe('none');
});
