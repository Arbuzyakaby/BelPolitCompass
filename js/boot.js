/* ==========================================================================
   BelPolitCompass · Alpha 0.6 — загрузка до отрисовки
   Подключается в <head> синхронно: читает сохранённые настройки и адрес
   страницы и сразу выставляет атрибуты на <html>, чтобы не было вспышки
   темы, «прыжка» текста и мелькания чужой вкладки.
   Тот же модуль используют settings.js, tabs.js и автотесты (Node).
   ========================================================================== */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else {
    root.BPCBoot = api;
    api.run(root);
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const KEY = 'bpc-settings';
  const LEGACY_THEME_KEY = 'bpc-theme'; // Alpha 0.1–0.2

  /* ---------- Схема настроек ----------
     Для каждого поля — список допустимых значений (первое не обязательно
     по умолчанию) или логический тип. */
  const SCHEMA = {
    theme: { values: ['system', 'light', 'dark'], def: 'system' },
    fs: { values: ['md', 'lg', 'xl', 'xxl'], def: 'md' },
    contrast: { values: ['normal', 'high', 'max'], def: 'normal' },
    hints: { bool: true, def: true },
    motion: { values: ['system', 'full', 'reduced', 'off'], def: 'system' },
    simple: { bool: true, def: false },
    // Специальные возможности
    font: { values: ['default', 'readable'], def: 'default' },
    spacing: { bool: true, def: false },
    underline: { bool: true, def: false },
    cursor: { bool: true, def: false },
    cvd: { bool: true, def: false },
    guide: { bool: true, def: false },
    tts: { bool: true, def: false },
    ttsRate: { values: ['slow', 'normal', 'fast'], def: 'normal' },
    targets: { bool: true, def: false },
    focus: { bool: true, def: false },
    autoNext: { bool: true, def: true },
    tables: { bool: true, def: false },
    // Приватность
    rememberQuiz: { bool: true, def: true },
    rememberAxes: { bool: true, def: true },
    webFonts: { bool: true, def: true },
    // Первый визит: 3D-пролёт над компасом
    intro: { bool: true, def: true },
  };

  const DEFAULTS = Object.freeze(Object.fromEntries(Object.entries(SCHEMA).map(([k, s]) => [k, s.def])));

  // Поля раздела «Специальные возможности» — их сбрасывает отдельная кнопка
  const A11Y_KEYS = ['contrast', 'font', 'spacing', 'underline', 'cursor', 'cvd', 'guide', 'tts', 'ttsRate', 'targets', 'focus', 'autoNext', 'tables'];
  // Поля раздела «Приватность»
  const PRIVACY_KEYS = ['rememberQuiz', 'rememberAxes', 'webFonts'];

  /* Внешние шрифты — единственный запрос сайта к чужому серверу (Google Fonts).
     Их подключает boot.js, только если это разрешено в настройках. */
  const FONTS_URL = 'https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap';

  /* Готовые профили: набор настроек под конкретную потребность.
     Профиль меняет только перечисленные поля, остальное не трогает. */
  const PRESETS = {
    vision: {
      label: 'Слабое зрение',
      note: 'Крупный текст, максимальный контраст, заметный фокус, крупный курсор и подчёркнутые ссылки',
      set: { fs: 'xl', contrast: 'max', focus: true, cursor: true, underline: true, targets: true },
    },
    dyslexia: {
      label: 'Дислексия',
      note: 'Удобочитаемый шрифт, увеличенные интервалы, линейка для чтения и озвучивание',
      set: { font: 'readable', spacing: true, guide: true, tts: true, fs: 'lg' },
    },
    motor: {
      label: 'Моторика',
      note: 'Крупные кнопки, заметный фокус, без автоперехода в тесте и лишнего движения',
      set: { targets: true, focus: true, autoNext: false, motion: 'reduced' },
    },
    screenreader: {
      label: 'Экранный диктор',
      note: 'Данные диаграмм таблицами, без автоперехода и анимаций',
      set: { tables: true, autoNext: false, motion: 'off', hints: true },
    },
    calm: {
      label: 'Без движения',
      note: 'При эпилепсии и вестибулярных нарушениях: никаких анимаций и мигания',
      set: { motion: 'off' },
    },
    simple: {
      label: 'Просто и понятно',
      note: 'Пояснение к каждой строке, крупнее текст, без автоперехода в тесте',
      set: { simple: true, fs: 'lg', hints: true, autoNext: false },
    },
  };

  function normalize(raw, legacyTheme) {
    const s = raw && typeof raw === 'object' ? raw : {};
    const out = {};
    Object.entries(SCHEMA).forEach(([k, spec]) => {
      let v = s[k];
      if (k === 'contrast') {
        if (v === true) v = 'high'; // Alpha 0.3 хранила флаг
        if (v === false) v = 'normal';
      }
      if (k === 'theme' && !v && (legacyTheme === 'light' || legacyTheme === 'dark')) v = legacyTheme;
      if (spec.bool) out[k] = typeof v === 'boolean' ? v : spec.def;
      else out[k] = spec.values.includes(v) ? v : spec.def;
    });
    return out;
  }

  function parse(json, legacyTheme) {
    let raw = {};
    try {
      raw = JSON.parse(json || '{}') || {};
    } catch (e) {
      raw = {};
    }
    return normalize(raw, legacyTheme);
  }

  // Храним только отличия от значений по умолчанию — так проще читать и мигрировать
  function serialize(prefs) {
    const p = normalize(prefs);
    const out = {};
    Object.keys(SCHEMA).forEach((k) => {
      if (p[k] !== DEFAULTS[k]) out[k] = p[k];
    });
    return JSON.stringify(out);
  }

  const effectiveMotion = (prefs, systemReduce) =>
    prefs.motion === 'system' ? (systemReduce ? 'off' : 'full') : prefs.motion;

  /* Атрибуты <html> для CSS. null — атрибут снимается. */
  function toAttrs(prefs, systemReduce) {
    const p = normalize(prefs);
    const on = (v, val = 'on') => (v ? val : null);
    return {
      'data-theme': p.theme === 'system' ? null : p.theme,
      'data-fs': p.fs === 'md' ? null : p.fs,
      'data-contrast': p.contrast === 'normal' ? null : p.contrast,
      'data-hints': p.hints ? null : 'off',
      'data-motion': effectiveMotion(p, systemReduce),
      'data-simple': on(p.simple),
      'data-font': p.font === 'default' ? null : p.font,
      'data-spacing': on(p.spacing),
      'data-underline': on(p.underline),
      'data-cursor': on(p.cursor, 'big'),
      'data-cvd': on(p.cvd),
      'data-guide': on(p.guide),
      'data-tts': on(p.tts),
      'data-targets': on(p.targets, 'big'),
      'data-focus': on(p.focus, 'strong'),
      'data-autonext': p.autoNext ? null : 'off',
      'data-tables': on(p.tables),
    };
  }

  function applyPreset(prefs, name) {
    const preset = PRESETS[name];
    if (!preset) return normalize(prefs);
    return normalize({ ...normalize(prefs), ...preset.set });
  }

  // Профиль включён, если все его поля сейчас совпадают с его значениями
  function isPresetOn(prefs, name) {
    const preset = PRESETS[name];
    if (!preset) return false;
    const p = normalize(prefs);
    return Object.keys(preset.set).every((k) => p[k] === preset.set[k]);
  }

  const activePresets = (prefs) => Object.keys(PRESETS).filter((id) => isPresetOn(prefs, id));

  /* Выключение профиля: его поля возвращаются к значениям до включения
     (before — снимок этих полей) или к значениям по умолчанию. Поле, которое
     нужно другому включённому профилю, остаётся как есть. Профиль, целиком
     входящий в выключаемый («Без движения» внутри «Экранного диктора»),
     поля не удерживает, если сам не был включён до него. */
  function presetOff(prefs, name, before) {
    const preset = PRESETS[name];
    const p = normalize(prefs);
    if (!preset) return p;
    const inside = (id) => Object.entries(PRESETS[id].set).every(([k, v]) => preset.set[k] === v);
    const wasOn = (id) => !!before && isPresetOn({ ...p, ...before }, id);
    const others = activePresets(p).filter((id) => id !== name && (!inside(id) || wasOn(id)));
    Object.keys(preset.set).forEach((k) => {
      if (others.some((id) => k in PRESETS[id].set)) return;
      p[k] = before && k in before ? before[k] : DEFAULTS[k];
    });
    return normalize(p);
  }

  /* Сброс специальных возможностей: все поля раздела и заодно то, что вне
     раздела (размер текста, анимации, упрощённый режим) поменяли включённые
     сейчас профили. Выбранное вручную, без профиля, не трогаем. */
  function resetA11y(prefs) {
    const p = normalize(prefs);
    activePresets(p).forEach((id) => Object.keys(PRESETS[id].set).forEach((k) => (p[k] = DEFAULTS[k])));
    A11Y_KEYS.forEach((k) => (p[k] = DEFAULTS[k]));
    return p;
  }

  /* ---------- Вкладки ---------- */
  const TABS = ['home', 'compass', 'quiz', 'analytics', 'timeline', 'method', 'about'];
  // Якоря внутри вкладок: ведут на вкладку и прокручивают к элементу
  const ANCHORS = { top: 'home', faq: 'about', cite: 'about', glossary: 'about', versions: 'about', sources: 'about' };

  function tabFromHash(hash) {
    const h = decodeURIComponent(String(hash || '').replace(/^#/, ''));
    if (TABS.includes(h)) return h;
    if (ANCHORS[h]) return ANCHORS[h];
    const prefix = h.split('-')[0];
    if (TABS.includes(prefix)) return prefix; // about-why → about
    return 'home';
  }

  /* ---------- Применение в браузере ---------- */
  function readStorage(win, key) {
    try {
      return win.localStorage.getItem(key);
    } catch (e) {
      return null;
    }
  }

  function applyAttrs(el, attrs) {
    Object.entries(attrs).forEach(([name, value]) => {
      if (value === null) el.removeAttribute(name);
      else el.setAttribute(name, value);
    });
  }

  function run(win) {
    if (!win || !win.document) return;
    const r = win.document.documentElement;
    r.classList.add('js');
    const prefs = parse(readStorage(win, KEY), readStorage(win, LEGACY_THEME_KEY));
    const reduce = !!(win.matchMedia && win.matchMedia('(prefers-reduced-motion: reduce)').matches);
    applyAttrs(r, toAttrs(prefs, reduce));
    r.setAttribute('data-tab', tabFromHash(win.location && win.location.hash));
    if (prefs.webFonts) loadFonts(win.document);
  }

  function loadFonts(doc) {
    // Шрифты — украшение: любая ошибка здесь не должна мешать загрузке страницы
    const head = doc && doc.head;
    if (!head || typeof doc.createElement !== 'function' || doc.getElementById('bpcFonts')) return;
    const add = (attrs) => {
      const l = doc.createElement('link');
      Object.entries(attrs).forEach(([k, v]) => l.setAttribute(k, v));
      head.appendChild(l);
      return l;
    };
    add({ rel: 'preconnect', href: 'https://fonts.googleapis.com' });
    add({ rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' });
    add({ rel: 'stylesheet', href: FONTS_URL, id: 'bpcFonts' });
  }

  return {
    KEY,
    LEGACY_THEME_KEY,
    SCHEMA,
    DEFAULTS,
    A11Y_KEYS,
    PRIVACY_KEYS,
    FONTS_URL,
    loadFonts,
    PRESETS,
    TABS,
    ANCHORS,
    normalize,
    parse,
    serialize,
    toAttrs,
    effectiveMotion,
    applyPreset,
    isPresetOn,
    activePresets,
    presetOff,
    resetA11y,
    tabFromHash,
    applyAttrs,
    run,
  };
});
