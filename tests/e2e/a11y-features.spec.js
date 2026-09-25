// Раздел «Специальные возможности»
const { test, expect, open } = require('./fixtures');

const openA11y = async (page) => {
  await page.evaluate(() => window.BPCSettings.open('a11y'));
  await expect(page.locator('#spane-a11y')).toBeVisible();
};
const toggle = (page, name) => page.locator(`.set-toggle:has(input[name="${name}"])`).click();

const TOGGLES = {
  font: ['data-font', 'readable'],
  spacing: ['data-spacing', 'on'],
  underline: ['data-underline', 'on'],
  cursor: ['data-cursor', 'big'],
  cvd: ['data-cvd', 'on'],
  guide: ['data-guide', 'on'],
  tts: ['data-tts', 'on'],
  tables: ['data-tables', 'on'],
  targets: ['data-targets', 'big'],
  focus: ['data-focus', 'strong'],
};

for (const [name, [attr, value]] of Object.entries(TOGGLES)) {
  test(`переключатель «${name}» включает и выключает ${attr}`, async ({ page }) => {
    await open(page);
    await openA11y(page);
    await toggle(page, name);
    await expect(page.locator('html')).toHaveAttribute(attr, value);
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('bpc-settings')));
    expect(saved[name]).toBe(name === 'font' ? 'readable' : true);
    await toggle(page, name);
    await expect(page.locator('html')).not.toHaveAttribute(attr, /./);
  });
}

test('автопереход в тесте выключается', async ({ page }) => {
  await open(page);
  await openA11y(page);
  await expect(page.locator('input[name="autoNext"]')).toBeChecked();
  await toggle(page, 'autoNext');
  await expect(page.locator('html')).toHaveAttribute('data-autonext', 'off');
});

test('максимальный контраст: чёрное на белом и белое на чёрном', async ({ page }) => {
  await open(page);
  await openA11y(page);
  await page.locator('input[name="contrast"][value="max"] + span').click();
  await expect(page.locator('html')).toHaveAttribute('data-contrast', 'max');
  const light = await page.evaluate(() => [getComputedStyle(document.body).backgroundColor, getComputedStyle(document.body).color]);
  expect(light).toEqual(['rgb(255, 255, 255)', 'rgb(0, 0, 0)']);
  await page.evaluate(() => window.BPCSettings.set({ theme: 'dark' }));
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe('rgb(0, 0, 0)');
});

test('удобочитаемый шрифт и увеличенные интервалы меняют текст', async ({ page }) => {
  await open(page);
  await page.evaluate(() => window.BPCSettings.set({ font: 'readable', spacing: true }));
  const st = await page.evaluate(() => {
    const cs = getComputedStyle(document.querySelector('.hero__lead'));
    return { family: cs.fontFamily, letter: cs.letterSpacing, word: cs.wordSpacing };
  });
  expect(st.family).toMatch(/Verdana/);
  expect(parseFloat(st.letter)).toBeGreaterThan(0);
  expect(parseFloat(st.word)).toBeGreaterThan(0);
});

test('подчёркнутые ссылки', async ({ page }) => {
  await open(page);
  await page.evaluate(() => window.BPCSettings.set({ underline: true }));
  const deco = await page.evaluate(() => getComputedStyle(document.querySelector('.hero__cta .link-arrow')).textDecorationLine);
  expect(deco).toBe('underline');
});

test('крупный курсор задаётся картинкой', async ({ page }) => {
  await open(page);
  await page.evaluate(() => window.BPCSettings.set({ cursor: true }));
  const cur = await page.evaluate(() => [getComputedStyle(document.body).cursor, getComputedStyle(document.querySelector('.btn')).cursor]);
  expect(cur[0]).toMatch(/url\(/);
  expect(cur[1]).toMatch(/url\(.*pointer/);
});

test('заметная рамка фокуса — жёлтая, толщиной 3 px', async ({ page }) => {
  await open(page);
  await page.evaluate(() => window.BPCSettings.set({ focus: true }));
  await page.locator('#tab-home').focus();
  await page.keyboard.press('ArrowRight');
  const o = await page.evaluate(() => {
    const cs = getComputedStyle(document.activeElement);
    return [cs.outlineWidth, cs.outlineColor];
  });
  expect(o).toEqual(['3px', 'rgb(255, 191, 0)']);
});

test('крупные кнопки: все кнопки на вкладке «Компас» не меньше 44 px', async ({ page }) => {
  await open(page, '#compass');
  await page.evaluate(() => window.BPCSettings.set({ targets: true }));
  const small = await page.evaluate(() =>
    Array.from(document.querySelectorAll('#compass button, .nav button, #compass .switch'))
      .filter((b) => {
        const r = b.getBoundingClientRect();
        return r.width && r.height && !b.closest('.pdot, .dd__list') && r.height < 43.5;
      })
      .map((b) => b.className + ' ' + Math.round(b.getBoundingClientRect().height))
  );
  expect(small).toEqual([]);
});

test('палитра для дальтоников меняет цвета партий', async ({ page }) => {
  await open(page, '#compass');
  const color = () => page.evaluate(() => getComputedStyle(document.querySelector('.pdot[data-id="br"] .pdot__core')).backgroundColor);
  const before = await color();
  await page.evaluate(() => window.BPCSettings.set({ cvd: true }));
  const after = await color();
  expect(after).not.toBe(before);
  expect(after).toBe('rgb(0, 114, 178)');
});

test('линейка для чтения появляется и следует за курсором', async ({ page }) => {
  await open(page);
  await expect(page.locator('.reading-guide')).toBeHidden();
  await page.evaluate(() => window.BPCSettings.set({ guide: true }));
  await expect(page.locator('.reading-guide')).toBeVisible();
  await page.mouse.move(100, 300);
  await expect.poll(() => page.evaluate(() => document.querySelector('.reading-guide').style.transform)).toBe('translateY(300px)');
});

test('озвучивание читает вопрос теста и карточку партии', async ({ page }) => {
  // Подменяем синтез речи: записываем, что было бы произнесено
  await page.addInitScript(() => {
    window.__spoken = [];
    window.SpeechSynthesisUtterance = function (t) {
      this.text = t;
    };
    Object.defineProperty(window, 'speechSynthesis', {
      value: {
        speaking: false,
        getVoices: () => [{ lang: 'ru-RU', name: 'Тест' }],
        speak(u) {
          window.__spoken.push(u.text);
          this.speaking = true;
        },
        cancel() {
          this.speaking = false;
        },
      },
    });
  });
  await open(page, '#quiz');
  await page.evaluate(() => window.BPCSettings.set({ tts: true }));
  await expect(page.locator('.tts-fab')).toBeVisible();
  await page.locator('[data-act="start"]').click();
  await page.locator('.qz-qrow .tts-btn').click();
  const q = await page.locator('#qzQ').textContent();
  expect(await page.evaluate(() => window.__spoken.join(' '))).toContain(q);
  await page.evaluate(() => (window.__spoken = []));
  await page.locator('#tab-compass').click();
  await page.locator('.pcard[data-id="br"]').click();
  await page.locator('.pd__bar .tts-btn').click();
  const spoken = await page.evaluate(() => window.__spoken.join(' '));
  expect(spoken).toContain('Белая Русь');
  expect(spoken).toContain('Ольга Чемоданова');
  // Пока звучит карточка, плавающая кнопка работает как «Остановить»
  await expect(page.locator('.tts-fab')).toHaveText(/Остановить/);
  await page.locator('.tts-fab').click();
  await expect(page.locator('.tts-fab')).toHaveText(/Прочитать/);
  // Повторное нажатие читает всю открытую вкладку
  await page.evaluate(() => (window.__spoken = []));
  await page.locator('.tts-fab').click();
  await expect(page.locator('.tts-fab')).toHaveText(/Остановить/);
  expect(await page.evaluate(() => window.__spoken.join(' '))).toContain('Кто где стоит');
});

test('если браузер не умеет читать вслух, переключатель честно недоступен', async ({ page }) => {
  await page.addInitScript(() => {
    delete window.speechSynthesis;
    delete window.SpeechSynthesisUtterance;
  });
  await open(page);
  await openA11y(page);
  await expect(page.locator('input[name="tts"]')).toBeDisabled();
  await expect(page.locator('#ttsNote')).toContainText('не умеет читать');
});

test('таблицы данных раскрываются под всеми диаграммами', async ({ page }) => {
  await open(page, '#analytics');
  const tables = page.locator('#analytics .data-table');
  expect(await tables.count()).toBeGreaterThanOrEqual(4);
  for (const t of await tables.all()) await expect(t).not.toHaveAttribute('open', '');
  await page.evaluate(() => window.BPCSettings.set({ tables: true }));
  for (const t of await tables.all()) await expect(t).toHaveAttribute('open', '');
});

test('профиль «Слабое зрение» включает набор настроек и отмечается нажатым', async ({ page }) => {
  await open(page);
  await openA11y(page);
  const preset = page.locator('[data-preset="vision"]');
  await preset.click();
  await expect(preset).toHaveAttribute('aria-pressed', 'true');
  const html = page.locator('html');
  await expect(html).toHaveAttribute('data-fs', 'xl');
  await expect(html).toHaveAttribute('data-contrast', 'max');
  await expect(html).toHaveAttribute('data-focus', 'strong');
  await expect(html).toHaveAttribute('data-cursor', 'big');
  await expect(page.locator('#setMsg')).toContainText('Слабое зрение');
  await expect(page.locator('input[name="contrast"][value="max"]')).toBeChecked();
});

for (const id of ['dyslexia', 'motor', 'screenreader', 'calm', 'simple']) {
  test(`профиль «${id}» применяется без ошибок`, async ({ page }) => {
    await open(page);
    // Тесты начинаются с motion: 'off' — это уже профиль «Без движения»
    if (id === 'calm') await page.evaluate(() => window.BPCSettings.set({ motion: 'reduced' }));
    await openA11y(page);
    await page.locator(`[data-preset="${id}"]`).click();
    await expect(page.locator(`[data-preset="${id}"]`)).toHaveAttribute('aria-pressed', 'true');
    const expected = await page.evaluate((id) => window.BPCBoot.PRESETS[id].set, id);
    const prefs = await page.evaluate(() => window.BPCSettings.prefs);
    for (const [k, v] of Object.entries(expected)) expect(prefs[k]).toBe(v);
  });
}

// Alpha 0.5.1: раньше повторное нажатие оставляло профиль включённым
for (const id of ['vision', 'dyslexia', 'motor', 'screenreader', 'calm', 'simple']) {
  test(`профиль «${id}» выключается повторным нажатием и возвращает настройки`, async ({ page }) => {
    await open(page);
    if (id === 'calm') await page.evaluate(() => window.BPCSettings.set({ motion: 'reduced' }));
    await openA11y(page);
    const before = await page.evaluate(() => window.BPCSettings.prefs);
    const preset = page.locator(`[data-preset="${id}"]`);
    await preset.click();
    await expect(preset).toHaveAttribute('aria-pressed', 'true');
    await preset.click();
    await expect(preset).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('#setMsg')).toContainText('выключен');
    expect(await page.evaluate(() => window.BPCSettings.prefs)).toEqual(before);
  });
}

test('выключение профиля возвращает значения, выбранные до него', async ({ page }) => {
  await open(page);
  await page.evaluate(() => window.BPCSettings.set({ fs: 'xxl', contrast: 'high' }));
  await openA11y(page);
  const preset = page.locator('[data-preset="vision"]');
  await preset.click();
  await expect(page.locator('html')).toHaveAttribute('data-fs', 'xl');
  await preset.click();
  const html = page.locator('html');
  await expect(html).toHaveAttribute('data-fs', 'xxl');
  await expect(html).toHaveAttribute('data-contrast', 'high');
  await expect(page.locator('input[name="contrast"][value="high"]')).toBeChecked();
});

test('сброс после профиля возвращает и размер текста, и анимации, и упрощённый режим', async ({ page }) => {
  await open(page);
  await openA11y(page);
  await page.locator('[data-preset="simple"]').click();
  await page.locator('[data-preset="motor"]').click();
  await page.locator('[data-set="a11y"]').click();
  const html = page.locator('html');
  await expect(html).not.toHaveAttribute('data-fs', /./);
  await expect(html).not.toHaveAttribute('data-simple', /./);
  await expect(html).not.toHaveAttribute('data-autonext', /./);
  await expect(page.locator('[data-preset][aria-pressed="true"]')).toHaveCount(0);
  const prefs = await page.evaluate(() => window.BPCSettings.prefs);
  expect(prefs.motion).toBe('system');
});

test('«Сбросить специальные возможности» не трогает тему и упрощённый режим', async ({ page }) => {
  await open(page);
  await page.evaluate(() => window.BPCSettings.set({ theme: 'dark', simple: true, contrast: 'max', targets: true, font: 'readable' }));
  await openA11y(page);
  await page.locator('[data-set="a11y"]').click();
  const html = page.locator('html');
  await expect(html).toHaveAttribute('data-theme', 'dark');
  await expect(html).toHaveAttribute('data-simple', 'on');
  await expect(html).not.toHaveAttribute('data-contrast', /./);
  await expect(html).not.toHaveAttribute('data-targets', /./);
  await expect(html).not.toHaveAttribute('data-font', /./);
});

test('все настройки спецвозможностей вместе не ломают вёрстку', async ({ page }) => {
  await open(page);
  await page.evaluate(() =>
    window.BPCSettings.set({ fs: 'xxl', contrast: 'max', font: 'readable', spacing: true, underline: true, targets: true, simple: true, tables: true })
  );
  for (const tab of ['home', 'compass', 'quiz', 'analytics', 'about']) {
    await page.locator('#tab-' + tab).click();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    expect(overflow, tab).toBeLessThanOrEqual(0);
  }
});
