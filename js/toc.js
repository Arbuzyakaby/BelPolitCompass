/* ==========================================================================
   BelPolitCompass · Alpha 0.6 — содержание раздела «О проекте»
   На компьютере — липкая колонка слева, всегда раскрыта. На телефоне —
   компактная липкая плашка «Содержание · текущий пункт», раскрывается
   по нажатию. Текущий пункт подсвечивается при прокрутке, полоска
   показывает, какая часть раздела уже прочитана.
   ========================================================================== */
(function () {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const T = window.BPCTabs;
  const box = $('#tocBox');
  if (!box) return;

  const links = $$('.toc__list a', box);
  const targets = links.map((a) => document.getElementById(a.getAttribute('href').slice(1)));
  const current = $('#tocCurrent');
  const meter = $('#tocMeter');
  const mqWide = window.matchMedia('(min-width: 901px)');
  let active = -1;

  // Номер пункта содержания — и у заголовка раздела: легче сверять
  targets.forEach((t) => {
    const h = t && t.dataset.num && t.querySelector('h3');
    if (h && !h.querySelector('.about__num')) h.insertAdjacentHTML('afterbegin', `<span class="about__num" aria-hidden="true">${t.dataset.num}</span>`);
  });

  function syncMode() {
    box.open = mqWide.matches;
    box.classList.toggle('is-static', mqWide.matches);
  }

  // На компьютере содержание нельзя свернуть — оно всегда под рукой
  $('summary', box).addEventListener('click', (e) => {
    if (mqWide.matches) e.preventDefault();
  });

  links.forEach((a) =>
    a.addEventListener('click', () => {
      if (!mqWide.matches) box.open = false;
    })
  );

  function setActive(i) {
    if (i === active) return;
    active = i;
    links.forEach((a, k) => {
      a.classList.toggle('is-active', k === i);
      a.classList.toggle('is-read', k < i);
      if (k === i) a.setAttribute('aria-current', 'location');
      else a.removeAttribute('aria-current');
    });
    if (current) current.textContent = i >= 0 ? $('.toc__text', links[i]).textContent : '';
    if (meter) meter.style.width = ((i + 1) / links.length) * 100 + '%';
  }

  let raf = 0;
  function spy() {
    raf = 0;
    if (T && !T.isActive('about')) return;
    const nav = $('#nav');
    const line = (nav ? nav.getBoundingClientRect().bottom : 0) + Math.min(160, window.innerHeight * 0.25);
    let i = 0;
    targets.forEach((t, k) => {
      if (t && t.getBoundingClientRect().top <= line) i = k;
    });
    // Долистали до конца страницы — активен последний пункт
    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) i = targets.length - 1;
    setActive(i);
  }
  const schedule = () => {
    if (!raf) raf = requestAnimationFrame(spy);
  };

  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);
  document.addEventListener('bpc:tab', schedule);
  if (mqWide.addEventListener) mqWide.addEventListener('change', syncMode);

  syncMode();
  setActive(0);
  schedule();
})();
