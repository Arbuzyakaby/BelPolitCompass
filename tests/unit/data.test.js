'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadData, read } = require('./helpers');

const D = loadData();
const HEX = /^#[0-9A-Fa-f]{6}$/;

test('версия в data.js совпадает с package.json', () => {
  const pkg = JSON.parse(read('package.json'));
  // 0.5.0 ↔ Alpha 0.5, 0.5.1 ↔ Alpha 0.5.1
  const [maj, min, patch] = pkg.version.split('.');
  assert.equal(D.version, `Alpha ${maj}.${min}` + (+patch ? `.${patch}` : ''));
});

test('оси: четыре, с уникальными id и всеми подписями', () => {
  assert.equal(D.axes.length, 4);
  assert.equal(new Set(D.axes.map((a) => a.id)).size, 4);
  for (const a of D.axes) {
    for (const k of ['id', 'name', 'short', 'neg', 'pos', 'negHint', 'posHint', 'about', 'plain', 'negPlain', 'posPlain']) {
      assert.ok(typeof a[k] === 'string' && a[k].trim(), `${a.id}.${k}`);
    }
  }
});

test('партии: 14 штук, уникальные id и аббревиатуры', () => {
  assert.equal(D.parties.length, 14);
  assert.equal(new Set(D.parties.map((p) => p.id)).size, 14);
  assert.equal(new Set(D.parties.map((p) => p.abbr)).size, 14);
  assert.equal(new Set(D.parties.map((p) => p.short)).size, 14);
});

test('партии: обязательные поля заполнены', () => {
  for (const p of D.parties) {
    for (const k of ['id', 'short', 'abbr', 'name', 'status', 'camp', 'leader', 'founded', 'ideology', 'about', 'plain']) {
      assert.ok(typeof p[k] === 'string' && p[k].trim(), `${p.id}.${k}`);
    }
    assert.ok(Array.isArray(p.points) && p.points.length >= 3, `${p.id}.points`);
    assert.ok(/^\d{4}$/.test(p.founded), `${p.id}: год основания`);
  }
});

test('партии: координаты — целые числа от −10 до +10 по каждой оси', () => {
  for (const p of D.parties) {
    for (const a of D.axes) {
      const v = p.pos[a.id];
      assert.ok(Number.isInteger(v) && v >= -10 && v <= 10, `${p.id}.${a.id} = ${v}`);
    }
    assert.equal(Object.keys(p.pos).length, D.axes.length, `${p.id}: нет лишних осей`);
  }
});

test('партии: цвета — корректный hex для светлой, тёмной и палитры дальтоников', () => {
  for (const p of D.parties) {
    for (const k of ['color', 'colorDark', 'cvd', 'cvdDark']) assert.match(p[k], HEX, `${p.id}.${k}`);
  }
  assert.equal(new Set(D.parties.map((p) => p.cvd.toLowerCase())).size, 14, 'палитра дальтоников без повторов');
});

test('партии: статус и лагерь из допустимых значений', () => {
  for (const p of D.parties) {
    assert.ok(p.status in D.statuses, `${p.id}.status`);
    assert.ok(['gov', 'opp'].includes(p.camp), `${p.id}.camp`);
    if (p.status === 'liquidated') assert.match(p.statusYear, /^\d{4}$/, `${p.id}: год ликвидации`);
    if (p.status !== 'active') assert.equal(p.seats, 0, `${p.id}: у недействующей партии нет мест`);
  }
  for (const s of Object.values(D.statuses)) assert.ok(s.label && s.tone && s.plain);
});

test('парламент: 110 мест = места партий + беспартийные', () => {
  const P = D.parliament;
  const partySeats = D.parties.reduce((s, p) => s + p.seats, 0);
  assert.equal(partySeats + P.nonPartisan, P.total);
  assert.equal(P.total, 110);
  assert.equal(P.order.length, D.parties.filter((p) => p.status === 'active').length);
  for (const id of P.order) assert.ok(D.parties.find((p) => p.id === id && p.status === 'active'), id);
});

test('тест: 40 утверждений, по 10 на ось, по 5 в каждую сторону', () => {
  const Q = D.quiz.questions;
  assert.equal(Q.length, 40);
  for (const a of D.axes) {
    const qs = Q.filter((q) => q.axis === a.id);
    assert.equal(qs.length, 10, a.id);
    assert.equal(qs.filter((q) => q.dir === 1).length, 5, `${a.id}: +`);
    assert.equal(qs.filter((q) => q.dir === -1).length, 5, `${a.id}: −`);
  }
  assert.equal(new Set(Q.map((q) => q.text)).size, 40, 'без повторов');
  for (const q of Q) {
    assert.ok([1, -1].includes(q.dir));
    assert.ok(q.text.endsWith('.'), `«${q.text}» — с точкой в конце`);
    if (q.hint) assert.ok(q.hint.length > 20, 'пояснение не пустое');
  }
});

test('тест: оси чередуются — подряд нет двух вопросов одной оси', () => {
  const Q = D.quiz.questions;
  for (let i = 1; i < Q.length; i++) assert.notEqual(Q[i].axis, Q[i - 1].axis, `вопросы ${i} и ${i + 1}`);
});

test('тест: пять вариантов ответа, симметричная шкала от +2 до −2', () => {
  const A = D.quiz.answers;
  assert.deepEqual(A.map((a) => a.v), [2, 1, 0, -1, -2]);
  for (const a of A) assert.ok(a.label && a.plain);
});

test('упрощённый режим: у половины вопросов теста есть пояснение терминов', () => {
  const withHint = D.quiz.questions.filter((q) => q.hint).length;
  assert.ok(withHint >= 20, `пояснений: ${withHint}`);
  // Термины, без которых новичок не поймёт вопрос, объяснены обязательно
  for (const term of ['ЕАЭС', 'ОДКБ', 'БРИКС', 'Всебелорусское народное собрание', 'Великое княжество']) {
    const q = D.quiz.questions.find((x) => x.text.includes(term));
    assert.ok(q && q.hint, `пояснение для «${term}»`);
  }
});

test('хронология: по возрастанию лет, тон и простое пояснение у каждого события', () => {
  const years = D.timeline.map((t) => +t.year);
  assert.deepEqual(years, years.slice().sort((a, b) => a - b));
  for (const t of D.timeline) {
    assert.ok(['gov', 'opp', 'neutral'].includes(t.tone), t.year);
    assert.ok(t.title && t.text && t.plain, t.year);
  }
});

test('данные обновлены: дата указана', () => {
  assert.match(D.updated, /\d{4}/);
});
