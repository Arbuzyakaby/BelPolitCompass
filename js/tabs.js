/* ==========================================================================
   BelPolitCompass · Alpha 0.4 — вкладки
   Все разделы живут на одной странице, но показывается только активная
   вкладка. Адрес страницы (#compass, #quiz, #faq…) всегда соответствует
   открытому: ссылкой можно поделиться, кнопка «Назад» в браузере работает.
   Какая вкладка видна, решает атрибут data-tab на <html> — его выставляет
   ещё boot.js до отрисовки. Без JavaScript видны все разделы подряд.
   ========================================================================== */
(function () {
  'use strict';

  const B = window.BPCBoot;
  const root = document.documentElement;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  const TABS = B.TABS;
  const list = $('#tabs');
  const tabs = TABS.map((id) => document.getElementById('tab-' + id));
  const label = (id) => {
    const t = document.getElementById('tab-' + id);
    return t ? t.textContent.trim() : id;
  };
  const reduced = () => {
    const m = root.getAttribute('data-motion');
    return !!m && m !== 'full';
  };

  let current = TABS.includes(root.dataset.tab) ? root.dataset.tab : 'home';

  /* ---------- Объявления для экранного диктора ---------- */
  const announcer = $('#announcer');
  let annTimer = 0;
  function announce(text) {
    if (!announcer) return;
    // Сначала очищаем: одинаковый текст подряд тоже должен прозвучать
    announcer.textContent = '';
    clearTimeout(annTimer);
    annTimer = setTimeout(() => (announcer.textContent = text), 60);
  }

  /* ---------- Высота шапки: для липких элементов и прокрутки к якорям ---------- */
  const nav = $('#nav');
  function measureNav() {
    if (nav) root.style.setProperty('--nav-h', Math.round(nav.getBoundingClientRect().height) + 'px');
  }
  measureNav();
  if ('ResizeObserver' in window && nav) new ResizeObserver(measureNav).observe(nav);
  else window.addEventListener('resize', measureNav);

  /* ---------- Отрисовка состояния ---------- */
  function paint(id) {
    tabs.forEach((t, i) => {
      const on = TABS[i] === id;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
    });
    root.setAttribute('data-tab', id);
    TABS.forEach((t) => {
      const p = document.getElementById(t);
      if (p) p.classList.toggle('is-active', t === id);
    });
  }

  // На телефоне лента вкладок прокручивается — активную держим на виду
  function revealTab(id, smooth) {
    const t = document.getElementById('tab-' + id);
    if (!t || !list || list.scrollWidth <= list.clientWidth) return;
    const left = t.offsetLeft - (list.clientWidth - t.offsetWidth) / 2;
    list.scrollTo({ left: Math.max(0, left), behavior: smooth && !reduced() ? 'smooth' : 'auto' });
  }

  function show(id, opts = {}) {
    if (!TABS.includes(id)) id = 'home';
    const changed = id !== current;
    current = id;
    paint(id);
    revealTab(id, true);
    if (!changed) return false;
    const panel = document.getElementById(id);
    if (panel && !reduced()) {
      panel.classList.remove('is-entering');
      void panel.offsetWidth;
      panel.classList.add('is-entering');
    }
    if (opts.announce !== false) announce(`Открыта вкладка «${label(id)}»`);
    document.dispatchEvent(new CustomEvent('bpc:tab', { detail: { id } }));
    // Скрытые блоки измерялись с нулевой шириной — просим всех пересчитать раскладку
    requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
    return true;
  }

  function scrollToEl(el) {
    const navH = nav ? nav.getBoundingClientRect().height : 0;
    const y = el.getBoundingClientRect().top + window.scrollY - navH - 16;
    window.scrollTo({ top: Math.max(0, y), behavior: reduced() ? 'auto' : 'smooth' });
  }

  /* go('#faq') — открыть вкладку, к которой относится адрес, и показать цель.
     from: 'tablist' — фокус остаётся на вкладке, иначе переходит в панель. */
  function go(hash, opts = {}) {
    const id = String(hash || '').replace(/^#/, '') || 'home';
    const tab = B.tabFromHash(id);
    const isTab = TABS.includes(id);
    const target = isTab ? document.getElementById(tab) : document.getElementById(id);
    const newHash = '#' + (target ? id : tab);
    if (opts.push !== false && location.hash !== newHash) {
      try {
        history.pushState(null, '', newHash);
      } catch (e) {
        /* file:// в некоторых браузерах — адрес не меняем */
      }
    }
    const changed = show(tab, opts);
    // Раскрыть <details>, если ведём прямо к нему
    if (target && target.tagName === 'DETAILS') target.open = true;
    const run = () => {
      if (!isTab && target) scrollToEl(target);
      else if (changed || opts.top) window.scrollTo({ top: 0, behavior: 'auto' });
      if (opts.from === 'tablist') return;
      const focusEl = !isTab && target ? target : document.getElementById(tab);
      if (focusEl && opts.focus !== false) {
        if (!focusEl.hasAttribute('tabindex') && !/^(A|BUTTON|INPUT|SELECT|TEXTAREA|SUMMARY)$/.test(focusEl.tagName)) {
          focusEl.setAttribute('tabindex', '-1');
        }
        focusEl.focus({ preventScroll: true });
      }
    };
    // Ждём кадр: только что показанная вкладка должна получить размеры
    if (changed) requestAnimationFrame(run);
    else run();
  }

  /* ---------- Ссылки #… по всей странице ---------- */
  document.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute('href').slice(1);
    if (id === 'main') {
      // «Перейти к содержимому»: фокус в открытую вкладку
      e.preventDefault();
      const p = document.getElementById(current);
      if (p) p.focus();
      return;
    }
    if (!id || (!document.getElementById(id) && !TABS.includes(B.tabFromHash(id)))) return;
    e.preventDefault();
    go('#' + id, { from: a.closest('[role="tablist"]') === list ? 'tablist' : 'link' });
  });

  window.addEventListener('popstate', () => go(location.hash, { push: false, focus: false }));
  window.addEventListener('hashchange', () => {
    if (B.tabFromHash(location.hash) !== current) go(location.hash, { push: false, focus: false });
  });

  /* ---------- Клавиатура в ленте вкладок (шаблон ARIA Tabs) ---------- */
  if (list) {
    list.addEventListener('keydown', (e) => {
      const i = tabs.indexOf(document.activeElement);
      if (i < 0) return;
      let n = null;
      if (e.key === 'ArrowRight') n = (i + 1) % tabs.length;
      else if (e.key === 'ArrowLeft') n = (i - 1 + tabs.length) % tabs.length;
      else if (e.key === 'Home') n = 0;
      else if (e.key === 'End') n = tabs.length - 1;
      else if (e.key === ' ') n = i;
      if (n === null) return;
      e.preventDefault();
      e.stopPropagation();
      tabs[n].focus();
      go('#' + TABS[n], { from: 'tablist' });
    });
  }

  /* ---------- «Предыдущая / следующая вкладка» внизу каждой панели ---------- */
  TABS.forEach((id, i) => {
    const panel = document.getElementById(id);
    if (!panel) return;
    const prev = TABS[i - 1];
    const next = TABS[i + 1];
    const link = (t, dir) =>
      t
        ? `<a class="pager__link pager__link--${dir}" href="#${t}"><small>${dir === 'prev' ? '← Назад' : 'Дальше →'}</small><b>${label(t)}</b></a>`
        : '<span></span>';
    panel.insertAdjacentHTML(
      'beforeend',
      `<nav class="pager" aria-label="Соседние вкладки">${link(prev, 'prev')}${link(next, 'next')}</nav>`
    );
  });

  /* ---------- Старт ---------- */
  paint(current);
  requestAnimationFrame(() => revealTab(current, false));

  window.BPCTabs = {
    get current() {
      return current;
    },
    show,
    go,
    label,
    announce,
    isActive: (id) => current === id,
  };
})();
