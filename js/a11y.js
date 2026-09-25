/* ==========================================================================
   BelPolitCompass · Alpha 0.5 — специальные возможности
   Линейка для чтения и озвучивание текста. Остальные возможности
   (контраст, шрифт, интервалы, курсор, фокус, крупные кнопки) — чистый CSS
   по атрибутам на <html>, которые выставляют boot.js и settings.js.
   ========================================================================== */
(function () {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const root = document.documentElement;
  const T = window.BPCTabs;
  const on = (attr) => root.getAttribute('data-' + attr) === 'on';

  /* ==========================================================================
     Линейка для чтения: полупрозрачная полоса на высоту пары строк,
     следует за курсором, пальцем или клавиатурным фокусом.
     ========================================================================== */
  const guide = document.createElement('div');
  guide.className = 'reading-guide';
  guide.setAttribute('aria-hidden', 'true');
  guide.hidden = true;
  document.body.appendChild(guide);

  let guideY = -1;
  let raf = 0;
  function moveGuide(y) {
    guideY = y;
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      guide.style.transform = `translateY(${Math.round(guideY)}px)`;
    });
  }
  function syncGuide() {
    guide.hidden = !on('guide');
    if (!guide.hidden && guideY < 0) moveGuide(window.innerHeight / 2);
  }
  document.addEventListener('pointermove', (e) => on('guide') && moveGuide(e.clientY), { passive: true });
  document.addEventListener('touchmove', (e) => on('guide') && e.touches[0] && moveGuide(e.touches[0].clientY), { passive: true });
  document.addEventListener('focusin', (e) => {
    if (!on('guide') || !e.target.getBoundingClientRect) return;
    const r = e.target.getBoundingClientRect();
    if (r.height) moveGuide(r.top + r.height / 2);
  });

  /* ==========================================================================
     Озвучивание (Web Speech API, работает без интернета, если в системе
     есть русский голос). Кнопки «Прочитать вслух» с data-tts-read="селектор"
     и плавающая кнопка: читает выделенный текст или открытую вкладку.
     ========================================================================== */
  const synth = window.speechSynthesis;
  const supported = !!synth && typeof window.SpeechSynthesisUtterance === 'function';
  const RATE = { slow: 0.8, normal: 1, fast: 1.25 };
  let speakingBtn = null;

  const fab = document.createElement('button');
  fab.type = 'button';
  fab.className = 'tts-fab';
  fab.hidden = true;
  fab.innerHTML =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9z" stroke-linejoin="round"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" stroke-linecap="round"/></svg><span>Прочитать</span>';
  document.body.appendChild(fab);

  function voice() {
    const vs = synth.getVoices();
    return vs.find((v) => /^ru(-|_|$)/i.test(v.lang)) || null;
  }

  function setSpeaking(btn) {
    if (speakingBtn && speakingBtn !== btn) speakingBtn.classList.remove('is-speaking');
    speakingBtn = btn;
    if (btn) btn.classList.add('is-speaking');
    fab.classList.toggle('is-speaking', !!btn);
    $('span', fab).textContent = btn ? 'Остановить' : 'Прочитать';
    fab.setAttribute('aria-label', btn ? 'Остановить чтение' : 'Прочитать вслух выделенный текст или открытую вкладку');
  }

  function stop() {
    if (supported) synth.cancel();
    setSpeaking(null);
  }

  // Текст для чтения: видимый (innerText учитывает скрытые пояснения), без служебных кнопок
  function textOf(el) {
    const clone = el.cloneNode(true);
    clone.querySelectorAll('.tts-btn, .pager, .data-table, svg, [aria-hidden="true"]').forEach((x) => x.remove());
    const holder = document.createElement('div');
    holder.style.cssText = 'position:absolute;left:-9999px;top:0;width:600px';
    holder.appendChild(clone);
    document.body.appendChild(holder);
    const t = clone.innerText.replace(/\s+\n/g, '\n').replace(/\n{2,}/g, '\n').trim();
    holder.remove();
    return t;
  }

  function speak(text, btn) {
    if (!supported || !text) return;
    const same = speakingBtn === btn && synth.speaking;
    stop();
    if (same) return; // повторное нажатие — остановить
    // Длинный текст читаем по абзацам: некоторые движки обрывают длинные фразы
    const parts = text.split(/\n+/).map((s) => s.trim()).filter(Boolean);
    const rate = RATE[(window.BPCSettings && window.BPCSettings.prefs.ttsRate) || 'normal'] || 1;
    const v = voice();
    parts.forEach((part, i) => {
      const u = new SpeechSynthesisUtterance(part);
      u.lang = 'ru-RU';
      u.rate = rate;
      if (v) u.voice = v;
      if (i === parts.length - 1) {
        u.onend = () => speakingBtn === btn && setSpeaking(null);
        u.onerror = () => setSpeaking(null);
      }
      synth.speak(u);
    });
    setSpeaking(btn);
  }

  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-tts-read]');
    if (!b) return;
    const el = document.querySelector(b.dataset.ttsRead);
    if (el) speak(textOf(el), b);
  });

  fab.addEventListener('click', () => {
    if (fab.classList.contains('is-speaking')) return stop();
    const sel = String(window.getSelection ? window.getSelection() : '').trim();
    if (sel) return speak(sel, fab);
    const panel = document.getElementById(T ? T.current : 'home');
    if (panel) speak(textOf(panel), fab);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && speakingBtn) stop();
  });

  function syncTts() {
    const enabled = supported && on('tts');
    fab.hidden = !enabled;
    if (!enabled) stop();
  }

  // Смена вкладки прерывает чтение: иначе голос читает то, чего уже нет на экране
  document.addEventListener('bpc:tab', () => speakingBtn === fab && stop());
  document.addEventListener('bpc:settings', () => {
    syncGuide();
    syncTts();
  });
  window.addEventListener('pagehide', stop);

  syncGuide();
  syncTts();
  setSpeaking(null);

  window.BPCA11y = { speak, stop, supported, textOf };
})();
