/* ═══════════════════════════════════════════════════════════
   MF FOODS — _preview.js（スクロール演出 / SEO非干渉）

   設計方針
   1. コンテンツを隠さない：.rv（非表示状態）は「このスクリプトが
      走った時点で画面外にある要素」にだけ付与する。JS無効・
      クローラ・画面内の要素は最初から完全に表示されたまま。
   2. transform と opacity しか触らない（CLSゼロ）。
   3. 外部ライブラリ不使用。IntersectionObserver + rAF のみ。
   4. スクロール毎フレームで getBoundingClientRect を呼ばない。
      位置は初回とリサイズ時にだけ計測してキャッシュする。
   5. prefers-reduced-motion: reduce のときは何もしない。
   ═══════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var reduce = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ───────────────────────────────────────────
     A. セクション進入時のフェード＋16px上スライド
     ─────────────────────────────────────────── */
  function initReveal() {
    if (reduce || !('IntersectionObserver' in window)) return;

    var selectors = [
      '.bridge-lead',
      '.section-heading',
      '.gallery-item',
      '.target-card',
      '.reason-card',
      '.reasons-footer',
      '.grid-item',
      '.items-note',
      '.section-cta',
      '.step',
      '.flow-footer',
      '.case-card',
      '.faq-category',
      '.faq-item',
      '.contact-email-wrap',
      '.contact-form-wrap',
      '.contact-hours',
      '#chef > div:nth-child(2) > *',
      '#chef > div:nth-child(3) > *',
      '#chef > div:nth-child(4) > *',
      '#company > div',
      'body > section:last-of-type > div:last-child > *',
      '.footer > *'
    ];

    var nodes = [];
    selectors.forEach(function (sel) {
      var found;
      try { found = document.querySelectorAll(sel); } catch (e) { return; }
      Array.prototype.forEach.call(found, function (el) {
        if (nodes.indexOf(el) === -1) nodes.push(el);
      });
    });

    var io = new IntersectionObserver(function (entries) {
      // 同一フレームで複数入ってきた要素は 70ms ずつずらす（stagger）
      var i = 0;
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        io.unobserve(el);
        var delay = Math.min(i, 4) * 70;
        i++;
        if (delay) el.style.transitionDelay = delay + 'ms';
        el.classList.add('rv-in');
      });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0 });

    // ここが肝：画面内（＋少し下）の要素には .rv を付けない＝チラつかない
    var vh = window.innerHeight || document.documentElement.clientHeight;
    nodes.forEach(function (el) {
      var top = el.getBoundingClientRect().top;
      if (top < vh * 1.05) return;     // すでに見えている（＋折り返し直下）→ 触らない
      el.classList.add('rv');
      io.observe(el);
    });
  }

  /* ───────────────────────────────────────────
     B. 画像のパララックス（transform: translate3d のみ）
        枠内で画像だけがゆっくり動く。CSS側で scale を掛けて
        余白を確保しているため、動かしても隙間が出ない。
     ─────────────────────────────────────────── */
  var px = [];

  function collectParallax() {
    if (reduce) return;
    var defs = [
      ['.fv-img', 40, 1.14],
      ['.gallery-item img', 16, 1.18],
      ['.factory-banner img', 32, 1.20],
      ['.case-img img', 14, 1.16],
      ['#chef > div:nth-child(1) img', 32, 1.14]
    ];
    defs.forEach(function (d) {
      Array.prototype.forEach.call(document.querySelectorAll(d[0]), function (el) {
        el.classList.add('px');
        px.push({ el: el, box: el.parentElement, range: d[1], scale: d[2], top: 0, h: 0, y: null });
      });
    });
  }

  function measure() {
    var sy = window.pageYOffset || document.documentElement.scrollTop;
    for (var i = 0; i < px.length; i++) {
      var r = px[i].box.getBoundingClientRect();
      px[i].top = r.top + sy;
      px[i].h = r.height;
    }
  }

  function paintParallax(sy, vh) {
    for (var i = 0; i < px.length; i++) {
      var p = px[i];
      var relTop = p.top - sy;
      if (relTop > vh || relTop + p.h < 0) continue;   // 画面外は計算しない
      var prog = (vh - relTop) / (vh + p.h);           // 0 → 1
      if (prog < 0) prog = 0; else if (prog > 1) prog = 1;
      var y = Math.round(((prog - 0.5) * 2 * p.range) * 100) / 100;
      if (y === p.y) continue;                          // 変化なしなら書かない
      p.y = y;
      p.el.style.transform = 'translate3d(0,' + y + 'px,0) scale(' + p.scale + ')';
    }
  }

  /* ───────────────────────────────────────────
     C. ヘッダー：スクロール進捗バー ＋ 下方向で隠す（スマホのみ）
        いずれも transform / CSS変数のみ。高さは一切変えない＝CLSなし
     ─────────────────────────────────────────── */
  var header = document.querySelector('.header');
  var lastY = 0;

  function paintHeader(sy) {
    var doc = document.documentElement;
    var max = (document.body.scrollHeight || doc.scrollHeight) - window.innerHeight;
    var sp = max > 0 ? sy / max : 0;
    if (sp < 0) sp = 0; else if (sp > 1) sp = 1;
    doc.style.setProperty('--sp', sp.toFixed(4));

    if (!header) return;
    if (sy > 40) header.classList.add('is-scrolled');
    else header.classList.remove('is-scrolled');

    if (window.innerWidth < 1000 && !reduce) {
      if (sy > 420 && sy > lastY + 6) header.classList.add('is-hidden');
      else if (sy < lastY - 6 || sy < 200) header.classList.remove('is-hidden');
    } else {
      header.classList.remove('is-hidden');
    }
    lastY = sy;
  }

  /* ───────────────────────────────────────────
     D. rAF で1本にまとめたスクロールループ
     ─────────────────────────────────────────── */
  var ticking = false;

  function onScroll() {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(function () {
      var sy = window.pageYOffset || document.documentElement.scrollTop;
      var vh = window.innerHeight || document.documentElement.clientHeight;
      paintHeader(sy);
      if (!reduce) paintParallax(sy, vh);
      ticking = false;
    });
  }

  var rt;
  function onResize() {
    clearTimeout(rt);
    rt = setTimeout(function () {
      measure();
      onScroll();
    }, 150);
  }

  /* ─────────────────────────────────────────── */
  initReveal();
  collectParallax();
  measure();
  onScroll();

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onResize, { passive: true });
  window.addEventListener('load', function () { measure(); onScroll(); });
})();
