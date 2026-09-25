// Диаграммы аналитики, хронология и оси
const { test, expect, open } = require('./fixtures');

test('полукруг парламента: 110 мест, по цветам как в данных', async ({ page }) => {
  await open(page, '#analytics');
  await expect(page.locator('#hemicycle .seat')).toHaveCount(110);
  for (const [g, n] of [['br', 51], ['rpts', 8], ['kpb', 7], ['ldpb', 4], ['np', 40]]) {
    await expect(page.locator(`#hemicycle .seat[data-g="${g}"]`)).toHaveCount(n);
  }
  await expect(page.locator('#hemicycle svg')).toHaveAttribute('aria-label', /Белая Русь — 51/);
});

test('легенда полукруга — кнопки, подсветка мест при фокусе', async ({ page }) => {
  await open(page, '#analytics');
  const item = page.locator('#hemiLegend button[data-g="kpb"]');
  await item.focus();
  await expect(page.locator('#hemicycle')).toHaveClass(/has-focus/);
  await expect(page.locator('#hemicycle .seat.is-focus')).toHaveCount(7);
});

test('бублик: пять групп, проценты в сумме ≈ 100, центр меняется при фокусе', async ({ page }) => {
  await open(page, '#analytics');
  const rows = page.locator('.donut__row');
  await expect(rows).toHaveCount(5);
  const sum = await page.evaluate(() =>
    Array.from(document.querySelectorAll('.donut__row span:last-child')).reduce((s, e) => s + parseFloat(e.textContent.replace(',', '.')), 0)
  );
  expect(Math.abs(sum - 100)).toBeLessThan(0.3);
  await page.locator('button.donut__row[data-g="rpts"]').focus();
  await expect(page.locator('.donut__center b')).toHaveText('8');
  await expect(page.locator('.donut__center span')).toHaveText('РПТС');
});

test('счётчики: 51 место, 40 беспартийных, 10 закрытых партий', async ({ page }) => {
  await open(page, '#analytics');
  const nums = await page.locator('#statCards .stat__num [data-n]').allTextContents();
  expect(nums.slice(0, 3)).toEqual(['51', '40', '10']);
});

test('рейтинг по оси: вкладки ARIA, пересортировка, партия с максимумом сверху', async ({ page }) => {
  await open(page, '#analytics');
  const first = () =>
    page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('.dbar'));
      rows.sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);
      return rows[0].dataset.id;
    });
  expect(await first()).toBe('kkp'); // вектор +10
  await page.locator('#barsTab-economy').click();
  await expect(page.locator('#barsTab-economy')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#barsTab-vector')).toHaveAttribute('aria-selected', 'false');
  await expect.poll(first).toBe('psp'); // рынок +9
  await expect(page.locator('#barsSub')).toContainText('Экономическая модель');
  await page.locator('#barsTab-economy').focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#barsTab-identity')).toHaveAttribute('aria-selected', 'true');
});

test('строка рейтинга открывается с клавиатуры', async ({ page }) => {
  await open(page, '#analytics');
  await page.locator('.dbar[data-id="green"]').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.pd__name')).toHaveText('Зелёные');
});

test('радар: не больше трёх партий, самая старая уступает место', async ({ page }) => {
  await open(page, '#analytics');
  const on = page.locator('#radarChips .chip[aria-pressed="true"]');
  await expect(on).toHaveCount(3);
  await page.locator('#radarChips .chip[data-id="ogp"]').click();
  await expect(on).toHaveCount(3);
  await expect(page.locator('#radarChips .chip[data-id="br"]')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('#radarSvg')).toHaveAttribute('aria-label', /ОГП/);
  await page.locator('#radarChips .chip[data-id="ogp"]').click();
  await expect(on).toHaveCount(2);
});

test('разрыв между лагерями: четыре оси и вывод о главной линии раскола', async ({ page }) => {
  await open(page, '#analytics');
  await expect(page.locator('.gaprow')).toHaveCount(4);
  await expect(page.locator('.gap__insight')).toContainText('Главная линия раскола');
});

test('матрица близости: 14 × 14 клеток и таблица с теми же числами', async ({ page }) => {
  await open(page, '#analytics');
  await expect(page.locator('.mx-c')).toHaveCount(196);
  const cell = await page.locator('.mx-c[data-a="br"][data-b="kpb"]').getAttribute('data-s');
  const table = page.locator('.card--matrix .data-table');
  await table.locator('summary').click();
  const row = table.locator('tbody tr').first();
  await expect(row.locator('th')).toHaveText('Белая Русь');
  await expect(row.locator('td').nth(1)).toHaveText(cell);
});

test('таблица позиций: 14 партий × 4 оси, значения из данных', async ({ page }) => {
  await open(page, '#analytics');
  const t = page.locator('.card--bars .data-table');
  await t.locator('summary').click();
  await expect(t.locator('tbody tr')).toHaveCount(14);
  await expect(t.locator('tbody tr').first().locator('td')).toHaveText(['−6', '+9', '−4', '−2']);
});

test('хронология: 11 событий по порядку, заголовки — h3', async ({ page }) => {
  await open(page, '#timeline');
  await expect(page.locator('.tl__item')).toHaveCount(11);
  await expect(page.locator('.tl__item h3.tl__title').first()).toHaveText('Белорусский народный фронт');
  const years = await page.locator('.tl__year').allTextContents();
  expect(years[0]).toMatch(/^1988/);
  expect(years[years.length - 1]).toMatch(/^2025/);
});

test('оси: четыре карточки с полюсами −10 и +10', async ({ page }) => {
  await open(page, '#method');
  await expect(page.locator('.mcard')).toHaveCount(4);
  await expect(page.locator('.mpole')).toHaveCount(8);
});

test('при крупном тексте строки рейтинга не наезжают друг на друга', async ({ page }) => {
  await open(page, '#analytics');
  await page.evaluate(() => window.BPCSettings.set({ fs: 'xxl' }));
  await page.waitForTimeout(300);
  const overlap = await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('.dbar')).map((r) => r.getBoundingClientRect()).sort((a, b) => a.top - b.top);
    return rows.some((r, i) => i && r.top < rows[i - 1].bottom - 1);
  });
  expect(overlap).toBe(false);
});
