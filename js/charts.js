/* ==========================================================================
   BelPolitCompass · Alpha 0.4 — графики и диаграммы (чистый SVG, без библиотек)
   У каждой диаграммы есть таблица с теми же данными: для экранного диктора
   и для тех, кому удобнее читать цифры (настройки → «Данные таблицами»).
   ========================================================================== */
(function () {
  'use strict';

  const D = window.BPC;
  const A = window.BPCApp;
  const C = window.BPCCore;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const NS = 'http://www.w3.org/2000/svg';
  const root = document.documentElement;
  const parties = D.parties;
  const byId = A.byId;
  const NONPARTISAN = { id: 'np', short: 'Беспартийные', color: 'var(--np)', seats: D.parliament.nonPartisan };
  const total = D.parliament.total;
  const pct = (n) => C.pct1((n / total) * 100) + '%';

  /* Все графики сразу рисуются в финальном виде; анимация появления
     проигрывается, когда блок подъезжает к экрану (см. onApproach в app.js) */
  const onVisible = A.onApproach;
  const reflow = (el) => void el.offsetWidth;
  const ease = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);

  /* Таблица данных под диаграммой */
  function dataTable(caption, head, rows) {
    return `
      <details class="data-table">
        <summary>Данные таблицей</summary>
        <div class="table-wrap" tabindex="0" role="region" aria-label="${caption}">
          <table>
            <caption>${caption}</caption>
            <thead><tr>${head.map((h) => `<th scope="col">${h}</th>`).join('')}</tr></thead>
            <tbody>${rows
              .map((r) => `<tr>${r.map((c, i) => (i === 0 ? `<th scope="row">${c}</th>` : `<td>${c}</td>`)).join('')}</tr>`)
              .join('')}</tbody>
          </table>
        </div>
      </details>`;
  }

  const syncTables = () => {
    const on = root.getAttribute('data-tables') === 'on';
    $$('.data-table').forEach((d) => (d.open = on));
  };
  document.addEventListener('bpc:settings', (e) => {
    if (e.detail && e.detail.changed && !e.detail.changed.includes('tables')) return;
    syncTables();
  });

  /* ==========================================================================
     1. Полукруг парламента
     ========================================================================== */
  (function hemicycle() {
    const box = $('#hemicycle');
    const groups = D.parliament.order.map((id) => byId[id]).concat(NONPARTISAN);

    const ROWS = 6;
    const cx = 100;
    const cy = 100;
    const R = 94;
    const r0 = 0.42;
    const radii = Array.from({ length: ROWS }, (_, i) => r0 + ((1 - r0) * i) / (ROWS - 1));
    const sumR = radii.reduce((a, b) => a + b, 0);
    const perRow = radii.map((r) => Math.round((total * r) / sumR));
    perRow[ROWS - 1] += total - perRow.reduce((a, b) => a + b, 0);

    const seats = [];
    radii.forEach((r, i) => {
      const n = perRow[i];
      for (let k = 0; k < n; k++) {
        const th = Math.PI - (k * Math.PI) / (n - 1);
        seats.push({ th, r, x: cx + r * R * Math.cos(th), y: cy - r * R * Math.sin(th) });
      }
    });
    seats.sort((a, b) => b.th - a.th || a.r - b.r);

    let gi = 0;
    let left = groups[0].seats;
    seats.forEach((s) => {
      while (left === 0 && gi < groups.length - 1) {
        gi++;
        left = groups[gi].seats;
      }
      s.g = groups[gi];
      left--;
    });

    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 200 108');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', `Распределение ${total} мест в Палате представителей: ` + groups.map((g) => `${g.short} — ${g.seats}`).join(', '));
    svg.innerHTML =
      seats
        .map(
          (s, i) =>
            `<circle class="seat" data-g="${s.g.id}" data-i="${i}" cx="${s.x.toFixed(2)}" cy="${s.y.toFixed(2)}" r="3.9" style="fill:${s.g.color}"><title>${s.g.short}</title></circle>`
        )
        .join('') +
      `<text class="hemi__center" x="100" y="92" text-anchor="middle" font-size="22" aria-hidden="true">${total}</text>` +
      `<text class="hemi__caption" x="100" y="103" text-anchor="middle" font-size="6.5" aria-hidden="true">мест · ${D.parliament.convocation}</text>`;
    box.appendChild(svg);

    const legend = $('#hemiLegend');
    legend.innerHTML = groups
      .map((g) =>
        g.id === 'np'
          ? `<span class="legend__item" data-g="${g.id}" style="--c:${g.color}"><i aria-hidden="true"></i>${g.short} <b>${g.seats}</b></span>`
          : `<button class="legend__item" type="button" data-g="${g.id}" style="--c:${g.color}" aria-label="${g.short}: ${g.seats} ${A.seatWord(g.seats)}. Открыть карточку партии"><i aria-hidden="true"></i>${g.short} <b>${g.seats}</b></button>`
      )
      .join('');
    legend.insertAdjacentHTML(
      'afterend',
      dataTable('Места в Палате представителей VIII созыва', ['Группа', 'Мест', 'Доля'], groups.map((g) => [g.short, g.seats, pct(g.seats)]))
    );

    const focus = (id) => {
      box.classList.toggle('has-focus', !!id);
      $$('.seat', svg).forEach((c) => c.classList.toggle('is-focus', c.dataset.g === id));
    };
    $$('.legend__item', legend).forEach((el) => {
      el.addEventListener('pointerenter', () => focus(el.dataset.g));
      el.addEventListener('pointerleave', () => focus(null));
      el.addEventListener('focus', () => focus(el.dataset.g));
      el.addEventListener('blur', () => focus(null));
      if (el.dataset.g !== 'np') el.addEventListener('click', () => A.openParty(el.dataset.g));
    });
    svg.addEventListener('pointerover', (e) => {
      const c = e.target.closest('.seat');
      if (c) focus(c.dataset.g);
    });
    svg.addEventListener('pointerleave', () => focus(null));
    svg.addEventListener('click', (e) => {
      const c = e.target.closest('.seat');
      if (c && c.dataset.g !== 'np') A.openParty(c.dataset.g);
    });
    document.addEventListener('bpc:hover', (e) => focus(e.detail && byId[e.detail] && byId[e.detail].seats ? e.detail : null));

    onVisible(box, () => {
      const els = $$('.seat', svg);
      els.forEach((c) => (c.style.transitionDelay = c.dataset.i * 9 + 'ms'));
      A.replay(box);
      // После появления убираем задержки, чтобы подсветка реагировала мгновенно
      setTimeout(() => els.forEach((c) => (c.style.transitionDelay = '')), seats.length * 9 + 700);
    });
  })();

  /* ==========================================================================
     2. Бублик долей
     ========================================================================== */
  (function donut() {
    const box = $('#donut');
    const groups = D.parliament.order
      .map((id) => byId[id])
      .concat(NONPARTISAN)
      .sort((a, b) => b.seats - a.seats);
    const r = 40;
    const Cc = 2 * Math.PI * r;
    const GAP = 1.4;

    let acc = 0;
    const segs = groups.map((g) => {
      const len = (g.seats / total) * Cc;
      const s = { g, start: acc, len: Math.max(0, len - GAP) };
      acc += len;
      return s;
    });

    box.innerHTML = `
      <div class="donut__wrap">
        <svg viewBox="0 0 100 100" aria-hidden="true">
          <circle cx="50" cy="50" r="${r}" fill="none" stroke="var(--surface-3)" stroke-width="14"/>
          ${segs
            .map(
              (s) =>
                `<circle class="donut__seg" data-g="${s.g.id}" cx="50" cy="50" r="${r}" style="stroke:${s.g.color}" stroke-dasharray="${s.len} ${Cc}" stroke-dashoffset="${-s.start}"/>`
            )
            .join('')}
        </svg>
        <div class="donut__center" aria-hidden="true"><div><b data-n="${total}">${total}</b><span>мест всего</span></div></div>
      </div>
      <ul class="donut__list">
        ${groups
          .map((g) => {
            const inner = `<i aria-hidden="true"></i><span>${g.short}</span><b>${g.seats}</b><span>${pct(g.seats)}</span>`;
            return g.id === 'np'
              ? `<li><span class="donut__row" data-g="${g.id}" style="--c:${g.color}">${inner}</span></li>`
              : `<li><button class="donut__row" type="button" data-g="${g.id}" style="--c:${g.color}" aria-label="${g.short}: ${g.seats} мест, ${pct(g.seats)}. Открыть карточку партии">${inner}</button></li>`;
          })
          .join('')}
      </ul>`;

    const center = $('.donut__center b', box);
    const caption = center.nextElementSibling;
    const segEls = $$('.donut__seg', box);
    const setCenter = (g) => {
      center.textContent = g ? g.seats : total;
      caption.textContent = g ? g.short : 'мест всего';
      segEls.forEach((el) => el.classList.toggle('is-dim', !!g && el.dataset.g !== g.id));
    };
    const byG = Object.fromEntries(groups.map((g) => [g.id, g]));
    [...segEls, ...$$('.donut__row', box)].forEach((el) => {
      const g = byG[el.dataset.g];
      el.addEventListener('pointerenter', () => setCenter(g));
      el.addEventListener('pointerleave', () => setCenter(null));
      el.addEventListener('focus', () => setCenter(g));
      el.addEventListener('blur', () => setCenter(null));
      if (g.id !== 'np') el.addEventListener('click', () => A.openParty(g.id));
    });

    onVisible(box, () => {
      box.classList.add('no-trans');
      segEls.forEach((el) => el.setAttribute('stroke-dasharray', `0 ${Cc}`));
      reflow(box);
      box.classList.remove('no-trans');
      segEls.forEach((el, i) => {
        setTimeout(() => el.setAttribute('stroke-dasharray', `${segs[i].len} ${Cc}`), 60 + i * 140);
      });
      A.countUp(center, total, 1200);
    });
  })();

  /* ==========================================================================
     3. Карточки-счётчики
     ========================================================================== */
  (function stats() {
    const gov = parties.filter((p) => p.camp === 'gov');
    const opp = parties.filter((p) => p.camp === 'opp');
    let sum = 0;
    let n = 0;
    gov.forEach((a) =>
      opp.forEach((b) => {
        sum += A.similarity(a, b);
        n++;
      })
    );
    const avgSim = Math.round(sum / n);
    const br = byId.br;
    const icons = {
      seat: '<svg viewBox="0 0 24 24"><path d="M4 18v-6a8 8 0 0 1 16 0v6M4 18h16M8 18v-3M16 18v-3" stroke-linecap="round"/></svg>',
      user: '<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0" stroke-linecap="round"/></svg>',
      off: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M5.6 5.6l12.8 12.8" stroke-linecap="round"/></svg>',
      link: '<svg viewBox="0 0 24 24"><path d="M9 15l6-6M10 6.5l1.5-1.5a4.2 4.2 0 0 1 6 6L16 12.5M8 11.5L6.5 13a4.2 4.2 0 0 0 6 6l1.5-1.5" stroke-linecap="round"/></svg>',
    };
    const inactive = parties.filter((p) => p.status !== 'active').length;
    const items = [
      {
        n: br.seats,
        small: '',
        label: `${A.seatWord(br.seats)} у «Белой Руси» — ${Math.round((br.seats / total) * 100)}% палаты`,
        plain: 'Почти половина всех мест в парламенте у одной партии.',
        i: icons.seat,
      },
      { n: D.parliament.nonPartisan, small: '', label: 'беспартийных депутатов', plain: 'Столько депутатов не состоят ни в одной партии.', i: icons.user },
      { n: inactive, small: '', label: 'партий ликвидированы или не зарегистрированы', plain: 'Столько партий больше не могут официально работать.', i: icons.off },
      {
        n: avgSim,
        small: '%',
        label: 'среднее сходство провластных и оппозиционных партий',
        plain: 'Насколько в среднем похожи взгляды партий из разных лагерей. 100% — одинаковые.',
        i: icons.link,
      },
    ];
    const box = $('#statCards');
    box.innerHTML = items
      .map(
        (s) =>
          `<div class="stat"><span class="stat__spark" aria-hidden="true">${s.i}</span><div class="stat__num"><span data-n="${s.n}">${s.n}</span><small>${s.small}</small></div><div class="stat__label">${s.label}</div>${A.simple(s.plain)}</div>`
      )
      .join('');
    onVisible(box, () => $$('[data-n]', box).forEach((el) => A.countUp(el, +el.dataset.n)));
  })();

  /* ==========================================================================
     4. Рейтинг по оси (расходящиеся бары)
     ========================================================================== */
  (function divergingBars() {
    const box = $('#dbars');
    const tabs = $('#barsTabs');
    const sub = $('#barsSub');
    // Высота строки растёт вместе с размером текста
    const rowH = () => Math.round(30 * (parseFloat(getComputedStyle(root).getPropertyValue('--fs')) || 1) * (root.getAttribute('data-spacing') === 'on' ? 1.25 : 1));
    let axis = 'vector';
    let visible = true;

    tabs.insertAdjacentHTML(
      'afterbegin',
      D.axes
        .map(
          (a, i) =>
            `<button class="seg__btn${i === 0 ? ' is-active' : ''}" type="button" data-axis="${a.id}" role="tab" id="barsTab-${a.id}" aria-controls="dbars" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}">${a.short}</button>`
        )
        .join('')
    );

    box.innerHTML = parties
      .map(
        (p) => `
        <div class="dbar" data-id="${p.id}" style="--c:${p.color}" role="button" tabindex="0">
          <span class="dbar__name">${p.short}</span>
          <span class="dbar__track" aria-hidden="true"><span class="dbar__fill" style="left:50%;width:0"></span></span>
          <span class="dbar__val">0</span>
        </div>`
      )
      .join('');
    box.insertAdjacentHTML(
      'afterend',
      '<div class="dbars__poles" aria-hidden="true"><span></span><div><span id="poleNeg"></span><span id="polePos"></span></div><span></span></div>' +
        dataTable(
          'Позиции партий по всем осям (от −10 до +10)',
          ['Партия'].concat(D.axes.map((a) => `${a.short}<br><small>${a.neg} ↔ ${a.pos}</small>`)),
          parties.map((p) => [p.short].concat(D.axes.map((a) => A.fmt(p.pos[a.id]))))
        )
    );

    const rows = $$('.dbar', box);
    rows.forEach((r) => {
      r.addEventListener('click', () => A.openParty(r.dataset.id));
      r.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          A.openParty(r.dataset.id);
        }
      });
      r.addEventListener('pointerenter', () => A.setHover(r.dataset.id));
      r.addEventListener('pointerleave', () => A.setHover(null));
    });

    function render() {
      const ax = D.axes.find((a) => a.id === axis);
      const ROW = rowH();
      box.style.height = parties.length * ROW + 'px';
      sub.textContent = `${ax.name}: от «${ax.neg}» (−10) до «${ax.pos}» (+10)`;
      $('#poleNeg').textContent = '← ' + ax.neg;
      $('#polePos').textContent = ax.pos + ' →';
      const order = parties.slice().sort((a, b) => b.pos[axis] - a.pos[axis] || b.seats - a.seats);
      order.forEach((p, i) => {
        const row = rows.find((r) => r.dataset.id === p.id);
        row.style.transform = `translateY(${i * ROW}px)`;
        row.style.height = ROW - 4 + 'px';
        const v = p.pos[axis];
        const fill = $('.dbar__fill', row);
        const w = visible ? (Math.abs(v) / 20) * 100 : 0;
        fill.style.left = v < 0 ? 50 - w + '%' : '50%';
        fill.style.width = Math.max(w, visible && v === 0 ? 0.8 : 0) + '%';
        fill.classList.toggle('is-neg', v < 0);
        $('.dbar__val', row).textContent = A.fmt(v);
        row.setAttribute('aria-label', `${i + 1}. ${p.short}: ${A.fmt(v)} (${C.describe(ax, v, 'центр').pole}). Открыть карточку`);
      });
      // Порядок фокуса совпадает с порядком на экране (переставляем, только если он изменился)
      if (order.some((p, i) => box.children[i] !== rows.find((r) => r.dataset.id === p.id))) {
        order.forEach((p) => box.appendChild(rows.find((r) => r.dataset.id === p.id)));
      }
    }

    A.initSeg(tabs, (btn) => {
      axis = btn.dataset.axis;
      render();
    });
    render();
    window.addEventListener('resize', () => render());
    document.addEventListener('bpc:settings', () => requestAnimationFrame(render));
    onVisible(box, () => {
      box.classList.add('no-trans');
      visible = false;
      render();
      reflow(box);
      box.classList.remove('no-trans');
      visible = true;
      requestAnimationFrame(render);
    });
  })();

  /* ==========================================================================
     5. Радар сравнения
     ========================================================================== */
  (function radar() {
    const box = $('#radar');
    const chipsBox = $('#radarChips');
    const S = 300;
    const c = S / 2;
    const R = 118;
    const axes = D.axes;
    const angles = axes.map((_, i) => -Math.PI / 2 + (i * 2 * Math.PI) / axes.length);
    let selected = ['br', 'kpb', 'bnf'];
    const shapes = {}; // id -> {el, pts}

    const pt = (i, k) => [c + Math.cos(angles[i]) * R * k, c + Math.sin(angles[i]) * R * k];

    let g = '';
    [0.25, 0.5, 0.75, 1].forEach((k) => {
      g += `<polygon class="radar__ring" points="${axes.map((_, i) => pt(i, k).join(',')).join(' ')}"/>`;
    });
    axes.forEach((ax, i) => {
      const [x, y] = pt(i, 1);
      const [lx, ly] = pt(i, 1.2);
      const anchor = Math.abs(Math.cos(angles[i])) < 0.1 ? 'middle' : Math.cos(angles[i]) > 0 ? 'start' : 'end';
      const dy = Math.sin(angles[i]) < -0.5 ? -8 : Math.sin(angles[i]) > 0.5 ? 12 : 0;
      g += `<line class="radar__spoke" x1="${c}" y1="${c}" x2="${x}" y2="${y}"/>`;
      g += `<text class="radar__label" x="${lx}" y="${ly + dy}" text-anchor="${anchor}">${ax.pos}</text>`;
      g += `<text class="radar__sublabel" x="${lx}" y="${ly + dy + 13}" text-anchor="${anchor}">центр — ${ax.neg.toLowerCase()}</text>`;
    });

    box.innerHTML = `<svg viewBox="-80 -20 ${S + 160} ${S + 40}" role="img" id="radarSvg"><g aria-hidden="true">${g}</g><g id="radarShapes" aria-hidden="true"></g></svg>`;
    const svgEl = $('#radarSvg', box);
    const layer = $('#radarShapes', box);

    const describeSel = () =>
      svgEl.setAttribute(
        'aria-label',
        'Радар сравнения. ' +
          (selected.length
            ? selected.map((id) => `${byId[id].short}: ` + axes.map((a) => `${a.short.toLowerCase()} ${A.fmt(byId[id].pos[a.id])}`).join(', ')).join('; ')
            : 'Партии не выбраны')
      );

    const target = (p) => axes.map((ax, i) => pt(i, Math.max(0.04, (p.pos[ax.id] + 10) / 20)));
    const center = () => axes.map(() => [c, c]);

    function tween(shape, to, done) {
      const from = shape.pts;
      const t0 = performance.now();
      const dur = A.reduced ? 1 : 800;
      cancelAnimationFrame(shape.raf);
      const frame = (t) => {
        const k = ease(Math.min(1, (t - t0) / dur));
        const cur = from.map((p, i) => [p[0] + (to[i][0] - p[0]) * k, p[1] + (to[i][1] - p[1]) * k]);
        shape.pts = cur;
        shape.poly.setAttribute('points', cur.map((p) => p.join(',')).join(' '));
        shape.dots.forEach((d, i) => {
          d.setAttribute('cx', cur[i][0]);
          d.setAttribute('cy', cur[i][1]);
        });
        if (k < 1) shape.raf = requestAnimationFrame(frame);
        else if (done) done();
      };
      shape.raf = requestAnimationFrame(frame);
    }

    function addShape(id, instant) {
      const p = byId[id];
      const grp = document.createElementNS(NS, 'g');
      grp.innerHTML =
        `<polygon class="radar__poly" style="fill:${p.color};stroke:${p.color}" fill-opacity="0.12"/>` +
        axes.map(() => `<circle class="radar__pt" r="4" style="fill:${p.color}"/>`).join('');
      layer.appendChild(grp);
      const shape = { grp, poly: grp.firstChild, dots: $$('circle', grp), pts: center() };
      shapes[id] = shape;
      if (instant) {
        shape.pts = target(p);
        shape.poly.setAttribute('points', shape.pts.map((q) => q.join(',')).join(' '));
        shape.dots.forEach((d, i) => {
          d.setAttribute('cx', shape.pts[i][0]);
          d.setAttribute('cy', shape.pts[i][1]);
        });
      } else {
        tween(shape, target(p));
      }
    }

    function removeShape(id) {
      const s = shapes[id];
      delete shapes[id];
      tween(s, center(), () => s.grp.remove());
    }

    chipsBox.innerHTML = parties
      .map(
        (p) =>
          `<button class="chip${selected.includes(p.id) ? ' is-on' : ''}" type="button" data-id="${p.id}" style="--c:${p.color}" aria-pressed="${selected.includes(p.id)}" aria-label="${p.short}" title="${p.short}"><i aria-hidden="true"></i>${p.abbr}</button>`
      )
      .join('');

    const setChip = (id, on) => {
      const chip = $(`.chip[data-id="${id}"]`, chipsBox);
      chip.classList.toggle('is-on', on);
      chip.setAttribute('aria-pressed', String(on));
    };

    chipsBox.addEventListener('click', (e) => {
      const chip = e.target.closest('.chip');
      if (!chip) return;
      const id = chip.dataset.id;
      if (selected.includes(id)) {
        selected = selected.filter((x) => x !== id);
        setChip(id, false);
        removeShape(id);
      } else {
        if (selected.length >= 3) {
          // Самая старая партия уступает место новой
          const old = selected.shift();
          setChip(old, false);
          removeShape(old);
        }
        selected.push(id);
        setChip(id, true);
        addShape(id);
      }
      describeSel();
    });

    selected.forEach((id) => addShape(id, true));
    describeSel();
    onVisible(box, () =>
      selected.forEach((id) => {
        const sh = shapes[id];
        sh.pts = center();
        tween(sh, target(byId[id]));
      })
    );
  })();

  /* ==========================================================================
     6. Разрыв между лагерями
     ========================================================================== */
  (function campGap() {
    const box = $('#gap');
    const GOV = 'var(--gov)';
    const OPP = 'var(--opp)';
    const avg = (camp, ax) => {
      const ps = parties.filter((p) => p.camp === camp);
      return ps.reduce((s, p) => s + p.pos[ax], 0) / ps.length;
    };
    const toPct = (v) => ((v + 10) / 20) * 100;
    const num = (v) => v.toFixed(1).replace('.', ',').replace('-', C.MINUS);

    box.innerHTML =
      `<div class="gap__legend" aria-hidden="true"><span style="--c:${GOV}"><i></i>Провластные</span><span style="--c:${OPP}"><i></i>Оппозиционные</span></div>` +
      D.axes
        .map((ax) => {
          const g = avg('gov', ax.id);
          const o = avg('opp', ax.id);
          return `
          <div class="gaprow" data-g="${g}" data-o="${o}">
            <div class="gaprow__top"><span class="gaprow__name">${ax.name}</span><span class="gaprow__delta">разрыв <b>${num(Math.abs(g - o))}</b> из 20</span></div>
            <div class="gaprow__track" style="--from:${g < o ? GOV : OPP};--to:${g < o ? OPP : GOV}" role="img" aria-label="${ax.name}: провластные в среднем ${num(g)}, оппозиционные ${num(o)}">
              <span class="gaprow__span"></span>
              <span class="gaprow__pin" data-pin="g" style="--c:${GOV}"></span>
              <span class="gaprow__pin" data-pin="o" style="--c:${OPP}"></span>
            </div>
            <div class="gaprow__poles" aria-hidden="true"><span>${ax.neg}</span><span>${ax.pos}</span></div>
          </div>`;
        })
        .join('');

    const gaps = D.axes.map((ax) => ({ ax, d: Math.abs(avg('gov', ax.id) - avg('opp', ax.id)) })).sort((a, b) => b.d - a.d);
    box.insertAdjacentHTML(
      'beforeend',
      `<div class="gap__insight"><b>Главная линия раскола — «${gaps[0].ax.name.toLowerCase()}»</b> (${num(gaps[0].d)} пункта). ` +
        `Ближе всего лагеря в вопросе «${gaps[gaps.length - 1].ax.name.toLowerCase()}» (${num(gaps[gaps.length - 1].d)}): ` +
        `и провластные, и часть оппозиционных партий поддерживают социальное государство.</div>` +
        A.simple(`Сильнее всего лагеря спорят о том, ${gaps[0].ax.plain.charAt(0).toLowerCase() + gaps[0].ax.plain.slice(1).replace(/\.$/, '')}.`, 'simple--block') +
        dataTable(
          'Средние позиции лагерей',
          ['Ось', 'Провластные', 'Оппозиционные', 'Разрыв'],
          D.axes.map((ax) => {
            const g = avg('gov', ax.id);
            const o = avg('opp', ax.id);
            return [ax.name, num(g), num(o), num(Math.abs(g - o))];
          })
        )
    );

    const place = (row, rest) => {
      const g = rest ? 50 : toPct(+row.dataset.g);
      const o = rest ? 50 : toPct(+row.dataset.o);
      $('[data-pin="g"]', row).style.left = g + '%';
      $('[data-pin="o"]', row).style.left = o + '%';
      const span = $('.gaprow__span', row);
      span.style.left = Math.min(g, o) + '%';
      span.style.width = Math.abs(g - o) + '%';
    };
    const rows = $$('.gaprow', box);
    rows.forEach((row) => place(row));
    onVisible(box, () => {
      box.classList.add('no-trans');
      rows.forEach((row) => place(row, true));
      reflow(box);
      box.classList.remove('no-trans');
      rows.forEach((row, i) => setTimeout(() => place(row), 60 + i * 150));
    });
  })();

  /* ==========================================================================
     7. Матрица близости
     ========================================================================== */
  (function matrix() {
    const box = $('#matrix');
    const n = parties.length;
    box.setAttribute('role', 'img');
    box.setAttribute('aria-label', 'Матрица близости партий. Те же данные — в таблице ниже.');
    box.style.gridTemplateColumns = `44px repeat(${n}, minmax(0, 1fr))`;
    let html = '<span></span>';
    parties.forEach((p) => (html += `<span class="mx-h" style="--c:${p.color}" title="${p.name}">${p.abbr.slice(0, 3)}</span>`));
    parties.forEach((a, i) => {
      html += `<span class="mx-h mx-h--row" style="--c:${a.color}"><i></i>${a.abbr}</span>`;
      parties.forEach((b, j) => {
        const s = A.similarity(a, b);
        const v = i === j ? 0 : Math.max(0, Math.min(1, (s - 30) / 70));
        html += `<span class="mx-c${i === j ? ' is-diag' : ''}" data-a="${a.id}" data-b="${b.id}" data-s="${s}" style="--v:${v.toFixed(3)};--d:${i + j}"></span>`;
      });
    });
    box.innerHTML = html;
    const tip = document.createElement('div');
    tip.className = 'mx-tip';
    tip.setAttribute('aria-hidden', 'true');
    tip.textContent = 'Наведите или нажмите на клетку, чтобы увидеть сходство';
    box.parentElement.after(tip);
    tip.insertAdjacentHTML(
      'afterend',
      dataTable(
        'Сходство партий, % (100% — полное совпадение)',
        ['Партия'].concat(parties.map((p) => `<abbr title="${p.name}">${p.abbr}</abbr>`)),
        parties.map((a) => [a.short].concat(parties.map((b) => (a === b ? '—' : A.similarity(a, b)))))
      )
    );

    let pinned = null;
    const showCell = (cell) => {
      const a = byId[cell.dataset.a];
      const b = byId[cell.dataset.b];
      tip.innerHTML =
        a === b ? `<b>${a.short}</b> — сама с собой` : `<b>${a.short}</b> ↔ <b>${b.short}</b>: сходство <b>${cell.dataset.s}%</b>`;
    };
    box.addEventListener('pointerover', (e) => {
      const cell = e.target.closest('.mx-c');
      if (cell && !pinned) showCell(cell);
    });
    // На телефоне наведения нет: первое касание показывает сходство, второе — открывает партию
    box.addEventListener('click', (e) => {
      const cell = e.target.closest('.mx-c');
      if (!cell) return;
      if (pinned === cell) {
        A.openParty(cell.dataset.b);
        pinned = null;
        return;
      }
      $$('.mx-c.is-pinned', box).forEach((c) => c.classList.remove('is-pinned'));
      pinned = cell;
      cell.classList.add('is-pinned');
      showCell(cell);
      tip.insertAdjacentHTML('beforeend', ' <span class="mx-tip__more">Нажмите ещё раз, чтобы открыть партию.</span>');
    });
    onVisible(box, () => A.replay(box));
  })();

  /* ==========================================================================
     8. Хронология
     ========================================================================== */
  (function timeline() {
    const tl = $('#tl');
    const tones = { gov: 'var(--gov)', opp: 'var(--opp)', neutral: 'var(--np)' };
    const toneName = { gov: 'власть', opp: 'оппозиция', neutral: 'общее событие' };
    tl.innerHTML = D.timeline
      .map(
        (t, i) => `
        <li class="tl__item reveal" style="--c:${tones[t.tone]};--d:${(i % 2) * 0.08}s">
          <span class="tl__node" aria-hidden="true"></span>
          <div class="tl__card glass">
            <div class="tl__year">${t.year}<span class="sr-only">, ${toneName[t.tone]}</span></div>
            <h3 class="tl__title">${t.title}</h3>
            <p class="tl__text">${t.text}</p>
            ${A.simple(t.plain, 'simple--block')}
          </div>
        </li>`
      )
      .join('');
    A.observeReveal(tl);

    const fill = $('#tlFill');
    const update = () => {
      const r = tl.getBoundingClientRect();
      if (!r.height) return; // вкладка скрыта
      const vh = window.innerHeight;
      const k = Math.max(0, Math.min(1, (vh * 0.7 - r.top) / r.height));
      fill.style.transform = `scaleY(${k})`;
    };
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    update();
  })();

  /* ==========================================================================
     9. Методология
     ========================================================================== */
  (function method() {
    const icons = {
      vector: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/></svg>',
      power: '<svg viewBox="0 0 24 24"><path d="M12 3v18M6 9l6-6 6 6M4 21h16"/></svg>',
      economy: '<svg viewBox="0 0 24 24"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>',
      identity: '<svg viewBox="0 0 24 24"><path d="M12 2l3 7 7 3-7 3-3 7-3-7-7-3 7-3z"/></svg>',
    };
    const grid = $('#methodGrid');
    grid.innerHTML = D.axes
      .map(
        (a, i) => `
      <article class="mcard glass reveal" style="--d:${i * 0.08}s">
        <span class="mcard__icon" aria-hidden="true">${icons[a.id]}</span>
        <h3>${a.name}</h3>
        <p>${a.about}</p>
        ${A.simple(a.plain, 'simple--block')}
        <div class="mcard__poles">
          <div class="mpole"><b><span>−10</span>${a.neg}</b>${a.negHint}${A.simple('Проще: ' + a.negPlain + '.')}</div>
          <div class="mpole"><b><span>+10</span>${a.pos}</b>${a.posHint}${A.simple('Проще: ' + a.posPlain + '.')}</div>
        </div>
      </article>`
      )
      .join('');
    A.observeReveal(grid);
  })();

  syncTables();
})();
