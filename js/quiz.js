/* ==========================================================================
   BelPolitCompass · Alpha 0.5 — тест «Где я на компасе»
   40 утверждений, по 10 на ось. Результат считается в той же шкале
   от −10 до +10, что и позиции партий. Ответы хранятся только в браузере.
   ========================================================================== */
(function () {
  'use strict';

  const D = window.BPC;
  const A = window.BPCApp;
  const C = window.BPCCore;
  const T = window.BPCTabs;
  const Q = D.quiz;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const root = document.documentElement;
  const box = $('#quizBox');
  if (!box) return;

  const KEY = 'bpc-quiz-' + Q.id;
  const N = Q.questions.length;
  const simple = A.simple;
  const autoNext = () => root.getAttribute('data-autonext') !== 'off';

  /* ---------- Состояние ---------- */
  let state = load();

  function fresh() {
    return C.normalizeQuizState(null, N);
  }

  function load() {
    let raw = null;
    try {
      raw = JSON.parse(A.storage(KEY) || 'null');
    } catch (e) {
      raw = null;
    }
    const st = C.normalizeQuizState(raw, N);
    // Страницу закрыли сразу после ответа, до перехода к следующему вопросу —
    // продолжаем со следующего, а не с уже отвеченного
    if (!st.done && st.answers[st.idx] !== null && st.idx < N - 1 && st.answers[st.idx + 1] === null) st.idx++;
    return st;
  }

  function save() {
    A.storage(KEY, JSON.stringify(state));
  }

  const answeredCount = () => state.answers.filter((v) => v !== null).length;
  const scores = () => C.quizScores(state.answers, Q.questions, D.axes);
  const num = (v) => A.fmt1(v);
  const pct = (v, pad = 8) => pad + ((v + 10) / 20) * (100 - pad * 2);
  const ranking = (me) => C.rank(me, D.parties, D.axes);

  const TTS_ICON =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9z" stroke-linejoin="round"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" stroke-linecap="round"/></svg>';

  /* ---------- Экраны ---------- */
  function render() {
    if (state.done) renderResult();
    else if (answeredCount() > 0) renderRun(0);
    else renderIntro();
  }

  function renderIntro() {
    box.dataset.view = 'intro';
    box.innerHTML = `
      <div class="qz-intro">
        <div>
          <h3>Ответьте на 40 утверждений и найдите себя на компасе</h3>
          <p>Для каждого утверждения выберите, насколько вы согласны. Правильных ответов нет, а если не знаете — выбирайте «нейтрально».</p>
          ${simple('Утверждение — это фраза, с которой можно согласиться или не согласиться. Например: «Стране нужен сильный президент». Вы просто отвечаете, как думаете сами.', 'simple--block')}
          <ul class="qz-facts">
            <li><b>40</b>утверждений, по 10 на каждую ось</li>
            <li><b>~7</b>минут на прохождение</li>
            <li><b>1–5</b>клавиши для быстрых ответов на компьютере</li>
          </ul>
          <div class="qz-actions">
            <button class="btn btn--primary" type="button" data-act="start">Начать тест</button>
          </div>
        </div>
        <div class="qz-axes">
          ${D.axes.map((a) => `<div class="qz-axis"><b>${a.name}</b>${a.neg} ↔ ${a.pos}${simple(a.plain)}</div>`).join('')}
        </div>
      </div>`;
  }

  function sideHTML() {
    return `
      <aside class="qz-side" aria-label="Ваша точка сейчас">
        <h4>Ваша точка сейчас</h4>
        <div class="qmini" id="qzMini" aria-hidden="true">
          <span class="mini__ax mini__ax--h"></span><span class="mini__ax mini__ax--v"></span>
          <span class="qmini__lbl qmini__lbl--t">Вертикаль</span>
          <span class="qmini__lbl qmini__lbl--b">Горизонталь</span>
          <span class="qmini__lbl qmini__lbl--l">Восток</span>
          <span class="qmini__lbl qmini__lbl--r">Запад</span>
          ${D.parties
            .map((p) => `<span class="qmini__party" style="--c:${p.color};left:${pct(p.pos.vector)}%;top:${100 - pct(p.pos.power)}%" title="${p.short}"></span>`)
            .join('')}
          <span class="qmini__me" style="left:50%;top:50%"></span>
        </div>
        <div class="qbars">
          ${D.axes
            .map(
              (a) => `
            <div class="qbar" data-axis="${a.id}">
              <div class="qbar__top"><span>${a.short}</span><b>0</b></div>
              <div class="qbar__track" aria-hidden="true"><span class="qbar__knob" style="left:50%"></span></div>
            </div>`
            )
            .join('')}
        </div>
        ${simple('Чёрная точка — это вы. Она двигается после каждого ответа, а цветные точки — партии.', 'simple--block')}
      </aside>`;
  }

  function updateSide() {
    const sc = scores();
    const me = $('.qmini__me', box);
    if (me) {
      me.style.left = pct(sc.vector) + '%';
      me.style.top = 100 - pct(sc.power) + '%';
    }
    $$('.qbar', box).forEach((row) => {
      const v = sc[row.dataset.axis];
      $('.qbar__knob', row).style.left = ((v + 10) / 20) * 100 + '%';
      $('.qbar__top b', row).textContent = num(v);
    });
  }

  function renderRun(dir) {
    box.dataset.view = 'run';
    if (!$('.qz-run', box)) {
      box.innerHTML = `
        <div class="qz-run">
          <div class="qz-main">
            <div class="qz-top">
              <span class="qz-count" id="qzCount"></span>
              <span class="qz-chip" id="qzChip"></span>
            </div>
            <div class="qz-progress" role="progressbar" aria-label="Ответов" aria-valuemin="0" aria-valuemax="${N}" id="qzProgress"><i id="qzBar" style="width:0"></i></div>
            <div class="qz-qrow">
              <p class="qz-q" id="qzQ"></p>
              <button class="tts-btn" type="button" data-tts-read="#qzQ" aria-label="Прочитать вопрос вслух" title="Прочитать вслух">${TTS_ICON}</button>
            </div>
            <p class="simple" id="qzSimple"></p>
            <div class="qz-answers" role="group" aria-labelledby="qzQ">
              ${Q.answers
                .map(
                  (a, i) =>
                    `<button class="qz-ans" type="button" data-v="${a.v}" aria-pressed="false"><kbd aria-hidden="true">${i + 1}</kbd><span class="qz-ans__text">${a.label}${simple(a.plain)}</span><span class="qz-scale" aria-hidden="true"></span></button>`
                )
                .join('')}
            </div>
            <div class="qz-nav">
              <button class="qz-link" type="button" data-act="back">← Назад</button>
              <button class="qz-link" type="button" data-act="restart">Начать заново</button>
              <button class="btn btn--primary btn--sm qz-next" type="button" data-act="next">Далее →</button>
            </div>
          </div>
          ${sideHTML()}
        </div>`;
    }
    const q = Q.questions[state.idx];
    const ax = A.axisById[q.axis];
    const toPos = q.dir > 0;
    $('#qzCount', box).innerHTML = `Вопрос <b>${state.idx + 1}</b> из ${N}`;
    $('#qzChip', box).textContent = ax.short;
    const answered = answeredCount();
    $('#qzBar', box).style.width = (answered / N) * 100 + '%';
    $('#qzProgress', box).setAttribute('aria-valuenow', answered);
    const qEl = $('#qzQ', box);
    qEl.textContent = q.text;
    qEl.classList.remove('is-in');
    if (dir && !A.reduced) {
      qEl.style.setProperty('--from', dir > 0 ? '24px' : '-24px');
      void qEl.offsetWidth;
      qEl.classList.add('is-in');
    }
    const agreePole = toPos ? ax.pos : ax.neg;
    const agreePlain = toPos ? ax.posPlain : ax.negPlain;
    const disPole = toPos ? ax.neg : ax.pos;
    $('#qzSimple', box).innerHTML =
      (q.hint ? `<b>Что это значит.</b> ${q.hint} ` : '') +
      `Если вы согласны, ваша точка сдвинется к «${agreePole}» (${agreePlain}), если нет — к «${disPole}».`;
    const cur = state.answers[state.idx];
    $$('.qz-ans', box).forEach((b) => {
      const on = cur !== null && +b.dataset.v === cur;
      b.classList.toggle('is-picked', on);
      b.setAttribute('aria-pressed', String(on));
    });
    $('[data-act="back"]', box).disabled = state.idx === 0;
    const next = $('[data-act="next"]', box);
    next.hidden = autoNext();
    next.disabled = cur === null;
    next.textContent = state.idx === N - 1 ? 'Показать результат' : 'Далее →';
    updateSide();
  }

  let advancing = null;
  function goNext() {
    if (state.idx < N - 1) {
      state.idx++;
      save();
      renderRun(1);
      announceQuestion();
    } else {
      finish();
    }
  }

  function announceQuestion() {
    if (T) T.announce(`Вопрос ${state.idx + 1} из ${N}. ${Q.questions[state.idx].text}`);
  }

  function answer(v) {
    if (box.dataset.view !== 'run') return;
    // Ответ пришёл во время паузы перед следующим вопросом (быстрый ввод
    // с клавиатуры): доводим переход сразу, а ответ относим к новому вопросу
    if (advancing) {
      clearTimeout(advancing);
      advancing = null;
      goNext();
      if (box.dataset.view !== 'run') return;
    }
    state.answers[state.idx] = v;
    $$('.qz-ans', box).forEach((b) => {
      const on = +b.dataset.v === v;
      b.classList.toggle('is-picked', on);
      b.setAttribute('aria-pressed', String(on));
    });
    const answered = answeredCount();
    $('#qzBar', box).style.width = (answered / N) * 100 + '%';
    $('#qzProgress', box).setAttribute('aria-valuenow', answered);
    updateSide();
    save();
    if (!autoNext()) {
      const next = $('[data-act="next"]', box);
      next.disabled = false;
      return;
    }
    advancing = setTimeout(() => {
      advancing = null;
      goNext();
    }, A.reduced ? 60 : 220);
  }

  function finish() {
    // Если что-то пропущено, считаем это нейтральным ответом
    state.answers = state.answers.map((v) => (v === null ? 0 : v));
    state.done = true;
    save();
    renderResult(true);
    const navH = $('#nav').getBoundingClientRect().height;
    window.scrollTo({ top: window.scrollY + box.getBoundingClientRect().top - navH - 12, behavior: A.reduced ? 'auto' : 'smooth' });
    const h = $('.qz-result h3', box);
    if (h) h.focus({ preventScroll: true });
    // Тест пройден до конца только что (а не открыт готовым после перезагрузки)
    document.dispatchEvent(new CustomEvent('bpc:quiz-done'));
  }

  function restart() {
    clearTimeout(advancing);
    advancing = null;
    state = fresh();
    save();
    A.setMe(null);
    renderRun(0);
    const first = $('.qz-ans', box);
    if (first) first.focus({ preventScroll: true });
    announceQuestion();
  }

  /* ---------- Результат ---------- */
  const CENTER = {
    vector: 'Многовекторность',
    power: 'Баланс властей',
    economy: 'Смешанная экономика',
    identity: 'Двойная идентичность',
  };

  const describe = (ax, v) => C.describe(ax, v, CENTER[ax.id]);

  function renderResult(animate) {
    box.dataset.view = 'result';
    const me = scores();
    A.setMe(me);
    const rank = ranking(me);
    const top = rank.slice(0, 3);
    const far = rank[rank.length - 1];
    const nearIds = new Set(top.map((r) => r.p.id));
    // Подписи соседних точек разводим: вторая по близости — над точкой
    const nearIdx = (id) => top.findIndex((r) => r.p.id === id);
    const title = D.axes.map((a) => describe(a, me[a.id]).pole).join(' · ');

    box.innerHTML = `
      <div class="qz-result">
        <div>
          <p class="qz-result__kicker">Ваш результат</p>
          <h3 tabindex="-1">${title}</h3>
          <p class="qz-result__lead">Ближе всего к вам — <b>${top[0].p.short}</b>: сходство ${top[0].s}%.</p>
          ${simple(`Заголовок — ваши взгляды по четырём спорам. Сходство ${top[0].s}% значит, что ваши ответы больше всего совпали с позициями партии «${top[0].p.short}». Это не значит, что вы должны её поддерживать.`, 'simple--block')}
          <div class="qz-sum">
            ${D.axes
              .map((a) => {
                const v = me[a.id];
                const d = describe(a, v);
                return `
              <div class="qbar" data-axis="${a.id}">
                <div class="qbar__top"><span>${a.name}</span><b>${d.key === 'center' ? 'центр' : d.strength + ' · ' + d.pole} ${num(v)}</b></div>
                <div class="qbar__track" role="img" aria-label="${a.name}: ${num(v)} от −10 (${a.neg}) до +10 (${a.pos})"><span class="qbar__knob" data-v="${v}" style="left:${animate && !A.reduced ? 50 : ((v + 10) / 20) * 100}%"></span></div>
                <div class="qbar__poles" aria-hidden="true"><span>${a.neg}</span><span>${a.pos}</span></div>
                ${simple('Вы ' + C.plainPosition(a, v) + '.')}
              </div>`;
              })
              .join('')}
          </div>
          <div class="qz-actions">
            <button class="btn btn--primary" type="button" data-act="show">Показать на большом компасе</button>
            <button class="btn btn--ghost" type="button" data-act="copy">Скопировать результат</button>
            <button class="qz-link" type="button" data-act="restart">Пройти заново</button>
          </div>
          <p class="qz-copy-msg" id="qzMsg" role="status"></p>
        </div>
        <aside class="qz-side" aria-label="Ближайшие партии">
          <h4>Вы среди партий · вектор × власть</h4>
          <div class="qmini" aria-hidden="true">
            <span class="mini__ax mini__ax--h"></span><span class="mini__ax mini__ax--v"></span>
            <span class="qmini__lbl qmini__lbl--t">Вертикаль</span>
            <span class="qmini__lbl qmini__lbl--b">Горизонталь</span>
            <span class="qmini__lbl qmini__lbl--l">Восток</span>
            <span class="qmini__lbl qmini__lbl--r">Запад</span>
            ${D.parties
              .map(
                (p) =>
                  `<span class="qmini__party${nearIds.has(p.id) ? ' is-near' : ''}${nearIdx(p.id) === 1 ? ' is-up' : ''}" style="--c:${p.color};left:${pct(p.pos.vector)}%;top:${100 - pct(p.pos.power)}%" title="${p.short}">${nearIds.has(p.id) ? `<span>${p.abbr}</span>` : ''}</span>`
              )
              .join('')}
            <span class="qmini__me" style="left:${pct(me.vector)}%;top:${100 - pct(me.power)}%"></span>
          </div>
          <div>
            <h4 class="qz-near__h">Ближе всего по всем четырём осям</h4>
            <div class="qz-near">
              ${top
                .map(
                  (r) =>
                    `<button class="near__item" type="button" data-go="${r.p.id}" style="--c:${r.p.color}"><i aria-hidden="true"></i>${r.p.short}<span>${r.s}%<span class="sr-only"> сходства</span></span></button>`
                )
                .join('')}
            </div>
            <p class="qz-far">Дальше всего: ${far.p.short} (${far.s}%)</p>
          </div>
        </aside>
      </div>`;

    if (animate && !A.reduced) {
      requestAnimationFrame(() =>
        requestAnimationFrame(() =>
          $$('.qz-sum .qbar__knob', box).forEach((k) => (k.style.left = ((+k.dataset.v + 10) / 20) * 100 + '%'))
        )
      );
    }
  }

  function resultText() {
    const me = scores();
    const rank = ranking(me);
    const lines = D.axes.map((a) => `${a.name}: ${num(me[a.id])} (${describe(a, me[a.id]).pole})`);
    return (
      'Мой результат в BelPolitCompass\n' +
      lines.join('\n') +
      `\nБлиже всего: ${rank
        .slice(0, 3)
        .map((r) => `${r.p.short} ${r.s}%`)
        .join(', ')}`
    );
  }

  async function copyResult() {
    const msg = $('#qzMsg', box);
    const text = resultText();
    const old = $('.qz-copy-text', box);
    if (old) old.remove();
    try {
      await navigator.clipboard.writeText(text);
      msg.textContent = 'Результат скопирован.';
    } catch (e) {
      msg.textContent = 'Скопировать автоматически не получилось. Выделите текст ниже и скопируйте вручную.';
      const pre = document.createElement('pre');
      pre.className = 'qz-copy-text';
      pre.textContent = text;
      msg.after(pre);
    }
  }

  /* ---------- События ---------- */
  box.addEventListener('click', (e) => {
    const ans = e.target.closest('.qz-ans');
    if (ans) return answer(+ans.dataset.v);
    const go = e.target.closest('[data-go]');
    if (go) return A.openParty(go.dataset.go);
    const act = e.target.closest('[data-act]');
    if (!act) return;
    const a = act.dataset.act;
    if (a === 'start') {
      state = fresh();
      save();
      renderRun(1);
      $('.qz-ans', box).focus({ preventScroll: true });
      announceQuestion();
    } else if (a === 'back' && state.idx > 0) {
      clearTimeout(advancing);
      advancing = null;
      state.idx--;
      save();
      renderRun(-1);
      announceQuestion();
    } else if (a === 'next' && state.answers[state.idx] !== null) {
      goNext();
      const first = $('.qz-ans.is-picked', box) || $('.qz-ans', box);
      if (first && box.dataset.view === 'run') first.focus({ preventScroll: true });
    } else if (a === 'restart') {
      restart();
    } else if (a === 'show') {
      A.showMeOnCompass();
    } else if (a === 'copy') {
      copyResult();
    }
  });

  // Клавиши 1–5 и Backspace работают, только пока открыта вкладка «Тест»
  document.addEventListener('keydown', (e) => {
    if (box.dataset.view !== 'run' || e.metaKey || e.ctrlKey || e.altKey) return;
    if (T && !T.isActive('quiz')) return;
    if (root.classList.contains('has-sheet') || root.classList.contains('has-tour')) return;
    if (e.target.closest && e.target.closest('input, textarea, select, .dd, [role="tablist"]')) return;
    const k = parseInt(e.key, 10);
    if (k >= 1 && k <= Q.answers.length) {
      e.preventDefault();
      answer(Q.answers[k - 1].v);
    } else if (e.key === 'Backspace' && state.idx > 0) {
      e.preventDefault();
      $('[data-act="back"]', box).click();
    }
  });

  // Автопереход включили или выключили в настройках — обновляем кнопку «Далее»
  document.addEventListener('bpc:settings', () => {
    if (box.dataset.view === 'run') renderRun(0);
  });

  render();

  /* API для настроек: что сохранено и как это удалить */
  window.BPCQuiz = {
    status() {
      return { answered: answeredCount(), total: N, done: !!state.done };
    },
    clear() {
      clearTimeout(advancing);
      advancing = null;
      state = fresh();
      A.storage(KEY, null);
      A.setMe(null);
      renderIntro();
    },
  };
})();
