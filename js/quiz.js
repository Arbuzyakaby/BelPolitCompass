/* ==========================================================================
   BelPolitCompass · Alpha 0.2 — тест «Где я на компасе»
   40 утверждений, по 10 на ось. Результат считается в той же шкале
   от −10 до +10, что и позиции партий. Ответы хранятся только в браузере.
   ========================================================================== */
(function () {
  'use strict';

  const D = window.BPC;
  const A = window.BPCApp;
  const Q = D.quiz;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const box = $('#quizBox');
  if (!box) return;

  const KEY = 'bpc-quiz-' + Q.id;
  const N = Q.questions.length;
  const perAxis = Object.fromEntries(D.axes.map((a) => [a.id, Q.questions.filter((q) => q.axis === a.id).length]));

  /* ---------- Состояние ---------- */
  let state = load();

  function fresh() {
    return { answers: new Array(N).fill(null), idx: 0, done: false };
  }

  function load() {
    try {
      const raw = A.storage(KEY);
      if (!raw) return fresh();
      const s = JSON.parse(raw);
      if (!Array.isArray(s.answers) || s.answers.length !== N) return fresh();
      s.idx = Math.max(0, Math.min(N - 1, s.idx | 0));
      return s;
    } catch (e) {
      return fresh();
    }
  }

  function save() {
    A.storage(KEY, JSON.stringify(state));
  }

  const answeredCount = () => state.answers.filter((v) => v !== null).length;

  /* Пропущенный вопрос считается нейтральным ответом */
  function scores() {
    const sum = Object.fromEntries(D.axes.map((a) => [a.id, 0]));
    Q.questions.forEach((q, i) => {
      const v = state.answers[i];
      if (v !== null) sum[q.axis] += v * q.dir;
    });
    return Object.fromEntries(D.axes.map((a) => [a.id, Math.round(((sum[a.id] / (2 * perAxis[a.id])) * 10) * 10) / 10]));
  }

  const num = (v) => A.fmt1(v);
  const pct = (v, pad = 8) => pad + ((v + 10) / 20) * (100 - pad * 2);

  function ranking(me) {
    return D.parties
      .map((p) => ({ p, s: A.similarity({ pos: me }, p) }))
      .sort((a, b) => b.s - a.s);
  }

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
          ${D.axes.map((a) => `<div class="qz-axis"><b>${a.name}</b>${a.neg} ↔ ${a.pos}</div>`).join('')}
        </div>
      </div>`;
  }

  function sideHTML() {
    return `
      <aside class="qz-side">
        <h4>Ваша точка сейчас</h4>
        <div class="qmini" id="qzMini">
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
              <div class="qbar__track"><span class="qbar__knob" style="left:50%"></span></div>
            </div>`
            )
            .join('')}
        </div>
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
            <div class="qz-progress"><i id="qzBar" style="width:0"></i></div>
            <p class="qz-q" id="qzQ"></p>
            <div class="qz-answers" role="group" aria-labelledby="qzQ">
              ${Q.answers
                .map(
                  (a, i) =>
                    `<button class="qz-ans" type="button" data-v="${a.v}"><kbd>${i + 1}</kbd>${a.label}<span class="qz-scale" aria-hidden="true"></span></button>`
                )
                .join('')}
            </div>
            <div class="qz-nav">
              <button class="qz-link" type="button" data-act="back">← Назад</button>
              <button class="qz-link" type="button" data-act="restart">Начать заново</button>
            </div>
          </div>
          ${sideHTML()}
        </div>`;
    }
    const q = Q.questions[state.idx];
    const ax = A.axisById[q.axis];
    $('#qzCount', box).innerHTML = `Вопрос <b>${state.idx + 1}</b> из ${N}`;
    $('#qzChip', box).textContent = ax.short;
    $('#qzBar', box).style.width = (answeredCount() / N) * 100 + '%';
    const qEl = $('#qzQ', box);
    qEl.textContent = q.text;
    qEl.classList.remove('is-in');
    if (dir) {
      qEl.style.setProperty('--from', dir > 0 ? '24px' : '-24px');
      void qEl.offsetWidth;
      qEl.classList.add('is-in');
    }
    const cur = state.answers[state.idx];
    $$('.qz-ans', box).forEach((b) => b.classList.toggle('is-picked', cur !== null && +b.dataset.v === cur));
    $('[data-act="back"]', box).disabled = state.idx === 0;
    updateSide();
  }

  let advancing = null;
  function answer(v) {
    if (box.dataset.view !== 'run' || advancing) return;
    state.answers[state.idx] = v;
    $$('.qz-ans', box).forEach((b) => b.classList.toggle('is-picked', +b.dataset.v === v));
    $('#qzBar', box).style.width = (answeredCount() / N) * 100 + '%';
    updateSide();
    save();
    advancing = setTimeout(() => {
      advancing = null;
      if (state.idx < N - 1) {
        state.idx++;
        save();
        renderRun(1);
      } else {
        finish();
      }
    }, 220);
  }

  function finish() {
    // Если что-то пропущено, считаем это нейтральным ответом
    state.answers = state.answers.map((v) => (v === null ? 0 : v));
    state.done = true;
    save();
    renderResult(true);
    box.scrollIntoView({ behavior: A.reduced ? 'auto' : 'smooth', block: 'start' });
  }

  function restart() {
    clearTimeout(advancing);
    advancing = null;
    state = fresh();
    save();
    A.setMe(null);
    renderRun(0);
  }

  /* ---------- Результат ---------- */
  const CENTER = {
    vector: 'Многовекторность',
    power: 'Баланс властей',
    economy: 'Смешанная экономика',
    identity: 'Двойная идентичность',
  };

  function describe(ax, v) {
    const a = Math.abs(v);
    if (a < 1.5) return { pole: CENTER[ax.id], strength: 'центр' };
    const strength = a < 4.5 ? 'умеренно' : a < 7.5 ? 'заметно' : 'твёрдо';
    return { pole: v > 0 ? ax.pos : ax.neg, strength };
  }

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
          <h3>${title}</h3>
          <p class="qz-result__lead">Ближе всего к вам — <b>${top[0].p.short}</b>: сходство ${top[0].s}%.</p>
          <div class="qz-sum">
            ${D.axes
              .map((a) => {
                const v = me[a.id];
                const d = describe(a, v);
                return `
              <div class="qbar" data-axis="${a.id}">
                <div class="qbar__top"><span>${a.name}</span><b>${d.strength === 'центр' ? 'центр' : d.strength + ' · ' + d.pole} ${num(v)}</b></div>
                <div class="qbar__track"><span class="qbar__knob" data-v="${v}" style="left:${animate ? 50 : ((v + 10) / 20) * 100}%"></span></div>
                <div class="qbar__poles"><span>${a.neg}</span><span>${a.pos}</span></div>
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
        <aside class="qz-side">
          <h4>Вы среди партий · вектор × власть</h4>
          <div class="qmini">
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
            <h4 style="margin-bottom:8px">Ближе всего по всем четырём осям</h4>
            <div class="qz-near">
              ${top
                .map(
                  (r) =>
                    `<button class="near__item" type="button" data-go="${r.p.id}" style="--c:${r.p.color}"><i></i>${r.p.short}<span>${r.s}%</span></button>`
                )
                .join('')}
            </div>
            <p class="qz-far">Дальше всего: ${far.p.short} (${far.s}%)</p>
          </div>
        </aside>
      </div>`;

    if (animate) {
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
    try {
      await navigator.clipboard.writeText(text);
      msg.textContent = 'Результат скопирован.';
    } catch (e) {
      msg.textContent = 'Скопировать автоматически не получилось. Выделите текст ниже и скопируйте вручную.';
      const pre = document.createElement('pre');
      pre.className = 'qz-copy-text';
      pre.textContent = text;
      pre.style.cssText = 'white-space:pre-wrap;font:13px/1.5 var(--mono);color:var(--text-2);margin:8px 0 0;user-select:all';
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
    } else if (a === 'back' && state.idx > 0) {
      clearTimeout(advancing);
      advancing = null;
      state.idx--;
      save();
      renderRun(-1);
    } else if (a === 'restart') {
      restart();
    } else if (a === 'show') {
      A.showMeOnCompass();
    } else if (a === 'copy') {
      copyResult();
    }
  });

  // Клавиши 1–5 и Backspace работают, пока тест на экране
  document.addEventListener('keydown', (e) => {
    if (box.dataset.view !== 'run' || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.target.closest && e.target.closest('input, textarea, select, .dd')) return;
    const r = box.getBoundingClientRect();
    if (r.bottom < 0 || r.top > window.innerHeight) return;
    const k = parseInt(e.key, 10);
    if (k >= 1 && k <= Q.answers.length) {
      e.preventDefault();
      answer(Q.answers[k - 1].v);
    } else if (e.key === 'Backspace' && state.idx > 0) {
      e.preventDefault();
      $('[data-act="back"]', box).click();
    }
  });

  render();
})();
