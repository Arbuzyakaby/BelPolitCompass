'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../../js/core.js');
const { loadData } = require('./helpers');

const D = loadData();
const AXES = D.axes;
const pos = (vector, power, economy, identity) => ({ pos: { vector, power, economy, identity } });

test('plural: русские формы для 1, 2–4, 5–20 и составных чисел', () => {
  const f = ['мандат', 'мандата', 'мандатов'];
  const cases = {
    0: 'мандатов', 1: 'мандат', 2: 'мандата', 4: 'мандата', 5: 'мандатов', 11: 'мандатов', 12: 'мандатов',
    14: 'мандатов', 19: 'мандатов', 21: 'мандат', 22: 'мандата', 25: 'мандатов', 51: 'мандат', 101: 'мандат',
    111: 'мандатов', 112: 'мандатов', 1004: 'мандата',
  };
  for (const [n, w] of Object.entries(cases)) assert.equal(C.plural(+n, f), w, `n=${n}`);
  assert.equal(C.plural(-1, f), 'мандат', 'отрицательные числа');
});

test('fmt: знак всегда виден, минус типографский', () => {
  assert.equal(C.fmt(3), '+3');
  assert.equal(C.fmt(0), '0');
  assert.equal(C.fmt(-4), '−4');
  assert.equal(C.fmt(-10), '−10');
  assert.ok(!C.fmt(-4).includes('-'), 'дефис заменён на минус');
});

test('fmt1: одна цифра после запятой, без «−0»', () => {
  assert.equal(C.fmt1(2.54), '+2,5');
  assert.equal(C.fmt1(-3), '−3');
  assert.equal(C.fmt1(0), '0');
  assert.equal(C.fmt1(-0.04), '0');
  assert.equal(C.fmt1(10), '+10');
  assert.equal(C.fmt1(-7.25), '−7,2');
});

test('pct1: проценты с запятой', () => {
  assert.equal(C.pct1(46.3636), '46,4');
  assert.equal(C.pct1(3.6), '3,6');
  assert.equal(C.pct1(0), '0,0');
});

test('distance и maxDistance: евклидово расстояние в 4D', () => {
  assert.equal(C.distance(pos(0, 0, 0, 0), pos(0, 0, 0, 0), AXES), 0);
  assert.equal(C.distance(pos(3, 4, 0, 0), pos(0, 0, 0, 0), AXES), 5);
  assert.equal(C.maxDistance(AXES), 40);
  const a = pos(1, 2, 3, 4);
  const b = pos(-5, 7, 0, -2);
  assert.equal(C.distance(a, b, AXES), C.distance(b, a, AXES), 'симметрично');
});

test('similarity: 100% для совпадения, 0% для противоположных углов', () => {
  assert.equal(C.similarity(pos(5, 5, 5, 5), pos(5, 5, 5, 5), AXES), 100);
  assert.equal(C.similarity(pos(10, 10, 10, 10), pos(-10, -10, -10, -10), AXES), 0);
  assert.equal(C.similarity(pos(0, 0, 0, 0), pos(10, 10, 10, 10), AXES), 50);
});

test('similarity всех пар партий — целые числа от 0 до 100 и симметрия', () => {
  for (const a of D.parties) {
    for (const b of D.parties) {
      const s = C.similarity(a, b, AXES);
      assert.ok(Number.isInteger(s) && s >= 0 && s <= 100, `${a.id}-${b.id}: ${s}`);
      assert.equal(s, C.similarity(b, a, AXES));
    }
  }
});

test('треугольник: сходство партии с собой всегда выше, чем с любой другой', () => {
  for (const a of D.parties) {
    for (const b of D.parties) if (a !== b) assert.ok(C.similarity(a, a, AXES) > C.similarity(a, b, AXES));
  }
});

test('rank: партии отсортированы по убыванию сходства', () => {
  const r = C.rank({ vector: -6, power: 9, economy: -4, identity: -2 }, D.parties, AXES);
  assert.equal(r.length, D.parties.length);
  assert.equal(r[0].p.id, 'br', 'точка «Белой Руси» ближе всего к самой «Белой Руси»');
  assert.equal(r[0].s, 100);
  for (let i = 1; i < r.length; i++) assert.ok(r[i - 1].s >= r[i].s);
});

test('quizScores: все «полностью согласен» — к полюсам по направлению вопросов', () => {
  const Q = D.quiz.questions;
  const answers = Q.map(() => 2);
  const s = C.quizScores(answers, Q, AXES);
  // На каждой оси 5 вопросов «за» и 5 «против» — согласие со всем даёт центр
  for (const a of AXES) assert.equal(s[a.id], 0, a.id);
});

test('quizScores: согласие только с «+»-вопросами даёт +10, только с «−» — −10', () => {
  const Q = D.quiz.questions;
  const plus = C.quizScores(Q.map((q) => (q.dir > 0 ? 2 : -2)), Q, AXES);
  const minus = C.quizScores(Q.map((q) => (q.dir > 0 ? -2 : 2)), Q, AXES);
  for (const a of AXES) {
    assert.equal(plus[a.id], 10, a.id);
    assert.equal(minus[a.id], -10, a.id);
  }
});

test('quizScores: пропуски и нейтральные ответы — центр; шкала не выходит за ±10', () => {
  const Q = D.quiz.questions;
  const none = C.quizScores(Q.map(() => null), Q, AXES);
  const neutral = C.quizScores(Q.map(() => 0), Q, AXES);
  for (const a of AXES) {
    assert.equal(none[a.id], 0);
    assert.equal(neutral[a.id], 0);
  }
  const rnd = C.quizScores(Q.map((_, i) => [-2, -1, 0, 1, 2][i % 5]), Q, AXES);
  for (const a of AXES) assert.ok(Math.abs(rnd[a.id]) <= 10);
});

test('quizScores: один ответ на оси сдвигает её на 1 пункт, другие не трогает', () => {
  const Q = D.quiz.questions;
  const answers = Q.map(() => null);
  const i = Q.findIndex((q) => q.axis === 'economy' && q.dir === 1);
  answers[i] = 2;
  const s = C.quizScores(answers, Q, AXES);
  assert.equal(s.economy, 1); // 2 балла из 20 возможных → 1/10 шкалы → 1 пункт
  assert.equal(s.vector, 0);
  assert.equal(s.power, 0);
  assert.equal(s.identity, 0);
});

test('normalizeQuizState: чинит испорченное состояние', () => {
  const n = 40;
  assert.deepEqual(C.normalizeQuizState(null, n), { answers: Array(n).fill(null), idx: 0, done: false });
  assert.equal(C.normalizeQuizState({ answers: [1, 2] }, n).answers.length, n, 'неверная длина — чистое состояние');
  const bad = { answers: Array(n).fill('x'), idx: 99, done: 'yes' };
  const fixed = C.normalizeQuizState(bad, n);
  assert.ok(fixed.answers.every((v) => v === null));
  assert.equal(fixed.idx, n - 1);
  assert.equal(fixed.done, false);
  const neg = C.normalizeQuizState({ answers: Array(n).fill(1), idx: -5 }, n);
  assert.equal(neg.idx, 0);
  const done = C.normalizeQuizState({ answers: Array(n).fill(null), idx: 3, done: true }, n);
  assert.ok(done.answers.every((v) => v === 0), 'в готовом тесте пропуски = нейтрально');
  const odd = C.normalizeQuizState({ answers: [3, -3, 1.5, 2, ...Array(n - 4).fill(null)], idx: 1.7 }, n);
  assert.deepEqual(odd.answers.slice(0, 4), [null, null, null, 2]);
  assert.equal(odd.idx, 1);
});

test('strength и describe: пороги центра, умеренной, заметной и твёрдой позиции', () => {
  const ax = AXES[0];
  assert.equal(C.strength(0), 'center');
  assert.equal(C.strength(1.4), 'center');
  assert.equal(C.strength(-1.5), 'mild');
  assert.equal(C.strength(4.4), 'mild');
  assert.equal(C.strength(4.5), 'clear');
  assert.equal(C.strength(7.5), 'strong');
  assert.equal(C.strength(-10), 'strong');
  assert.deepEqual(C.describe(ax, 0, 'Многовекторность'), { pole: 'Многовекторность', strength: 'центр', key: 'center' });
  assert.equal(C.describe(ax, 8, 'x').pole, ax.pos);
  assert.equal(C.describe(ax, -8, 'x').pole, ax.neg);
  assert.equal(C.describe(ax, -8, 'x').strength, 'твёрдо');
});

test('plainPosition: понятная фраза с полюсом и пояснением', () => {
  const ax = AXES[0];
  assert.match(C.plainPosition(ax, 0), /посередине/);
  assert.match(C.plainPosition(ax, 9), /очень сильно ближе к «Запад» — за сближение с Европой/);
  assert.match(C.plainPosition(ax, -3), /немного ближе к «Восток»/);
});

test('resolveOverlaps: после раскладки подписи точек не пересекаются', () => {
  const k = 100 / 500;
  const mk = (x, y) => ({ p: { x, y }, w: 40, up: 8, down: 30 });
  const boxes = [mk(50, 50), mk(50.5, 50.2), mk(49.8, 50.1), mk(51, 49.9), mk(20, 20)];
  const it = C.resolveOverlaps(boxes, k);
  assert.ok(it < 80, 'сходится до лимита итераций');
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const A = boxes[i];
      const B = boxes[j];
      const dx = Math.abs(B.p.x - A.p.x) / k;
      const dy = (B.p.y - A.p.y) / k;
      const ox = (A.w + B.w) / 2 - dx;
      const oy = dy >= 0 ? A.down + B.up - dy : B.down + A.up + dy;
      assert.ok(ox <= 0.01 || oy <= 0.01, `пересечение ${i}-${j}`);
    }
  }
});

test('resolveOverlaps: одинокая точка не двигается', () => {
  const b = [{ p: { x: 30, y: 40 }, w: 40, up: 8, down: 30 }];
  assert.equal(C.resolveOverlaps(b, 0.2), 0);
  assert.deepEqual(b[0].p, { x: 30, y: 40 });
});

test('convexHull: квадрат с точкой внутри → 4 вершины', () => {
  const h = C.convexHull([[0, 0], [10, 0], [10, 10], [0, 10], [5, 5], [3, 7]]);
  assert.equal(h.length, 4);
  assert.ok(!h.some(([x, y]) => x === 5 && y === 5));
  assert.equal(C.convexHull([[1, 1], [2, 2]]).length, 2, 'меньше трёх точек — как есть');
});

test('sampledHull: фиксированное число лучей и все точки внутри оболочки', () => {
  const pts = [{ x: 30, y: 30 }, { x: 60, y: 40 }, { x: 45, y: 70 }];
  const h = C.sampledHull(pts, 5, 72);
  assert.equal(h.length, 72);
  const cx = h.reduce((s, p) => s + p[0], 0) / h.length;
  const cy = h.reduce((s, p) => s + p[1], 0) / h.length;
  const maxR = Math.max(...h.map(([x, y]) => Math.hypot(x - cx, y - cy)));
  for (const p of pts) assert.ok(Math.hypot(p.x - cx, p.y - cy) < maxR);
  assert.equal(C.sampledHull([], 5, 72), null);
});

test('contrast: эталонные значения WCAG', () => {
  assert.equal(Math.round(C.contrast('#000000', '#ffffff') * 10) / 10, 21);
  assert.equal(C.contrast('#777777', '#777777'), 1);
  assert.ok(Math.abs(C.contrast('#767676', '#ffffff') - 4.54) < 0.01);
  assert.deepEqual(C.hexToRgb('#fff'), [255, 255, 255]);
  assert.equal(C.hexToRgb('nope'), null);
});
