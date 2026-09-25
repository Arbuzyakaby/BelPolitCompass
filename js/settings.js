/* ==========================================================================
   BelPolitCompass · Alpha 0.5.1 — настройки
   Три вкладки: «Основные» (упрощённый режим, тема, текст, анимации),
   «Спецвозможности» (профили, зрение, чтение, управление) и «Данные».
   Схема и проверка значений — в boot.js; всё хранится только в браузере.
   ========================================================================== */
(function () {
  'use strict';

  const A = window.BPCApp;
  const B = window.BPCBoot;
  const T = window.BPCTabs;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const root = document.documentElement;
  const sheet = $('#settings');
  const form = $('#settingsForm');
  if (!sheet || !form) return;

  const mqReduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const mqDark = window.matchMedia('(prefers-color-scheme: dark)');
  const ttsSupported = 'speechSynthesis' in window && typeof window.SpeechSynthesisUtterance === 'function';

  /* ---------- Состояние ---------- */
  const load = () => B.parse(A.storage(B.KEY), A.storage(B.LEGACY_THEME_KEY));
  let prefs = load();

  function save() {
    A.storage(B.KEY, B.serialize(prefs));
    A.storage(B.LEGACY_THEME_KEY, null);
  }

  /* ---------- Применение ---------- */
  function apply(changed) {
    const fsBefore = root.getAttribute('data-fs');
    const fontBefore = root.getAttribute('data-font') + '|' + root.getAttribute('data-spacing');
    B.applyAttrs(root, B.toAttrs(prefs, mqReduce.matches));
    syncThemeColor();
    syncSimpleButtons();
    if (!changed) return;
    document.dispatchEvent(new CustomEvent('bpc:settings', { detail: { prefs: { ...prefs }, changed } }));
    // Размер текста и шрифт меняют ширину элементов: пересчитываем «глайдеры» и компас
    if (fsBefore !== root.getAttribute('data-fs') || fontBefore !== root.getAttribute('data-font') + '|' + root.getAttribute('data-spacing')) {
      requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
    }
  }

  function set(patch, silentMsg) {
    const before = { ...prefs };
    prefs = B.normalize({ ...prefs, ...patch });
    const changed = Object.keys(prefs).filter((k) => prefs[k] !== before[k]);
    apply(changed);
    save();
    syncForm();
    updateStatus();
    if (!silentMsg && changed.includes('simple')) announce(prefs.simple ? 'Упрощённый режим включён' : 'Упрощённый режим выключен');
    return changed;
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

  const onReduceChange = () => {
    if (prefs.motion === 'system') apply(['motion']);
    paintMotionHint();
  };
  if (mqReduce.addEventListener) mqReduce.addEventListener('change', onReduceChange);

  // Тема «Как в системе» перекрашивается средствами CSS; здесь только подпись
  // о том, что сейчас выбрано в системе, — она меняется на лету вместе с ОС
  function paintThemeHint() {
    const el = $('#themeSys');
    if (!el) return;
    const sys = mqDark.matches ? 'тёмная' : 'светлая';
    el.textContent =
      prefs.theme === 'system'
        ? `Сейчас в системе ${sys} тема — сайт следует за ней и переключится сам`
        : `В системе сейчас ${sys} тема, но выбрана ${prefs.theme === 'dark' ? 'тёмная' : 'светлая'} — она важнее`;
  }
  const onDarkChange = () => {
    paintThemeHint();
    syncThemeColor();
  };
  if (mqDark.addEventListener) mqDark.addEventListener('change', onDarkChange);
  else if (mqDark.addListener) mqDark.addListener(onDarkChange);

  /* ---------- Упрощённый режим: кнопки на странице ---------- */
  function syncSimpleButtons() {
    $$('[data-simple-toggle]').forEach((b) => {
      b.setAttribute('aria-pressed', String(prefs.simple));
      if (b.closest('.easy-offer')) b.textContent = prefs.simple ? 'Выключить' : 'Включить';
    });
    const offer = $('#easyOffer');
    if (offer) offer.classList.toggle('is-on', prefs.simple);
  }
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-simple-toggle]');
    if (b) set({ simple: !prefs.simple });
  });

  /* ---------- Форма ---------- */
  function syncForm() {
    Array.from(form.elements).forEach((el) => {
      if (!el.name || !(el.name in prefs)) return;
      const v = prefs[el.name];
      if (el.type === 'radio') el.checked = el.value === v;
      else if (el.type === 'checkbox') el.checked = el.dataset.off ? v === el.value : !!v;
    });
    paintMotionHint();
    paintThemeHint();
    paintPresets();
    const rateRow = $('#ttsRateRow');
    if (rateRow) rateRow.disabled = !prefs.tts;
  }

  function paintMotionHint() {
    $('#motionSys').textContent = mqReduce.matches
      ? 'В системе включено «уменьшение движения» — анимации выключены'
      : 'Сейчас в системе: полные анимации';
  }

  form.addEventListener('change', (e) => {
    const el = e.target;
    if (!el.name || !(el.name in prefs)) return;
    let v;
    if (el.type === 'checkbox') v = el.dataset.off ? (el.checked ? el.value : el.dataset.off) : el.checked;
    else v = el.value;
    set({ [el.name]: v });
  });

  // Озвучивание недоступно в этом браузере — честно говорим об этом
  if (!ttsSupported) {
    const cb = form.elements.tts;
    if (cb) {
      cb.disabled = true;
      cb.closest('.set-toggle').classList.add('is-disabled');
    }
    const note = $('#ttsNote');
    if (note) note.textContent = 'Этот браузер не умеет читать текст вслух. Попробуйте Chrome, Edge или Safari.';
  }

  /* ---------- Профили специальных возможностей ---------- */
  // Профиль — переключатель: повторное нажатие выключает его и возвращает
  // значения, которые были до включения (снимок живёт до перезагрузки страницы)
  const presetBefore = {};
  const presetsBox = $('#presets');
  if (presetsBox) {
    presetsBox.innerHTML = Object.entries(B.PRESETS)
      .map(
        ([id, p]) =>
          `<button class="preset" type="button" data-preset="${id}" aria-pressed="false"><b>${p.label}</b><small>${p.note}</small></button>`
      )
      .join('');
    presetsBox.addEventListener('click', (e) => {
      const b = e.target.closest('[data-preset]');
      if (!b) return;
      const id = b.dataset.preset;
      const preset = B.PRESETS[id];
      if (B.isPresetOn(prefs, id)) {
        set(B.presetOff(prefs, id, presetBefore[id]), true);
        delete presetBefore[id];
        say(`Профиль «${preset.label}» выключен.`);
        return;
      }
      presetBefore[id] = Object.fromEntries(Object.keys(preset.set).map((k) => [k, prefs[k]]));
      set(preset.set, true);
      say(`Профиль «${preset.label}» включён. Нажмите ещё раз, чтобы выключить.`);
    });
  }

  function paintPresets() {
    $$('[data-preset]').forEach((b) => {
      const on = B.isPresetOn(prefs, b.dataset.preset);
      b.setAttribute('aria-pressed', String(on));
      b.classList.toggle('is-on', on);
    });
  }

  /* ---------- Вкладки панели ---------- */
  const sTabs = $$('.sheet__tab', sheet);
  function showPane(name, focusTab) {
    sTabs.forEach((t) => {
      const on = t.id === 'stab-' + name;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      $('#' + t.getAttribute('aria-controls')).hidden = !on;
      if (on && focusTab) t.focus();
    });
    $('#sheetBody').scrollTop = 0;
  }
  sTabs.forEach((t) => t.addEventListener('click', () => showPane(t.id.replace('stab-', ''))));
  $('#sheetTabs').addEventListener('keydown', (e) => {
    const i = sTabs.indexOf(document.activeElement);
    if (i < 0) return;
    let n = null;
    if (e.key === 'ArrowRight') n = (i + 1) % sTabs.length;
    else if (e.key === 'ArrowLeft') n = (i - 1 + sTabs.length) % sTabs.length;
    else if (e.key === 'Home') n = 0;
    else if (e.key === 'End') n = sTabs.length - 1;
    if (n === null) return;
    e.preventDefault();
    showPane(sTabs[n].id.replace('stab-', ''), true);
  });

  /* ---------- Данные ---------- */
  const msg = $('#setMsg');
  let msgTimer = null;
  function say(text) {
    msg.textContent = text;
    clearTimeout(msgTimer);
    msgTimer = setTimeout(() => (msg.textContent = ''), 5000);
  }
  const announce = (text) => (T ? T.announce(text) : say(text));

  function updateStatus() {
    const parts = [];
    const q = window.BPCQuiz && window.BPCQuiz.status();
    if (q && q.done) parts.push('результат теста');
    else if (q && q.answered) parts.push(`ответы теста (${q.answered} из ${q.total})`);
    if (A.storage('bpc-ax') || A.storage('bpc-ay')) parts.push('выбранные оси компаса');
    if (A.storage(B.KEY) && A.storage(B.KEY) !== '{}') parts.push('настройки');
    if (A.storage('bpc-tour')) parts.push('отметка о туре');
    if (window.BPCFun && window.BPCFun.found().length) parts.push('найденные секреты');
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
      if (window.BPCQuiz) window.BPCQuiz.clear();
      say('Ответы теста удалены.');
    } else if (act === 'axes') {
      A.resetAxes();
      A.storage('bpc-ax', null);
      A.storage('bpc-ay', null);
      say('На компасе снова «Геополитический вектор» × «Модель власти».');
    } else if (act === 'a11y') {
      set(B.resetA11y(prefs), true);
      Object.keys(presetBefore).forEach((k) => delete presetBefore[k]);
      say('Специальные возможности и профили выключены.');
    } else if (act === 'prefs') {
      set({ ...B.DEFAULTS }, true);
      Object.keys(presetBefore).forEach((k) => delete presetBefore[k]);
      A.storage(B.KEY, null);
      say('Все настройки сброшены.');
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

  function open(pane) {
    if (window.BPCTour && root.classList.contains('has-tour')) window.BPCTour.end();
    if (!sheet.open) {
      opener = document.activeElement;
      syncForm();
      updateStatus();
      msg.textContent = '';
      if (typeof sheet.showModal === 'function') sheet.showModal();
      else sheet.setAttribute('open', '');
      sheet.classList.remove('is-closing');
      root.classList.add('has-sheet');
    }
    showPane(pane === 'a11y' || pane === 'data' ? pane : 'main', true);
  }

  function finishClose() {
    sheet.classList.remove('is-closing');
    if (sheet.open) {
      if (typeof sheet.close === 'function') sheet.close();
      else sheet.removeAttribute('open');
    }
    root.classList.remove('has-sheet');
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

  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-settings-open]');
    if (b) open(b.dataset.settingsOpen);
  });

  apply(null);
  syncForm();
  window.BPCSettings = {
    open,
    close,
    set,
    get prefs() {
      return { ...prefs };
    },
    ttsSupported,
  };
})();
