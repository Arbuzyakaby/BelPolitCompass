// Компас: оси, переключатели, точки как кнопки
const { test, expect, open } = require('./fixtures');

test('точки партий — кнопки с понятными подписями', async ({ page }) => {
  await open(page, '#compass');
  const br = page.locator('.pdot[data-id="br"]');
  await expect(br).toHaveJSProperty('tagName', 'BUTTON');
  await expect(br).toHaveAttribute('aria-label', /Белорусская партия «Белая Русь»\. Вектор −6, власть \+9\. 51 мандат/);
  await expect(page.locator('.pdot--me')).toHaveAttribute('aria-hidden', 'true');
});

test('выбор оси по горизонтали меняет подписи и сохраняется после перезагрузки', async ({ page }) => {
  await open(page, '#compass');
  await page.locator('#ddXBtn').click();
  await expect(page.locator('#ddXList')).toBeVisible();
  await page.locator('#ddX-economy').click();
  await expect(page.locator('#ddXBtn .dd__val')).toHaveText('Экономическая модель');
  await expect(page.locator('#lblLeft')).toHaveText('Госсектор');
  await expect(page.locator('#lblRight')).toHaveText('Рынок');
  await page.reload();
  await expect(page.locator('#ddXBtn .dd__val')).toHaveText('Экономическая модель');
});

test('если выбрать ось, занятую по вертикали, оси меняются местами', async ({ page }) => {
  await open(page, '#compass');
  await page.locator('#ddXBtn').click();
  await page.locator('#ddX-power').click();
  await expect(page.locator('#ddXBtn .dd__val')).toHaveText('Модель власти');
  await expect(page.locator('#ddYBtn .dd__val')).toHaveText('Геополитический вектор');
});

test('выпадающий список работает с клавиатуры', async ({ page }) => {
  await open(page, '#compass');
  await page.locator('#ddYBtn').focus();
  await page.keyboard.press('ArrowDown');
  await expect(page.locator('#ddY')).toHaveClass(/is-open/);
  await page.keyboard.press('End');
  await page.keyboard.press('Enter');
  await expect(page.locator('#ddYBtn .dd__val')).toHaveText('Идентичность');
  await expect(page.locator('#ddYBtn')).toBeFocused();
  await expect(page.locator('#lblTop')).toHaveText('Национальная');
});

test('кнопка «Поменять оси местами»', async ({ page }) => {
  await open(page, '#compass');
  await page.locator('#swapAxes').click();
  await expect(page.locator('#lblTop')).toHaveText('Запад');
  await expect(page.locator('#lblRight')).toHaveText('Вертикаль');
});

test('переключатель «Недействующие» прячет 10 закрытых партий', async ({ page }) => {
  await open(page, '#compass');
  await expect(page.locator('.pdot:not(.pdot--me):not(.is-off)')).toHaveCount(14);
  await page.locator('label:has(#toggleInactive)').click();
  await expect(page.locator('.pdot:not(.pdot--me):not(.is-off)')).toHaveCount(4);
  await expect(page.locator('.pdot[data-id="bnf"]')).toHaveAttribute('tabindex', '-1');
});

test('переключатель «Лагеря» прячет оболочки', async ({ page }) => {
  await open(page, '#compass');
  await expect(page.locator('#hulls')).not.toHaveClass(/is-hidden/);
  await page.locator('label:has(#toggleHulls)').click();
  await expect(page.locator('#hulls')).toHaveClass(/is-hidden/);
});

test('подсказка появляется при фокусе на точке', async ({ page }) => {
  await open(page, '#compass');
  await page.locator('.pdot[data-id="kpb"]').focus();
  await expect(page.locator('#tooltip')).toHaveClass(/is-on/);
  await expect(page.locator('#tooltip')).toContainText('КПБ');
});

test('Enter на точке открывает карточку партии', async ({ page }) => {
  await open(page, '#compass');
  await page.locator('.pdot[data-id="ogp"]').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#partyDetail')).toBeVisible();
  await expect(page.locator('.pd__name')).toHaveText('ОГП');
});

test('точки не выходят за пределы плоскости компаса', async ({ page }) => {
  await open(page, '#compass');
  const plane = await page.locator('#plane').boundingBox();
  for (const d of await page.locator('.pdot:not(.is-off) .pdot__core').all()) {
    const b = await d.boundingBox();
    expect(b.x + b.width / 2).toBeGreaterThanOrEqual(plane.x - 1);
    expect(b.x + b.width / 2).toBeLessThanOrEqual(plane.x + plane.width + 1);
    expect(b.y + b.height / 2).toBeGreaterThanOrEqual(plane.y - 1);
    expect(b.y + b.height / 2).toBeLessThanOrEqual(plane.y + plane.height + 1);
  }
});

test('скрытые точки не проявляются, когда открыта карточка партии', async ({ page }) => {
  await open(page, '#compass');
  await page.locator('label:has(#toggleInactive)').click();
  await page.locator('.pcard[data-id="br"]').click();
  await expect(page.locator('#dots')).toHaveClass(/has-focus/);
  const visible = await page.evaluate(() =>
    Array.from(document.querySelectorAll('.pdot.is-off')).filter((d) => getComputedStyle(d).opacity !== '0').map((d) => d.dataset.id)
  );
  expect(visible).toEqual([]);
});
