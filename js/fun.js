/* ==========================================================================
   BelPolitCompass · Alpha 0.6 — «душа»: физика и пасхалки
   • Пружины: отскок кнопок, стрелка-маятник в логотипе, резинка на мини-компасе,
     пружинная плавность (--spring) для точек компаса, глайдеров и полосок.
   • Десять пасхалок с народными символами Беларуси — без флагов и гербов.
     Alpha 0.6 добавила дранікі, бульбу, саламянага павука и купальскі вянок.
   Всё движение — только в режиме «Полные анимации». В остальных режимах
   пасхалка всё равно находится и засчитывается, но показывается без полёта.
   Физика считается в core.js (springStep, rubber, particleStep) и покрыта тестами.
   ========================================================================== */
(function () {
  'use strict';

  const A = window.BPCApp;
  const C = window.BPCCore;
  const T = window.BPCTabs;
  if (!A || !C) return;

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const root = document.documentElement;
  const full = () => root.getAttribute('data-motion') === 'full';
  const blocking = () => root.classList.contains('has-sheet') || root.classList.contains('has-tour');
  const hasScale = typeof document.body.animate === 'function' && 'scale' in document.body.style;

  /* ==========================================================================
     Пружинная плавность для CSS: var(--spring) и var(--spring-soft).
     Если браузер не знает linear(), переменные не задаются и CSS берёт запасной
     вариант (var(--spring, var(--ease))) — никаких сломанных переходов.
     ========================================================================== */
  if (window.CSS && CSS.supports && CSS.supports('transition-timing-function', 'linear(0, 1)')) {
    const style = document.createElement('style');
    style.id = 'bpcSpring';
    style.textContent = `:root{--spring:${C.springEasing(260, 18)};--spring-soft:${C.springEasing(170, 16)}}`;
    document.head.appendChild(style);
  }

  // Кадры пружины для WAAPI: from → to с перелётом
  const curves = {};
  function springFrames(prop, from, to, k = 300, c = 14, fmt = (v) => String(v)) {
    const key = k + ':' + c;
    const cv = curves[key] || (curves[key] = C.springCurve(k, c));
    return {
      frames: cv.points.map((p) => ({ [prop]: fmt(from + (to - from) * p) })),
      duration: cv.duration,
    };
  }

  /* ==========================================================================
     Отскок кнопок: при нажатии «приседают», при отпускании пружинят обратно.
     Свойство scale, а не transform — не спорит с собственными трансформациями.
     ========================================================================== */
  const PRESS = [
    ['.qz-ans, .pcard, .step, .near__item, .donut__row, .preset', 0.97],
    [
      '.btn, .icon-btn, .tab, .seg__btn, .chip, .pd__nav, .pd__back, .tts-btn, .dd__btn, .legend__item, ' +
        '.sheet__tab, .qz-link, .footer__link, .tour__skip, .mdot, .pdot, .fern, .brand__mark',
      0.9,
    ],
  ];
  const pressTarget = (el) => {
    for (const [sel, depth] of PRESS) {
      const t = el && el.closest && el.closest(sel);
      if (t && !t.disabled) return { el: t, depth };
    }
    return null;
  };

  let pressed = null;
  function release() {
    if (!pressed) return;
    const { el, depth, anim } = pressed;
    pressed = null;
    if (anim) anim.cancel();
    const s = springFrames('scale', depth, 1, 300, 14);
    el.animate(s.frames, { duration: s.duration });
  }
  if (hasScale) {
    document.addEventListener(
      'pointerdown',
      (e) => {
        if (!full() || e.button > 0) return;
        const t = pressTarget(e.target);
        if (!t) return;
        release();
        const anim = t.el.animate([{ scale: '1' }, { scale: String(t.depth) }], { duration: 110, easing: 'ease-out', fill: 'forwards' });
        pressed = { ...t, anim };
      },
      true
    );
    ['pointerup', 'pointercancel', 'dragstart'].forEach((ev) => document.addEventListener(ev, release, true));
    window.addEventListener('blur', release);
    // Нажатие с клавиатуры (Enter, пробел) — тот же отскок одним движением
    document.addEventListener(
      'click',
      (e) => {
        if (!full() || e.detail !== 0) return;
        const t = pressTarget(e.target);
        if (!t) return;
        const s = springFrames('scale', t.depth, 1, 300, 14);
        t.el.animate([{ scale: '1' }, ...s.frames], { duration: s.duration + 80 });
      },
      true
    );
  }

  // Маленький «кивок» — для счётчиков и всего, что приехало на место
  function nod(el, amount = 1.12) {
    if (!full() || !hasScale || !el) return;
    const s = springFrames('scale', amount, 1, 260, 12);
    el.animate(s.frames, { duration: s.duration });
  }

  /* ==========================================================================
     Стрелка компаса в логотипе — маятник с затуханием.
     Качается от прокрутки страницы и от наведения, успокаивается к северу.
     ========================================================================== */
  const needles = $$('.brand__mark svg').map((svg) => ({ svg, s: { x: 0, v: 0 } }));
  let needleRaf = 0;
  let needleT = 0;
  function needleFrame(t) {
    const dt = Math.min(0.05, (t - needleT) / 1000 || 1 / 60);
    needleT = t;
    let moving = false;
    needles.forEach((n) => {
      n.s = C.springStep(n.s, dt, 38, 1.7);
      if (C.springAtRest(n.s, 0.05)) {
        n.s = { x: 0, v: 0 };
        n.svg.style.rotate = '';
      } else {
        moving = true;
        n.svg.style.rotate = n.s.x.toFixed(2) + 'deg';
      }
    });
    needleRaf = moving ? requestAnimationFrame(needleFrame) : 0;
  }
  function kickNeedles(v, only) {
    if (!full()) return;
    needles.forEach((n) => {
      if (only && n.svg !== only) return;
      n.s.v = Math.max(-2400, Math.min(2400, n.s.v + v));
    });
    if (!needleRaf) {
      needleT = performance.now();
      needleRaf = requestAnimationFrame(needleFrame);
    }
  }
  let lastY = window.scrollY;
  window.addEventListener(
    'scroll',
    () => {
      const dy = window.scrollY - lastY;
      lastY = window.scrollY;
      if (Math.abs(dy) > 1) kickNeedles(Math.max(-60, Math.min(60, dy)) * 2.2);
    },
    { passive: true }
  );
  $$('.brand').forEach((b) => b.addEventListener('pointerenter', () => kickNeedles(260, $('.brand__mark svg', b))));

  /* ==========================================================================
     Резинка на мини-компасе главной: точку можно оттянуть — она тянется
     с сопротивлением и пружиной возвращается на своё настоящее место.
     Короткое нажатие по-прежнему открывает карточку партии.
     ========================================================================== */
  (function rubberDots() {
    const plane = $('#heroPlane');
    if (!plane) return;
    const MAX = 38;
    const THRESHOLD = 6;
    let drag = null;
    let swallowClick = false;

    function springBack(b, x, y) {
      let sx = { x, v: 0 };
      let sy = { x: y, v: 0 };
      let t0 = performance.now();
      const frame = (t) => {
        const dt = Math.min(0.05, (t - t0) / 1000);
        t0 = t;
        sx = C.springStep(sx, dt, 240, 9);
        sy = C.springStep(sy, dt, 240, 9);
        if (C.springAtRest(sx, 0.3) && C.springAtRest(sy, 0.3)) {
          b.style.translate = '';
          b.classList.remove('is-pulled');
          b.__bpcSpring = 0;
          return;
        }
        b.style.translate = `${sx.x.toFixed(1)}px ${sy.x.toFixed(1)}px`;
        b.__bpcSpring = requestAnimationFrame(frame);
      };
      b.__bpcSpring = requestAnimationFrame(frame);
    }

    plane.addEventListener('pointerdown', (e) => {
      if (!full() || e.button > 0) return;
      const b = e.target.closest('.mdot');
      if (!b) return;
      cancelAnimationFrame(b.__bpcSpring);
      drag = { b, id: e.pointerId, x0: e.clientX, y0: e.clientY, on: false, x: 0, y: 0 };
    });
    plane.addEventListener('pointermove', (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const dx = e.clientX - drag.x0;
      const dy = e.clientY - drag.y0;
      const d = Math.hypot(dx, dy);
      if (!drag.on) {
        if (d < THRESHOLD) return;
        drag.on = true;
        drag.b.classList.add('is-pulled');
        try {
          drag.b.setPointerCapture(drag.id);
        } catch (err) {
          /* указатель уже отпущен */
        }
      }
      const k = d ? C.rubber(d, MAX) / d : 0;
      drag.x = dx * k;
      drag.y = dy * k;
      drag.b.style.translate = `${drag.x.toFixed(1)}px ${drag.y.toFixed(1)}px`;
    });
    const end = (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const { b, on, x, y } = drag;
      drag = null;
      if (!on) return;
      swallowClick = e.type === 'pointerup';
      setTimeout(() => (swallowClick = false), 0);
      springBack(b, x, y);
    };
    plane.addEventListener('pointerup', end);
    plane.addEventListener('pointercancel', end);
    // Отпущенная после оттягивания точка не открывает карточку
    plane.addEventListener(
      'click',
      (e) => {
        if (!swallowClick) return;
        swallowClick = false;
        e.stopPropagation();
        e.preventDefault();
      },
      true
    );
  })();

  /* ==========================================================================
     Рисунки народных символов (декоративные, aria-hidden)
     ========================================================================== */
  const petal = 'M16 15C14.6 11 13.2 8 12.6 4.6l1.8 1 .8-2 .8 1.8.8-1.8.8 1.8.8-2 1.8 1C18.8 8 17.4 11 16 15z';
  const ART = {
    vasilki:
      '<svg viewBox="0 0 32 32">' +
      Array.from({ length: 8 }, (_, i) => `<path d="${petal}" fill="${i % 2 ? '#5a88e8' : '#3565cf'}" transform="rotate(${i * 45} 16 16)"/>`).join('') +
      '<circle cx="16" cy="16" r="3.6" fill="#2b2466"/><circle cx="15" cy="15" r=".8" fill="#9db4f2"/><circle cx="17.2" cy="16.4" r=".7" fill="#9db4f2"/></svg>',
    lyon:
      '<svg viewBox="0 0 32 32">' +
      Array.from({ length: 5 }, (_, i) => `<ellipse cx="16" cy="8.6" rx="5.4" ry="7.2" fill="#8fb4ec" stroke="#5f86c9" stroke-width=".6" transform="rotate(${i * 72} 16 16)"/>`).join('') +
      Array.from({ length: 5 }, (_, i) => `<path d="M16 16V5" stroke="#5f86c9" stroke-width=".5" transform="rotate(${i * 72} 16 16)"/>`).join('') +
      '<circle cx="16" cy="16" r="2.6" fill="#f2d16b"/></svg>',
    paparac:
      '<svg viewBox="0 0 32 32"><path d="M16 30c0-8-1-17 2-26" stroke="#3f7d3a" stroke-width="1.6" fill="none" stroke-linecap="round"/>' +
      [7, 11, 15, 19, 23]
        .map((y, i) => {
          const len = 7.5 - i * 1.1;
          return `<ellipse cx="${16.6 - len / 2}" cy="${y}" rx="${len / 2}" ry="1.5" fill="#4f9a47" transform="rotate(-18 16.6 ${y})"/><ellipse cx="${17 + len / 2}" cy="${y - 1}" rx="${len / 2}" ry="1.5" fill="#5fae55" transform="rotate(18 17 ${y - 1})"/>`;
        })
        .join('') +
      '</svg>',
    kvetka:
      '<svg viewBox="0 0 32 32"><circle class="kvetka__glow" cx="16" cy="16" r="14" fill="#ffd65a" opacity=".3"/>' +
      Array.from({ length: 6 }, (_, i) => `<path d="M16 16C12 12 12.5 5.5 16 3c3.5 2.5 4 9 0 13z" fill="${i % 2 ? '#ff9f43' : '#ff6b3d'}" transform="rotate(${i * 60} 16 16)"/>`).join('') +
      '<circle cx="16" cy="16" r="3.2" fill="#fff3b0"/></svg>',
    busel:
      '<svg viewBox="0 0 140 70">' +
      '<g class="busel__wing busel__wing--far"><path d="M52 35L60 13l17-2 5 24z" fill="#e8ebf0"/><path d="M60 13l-5-11 6 2 3-4 5 5 4-3 4 9z" fill="#2a2d33"/></g>' +
      '<path d="M44 36L10 41M44 38L12 45" stroke="#d2402f" stroke-width="2.2" stroke-linecap="round"/>' +
      '<path d="M40 35l-12-3 3 5z" fill="#2a2d33"/>' +
      '<ellipse cx="58" cy="36" rx="20" ry="7.5" fill="#fff" stroke="#c9ced7" stroke-width=".8"/>' +
      '<path d="M74 33q12-4 22-5" stroke="#fff" stroke-width="5" stroke-linecap="round" fill="none"/>' +
      '<path d="M74 33q12-4 22-5" stroke="#c9ced7" stroke-width=".6" fill="none" transform="translate(0 2.6)"/>' +
      '<circle cx="97" cy="28" r="3.8" fill="#fff" stroke="#c9ced7" stroke-width=".6"/><circle cx="98.4" cy="27" r=".8" fill="#222"/>' +
      '<path d="M100 27l18 3.2-18 1.4z" fill="#d2402f"/>' +
      '<g class="busel__wing busel__wing--near"><path d="M50 36L59 12l18-2 5 26z" fill="#fff" stroke="#c9ced7" stroke-width=".8"/><path d="M59 12l-5-11 6 2 3-4 5 5 4-3 5 9z" fill="#1d1f24"/></g>' +
      '</svg>',
    zubr:
      '<svg viewBox="0 0 130 76">' +
      '<g class="zubr__legs zubr__legs--a"><rect x="28" y="46" width="7" height="22" rx="3" fill="#3b2819"/><rect x="80" y="46" width="8" height="22" rx="3" fill="#3b2819"/></g>' +
      '<g class="zubr__legs zubr__legs--b"><rect x="38" y="46" width="7" height="22" rx="3" fill="#4a3322"/><rect x="90" y="46" width="8" height="22" rx="3" fill="#4a3322"/></g>' +
      '<path d="M18 30q-6 4-8 14" stroke="#3b2819" stroke-width="2.4" fill="none" stroke-linecap="round"/><path d="M10 44l-2 6 5-3z" fill="#3b2819"/>' +
      '<path d="M18 38c0-14 14-20 30-20 10-10 34-12 46 0 8 8 8 18 6 26-2 6-8 8-14 8H30c-8 0-12-6-12-14z" fill="#5a3d2b"/>' +
      '<path d="M66 12c14-4 30 2 36 16 4 10 0 22-6 24-6-8-10-16-12-26-4-6-10-10-18-14z" fill="#43291a"/>' +
      '<ellipse cx="106" cy="42" rx="11" ry="9.5" fill="#43291a"/>' +
      '<path d="M100 48l3 14 7-12z" fill="#2f1d12"/>' +
      '<path d="M104 34q2-8 9-7" stroke="#e8dcc4" stroke-width="2.4" fill="none" stroke-linecap="round"/>' +
      '<circle cx="110" cy="39" r="1.2" fill="#f2e6cf"/><ellipse cx="116" cy="45" rx="2" ry="1.4" fill="#2f1d12"/>' +
      '</svg>',
    rushnik:
      '<svg viewBox="0 0 32 32"><rect x="3" y="3" width="26" height="26" rx="3" fill="#faf7f0" stroke="#d9d2c3"/>' +
      '<path d="M16 6l6 6-6 6-6-6z M16 14l6 6-6 6-6-6z" fill="none" stroke="#a8322d" stroke-width="1.6"/><path d="M16 9.5l2.5 2.5-2.5 2.5-2.5-2.5z" fill="#a8322d"/><path d="M16 17.5l2.5 2.5-2.5 2.5-2.5-2.5z" fill="#a8322d"/></svg>',
    draniki:
      '<svg viewBox="0 0 32 32"><ellipse cx="16" cy="17.5" rx="13.5" ry="11" fill="#c98d2e"/><ellipse cx="16" cy="16.6" rx="12" ry="9.6" fill="#e3b04f"/>' +
      [[9, 15], [13, 20], [20, 19], [23, 14], [17, 12], [11, 19.5], [21, 22]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1" fill="#b77a24"/>`).join('') +
      '<path d="M11 13.2c1.4-3.2 8.6-3.2 10 0 .8 2-2 3.4-5 3.4s-5.8-1.4-5-3.4z" fill="#fbf7ee"/><circle cx="14" cy="12.6" r=".8" fill="#fff"/></svg>',
    bulba:
      '<svg viewBox="0 0 32 32"><path d="M5.5 17.5C5 11 10 7 16.5 7S27 10.5 27 16s-4 10-11 10S6 23 5.5 17.5z" fill="#b48650"/>' +
      '<path d="M8.5 16.5c.4-4.5 4-7 8.5-7" stroke="#d6ae78" stroke-width="1.6" fill="none" stroke-linecap="round"/>' +
      [[12, 19], [19, 13], [21, 20], [15, 23]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="1.1" ry=".7" fill="#7b5628"/>`).join('') +
      '</svg>',
    pavuk:
      '<svg viewBox="0 0 32 32"><g stroke="#c49a42" stroke-width="1.1" fill="none" stroke-linejoin="round"><path d="M16 2.5L27 16 16 29.5 5 16z"/><path d="M16 2.5v27M5 16h22"/><path d="M16 9l5.6 7-5.6 7-5.6-7z"/></g>' +
      [[16, 2.5], [27, 16], [16, 29.5], [5, 16], [16, 16]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.5" fill="#e2b95e"/>`).join('') +
      '</svg>',
    vyanok:
      '<svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="10.5" fill="none" stroke="#4f8f3f" stroke-width="3"/>' +
      Array.from({ length: 8 }, (_, i) => {
        const a = (i / 8) * Math.PI * 2;
        const x = (16 + Math.cos(a) * 10.5).toFixed(1);
        const y = (16 + Math.sin(a) * 10.5).toFixed(1);
        const c = ['#3565cf', '#f2d16b', '#e0574f', '#f5f1e6'][i % 4];
        return `<circle cx="${x}" cy="${y}" r="2.6" fill="${c}"/><circle cx="${x}" cy="${y}" r=".9" fill="#f7d774"/>`;
      }).join('') +
      '</svg>',
  };
  // Значок находки: у папараці — сам расцветший цветок
  const ICON = { ...ART, paparac: ART.kvetka };
  const flaxStem = (h, sway) =>
    `<svg viewBox="0 0 40 ${h}" style="--sway:${sway}deg"><path class="flax__stem" pathLength="1" d="M20 ${h}C${18 + sway / 3} ${h * 0.66} ${22 - sway / 3} ${h * 0.33} 20 22" stroke="#5e8c3a" stroke-width="1.8" fill="none" stroke-linecap="round"/>` +
    `<path class="flax__leaf" d="M20 ${h * 0.55}q-8-3-10-10q8 2 10 10z" fill="#6f9e45"/><path class="flax__leaf" d="M20 ${h * 0.75}q8-3 10-10q-8 2-10 10z" fill="#6f9e45"/>` +
    `<g class="flax__flower"><g transform="translate(4 6)">${ART.lyon.replace('<svg viewBox="0 0 32 32">', '').replace('</svg>', '')}</g></g></svg>`;

  /* ==========================================================================
     Коллекция находок: bpc-eggs в localStorage
     ========================================================================== */
  const EGGS = [
    {
      id: 'vasilki',
      name: 'Васількі',
      text: 'Василёк — любимый полевой цветок Беларуси, символ родных просторов и памяти.',
      hint: 'Логотип любит, когда по нему стучат много раз подряд.',
    },
    {
      id: 'busel',
      name: 'Бусел',
      text: 'Аист — птица-оберег: считается, что он приносит в дом счастье и достаток.',
      hint: 'Напечатайте на клавиатуре, как по-белорусски зовут аиста.',
    },
    {
      id: 'zubr',
      name: 'Зубр',
      text: 'Зубр живёт в Беловежской пуще и считается символом силы и стойкости.',
      hint: 'Хозяин пущи откликается на своё имя. А ещё он приходит, если подержать узор в самом низу страницы.',
    },
    {
      id: 'rushnik',
      name: 'Рушнік',
      text: 'Вышитый рушник — оберег; у каждого ромба и звезды в узоре свой смысл.',
      hint: 'Узор в самом низу страницы можно развернуть.',
    },
    {
      id: 'paparac',
      name: 'Папараць-кветка',
      text: 'По купальскому поверью цветок папоротника распускается одну ночь в году и приносит счастье тому, кто его найдёт.',
      hint: 'Дочитайте «Историю» до самого конца — там что-то растёт.',
    },
    {
      id: 'lyon',
      name: 'Лён',
      text: 'Голубое поле льна — один из самых узнаваемых образов Беларуси.',
      hint: 'Ответьте на все вопросы теста.',
    },
    {
      id: 'draniki',
      name: 'Дранікі',
      text: 'Дранікі — картофельные оладьи со сметаной, самое известное блюдо белорусской кухни.',
      hint: 'Проголодались? Напечатайте название главного белорусского блюда.',
    },
    {
      id: 'bulba',
      name: 'Бульба',
      text: 'Бульба — так по-белорусски называют картофель. О ней поют песни и шутят сами белорусы.',
      hint: 'Напечатайте, как по-белорусски называется картошка.',
    },
    {
      id: 'pavuk',
      name: 'Саламяны павук',
      text: 'Саламяны павук — подвесное украшение из соломы. Его вешали в хате как оберег и знак гармонии мира.',
      hint: 'Трижды нажмите в самый центр большого компаса — туда, где сходятся оси.',
    },
    {
      id: 'vyanok',
      name: 'Купальскі вянок',
      text: 'На Купалле плетут венки из полевых цветов и трав и пускают их по воде.',
      hint: 'Досмотрите 3D-пролёт над компасом до конца. Или напечатайте название летнего праздника.',
    },
  ];
  const eggById = Object.fromEntries(EGGS.map((e) => [e.id, e]));
  const KEY = 'bpc-eggs';

  function found() {
    try {
      const arr = JSON.parse(A.storage(KEY) || '[]');
      return Array.isArray(arr) ? EGGS.map((e) => e.id).filter((id) => arr.includes(id)) : [];
    } catch (e) {
      return [];
    }
  }

  function discover(id) {
    const egg = eggById[id];
    if (!egg) return;
    const was = found();
    const isNew = !was.includes(id);
    const now = isNew ? was.concat(id) : was;
    if (isNew) A.storage(KEY, JSON.stringify(now));
    toast(egg, isNew ? `Секрет найден · ${now.length} из ${EGGS.length}` : 'Секрет');
    if (T) T.announce(`${isNew ? 'Секрет найден' : 'Секрет'}: ${egg.name}. ${egg.text}${isNew ? ` Найдено ${now.length} из ${EGGS.length}.` : ''}`);
    renderCollection();
    document.dispatchEvent(new CustomEvent('bpc:egg', { detail: { id, isNew, found: now } }));
  }

  /* ---------- Тост с символом ---------- */
  let toastEl = null;
  let toastTimer = 0;
  function toast(egg, kicker) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'fun-toast';
      // Текст уже прочитан через #announcer — второй раз диктору его не даём
      toastEl.setAttribute('aria-hidden', 'true');
      document.body.appendChild(toastEl);
    }
    toastEl.innerHTML = `<span class="fun-toast__icon">${ICON[egg.id]}</span><span class="fun-toast__body"><small>${kicker}</small><b>${egg.name}</b><span>${egg.text}</span></span>`;
    toastEl.classList.remove('is-on');
    void toastEl.offsetWidth;
    toastEl.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('is-on'), 5200);
  }

  /* ---------- Слой для полётов ---------- */
  function layer(cls) {
    const el = document.createElement('div');
    el.className = 'fun-layer ' + cls;
    el.setAttribute('aria-hidden', 'true');
    document.body.appendChild(el);
    return el;
  }

  /* ==========================================================================
     1. Васількі — 7 быстрых нажатий на логотип в шапке
     ========================================================================== */
  function vasilki() {
    discover('vasilki');
    if (!full()) return;
    kickNeedles(1800);
    const box = layer('fun-rain');
    const W = window.innerWidth;
    const H = window.innerHeight;
    const n = W < 600 ? 18 : 30;
    const ps = Array.from({ length: n }, () => {
      const size = 18 + Math.random() * 16;
      const el = document.createElement('span');
      el.className = 'fun-flower';
      el.style.width = el.style.height = size + 'px';
      el.innerHTML = ART.vasilki;
      box.appendChild(el);
      return {
        el,
        p: {
          x: Math.random() * (W - size),
          y: -size - Math.random() * H * 0.6,
          vx: (Math.random() - 0.5) * 160,
          vy: Math.random() * 120,
          vr: (Math.random() - 0.5) * 540,
          r: Math.random() * 360,
        },
        floor: H - size - 2,
      };
    });
    let t0 = performance.now();
    const start = t0;
    const frame = (t) => {
      const dt = Math.min(0.04, (t - t0) / 1000);
      t0 = t;
      const age = (t - start) / 1000;
      ps.forEach((o) => {
        o.p = C.particleStep(o.p, dt, { g: 1500, drag: 0.5, floor: o.floor, bounce: 0.55, friction: 0.82, rest: 60 });
        o.el.style.transform = `translate(${o.p.x.toFixed(1)}px, ${o.p.y.toFixed(1)}px) rotate(${o.p.r.toFixed(1)}deg)`;
      });
      box.style.opacity = age > 3.6 ? Math.max(0, 1 - (age - 3.6) / 0.8) : 1;
      if (age < 4.4 && full()) requestAnimationFrame(frame);
      else box.remove();
    };
    requestAnimationFrame(frame);
  }

  const clicks = [];
  const navBrand = $('#nav .brand');
  if (navBrand) {
    navBrand.addEventListener('click', () => {
      const now = performance.now();
      clicks.push(now);
      while (clicks.length && now - clicks[0] > 3000) clicks.shift();
      if (full()) kickNeedles(420, $('.brand__mark svg', navBrand));
      if (clicks.length >= 7) {
        clicks.length = 0;
        vasilki();
      }
    });
  }

  /* ==========================================================================
     2. Бусел и 3. Зубр — слова, набранные на клавиатуре
     ========================================================================== */
  function busel() {
    discover('busel');
    if (!full()) return;
    const box = layer('fun-sky');
    const bird = document.createElement('div');
    bird.className = 'fun-busel';
    bird.innerHTML = ART.busel;
    box.appendChild(bird);
    const W = window.innerWidth;
    const H = window.innerHeight;
    const y0 = H * (0.14 + Math.random() * 0.12);
    const frames = Array.from({ length: 13 }, (_, i) => {
      const k = i / 12;
      return { transform: `translate(${(-170 + (W + 200) * k).toFixed(0)}px, ${(y0 + Math.sin(k * Math.PI * 2.5) * 26 - k * 40).toFixed(0)}px) rotate(${(-Math.cos(k * Math.PI * 2.5) * 5).toFixed(1)}deg)` };
    });
    bird.animate(frames, { duration: 7000, easing: 'linear' }).onfinish = () => box.remove();
  }

  function zubr() {
    discover('zubr');
    if (!full()) return;
    const box = layer('fun-ground');
    const beast = document.createElement('div');
    beast.className = 'fun-zubr';
    beast.innerHTML = ART.zubr;
    box.appendChild(beast);
    const W = window.innerWidth;
    beast.animate([{ transform: 'translateX(-150px)' }, { transform: `translateX(${W + 20}px)` }], { duration: Math.max(7000, W * 7), easing: 'linear' }).onfinish = () => box.remove();
  }

  const WORDS = {
    бусел: busel,
    busel: busel,
    зубр: zubr,
    zubr: zubr,
    дранікі: draniki,
    драники: draniki,
    draniki: draniki,
    бульба: bulba,
    bulba: bulba,
    купалле: vyanok,
    купалье: vyanok,
    kupalle: vyanok,
  };
  const typed = { s: '', t: 0 };
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey || e.repeat || !e.key || e.key.length !== 1) return;
    const el = e.target;
    if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
    if (blocking()) return;
    const now = performance.now();
    if (now - typed.t > 1500) typed.s = '';
    typed.t = now;
    typed.s = (typed.s + e.key.toLowerCase()).slice(-8);
    for (const w in WORDS) {
      if (typed.s.endsWith(w)) {
        typed.s = '';
        WORDS[w]();
        return;
      }
    }
  });

  /* ==========================================================================
     4. Рушнік — нажатие на орнамент в подвале (долгое нажатие зовёт зубра)
     ========================================================================== */
  (function rushnik() {
    const orn = $('.footer .ornament');
    if (!orn) return;
    let pattern = 0;
    let hold = 0;
    let held = false;
    orn.addEventListener('pointerdown', (e) => {
      if (e.button > 0) return;
      held = false;
      clearTimeout(hold);
      hold = setTimeout(() => {
        held = true;
        zubr();
      }, 900);
    });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => orn.addEventListener(ev, () => clearTimeout(hold)));
    orn.addEventListener('click', () => {
      if (held) {
        held = false;
        return;
      }
      pattern = (pattern + 1) % 3;
      orn.dataset.pattern = pattern;
      if (full() && hasScale) {
        const s = springFrames('scale', 0, 1, 170, 12, (v) => `${Math.max(0, v).toFixed(3)} 1`);
        orn.animate(s.frames, { duration: s.duration });
      }
      discover('rushnik');
    });
  })();

  /* ==========================================================================
     5. Папараць-кветка — в самом конце «Истории». На Купалле светится сама.
     ========================================================================== */
  (function paparac() {
    const wrap = $('#timeline .tl-wrap');
    if (!wrap) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'fern';
    btn.setAttribute('aria-label', 'Папоротник в конце истории — что будет, если нажать?');
    btn.innerHTML = `<span class="fern__leaf" aria-hidden="true">${ART.paparac}</span><span class="fern__flower" aria-hidden="true">${ART.kvetka}</span>`;
    wrap.appendChild(btn);
    const d = new Date();
    if (d.getMonth() === 6 && (d.getDate() === 6 || d.getDate() === 7)) btn.classList.add('is-kupalle');
    btn.addEventListener('click', () => {
      btn.classList.add('is-bloom');
      btn.setAttribute('aria-label', 'Папараць-кветка расцвела');
      discover('paparac');
      if (full()) sparks(btn);
    });
  })();

  function sparks(from) {
    const r = from.getBoundingClientRect();
    const box = layer('fun-sparks');
    const ps = Array.from({ length: 16 }, (_, i) => {
      const el = document.createElement('span');
      el.className = 'fun-spark';
      box.appendChild(el);
      const a = (i / 16) * Math.PI * 2;
      const sp = 160 + Math.random() * 160;
      return { el, p: { x: r.left + r.width / 2, y: r.top + r.height / 2, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 120 } };
    });
    let t0 = performance.now();
    const start = t0;
    const frame = (t) => {
      const dt = Math.min(0.04, (t - t0) / 1000);
      t0 = t;
      const age = (t - start) / 1000;
      ps.forEach((o) => {
        o.p = C.particleStep(o.p, dt, { g: 520, drag: 1.6, floor: Infinity, bounce: 0, friction: 1 });
        o.el.style.transform = `translate(${o.p.x.toFixed(1)}px, ${o.p.y.toFixed(1)}px)`;
      });
      box.style.opacity = Math.max(0, 1 - age / 1.3);
      if (age < 1.3) requestAnimationFrame(frame);
      else box.remove();
    };
    requestAnimationFrame(frame);
  }

  /* ==========================================================================
     6. Лён — прорастает, когда тест пройден до конца
     ========================================================================== */
  function lyon() {
    discover('lyon');
    if (!full()) return;
    const box = layer('fun-field');
    const W = window.innerWidth;
    const n = W < 600 ? 5 : 9;
    for (let i = 0; i < n; i++) {
      const s = document.createElement('span');
      s.className = 'fun-flax';
      const h = 120 + Math.round(Math.random() * 90);
      s.style.left = ((i + 0.5) / n) * 100 + (Math.random() - 0.5) * 6 + '%';
      s.style.height = h + 'px';
      s.style.setProperty('--d', i * 90 + Math.round(Math.random() * 80) + 'ms');
      s.innerHTML = flaxStem(h, Math.round((Math.random() - 0.5) * 12));
      box.appendChild(s);
    }
    setTimeout(() => box.classList.add('is-out'), 4600);
    setTimeout(() => box.remove(), 5400);
  }
  document.addEventListener('bpc:quiz-done', lyon);

  /* ==========================================================================
     7. Дранікі и 8. Бульба — слова на клавиатуре; падают с «физикой»
     ========================================================================== */
  function fall(art, cls, n, sizeMin, sizeMax, opts) {
    const box = layer('fun-rain');
    const W = window.innerWidth;
    const H = window.innerHeight;
    const ps = Array.from({ length: n }, () => {
      const size = sizeMin + Math.random() * (sizeMax - sizeMin);
      const el = document.createElement('span');
      el.className = 'fun-flower ' + cls;
      el.style.width = el.style.height = size + 'px';
      el.innerHTML = art;
      box.appendChild(el);
      return {
        el,
        p: { x: Math.random() * (W - size), y: -size - Math.random() * H * 0.5, vx: (Math.random() - 0.5) * 220, vy: Math.random() * 100, vr: (Math.random() - 0.5) * 360, r: Math.random() * 360 },
        floor: H - size * 0.8,
      };
    });
    let t0 = performance.now();
    const start = t0;
    const frame = (t) => {
      const dt = Math.min(0.04, (t - t0) / 1000);
      t0 = t;
      const age = (t - start) / 1000;
      ps.forEach((o) => {
        o.p = C.particleStep(o.p, dt, { g: 1700, drag: 0.35, floor: o.floor, bounce: opts.bounce, friction: opts.friction, rest: 60 });
        o.el.style.transform = `translate(${o.p.x.toFixed(1)}px, ${o.p.y.toFixed(1)}px) rotate(${o.p.r.toFixed(1)}deg)`;
      });
      box.style.opacity = age > 3.8 ? Math.max(0, 1 - (age - 3.8) / 0.8) : 1;
      if (age < 4.6 && full()) requestAnimationFrame(frame);
      else box.remove();
    };
    requestAnimationFrame(frame);
  }

  function draniki() {
    discover('draniki');
    // Дранікі мягкие: почти не подпрыгивают и ложатся стопкой
    if (full()) fall(ART.draniki, 'fun-dranik', window.innerWidth < 600 ? 10 : 18, 34, 52, { bounce: 0.2, friction: 0.6 });
  }

  function bulba() {
    discover('bulba');
    // Бульба твёрдая: отскакивает и катится
    if (full()) fall(ART.bulba, 'fun-bulba', window.innerWidth < 600 ? 14 : 24, 26, 40, { bounce: 0.5, friction: 0.93 });
  }

  /* ==========================================================================
     9. Саламяны павук — три нажатия в центр большого компаса
     ========================================================================== */
  function pavuk() {
    discover('pavuk');
    if (!full()) return;
    const box = layer('fun-sky');
    const el = document.createElement('div');
    el.className = 'fun-pavuk';
    el.innerHTML = `<span class="fun-pavuk__thread"></span><span class="fun-pavuk__body">${ART.pavuk}</span>`;
    el.style.left = Math.round(window.innerWidth * (0.3 + Math.random() * 0.4)) + 'px';
    box.appendChild(el);
    const drop = Math.round(window.innerHeight * 0.38);
    // Спускается на нитке с пружинным перелётом, покачивается и поднимается обратно
    const s = springFrames('y', -drop - 80, 0, 120, 7, (v) => v);
    const frames = s.frames.map((f, i) => ({
      transform: `translateY(${(drop + Number(f.y)).toFixed(1)}px) rotate(${(Math.sin(i / 3) * 6 * Math.exp(-i / 40)).toFixed(2)}deg)`,
    }));
    const down = el.animate(frames, { duration: s.duration, fill: 'forwards' });
    down.onfinish = () => {
      setTimeout(() => {
        el.animate([{ transform: `translateY(${drop}px)` }, { transform: 'translateY(-120px)' }], { duration: 1100, easing: 'cubic-bezier(0.5, 0, 0.75, 0)', fill: 'forwards' }).onfinish = () =>
          box.remove();
      }, 1800);
    };
  }

  (function pavukTrigger() {
    const plane = $('#plane');
    if (!plane) return;
    const taps = [];
    plane.addEventListener('click', (e) => {
      if (e.target.closest('.pdot, button, a')) return;
      const r = plane.getBoundingClientRect();
      const dx = (e.clientX - (r.left + r.width / 2)) / r.width;
      const dy = (e.clientY - (r.top + r.height / 2)) / r.height;
      if (Math.hypot(dx, dy) > 0.06) return;
      const now = performance.now();
      taps.push(now);
      while (taps.length && now - taps[0] > 2500) taps.shift();
      if (taps.length >= 3) {
        taps.length = 0;
        pavuk();
      }
    });
  })();

  /* ==========================================================================
     10. Купальскі вянок — досмотреть 3D-пролёт или напечатать «купалле»
     ========================================================================== */
  function vyanok() {
    discover('vyanok');
    if (!full()) return;
    const box = layer('fun-sky');
    const el = document.createElement('div');
    el.className = 'fun-vyanok';
    el.innerHTML = ART.vyanok;
    box.appendChild(el);
    const W = window.innerWidth;
    const H = window.innerHeight;
    // Венок плывёт по «воде» внизу экрана и покачивается на волнах
    const frames = Array.from({ length: 25 }, (_, i) => {
      const k = i / 24;
      return {
        transform: `translate(${(-90 + (W + 180) * k).toFixed(0)}px, ${(H - 110 + Math.sin(k * Math.PI * 6) * 8).toFixed(0)}px) rotate(${(Math.sin(k * Math.PI * 6) * 8).toFixed(1)}deg)`,
      };
    });
    el.animate(frames, { duration: Math.max(6000, W * 6), easing: 'linear' }).onfinish = () => box.remove();
  }
  document.addEventListener('bpc:intro-end', (e) => {
    if (e.detail && e.detail.completed) vyanok();
  });

  /* ==========================================================================
     Коллекция в настройках («Данные» → «Секреты»)
     ========================================================================== */
  function renderCollection() {
    const list = $('#eggList');
    const note = $('#eggStatus');
    if (!list || !note) return;
    const got = found();
    list.innerHTML = EGGS.map((e) =>
      got.includes(e.id)
        ? `<li class="egg is-found"><span class="egg__icon" aria-hidden="true">${ICON[e.id]}</span><span>${e.name}</span></li>`
        : '<li class="egg"><span class="egg__icon" aria-hidden="true">?</span><span class="sr-only">Ещё не найден</span></li>'
    ).join('');
    const next = EGGS.find((e) => !got.includes(e.id));
    note.textContent =
      got.length === EGGS.length
        ? `Найдены все ${EGGS.length} секретов. Дзякуй, што шукалі!`
        : `На сайте спрятаны ${EGGS.length} народных символов Беларуси. Найдено: ${got.length} из ${EGGS.length}. Подсказка: ${next.hint}`;
  }
  renderCollection();

  // Счётчики на странице в конце разгона слегка «кивают»
  document.addEventListener('bpc:counted', (e) => nod(e.detail));

  /* ---------- Привет из консоли ---------- */
  try {
    console.info(
      '%cПрывітанне! %cНа сайце схавана дзесяць народных сімвалаў Беларусі — паспрабуйце знайсці ўсе.',
      'font:600 14px sans-serif;color:#3565cf',
      'font:13px sans-serif'
    );
  } catch (e) {
    /* консоли нет */
  }

  window.BPCFun = { discover, found, eggs: EGGS.map((e) => e.id), nod, kickNeedles, vasilki, busel, zubr, lyon, draniki, bulba, pavuk, vyanok };
})();
