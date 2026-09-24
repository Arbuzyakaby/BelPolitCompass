'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const B = require('../../js/boot.js');

test('normalize: пустые и мусорные данные дают значения по умолчанию', () => {
  assert.deepEqual(B.normalize(undefined), B.DEFAULTS);
  assert.deepEqual(B.normalize(null), B.DEFAULTS);
  assert.deepEqual(B.normalize('строка'), B.DEFAULTS);
  const junk = B.normalize({ theme: 'purple', fs: 99, motion: 'fast', hints: 'yes', simple: 1, extra: 'x' });
  assert.deepEqual(junk, B.DEFAULTS);
  assert.ok(!('extra' in junk), 'лишние поля отбрасываются');
});

test('normalize: допустимые значения сохраняются', () => {
  const p = B.normalize({ theme: 'dark', fs: 'xxl', contrast: 'max', hints: false, motion: 'off', simple: true, font: 'readable', tts: true, ttsRate: 'slow', autoNext: false });
  assert.equal(p.theme, 'dark');
  assert.equal(p.fs, 'xxl');
  assert.equal(p.contrast, 'max');
  assert.equal(p.hints, false);
  assert.equal(p.motion, 'off');
  assert.equal(p.simple, true);
  assert.equal(p.font, 'readable');
  assert.equal(p.ttsRate, 'slow');
  assert.equal(p.autoNext, false);
});

test('миграция: контраст-флаг Alpha 0.3 и тема Alpha 0.1–0.2', () => {
  assert.equal(B.normalize({ contrast: true }).contrast, 'high');
  assert.equal(B.normalize({ contrast: false }).contrast, 'normal');
  assert.equal(B.normalize({ contrast: 'high' }).contrast, 'high');
  assert.equal(B.normalize({}, 'dark').theme, 'dark');
  assert.equal(B.normalize({ theme: 'light' }, 'dark').theme, 'light', 'новая настройка важнее старой');
  assert.equal(B.normalize({}, 'neon').theme, 'system');
});

test('parse: битый JSON не ломает страницу', () => {
  assert.deepEqual(B.parse('{oops'), B.DEFAULTS);
  assert.deepEqual(B.parse(null), B.DEFAULTS);
  assert.deepEqual(B.parse('null'), B.DEFAULTS);
  assert.equal(B.parse('{"fs":"lg"}').fs, 'lg');
});

test('serialize: хранит только отличия и переживает круговую проверку', () => {
  assert.equal(B.serialize(B.DEFAULTS), '{}');
  const p = B.normalize({ theme: 'dark', simple: true, tables: true });
  const json = B.serialize(p);
  assert.deepEqual(JSON.parse(json), { theme: 'dark', simple: true, tables: true });
  assert.deepEqual(B.parse(json), p);
});

test('toAttrs: по умолчанию на <html> только режим анимаций', () => {
  const a = B.toAttrs(B.DEFAULTS, false);
  const set = Object.entries(a).filter(([, v]) => v !== null);
  assert.deepEqual(set, [['data-motion', 'full']]);
  assert.equal(B.toAttrs(B.DEFAULTS, true)['data-motion'], 'off', 'системное «уменьшить движение»');
});

test('toAttrs: каждая настройка превращается в свой атрибут', () => {
  const a = B.toAttrs(
    { theme: 'light', fs: 'xl', contrast: 'max', hints: false, motion: 'reduced', simple: true, font: 'readable', spacing: true, underline: true, cursor: true, cvd: true, guide: true, tts: true, targets: true, focus: true, autoNext: false, tables: true },
    false
  );
  assert.deepEqual(a, {
    'data-theme': 'light',
    'data-fs': 'xl',
    'data-contrast': 'max',
    'data-hints': 'off',
    'data-motion': 'reduced',
    'data-simple': 'on',
    'data-font': 'readable',
    'data-spacing': 'on',
    'data-underline': 'on',
    'data-cursor': 'big',
    'data-cvd': 'on',
    'data-guide': 'on',
    'data-tts': 'on',
    'data-targets': 'big',
    'data-focus': 'strong',
    'data-autonext': 'off',
    'data-tables': 'on',
  });
});

test('effectiveMotion: явный выбор важнее системной настройки', () => {
  assert.equal(B.effectiveMotion({ motion: 'full' }, true), 'full');
  assert.equal(B.effectiveMotion({ motion: 'system' }, true), 'off');
  assert.equal(B.effectiveMotion({ motion: 'system' }, false), 'full');
  assert.equal(B.effectiveMotion({ motion: 'reduced' }, false), 'reduced');
});

test('профили: каждый меняет только свои поля и даёт корректные настройки', () => {
  const base = B.normalize({ theme: 'dark', fs: 'lg' });
  for (const [id, preset] of Object.entries(B.PRESETS)) {
    assert.ok(preset.label && preset.note, `${id}: есть подпись и описание`);
    const p = B.applyPreset(base, id);
    assert.deepEqual(p, B.normalize(p), `${id}: значения допустимы`);
    for (const [k, v] of Object.entries(preset.set)) assert.equal(p[k], v, `${id}.${k}`);
    assert.equal(p.theme, 'dark', `${id}: тема не тронута`);
    for (const k of Object.keys(preset.set)) assert.ok(k in B.SCHEMA, `${id}: поле ${k} есть в схеме`);
  }
  assert.deepEqual(B.applyPreset(base, 'nope'), base);
});

test('resetA11y: сбрасывает только специальные возможности', () => {
  const p = B.normalize({ theme: 'dark', simple: true, contrast: 'max', font: 'readable', autoNext: false, tables: true });
  const r = B.resetA11y(p);
  assert.equal(r.theme, 'dark');
  assert.equal(r.simple, true);
  for (const k of B.A11Y_KEYS) assert.equal(r[k], B.DEFAULTS[k], k);
});

test('tabFromHash: вкладки, якоря внутри вкладок и неизвестные адреса', () => {
  assert.equal(B.tabFromHash(''), 'home');
  assert.equal(B.tabFromHash('#'), 'home');
  assert.equal(B.tabFromHash('#compass'), 'compass');
  assert.equal(B.tabFromHash('quiz'), 'quiz');
  assert.equal(B.tabFromHash('#faq'), 'about');
  assert.equal(B.tabFromHash('#cite'), 'about');
  assert.equal(B.tabFromHash('#about-why'), 'about');
  assert.equal(B.tabFromHash('#top'), 'home');
  assert.equal(B.tabFromHash('#unknown'), 'home');
  assert.equal(B.tabFromHash('#%D0%BA%D0%BE%D0%BC%D0%BF%D0%B0%D1%81'), 'home', 'кириллица в адресе не ломает');
  for (const t of B.TABS) assert.equal(B.tabFromHash('#' + t), t);
});

test('run: выставляет атрибуты на <html> из хранилища и адреса', () => {
  const attrs = {};
  const classes = new Set();
  const el = {
    classList: { add: (c) => classes.add(c) },
    setAttribute: (k, v) => (attrs[k] = v),
    removeAttribute: (k) => delete attrs[k],
  };
  const win = {
    document: { documentElement: el },
    localStorage: { getItem: (k) => (k === B.KEY ? '{"theme":"dark","simple":true}' : null) },
    matchMedia: () => ({ matches: false }),
    location: { hash: '#faq' },
  };
  B.run(win);
  assert.ok(classes.has('js'));
  assert.equal(attrs['data-theme'], 'dark');
  assert.equal(attrs['data-simple'], 'on');
  assert.equal(attrs['data-tab'], 'about');
  assert.equal(attrs['data-motion'], 'full');
});

test('run: недоступное хранилище (приватный режим) не мешает загрузке', () => {
  const attrs = {};
  const win = {
    document: { documentElement: { classList: { add() {} }, setAttribute: (k, v) => (attrs[k] = v), removeAttribute() {} } },
    localStorage: { getItem() { throw new Error('SecurityError'); } },
    location: { hash: '' },
  };
  assert.doesNotThrow(() => B.run(win));
  assert.equal(attrs['data-tab'], 'home');
});
