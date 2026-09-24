/* ==========================================================================
   BelPolitCompass · Alpha 0.4 — чистая логика без DOM
   Числа, склонения, сходство партий, подсчёт теста, раскладка точек,
   выпуклые оболочки. Работает и в браузере (window.BPCCore), и в Node
   (require) — поэтому всё здесь покрыто модульными тестами.
   ========================================================================== */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BPCCore = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const MINUS = '−';

  /* ---------- Текст и числа ---------- */
  // plural(5, ['мандат', 'мандата', 'мандатов']) → 'мандатов'
  function plural(n, forms) {
    const a = Math.abs(Math.trunc(n)) % 100;
    const b = a % 10;
    if (a > 10 && a < 20) return forms[2];
    if (b > 1 && b < 5) return forms[1];
    if (b === 1) return forms[0];
    return forms[2];
  }

  // Знак всегда виден, минус — типографский: +3, −4, 0
  const fmt = (v) => (v > 0 ? '+' + v : String(v)).replace('-', MINUS);

  // Одна цифра после запятой, без лишнего «,0»: 2,5 · −3 · 0
  function fmt1(v) {
    const r = Math.round(v * 10) / 10;
    return fmt(Object.is(r, -0) ? 0 : r).replace('.', ',');
  }

  const pct1 = (v) => (Math.round(v * 10) / 10).toFixed(1).replace('.', ',');

  /* ---------- Геометрия взглядов ---------- */
  function distance(a, b, axes) {
    return Math.sqrt(axes.reduce((s, ax) => s + (a.pos[ax.id] - b.pos[ax.id]) ** 2, 0));
  }

  // Самые далёкие точки — противоположные углы гиперкуба −10…+10
  const maxDistance = (axes) => Math.sqrt(axes.length * 400);

  function similarity(a, b, axes) {
    return Math.round((1 - distance(a, b, axes) / maxDistance(axes)) * 100);
  }

  function rank(me, parties, axes) {
    return parties
      .map((p) => ({ p, s: similarity({ pos: me }, p, axes) }))
      .sort((x, y) => y.s - x.s);
  }

  /* ---------- Тест ---------- */
  // Ответ от −2 до +2, умноженный на направление вопроса; сумма по оси
  // делится на максимум и переводится в шкалу −10…+10. null = нейтрально.
  function quizScores(answers, questions, axes) {
    const sum = {};
    const count = {};
    axes.forEach((a) => {
      sum[a.id] = 0;
      count[a.id] = 0;
    });
    questions.forEach((q, i) => {
      count[q.axis]++;
      const v = answers[i];
      if (typeof v === 'number') sum[q.axis] += v * q.dir;
    });
    const out = {};
    axes.forEach((a) => {
      const max = 2 * count[a.id];
      const raw = max ? (sum[a.id] / max) * 10 : 0;
      out[a.id] = Math.round(raw * 10) / 10 || 0;
    });
    return out;
  }

  const VALID_ANSWERS = [-2, -1, 0, 1, 2];

  // Сохранённое состояние теста могло испортиться — чиним, а не падаем
  function normalizeQuizState(raw, n) {
    const fresh = { answers: new Array(n).fill(null), idx: 0, done: false };
    if (!raw || typeof raw !== 'object' || !Array.isArray(raw.answers) || raw.answers.length !== n) return fresh;
    const answers = raw.answers.map((v) => (VALID_ANSWERS.includes(v) ? v : null));
    const idx = Math.max(0, Math.min(n - 1, Number.isFinite(raw.idx) ? Math.trunc(raw.idx) : 0));
    const done = raw.done === true;
    return { answers: done ? answers.map((v) => (v === null ? 0 : v)) : answers, idx, done };
  }

  // Насколько сильна позиция: для подписи результата и пояснений
  function strength(v) {
    const a = Math.abs(v);
    if (a < 1.5) return 'center';
    if (a < 4.5) return 'mild';
    if (a < 7.5) return 'clear';
    return 'strong';
  }

  const STRENGTH_WORD = { center: 'центр', mild: 'умеренно', clear: 'заметно', strong: 'твёрдо' };
  const STRENGTH_PLAIN = { center: 'посередине, без явного перевеса', mild: 'немного', clear: 'заметно', strong: 'очень сильно' };

  function describe(axis, v, centerLabel) {
    const s = strength(v);
    if (s === 'center') return { pole: centerLabel || 'Центр', strength: STRENGTH_WORD.center, key: s };
    return { pole: v > 0 ? axis.pos : axis.neg, strength: STRENGTH_WORD[s], key: s };
  }

  // «Немного ближе к полюсу „Запад“ (сближение с Европой)» — для упрощённого режима
  function plainPosition(axis, v) {
    const s = strength(v);
    if (s === 'center') return `${STRENGTH_PLAIN.center} между «${axis.neg}» и «${axis.pos}»`;
    const pole = v > 0 ? axis.pos : axis.neg;
    const hint = v > 0 ? axis.posPlain : axis.negPlain;
    return `${STRENGTH_PLAIN[s]} ближе к «${pole}»${hint ? ` — ${hint}` : ''}`;
  }

  /* ---------- Раскладка точек на компасе ----------
     Точка + подпись под ней = прямоугольник. Перекрытия разводим вдоль оси
     наименьшего пересечения. Координаты — в процентах плоскости, размеры —
     в пикселях; k = 100 / ширина плоскости в пикселях. */
  function resolveOverlaps(boxes, k, iterations = 80) {
    for (let it = 0; it < iterations; it++) {
      let moved = false;
      for (let i = 0; i < boxes.length; i++) {
        for (let j = i + 1; j < boxes.length; j++) {
          const A = boxes[i];
          const B = boxes[j];
          const dx = (B.p.x - A.p.x) / k;
          const dy = (B.p.y - A.p.y) / k;
          const ox = (A.w + B.w) / 2 - Math.abs(dx);
          const oy = dy >= 0 ? A.down + B.up - dy : B.down + A.up + dy;
          if (ox <= 0 || oy <= 0) continue;
          moved = true;
          if (ox < oy) {
            const s = (dx >= 0 ? 1 : -1) * (ox / 2 + 0.5) * k;
            A.p.x -= s;
            B.p.x += s;
          } else {
            const s = (dy >= 0 ? 1 : -1) * (oy / 2 + 0.5) * k;
            A.p.y -= s;
            B.p.y += s;
          }
        }
      }
      if (!moved) return it;
    }
    return iterations;
  }

  function convexHull(points) {
    const pts = points.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    if (pts.length < 3) return pts;
    const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lower = [];
    for (const p of pts) {
      while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
      lower.push(p);
    }
    const upper = [];
    for (let i = pts.length - 1; i >= 0; i--) {
      const p = pts[i];
      while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
      upper.push(p);
    }
    upper.pop();
    lower.pop();
    return lower.concat(upper);
  }

  // Оболочка с отступом R, представленная фиксированным числом лучей —
  // так две разные оболочки можно плавно превращать друг в друга
  function sampledHull(pts, R = 5.5, samples = 72) {
    if (!pts.length) return null;
    const cloud = [];
    pts.forEach((p) => {
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        cloud.push([p.x + Math.cos(a) * R, p.y + Math.sin(a) * R]);
      }
    });
    const hull = convexHull(cloud);
    const cx = hull.reduce((s, p) => s + p[0], 0) / hull.length;
    const cy = hull.reduce((s, p) => s + p[1], 0) / hull.length;
    const out = [];
    for (let i = 0; i < samples; i++) {
      const a = (i / samples) * Math.PI * 2;
      const dx = Math.cos(a);
      const dy = Math.sin(a);
      let best = 0;
      for (let j = 0; j < hull.length; j++) {
        const p1 = hull[j];
        const p2 = hull[(j + 1) % hull.length];
        const ex = p2[0] - p1[0];
        const ey = p2[1] - p1[1];
        const den = dx * ey - dy * ex;
        if (Math.abs(den) < 1e-9) continue;
        const t = ((p1[0] - cx) * ey - (p1[1] - cy) * ex) / den;
        const u = ((p1[0] - cx) * dy - (p1[1] - cy) * dx) / den;
        if (t > 0 && u >= -1e-6 && u <= 1 + 1e-6) best = Math.max(best, t);
      }
      out.push([cx + dx * best, cy + dy * best]);
    }
    return out;
  }

  /* ---------- Цвет: контраст по WCAG ---------- */
  function hexToRgb(hex) {
    const h = String(hex).replace('#', '');
    const f = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
    if (!/^[0-9a-f]{6}$/i.test(f)) return null;
    return [0, 2, 4].map((i) => parseInt(f.slice(i, i + 2), 16));
  }

  function luminance(hex) {
    const rgb = hexToRgb(hex);
    if (!rgb) return NaN;
    const [r, g, b] = rgb.map((c) => {
      const s = c / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  function contrast(a, b) {
    const la = luminance(a);
    const lb = luminance(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  }

  return {
    MINUS,
    plural,
    fmt,
    fmt1,
    pct1,
    distance,
    maxDistance,
    similarity,
    rank,
    quizScores,
    normalizeQuizState,
    strength,
    describe,
    plainPosition,
    resolveOverlaps,
    convexHull,
    sampledHull,
    hexToRgb,
    luminance,
    contrast,
  };
});
