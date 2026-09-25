'use strict';
// Физика Alpha 0.5: пружины, резинка, частицы (js/core.js)
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../../js/core.js');

const near = (a, b, eps, msg) => assert.ok(Math.abs(a - b) <= eps, `${msg || ''} ${a} ≈ ${b} (±${eps})`);

test('springStep: затухающая пружина приходит к цели и останавливается', () => {
  let s = { x: 1, v: 0 };
  for (let i = 0; i < 300; i++) s = C.springStep(s, 1 / 60, 170, 16);
  near(s.x, 0, 1e-3, 'положение');
  near(s.v, 0, 1e-2, 'скорость');
  assert.ok(C.springAtRest(s));
});

test('springStep: слабое затухание даёт перелёт через цель', () => {
  let s = { x: 1, v: 0 };
  let min = 1;
  for (let i = 0; i < 120; i++) {
    s = C.springStep(s, 1 / 60, 300, 8);
    min = Math.min(min, s.x);
  }
  assert.ok(min < -0.2, `перелёт ${min}`);
});

test('springStep: длинный кадр дробится и не «взрывается»', () => {
  // Вкладка была в фоне: кадр в 5 с считаем как 2 с мелкими шагами
  const s = C.springStep({ x: 1, v: 0 }, 5, 900, 4);
  assert.ok(Number.isFinite(s.x) && Number.isFinite(s.v));
  assert.ok(Math.abs(s.x) <= 1, `x=${s.x}`);
  // Один длинный шаг даёт тот же итог, что много коротких
  const one = C.springStep({ x: 1, v: 0 }, 0.5, 170, 16);
  let many = { x: 1, v: 0 };
  for (let i = 0; i < 60; i++) many = C.springStep(many, 0.5 / 60, 170, 16);
  near(one.x, many.x, 1e-6, 'x');
  near(one.v, many.v, 1e-6, 'v');
});

test('springStep: не меняет исходное состояние', () => {
  const s = { x: 1, v: 2 };
  C.springStep(s, 0.1, 170, 16);
  assert.deepEqual(s, { x: 1, v: 2 });
});

test('springAtRest: учитывает и положение, и скорость', () => {
  assert.ok(C.springAtRest({ x: 0, v: 0 }));
  assert.ok(!C.springAtRest({ x: 0, v: 1 }), 'пролетает через ноль');
  assert.ok(!C.springAtRest({ x: 0.1, v: 0 }));
  assert.ok(C.springAtRest({ x: 0.04, v: 0.1 }, 0.05), 'свой порог');
});

test('springCurve: начинается с 0, кончается ровно 1, есть перелёт', () => {
  const { points, duration } = C.springCurve(260, 18);
  assert.equal(points[0], 0);
  assert.equal(points[points.length - 1], 1);
  assert.ok(Math.max(...points) > 1, 'пружина перелетает цель');
  assert.ok(duration > 200 && duration < 3000, `длительность ${duration} мс`);
  near(duration, (points.length - 1) * (1000 / 60), 1, 'кадры по 1/60 с');
});

test('springCurve: жёсткая пружина успокаивается быстрее мягкой', () => {
  assert.ok(C.springCurve(400, 30).duration < C.springCurve(120, 10).duration);
});

test('springCurve: ограничена по времени', () => {
  // Почти без затухания пружина не успокоится — кривая всё равно конечна
  const { points, duration } = C.springCurve(170, 0.01, 1);
  assert.ok(points.length <= 62);
  assert.ok(duration <= 1020);
  assert.equal(points[points.length - 1], 1);
});

test('springEasing: корректная CSS-функция linear()', () => {
  const e = C.springEasing(260, 18);
  assert.match(e, /^linear\(0(, -?\d+(\.\d+)?)+, 1\)$/);
  const nums = e.slice(7, -1).split(', ').map(Number);
  assert.ok(nums.every(Number.isFinite));
  assert.ok(nums.every((n) => String(n).split('.')[1] === undefined || String(n).split('.')[1].length <= 3), 'не больше трёх знаков');
});

test('rubber: мало — почти как есть, много — упирается в предел', () => {
  near(C.rubber(2, 38), 2, 0.01, 'малое смещение');
  assert.ok(C.rubber(100, 38) < 38);
  assert.ok(C.rubber(1000, 38) <= 38);
  near(C.rubber(1000, 38), 38, 1e-6, 'предел');
  assert.equal(C.rubber(-10, 38), -C.rubber(10, 38), 'симметрия');
  assert.equal(C.rubber(0, 38), 0);
  assert.equal(C.rubber(50, 0), 0, 'нулевой предел');
  // Монотонность: чем дальше тянешь, тем дальше точка
  let prev = -Infinity;
  for (let d = -200; d <= 200; d += 5) {
    const r = C.rubber(d, 38);
    assert.ok(r > prev);
    prev = r;
  }
});

const FALL = { g: 1500, drag: 0.5, floor: 500, bounce: 0.55, friction: 0.82, rest: 60 };

test('particleStep: гравитация разгоняет вниз, исходная частица не меняется', () => {
  const p = { x: 0, y: 0, vx: 10, vy: 0 };
  const q = C.particleStep(p, 0.1, FALL);
  assert.ok(q.vy > 0 && q.y > 0);
  assert.ok(q.x > 0);
  assert.deepEqual(p, { x: 0, y: 0, vx: 10, vy: 0 });
});

test('particleStep: отскок от пола теряет энергию', () => {
  const q = C.particleStep({ x: 0, y: 499, vx: 100, vy: 800 }, 0.01, FALL);
  assert.equal(q.y, 500);
  assert.ok(q.vy < 0, 'летит вверх');
  assert.ok(Math.abs(q.vy) < 800 * 0.6);
  assert.ok(q.vx < 100, 'трение о пол');
  assert.equal(q.resting, false);
});

test('particleStep: частица в итоге ложится на пол', () => {
  let p = { x: 0, y: 0, vx: 50, vy: 0, vr: 300 };
  for (let i = 0; i < 600 && !p.resting; i++) p = C.particleStep(p, 1 / 60, FALL);
  assert.ok(p.resting, 'легла');
  assert.equal(p.y, 500);
  assert.equal(p.vy, 0);
});

test('particleStep: без пола — просто полёт, поворот копится', () => {
  let p = { x: 0, y: 0, vx: 0, vy: -100, vr: 90 };
  for (let i = 0; i < 10; i++) p = C.particleStep(p, 0.1, { g: 520, drag: 1.6, floor: Infinity, bounce: 0, friction: 1 });
  assert.ok(Number.isFinite(p.y));
  assert.ok(!p.resting);
  near(p.r, 90, 1e-9, 'поворот за 1 с');
});
