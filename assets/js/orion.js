/* ==========================================================================
   ORION — orion.js
   Everything the site does: the preloader, page-to-page curtain, navigation,
   scroll reveals, 3D card tilt, parallax, the rotating gallery cylinder,
   counters, lightbox, filters and forms.

   Animation runs on Anime.js v4 (global `anime`). Continuous pointer-following
   (cursor, parallax) is hand-rolled easing in a single rAF loop, because that
   is the right tool for per-frame tracking; every discrete transition —
   anything with a start and an end — is Anime.js.
   ========================================================================== */
(function (win, doc) {
  "use strict";

  /* ------------------------------------------------------------------
     0. Guards + shared helpers
     ------------------------------------------------------------------ */
  var html = doc.documentElement;
  var anime = win.anime;

  /* Without the library the page must still be usable: drop the reveal
     classes that hide content and pull the curtain off. */
  if (!anime || !anime.animate) {
    html.classList.remove("js");
    var deadCurtain = doc.querySelector(".curtain");
    if (deadCurtain) deadCurtain.parentNode.removeChild(deadCurtain);
    return;
  }

  var animate = anime.animate;
  var createTimeline = anime.createTimeline;
  var stagger = anime.stagger;
  var utils = anime.utils;

  var EASE = "cubicBezier(.16,1,.3,1)";       /* expo-out: the house curve */
  var EASE_SOFT = "cubicBezier(.33,1,.68,1)";
  var EASE_INOUT = "cubicBezier(.65,0,.35,1)";

  var REDUCED = win.matchMedia && win.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var COARSE = win.matchMedia && win.matchMedia("(hover: none), (pointer: coarse)").matches;

  function $(sel, ctx) { return (ctx || doc).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || doc).querySelectorAll(sel)); }
  function on(el, ev, fn, opt) { if (el) el.addEventListener(ev, fn, opt); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  function store(key, value) {
    try {
      if (value === undefined) return win.sessionStorage.getItem(key);
      win.sessionStorage.setItem(key, value);
    } catch (e) { /* file:// or privacy mode — fall through to defaults */ }
    return null;
  }

  /* ------------------------------------------------------------------
     1. Text splitting — chars for short marks, author-marked lines for
     headlines (see the .line > span pattern in the HTML).
     ------------------------------------------------------------------ */
  function splitChars(el) {
    if (!el || el.dataset.split === "done") return $$(".char", el);
    var text = el.textContent;
    var frag = doc.createDocumentFragment();

    for (var i = 0; i < text.length; i++) {
      var ch = text.charAt(i);
      var span = doc.createElement("span");
      span.className = "char";
      if (ch === " ") {
        span.innerHTML = "&nbsp;";
        span.classList.add("char--space");
      } else {
        span.textContent = ch;
      }
      frag.appendChild(span);
    }

    el.textContent = "";
    el.appendChild(frag);
    el.dataset.split = "done";
    return $$(".char", el);
  }

  /* ------------------------------------------------------------------
     2. Reveal on scroll
     Each element declares how it arrives via data-reveal. One observer
     drives them all; each fires once.
     ------------------------------------------------------------------ */
  function revealTargets(el) {
    var mode = el.dataset.reveal || "up";
    if (mode === "lines") return $$(".line > span", el);
    if (mode === "chars") return splitChars(el);
    if (mode === "stagger") return Array.prototype.slice.call(el.children);
    return [el];
  }

  function playReveal(el) {
    var mode = el.dataset.reveal || "up";
    var targets = revealTargets(el);
    var delay = parseInt(el.dataset.revealDelay || "0", 10);
    var step = parseInt(el.dataset.revealStagger || "", 10);

    el.classList.add("is-revealed");
    if (!targets.length) return;

    if (REDUCED) {
      utils.set(targets, { opacity: 1, translateY: 0, translateZ: 0, rotateX: 0, scale: 1 });
      return;
    }

    var base = { duration: 1000, ease: EASE, opacity: [0, 1] };

    if (mode === "lines") {
      animate(targets, {
        translateY: ["115%", "0%"],
        opacity: [0, 1],
        duration: 1150,
        delay: stagger(isNaN(step) ? 90 : step, { start: delay }),
        ease: EASE
      });
      return;
    }

    if (mode === "chars") {
      animate(targets, {
        translateY: ["0.55em", "0em"],
        rotateX: [-72, 0],
        opacity: [0, 1],
        duration: 950,
        delay: stagger(isNaN(step) ? 34 : step, { start: delay }),
        ease: EASE
      });
      return;
    }

    if (mode === "z") {
      animate(targets, {
        translateZ: [-360, 0],
        translateY: [46, 0],
        rotateX: [13, 0],
        opacity: [0, 1],
        duration: 1400,
        delay: delay,
        ease: EASE
      });
      return;
    }

    if (mode === "stagger") {
      animate(targets, {
        translateY: [42, 0],
        opacity: [0, 1],
        duration: base.duration,
        delay: stagger(isNaN(step) ? 105 : step, { start: delay }),
        ease: EASE
      });
      return;
    }

    if (mode === "fade") {
      animate(targets, { opacity: [0, 1], duration: 1100, delay: delay, ease: "linear" });
      return;
    }

    if (mode === "left")  { animate(targets, { translateX: [-52, 0], opacity: [0, 1], duration: 1150, delay: delay, ease: EASE }); return; }
    if (mode === "right") { animate(targets, { translateX: [52, 0],  opacity: [0, 1], duration: 1150, delay: delay, ease: EASE }); return; }
    if (mode === "scale") { animate(targets, { scale: [0.9, 1], opacity: [0, 1], duration: 1300, delay: delay, ease: EASE }); return; }

    animate(targets, {
      translateY: [40, 0],
      opacity: [0, 1],
      duration: base.duration,
      delay: delay,
      ease: EASE
    });
  }

  function initReveals() {
    var items = $$("[data-reveal]");
    if (!items.length) return;

    if (!("IntersectionObserver" in win)) {
      items.forEach(playReveal);
      return;
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        io.unobserve(entry.target);
        playReveal(entry.target);
      });
    }, { rootMargin: "0px 0px -12% 0px", threshold: 0.08 });

    items.forEach(function (el) {
      /* Anything already on screen at load waits for the intro instead. */
      io.observe(el);
    });
  }

  /* ------------------------------------------------------------------
     3. Curtain + preloader + page transitions
     ------------------------------------------------------------------ */
  var Curtain = (function () {
    var el = $(".curtain");
    if (!el) return { intro: function (cb) { if (cb) cb(); }, leave: function (cb) { if (cb) cb(); } };

    var panels = $$(".curtain__panel", el);
    var loader = $(".loader", el);
    var mark = $(".loader__mark", el);
    var fill = $(".loader__fill", el);
    var count = $(".loader__count", el);
    var sub = $(".loader__sub", el);

    function setOrigin(value) {
      panels.forEach(function (p) { p.style.transformOrigin = value; });
    }

    /* The curtain paints its own opaque background so nothing flashes before
       the panels exist; it hands the job to the panels on the way out, at
       which point they still cover the viewport completely. */
    function handOffToPanels() {
      el.style.backgroundColor = "transparent";
      setOrigin("50% 0%");
    }

    function finish(done) {
      el.classList.add("is-idle");
      if (loader) loader.style.display = "none";
      if (done) done();
    }

    function intro(done) {
      var firstVisit = store("orion.visited") !== "1";
      store("orion.visited", "1");

      if (REDUCED || !firstVisit) {
        if (loader) loader.style.display = "none";
        handOffToPanels();
        animate(panels, {
          scaleY: [1, 0],
          duration: REDUCED ? 10 : 720,
          delay: REDUCED ? 0 : stagger(48, { from: "last" }),
          ease: EASE,
          onComplete: function () { finish(done); }
        });
        return;
      }

      var chars = mark ? splitChars(mark) : [];
      var counter = { v: 0 };
      var tl = createTimeline({ defaults: { ease: EASE } });

      utils.set(chars, { opacity: 0 });
      if (sub) utils.set(sub, { opacity: 0 });

      tl.add(chars, {
        opacity: [0, 1],
        translateY: ["0.7em", "0em"],
        rotateX: [-88, 0],
        duration: 1000,
        delay: stagger(70)
      }, 120);

      if (sub) tl.add(sub, { opacity: [0, 1], translateY: [14, 0], duration: 700 }, 560);
      if (fill) tl.add(fill, { scaleX: [0, 1], duration: 1300, ease: EASE_SOFT }, 320);

      tl.add(counter, {
        v: 100,
        duration: 1300,
        ease: EASE_SOFT,
        onUpdate: function () {
          if (count) count.textContent = String(Math.round(counter.v)).padStart(3, "0");
        }
      }, 320);

      if (loader) tl.add(loader, { opacity: [1, 0], translateY: [0, -26], duration: 560 }, 1760);

      tl.add(panels, {
        scaleY: [1, 0],
        duration: 1100,
        delay: stagger(70, { from: "last" }),
        ease: EASE,
        onBegin: handOffToPanels,
        onComplete: function () { finish(done); }
      }, 1980);
    }

    function leave(done) {
      if (REDUCED) { if (done) done(); return; }
      el.classList.remove("is-idle");
      el.style.backgroundColor = "transparent";
      if (loader) loader.style.display = "none";
      setOrigin("50% 100%");
      utils.set(panels, { scaleY: 0 });

      animate(panels, {
        scaleY: [0, 1],
        duration: 760,
        delay: stagger(58),
        ease: EASE_INOUT,
        onComplete: function () { if (done) done(); }
      });
    }

    return { intro: intro, leave: leave, el: el };
  })();

  function initPageTransitions() {
    function isInternal(a) {
      if (!a || !a.getAttribute) return false;
      var href = a.getAttribute("href");
      if (!href) return false;
      if (a.hasAttribute("download") || a.target === "_blank") return false;
      if (href.charAt(0) === "#") return false;
      if (/^(mailto:|tel:|javascript:)/i.test(href)) return false;
      /* file:// gives an empty host on both sides, http(s) gives a real one. */
      return a.protocol === win.location.protocol && a.host === win.location.host;
    }

    on(doc, "click", function (e) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      var a = e.target.closest ? e.target.closest("a") : null;
      if (!a || !isInternal(a)) return;

      /* Same document + hash: scroll instead of navigate. */
      if (a.hash && a.pathname === win.location.pathname) {
        var target = doc.getElementById(a.hash.slice(1));
        if (target) {
          e.preventDefault();
          closeMenu();
          win.scrollTo({ top: target.getBoundingClientRect().top + win.pageYOffset - 90, behavior: REDUCED ? "auto" : "smooth" });
        }
        return;
      }

      if (a.pathname === win.location.pathname && !a.hash) { e.preventDefault(); closeMenu(); return; }

      e.preventDefault();
      var url = a.href;
      var gone = false;
      function go() { if (gone) return; gone = true; win.location.href = url; }
      /* Never let a stalled animation trap the visitor. */
      win.setTimeout(go, 1100);
      Curtain.leave(go);
    });

    /* Coming back through history must not leave the curtain down. */
    on(win, "pageshow", function (e) {
      if (!e.persisted) return;
      if (Curtain.el) {
        Curtain.el.classList.add("is-idle");
        utils.set($$(".curtain__panel"), { scaleY: 0 });
      }
      doc.body.classList.remove("is-locked", "menu-open");
    });
  }

  /* ------------------------------------------------------------------
     4. Navigation + fullscreen menu
     ------------------------------------------------------------------ */
  var menuEl = $("[data-menu]");
  var menuOpen = false;
  var menuBusy = false;

  function markCurrentLinks() {
    var here = win.location.pathname.split("/").pop() || "index.html";
    if (here === "") here = "index.html";
    $$("a[href]").forEach(function (a) {
      var target = a.getAttribute("href");
      if (!target || target.charAt(0) === "#" || /^(https?:|mailto:|tel:)/i.test(target)) return;
      var file = target.split("/").pop().split("#")[0] || "index.html";
      if (file === here) {
        if (a.classList.contains("nav__link")) a.classList.add("is-current");
        if (a.classList.contains("menu__anchor")) a.classList.add("is-current");
      }
    });
  }

  function initNav() {
    var nav = $(".nav");
    if (!nav) return;
    var last = win.pageYOffset || 0;
    var ticking = false;

    function update() {
      var y = win.pageYOffset || doc.documentElement.scrollTop || 0;
      nav.classList.toggle("is-stuck", y > 24);

      if (!menuOpen) {
        var goingDown = y > last && y > 420;
        nav.classList.toggle("is-hidden", goingDown);
      }
      last = y;
      ticking = false;
    }

    on(win, "scroll", function () {
      if (ticking) return;
      ticking = true;
      win.requestAnimationFrame(update);
    }, { passive: true });

    update();
  }

  function openMenu() {
    if (!menuEl || menuOpen || menuBusy) return;
    menuOpen = true;
    menuBusy = true;
    doc.body.classList.add("menu-open", "is-locked");
    menuEl.classList.add("is-open");
    menuEl.setAttribute("aria-hidden", "false");
    var trigger = $("[data-menu-toggle]");
    if (trigger) trigger.setAttribute("aria-expanded", "true");

    var veil = $(".menu__veil", menuEl);
    var anchors = $$(".menu__anchor", menuEl);
    var aside = $$(".menu__aside > *", menuEl);
    var foot = $(".menu__foot", menuEl);

    var tl = createTimeline({ defaults: { ease: EASE } });
    tl.add(veil, { opacity: [0, 1], duration: 520, ease: "linear" }, 0);
    tl.add(anchors, {
      translateY: ["105%", "0%"],
      rotateX: [-62, 0],
      opacity: [0, 1],
      duration: 1000,
      delay: stagger(72, { start: 90 })
    }, 0);
    if (aside.length) {
      tl.add(aside, { translateY: [30, 0], opacity: [0, 1], duration: 900, delay: stagger(110, { start: 320 }) }, 0);
    }
    if (foot) {
      tl.add(foot, { opacity: [0, 1], duration: 700 }, 520);
    }
    win.setTimeout(function () { menuBusy = false; }, 1400);
  }

  function closeMenu() {
    if (!menuEl || !menuOpen) return;
    menuOpen = false;
    doc.body.classList.remove("menu-open", "is-locked");
    var trigger = $("[data-menu-toggle]");
    if (trigger) trigger.setAttribute("aria-expanded", "false");

    var anchors = $$(".menu__anchor", menuEl);
    var rest = $$(".menu__aside > *, .menu__foot", menuEl);

    animate(anchors.concat(rest), {
      opacity: [1, 0],
      translateY: [0, -22],
      duration: REDUCED ? 10 : 420,
      delay: REDUCED ? 0 : stagger(24),
      ease: EASE_INOUT
    });

    animate($(".menu__veil", menuEl), {
      opacity: [1, 0],
      duration: REDUCED ? 10 : 480,
      ease: "linear",
      onComplete: function () {
        menuEl.classList.remove("is-open");
        menuEl.setAttribute("aria-hidden", "true");
      }
    });
  }

  function initMenu() {
    if (!menuEl) return;
    menuEl.setAttribute("aria-hidden", "true");
    on($("[data-menu-toggle]"), "click", function () { menuOpen ? closeMenu() : openMenu(); });
    on($("[data-menu-close]"), "click", closeMenu);
    on(doc, "keydown", function (e) { if (e.key === "Escape" && menuOpen) closeMenu(); });
  }

  /* ------------------------------------------------------------------
     5. Cursor — one rAF loop, two trailing elements
     ------------------------------------------------------------------ */
  function initCursor() {
    if (COARSE || REDUCED) return;
    var ring = $(".cursor");
    var dot = $(".cursor-dot");
    if (!ring || !dot) return;

    var mx = win.innerWidth / 2, my = win.innerHeight / 2;
    var rx = mx, ry = my, dx = mx, dy = my;
    var ready = false;

    /* The ring is a fixed 34px box; hover and drag sizes are multiples of it,
       eased here rather than by transitioning width/height/margin. */
    var RING = 34;
    var SCALE_HOVER = 78 / RING;
    var SCALE_DRAG = 96 / RING;
    var scale = 1;

    on(win, "pointermove", function (e) {
      mx = e.clientX; my = e.clientY;
      if (!ready) {
        ready = true;
        rx = dx = mx; ry = dy = my;
        doc.body.classList.add("cursor-ready");
      }
    }, { passive: true });

    on(doc, "pointerleave", function () { doc.body.classList.remove("cursor-ready"); });
    on(doc, "pointerenter", function () { if (ready) doc.body.classList.add("cursor-ready"); });

    var HOVER = "a, button, .tilt, [data-cursor='hover'], input, select, textarea, .mgrid__item";
    on(doc, "pointerover", function (e) {
      if (!e.target.closest) return;
      var hit = e.target.closest(HOVER);
      doc.body.classList.toggle("cursor-hover", !!hit);
    }, { passive: true });

    (function loop() {
      rx += (mx - rx) * 0.16;
      ry += (my - ry) * 0.16;
      dx += (mx - dx) * 0.42;
      dy += (my - dy) * 0.42;

      var list = doc.body.classList;
      var target = list.contains("cursor-drag") ? SCALE_DRAG
                 : list.contains("cursor-hover") ? SCALE_HOVER : 1;
      scale += (target - scale) * 0.14;

      ring.style.transform =
        "translate3d(" + rx.toFixed(2) + "px," + ry.toFixed(2) + "px,0) scale(" + scale.toFixed(4) + ")";
      dot.style.transform = "translate3d(" + dx.toFixed(2) + "px," + dy.toFixed(2) + "px,0)";
      win.requestAnimationFrame(loop);
    })();
  }

  /* ------------------------------------------------------------------
     6. 3D tilt cards
     Anime's createAnimatable gives each axis its own eased channel, so the
     card settles instead of snapping. Falls back to direct writes.
     ------------------------------------------------------------------ */
  function initTilt() {
    var nodes = $$("[data-tilt]");
    if (!nodes.length || COARSE || REDUCED) return;

    nodes.forEach(function (host) {
      var inner = $("[data-tilt-inner]", host) || host.firstElementChild;
      if (!inner) return;

      var max = parseFloat(host.dataset.tilt) || 9;
      var lift = parseFloat(host.dataset.tiltLift || "34");
      var sheen = $(".card__sheen", host) || $("[data-sheen]", host);
      var ctrl = null;

      if (typeof anime.createAnimatable === "function") {
        ctrl = anime.createAnimatable(inner, {
          rotateX: 620,
          rotateY: 620,
          translateZ: 620,
          ease: "out(3)"
        });
      }

      function apply(rx, ry, tz) {
        if (ctrl) {
          ctrl.rotateX(rx);
          ctrl.rotateY(ry);
          ctrl.translateZ(tz);
        } else {
          inner.style.transform =
            "translateZ(" + tz + "px) rotateX(" + rx + "deg) rotateY(" + ry + "deg)";
        }
      }

      on(host, "pointermove", function (e) {
        var r = host.getBoundingClientRect();
        var px = (e.clientX - r.left) / r.width;
        var py = (e.clientY - r.top) / r.height;
        apply(
          +((0.5 - py) * max * 2).toFixed(3),
          +((px - 0.5) * max * 2).toFixed(3),
          lift
        );
        if (sheen) {
          sheen.style.setProperty("--mx", (px * 100).toFixed(2) + "%");
          sheen.style.setProperty("--my", (py * 100).toFixed(2) + "%");
        }
      }, { passive: true });

      on(host, "pointerleave", function () { apply(0, 0, 0); });
    });
  }

  /* ------------------------------------------------------------------
     7. Parallax — data-parallax holds the travel in px across one screen
     ------------------------------------------------------------------ */
  function initParallax() {
    var nodes = $$("[data-parallax]");
    if (!nodes.length || REDUCED) return;

    var items = nodes.map(function (el) {
      return {
        el: el,
        amount: parseFloat(el.dataset.parallax) || 60,
        scale: parseFloat(el.dataset.parallaxScale || "0"),
        current: 0,
        target: 0
      };
    });

    var vh = win.innerHeight || 1;
    var ticking = false;

    function measure() {
      vh = win.innerHeight || 1;
      var scrollY = win.pageYOffset || 0;
      items.forEach(function (it) {
        var r = it.el.getBoundingClientRect();
        var mid = r.top + scrollY + r.height / 2;
        /* -1 well above the viewport centre, +1 well below it. */
        var progress = clamp(((scrollY + vh / 2) - mid) / (vh + r.height) * 2, -1, 1);
        it.target = progress * it.amount;
      });
      ticking = false;
    }

    on(win, "scroll", function () {
      if (ticking) return;
      ticking = true;
      win.requestAnimationFrame(measure);
    }, { passive: true });
    on(win, "resize", measure, { passive: true });

    (function loop() {
      for (var i = 0; i < items.length; i++) {
        var it = items[i];
        it.current += (it.target - it.current) * 0.09;
        var t = "translate3d(0," + it.current.toFixed(2) + "px,0)";
        if (it.scale) t += " scale(" + (1 + Math.abs(it.current / it.amount) * it.scale).toFixed(4) + ")";
        it.el.style.transform = t;
      }
      win.requestAnimationFrame(loop);
    })();

    measure();
  }

  /* ------------------------------------------------------------------
     8. Marquee — cloned until it can loop seamlessly
     ------------------------------------------------------------------ */
  function initMarquee() {
    $$("[data-marquee]").forEach(function (root) {
      var track = $(".marquee__track", root);
      var group = $(".marquee__group", track);
      if (!track || !group) return;

      var width = group.getBoundingClientRect().width;
      if (!width) return;

      var needed = Math.ceil(((win.innerWidth || 1280) * 2) / width) + 1;
      for (var i = 1; i < needed; i++) {
        var clone = group.cloneNode(true);
        clone.setAttribute("aria-hidden", "true");
        track.appendChild(clone);
      }

      if (REDUCED) return;

      var speed = parseFloat(root.dataset.marqueeSpeed || "70"); /* px per second */
      var reverse = root.dataset.marqueeReverse === "true";

      animate(track, {
        translateX: reverse ? [-width, 0] : [0, -width],
        duration: (width / speed) * 1000,
        ease: "linear",
        loop: true
      });
    });
  }

  /* ------------------------------------------------------------------
     9. Counters
     ------------------------------------------------------------------ */
  function initCounters() {
    var nodes = $$("[data-count]");
    if (!nodes.length) return;

    function run(el) {
      var to = parseFloat(el.dataset.count) || 0;
      var decimals = parseInt(el.dataset.countDecimals || "0", 10);
      var prefix = el.dataset.countPrefix || "";
      var suffix = el.dataset.countSuffix || "";
      /* Group thousands unless the number is a year or the author opts out. */
      var group = el.dataset.countGroup !== "false" && to >= 1000;

      function format(n) {
        var fixed = n.toFixed(decimals);
        if (group) {
          var parts = fixed.split(".");
          parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
          fixed = parts.join(".");
        }
        return prefix + fixed + suffix;
      }

      if (REDUCED) {
        el.textContent = format(to);
        return;
      }

      var obj = { v: 0 };
      animate(obj, {
        v: to,
        duration: 2000,
        ease: EASE_SOFT,
        onUpdate: function () { el.textContent = format(obj.v); },
        onComplete: function () { el.textContent = format(to); }
      });
    }

    if (!("IntersectionObserver" in win)) { nodes.forEach(run); return; }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        io.unobserve(entry.target);
        run(entry.target);
      });
    }, { threshold: 0.4 });

    nodes.forEach(function (el) { el.textContent = "0"; io.observe(el); });
  }

  /* ------------------------------------------------------------------
     10. Testimonial rotator
     ------------------------------------------------------------------ */
  function initQuotes() {
    var root = $("[data-quotes]");
    if (!root) return;
    var slides = $$(".quote", root);
    var dots = $$(".quotes__dot", root);
    if (slides.length < 2) return;

    var index = 0;
    var timer = null;

    slides.forEach(function (s, i) {
      s.hidden = i !== 0;
      if (i === 0) utils.set(s, { opacity: 1, translateZ: 0, rotateY: 0 });
    });

    function show(next) {
      if (next === index) return;
      var from = slides[index];
      var to = slides[next];
      var forward = next > index || (index === slides.length - 1 && next === 0);
      index = next;

      dots.forEach(function (d, i) { d.classList.toggle("is-active", i === index); });

      if (REDUCED) {
        from.hidden = true;
        to.hidden = false;
        utils.set(to, { opacity: 1 });
        return;
      }

      animate(from, {
        opacity: [1, 0],
        translateZ: [0, -260],
        rotateY: [0, forward ? -22 : 22],
        duration: 620,
        ease: EASE_INOUT,
        onComplete: function () { from.hidden = true; }
      });

      to.hidden = false;
      utils.set(to, { opacity: 0, translateZ: -260, rotateY: forward ? 24 : -24 });
      animate(to, {
        opacity: [0, 1],
        translateZ: [-260, 0],
        rotateY: [forward ? 24 : -24, 0],
        duration: 950,
        delay: 190,
        ease: EASE
      });
    }

    function next() { show((index + 1) % slides.length); }

    function restart() {
      win.clearInterval(timer);
      if (!REDUCED) timer = win.setInterval(next, 7000);
    }

    dots.forEach(function (d, i) {
      on(d, "click", function () { show(i); restart(); });
    });

    dots.forEach(function (d, i) { d.classList.toggle("is-active", i === 0); });
    restart();
  }

  /* ------------------------------------------------------------------
     11. The 3D carousel — plates arranged on a cylinder
     Cell i sits at rotateY(i * theta) translateZ(R); the ring counter-rotates
     to bring a cell to the front, and is pushed back by R so the front plate
     lands near the camera plane instead of looming.
     ------------------------------------------------------------------ */
  function initCarousel() {
    var root = $("[data-carousel]");
    if (!root) return;

    var stage = $("[data-carousel-stage]", root);
    var ring = $("[data-carousel-ring]", root);
    var cells = $$(".carousel__cell", ring);
    var readout = $("[data-carousel-readout]", root);
    var total = cells.length;
    if (!stage || !ring || total < 3) return;

    var theta = 360 / total;
    var radius = 0;
    var index = 0;
    var rotation = 0;
    var current = null;

    function layout() {
      var w = ring.getBoundingClientRect().width || 300;
      /* Cylinder radius for edge-to-edge plates, then opened up for air. */
      radius = Math.round((w / 2) / Math.tan(Math.PI / total) * 1.18);
      cells.forEach(function (cell, i) {
        cell.style.transform = "rotateY(" + (i * theta) + "deg) translateZ(" + radius + "px)";
      });
      utils.set(ring, { translateZ: -radius });
      applyRotation(rotation);
    }

    function applyRotation(deg) {
      rotation = deg;
      utils.set(ring, { rotateY: deg });
      var front = ((Math.round(-deg / theta) % total) + total) % total;
      cells.forEach(function (c, i) { c.classList.toggle("is-front", i === front); });
      if (readout) {
        readout.innerHTML = "<b>" + String(front + 1).padStart(2, "0") + "</b> / " + String(total).padStart(2, "0");
      }
    }

    function goTo(i, instant) {
      index = i;
      var target = -index * theta;
      /* Light the destination plate straight away so the focus travels with
         the motion rather than snapping at the end. */
      var front = ((index % total) + total) % total;
      cells.forEach(function (c, k) { c.classList.toggle("is-front", k === front); });
      if (readout) {
        readout.innerHTML = "<b>" + String(front + 1).padStart(2, "0") + "</b> / " + String(total).padStart(2, "0");
      }

      if (instant || REDUCED) { applyRotation(target); return; }
      if (current && typeof current.pause === "function") current.pause();
      current = animate(ring, {
        rotateY: target,
        duration: 1150,
        ease: EASE,
        onComplete: function () { rotation = target; }
      });
    }

    on($("[data-carousel-prev]", root), "click", function () { goTo(index - 1); });
    on($("[data-carousel-next]", root), "click", function () { goTo(index + 1); });

    on(stage, "keydown", function (e) {
      if (e.key === "ArrowLeft") { e.preventDefault(); goTo(index - 1); }
      if (e.key === "ArrowRight") { e.preventDefault(); goTo(index + 1); }
    });

    /* --- drag ------------------------------------------------------- */
    var dragging = false;
    var startX = 0;
    var startRot = 0;
    var moved = 0;

    on(stage, "pointerdown", function (e) {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      dragging = true;
      moved = 0;
      startX = e.clientX;
      startRot = rotation;
      if (current) current.pause();
      stage.classList.add("is-dragging");
      doc.body.classList.add("cursor-drag");
      if (stage.setPointerCapture) { try { stage.setPointerCapture(e.pointerId); } catch (err) {} }
    });

    on(stage, "pointermove", function (e) {
      if (!dragging) return;
      var dx = e.clientX - startX;
      moved = Math.abs(dx);
      applyRotation(startRot + dx * 0.24);
    });

    function endDrag() {
      if (!dragging) return;
      dragging = false;
      stage.classList.remove("is-dragging");
      doc.body.classList.remove("cursor-drag");
      goTo(Math.round(-rotation / theta));
    }

    on(stage, "pointerup", endDrag);
    on(stage, "pointercancel", endDrag);
    on(stage, "pointerleave", endDrag);

    /* A drag should not fire the plate's link. */
    cells.forEach(function (cell) {
      on(cell, "click", function (e) { if (moved > 8) e.preventDefault(); });
    });

    on(win, "resize", function () { layout(); });
    layout();
    applyRotation(0);
  }

  /* ------------------------------------------------------------------
     12. Lightbox
     ------------------------------------------------------------------ */
  function initLightbox() {
    var box = $("[data-lightbox]");
    if (!box) return;

    var items = $$("[data-lb-src]");
    if (!items.length) { box.parentNode.removeChild(box); return; }

    var figure = $(".lightbox__figure", box);
    var img = $("img", figure);
    var cap = $(".lightbox__cap", box);
    var index = 0;

    function render(i) {
      index = ((i % items.length) + items.length) % items.length;
      var el = items[index];
      img.src = el.dataset.lbSrc;
      img.alt = el.dataset.lbCap || "";
      if (cap) cap.textContent = (el.dataset.lbCap || "") + "  ·  " + String(index + 1).padStart(2, "0") + " / " + String(items.length).padStart(2, "0");
    }

    function open(i) {
      render(i);
      box.classList.add("is-open");
      doc.body.classList.add("is-locked");
      animate(box, { opacity: [0, 1], duration: REDUCED ? 10 : 380, ease: "linear" });
      animate(figure, {
        opacity: [0, 1],
        scale: [0.92, 1],
        translateY: [26, 0],
        duration: REDUCED ? 10 : 780,
        ease: EASE
      });
    }

    function close() {
      doc.body.classList.remove("is-locked");
      animate(box, {
        opacity: [1, 0],
        duration: REDUCED ? 10 : 320,
        ease: "linear",
        onComplete: function () { box.classList.remove("is-open"); }
      });
    }

    function step(dir) {
      render(index + dir);
      if (REDUCED) return;
      animate(figure, {
        opacity: [0, 1],
        translateX: [dir * 46, 0],
        duration: 620,
        ease: EASE
      });
    }

    items.forEach(function (el, i) {
      on(el, "click", function (e) { e.preventDefault(); open(i); });
    });

    on($(".lightbox__close", box), "click", close);
    on($(".lightbox__nav--prev", box), "click", function () { step(-1); });
    on($(".lightbox__nav--next", box), "click", function () { step(1); });
    on(box, "click", function (e) { if (e.target === box) close(); });
    on(doc, "keydown", function (e) {
      if (!box.classList.contains("is-open")) return;
      if (e.key === "Escape") close();
      if (e.key === "ArrowLeft") step(-1);
      if (e.key === "ArrowRight") step(1);
    });
  }

  /* ------------------------------------------------------------------
     13. Filters (suites)
     ------------------------------------------------------------------ */
  function initFilters() {
    var group = $("[data-filter-group]");
    if (!group) return;

    var buttons = $$("[data-filter]", group);
    var items = $$("[data-cat]");

    buttons.forEach(function (btn) {
      on(btn, "click", function () {
        var key = btn.dataset.filter;
        buttons.forEach(function (b) { b.classList.toggle("is-active", b === btn); });

        var shown = [];
        items.forEach(function (item) {
          var match = key === "all" || (item.dataset.cat || "").split(" ").indexOf(key) > -1;
          item.hidden = !match;
          if (match) shown.push(item);
        });

        if (REDUCED || !shown.length) return;
        utils.set(shown, { opacity: 0, translateY: 30 });
        animate(shown, {
          opacity: [0, 1],
          translateY: [30, 0],
          duration: 900,
          delay: stagger(80),
          ease: EASE
        });
      });
    });
  }

  /* ------------------------------------------------------------------
     14. Forms
     ------------------------------------------------------------------ */
  var EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  function setError(field, message) {
    var slot = $(".field__error", field);
    field.classList.toggle("has-error", !!message);
    if (slot) slot.textContent = message || "";
    return !message;
  }

  function validateField(input) {
    var field = input.closest(".field");
    if (!field) return true;
    var value = (input.value || "").trim();

    if (input.required && !value) return setError(field, "Required");
    if (input.type === "email" && value && !EMAIL.test(value)) return setError(field, "Check this address");
    if (input.type === "date" && input.required && !value) return setError(field, "Select a date");
    if (input.tagName === "SELECT" && input.required && !value) return setError(field, "Choose an option");
    return setError(field, "");
  }

  function initForms() {
    $$("[data-form]").forEach(function (form) {
      var inputs = $$("input, select, textarea", form);
      var success = $("[data-form-success]", form);

      inputs.forEach(function (input) {
        on(input, "blur", function () { validateField(input); });
        on(input, "input", function () {
          if (input.closest(".field").classList.contains("has-error")) validateField(input);
        });
      });

      on(form, "submit", function (e) {
        e.preventDefault();

        var bad = [];
        inputs.forEach(function (input) { if (!validateField(input)) bad.push(input); });

        if (bad.length) {
          var fields = bad.map(function (i) { return i.closest(".field"); });
          if (!REDUCED) {
            animate(fields, {
              translateX: [0, -9, 8, -5, 0],
              duration: 480,
              ease: "linear",
              delay: stagger(50)
            });
          }
          bad[0].focus();
          return;
        }

        var rows = $$(".field, .form__submit", form);
        if (!success) return;

        function finish() {
          rows.forEach(function (r) { r.style.display = "none"; });
          success.classList.add("is-shown");
          var name = $("[name='firstName']", form);
          var slot = $("[data-form-name]", success);
          if (slot && name && name.value) slot.textContent = name.value.trim();
          if (!REDUCED) {
            animate(Array.prototype.slice.call(success.children), {
              opacity: [0, 1],
              translateY: [22, 0],
              duration: 900,
              delay: stagger(70),
              ease: EASE
            });
          }
          success.scrollIntoView({ behavior: REDUCED ? "auto" : "smooth", block: "center" });
        }

        if (REDUCED) { finish(); return; }

        animate(rows, {
          opacity: [1, 0],
          translateY: [0, -18],
          duration: 420,
          delay: stagger(38),
          ease: EASE_INOUT,
          onComplete: finish
        });
      });
    });

    /* Newsletter sign-up in the footer */
    $$("[data-signup]").forEach(function (form) {
      on(form, "submit", function (e) {
        e.preventDefault();
        var input = $("input", form);
        var note = $(".footer__note", form.parentNode) || $(".footer__note", form);
        var value = (input.value || "").trim();

        if (!EMAIL.test(value)) {
          if (note) { note.textContent = "Please enter a valid email address."; note.classList.remove("is-ok"); }
          if (!REDUCED) animate(input, { translateX: [0, -8, 7, -4, 0], duration: 440, ease: "linear" });
          return;
        }

        if (note) { note.textContent = "Thank you — the Orion letter will reach you each solstice."; note.classList.add("is-ok"); }
        input.value = "";
        if (!REDUCED) animate(note, { opacity: [0, 1], translateY: [8, 0], duration: 700, ease: EASE });
      });
    });
  }

  /* ------------------------------------------------------------------
     15. Hero intro — runs once the curtain is up
     ------------------------------------------------------------------ */
  function heroIntro(field) {
    var hero = $("[data-hero]");
    var titleLines = $$(".hero__title .line > span, .phero__title .line > span");

    /* Interior pages: one staggered sweep across whatever is marked. */
    if (!hero) {
      var pieces = $$("[data-anim]");
      if (REDUCED) {
        utils.set(pieces, { opacity: 1, translateY: 0 });
        utils.set(titleLines, { opacity: 1, translateY: "0%" });
        return;
      }
      if (titleLines.length) {
        animate(titleLines, {
          translateY: ["118%", "0%"],
          opacity: [0, 1],
          duration: 1300,
          delay: stagger(110, { start: 120 }),
          ease: EASE
        });
      }
      if (pieces.length) {
        animate(pieces, {
          opacity: [0, 1],
          translateY: [34, 0],
          duration: 1100,
          delay: stagger(110, { start: 180 }),
          ease: EASE
        });
      }
      return;
    }

    if (field && field.constellation) field.constellation.draw(REDUCED ? 0 : 380);

    var eyebrow = $(".hero__eyebrow", hero);
    var body = $(".hero__body", hero);
    var actions = $(".hero__actions", hero);
    var rail = $(".hero__rail", hero);
    var cue = $(".scroll-cue", hero);

    if (REDUCED) {
      utils.set($$("[data-anim]"), { opacity: 1, translateY: 0, translateX: 0 });
      utils.set(titleLines, { opacity: 1, translateY: "0%" });
      return;
    }

    var tl = createTimeline({ defaults: { ease: EASE } });
    if (eyebrow) tl.add(eyebrow, { opacity: [0, 1], translateX: [-24, 0], duration: 950 }, 0);
    if (titleLines.length) {
      tl.add(titleLines, {
        translateY: ["118%", "0%"],
        opacity: [0, 1],
        duration: 1400,
        delay: stagger(125)
      }, 100);
    }
    if (body) tl.add(body, { opacity: [0, 1], translateY: [30, 0], duration: 1100 }, 650);
    if (actions) tl.add(actions, { opacity: [0, 1], translateY: [26, 0], duration: 1000 }, 800);
    if (rail) tl.add(rail, { opacity: [0, 1], translateY: [40, 0], duration: 1100 }, 920);
    if (cue) tl.add(cue, { opacity: [0, 1], duration: 900 }, 1140);
  }

  /* ------------------------------------------------------------------
     16. Small pieces
     ------------------------------------------------------------------ */
  function initYear() {
    $$("[data-year]").forEach(function (el) { el.textContent = String(new Date().getFullYear()); });
  }

  function initMagnetic() {
    if (COARSE || REDUCED) return;
    $$("[data-magnetic]").forEach(function (el) {
      var strength = parseFloat(el.dataset.magnetic) || 0.28;
      on(el, "pointermove", function (e) {
        var r = el.getBoundingClientRect();
        el.style.transform =
          "translate3d(" + ((e.clientX - r.left - r.width / 2) * strength).toFixed(2) + "px," +
          ((e.clientY - r.top - r.height / 2) * strength).toFixed(2) + "px,0)";
      });
      on(el, "pointerleave", function () {
        animate(el, { translateX: 0, translateY: 0, duration: 700, ease: "out(3)" });
      });
    });
  }

  /* The extruded ORION wordmark on the About page follows the pointer. */
  function initExtrude() {
    var word = $("[data-extrude]");
    if (!word || REDUCED) return;

    var chars = $$(".extrude__char", word);
    var host = word.parentNode;
    var tx = 0, ty = 0, cx = 0, cy = 0;

    if (!COARSE) {
      on(host, "pointermove", function (e) {
        var r = host.getBoundingClientRect();
        tx = ((e.clientX - r.left) / r.width - 0.5) * 2;
        ty = ((e.clientY - r.top) / r.height - 0.5) * 2;
      }, { passive: true });
      on(host, "pointerleave", function () { tx = 0; ty = 0; });
    }

    (function loop() {
      cx += (tx - cx) * 0.06;
      cy += (ty - cy) * 0.06;
      word.style.transform = "rotateX(" + (-cy * 13).toFixed(2) + "deg) rotateY(" + (cx * 17).toFixed(2) + "deg)";
      win.requestAnimationFrame(loop);
    })();

    /* Letters stack forward so the extrusion reads as depth, not a shadow. */
    chars.forEach(function (c, i) {
      c.style.transform = "translateZ(" + (i * 9) + "px)";
    });
  }

  /* ------------------------------------------------------------------
     17. Boot
     ------------------------------------------------------------------ */
  function boot() {
    markCurrentLinks();
    initNav();
    initMenu();
    initCursor();
    initTilt();
    initParallax();
    initMarquee();
    initCounters();
    initQuotes();
    initCarousel();
    initLightbox();
    initFilters();
    initForms();
    initExtrude();
    initMagnetic();
    initYear();
    initPageTransitions();

    var field = null;
    if (win.OrionStarfield) field = win.OrionStarfield.build($("[data-sky]"));

    var trail = null;
    if (win.OrionTrail) trail = win.OrionTrail.build($("[data-trail]"));

    /* Reveals wait for the curtain: an observer fires the moment it sees an
       element, and anything above the fold would otherwise play out of sight
       behind the preloader. */
    Curtain.intro(function () {
      heroIntro(field);
      initReveals();
      /* The trail measures against the settled layout, then fades in with the
         hero instead of being there before the page arrives. */
      if (trail) {
        trail.remeasure();
        win.setTimeout(trail.reveal, 240);
      }
    });
  }

  if (doc.readyState === "loading") {
    on(doc, "DOMContentLoaded", boot);
  } else {
    boot();
  }
})(window, document);
