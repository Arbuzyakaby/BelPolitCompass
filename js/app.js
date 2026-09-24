/* ==========================================================================
   BelPolitCompass · Alpha 0.1 — компас, сайдбар-карта, общие утилиты
   ========================================================================== */
(function () {
  'use strict';

  const D = window.BPC;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const parties = D.parties;
  const byId = Object.fromEntries(parties.map((p) => [p.id, p]));
  const axisById = Object.fromEntries(D.axes.map((a) => [a.id, a]));

  /* ---------- Утилиты ---------- */
  function plural(n, forms) {
    const a = Math.abs(n) % 100;
    const b = a % 10;
    if (a > 10 && a < 20) return forms[2];
    if (b > 1 && b < 5) return forms[1];
    if (b === 1) return forms[0];
    return forms[2];
  }

  const seatWord = (n) => plural(n, ['мандат', 'мандата', 'мандатов']);
  const fmt = (v) => (v > 0 ? '+' + v : String(v)).replace('-', '−');
  const isActive = (p) => p.status === 'active';

  function distance(a, b) {
    return Math.sqrt(D.axes.reduce((s, ax) => s + (a.pos[ax.id] - b.pos[ax.id]) ** 2, 0));
  }
  const MAX_DIST = Math.sqrt(D.axes.length * 400);
  const similarity = (a, b) => Math.round((1 - distance(a, b) / MAX_DIST) * 100);

  function countUp(el, to, dur = 1400) {
    if (reduced) {
      el.textContent = to;
      return;
    }
    const start = performance.now();
    const step = (t) => {
      const k = Math.min(1, (t - start) / dur);
      const e = 1 - Math.pow(1 - k, 4);
      el.textContent = Math.round(to * e);
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  function storage(key, val) {
    try {
      if (val === undefined) return localStorage.getItem(key);
      localStorage.setItem(key, val);
    } catch (e) {
      return null;
    }
  }

  /* ---------- Тема ---------- */
  const root = document.documentElement;
  const mqDark = window.matchMedia('(prefers-color-scheme: dark)');
  const currentTheme = () => root.getAttribute('data-theme') || (mqDark.matches ? 'dark' : 'light');

  $('#themeToggle').addEventListener('click', () => {
    const next = currentTheme() === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    storage('bpc-theme', next);
  });

  /* ---------- Навигация ---------- */
  const nav = $('#nav');
  const onScroll = () => nav.classList.toggle('is-scrolled', window.scrollY > 8);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  const navLinks = $$('.nav__links a');
  const sectionObs = new IntersectionObserver(
    (entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        navLinks.forEach((a) => a.classList.toggle('is-current', a.getAttribute('href') === '#' + en.target.id));
      });
    },
    { rootMargin: '-45% 0px -50% 0px' }
  );
  $$('main .section').forEach((s) => sectionObs.observe(s));
  sectionObs.observe($('.hero')); // у hero нет id — подсветка снимается

  /* ---------- Анимации появления ----------
     Весь контент виден сразу (в покое страница полная). Когда блок
     приближается к экрану (ещё за его нижним краем), он сбрасывается
     в начальное состояние и проигрывает анимацию появления. */
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
    if (!el || reduced || !approachObs) return;
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
    $$('.reveal', scope).forEach((el, i) => {
      if (!el.style.getPropertyValue('--d') && el.parentElement && el.parentElement.classList.contains('hero')) {
        el.style.setProperty('--d', i * 0.08 + 's');
      }
      // Блоки первого экрана прячем сразу, чтобы их появление было частью загрузки
      if (!reduced && approachObs && el.getBoundingClientRect().top < window.innerHeight) el.classList.add('is-prep');
      onApproach(el, () => replay(el));
    });
  }

  // Страховка: что бы ни случилось с наблюдателем, через 1,5 с всё видно
  setTimeout(() => $$('.is-prep').forEach((el) => el.classList.remove('is-prep')), 1500);

  /* Подсветка-прожектор, следующая за курсором */
  function spotlight(el) {
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      el.style.setProperty('--mx', e.clientX - r.left + 'px');
      el.style.setProperty('--my', e.clientY - r.top + 'px');
    });
  }

  /* ---------- Hero ---------- */
  $$('[data-updated]').forEach((el) => (el.textContent = D.updated));
  $$('[data-version]').forEach((el) => (el.textContent = D.version));

  /* Мини-компас в первом экране: вектор × власть */
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
            aria-label="${p.name}"><i></i>${isActive(p) ? `<span>${p.abbr}</span>` : ''}<em>${p.short}</em></button>`;
        })
        .join('');
    box.addEventListener('click', (e) => {
      const b = e.target.closest('.mdot');
      if (b) openParty(b.dataset.id);
    });
  })();

  /* Полоска парламента под первым экраном: 110 мест */
  (function heroStrip() {
    const box = $('#heroStrip');
    if (!box) return;
    const P = D.parliament;
    const groups = P.order.map((id) => byId[id]).concat({ short: 'Беспартийные', color: '#8E8E93', seats: P.nonPartisan });
    const cells = groups.map((g) => `<span style="--c:${g.color};flex:${g.seats}"></span>`).join('');
    box.innerHTML = `
      <div class="strip__head">
        <b>${P.title}, ${P.convocation}</b>
        <span>${P.total} мест · выборы ${P.elected}</span>
      </div>
      <div class="strip__bar" role="img" aria-label="Распределение мест">${cells}</div>
      <ul class="strip__legend">
        ${groups.map((g) => `<li style="--c:${g.color}"><i></i>${g.short} <b>${g.seats}</b></li>`).join('')}
      </ul>`;
  })();

  /* Мобильное меню */
  const burger = $('#navBurger');
  const navEl = $('#nav');
  function setMenu(open) {
    navEl.classList.toggle('is-open', open);
    burger.setAttribute('aria-expanded', String(open));
  }
  burger.addEventListener('click', () => setMenu(!navEl.classList.contains('is-open')));
  $$('#navLinks a').forEach((a) => a.addEventListener('click', () => setMenu(false)));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') setMenu(false);
  });
  document.addEventListener('pointerdown', (e) => {
    if (!navEl.contains(e.target)) setMenu(false);
  });

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
      <li class="pcard" tabindex="0" role="button" data-id="${p.id}" data-status="${p.status}"
          style="--c:${p.color};--i:${i};--w:${w}%" aria-label="${p.name}">
        <span class="pcard__dot"></span>
        <div class="pcard__body">
          <div class="pcard__name">${p.short}${isActive(p) ? '' : `<span class="pcard__status">${st.label}${p.statusYear ? ' ' + p.statusYear : ''}</span>`}</div>
          <div class="pcard__ideo">${p.ideology}</div>
        </div>
        <div class="pcard__seats">
          <div class="pcard__num">${p.seats}</div>
          <div class="pcard__unit">${seatWord(p.seats)}</div>
        </div>
        <div class="pcard__bar"><i></i></div>
      </li>`;
    })
    .join('');

  const cards = $$('.pcard', list);
  cards.forEach((c) => {
    spotlight(c);
    c.addEventListener('click', () => openParty(c.dataset.id));
    c.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openParty(c.dataset.id);
      }
    });
    c.addEventListener('pointerenter', () => setHover(c.dataset.id));
    c.addEventListener('pointerleave', () => setHover(null));
  });

  /* Сегментированный контрол с «глайдером» */
  function initSeg(seg, onChange) {
    const glider = $('.seg__glider', seg);
    const move = () => {
      const btn = $('.seg__btn.is-active', seg);
      if (!btn || !glider) return;
      glider.style.width = btn.offsetWidth + 'px';
      glider.style.transform = `translateX(${btn.offsetLeft}px)`;
    };
    seg.addEventListener('click', (e) => {
      const btn = e.target.closest('.seg__btn');
      if (!btn) return;
      $$('.seg__btn', seg).forEach((b) => b.classList.toggle('is-active', b === btn));
      move();
      onChange(btn);
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
    cards.forEach((c) => {
      const ok = passesFilter(byId[c.dataset.id]);
      c.classList.toggle('is-hidden', !ok);
      if (ok) n++;
    });
    countUp(countBadge, n, 500);
  }
  countBadge.textContent = parties.length;

  /* ==========================================================================
     Переворот карты (слева направо, как игральная карта)
     ========================================================================== */
  const flip = $('#flip');
  const inner = $('#flipInner');
  const detail = $('#partyDetail');
  let rot = 0;
  let onBack = false;
  let current = null;
  let turning = null;

  function turn() {
    const from = rot;
    rot += 180; // всегда в одну сторону — слева направо
    onBack = !onBack;
    inner.style.transform = `rotateY(${rot}deg)`;
    if (reduced || !inner.animate) return;
    flip.classList.remove('is-turning');
    void flip.offsetWidth;
    flip.classList.add('is-turning');
    clearTimeout(turning);
    turning = setTimeout(() => flip.classList.remove('is-turning'), 1000);
    inner.animate(
      [
        { transform: `rotateY(${from}deg) scale(1)` },
        { transform: `rotateY(${from + 90}deg) scale(0.9) translateZ(-40px)`, offset: 0.5 },
        { transform: `rotateY(${rot}deg) scale(1)` },
      ],
      { duration: 950, easing: 'cubic-bezier(0.65, 0, 0.35, 1)' }
    );
  }

  function openParty(id, dir) {
    const p = byId[id];
    if (!p) return;
    const wasOnBack = onBack;
    current = id;
    renderDetail(p, wasOnBack ? dir || 1 : 0);
    if (!wasOnBack) turn();
    cards.forEach((c) => c.classList.toggle('is-selected', c.dataset.id === id));
    selectDot(id);
    // На мобильных — показать карточку
    const r = flip.getBoundingClientRect();
    if (r.top < 0 || r.top > window.innerHeight * 0.6) {
      flip.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
    }
  }

  function closeDetail() {
    if (!onBack) return;
    turn();
    current = null;
    cards.forEach((c) => c.classList.remove('is-selected'));
    selectDot(null);
  }

  function step(delta) {
    const visible = parties.filter(passesFilter);
    const pool = visible.length ? visible : parties;
    let i = pool.findIndex((p) => p.id === current);
    i = (i + delta + pool.length) % pool.length;
    openParty(pool[i].id, delta);
  }

  function renderDetail(p, dir) {
    const st = D.statuses[p.status];
    const pool = parties.filter(passesFilter);
    const idx = Math.max(0, pool.findIndex((x) => x.id === p.id));
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
          <div class="axisrow__track">
            <span class="axisrow__fill" data-v="${v}" style="left:50%;width:0"></span>
            <span class="axisrow__knob" data-v="${v}" style="left:50%"></span>
          </div>
          <div class="axisrow__poles"><span>${ax.neg}</span><span>${ax.pos}</span></div>
        </div>`;
      })
      .join('');

    detail.style.setProperty('--c', p.color);
    detail.innerHTML = `
      <div class="pd">
        <div class="pd__glow"></div>
        <div class="pd__bar">
          <button class="pd__back" type="button" data-act="back">
            <svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6" stroke-linecap="round" stroke-linejoin="round"/></svg>Все партии
          </button>
          <span class="pd__pos">${idx + 1} / ${pool.length || parties.length}</span>
          <button class="pd__nav" type="button" data-act="prev" aria-label="Предыдущая партия">
            <svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
          <button class="pd__nav" type="button" data-act="next" aria-label="Следующая партия">
            <svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
        </div>
        <div class="pd__scroll">
          <div class="pd__content${dir ? ' is-swapping' : ''}" style="--dir:${dir < 0 ? '-24px' : '24px'}">
            <div class="pd__hero">
              <div class="pd__mono">${p.abbr}</div>
              <div>
                <h3 class="pd__name">${p.short}</h3>
                <div class="pd__full">${p.name}</div>
              </div>
            </div>
            <div class="pd__tags">
              <span class="tag tag--${st.tone}">${st.label}${p.statusYear ? ' в ' + p.statusYear : ''}</span>
              <span class="tag tag--${p.camp}">${p.camp === 'gov' ? 'Провластная' : 'Оппозиционная'}</span>
            </div>
            <div class="pd__stats">
              <div class="pd__stat"><b>${p.seats}<small> / 110</small></b><span>${seatWord(p.seats)}</span></div>
              <div class="pd__stat"><b>${p.founded}</b><span>${p.foundedNote || 'основана'}</span></div>
              <div class="pd__stat"><b class="sm">${p.leader}</b><span>лидер</span></div>
            </div>
            <p class="pd__about">${p.about}</p>
            <div class="pd__h">Идеология</div>
            <p class="pd__about">${p.ideology}</p>
            <div class="pd__h">Позиции на осях</div>
            ${axes}
            <div class="pd__h">Ключевые тезисы</div>
            <ul class="pd__points">${p.points.map((t) => `<li>${t}</li>`).join('')}</ul>
            <div class="pd__h">Ближайшие по взглядам</div>
            <div class="near">
              ${near
                .map(
                  (n) =>
                    `<button class="near__item" type="button" data-go="${n.x.id}" style="--c:${n.x.color}"><i></i>${n.x.short}<span>${n.s}%</span></button>`
                )
                .join('')}
            </div>
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
      dir ? 80 : 450
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

  document.addEventListener('keydown', (e) => {
    if (!onBack) return;
    if (e.target.closest('select, input')) return;
    if (e.key === 'Escape') closeDetail();
    if (e.key === 'ArrowRight') step(1);
    if (e.key === 'ArrowLeft') step(-1);
  });

  /* Свайпы по карточке на тач-устройствах */
  let sx = null;
  detail.addEventListener('touchstart', (e) => (sx = e.touches[0].clientX), { passive: true });
  detail.addEventListener(
    'touchend',
    (e) => {
      if (sx === null) return;
      const dx = e.changedTouches[0].clientX - sx;
      if (Math.abs(dx) > 60) step(dx < 0 ? 1 : -1);
      sx = null;
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
  function Dropdown(root, onChange) {
    const id = root.id;
    root.insertAdjacentHTML(
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
              <span class="dd__text"><span class="dd__name">${a.name}</span><span class="dd__poles">${a.neg} ↔ ${a.pos}</span></span>
              <span class="dd__hint"></span>
              <svg class="dd__check" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </li>`
          )
          .join('')}
      </ul>`
    );
    const btn = $('.dd__btn', root);
    const list = $('.dd__list', root);
    const opts = $$('.dd__opt', root);
    let val = D.axes[0].id;
    let active = 0;

    function paint() {
      $('.dd__val', btn).textContent = axisById[val].name;
      opts.forEach((o) => o.setAttribute('aria-selected', String(o.dataset.v === val)));
    }
    function highlight(i) {
      active = (i + opts.length) % opts.length;
      opts.forEach((o, k) => o.classList.toggle('is-active', k === active));
      list.setAttribute('aria-activedescendant', opts[active].id);
    }
    function open() {
      dropdowns.forEach((d) => d !== api && d.close());
      root.classList.add('is-open');
      btn.setAttribute('aria-expanded', 'true');
      highlight(opts.findIndex((o) => o.dataset.v === val));
      list.focus({ preventScroll: true });
    }
    function close(focusBtn) {
      if (!root.classList.contains('is-open')) return;
      root.classList.remove('is-open');
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

    btn.addEventListener('click', () => (root.classList.contains('is-open') ? close() : open()));
    btn.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        open();
      }
    });
    list.addEventListener('keydown', (e) => {
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
      if (!root.contains(e.target)) close();
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
  let ax0 = storage('bpc-ax');
  let ay0 = storage('bpc-ay');
  if (!axisById[ax0]) ax0 = 'vector';
  if (!axisById[ay0] || ay0 === ax0) ay0 = ax0 === 'power' ? 'vector' : 'power';
  selX.value = ax0;
  selY.value = ay0;
  function syncHints() {
    selX.hint(selY.value, 'ось Y');
    selY.hint(selX.value, 'ось X');
  }
  syncHints();

  // Сетка
  (function drawGrid() {
    const svg = $('#grid');
    let s = '<rect x="0" y="0" width="100" height="100" rx="3.6" ry="3.6"/>';
    for (let i = 1; i < 20; i++) {
      const v = i * 5;
      if (v === 50) continue;
      s += `<line x1="${v}" y1="0" x2="${v}" y2="100"/><line x1="0" y1="${v}" x2="100" y2="${v}"/>`;
    }
    s += '<line class="axis draw" x1="50" y1="0" x2="50" y2="100" pathLength="100"/>';
    s += '<line class="axis draw" x1="0" y1="50" x2="100" y2="50" pathLength="100"/>';
    svg.innerHTML = s;
  })();

  // Точки
  dotsBox.innerHTML = parties
    .map((p, i) => {
      const size = 14 + Math.sqrt(p.seats) * 3.2;
      return `
      <div class="pdot" data-id="${p.id}" data-status="${p.status}" style="--c:${p.color};--s:${size}px;--i:${i};--x:50;--y:50">
        <span class="pdot__pulse"></span>
        <span class="pdot__core"></span>
        <span class="pdot__label">${p.abbr}</span>
      </div>`;
    })
    .join('') +
    `<div class="pdot pdot--me is-off" data-id="me" data-status="me" style="--c:var(--text);--s:20px;--i:0;--x:50;--y:50">
        <span class="pdot__pulse"></span>
        <span class="pdot__core"></span>
        <span class="pdot__label">Вы</span>
      </div>`;
  const dots = $$('.pdot', dotsBox);

  const PAD = 7;
  const toPct = (v) => PAD + ((v + 10) / 20) * (100 - PAD * 2);
  let layout = {}; // id -> {x, y} в процентах

  function computeLayout() {
    const ax = selX.value;
    const ay = selY.value;
    const vis = parties.filter((p) => isActive(p) || showInactive.checked);
    if (me && toggleMe.checked) vis.push({ id: 'me', pos: me });
    const pts = vis.map((p) => ({ id: p.id, x: toPct(p.pos[ax]), y: 100 - toPct(p.pos[ay]), ox: 0, oy: 0 }));
    pts.forEach((p) => {
      p.ox = p.x;
      p.oy = p.y;
    });
    // Расталкивание: точка + подпись под ней = прямоугольник; перекрытия
    // разрешаем вдоль оси наименьшего пересечения (смещения — единицы пикселей)
    const size = plane.clientWidth || 500;
    const k = 100 / size;
    const boxes = pts.map((p) => {
      const el = dots.find((d) => d.dataset.id === p.id);
      const s = parseFloat(el.style.getPropertyValue('--s')) || 16;
      const lw = $('.pdot__label', el).offsetWidth || 40;
      return { p, w: Math.max(s, lw) + 6, up: s / 2 + 2, down: s / 2 + 26 };
    });
    for (let it = 0; it < 80; it++) {
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
            const sx = (dx >= 0 ? 1 : -1) * (ox / 2 + 0.5) * k;
            A.p.x -= sx;
            B.p.x += sx;
          } else {
            const sy = (dy >= 0 ? 1 : -1) * (oy / 2 + 0.5) * k;
            A.p.y -= sy;
            B.p.y += sy;
          }
        }
      }
      if (!moved) break;
    }
    pts.forEach((p) => {
      p.x = Math.max(2, Math.min(98, p.x));
      p.y = Math.max(2, Math.min(94, p.y));
    });
    layout = Object.fromEntries(pts.map((p) => [p.id, p]));
  }

  function renderCompass(animateLabels) {
    const ax = axisById[selX.value];
    const ay = axisById[selY.value];
    computeLayout();

    dots.forEach((d) => {
      const pt = layout[d.dataset.id];
      d.classList.toggle('is-off', !pt);
      if (pt) {
        d.style.setProperty('--x', pt.x);
        d.style.setProperty('--y', pt.y);
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
      if (!animateLabels || el.textContent === text) {
        el.textContent = text;
        return;
      }
      el.classList.add('is-changing');
      setTimeout(() => {
        el.textContent = text;
        el.classList.remove('is-changing');
      }, 250);
    });

    renderHulls();
  }

  /* ---------- Оболочки лагерей (морфинг) ---------- */
  const SAMPLES = 72;
  let hullState = { gov: null, opp: null };
  let hullAnim = null;

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

  // Оболочка с отступом, представленная фиксированным числом лучей — для плавного морфинга
  function sampledHull(ids) {
    const pts = ids.map((id) => layout[id]).filter(Boolean);
    if (!pts.length) return null;
    const R = 5.5;
    const cloud = [];
    pts.forEach((p) => {
      for (let k = 0; k < 16; k++) {
        const a = (k / 16) * Math.PI * 2;
        cloud.push([p.x + Math.cos(a) * R, p.y + Math.sin(a) * R]);
      }
    });
    const hull = convexHull(cloud);
    const cx = hull.reduce((s, p) => s + p[0], 0) / hull.length;
    const cy = hull.reduce((s, p) => s + p[1], 0) / hull.length;
    const out = [];
    for (let i = 0; i < SAMPLES; i++) {
      const a = (i / SAMPLES) * Math.PI * 2;
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

  const toPath = (pts) =>
    pts ? 'M' + pts.map((p) => p[0].toFixed(2) + ',' + p[1].toFixed(2)).join('L') + 'Z' : '';

  function renderHulls() {
    const next = {
      gov: sampledHull(parties.filter((p) => p.camp === 'gov').map((p) => p.id)),
      opp: sampledHull(parties.filter((p) => p.camp === 'opp').map((p) => p.id)),
    };
    if (!hullSvg.firstChild) {
      hullSvg.innerHTML = '<path class="hull-gov"/><path class="hull-opp"/>';
    }
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
    const dur = reduced ? 1 : 1000;
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

  function onAxisChange(changed, old) {
    // Одну ось нельзя выбрать дважды: вторая ось забирает прежнее значение
    const other = changed === selX ? selY : selX;
    if (other.value === changed.value) other.value = old;
    storage('bpc-ax', selX.value);
    storage('bpc-ay', selY.value);
    syncHints();
    renderCompass(true);
  }
  $('#swapAxes').addEventListener('click', (e) => {
    const t = selX.value;
    selX.value = selY.value;
    selY.value = t;
    storage('bpc-ax', selX.value);
    storage('bpc-ay', selY.value);
    syncHints();
    const icon = e.currentTarget.querySelector('svg');
    icon.animate && icon.animate([{ transform: 'rotate(0)' }, { transform: 'rotate(180deg)' }], { duration: 500, easing: 'cubic-bezier(0.34,1.56,0.64,1)' });
    renderCompass(true);
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

  const fmt1 = (v) => fmt(Math.round(v * 10) / 10).replace('.', ',');

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
    let left = (pt.x / 100) * w;
    left = Math.max(100, Math.min(w - 100, left));
    tooltip.style.left = left + 'px';
    tooltip.style.top = (pt.y / 100) * w + 'px';
    tooltip.classList.toggle('is-below', pt.y < 28);
    tooltip.classList.add('is-on');
  }

  dots.forEach((d) => {
    d.addEventListener('pointerenter', () => {
      setHover(d.dataset.id);
      showTooltip(d);
    });
    d.addEventListener('pointerleave', () => {
      setHover(null);
      tooltip.classList.remove('is-on');
    });
    d.addEventListener('click', () => {
      tooltip.classList.remove('is-on');
      if (d.dataset.id === 'me') {
        const q = $('#quiz');
        if (q) q.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
      } else {
        openParty(d.dataset.id);
      }
    });
  });

  let rz;
  window.addEventListener('resize', () => {
    clearTimeout(rz);
    rz = setTimeout(() => renderCompass(false), 150);
  });

  /* Анимация осей сетки при появлении */
  onApproach(plane, () => $('#grid').classList.add('is-in'));

  /* ---------- Старт ---------- */
  renderCompass(false);
  observeReveal();
  $$('.card').forEach(spotlight);

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
    renderCompass(false);
    $('#compass').scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
    const d = dots.find((x) => x.dataset.id === 'me');
    d.classList.remove('is-flash');
    void d.offsetWidth;
    d.classList.add('is-flash');
  }

  /* Публичный API для charts.js и quiz.js */
  window.BPCApp = { setMe, showMeOnCompass, storage, axisById, fmt1, onApproach, replay, openParty, setHover, plural, seatWord, fmt, similarity, byId, observeReveal, spotlight, countUp, initSeg, reduced };
})();
