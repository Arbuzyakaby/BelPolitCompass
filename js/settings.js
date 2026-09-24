/* ==========================================================================
   BelPolitCompass · Alpha 0.3 — настройки
   Внешний вид (тема, размер текста, контрастность, подсказки), анимации,
   данные и тур. Всё хранится только в браузере, в ключе bpc-settings.
   Атрибуты на <html> заранее выставляет скрипт в <head>, здесь — изменение
   на лету и панель настроек.
   ========================================================================== */
(function () {
  'use strict';

  const A = window.BPCApp;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const root = document.documentElement;
  const sheet = $('#settings');
  const form = $('#settingsForm');
  if (!sheet || !form) return;

  const KEY = 'bpc-settings';
  const DEFAULTS = { theme: 'system', fs: 'md', contrast: false, hints: true, motion: 'system' };
  const mqReduce = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* ---------- Состояние ---------- */
  function load() {
    let s = {};
    try {
      s = JSON.parse(A.storage(KEY) || '{}') || {};
    } catch (e) {
      s = {};
    }
    // Тема из Alpha 0.1–0.2 хранилась отдельно
    const legacy = A.storage('bpc-theme');
    if (!s.theme && (legacy === 'light' || legacy === 'dark')) s.theme = legacy;
    return {
      theme: ['system', 'light', 'dark'].includes(s.theme) ? s.theme : DEFAULTS.theme,
      fs: ['md', 'lg', 'xl'].includes(s.fs) ? s.fs : DEFAULTS.fs,
      contrast: s.contrast === 'high' || s.contrast === true,
      hints: s.hints !== false,
      motion: ['system', 'full', 'reduced', 'off'].includes(s.motion) ? s.motion : DEFAULTS.motion,
    };
  }

  let prefs = load();

  function save() {
    A.storage(KEY, JSON.stringify({ ...prefs, contrast: prefs.contrast ? 'high' : 'normal' }));
    A.storage('bpc-theme', null);
  }

  const effectiveMotion = () => (prefs.motion === 'system' ? (mqReduce.matches ? 'off' : 'full') : prefs.motion);

  function setAttr(name, value) {
    if (value === null) root.removeAttribute(name);
    else root.setAttribute(name, value);
  }

  /* ---------- Применение ---------- */
  function apply(silent) {
    const fsBefore = root.getAttribute('data-fs');
    setAttr('data-theme', prefs.theme === 'system' ? null : prefs.theme);
    setAttr('data-fs', prefs.fs === 'md' ? null : prefs.fs);
    setAttr('data-contrast', prefs.contrast ? 'high' : null);
    setAttr('data-hints', prefs.hints ? null : 'off');
    setAttr('data-motion', effectiveMotion());
    syncThemeColor();
    if (silent) return;
    document.dispatchEvent(new CustomEvent('bpc:settings', { detail: { ...prefs } }));
    // Размер текста меняет ширину элементов: пересчитываем «глайдеры» и компас
    if (fsBefore !== root.getAttribute('data-fs')) {
      requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
    }
  }

  // Цвет адресной строки на телефонах следует за выбранной темой. Берём токен
  // --bg, а не фон body: фон плавно перетекает, и в первый кадр он ещё старый.
  function syncThemeColor() {
    const bg = getComputedStyle(root).getPropertyValue('--bg').trim();
    $$('meta[name="theme-color"]').forEach((m) => {
      if (!m.dataset.content) m.dataset.content = m.getAttribute('content');
      m.setAttribute('content', prefs.theme === 'system' || !bg ? m.dataset.content : bg);
    });
  }

  mqReduce.addEventListener &&
    mqReduce.addEventListener('change', () => {
      if (prefs.motion === 'system') apply();
      paintMotionHint();
    });

  /* ---------- Форма ---------- */
  function syncForm() {
    form.elements.theme.value = prefs.theme;
    form.elements.fs.value = prefs.fs;
    form.elements.motion.value = prefs.motion;
    form.elements.contrast.checked = prefs.contrast;
    form.elements.hints.checked = prefs.hints;
    paintMotionHint();
  }

  function paintMotionHint() {
    $('#motionSys').textContent = mqReduce.matches
      ? 'В системе включено «уменьшение движения» — анимации выключены'
      : 'Сейчас в системе: полные анимации';
  }

  form.addEventListener('change', (e) => {
    const el = e.target;
    if (!el.name) return;
    if (el.type === 'checkbox') prefs[el.name] = el.checked;
    else prefs[el.name] = el.value;
    apply();
    save();
    updateStatus();
  });

  /* ---------- Данные ---------- */
  const msg = $('#setMsg');
  let msgTimer = null;
  function say(text) {
    msg.textContent = text;
    clearTimeout(msgTimer);
    msgTimer = setTimeout(() => (msg.textContent = ''), 5000);
  }

  function updateStatus() {
    const parts = [];
    const q = window.BPCQuiz && window.BPCQuiz.status();
    if (q && q.done) parts.push('результат теста');
    else if (q && q.answered) parts.push(`ответы теста (${q.answered} из ${q.total})`);
    if (A.storage('bpc-ax') || A.storage('bpc-ay')) parts.push('выбранные оси компаса');
    if (A.storage(KEY)) parts.push('настройки');
    if (A.storage('bpc-tour')) parts.push('отметка о туре');
    $('#dataStatus').textContent = parts.length
      ? `В этом браузере сохранено: ${parts.join(', ')}.`
      : 'В этом браузере пока ничего не сохранено.';
  }

  // Необратимые действия подтверждаются повторным нажатием
  const armed = new Map();
  function confirmFirst(btn, label) {
    if (armed.has(btn)) {
      clearTimeout(armed.get(btn).t);
      btn.textContent = armed.get(btn).text;
      btn.classList.remove('is-armed');
      armed.delete(btn);
      return true;
    }
    const text = btn.textContent;
    btn.textContent = label;
    btn.classList.add('is-armed');
    armed.set(btn, {
      text,
      t: setTimeout(() => {
        btn.textContent = text;
        btn.classList.remove('is-armed');
        armed.delete(btn);
      }, 4000),
    });
    return false;
  }

  form.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-set]');
    if (!btn) return;
    const act = btn.dataset.set;
    if (act === 'tour') {
      close();
      A.storage('bpc-tour', null);
      setTimeout(() => window.BPCTour && window.BPCTour.start(), A.reduced ? 0 : 280);
    } else if (act === 'quiz') {
      if (!confirmFirst(btn, 'Нажмите ещё раз, чтобы удалить')) return;
      window.BPCQuiz && window.BPCQuiz.clear();
      say('Ответы теста удалены.');
    } else if (act === 'axes') {
      A.resetAxes();
      A.storage('bpc-ax', null);
      A.storage('bpc-ay', null);
      say('На компасе снова «Геополитический вектор» × «Модель власти».');
    } else if (act === 'prefs') {
      prefs = { ...DEFAULTS };
      apply();
      A.storage(KEY, null);
      syncForm();
      say('Настройки сброшены.');
    } else if (act === 'all') {
      if (!confirmFirst(btn, 'Нажмите ещё раз — удалить всё')) return;
      try {
        Object.keys(localStorage)
          .filter((k) => k.startsWith('bpc-'))
          .forEach((k) => localStorage.removeItem(k));
      } catch (err) {
        /* хранилище недоступно — удалять нечего */
      }
      location.reload();
      return;
    }
    updateStatus();
  });

  /* ---------- Открытие и закрытие ---------- */
  let opener = null;

  function open() {
    if (sheet.open) return;
    opener = document.activeElement;
    syncForm();
    updateStatus();
    msg.textContent = '';
    if (typeof sheet.showModal === 'function') sheet.showModal();
    else sheet.setAttribute('open', '');
    sheet.classList.remove('is-closing');
    document.documentElement.classList.add('has-sheet');
  }

  function finishClose() {
    sheet.classList.remove('is-closing');
    if (sheet.open) {
      if (typeof sheet.close === 'function') sheet.close();
      else sheet.removeAttribute('open');
    }
    document.documentElement.classList.remove('has-sheet');
    if (opener && opener.focus) opener.focus({ preventScroll: true });
  }

  function close() {
    if (!sheet.open || sheet.classList.contains('is-closing')) return;
    if (A.reduced) return finishClose();
    sheet.classList.add('is-closing');
    setTimeout(finishClose, 220);
  }

  // Кнопка «×» (submit формы method=dialog) и Esc — закрываем с анимацией
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    close();
  });
  sheet.addEventListener('cancel', (e) => {
    e.preventDefault();
    close();
  });
  // Щелчок по затемнению вокруг панели
  sheet.addEventListener('click', (e) => {
    if (e.target === sheet) close();
  });

  $('#settingsBtn').addEventListener('click', open);
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-settings-open]')) open();
  });

  apply(true);
  window.BPCSettings = { open, close };
})();
