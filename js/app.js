/* ==========================================================================
   BelPolitCompass · Alpha 0.6 — компас, сайдбар-карта, общие утилиты
   ========================================================================== */
(function () {
  'use strict';

  const D = window.BPC;
  const C = window.BPCCore;
  const T = window.BPCTabs;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const root = document.documentElement;

  /* Режим анимаций уже выставлен на <html> (boot.js): full — все,
     reduced — только короткие переходы, off — никаких. */
  const mqReduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const noMotion = () => {
    const m = root.getAttribute('data-motion');
    return m ? m !== 'full' : mqReduce.matches;
  };
  // На узком экране карточка партии не переворачивается, а плавно сменяет список
  const mqNarrow = window.matchMedia('(max-width: 900px)');

  const parties = D.parties;
  const byId = Object.fromEntries(parties.map((p) => [p.id, p]));
  const axisById = Object.fromEntries(D.axes.map((a) => [a.id, a]));

  /* Цвета партий — CSS-переменные со своими значениями для светлой и тёмной
     темы и для палитры дальтоников. Везде дальше используется var(--p-<id>),
     поэтому точки и диаграммы перекрашиваются вместе с настройками. */
  (function partyColors() {
    const set = (key) => parties.map((p) => `--p-${p.id}:${p[key] || p.color}`).join(';');
    const css =
      `:root{${set('color')}}` +
      `@media (prefers-color-scheme: dark){:root:not([data-theme='light']){${set('colorDark')}}}` +
      `:root[data-theme='dark']{${set('colorDark')}}` +
      `:root[data-cvd='on']{${set('cvd')}}` +
      `@media (prefers-color-scheme: dark){:root[data-cvd='on']:not([data-theme='light']){${set('cvdDark')}}}` +
      `:root[data-cvd='on'][data-theme='dark']{${set('cvdDark')}}`;
    const style = document.createElement('style');
    style.id = 'bpcPartyColors';
    style.textContent = css;
    document.head.appendChild(style);
    parties.forEach((p) => {
      p.hex = p.color;
      p.color = `var(--p-${p.id})`;
    });
  })();

  /* ---------- Утилиты ---------- */
  const plural = C.plural;
  const seatWord = (n) => plural(n, ['мандат', 'мандата', 'мандатов']);
  const fmt = C.fmt;
  const fmt1 = C.fmt1;
  const isActive = (p) => p.status === 'active';
  const similarity = (a, b) => C.similarity(a, b, D.axes);
  // Пояснение для упрощённого режима: всегда в разметке, видно только при data-simple
  const simple = (text, cls = '') => `<span class="simple simple--inline${cls ? ' ' + cls : ''}">${text}</span>`;

  function countUp(el, to, dur = 1400) {
    if (noMotion()) {
      el.textContent = to;
      return;
    }
    const start = performance.now();
    const step = (t) => {
      const k = Math.min(1, (t - start) / dur);
      const e = 1 - Math.pow(1 - k, 4);
      el.textContent = Math.round(to * e);
      if (k < 1) requestAnimationFrame(step);
      else document.dispatchEvent(new CustomEvent('bpc:counted', { detail: el }));
    };
    requestAnimationFrame(step);
  }

  // storage(key) — прочитать, storage(key, val) — записать, storage(key, null) — удалить
  function storage(key, val) {
    try {
      if (val === undefined) return localStorage.getItem(key);
      if (val === null) return localStorage.removeItem(key);
      localStorage.setItem(key, val);
    } catch (e) {
      return null;
    }
  }

  // Разрешено ли запоминать (раздел «Приватность»). Читаем при каждом вызове —
  // настройка могла поменяться, а settings.js загружается позже app.js
  function allowed(field) {
    const B = window.BPCBoot;
    return !B || B.parse(storage(B.KEY))[field] !== false;
  }

  // Бета: спор о позиции партии — готовая форма issue на GitHub с заполненной партией
  const REPO = 'https://github.com/Arbuzyakaby/BelPolitCompass';
  function disputeUrl(p) {
    const q = new URLSearchParams({ template: 'position.yml', title: `Позиция: ${p.short}`, party: p.name });
    return `${REPO}/issues/new?${q.toString()}`;
  }

  const smooth = () => (noMotion() ? 'auto' : 'smooth');

  /* ---------- Шапка ---------- */
  const nav = $('#nav');
  const onScroll = () => nav.classList.toggle('is-scrolled', window.scrollY > 8);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---------- Анимации появления ----------
     Весь контент виден сразу. Когда блок приближается к экрану (или
     открывается его вкладка), он на мгновение прячется и плавно въезжает. */
  const approachObs =
    'IntersectionObserver' in window
      ? new IntersectionObserver(
          (entries) => {
            entries.forEach((en) => {
              if (!en.isIntersecting) return;
              approachObs.unobserve(en.target);
              const fn = en.target.__bpcPlay;
              delete en.target.__bpcPlay;
              if (fn) fn();
            });
          },
          { rootMargin: '0px 0px 20% 0px', threshold: 0 }
        )
      : null;

  function onApproach(el, play) {
    if (!el || noMotion() || !approachObs) return;
    el.__bpcPlay = play;
    approachObs.observe(el);
  }

  // Сброс без анимации → следующий кадр → анимация к состоянию покоя
  function replay(el, cls = 'is-prep') {
    el.classList.add(cls);
    void el.offsetWidth;
    requestAnimationFrame(() => el.classList.remove(cls));
  }

  function observeReveal(scope = document) {
    $$('.reveal', scope).forEach((el) => {
      const r = el.getBoundingClientRect();
      // Блоки открытой вкладки на первом экране прячем сразу — их появление часть загрузки
      if (!noMotion() && approachObs && r.height && r.top < window.innerHeight) el.classList.add('is-prep');
      onApproach(el, () => replay(el));
    });
  }

  // Страховка: что бы ни случилось с наблюдателем, через 1,5 с всё видно
  setTimeout(() => $$('.is-prep').forEach((el) => el.classList.remove('is-prep')), 1500);

  /* ---------- Главная ---------- */
  $$('[data-updated]').forEach((el) => (el.textContent = D.updated));
  $$('[data-version]').forEach((el) => (el.textContent = D.version));

  /* Мини-компас: вектор × власть */
  (function heroMini() {
    const box = $('#heroPlane');
    if (!box) return;
    const P = 8;
    const pct = (v) => P + ((v + 10) / 20) * (100 - P * 2);
    // Партии с одинаковыми координатами слегка разводим по горизонтали
    const seen = {};
    const shift = parties.map((p) => {
      const key = p.pos.vector + ':' + p.pos.power;
      const n = (seen[key] = (seen[key] || 0) + 1) - 1;
      return n === 0 ? 0 : (n % 2 ? 1 : -1) * Math.ceil(n / 2) * 3.2;
    });
    box.innerHTML =
      '<span class="mini__ax mini__ax--h"></span><span class="mini__ax mini__ax--v"></span>' +
      parties
        .map((p, i) => {
          const s = isActive(p) ? 10 + Math.sqrt(p.seats) * 2.4 : 12;
          // Если прямо под точкой есть соседняя партия, подпись ставим слева
          const crowded = parties.some(
            (q) => q !== p && isActive(q) && q.pos.power < p.pos.power && p.pos.power - q.pos.power <= 1.5 && Math.abs(q.pos.vector - p.pos.vector) <= 1.5
          );
          return `<button class="mdot${isActive(p) ? ' is-active' : ''}${crowded ? ' is-lbl-left' : ''}" type="button" data-id="${p.id}"
            style="--c:${p.color};--s:${s}px;left:${pct(p.pos.vector) + shift[i]}%;top:${100 - pct(p.pos.power)}%;--i:${i}"
            aria-label="${p.name}: вектор ${fmt(p.pos.vector)}, власть ${fmt(p.pos.power)}"><i></i>${isActive(p) ? `<span aria-hidden="true">${p.abbr}</span>` : ''}<em aria-hidden="true">${p.short}</em></button>`;
        })
        .join('');

    // Партии «вне системы» теснятся в одном углу: их области нажатия (24 × 24)
    // не должны перекрываться (WCAG 2.5.8), поэтому точки слегка разводим —
    // той же раскладкой, что и на большом компасе. Пересчёт — при смене ширины.
    const dots = $$('.mdot', box);
    const GAP = 2;
    let placedW = 0;
    function place() {
      const W = box.clientWidth;
      if (!W || W === placedW) return;
      placedW = W;
      const boxes = parties.map((p, i) => {
        const hit = Math.max(isActive(p) ? 10 + Math.sqrt(p.seats) * 2.4 : 12, 24) + GAP;
        return { p: { x: pct(p.pos.vector) + shift[i], y: 100 - pct(p.pos.power) }, w: hit, up: hit / 2, down: hit / 2 };
      });
      C.resolveOverlaps(boxes, 100 / W);
      boxes.forEach((b, i) => {
        dots[i].style.left = b.p.x.toFixed(2) + '%';
        dots[i].style.top = b.p.y.toFixed(2) + '%';
      });
    }
    place();
    let placeRaf = 0;
    window.addEventListener('resize', () => {
      cancelAnimationFrame(placeRaf);
      placeRaf = requestAnimationFrame(place);
    });
    // Главная могла быть скрыта при загрузке (ширина 0) — разложим при открытии
    document.addEventListener('bpc:tab', () => requestAnimationFrame(place));

    box.addEventListener('click', (e) => {
      const b = e.target.closest('.mdot');
      if (b) openParty(b.dataset.id);
    });
  })();

  /* Полоска парламента: 110 мест */
  (function heroStrip() {
    const box = $('#heroStrip');
    if (!box) return;
    const P = D.parliament;
    const groups = P.order.map((id) => byId[id]).concat({ short: 'Беспартийные', color: 'var(--np)', seats: P.nonPartisan });
    const cells = groups.map((g) => `<span style="--c:${g.color};flex:${g.seats}"></span>`).join('');
    const label = groups.map((g) => `${g.short} — ${g.seats}`).join(', ');
    box.innerHTML = `
      <div class="strip__head">
        <b>${P.title}, ${P.convocation}</b>
        <span>${P.total} мест · выборы ${P.elected}</span>
      </div>
      <div class="strip__bar" role="img" aria-label="Распределение ${P.total} мест: ${label}">${cells}</div>
      <ul class="strip__legend">
        ${groups.map((g) => `<li style="--c:${g.color}"><i></i>${g.short} <b>${g.seats}</b></li>`).join('')}
      </ul>`;
  })();

  /* ==========================================================================
     Сайдбар: список партий (лицевая сторона)
     ========================================================================== */
  const list = $('#partyList');
  const maxSeats = Math.max(...parties.map((p) => p.seats));

  list.innerHTML = parties
    .map((p, i) => {
      const st = D.statuses[p.status];
      const w = p.seats ? (p.seats / maxSeats) * 100 : 0;
      return `
      <li class="pcard-li" data-id="${p.id}">
        <button class="pcard" type="button" data-id="${p.id}" data-status="${p.status}" style="--c:${p.color};--i:${i};--w:${w}%">
          <span class="pcard__dot" aria-hidden="true"></span>
          <span class="pcard__body">
            <span class="pcard__name">${p.short}${isActive(p) ? '' : `<span class="pcard__status">${st.label}${p.statusYear ? ' ' + p.statusYear : ''}</span>`}</span>
            <span class="pcard__ideo">${p.ideology}</span>
            ${simple(p.plain)}
          </span>
          <span class="pcard__seats">
            <span class="pcard__num">${p.seats}</span>
            <span class="pcard__unit">${seatWord(p.seats)}</span>
          </span>
          <span class="pcard__bar" aria-hidden="true"><i></i></span>
        </button>
      </li>`;
    })
    .join('');

  const items = $$('.pcard-li', list);
  const cards = $$('.pcard', list);
  cards.forEach((c) => {
    c.addEventListener('click', () => openParty(c.dataset.id));
    c.addEventListener('pointerenter', () => setHover(c.dataset.id));
    c.addEventListener('pointerleave', () => setHover(null));
    c.addEventListener('focus', () => setHover(c.dataset.id));
    c.addEventListener('blur', () => setHover(null));
  });

  /* Сегментированный контрол с «глайдером».
     Кнопки с role="tab" получают aria-selected, остальные — aria-pressed. */
  function initSeg(seg, onChange) {
    const glider = $('.seg__glider', seg);
    const btns = () => $$('.seg__btn', seg);
    const move = () => {
      const btn = $('.seg__btn.is-active', seg);
      if (!btn || !glider || !btn.offsetWidth) return;
      glider.style.width = btn.offsetWidth + 'px';
      glider.style.height = btn.offsetHeight + 'px';
      glider.style.transform = `translate(${btn.offsetLeft}px, ${btn.offsetTop}px)`;
    };
    const select = (btn) => {
      btns().forEach((b) => {
        const on = b === btn;
        b.classList.toggle('is-active', on);
        if (b.getAttribute('role') === 'tab') {
          b.setAttribute('aria-selected', String(on));
          b.tabIndex = on ? 0 : -1;
        } else b.setAttribute('aria-pressed', String(on));
      });
      move();
      onChange(btn);
    };
    seg.addEventListener('click', (e) => {
      const btn = e.target.closest('.seg__btn');
      if (btn) select(btn);
    });
    // Стрелки внутри вкладок-сегментов
    seg.addEventListener('keydown', (e) => {
      const all = btns();
      const i = all.indexOf(document.activeElement);
      if (i < 0 || all[i].getAttribute('role') !== 'tab') return;
      let n = null;
      if (e.key === 'ArrowRight') n = (i + 1) % all.length;
      else if (e.key === 'ArrowLeft') n = (i - 1 + all.length) % all.length;
      else if (e.key === 'Home') n = 0;
      else if (e.key === 'End') n = all.length - 1;
      if (n === null) return;
      e.preventDefault();
      e.stopPropagation();
      all[n].focus();
      select(all[n]);
    });
    window.addEventListener('resize', move);
    requestAnimationFrame(move);
    if (document.fonts) document.fonts.ready.then(move);
    return move;
  }

  let statusFilter = 'all';
  const countBadge = $('#partyCount');
  initSeg($('#statusFilter'), (btn) => {
    statusFilter = btn.dataset.filter;
    applyFilter();
  });

  function passesFilter(p) {
    if (statusFilter === 'active') return isActive(p);
    if (statusFilter === 'inactive') return !isActive(p);
    return true;
  }

  function applyFilter() {
    let n = 0;
    items.forEach((li) => {
      const ok = passesFilter(byId[li.dataset.id]);
      li.classList.toggle('is-hidden', !ok);
      li.setAttribute('aria-hidden', String(!ok));
      $('.pcard', li).tabIndex = ok ? 0 : -1;
      if (ok) n++;
    });
    countUp(countBadge, n, 500);
    countBadge.title = `Показано партий: ${n}`;
  }
  countBadge.textContent = parties.length;

  /* ==========================================================================
     Карточка партии: лицевая сторона — список, оборотная — подробности.
     В покое видна только одна сторона, без 3D-преобразований: иначе
     браузеры (особенно на телефонах) не дают прокручивать списки пальцем.
     3D включается лишь на время анимации переворота.
     ========================================================================== */
  const flip = $('#flip');
  const inner = $('#flipInner');
  const front = $('#flipFront');
  const detail = $('#partyDetail');
  let onBack = false;
  let current = null;
  let flipAnim = null;

  function turn(toBack) {
    if (flipAnim) flipAnim.finish(); // незавершённый переворот доводим мгновенно
    const from = toBack ? front : detail;
    const to = toBack ? detail : front;
    onBack = toBack;
    flip.classList.toggle('is-back', toBack);
    to.hidden = false;
    if (noMotion() || !inner.animate) {
      from.hidden = true;
      return;
    }
    if (mqNarrow.matches) {
      from.hidden = true;
      flipAnim = to.animate(
        [
          { opacity: 0, transform: `translateX(${toBack ? 24 : -24}px)` },
          { opacity: 1, transform: 'none' },
        ],
        { duration: 380, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }
      );
      flipAnim.onfinish = () => (flipAnim = null);
      return;
    }
    flip.classList.add('is-3d');
    const a = toBack ? 0 : 180;
    flipAnim = inner.animate(
      [
        { transform: `rotateY(${a}deg)` },
        { transform: `rotateY(${a + 90}deg) scale(0.92)`, offset: 0.5 },
        { transform: `rotateY(${a + 180}deg)` },
      ],
      { duration: 900, easing: 'cubic-bezier(0.65, 0, 0.35, 1)' }
    );
    flipAnim.onfinish = () => {
      flipAnim = null;
      flip.classList.remove('is-3d');
      from.hidden = true;
    };
  }

  function openParty(id, dir, opts = {}) {
    const p = byId[id];
    if (!p) return;
    if (T && !T.isActive('compass')) T.go('#compass', { focus: false });
    const wasOnBack = onBack;
    current = id;
    renderDetail(p, wasOnBack ? dir || 1 : 0);
    if (!wasOnBack) turn(true);
    cards.forEach((c) => c.classList.toggle('is-selected', c.dataset.id === id));
    selectDot(id);
    if (T) T.announce(`Карточка партии «${p.short}»`);
    // Показать карточку, если она ушла за край экрана
    requestAnimationFrame(() => {
      const r = flip.getBoundingClientRect();
      const navH = nav.getBoundingClientRect().height;
      if (r.top < navH || r.top > window.innerHeight * 0.6) {
        window.scrollTo({ top: window.scrollY + r.top - navH - 12, behavior: smooth() });
      }
      if (opts.focus !== false) {
        const h = $('.pd__name', detail);
        if (h) h.focus({ preventScroll: true });
      }
    });
  }

  function closeDetail() {
    if (!onBack) return;
    const was = current;
    turn(false);
    current = null;
    cards.forEach((c) => c.classList.remove('is-selected'));
    selectDot(null);
    const c = cards.find((x) => x.dataset.id === was);
    if (c && c.tabIndex === 0) c.focus({ preventScroll: true });
  }

  function step(delta) {
    const visible = parties.filter(passesFilter);
    const pool = visible.length ? visible : parties;
    let i = pool.findIndex((p) => p.id === current);
    // Текущая партия скрыта фильтром — начинаем с края
    if (i < 0) i = delta > 0 ? -1 : 0;
    i = (i + delta + pool.length) % pool.length;
    openParty(pool[i].id, delta);
  }

  const campPlain = {
    gov: 'Провластная — поддерживает нынешнюю власть.',
    opp: 'Оппозиционная — выступает против нынешней власти.',
  };

  function renderDetail(p, dir) {
    const st = D.statuses[p.status];
    const pool = parties.filter(passesFilter);
    const idx = pool.findIndex((x) => x.id === p.id);
    const near = parties
      .filter((x) => x.id !== p.id)
      .map((x) => ({ x, s: similarity(p, x) }))
      .sort((a, b) => b.s - a.s)
      .slice(0, 3);

    const axes = D.axes
      .map((ax) => {
        const v = p.pos[ax.id];
        return `
        <div class="axisrow">
          <div class="axisrow__top"><span class="axisrow__name">${ax.name}</span><span class="axisrow__val">${fmt(v)}</span></div>
          <div class="axisrow__track" role="img" aria-label="${ax.name}: ${fmt(v)} по шкале от −10 (${ax.neg}) до +10 (${ax.pos})">
            <span class="axisrow__fill" data-v="${v}" style="left:50%;width:0"></span>
            <span class="axisrow__knob" data-v="${v}" style="left:50%"></span>
          </div>
          <div class="axisrow__poles" aria-hidden="true"><span>${ax.neg}</span><span>${ax.pos}</span></div>
          ${simple('Партия ' + C.plainPosition(ax, v) + '.')}
        </div>`;
      })
      .join('');

    detail.style.setProperty('--c', p.color);
    detail.innerHTML = `
      <div class="pd">
        <div class="pd__glow"></div>
        <div class="pd__bar">
          <button class="pd__back" type="button" data-act="back">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 18l-6-6 6-6" stroke-linecap="round" stroke-linejoin="round"/></svg>Все партии
          </button>
          <button class="tts-btn" type="button" data-tts-read="#partyDetail .pd__content" aria-label="Прочитать карточку вслух" title="Прочитать вслух">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9z" stroke-linejoin="round"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" stroke-linecap="round"/></svg>
          </button>
          <span class="pd__pos" aria-label="Партия ${idx + 1} из ${pool.length}">${idx < 0 ? '—' : idx + 1} / ${pool.length || parties.length}</span>
          <button class="pd__nav" type="button" data-act="prev" aria-label="Предыдущая партия">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 18l-6-6 6-6" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
          <button class="pd__nav" type="button" data-act="next" aria-label="Следующая партия">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
        </div>
        <div class="pd__scroll">
          <div class="pd__content${dir ? ' is-swapping' : ''}" style="--dir:${dir < 0 ? '-24px' : '24px'}">
            <div class="pd__hero">
              <div class="pd__mono" aria-hidden="true">${p.abbr}</div>
              <div>
                <h3 class="pd__name" tabindex="-1">${p.short}</h3>
                <div class="pd__full">${p.name}</div>
              </div>
            </div>
            <div class="pd__tags">
              <span class="tag tag--${st.tone}">${st.label}${p.statusYear ? ' в ' + p.statusYear : ''}</span>
              <span class="tag tag--${p.camp}">${p.camp === 'gov' ? 'Провластная' : 'Оппозиционная'}</span>
            </div>
            ${simple(`${st.plain} ${campPlain[p.camp]}`, 'simple--block')}
            <div class="pd__stats">
              <div class="pd__stat"><b>${p.seats}<small> / 110</small></b><span>${seatWord(p.seats)}</span></div>
              <div class="pd__stat"><b>${p.founded}</b><span>${p.foundedNote || 'основана'}</span></div>
              <div class="pd__stat"><b class="sm">${p.leader}</b><span>лидер</span></div>
            </div>
            ${simple(
              p.seats
                ? `У партии ${p.seats} ${seatWord(p.seats)} — ${p.seats} из 110 мест в парламенте. «${p.founded}» — год основания.`
                : `У партии нет мест в парламенте. «${p.founded}» — год основания.`,
              'simple--block'
            )}
            <p class="pd__about">${p.about}</p>
            ${simple(p.plain, 'simple--block')}
            <h4 class="pd__h">Идеология</h4>
            <p class="pd__about">${p.ideology}</p>
            ${simple('Идеология — набор главных идей, во что партия верит и чего добивается.', 'simple--block')}
            <h4 class="pd__h">Позиции на осях</h4>
            ${axes}
            <h4 class="pd__h">Ключевые тезисы</h4>
            <ul class="pd__points">${p.points.map((t) => `<li>${t}</li>`).join('')}</ul>
            <h4 class="pd__h">Ближайшие по взглядам</h4>
            ${simple('Партии, чьи взгляды ближе всего к этой. 100% — полное совпадение. Нажмите, чтобы открыть.', 'simple--block')}
            <div class="near">
              ${near
                .map(
                  (n) =>
                    `<button class="near__item" type="button" data-go="${n.x.id}" style="--c:${n.x.color}"><i aria-hidden="true"></i>${n.x.short}<span>${n.s}%<span class="sr-only"> сходства</span></span></button>`
                )
                .join('')}
            </div>
            <a class="pd__dispute" href="${disputeUrl(p)}" target="_blank" rel="noopener">Не согласны с оценкой? Напишите нам <span aria-hidden="true">↗</span><span class="sr-only"> (GitHub, новая вкладка)</span></a>
          </div>
        </div>
      </div>`;

    $('.pd__scroll', detail).scrollTop = 0;
    // Анимация шкал после отрисовки / переворота
    setTimeout(
      () => {
        $$('.axisrow__knob', detail).forEach((k) => (k.style.left = ((+k.dataset.v + 10) / 20) * 100 + '%'));
        $$('.axisrow__fill', detail).forEach((f) => {
          const v = +f.dataset.v;
          const pct = (Math.abs(v) / 20) * 100;
          f.style.left = v < 0 ? 50 - pct + '%' : '50%';
          f.style.width = pct + '%';
        });
      },
      dir || noMotion() ? 30 : 420
    );
  }

  detail.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act],[data-go]');
    if (!b) return;
    if (b.dataset.act === 'back') closeDetail();
    else if (b.dataset.act === 'prev') step(-1);
    else if (b.dataset.act === 'next') step(1);
    else if (b.dataset.go) openParty(b.dataset.go, 1);
  });

  // Клавиши работают, только пока открыта вкладка «Компас» и нет диалогов
  const blocking = () => root.classList.contains('has-sheet') || root.classList.contains('has-tour');
  document.addEventListener('keydown', (e) => {
    if (!onBack || blocking() || (T && !T.isActive('compass'))) return;
    if (e.target.closest && e.target.closest('input, textarea, select, .dd, [role="tablist"], [role="tab"]')) return;
    if (e.key === 'Escape') closeDetail();
    else if (e.key === 'ArrowRight') step(1);
    else if (e.key === 'ArrowLeft') step(-1);
  });

  /* Свайпы по карточке на тач-устройствах: только явно горизонтальные */
  let sx = null;
  let sy = null;
  detail.addEventListener(
    'touchstart',
    (e) => {
      sx = e.touches[0].clientX;
      sy = e.touches[0].clientY;
    },
    { passive: true }
  );
  detail.addEventListener(
    'touchend',
    (e) => {
      if (sx === null) return;
      const dx = e.changedTouches[0].clientX - sx;
      const dy = e.changedTouches[0].clientY - sy;
      if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.8) step(dx < 0 ? 1 : -1);
      sx = sy = null;
    },
    { passive: true }
  );

  /* ==========================================================================
     Компас
     ========================================================================== */
  const plane = $('#plane');
  const dotsBox = $('#dots');
  const tooltip = $('#tooltip');
  const hullSvg = $('#hulls');
  const showInactive = $('#toggleInactive');
  const showHulls = $('#toggleHulls');
  const toggleMe = $('#toggleMe');
  let me = null; // результат теста: { vector, power, economy, identity }

  /* Кастомный выпадающий список: кнопка + listbox, клавиатура, тема */
  const dropdowns = [];
  function Dropdown(el, onChange) {
    const id = el.id;
    el.insertAdjacentHTML(
      'beforeend',
      `<button class="dd__btn" type="button" id="${id}Btn" aria-haspopup="listbox" aria-expanded="false"
          aria-controls="${id}List" aria-labelledby="${id}Label ${id}Btn">
        <span class="dd__val"></span>
        <svg class="dd__chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10l5 5 5-5" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
      <ul class="dd__list" role="listbox" id="${id}List" tabindex="-1" aria-labelledby="${id}Label">
        ${D.axes
          .map(
            (a) => `<li class="dd__opt" role="option" id="${id}-${a.id}" data-v="${a.id}" aria-selected="false">
              <span class="dd__text"><span class="dd__name">${a.name}</span><span class="dd__poles">${a.neg} ↔ ${a.pos}</span>${simple(a.plain)}</span>
              <span class="dd__hint"></span>
              <svg class="dd__check" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </li>`
          )
          .join('')}
      </ul>`
    );
    const btn = $('.dd__btn', el);
    const lst = $('.dd__list', el);
    const opts = $$('.dd__opt', el);
    let val = D.axes[0].id;
    let active = 0;

    function paint() {
      $('.dd__val', btn).textContent = axisById[val].name;
      opts.forEach((o) => o.setAttribute('aria-selected', String(o.dataset.v === val)));
    }
    function highlight(i) {
      active = (i + opts.length) % opts.length;
      opts.forEach((o, k) => o.classList.toggle('is-active', k === active));
      lst.setAttribute('aria-activedescendant', opts[active].id);
    }
    function open() {
      dropdowns.forEach((d) => d !== api && d.close());
      el.classList.add('is-open');
      btn.setAttribute('aria-expanded', 'true');
      highlight(opts.findIndex((o) => o.dataset.v === val));
      // Видимость — сразу, без перехода: скрытый элемент не может получить фокус
      // (при выключенных анимациях переход длится миг, но фокус терялся)
      lst.style.transitionProperty = 'opacity, transform';
      lst.style.visibility = 'visible';
      lst.focus({ preventScroll: true });
    }
    function close(focusBtn) {
      if (!el.classList.contains('is-open')) return;
      el.classList.remove('is-open');
      lst.style.visibility = '';
      lst.style.transitionProperty = '';
      btn.setAttribute('aria-expanded', 'false');
      if (focusBtn) btn.focus({ preventScroll: true });
    }
    function choose(v) {
      close(true);
      if (v === val) return;
      const old = val;
      val = v;
      paint();
      onChange(v, old);
    }

    btn.addEventListener('click', () => (el.classList.contains('is-open') ? close() : open()));
    btn.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        open();
      }
    });
    lst.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') highlight(active + 1);
      else if (e.key === 'ArrowUp') highlight(active - 1);
      else if (e.key === 'Home') highlight(0);
      else if (e.key === 'End') highlight(opts.length - 1);
      else if (e.key === 'Enter' || e.key === ' ') choose(opts[active].dataset.v);
      else if (e.key === 'Escape') close(true);
      else if (e.key === 'Tab') close();
      else return;
      e.preventDefault();
      e.stopPropagation();
    });
    opts.forEach((o, i) => {
      o.addEventListener('click', () => choose(o.dataset.v));
      o.addEventListener('pointermove', () => highlight(i));
    });
    document.addEventListener('pointerdown', (e) => {
      if (!el.contains(e.target)) close();
    });

    const api = {
      get value() {
        return val;
      },
      set value(v) {
        val = v;
        paint();
      },
      hint(otherVal, text) {
        opts.forEach((o) => ($('.dd__hint', o).textContent = o.dataset.v === otherVal ? text : ''));
      },
      close,
    };
    dropdowns.push(api);
    return api;
  }

  const selX = Dropdown($('#ddX'), (v, old) => onAxisChange(selX, old));
  const selY = Dropdown($('#ddY'), (v, old) => onAxisChange(selY, old));
  let ax0 = allowed('rememberAxes') ? storage('bpc-ax') : null;
  let ay0 = allowed('rememberAxes') ? storage('bpc-ay') : null;
  if (!axisById[ax0]) ax0 = 'vector';
  if (!axisById[ay0] || ay0 === ax0) ay0 = ax0 === 'power' ? 'vector' : 'power';
  selX.value = ax0;
  selY.value = ay0;
  function syncHints() {
    selX.hint(selY.value, 'по вертикали');
    selY.hint(selX.value, 'по горизонтали');
  }
  syncHints();

  // Сетка
  (function drawGrid() {
    const svg = $('#grid');
    let s = '<rect x="0" y="0" width="100" height="100" rx="1.3" ry="1.3"/>';
    for (let i = 1; i < 20; i++) {
      const v = i * 5;
      if (v === 50) continue;
      s += `<line x1="${v}" y1="0" x2="${v}" y2="100"/><line x1="0" y1="${v}" x2="100" y2="${v}"/>`;
    }
    s += '<line class="axis draw" x1="50" y1="0" x2="50" y2="100" pathLength="100"/>';
    s += '<line class="axis draw" x1="0" y1="50" x2="100" y2="50" pathLength="100"/>';
    svg.innerHTML = s;
  })();

  // Точки — настоящие кнопки: до них можно дойти клавишей Tab
  dotsBox.innerHTML =
    parties
      .map((p, i) => {
        const size = 14 + Math.sqrt(p.seats) * 3.2;
        return `
      <button class="pdot" type="button" data-id="${p.id}" data-status="${p.status}" style="--c:${p.color};--s:${size}px;--i:${i};--x:50;--y:50">
        <span class="pdot__pulse"></span>
        <span class="pdot__core"></span>
        <span class="pdot__label" aria-hidden="true">${p.abbr}</span>
      </button>`;
      })
      .join('') +
    `<button class="pdot pdot--me is-off" type="button" data-id="me" data-status="me" tabindex="-1" aria-hidden="true" style="--c:var(--text);--s:20px;--i:0;--x:50;--y:50">
        <span class="pdot__pulse"></span>
        <span class="pdot__core"></span>
        <span class="pdot__label" aria-hidden="true">Вы</span>
      </button>`;
  const dots = $$('.pdot', dotsBox);

  const PAD = 7;
  const toPct = (v) => PAD + ((v + 10) / 20) * (100 - PAD * 2);
  let layout = {}; // id -> {x, y} в процентах

  function computeLayout() {
    const ax = selX.value;
    const ay = selY.value;
    const vis = parties.filter((p) => isActive(p) || showInactive.checked);
    if (me && toggleMe.checked) vis.push({ id: 'me', pos: me });
    const pts = vis.map((p) => ({ id: p.id, x: toPct(p.pos[ax]), y: 100 - toPct(p.pos[ay]) }));
    const size = plane.clientWidth || 500;
    const boxes = pts.map((p) => {
      const el = dots.find((d) => d.dataset.id === p.id);
      const s = parseFloat(el.style.getPropertyValue('--s')) || 16;
      const lw = $('.pdot__label', el).offsetWidth || 40;
      const lh = $('.pdot__label', el).offsetHeight || 18;
      return { p, w: Math.max(s, lw) + 6, up: s / 2 + 2, down: s / 2 + lh + 8 };
    });
    C.resolveOverlaps(boxes, 100 / size);
    pts.forEach((p) => {
      p.x = Math.max(2, Math.min(98, p.x));
      p.y = Math.max(2, Math.min(94, p.y));
    });
    layout = Object.fromEntries(pts.map((p) => [p.id, p]));
  }

  function dotLabel(p, ax, ay) {
    const isMe = p.id === 'me';
    const name = isMe ? 'Вы, по результату теста' : p.name;
    const tail = isMe ? 'Нажмите, чтобы открыть тест.' : `${p.seats} ${seatWord(p.seats)}. Открыть карточку.`;
    return `${name}. ${ax.short} ${fmt1(p.pos[ax.id])}, ${ay.short.toLowerCase()} ${fmt1(p.pos[ay.id])}. ${tail}`;
  }

  function renderCompass(animateLabels) {
    const ax = axisById[selX.value];
    const ay = axisById[selY.value];
    computeLayout();

    dots.forEach((d) => {
      const pt = layout[d.dataset.id];
      d.classList.toggle('is-off', !pt);
      d.tabIndex = pt ? 0 : -1;
      d.setAttribute('aria-hidden', String(!pt));
      if (pt) {
        d.style.setProperty('--x', pt.x);
        d.style.setProperty('--y', pt.y);
        const p = d.dataset.id === 'me' ? { id: 'me', pos: me } : byId[d.dataset.id];
        d.setAttribute('aria-label', dotLabel(p, ax, ay));
      }
    });

    const labels = {
      lblTop: ay.pos,
      lblBottom: ay.neg,
      lblLeft: ax.neg,
      lblRight: ax.pos,
      cTL: `${ax.neg} · ${ay.pos}`,
      cTR: `${ax.pos} · ${ay.pos}`,
      cBL: `${ax.neg} · ${ay.neg}`,
      cBR: `${ax.pos} · ${ay.neg}`,
    };
    Object.entries(labels).forEach(([id, text]) => {
      const el = document.getElementById(id);
      if (!animateLabels || noMotion() || el.textContent === text) {
        el.textContent = text;
        return;
      }
      el.classList.add('is-changing');
      setTimeout(() => {
        el.textContent = text;
        el.classList.remove('is-changing');
      }, 250);
    });

    $('#compassSimple').textContent =
      `Сейчас слева — «${ax.neg}» (${ax.negPlain}), справа — «${ax.pos}» (${ax.posPlain}). ` +
      `Внизу — «${ay.neg}» (${ay.negPlain}), вверху — «${ay.pos}» (${ay.posPlain}). ` +
      'Чем дальше точка от центра, тем твёрже позиция партии.';

    renderHulls();
  }

  /* ---------- Оболочки лагерей (морфинг) ---------- */
  let hullState = { gov: null, opp: null };
  let hullAnim = null;
  const campHull = (camp) => C.sampledHull(parties.filter((p) => p.camp === camp).map((p) => layout[p.id]).filter(Boolean));

  const toPath = (pts) => (pts ? 'M' + pts.map((p) => p[0].toFixed(2) + ',' + p[1].toFixed(2)).join('L') + 'Z' : '');

  function renderHulls() {
    const next = { gov: campHull('gov'), opp: campHull('opp') };
    if (!hullSvg.firstChild) hullSvg.innerHTML = '<path class="hull-gov"/><path class="hull-opp"/>';
    const [pg, po] = $$('path', hullSvg);
    const prev = hullState;
    hullState = next;
    cancelAnimationFrame(hullAnim);

    const collapse = (pts) => {
      if (!pts) return null;
      const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
      const cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
      return pts.map(() => [cx, cy]);
    };
    const from = { gov: prev.gov || collapse(next.gov), opp: prev.opp || collapse(next.opp) };
    const dur = noMotion() ? 1 : 1000;
    const t0 = performance.now();
    const frame = (t) => {
      const k = Math.min(1, (t - t0) / dur);
      const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      [
        ['gov', pg],
        ['opp', po],
      ].forEach(([key, el]) => {
        const a = from[key];
        const b = next[key];
        if (!b) {
          el.style.opacity = 0;
          return;
        }
        el.style.opacity = 1;
        const pts = a ? b.map((p, i) => [a[i][0] + (p[0] - a[i][0]) * e, a[i][1] + (p[1] - a[i][1]) * e]) : b;
        el.setAttribute('d', toPath(pts));
      });
      if (k < 1) hullAnim = requestAnimationFrame(frame);
    };
    hullAnim = requestAnimationFrame(frame);
  }

  // Скрываем весь слой целиком: у отдельных контуров прозрачность задаёт анимация
  hullSvg.classList.toggle('is-hidden', !showHulls.checked);
  showHulls.addEventListener('change', () => hullSvg.classList.toggle('is-hidden', !showHulls.checked));
  toggleMe.addEventListener('change', () => renderCompass(false));
  showInactive.addEventListener('change', () => renderCompass(false));

  function saveAxes() {
    if (!allowed('rememberAxes')) return;
    storage('bpc-ax', selX.value);
    storage('bpc-ay', selY.value);
  }

  function onAxisChange(changed, old) {
    // Одну ось нельзя выбрать дважды: вторая ось забирает прежнее значение
    const other = changed === selX ? selY : selX;
    if (other.value === changed.value) other.value = old;
    saveAxes();
    syncHints();
    renderCompass(true);
    if (T) T.announce(`По горизонтали: ${axisById[selX.value].name}. По вертикали: ${axisById[selY.value].name}.`);
  }
  $('#swapAxes').addEventListener('click', (e) => {
    const t = selX.value;
    selX.value = selY.value;
    selY.value = t;
    saveAxes();
    syncHints();
    const icon = e.currentTarget.querySelector('svg');
    if (icon.animate && !noMotion()) icon.animate([{ transform: 'rotate(0)' }, { transform: 'rotate(180deg)' }], { duration: 500, easing: 'cubic-bezier(0.34,1.56,0.64,1)' });
    renderCompass(true);
    if (T) T.announce(`Оси поменялись местами. По горизонтали: ${axisById[selX.value].name}.`);
  });

  /* ---------- Наведение и выбор ---------- */
  function setHover(id) {
    dots.forEach((d) => d.classList.toggle('is-hover', d.dataset.id === id));
    cards.forEach((c) => c.classList.toggle('is-hover', c.dataset.id === id));
    dotsBox.classList.toggle('has-focus', !!id || !!current);
    document.dispatchEvent(new CustomEvent('bpc:hover', { detail: id }));
  }

  function selectDot(id) {
    dots.forEach((d) => d.classList.toggle('is-selected', d.dataset.id === id));
    dotsBox.classList.toggle('has-focus', !!id);
  }

  function showTooltip(d) {
    const isMe = d.dataset.id === 'me';
    const p = isMe ? { id: 'me', short: 'Вы (по тесту)', color: 'var(--text)', pos: me } : byId[d.dataset.id];
    const pt = layout[p.id];
    if (!pt) return;
    const ax = axisById[selX.value];
    const ay = axisById[selY.value];
    tooltip.style.setProperty('--c', p.color);
    tooltip.innerHTML = `
      <b><i></i>${p.short}</b>
      <div class="tt-row"><span>${ax.short}</span><span>${fmt1(p.pos[ax.id])}</span></div>
      <div class="tt-row"><span>${ay.short}</span><span>${fmt1(p.pos[ay.id])}</span></div>
      ${isMe ? '<div class="tt-row"><span>Нажмите — к результату</span><span></span></div>' : `<div class="tt-row"><span>Мандаты</span><span>${p.seats}</span></div>`}`;
    const w = plane.clientWidth;
    const half = Math.min(100, w / 2);
    let left = (pt.x / 100) * w;
    left = Math.max(half, Math.min(w - half, left));
    tooltip.style.left = left + 'px';
    tooltip.style.top = (pt.y / 100) * w + 'px';
    tooltip.classList.toggle('is-below', pt.y < 28);
    tooltip.classList.add('is-on');
  }
  const hideTooltip = () => tooltip.classList.remove('is-on');

  dots.forEach((d) => {
    d.addEventListener('pointerenter', () => {
      setHover(d.dataset.id);
      showTooltip(d);
    });
    d.addEventListener('pointerleave', () => {
      setHover(null);
      hideTooltip();
    });
    d.addEventListener('focus', () => {
      setHover(d.dataset.id);
      showTooltip(d);
    });
    d.addEventListener('blur', () => {
      setHover(null);
      hideTooltip();
    });
    d.addEventListener('click', () => {
      hideTooltip();
      if (d.dataset.id === 'me') {
        if (T) T.go('#quiz');
      } else {
        openParty(d.dataset.id);
      }
    });
  });

  let rz;
  const relayout = () => {
    clearTimeout(rz);
    rz = setTimeout(() => {
      if (!T || T.isActive('compass')) renderCompass(false);
    }, 150);
  };
  window.addEventListener('resize', relayout);
  // Размер текста и шрифт меняют ширину подписей — пересчитываем раскладку точек
  document.addEventListener('bpc:settings', relayout);
  // При смене ширины экрана карточка уходит из «плоского» режима в обычный и обратно
  const onNarrow = () => {
    if (flipAnim) flipAnim.finish();
  };
  if (mqNarrow.addEventListener) mqNarrow.addEventListener('change', onNarrow);

  function resetAxes() {
    selX.value = 'vector';
    selY.value = 'power';
    saveAxes();
    syncHints();
    renderCompass(true);
  }

  /* Анимация осей сетки при появлении */
  onApproach(plane, () => $('#grid').classList.add('is-in'));

  /* ---------- Старт ---------- */
  renderCompass(false);
  observeReveal();

  /* Результат теста на компасе */
  function setMe(pos) {
    me = pos;
    $('#meSwitch').hidden = !pos;
    $('#legendMe').hidden = !pos;
    renderCompass(false);
  }

  function showMeOnCompass() {
    if (!me) return;
    toggleMe.checked = true;
    if (T) T.go('#compass', { focus: false });
    requestAnimationFrame(() => {
      renderCompass(false);
      const d = dots.find((x) => x.dataset.id === 'me');
      d.classList.remove('is-flash');
      void d.offsetWidth;
      d.classList.add('is-flash');
      d.focus({ preventScroll: true });
    });
  }

  /* Строка для цитирования в разделе «О проекте» */
  const citeBtn = $('#citeCopy');
  if (citeBtn) {
    citeBtn.addEventListener('click', async () => {
      const msg = $('#citeMsg');
      try {
        await navigator.clipboard.writeText($('#citeText').textContent.trim());
        msg.textContent = 'Скопировано';
      } catch (e) {
        // Буфер обмена недоступен — выделяем текст, чтобы скопировать вручную
        const range = document.createRange();
        range.selectNodeContents($('#citeText'));
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
        msg.textContent = 'Выделено — скопируйте вручную';
      }
      setTimeout(() => (msg.textContent = ''), 3000);
    });
  }

  /* Публичный API для charts.js, quiz.js, settings.js, a11y.js и tour.js */
  window.BPCApp = {
    allowed,
    setMe,
    showMeOnCompass,
    resetAxes,
    saveAxes,
    closeDetail,
    storage,
    axisById,
    fmt1,
    onApproach,
    replay,
    openParty,
    setHover,
    plural,
    seatWord,
    fmt,
    similarity,
    byId,
    observeReveal,
    countUp,
    initSeg,
    noMotion,
    simple,
    get reduced() {
      return noMotion();
    },
    get onBack() {
      return onBack;
    },
  };
})();
