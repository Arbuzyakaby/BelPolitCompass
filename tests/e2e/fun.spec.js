// Alpha 0.5: пасхалки с народными символами, физика и подсказка о теме системы
const { test, expect, open } = require('./fixtures');

const found = (page) => page.evaluate(() => window.BPCFun.found());

// Playwright вводит кириллицу через insertText, без keydown. У человека с русской
// раскладкой keydown приходит с e.key = 'б' — так и отправляем.
const typeKeys = (page, word, target = 'body') =>
  page.evaluate(
    ([w, sel]) => {
      const el = document.querySelector(sel);
      for (const key of w) el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
    },
    [word, target]
  );

async function openSecrets(page) {
  await page.locator('#settingsBtn').click();
  await page.locator('#stab-data').click();
  await expect(page.locator('#eggList')).toBeVisible();
}

test('модуль загружен, коллекция секретов пуста', async ({ page }) => {
  await open(page);
  await page.waitForFunction(() => window.BPCFun);
  expect(await found(page)).toEqual([]);
  await openSecrets(page);
  await expect(page.locator('#eggList .egg')).toHaveCount(6);
  await expect(page.locator('#eggList .egg.is-found')).toHaveCount(0);
  await expect(page.locator('#eggStatus')).toContainText('Найдено: 0 из 6');
  await expect(page.locator('#eggStatus')).toContainText('Подсказка:');
});

test('«бусел», набранный на клавиатуре, находит аиста', async ({ page }) => {
  await open(page);
  await page.waitForFunction(() => window.BPCFun);
  await typeKeys(page, 'бусел');
  await expect.poll(() => found(page)).toEqual(['busel']);
  await expect(page.locator('.fun-toast')).toHaveClass(/is-on/);
  await expect(page.locator('.fun-toast')).toContainText('Бусел');
  await expect(page.locator('.fun-toast')).toContainText('1 из 6');
  await expect(page.locator('#announcer')).toContainText('Секрет найден: Бусел');
  // Сохраняется между визитами
  await page.reload();
  await page.waitForFunction(() => window.BPCFun);
  expect(await found(page)).toEqual(['busel']);
});

test('латиницей тоже работает: «zubr» зовёт зубра', async ({ page }) => {
  await open(page);
  await page.waitForFunction(() => window.BPCFun);
  await page.keyboard.type('zubr');
  await expect.poll(() => found(page)).toEqual(['zubr']);
});

test('слово в поле ввода и при открытых настройках не засчитывается', async ({ page }) => {
  await open(page);
  await page.waitForFunction(() => window.BPCFun);
  await page.evaluate(() => {
    const i = document.createElement('input');
    i.id = 'probe';
    document.body.appendChild(i);
  });
  await typeKeys(page, 'бусел', '#probe');
  await page.locator('#probe').pressSequentially('zubr');
  await page.locator('#settingsBtn').click();
  await page.keyboard.type('zubr');
  expect(await found(page)).toEqual([]);
});

test('семь нажатий на логотип — васильки', async ({ page }) => {
  await open(page);
  await page.waitForFunction(() => window.BPCFun);
  const brand = page.locator('#nav .brand');
  for (let i = 0; i < 6; i++) await brand.click();
  expect(await found(page)).toEqual([]);
  await brand.click();
  await expect.poll(() => found(page)).toEqual(['vasilki']);
});

test('орнамент в подвале — кнопка: меняет узор мышью и с клавиатуры', async ({ page }) => {
  await open(page);
  await page.waitForFunction(() => window.BPCFun);
  const orn = page.locator('.footer .ornament');
  await expect(orn).toHaveAttribute('aria-label', /рушника/);
  await orn.click();
  await expect(orn).toHaveAttribute('data-pattern', '1');
  await expect.poll(() => found(page)).toEqual(['rushnik']);
  await orn.focus();
  await page.keyboard.press('Enter');
  await expect(orn).toHaveAttribute('data-pattern', '2');
  await page.keyboard.press('Space');
  await expect(orn).toHaveAttribute('data-pattern', '0');
});

test('папараць-кветка расцветает в конце «Истории»', async ({ page }) => {
  await open(page, '#timeline');
  const fern = page.locator('#timeline .fern');
  await expect(fern).toHaveCount(1);
  await fern.click();
  await expect(fern).toHaveClass(/is-bloom/);
  await expect(fern).toHaveAttribute('aria-label', 'Папараць-кветка расцвела');
  await expect.poll(() => found(page)).toEqual(['paparac']);
});

test('лён прорастает, когда тест пройден до конца, но не после перезагрузки', async ({ page }) => {
  await open(page, '#quiz');
  await page.locator('[data-act="start"]').click();
  const n = await page.evaluate(() => window.BPC.quiz.questions.length);
  for (let i = 0; i < n; i++) await page.keyboard.press('3');
  await expect(page.locator('.qz-result h3')).toBeVisible();
  await expect.poll(() => found(page)).toEqual(['lyon']);
  // Готовый результат после перезагрузки — не повод показывать находку снова
  await page.reload();
  await page.waitForFunction(() => window.BPCFun);
  await expect(page.locator('.qz-result h3')).toBeVisible();
  await expect(page.locator('.fun-toast')).toHaveCount(0);
});

test('коллекция в настройках: найденные символы, подсказка к следующему, все найдены', async ({ page }) => {
  await open(page);
  await page.waitForFunction(() => window.BPCFun);
  await page.evaluate(() => window.BPCFun.discover('vasilki'));
  await openSecrets(page);
  await expect(page.locator('#eggList .egg.is-found')).toHaveCount(1);
  await expect(page.locator('#eggList .egg.is-found')).toContainText('Васількі');
  await expect(page.locator('#eggStatus')).toContainText('Найдено: 1 из 6');
  // Подсказка — к первому ещё не найденному символу (аист)
  await expect(page.locator('#eggStatus')).toContainText('аиста');
  await expect(page.locator('#dataStatus')).toContainText('найденные секреты');
  await page.evaluate(() => window.BPCFun.eggs.forEach((id) => window.BPCFun.discover(id)));
  await expect(page.locator('#eggList .egg.is-found')).toHaveCount(6);
  await expect(page.locator('#eggStatus')).toContainText('Найдены все 6 секретов');
});

test('повторная находка не дублируется', async ({ page }) => {
  await open(page);
  await page.waitForFunction(() => window.BPCFun);
  await page.evaluate(() => {
    window.BPCFun.discover('zubr');
    window.BPCFun.discover('zubr');
  });
  expect(await found(page)).toEqual(['zubr']);
  expect(await page.evaluate(() => localStorage.getItem('bpc-eggs'))).toBe('["zubr"]');
});

test('«Удалить все данные сайта» стирает и найденные секреты', async ({ page }) => {
  await open(page);
  await page.waitForFunction(() => window.BPCFun);
  await page.evaluate(() => window.BPCFun.discover('busel'));
  await openSecrets(page);
  const del = page.locator('[data-set="all"]');
  await del.click();
  await Promise.all([page.waitForEvent('load'), del.click()]);
  await page.waitForFunction(() => window.BPCFun);
  expect(await found(page)).toEqual([]);
});

test('испорченная запись о секретах не ломает сайт', async ({ page }) => {
  await open(page);
  await page.evaluate(() => localStorage.setItem('bpc-eggs', '{oops'));
  await page.reload();
  await page.waitForFunction(() => window.BPCFun);
  expect(await found(page)).toEqual([]);
  await page.evaluate(() => localStorage.setItem('bpc-eggs', '["zubr","nope"]'));
  expect(await found(page)).toEqual(['zubr']);
});

test.describe('без анимаций', () => {
  test('секрет засчитывается, но ничего не летает', async ({ page }) => {
    await open(page);
    await page.waitForFunction(() => window.BPCFun);
    await page.evaluate(() => {
      window.BPCFun.vasilki();
      window.BPCFun.busel();
      window.BPCFun.zubr();
      window.BPCFun.lyon();
    });
    expect((await found(page)).sort()).toEqual(['busel', 'lyon', 'vasilki', 'zubr']);
    await expect(page.locator('.fun-layer')).toHaveCount(0);
    // Пружинная плавность для CSS всё равно задана (если браузер знает linear())
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--spring'))).toMatch(/^linear\(0/);
  });
});

test.describe('полные анимации', () => {
  test.use({ prefs: { motion: 'full' } });

  test('васильки падают и слой убирается сам', async ({ page }) => {
    await open(page);
    await page.waitForFunction(() => window.BPCFun);
    await page.evaluate(() => window.BPCFun.vasilki());
    await expect(page.locator('.fun-rain')).toHaveCount(1);
    await expect(page.locator('.fun-rain .fun-flower').first()).toBeAttached();
    await expect(page.locator('.fun-rain')).toHaveCount(0, { timeout: 8000 });
  });

  test('аист, зубр и лён показываются в своих слоях', async ({ page }) => {
    await open(page);
    await page.waitForFunction(() => window.BPCFun);
    await page.evaluate(() => {
      window.BPCFun.busel();
      window.BPCFun.zubr();
      window.BPCFun.lyon();
    });
    await expect(page.locator('.fun-sky .fun-busel')).toHaveCount(1);
    await expect(page.locator('.fun-ground .fun-zubr')).toHaveCount(1);
    await expect(page.locator('.fun-field .fun-flax').first()).toBeAttached();
    for (const l of await page.locator('.fun-layer').all()) await expect(l).toHaveAttribute('aria-hidden', 'true');
  });

  test('стрелка в логотипе качается и успокаивается', async ({ page }) => {
    await open(page);
    await page.waitForFunction(() => window.BPCFun);
    await page.evaluate(() => window.BPCFun.kickNeedles(900));
    await expect.poll(() => page.evaluate(() => document.querySelector('#nav .brand__mark svg').style.rotate)).not.toBe('');
    await expect.poll(() => page.evaluate(() => document.querySelector('#nav .brand__mark svg').style.rotate), { timeout: 10000 }).toBe('');
  });

  test('оттянутая точка мини-компаса пружинит назад и не открывает карточку', async ({ page, isMobile }) => {
    test.skip(isMobile, 'мышью — на компьютере; пальцем проверяется вручную');
    await open(page);
    const dot = page.locator('#heroPlane .mdot').first();
    await dot.scrollIntoViewIfNeeded();
    const b = await dot.boundingBox();
    const x = b.x + b.width / 2;
    const y = b.y + b.height / 2;
    const tab = await page.evaluate(() => document.documentElement.dataset.tab);
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 60, y + 10, { steps: 8 });
    await expect(dot).toHaveClass(/is-pulled/);
    const pulled = await dot.evaluate((el) => el.style.translate);
    // Резинка: тянули на 60 px, а точка ушла меньше предела в 38 px
    const dx = parseFloat(pulled);
    expect(dx).toBeGreaterThan(10);
    expect(dx).toBeLessThan(38);
    await page.mouse.up();
    await expect(dot).not.toHaveClass(/is-pulled/, { timeout: 4000 });
    expect(await dot.evaluate((el) => el.style.translate)).toBe('');
    await page.waitForTimeout(200);
    expect(await page.evaluate(() => document.documentElement.dataset.tab)).toBe(tab);
  });
});

test.describe('подсказка о теме системы', () => {
  test('следит за темой ОС и выбором в настройках', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await open(page);
    await page.locator('#settingsBtn').click();
    const hint = page.locator('#themeSys');
    await expect(hint).toHaveText('Сейчас в системе тёмная тема — сайт следует за ней и переключится сам');
    await page.emulateMedia({ colorScheme: 'light' });
    await expect(hint).toHaveText('Сейчас в системе светлая тема — сайт следует за ней и переключится сам');
    await page.locator('input[name="theme"][value="dark"] + span').click();
    await expect(hint).toHaveText('В системе сейчас светлая тема, но выбрана тёмная — она важнее');
  });
});
