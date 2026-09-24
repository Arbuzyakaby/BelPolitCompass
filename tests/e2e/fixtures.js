// Общая обвязка сквозных тестов.
// • Каждый тест начинается с чистого localStorage (тур отмечен пройденным,
//   анимации выключены — тесты быстрее и стабильнее; всё это меняется опциями).
// • Шрифты Google блокируются: тесты не зависят от сети.
// • Любая ошибка JavaScript или в консоли валит тест.
const { test: base, expect } = require('@playwright/test');

const test = base.extend({
  prefs: [{ motion: 'off' }, { option: true }],
  tourDone: [true, { option: true }],

  page: async ({ page, prefs, tourDone }, use) => {
    const errors = [];
    await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    page.on('console', (m) => {
      if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push('console: ' + m.text());
    });
    await page.addInitScript(
      ({ prefs, tourDone }) => {
        try {
          if (sessionStorage.getItem('bpc-test-init')) return;
          sessionStorage.setItem('bpc-test-init', '1');
          localStorage.clear();
          if (tourDone) localStorage.setItem('bpc-tour', 'done');
          if (prefs) localStorage.setItem('bpc-settings', JSON.stringify(prefs));
        } catch (e) {
          /* about:blank */
        }
      },
      { prefs, tourDone }
    );
    await use(page);
    expect(errors, 'ошибки JavaScript на странице').toEqual([]);
  },
});

/* Открыть страницу и дождаться, пока все модули запустятся */
async function open(page, hash = '') {
  await page.goto('/' + hash);
  await page.waitForFunction(() => window.BPCTour && window.BPCSettings && window.BPCQuiz && window.BPCTabs);
}

/* Настоящий свайп пальцем через протокол Chromium (в тестах с hasTouch) */
async function touchDrag(page, from, to, steps = 20) {
  const cdp = await page.context().newCDPSession(page);
  const send = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts });
  await send('touchStart', [from]);
  for (let i = 1; i <= steps; i++) {
    await send('touchMove', [{ x: from.x + ((to.x - from.x) * i) / steps, y: from.y + ((to.y - from.y) * i) / steps }]);
  }
  await send('touchEnd', []);
  await cdp.detach();
  await page.waitForTimeout(250);
}

/* Свайп вверх по центру элемента: палец идёт снизу вверх — содержимое листается вниз */
async function swipeUp(page, locator, distance = 250) {
  const b = await locator.boundingBox();
  const x = b.x + b.width / 2;
  const vh = page.viewportSize().height;
  const y0 = Math.min(b.y + b.height * 0.75, vh - 20);
  const y1 = Math.max(y0 - distance, 90);
  await touchDrag(page, { x, y: y0 }, { x, y: y1 });
}

const isNarrow = (page) => page.viewportSize().width <= 900;

/* Текущая открытая вкладка */
const currentTab = (page) => page.evaluate(() => document.documentElement.dataset.tab);

/* Видимые панели-вкладки */
const visiblePanels = (page) =>
  page.evaluate(() => Array.from(document.querySelectorAll('.tabpanel')).filter((p) => getComputedStyle(p).display !== 'none').map((p) => p.id));

module.exports = { test, expect, open, touchDrag, swipeUp, isNarrow, currentTab, visiblePanels };
