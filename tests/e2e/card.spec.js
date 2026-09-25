// Карточка партии: открытие, листание, закрытие, фокус
const { test, expect, open, currentTab } = require('./fixtures');

test('строка списка открывает карточку, список скрывается, фокус на заголовке', async ({ page }) => {
  await open(page, '#compass');
  await page.locator('.pcard[data-id="kpb"]').click();
  await expect(page.locator('#partyDetail')).toBeVisible();
  await expect(page.locator('#flipFront')).toBeHidden();
  await expect(page.locator('.pd__name')).toHaveText('КПБ');
  await expect(page.locator('.pd__name')).toBeFocused();
  await expect(page.locator('.pd__pos')).toHaveText('2 / 14');
  await expect(page.locator('.axisrow')).toHaveCount(4);
  await expect(page.locator('.near__item')).toHaveCount(3);
});

test('листание стрелками в карточке и кнопками', async ({ page }) => {
  await open(page, '#compass');
  await page.locator('.pcard[data-id="br"]').click();
  await page.locator('[data-act="next"]').click();
  await expect(page.locator('.pd__name')).toHaveText('КПБ');
  await page.locator('[data-act="prev"]').click();
  await page.locator('[data-act="prev"]').click();
  await expect(page.locator('.pd__pos')).toHaveText('14 / 14');
  await page.locator('.pd__name').focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('.pd__pos')).toHaveText('1 / 14');
});

test('Esc закрывает карточку и возвращает фокус в список', async ({ page }) => {
  await open(page, '#compass');
  await page.locator('.pcard[data-id="ldpb"]').click();
  await page.keyboard.press('Escape');
  await expect(page.locator('#flipFront')).toBeVisible();
  await expect(page.locator('#partyDetail')).toBeHidden();
  await expect(page.locator('.pcard[data-id="ldpb"]')).toBeFocused();
});

test('кнопка «Все партии» возвращает к списку', async ({ page }) => {
  await open(page, '#compass');
  await page.locator('.pcard[data-id="br"]').click();
  await page.locator('.pd__back').click();
  await expect(page.locator('#flipFront')).toBeVisible();
});

test('стрелки не листают карточку, если открыта другая вкладка', async ({ page }) => {
  await open(page, '#compass');
  await page.locator('.pcard[data-id="br"]').click();
  await page.locator('#tab-analytics').click();
  await page.locator('body').press('ArrowRight');
  await page.locator('#tab-compass').click();
  await expect(page.locator('.pd__name')).toHaveText('Белая Русь');
});

test('фильтр «Действуют»: 4 партии, листание только среди них', async ({ page }) => {
  await open(page, '#compass');
  await page.locator('#statusFilter [data-filter="active"]').click();
  await expect(page.locator('#statusFilter [data-filter="active"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#partyCount')).toHaveText('4');
  await expect(page.locator('.pcard-li:not(.is-hidden)')).toHaveCount(4);
  await expect(page.locator('.pcard-li.is-hidden .pcard')).toHaveCount(10);
  await expect(page.locator('.pcard-li.is-hidden .pcard').first()).toHaveAttribute('tabindex', '-1');
  await page.locator('.pcard[data-id="rpts"]').click();
  await expect(page.locator('.pd__pos')).toHaveText('4 / 4');
  await page.locator('[data-act="next"]').click();
  await expect(page.locator('.pd__name')).toHaveText('Белая Русь');
});

test('ближайшая партия в карточке открывается по нажатию', async ({ page }) => {
  await open(page, '#compass');
  await page.locator('.pcard[data-id="bnf"]').click();
  const first = page.locator('.near__item').first();
  const id = await first.getAttribute('data-go');
  await first.click();
  await expect(page.locator('#flip .pdot, .pd__name')).not.toHaveCount(0);
  const name = await page.evaluate((id) => window.BPC.parties.find((p) => p.id === id).short, id);
  await expect(page.locator('.pd__name')).toHaveText(name);
});

test('после переворота не остаётся 3D-преобразований (иначе ломается прокрутка)', async ({ page }) => {
  await open(page, '#compass');
  await page.evaluate(() => window.BPCSettings.set({ motion: 'full' }));
  await page.locator('.pcard[data-id="br"]').click();
  await expect(page.locator('#flip')).not.toHaveClass(/is-3d/, { timeout: 3000 });
  const t = await page.evaluate(() => getComputedStyle(document.querySelector('#flipInner')).transformStyle);
  expect(t).toBe('flat');
  await page.locator('.pd__back').click();
  await expect(page.locator('#flip')).not.toHaveClass(/is-3d/, { timeout: 3000 });
  await expect(page.locator('#partyDetail')).toBeHidden();
});

test('партия из другой вкладки открывается на компасе', async ({ page }) => {
  await open(page, '#analytics');
  await page.locator('#hemiLegend [data-g="rpts"]').click();
  expect(await currentTab(page)).toBe('compass');
  await expect(page.locator('.pd__name')).toHaveText('РПТС');
});

test('точка мини-компаса на главной открывает карточку', async ({ page }) => {
  await open(page);
  await page.locator('#heroPlane .mdot[data-id="kkp"]').click();
  expect(await currentTab(page)).toBe('compass');
  await expect(page.locator('.pd__name')).toHaveText('ККП–БНФ');
});
