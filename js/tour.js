/* ==========================================================================
   BelPolitCompass · Alpha 0.3 — тур для новичков
   При первом визите внизу появляется приглашение. Тур подсвечивает элементы
   «прожектором», который плавно переезжает от шага к шагу, а анимированная
   рука показывает, куда нажимать. Листается кнопками, стрелками ← → и Esc.
   Внутри подсвеченной области страница остаётся живой — можно попробовать.
   ========================================================================== */
(function () {
  'use strict';

  const A = window.BPCApp;
  const $ = (s, r = document) => r.querySelector(s);
  const KEY = 'bpc-tour'; // 'done' — тур пройден или закрыт, 'later' — «не сейчас»
  const narrow = () => window.innerWidth < 700;

  /* ---------- Шаги ---------- */
  const STEPS = [
    {
      title: 'Добро пожаловать в BelPolitCompass',
      text: 'Это карта белорусских партий по четырём линиям спора. За минуту покажем, что где находится и что нажимать. Листайте кнопками или стрелками ← →.',
    },
    {
      target: '.hero__cta .btn--primary',
      hand: '.hero__cta .btn--primary',
      title: 'Начните с теста',
      text: '40 коротких утверждений — и вы увидите свою точку рядом с партиями. Ответы остаются только в вашем браузере.',
    },
    {
      target: () => (narrow() || getComputedStyle($('#navBurger')).display !== 'none' ? '#navBurger' : '#navLinks'),
      title: 'Разделы сайта',
      text: 'Меню ведёт к компасу, тесту, диаграммам, истории партий и описанию проекта.',
    },
    {
      target: '.compass-controls',
      hand: '#ddXBtn',
      title: 'Выберите, что сравнивать',
      text: 'Каждая ось — отдельный спор: Восток или Запад, президент или парламент, госсектор или рынок, советская или национальная идентичность. Поставьте любые две.',
    },
    {
      target: '#plane',
      hand: '.pdot[data-id="br"] .pdot__core',
      title: 'Точки — это партии',
      text: 'Чем больше точка, тем больше у партии мест в парламенте. Пунктирная обводка — партия больше не действует. Нажмите на точку, чтобы открыть карточку.',
    },
    {
      target: '#flip',
      hand: '.pcard[data-id="kpb"] .pcard__name',
      title: 'Список и карточка партии',
      text: 'Тот же список партий. Нажмите на строку — карточка перевернётся и покажет лидера, тезисы и позиции по всем осям. Листать партии можно стрелками.',
    },
    {
      target: '.compass-toggles',
      hand: '#toggleInactive + .switch__track',
      title: 'Лишнее можно скрыть',
      text: '«Лагеря» обводят провластные и оппозиционные партии, «Недействующие» прячут ликвидированные. После теста здесь появится переключатель «Моя точка».',
    },
    {
      target: '#quizBox',
      title: 'Тест «Где я на компасе»',
      text: 'Отвечайте в своём темпе: прогресс сохраняется, к вопросу можно вернуться. В конце — профиль по четырём осям и три самые близкие партии.',
    },
    {
      target: '.card--hemi',
      hand: '#hemiLegend .legend__item',
      title: 'Цифры и диаграммы',
      text: 'Парламент, доли мест, сравнение партий и разрыв между лагерями. Наведите или нажмите на элемент — появятся подробности.',
    },
    {
      target: '#settingsBtn',
      hand: '#settingsBtn',
      title: 'Настройки',
      text: 'Тема, размер текста, контрастность, анимации и удаление сохранённых данных. Кнопка «?» рядом снова запустит этот тур.',
      area: '#helpBtn, #settingsBtn',
    },
    {
      title: 'Готово!',
      text: 'Теперь вы знаете, где что находится. Самое интересное — пройти тест и найти себя на компасе.',
      final: true,
    },
  ];

  /* ---------- Разметка ---------- */
  const HAND =
    '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M12.5 4.5a2 2 0 0 1 4 0v9l1.2-.5a2 2 0 0 1 2.6 1.1l.1.2 1.4-.4a2 2 0 0 1 2.4 1.3l1.3-.2a2 2 0 0 1 2.3 2v4.8c0 4.5-3.2 8.2-7.8 8.2h-2.3a7 7 0 0 1-5.6-2.8l-4.4-5.9a2 2 0 0 1 3-2.6l1.8 1.6z" stroke-linejoin="round"/></svg>';

  const tour = document.createElement('div');
  tour.className = 'tour';
  tour.hidden = true;
  tour.innerHTML = `
    <div class="tour__block" data-b="t"></div><div class="tour__block" data-b="b"></div>
    <div class="tour__block" data-b="l"></div><div class="tour__block" data-b="r"></div>
    <div class="tour__spot"></div>
    <div class="tour__hand" aria-hidden="true">${HAND}<span class="tour__ripple"></span></div>
    <div class="tour__pop" role="dialog" aria-modal="true" aria-labelledby="tourTitle" aria-describedby="tourText">
      <div class="tour__meta">
        <span class="tour__count" id="tourCount"></span>
        <button class="tour__skip" type="button" data-t="end">Пропустить тур</button>
      </div>
      <div class="tour__bar"><i id="tourBar"></i></div>
      <div class="tour__content">
        <h3 class="tour__title" id="tourTitle"></h3>
        <p class="tour__text" id="tourText"></p>
      </div>
      <div class="tour__nav">
        <button class="btn btn--ghost btn--sm" type="button" data-t="prev">Назад</button>
        <button class="btn btn--primary btn--sm" type="button" data-t="next">Далее</button>
      </div>
    </div>`;
  document.body.appendChild(tour);

  const spot = $('.tour__spot', tour);
  const hand = $('.tour__hand', tour);
  const pop = $('.tour__pop', tour);
  const blocks = Array.from(tour.querySelectorAll('.tour__block'));
  const btnPrev = $('[data-t="prev"]', tour);
  const btnNext = $('[data-t="next"]', tour);

  let idx = 0;
  let active = false;
  let opener = null;
  let token = 0; // отменяет устаревшие переходы, если пользователь листает быстро
  let rect = null; // текущая подсвеченная область (координаты окна)
  let hideTimer = 0; // отложенное скрытие после закрытия тура

  /* ---------- Геометрия ---------- */
  function resolve(sel) {
    const s = typeof sel === 'function' ? sel() : sel;
    if (!s) return null;
    const el = document.querySelector(s);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return r.width || r.height ? el : null;
  }

  // Прямоугольник, охватывающий все элементы области шага
  function areaRect(step, el) {
    const list = step.area ? Array.from(document.querySelectorAll(step.area)) : [el];
    const rs = list.map((x) => x.getBoundingClientRect()).filter((r) => r.width || r.height);
    if (!rs.length) return null;
    const pad = 8;
    const l = Math.min(...rs.map((r) => r.left)) - pad;
    const t = Math.min(...rs.map((r) => r.top)) - pad;
    const r = Math.max(...rs.map((r) => r.right)) + pad;
    const b = Math.max(...rs.map((r) => r.bottom)) + pad;
    return { left: l, top: t, width: r - l, height: b - t };
  }

  const navH = () => ($('#nav') ? $('#nav').getBoundingClientRect().bottom : 0);

  function scrollToTarget(el) {
    if (el.closest('.nav')) return; // шапка липкая — она и так на экране
    const r = el.getBoundingClientRect();
    const top = navH() + 12;
    const bottomReserve = narrow() ? pop.offsetHeight + 28 : 24;
    const avail = window.innerHeight - top - bottomReserve;
    let y = window.scrollY + r.top - top;
    if (r.height < avail) y -= (avail - r.height) / 2;
    window.scrollTo({ top: Math.max(0, y), behavior: A.reduced ? 'auto' : 'smooth' });
  }

  // Ждём, пока прокрутка закончится и элемент перестанет двигаться
  function settle(el, cb, my) {
    let last = null;
    let same = 0;
    const t0 = performance.now();
    const tick = () => {
      if (my !== token) return;
      const r = el.getBoundingClientRect();
      const key = Math.round(r.top) + ':' + Math.round(r.left) + ':' + Math.round(r.height);
      same = key === last ? same + 1 : 0;
      last = key;
      if (same >= 4 || performance.now() - t0 > 1400) cb();
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  function place(r) {
    rect = r;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (!r) {
      // Шаг без цели: прожектор схлопывается в центр, затемнён весь экран
      Object.assign(spot.style, { left: vw / 2 + 'px', top: vh / 2 + 'px', width: '0px', height: '0px' });
      spot.classList.add('is-empty');
      setBlocks({ left: vw / 2, top: vh / 2, width: 0, height: 0 });
    } else {
      Object.assign(spot.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' });
      spot.classList.remove('is-empty');
      setBlocks(r);
    }
    placePop(r);
  }

  // Четыре прозрачных «стенки» вокруг прожектора ловят щелчки мимо цели
  function setBlocks(r) {
    const [t, b, l, rt] = blocks;
    const right = r.left + r.width;
    const bottom = r.top + r.height;
    Object.assign(t.style, { left: 0, top: 0, width: '100%', height: Math.max(0, r.top) + 'px' });
    Object.assign(b.style, { left: 0, top: bottom + 'px', width: '100%', height: `calc(100% - ${Math.max(0, bottom)}px)` });
    Object.assign(l.style, { left: 0, top: r.top + 'px', width: Math.max(0, r.left) + 'px', height: r.height + 'px' });
    Object.assign(rt.style, { left: right + 'px', top: r.top + 'px', width: `calc(100% - ${right}px)`, height: r.height + 'px' });
  }

  function placePop(r) {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const gap = 14;
    const m = 12;
    pop.classList.toggle('is-sheet', narrow());
    if (narrow()) {
      Object.assign(pop.style, { left: '', top: '', transform: '' });
      return;
    }
    const w = pop.offsetWidth;
    const h = pop.offsetHeight;
    let left;
    let top;
    if (!r) {
      left = (vw - w) / 2;
      top = (vh - h) / 2;
    } else if (r.top + r.height + gap + h < vh - m) {
      top = r.top + r.height + gap; // снизу от цели
      left = r.left + r.width / 2 - w / 2;
    } else if (r.top - gap - h > navH() + m) {
      top = r.top - gap - h; // сверху
      left = r.left + r.width / 2 - w / 2;
    } else if (r.left + r.width + gap + w < vw - m) {
      left = r.left + r.width + gap; // справа
      top = r.top + r.height / 2 - h / 2;
    } else if (r.left - gap - w > m) {
      left = r.left - gap - w; // слева
      top = r.top + r.height / 2 - h / 2;
    } else {
      left = vw - w - m - 12; // цель во весь экран — карточка в углу поверх неё
      top = vh - h - m - 12;
    }
    left = Math.max(m, Math.min(vw - w - m, left));
    top = Math.max(navH() + m, Math.min(vh - h - m, top));
    pop.style.left = left + 'px';
    pop.style.top = top + 'px';
  }

  function placeHand(step) {
    const el = step.hand && resolve(step.hand);
    if (!el) {
      hand.classList.remove('is-on', 'is-tap');
      return;
    }
    const r = el.getBoundingClientRect();
    // Рука «прилетает» от карточки тура к цели и начинает нажимать
    hand.classList.remove('is-tap');
    hand.style.left = r.left + Math.min(r.width / 2, 60) + 'px';
    hand.style.top = r.top + r.height / 2 + 'px';
    hand.classList.add('is-on');
    clearTimeout(placeHand.t);
    placeHand.t = setTimeout(() => hand.classList.add('is-tap'), A.reduced ? 0 : 650);
  }

  /* ---------- Шаги ---------- */
  function show(i) {
    const my = ++token;
    idx = Math.max(0, Math.min(STEPS.length - 1, i));
    const step = STEPS[idx];
    const el = step.target ? resolve(step.target) : null;

    pop.classList.add('is-switching');
    hand.classList.remove('is-tap');

    const paint = () => {
      if (my !== token) return;
      $('#tourCount').textContent = `Шаг ${idx + 1} из ${STEPS.length}`;
      $('#tourBar').style.width = ((idx + 1) / STEPS.length) * 100 + '%';
      $('#tourTitle').textContent = step.title;
      $('#tourText').textContent = step.text;
      btnPrev.hidden = idx === 0;
      btnNext.textContent = step.final ? 'Пройти тест' : idx === 0 ? 'Начать' : 'Далее';
      $('[data-t="end"]', tour).textContent = step.final ? 'Закрыть' : 'Пропустить тур';
      place(el ? areaRect(step, el) : null);
      placeHand(step);
      pop.classList.remove('is-switching');
      btnNext.focus({ preventScroll: true });
    };

    if (el) {
      scrollToTarget(el);
      settle(el, paint, my);
    } else {
      setTimeout(paint, A.reduced ? 0 : 160);
    }
  }

  function start() {
    if (active) return;
    clearTimeout(hideTimer); // тур перезапущен сразу после закрытия — не прятать его
    hideInvite();
    if (window.BPCSettings) window.BPCSettings.close();
    A.closeMenu();
    opener = document.activeElement;
    active = true;
    tour.hidden = false;
    document.documentElement.classList.add('has-tour');
    // Прожектор стартует из центра экрана
    place(null);
    requestAnimationFrame(() => {
      tour.classList.add('is-open');
      show(0);
    });
  }

  function end(goQuiz) {
    if (!active) return;
    active = false;
    token++;
    A.storage(KEY, 'done');
    tour.classList.remove('is-open');
    hand.classList.remove('is-on', 'is-tap');
    document.documentElement.classList.remove('has-tour');
    hideTimer = setTimeout(() => (tour.hidden = true), A.reduced ? 0 : 250);
    if (goQuiz) {
      const q = $('#quiz');
      if (q) q.scrollIntoView({ behavior: A.reduced ? 'auto' : 'smooth', block: 'start' });
      const b = $('#quizBox .btn--primary');
      if (b) setTimeout(() => b.focus({ preventScroll: true }), 600);
    } else if (opener && opener.focus) {
      opener.focus({ preventScroll: true });
    }
  }

  tour.addEventListener('click', (e) => {
    const b = e.target.closest('[data-t]');
    if (b) {
      const t = b.dataset.t;
      if (t === 'next') STEPS[idx].final ? end(true) : show(idx + 1);
      else if (t === 'prev') show(idx - 1);
      else if (t === 'end') end(false);
      return;
    }
    // Щелчок мимо подсвеченной области — карточка тура слегка «кивает»
    if (e.target.classList.contains('tour__block')) {
      pop.classList.remove('is-nudge');
      void pop.offsetWidth;
      pop.classList.add('is-nudge');
    }
  });

  // Клавиатура перехватывается раньше обработчиков страницы
  document.addEventListener(
    'keydown',
    (e) => {
      if (!active) return;
      if (e.key === 'Escape') end(false);
      else if (e.key === 'ArrowRight') STEPS[idx].final ? end(true) : show(idx + 1);
      else if (e.key === 'ArrowLeft') show(idx - 1);
      else if (e.key === 'Tab') {
        // Фокус не уходит из карточки тура
        const f = Array.from(pop.querySelectorAll('button')).filter((x) => !x.hidden);
        const i = f.indexOf(document.activeElement);
        const n = e.shiftKey ? (i <= 0 ? f.length - 1 : i - 1) : i === f.length - 1 ? 0 : i + 1;
        f[n].focus();
      } else return;
      e.preventDefault();
      e.stopPropagation();
    },
    true
  );

  // При прокрутке и изменении размера окна прожектор следует за целью
  let raf = 0;
  const follow = () => {
    if (!active) return;
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      const step = STEPS[idx];
      const el = step.target ? resolve(step.target) : null;
      tour.classList.add('is-following');
      place(el ? areaRect(step, el) : null);
      placeHand(step);
      clearTimeout(follow.t);
      follow.t = setTimeout(() => tour.classList.remove('is-following'), 120);
    });
  };
  window.addEventListener('scroll', follow, { passive: true });
  window.addEventListener('resize', follow);

  /* ---------- Приглашение при первом визите ---------- */
  const invite = document.createElement('div');
  invite.className = 'tour-invite';
  invite.setAttribute('role', 'dialog');
  invite.setAttribute('aria-labelledby', 'inviteTitle');
  invite.hidden = true;
  invite.innerHTML = `
    <span class="tour-invite__icon" aria-hidden="true">
      <svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="13" fill="none" stroke="currentColor" stroke-width="2" opacity=".35"/><path class="needle" d="M16 5l3.2 11L16 27l-3.2-11z" fill="currentColor"/></svg>
    </span>
    <div class="tour-invite__body">
      <b id="inviteTitle">Впервые здесь?</b>
      <p>Покажем за минуту, что где находится и что нажимать.</p>
      <div class="tour-invite__actions">
        <button class="btn btn--primary btn--sm" type="button" data-i="start">Показать</button>
        <button class="btn btn--ghost btn--sm" type="button" data-i="later">Не сейчас</button>
      </div>
    </div>
    <button class="tour-invite__close" type="button" data-i="later" aria-label="Закрыть приглашение">
      <svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" stroke-linecap="round"/></svg>
    </button>`;
  document.body.appendChild(invite);

  function hideInvite() {
    if (invite.hidden) return;
    invite.classList.remove('is-on');
    setTimeout(() => (invite.hidden = true), A.reduced ? 0 : 250);
  }

  invite.addEventListener('click', (e) => {
    const b = e.target.closest('[data-i]');
    if (!b) return;
    if (b.dataset.i === 'start') start();
    else {
      A.storage(KEY, 'later');
      hideInvite();
    }
  });

  if (!A.storage(KEY)) {
    setTimeout(() => {
      if (active || A.storage(KEY) || document.documentElement.classList.contains('has-sheet')) return;
      invite.hidden = false;
      requestAnimationFrame(() => requestAnimationFrame(() => invite.classList.add('is-on')));
    }, 1400);
  }

  /* ---------- Кнопки запуска ---------- */
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-tour-start]')) start();
  });

  window.BPCTour = { start, end };
})();
