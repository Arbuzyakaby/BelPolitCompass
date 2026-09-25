'use strict';
// Статическая проверка разметки: без браузера, по исходному index.html
const test = require('node:test');
const assert = require('node:assert/strict');
const { read, loadData } = require('./helpers');
const B = require('../../js/boot.js');

const html = read('index.html');
const D = loadData();
const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
const idSet = new Set(ids);
// id, которые создаёт JavaScript
const dynamicIds = new Set(['tourTitle', 'tourText', 'tourCount', 'tourBar', 'inviteTitle', 'radarSvg', 'radarShapes', 'poleNeg', 'polePos', 'qzQ']);

test('id в разметке уникальны', () => {
  const dup = ids.filter((id, i) => ids.indexOf(id) !== i);
  assert.deepEqual(dup, []);
});

test('каждая ссылка #… ведёт на существующий элемент или вкладку', () => {
  const hrefs = [...html.matchAll(/href="#([^"]*)"/g)].map((m) => m[1]);
  assert.ok(hrefs.length > 20);
  for (const h of hrefs) assert.ok(idSet.has(h) || B.TABS.includes(h), `#${h}`);
});

test('aria-controls, aria-labelledby и for ссылаются на существующие id', () => {
  for (const attr of ['aria-controls', 'aria-labelledby', 'aria-describedby', 'for']) {
    for (const m of html.matchAll(new RegExp(`\\s${attr}="([^"]+)"`, 'g'))) {
      for (const id of m[1].split(/\s+/)) assert.ok(idSet.has(id) || dynamicIds.has(id), `${attr} → ${id}`);
    }
  }
});

test('вкладки: у каждой вкладки есть панель, у каждой панели — вкладка', () => {
  for (const t of B.TABS) {
    assert.match(html, new RegExp(`id="tab-${t}"[^>]*aria-controls="${t}"|aria-controls="${t}"[^>]*id="tab-${t}"`), `вкладка ${t}`);
    assert.match(html, new RegExp(`id="${t}" role="tabpanel" aria-labelledby="tab-${t}"`), `панель ${t}`);
  }
  const tabs = [...html.matchAll(/role="tab" id="tab-([a-z]+)"/g)].map((m) => m[1]);
  assert.deepEqual(tabs, B.TABS, 'порядок вкладок в шапке совпадает с boot.js');
});

test('в CSS есть правило показа для каждой вкладки', () => {
  const css = read('css/styles.css');
  for (const t of B.TABS) assert.ok(css.includes(`[data-tab='${t}'] #${t}`), t);
});

test('якоря внутри «О проекте» относятся к вкладке about', () => {
  const tocTargets = [...html.matchAll(/class="toc__list"[\s\S]*?<\/ol>/g)].flatMap((m) => [...m[0].matchAll(/href="#([^"]+)"/g)].map((x) => x[1]));
  assert.equal(tocTargets.length, 15, 'в содержании 15 пунктов');
  for (const id of tocTargets) assert.equal(B.tabFromHash('#' + id), 'about', id);
});

test('содержание: номера пунктов идут подряд и совпадают с data-num у разделов', () => {
  const nums = [...html.matchAll(/class="toc__num">(\d+)</g)].map((m) => +m[1]);
  assert.deepEqual(nums, Array.from({ length: nums.length }, (_, i) => i + 1));
  const blocks = [...html.matchAll(/id="([^"]+)" data-num="(\d+)"/g)];
  assert.equal(blocks.length, nums.length);
  blocks.forEach(([, , n], i) => assert.equal(+n, i + 1));
});

test('версия одинакова в разметке и data.js', () => {
  const versions = [...html.matchAll(/data-version[^>]*>([^<]+)</g)].map((m) => m[1].trim());
  assert.ok(versions.length >= 3);
  for (const v of versions) assert.equal(v, D.version);
});

test('внешние ссылки открываются безопасно (rel="noopener")', () => {
  for (const m of html.matchAll(/<a [^>]*target="_blank"[^>]*>/g)) assert.match(m[0], /rel="noopener/, m[0]);
});

test('нет встроенных обработчиков событий и javascript:-ссылок', () => {
  assert.doesNotMatch(html, /\son[a-z]+="/i);
  assert.doesNotMatch(html, /href="javascript:/i);
});

test('у кнопок-иконок есть подписи для экранного диктора', () => {
  for (const m of html.matchAll(/<button class="icon-btn[^"]*"[^>]*>/g)) assert.match(m[0], /aria-label="[^"]+"/, m[0]);
});

test('все <button> имеют тип, кроме кнопки закрытия формы-диалога', () => {
  const noType = [...html.matchAll(/<button(?![^>]*\stype=)[^>]*>/g)].map((m) => m[0]);
  assert.deepEqual(noType, ['<button class="icon-btn" value="close" aria-label="Закрыть настройки">']);
});

test('заголовки: один h1, подвал использует h2, а не h4', () => {
  assert.equal((html.match(/<h1[\s>]/g) || []).length, 1);
  assert.doesNotMatch(html, /<h4[\s>][^<]*<\/h4>\s*\n\s*<a href="#compass">/);
  assert.ok(!/footer__col[^]*?<h4/.test(html.slice(html.indexOf('<footer'), html.indexOf('</footer>'))), 'в подвале нет h4');
});

test('<ol>/<ul> содержат только <li> (хронология без лишних элементов)', () => {
  assert.doesNotMatch(html, /<ol class="tl"[^>]*>\s*<span/);
});

test('язык страницы, viewport и описание на месте', () => {
  assert.match(html, /<html lang="ru">/);
  assert.match(html, /name="viewport" content="width=device-width, initial-scale=1/);
  assert.doesNotMatch(html, /user-scalable=no|maximum-scale=1/, 'масштабирование пальцами не запрещено');
  assert.match(html, /<meta name="description" content="[^"]{50,}"/);
});

test('скрипты подключены в правильном порядке, boot.js — в <head>', () => {
  const head = html.slice(0, html.indexOf('</head>'));
  assert.match(head, /<script src="js\/boot.js"><\/script>/);
  const order = [...html.slice(html.indexOf('</footer>')).matchAll(/<script src="js\/([a-z0-9]+)\.js"/g)].map((m) => m[1]);
  assert.deepEqual(order, ['data', 'core', 'tabs', 'app', 'charts', 'quiz', 'settings', 'a11y', 'toc', 'tour', 'fun']);
});

test('упрощённый режим: пояснения есть в каждой вкладке', () => {
  for (const t of B.TABS) {
    const start = html.indexOf(`id="${t}" role="tabpanel"`);
    const end = html.indexOf('role="tabpanel"', start + 20);
    const chunk = html.slice(start, end < 0 ? html.indexOf('</main>') : end);
    assert.ok((chunk.match(/class="simple/g) || []).length >= 1, t);
  }
});

test('настройки: у каждого поля формы есть поле в схеме boot.js', () => {
  const names = new Set([...html.matchAll(/<input[^>]*name="([^"]+)"/g)].map((m) => m[1]));
  for (const n of names) assert.ok(n in B.SCHEMA, n);
  for (const k of Object.keys(B.SCHEMA)) assert.ok(names.has(k), `в форме есть управление для «${k}»`);
});

test('настройки: значения радиокнопок допустимы по схеме', () => {
  for (const m of html.matchAll(/<input type="radio" name="([^"]+)" value="([^"]+)"/g)) {
    assert.ok(B.SCHEMA[m[1]].values.includes(m[2]), `${m[1]}=${m[2]}`);
  }
});
