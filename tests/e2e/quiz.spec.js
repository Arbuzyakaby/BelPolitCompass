// Тест «Где я на компасе»
const { test, expect, open, currentTab } = require('./fixtures');

// Ответить на все вопросы: fn(вопрос) → номер ответа 1–5
async function answerAll(page, fn) {
  const qs = await page.evaluate(() => window.BPC.quiz.questions.map((q) => ({ axis: q.axis, dir: q.dir })));
  for (const q of qs) await page.keyboard.press(String(fn(q)));
}

test('старт теста: первый вопрос, счётчик и прогресс', async ({ page }) => {
  await open(page, '#quiz');
  await page.locator('[data-act="start"]').click();
  await expect(page.locator('#qzCount')).toContainText('Вопрос 1 из 40');
  await expect(page.locator('.qz-ans')).toHaveCount(5);
  await expect(page.locator('.qz-ans').first()).toBeFocused();
  await expect(page.locator('#qzProgress')).toHaveAttribute('aria-valuenow', '0');
});

test('ответ мышью переводит к следующему вопросу', async ({ page }) => {
  await open(page, '#quiz');
  await page.locator('[data-act="start"]').click();
  await page.locator('.qz-ans[data-v="1"]').click();
  await expect(page.locator('#qzCount')).toContainText('Вопрос 2 из 40');
  await expect(page.locator('#qzProgress')).toHaveAttribute('aria-valuenow', '1');
});

test('клавиши 1–5 отвечают, Backspace возвращает назад и показывает прежний ответ', async ({ page }) => {
  await open(page, '#quiz');
  await page.locator('[data-act="start"]').click();
  await page.keyboard.press('2');
  await page.keyboard.press('5');
  await expect(page.locator('#qzCount')).toContainText('Вопрос 3 из 40');
  await page.keyboard.press('Backspace');
  await expect(page.locator('#qzCount')).toContainText('Вопрос 2 из 40');
  await expect(page.locator('.qz-ans[data-v="-2"]')).toHaveAttribute('aria-pressed', 'true');
});

test('все ответы в пользу «+»-полюсов: результат +10 по каждой оси', async ({ page }) => {
  await open(page, '#quiz');
  await page.locator('[data-act="start"]').click();
  await answerAll(page, (q) => (q.dir > 0 ? 1 : 5));
  await expect(page.locator('.qz-result h3')).toHaveText('Запад · Вертикаль · Рынок · Национальная');
  await expect(page.locator('.qz-sum .qbar__top b').first()).toContainText('+10');
  await expect(page.locator('.qz-near .near__item')).toHaveCount(3);
  await expect(page.locator('.qz-result h3')).toBeFocused();
});

test('нейтральные ответы — центр по всем осям', async ({ page }) => {
  await open(page, '#quiz');
  await page.locator('[data-act="start"]').click();
  await answerAll(page, () => 3);
  await expect(page.locator('.qz-result h3')).toHaveText('Многовекторность · Баланс властей · Смешанная экономика · Двойная идентичность');
});

test('результат совпадает с расчётом по формуле из core.js', async ({ page }) => {
  await open(page, '#quiz');
  await page.locator('[data-act="start"]').click();
  const pattern = [1, 2, 3, 4, 5, 2, 4];
  let i = 0;
  await answerAll(page, () => pattern[i++ % pattern.length]);
  const expected = await page.evaluate(() => {
    const st = JSON.parse(localStorage.getItem('bpc-quiz-v1'));
    const sc = window.BPCCore.quizScores(st.answers, window.BPC.quiz.questions, window.BPC.axes);
    const top = window.BPCCore.rank(sc, window.BPC.parties, window.BPC.axes)[0];
    return `${top.p.short}: сходство ${top.s}%`;
  });
  await expect(page.locator('.qz-result__lead')).toContainText(expected);
});

test('после теста на компасе появляется точка «Вы»', async ({ page }) => {
  await open(page, '#quiz');
  await page.locator('[data-act="start"]').click();
  await answerAll(page, (q) => (q.dir > 0 ? 2 : 4));
  await page.locator('[data-act="show"]').click();
  expect(await currentTab(page)).toBe('compass');
  await expect(page.locator('#meSwitch')).toBeVisible();
  await expect(page.locator('.pdot--me')).not.toHaveClass(/is-off/);
  await expect(page.locator('.pdot--me')).toBeFocused();
  await expect(page.locator('.pdot--me')).toHaveAttribute('aria-label', /Вы, по результату теста/);
  await page.locator('label:has(#toggleMe)').click();
  await expect(page.locator('.pdot--me')).toHaveClass(/is-off/);
});

test('прогресс сохраняется после перезагрузки', async ({ page }) => {
  await open(page, '#quiz');
  await page.locator('[data-act="start"]').click();
  for (const k of ['1', '2', '3']) await page.keyboard.press(k);
  await page.reload();
  await expect(page.locator('#qzCount')).toContainText('Вопрос 4 из 40');
});

test('«Начать заново» очищает ответы', async ({ page }) => {
  await open(page, '#quiz');
  await page.locator('[data-act="start"]').click();
  await page.keyboard.press('1');
  await page.locator('[data-act="restart"]').click();
  await expect(page.locator('#qzCount')).toContainText('Вопрос 1 из 40');
  await expect(page.locator('#qzProgress')).toHaveAttribute('aria-valuenow', '0');
});

test('клавиши 1–5 не отвечают, пока открыта другая вкладка', async ({ page }) => {
  await open(page, '#quiz');
  await page.locator('[data-act="start"]').click();
  await page.locator('#tab-method').click();
  await page.keyboard.press('1');
  await page.keyboard.press('2');
  await page.locator('#tab-quiz').click();
  await expect(page.locator('#qzCount')).toContainText('Вопрос 1 из 40');
});

test('без автоперехода: ответ не листает, кнопка «Далее» — листает', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('bpc-settings', JSON.stringify({ motion: 'off', autoNext: false })));
  await open(page, '#quiz');
  await page.locator('[data-act="start"]').click();
  const next = page.locator('[data-act="next"]');
  await expect(next).toBeVisible();
  await expect(next).toBeDisabled();
  await page.locator('.qz-ans[data-v="2"]').click();
  await expect(page.locator('#qzCount')).toContainText('Вопрос 1 из 40');
  await expect(next).toBeEnabled();
  await page.locator('.qz-ans[data-v="-1"]').click();
  await expect(page.locator('.qz-ans[data-v="-1"]')).toHaveAttribute('aria-pressed', 'true');
  await next.click();
  await expect(page.locator('#qzCount')).toContainText('Вопрос 2 из 40');
});

test('копирование результата в буфер обмена', async ({ page, context, browserName }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await open(page, '#quiz');
  await page.locator('[data-act="start"]').click();
  await answerAll(page, () => 3);
  await page.locator('[data-act="copy"]').click();
  await expect(page.locator('#qzMsg')).toHaveText(/скопирован|вручную/);
  if ((await page.locator('#qzMsg').textContent()).includes('скопирован')) {
    const text = await page.evaluate(() => navigator.clipboard.readText());
    expect(text).toContain('Мой результат в BelPolitCompass');
    expect(text.split('\n')).toHaveLength(6);
  }
});

test('испорченные сохранённые ответы не ломают тест', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('bpc-quiz-v1', '{"answers":"мусор","idx":"x"}'));
  await open(page, '#quiz');
  await expect(page.locator('[data-act="start"]')).toBeVisible();
});
