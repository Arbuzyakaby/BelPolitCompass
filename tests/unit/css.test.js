'use strict';
// Статическая проверка стилей: каждый режим из настроек имеет CSS, токены контрастны
const test = require('node:test');
const assert = require('node:assert/strict');
const { read, loadData } = require('./helpers');
const B = require('../../js/boot.js');
const C = require('../../js/core.js');

const css = read('css/styles.css');
const appJs = read('js/app.js');
const D = loadData();

// Все значения атрибутов, которые может выставить boot.js
function allAttrValues() {
  const out = {};
  for (const [k, spec] of Object.entries(B.SCHEMA)) {
    const variants = spec.bool ? [true, false] : spec.values;
    for (const v of variants) {
      for (const [attr, val] of Object.entries(B.toAttrs({ ...B.DEFAULTS, [k]: v }, false))) {
        if (val !== null) (out[attr] = out[attr] || new Set()).add(val);
      }
    }
  }
  return out;
}

test('для каждого значения data-атрибута из настроек есть CSS-правило', () => {
  // Эти атрибуты читает только JavaScript
  const jsOnly = new Set(['data-autonext', 'data-tables', 'data-tts', 'data-guide']);
  for (const [attr, vals] of Object.entries(allAttrValues())) {
    if (jsOnly.has(attr) || attr === 'data-motion') continue;
    // Цвета партий (в том числе палитру дальтоников) стили получают из app.js
    for (const v of vals) assert.ok(css.includes(`[${attr}='${v}']`) || appJs.includes(`[${attr}='${v}']`), `[${attr}='${v}']`);
  }
  for (const m of ['full', 'reduced', 'off']) {
    if (m !== 'full') assert.ok(css.includes(`[data-motion='${m}']`), m);
  }
  assert.ok(css.includes("[data-tts='on']"), 'кнопки озвучивания показываются только при data-tts');
});

test('упрощённый режим скрыт по умолчанию и виден при data-simple', () => {
  assert.match(css, /\n\.simple \{\n\s+display: none;/);
  assert.ok(css.includes(":root[data-simple='on'] .simple {"));
});

test('нет устаревших и неоновых остатков старого дизайна', () => {
  for (const bad of ['#bf5af2', '#ff453a', '#ff375f', '.nav__burger', '.i-sun', 'about__toc', '.chip.shake']) {
    assert.ok(!css.includes(bad), bad);
  }
});

test('3D-переворот карточки включается только классом is-3d', () => {
  // В покое preserve-3d/backface-visibility ломают прокрутку пальцем
  const preserve = [...css.matchAll(/([^{}]+)\{[^}]*transform-style:\s*preserve-3d/g)].map((m) => m[1].trim());
  assert.ok(preserve.length > 0);
  for (const sel of preserve) assert.match(sel, /is-3d/, sel);
  const backface = [...css.matchAll(/([^{}]+)\{[^}]*(?<!-webkit-)backface-visibility:\s*hidden/g)].map((m) => m[1].trim());
  for (const sel of backface) assert.match(sel, /is-3d/, sel);
});

test('печать показывает все вкладки', () => {
  const print = css.slice(css.indexOf('@media print'));
  assert.match(print, /:root\.js \.tabpanel \{\s*display: block !important;/);
});

/* ---------- Контраст по WCAG 2.2 ---------- */
function tokens(block) {
  const out = {};
  for (const m of block.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})\b/g)) out[m[1]] = m[2];
  return out;
}
function blockAfter(marker) {
  const i = css.indexOf(marker);
  assert.ok(i >= 0, marker);
  return css.slice(i, css.indexOf('}', i));
}

const light = tokens(blockAfter(':root {\n  --font'));
const dark = tokens(blockAfter(":root[data-theme='dark'] {"));
const maxLight = { ...light, ...tokens(blockAfter(":root[data-contrast='max'] {")) };
const maxDark = { ...dark, ...tokens(blockAfter(":root[data-contrast='max'][data-theme='dark'] {")) };
const highLight = { ...light, ...tokens(blockAfter(":root[data-contrast='high'] {")) };
const highDark = { ...dark, ...tokens(blockAfter(":root[data-theme='dark'][data-contrast='high'] {")) };

const THEMES = { light, dark, highLight, highDark, maxLight, maxDark };
const BGS = ['bg', 'surface', 'surface-2', 'surface-3'];

for (const [name, t] of Object.entries(THEMES)) {
  test(`контраст текста ≥ 4.5:1 — тема ${name}`, () => {
    for (const fg of ['text', 'text-2', 'text-3']) {
      for (const bg of BGS) {
        const r = C.contrast(t[fg], t[bg]);
        assert.ok(r >= 4.5, `${name}: --${fg} на --${bg} = ${r.toFixed(2)}`);
      }
    }
  });

  test(`контраст акцента и статусов ≥ 4.5:1 на фоне и карточке — тема ${name}`, () => {
    for (const fg of ['accent', 'green', 'red', 'gov', 'opp']) {
      for (const bg of ['bg', 'surface']) {
        const r = C.contrast(t[fg], t[bg]);
        assert.ok(r >= 4.5, `${name}: --${fg} на --${bg} = ${r.toFixed(2)}`);
      }
    }
  });

  test(`текст на кнопке с акцентом ≥ 4.5:1 — тема ${name}`, () => {
    const r = C.contrast(t['on-accent'], t['accent-strong']);
    assert.ok(r >= 4.5, `${name}: ${r.toFixed(2)}`);
  });
}

test('максимальный контраст действительно максимальный: ≥ 15:1 для основного текста', () => {
  for (const t of [maxLight, maxDark]) {
    assert.ok(C.contrast(t.text, t.bg) >= 15);
    assert.ok(C.contrast(t['text-2'], t.bg) >= 15);
  }
});

test('цвета партий различимы с фоном (графика ≥ 2.5:1, WCAG 1.4.11 для крупных меток)', () => {
  for (const p of D.parties) {
    assert.ok(C.contrast(p.color, light.surface) >= 2.5, `${p.id} светлая: ${C.contrast(p.color, light.surface).toFixed(2)}`);
    assert.ok(C.contrast(p.colorDark, dark.surface) >= 2.5, `${p.id} тёмная: ${C.contrast(p.colorDark, dark.surface).toFixed(2)}`);
  }
});

test('палитра дальтоников: парламентские партии отличаются по яркости', () => {
  const parl = D.parliament.order.map((id) => D.parties.find((p) => p.id === id));
  const lum = parl.map((p) => C.luminance(p.cvd));
  for (let i = 0; i < lum.length; i++) {
    for (let j = i + 1; j < lum.length; j++) {
      const ratio = (Math.max(lum[i], lum[j]) + 0.05) / (Math.min(lum[i], lum[j]) + 0.05);
      assert.ok(ratio >= 1.15, `${parl[i].id} / ${parl[j].id}: ${ratio.toFixed(2)}`);
    }
  }
});
