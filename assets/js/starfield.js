/* ==========================================================================
   ORION — starfield.js
   Builds the layered 3D star field behind the home hero and drives the
   pointer/scroll parallax that gives it depth.

   The field is real CSS 3D: five depth planes sit at fixed negative Z inside
   a `perspective: 900px` stage. Because perspective shrinks anything pushed
   away from the camera, every plane is counter-scaled by (P - z) / P so it
   still fills the frame. Tilting the stage then moves the near planes further
   than the far ones for free — genuine parallax, not a fake offset.

   Exposes: window.OrionStarfield.build(root) -> handle | null
   ========================================================================== */
(function (win, doc) {
  "use strict";

  /* Must match `.sky { perspective }` in pages.css. */
  var PERSPECTIVE = 900;

  /* z depth, star count, max size (px), opacity floor/ceiling per plane. */
  var PLANES = [
    { z: -720, n: 52, size: 1.6, o1: 0.10, o2: 0.42 },
    { z: -540, n: 44, size: 1.9, o1: 0.14, o2: 0.55 },
    { z: -370, n: 34, size: 2.3, o1: 0.18, o2: 0.72 },
    { z: -215, n: 24, size: 2.8, o1: 0.24, o2: 0.88 },
    { z:  -85, n: 14, size: 3.4, o1: 0.30, o2: 1.00 }
  ];

  function rand(min, max) { return min + Math.random() * (max - min); }

  function reducedMotion() {
    return win.matchMedia && win.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  /* ------------------------------------------------------------------
     Star plane construction
     ------------------------------------------------------------------ */
  function buildPlane(spec, density) {
    var plane = doc.createElement("div");
    plane.className = "sky__depth layer3d";

    /* Counter-scale so a receded plane still covers the viewport. */
    var scale = (PERSPECTIVE - spec.z) / PERSPECTIVE;
    plane.style.transform = "translate3d(0,0," + spec.z + "px) scale(" + scale.toFixed(4) + ")";
    plane.dataset.z = String(spec.z);
    plane.dataset.scale = String(scale);

    var count = Math.max(6, Math.round(spec.n * density));
    var frag = doc.createDocumentFragment();

    for (var i = 0; i < count; i++) {
      var s = doc.createElement("i");
      s.className = "star";

      var size = rand(spec.size * 0.5, spec.size);
      s.style.left = rand(0, 100).toFixed(3) + "%";
      s.style.top = rand(0, 100).toFixed(3) + "%";
      s.style.width = size.toFixed(2) + "px";
      s.style.height = size.toFixed(2) + "px";
      s.style.setProperty("--o1", spec.o1.toFixed(2));
      s.style.setProperty("--o2", rand(spec.o2 * 0.65, spec.o2).toFixed(2));
      s.style.setProperty("--tw", rand(2.6, 8.2).toFixed(2) + "s");
      s.style.animationDelay = "-" + rand(0, 8).toFixed(2) + "s";

      /* A handful of near stars get a warm bloom so the field has hierarchy. */
      if (spec.z > -400 && Math.random() < 0.16) {
        var glow = (size * 3).toFixed(1);
        s.style.boxShadow = "0 0 " + glow + "px rgba(236,217,174,.85)";
        s.style.background = "#ecd9ae";
      }

      frag.appendChild(s);
    }

    plane.appendChild(frag);
    return plane;
  }

  /* ------------------------------------------------------------------
     Constellation line draw — dash-offset, animated with Anime.js when
     it is available and snapped open when it is not.
     ------------------------------------------------------------------ */
  function prepareConstellation(root) {
    var svg = root.querySelector("[data-constellation]");
    if (!svg) return null;

    var lines = Array.prototype.slice.call(svg.querySelectorAll(".constellation__line"));
    var stars = Array.prototype.slice.call(svg.querySelectorAll(".constellation__star, .constellation__halo"));
    var labels = Array.prototype.slice.call(svg.querySelectorAll(".constellation__label"));

    lines.forEach(function (path) {
      var len = 0;
      try { len = path.getTotalLength(); } catch (e) { len = 0; }
      if (!len) return;
      path.style.strokeDasharray = len;
      path.style.strokeDashoffset = len;
      path.dataset.len = String(len);
    });

    stars.forEach(function (el) { el.style.opacity = "0"; });
    labels.forEach(function (el) { el.style.opacity = "0"; });

    return {
      svg: svg,
      lines: lines,
      stars: stars,
      labels: labels,
      /* Snap everything to its finished state without animating. */
      snap: function () {
        lines.forEach(function (p) { p.style.strokeDashoffset = "0"; });
        stars.forEach(function (el) { el.style.opacity = ""; });
        labels.forEach(function (el) { el.style.opacity = ""; });
      },
      /* Draw the asterism: lines trace, then the stars ignite, then labels. */
      draw: function (delay) {
        var anime = win.anime;
        if (!anime || reducedMotion()) { this.snap(); return; }
        var at = typeof delay === "number" ? delay : 0;

        anime.animate(lines, {
          strokeDashoffset: 0,
          duration: 1500,
          delay: anime.stagger(110, { start: at }),
          ease: "cubicBezier(.22,1,.36,1)"
        });

        anime.animate(stars, {
          opacity: [0, 1],
          scale: [0.2, 1],
          duration: 900,
          delay: anime.stagger(70, { start: at + 260 }),
          ease: "cubicBezier(.16,1,.3,1)"
        });

        if (labels.length) {
          anime.animate(labels, {
            opacity: [0, 1],
            duration: 800,
            delay: anime.stagger(60, { start: at + 900 }),
            ease: "linear"
          });
        }
      }
    };
  }

  /* ------------------------------------------------------------------
     Build + drive
     ------------------------------------------------------------------ */
  function build(root) {
    if (!root) return null;

    var tilt = root.querySelector("[data-sky-tilt]");
    if (!tilt) return null;

    /* Fewer stars on small or low-power screens. */
    var vw = win.innerWidth || 1280;
    var density = vw < 700 ? 0.5 : vw < 1100 ? 0.75 : 1;
    if (win.devicePixelRatio > 2.2 && vw < 900) density *= 0.8;

    var planes = [];
    if (!reducedMotion()) {
      PLANES.forEach(function (spec) {
        var plane = buildPlane(spec, density);
        tilt.appendChild(plane);
        planes.push(plane);
      });
    } else {
      /* Reduced motion still gets a sky, just a still one. */
      var flat = buildPlane(PLANES[2], density * 0.8);
      flat.style.animation = "none";
      tilt.appendChild(flat);
      planes.push(flat);
    }

    var constellation = prepareConstellation(root);
    var constellationEl = root.querySelector("[data-constellation-wrap]");
    var nebulae = Array.prototype.slice.call(root.querySelectorAll(".sky__nebula"));

    /* --- parallax loop ------------------------------------------------ */
    var pointer = { x: 0, y: 0 };   /* target, -1..1 */
    var eased = { x: 0, y: 0 };     /* smoothed */
    var scroll = 0;                 /* 0..1 across the hero */
    var easedScroll = 0;
    var running = false;
    var frame = 0;

    function onPointer(e) {
      var w = win.innerWidth || 1;
      var h = win.innerHeight || 1;
      pointer.x = (e.clientX / w) * 2 - 1;
      pointer.y = (e.clientY / h) * 2 - 1;
    }

    function onScroll() {
      var h = win.innerHeight || 1;
      var y = win.pageYOffset || doc.documentElement.scrollTop || 0;
      scroll = Math.min(1, Math.max(0, y / h));
      /* Stop burning frames once the hero is off screen. */
      if (scroll < 1 && !running) start();
    }

    function tick() {
      eased.x += (pointer.x - eased.x) * 0.055;
      eased.y += (pointer.y - eased.y) * 0.055;
      easedScroll += (scroll - easedScroll) * 0.08;

      /* Stage tilt: a few degrees is plenty — more reads as a gimmick. */
      var rx = (-eased.y * 4.2) + (easedScroll * 6);
      var ry = eased.x * 6.4;
      var dolly = easedScroll * 420;

      tilt.style.transform =
        "translate3d(0,0," + dolly.toFixed(2) + "px) rotateX(" + rx.toFixed(3) + "deg) rotateY(" + ry.toFixed(3) + "deg)";

      /* Nearer planes drift further with the pointer. */
      for (var i = 0; i < planes.length; i++) {
        var p = planes[i];
        var z = parseFloat(p.dataset.z) || 0;
        var sc = parseFloat(p.dataset.scale) || 1;
        var depth = 1 - Math.abs(z) / 800;          /* 0 = far, ~1 = near */
        var dx = eased.x * -26 * depth;
        var dy = eased.y * -18 * depth;
        p.style.transform =
          "translate3d(" + dx.toFixed(2) + "px," + dy.toFixed(2) + "px," + z + "px) scale(" + sc.toFixed(4) + ")";
      }

      for (var n = 0; n < nebulae.length; n++) {
        var mult = (n + 1) * 14;
        nebulae[n].style.transform =
          "translate3d(" + (eased.x * mult).toFixed(2) + "px," +
          (eased.y * mult * 0.7 + easedScroll * 60).toFixed(2) + "px,0)";
      }

      if (constellationEl) {
        var cx = eased.x * -34;
        var cy = eased.y * -22;
        var isNarrow = (win.innerWidth || 0) <= 900;
        var base = isNarrow ? "translate3d(calc(-50% + " + cx.toFixed(2) + "px), calc(-50% + " + cy.toFixed(2) + "px), -140px)"
                            : "translate3d(" + cx.toFixed(2) + "px, calc(-50% + " + cy.toFixed(2) + "px), -140px)";
        constellationEl.style.transform = base + " rotateY(" + (eased.x * -3.5).toFixed(2) + "deg)";
        constellationEl.style.opacity = String(Math.max(0, 1 - easedScroll * 1.5) * (isNarrow ? 0.5 : 0.95));
      }

      /* Idle out when the hero is scrolled past and the pointer is settled. */
      var settled = Math.abs(pointer.x - eased.x) < 0.001 && Math.abs(pointer.y - eased.y) < 0.001;
      if (easedScroll >= 0.999 && settled) { running = false; return; }

      frame = win.requestAnimationFrame(tick);
    }

    function start() {
      if (running) return;
      running = true;
      frame = win.requestAnimationFrame(tick);
    }

    if (!reducedMotion()) {
      win.addEventListener("pointermove", onPointer, { passive: true });
      win.addEventListener("scroll", onScroll, { passive: true });
      win.addEventListener("resize", onScroll, { passive: true });
      onScroll();
      start();
    } else if (constellation) {
      constellation.snap();
    }

    return {
      constellation: constellation,
      destroy: function () {
        running = false;
        win.cancelAnimationFrame(frame);
        win.removeEventListener("pointermove", onPointer);
        win.removeEventListener("scroll", onScroll);
        win.removeEventListener("resize", onScroll);
      }
    };
  }

  win.OrionStarfield = { build: build };
})(window, document);
