/* ==========================================================================
   BelPolitCompass · Alpha 0.6 — 3D-пролёт над компасом при первом заходе
   Камера прилетает издалека над наклонённой плоскостью компаса, партии
   вырастают из неё столбиками (высота — по местам в парламенте), затем
   камера опускается в вид сверху, и сцена растворяется в сайте.
   Чистый CSS 3D + Web Animations, без библиотек.
   Показывается один раз (bpc-intro), только при полных анимациях, только
   на главной и только если не выключен в настройках. Пропуск — кнопкой,
   любой клавишей или нажатием. Досмотревший до конца находит «Вянок».
   ========================================================================== */
(function () {
  'use strict';

  const A = window.BPCApp;
  const B = window.BPCBoot;
  const D = window.BPC;
  if (!A || !B || !D) return;

  const root = document.documentElement;
  const KEY = 'bpc-intro';
  const DURATION = 5600;
  const full = () => root.getAttribute('data-motion') === 'full';

  let el = null;
  let anims = [];
  let opener = null;

  // Позиция на плоскости: вектор → x, власть → y (вверх — «Вертикаль»)
  const pct = (v) => 8 + ((v + 10) / 20) * 84;

  function build() {
    const node = document.createElement('div');
    node.className = 'intro is-3d';
    node.setAttribute('role', 'dialog');
    node.setAttribute('aria-modal', 'true');
    node.setAttribute('aria-label', 'Вступление: пролёт над политическим компасом Беларуси');
    const pins = D.parties
      .map((p, i) => {
        const h = p.seats ? 34 + Math.sqrt(p.seats) * 16 : 22;
        return `<span class="intro__pin${p.status === 'active' ? ' is-active' : ''}" style="--c:var(--p-${p.id});--h:${h.toFixed(0)}px;--i:${i};left:${pct(p.pos.vector)}%;top:${100 - pct(p.pos.power)}%">
          <i class="intro__base"></i><i class="intro__stem"><b>${p.abbr}</b></i></span>`;
      })
      .join('');
    node.innerHTML = `
      <div class="intro__stage" aria-hidden="true">
        <div class="intro__world">
          <div class="intro__plane">
            <span class="intro__q intro__q--tl"></span><span class="intro__q intro__q--tr"></span>
            <span class="intro__q intro__q--bl"></span><span class="intro__q intro__q--br"></span>
            <span class="intro__axis intro__axis--h"></span><span class="intro__axis intro__axis--v"></span>
            <span class="intro__word intro__word--t">Вертикаль</span>
            <span class="intro__word intro__word--b">Горизонталь</span>
            <span class="intro__word intro__word--l">Восток</span>
            <span class="intro__word intro__word--r">Запад</span>
            ${pins}
          </div>
        </div>
      </div>
      <div class="intro__title">
        <span class="intro__kicker">BelPolitCompass · ${D.version}</span>
        <p class="intro__name">Политический компас Беларуси</p>
        <span class="intro__sub">14 партий · 4 оси · 110 мест в парламенте</span>
      </div>
      <button class="btn btn--ghost btn--sm intro__skip" type="button">Пропустить <span aria-hidden="true">→</span></button>`;
    return node;
  }

  function shouldAutoplay() {
    const prefs = B.parse(A.storage(B.KEY));
    if (!prefs.intro || !full()) return false;
    if (A.storage(KEY)) return false;
    if (root.getAttribute('data-tab') !== 'home') return false; // прямые ссылки на вкладки не перекрываем
    if (window.matchMedia && window.matchMedia('print').matches) return false;
    return true;
  }

  function play(force) {
    if (el) return;
    if (!full()) {
      if (force && window.BPCTabs) window.BPCTabs.announce('3D-пролёт показывается только при полных анимациях — включите их в настройках.');
      return;
    }
    if (!force && !shouldAutoplay()) return;
    opener = document.activeElement;
    el = build();
    document.body.appendChild(el);
    root.classList.add('has-intro');

    const world = el.querySelector('.intro__world');
    const title = el.querySelector('.intro__title');
    const skip = el.querySelector('.intro__skip');
    skip.focus({ preventScroll: true });

    // «Камера»: плоскость наклонена и повёрнута, затем выпрямляется
    anims.push(
      world.animate(
        [
          { transform: 'translateZ(-1100px) translateY(18%) rotateX(74deg) rotateZ(-58deg)', offset: 0 },
          { transform: 'translateZ(-380px) translateY(8%) rotateX(64deg) rotateZ(-24deg)', offset: 0.45 },
          { transform: 'translateZ(-140px) translateY(2%) rotateX(38deg) rotateZ(6deg)', offset: 0.75 },
          { transform: 'translateZ(0) translateY(0) rotateX(0deg) rotateZ(0deg)', offset: 1 },
        ],
        { duration: DURATION, easing: 'cubic-bezier(0.45, 0, 0.2, 1)', fill: 'forwards' }
      )
    );
    anims.push(
      title.animate(
        [
          { opacity: 0, transform: 'translateY(16px)', offset: 0 },
          { opacity: 0, transform: 'translateY(16px)', offset: 0.3 },
          { opacity: 1, transform: 'none', offset: 0.45 },
          { opacity: 1, transform: 'none', offset: 0.82 },
          { opacity: 0, transform: 'translateY(-10px)', offset: 1 },
        ],
        { duration: DURATION, easing: 'ease-out', fill: 'forwards' }
      )
    );
    anims[0].onfinish = () => finish(true);

    el.addEventListener('click', () => finish(false));
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        e.preventDefault(); // фокус остаётся на «Пропустить»
        return;
      }
      e.preventDefault();
      finish(false);
    });
  }

  function finish(completed) {
    if (!el || el.classList.contains('is-out')) return;
    A.storage(KEY, 'done');
    anims.forEach((a) => a.pause());
    const node = el;
    node.classList.add('is-out');
    const done = () => {
      node.remove();
      anims = [];
      el = null;
      root.classList.remove('has-intro');
      if (opener && opener.focus && opener !== document.body) opener.focus({ preventScroll: true });
      document.dispatchEvent(new CustomEvent('bpc:intro-end', { detail: { completed } }));
    };
    if (full()) setTimeout(done, 450);
    else done();
  }

  window.BPCIntro = {
    play,
    skip: () => finish(false),
    get running() {
      return !!el;
    },
  };

  play(false);
})();
