/* ==========================================================================
   ORION — trail.js
   The star trail: a single luminous line that traces the full height of the
   home page as you scroll, the way a long exposure records one star's path
   across the night.

   Geometry notes
   --------------
   The line lives in a viewport-sized fixed SVG, not in one document-tall
   element. A path 9,000px tall would repaint its whole box on every scroll
   frame; instead the curve is a pure function of absolute document Y, and
   each frame samples only the slice currently on screen. Cost per frame is
   constant regardless of page length.

   The head is mapped from scroll *progress*, not from a fixed viewport
   offset. Anchoring it to "scrollY + 0.78vh" would leave the last screenful
   undrawn, because the page stops scrolling before that point reaches the
   end. Mapping progress 0..1 onto the whole trail guarantees it completes
   exactly as the footer lands.

   It runs down the centre of the viewport, which means it crosses the text
   column. That is survivable only because the layer is composited with
   mix-blend-mode: screen: over the dark ground the brass reads at full
   strength, and over bright type it saturates to the type's own colour and
   disappears. The line therefore passes behind the words perceptually
   without ever being painted behind them -- which it cannot be, since the
   marquee, CTA, testimonial band and footer all paint opaque backgrounds.
   Centring also buys room for a real meander; in the old gutter placement
   the whole excursion had to fit in ~30px.

   Exposes: window.OrionTrail.build(root) -> handle | null
   ========================================================================== */
(function (win, doc) {
  "use strict";

  var SVG_NS = "http://www.w3.org/2000/svg";
  var STEP = 10;            /* sample spacing in px down the viewport */
  var HEAD_START = 0.55;    /* head sits here (x vh) at the very top */

  function reducedMotion() {
    return win.matchMedia && win.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  function build(root) {
    if (!root) return null;

    var svg = root.querySelector("[data-trail-svg]");
    var ghost = root.querySelector(".trail__ghost");
    var glow = root.querySelector(".trail__glow");
    var line = root.querySelector(".trail__line");
    var head = root.querySelector(".trail__head");
    var halo = root.querySelector(".trail__halo");
    var grad = root.querySelector("[data-trail-grad]");
    if (!svg || !line || !head) return null;

    var REDUCED = reducedMotion();

    /* ---------------------------------------------------------------
       Metrics — re-derived on resize and whenever the document grows
       (images finishing decode change scrollHeight).
       --------------------------------------------------------------- */
    var vh = 0, vw = 0, docH = 0, trailEnd = 0;
    var baseX = 0, amp = 40;
    var edgeMin = 40, edgeMax = 400;   /* the line never leaves the viewport */
    var bowR = 120, bowL = 120;        /* how far the bow may pull, each way */

    function measure() {
      vh = win.innerHeight || 1;
      docH = Math.max(
        doc.documentElement.scrollHeight,
        doc.body ? doc.body.scrollHeight : 0
      );
      trailEnd = Math.max(vh, docH - 40);

      vw = win.innerWidth || 1;
      baseX = vw / 2;

      /* Centred, the constraint is the viewport rather than a text column, so
         the meander can finally be wide enough to read as a drift. */
      amp = REDUCED ? 0 : clamp(vw * 0.05, 16, 90);
      bowR = bowL = Math.min(150, vw * 0.13);
      edgeMin = 40;
      edgeMax = Math.max(edgeMin + 1, vw - 40);

      if (grad) {
        grad.setAttribute("x1", "0");
        grad.setAttribute("y1", "0");
        grad.setAttribute("x2", "0");
        grad.setAttribute("y2", String(vh));
      }
      placeNodes();
    }

    /* Two superimposed waves so the drift never reads as a clean sine. The
       wavelengths are short enough that a single screenful shows real
       curvature, or the line just reads as a straight rule. */
    function xAt(docY) {
      if (REDUCED) return baseX;
      return baseX
           + amp * Math.sin(docY / 380)
           + amp * 0.4 * Math.sin(docY / 165 + 1.7);
    }

    /* Final on-screen X: meander plus bow, held inside the viewport. */
    function pos(docY, scrollY) {
      return clamp(xAt(docY) + bowAt(docY, scrollY), edgeMin, edgeMax);
    }

    /* ---------------------------------------------------------------
       Pointer bow — the line leans toward the cursor when it comes near,
       falling off with vertical distance so only the local stretch moves.
       --------------------------------------------------------------- */
    var pointerX = -999, pointerY = -999;
    var bowAmt = 0, bowTarget = 0;

    function bowAt(docY, scrollY) {
      if (!bowAmt) return 0;
      var dy = Math.abs((docY - scrollY) - pointerY);
      var f = 1 - dy / 340;
      if (f <= 0) return 0;
      f = f * f * (3 - 2 * f);                     /* smoothstep */
      var pull = (pointerX - baseX) * 0.5 * f * bowAmt;
      return clamp(pull, -bowL, bowR);
    }

    function onPointer(e) {
      pointerX = e.clientX;
      pointerY = e.clientY;
      /* Wake up when the pointer comes near the ribbon, either side of it. */
      bowTarget = Math.abs(pointerX - baseX) < 420 ? 1 : 0;
    }
    function onPointerOut() { bowTarget = 0; }

    /* ---------------------------------------------------------------
       Nodes — one marker per major section, lit as the head passes.
       Decorative: the same destinations are in the nav and the footer,
       so these stay out of the tab order and the accessibility tree.
       --------------------------------------------------------------- */
    var nodes = [];

    function collectNodes() {
      nodes.forEach(function (n) { if (n.el.parentNode) n.el.parentNode.removeChild(n.el); });
      nodes = [];

      var sections = Array.prototype.slice.call(
        doc.querySelectorAll("main > section, main > .marquee, .footer")
      );

      sections.forEach(function (sec) {
        var el = doc.createElement("i");
        el.className = "trail__node";
        el.setAttribute("aria-hidden", "true");
        root.appendChild(el);
        nodes.push({ el: el, sec: sec, y: 0, lit: false, shown: false });
      });

      /* The terminus, so the line resolves instead of just stopping. */
      var end = doc.createElement("i");
      end.className = "trail__node trail__node--end";
      end.setAttribute("aria-hidden", "true");
      root.appendChild(end);
      nodes.push({ el: end, sec: null, y: 0, lit: false, shown: false, isEnd: true });
    }

    function placeNodes() {
      var scrollY = win.pageYOffset || 0;
      nodes.forEach(function (n) {
        if (n.isEnd) { n.y = trailEnd; return; }
        var r = n.sec.getBoundingClientRect();
        n.y = r.top + scrollY + Math.min(96, r.height * 0.18);
      });
    }

    /* ---------------------------------------------------------------
       Frame
       --------------------------------------------------------------- */
    var lastScroll = -1, lastBow = -1, running = false, frame = 0;

    function draw() {
      var scrollY = win.pageYOffset || doc.documentElement.scrollTop || 0;
      var max = Math.max(1, docH - vh);
      var progress = clamp(scrollY / max, 0, 1);

      /* Progress-mapped so the trail finishes exactly at the page end. */
      var headDoc = (vh * HEAD_START) + progress * (trailEnd - vh * HEAD_START);
      var endV = clamp(headDoc - scrollY, 0, vh);

      var d = "";
      for (var y = 0; y <= endV; y += STEP) {
        var dy = scrollY + y;
        d += (y === 0 ? "M" : "L") + pos(dy, scrollY).toFixed(2) + " " + y.toFixed(1);
      }
      d += "L" + pos(headDoc, scrollY).toFixed(2) + " " + endV.toFixed(1);

      line.setAttribute("d", d);
      if (glow) glow.setAttribute("d", d);

      /* The faint path ahead, so the full route reads before it is drawn. */
      if (ghost) {
        var g = "";
        for (var gy = 0; gy <= vh; gy += STEP * 2) {
          var gdy = scrollY + gy;
          g += (gy === 0 ? "M" : "L") + pos(gdy, scrollY).toFixed(2) + " " + gy.toFixed(1);
        }
        ghost.setAttribute("d", g);
      }

      var hx = pos(headDoc, scrollY);
      head.setAttribute("cx", hx.toFixed(2));
      head.setAttribute("cy", endV.toFixed(1));
      if (halo) {
        halo.setAttribute("cx", hx.toFixed(2));
        halo.setAttribute("cy", endV.toFixed(1));
      }

      for (var i = 0; i < nodes.length; i++) {
        var n = nodes[i];
        var vy = n.y - scrollY;
        var visible = vy > -40 && vy < vh + 40;
        if (visible !== n.shown) {
          n.shown = visible;
          n.el.style.display = visible ? "block" : "none";
        }
        if (!visible) continue;
        n.el.style.transform =
          "translate3d(" + pos(n.y, scrollY).toFixed(2) + "px," + vy.toFixed(1) + "px,0)";
        var lit = n.y <= headDoc;
        if (lit !== n.lit) {
          n.lit = lit;
          n.el.classList.toggle("is-lit", lit);
        }
      }
    }

    function tick() {
      bowAmt += (bowTarget - bowAmt) * 0.08;
      if (bowAmt < 0.001) bowAmt = 0;

      var scrollY = win.pageYOffset || 0;
      var settled = scrollY === lastScroll && Math.abs(bowAmt - lastBow) < 0.0005;

      if (!settled) {
        lastScroll = scrollY;
        lastBow = bowAmt;
        draw();
      }
      frame = win.requestAnimationFrame(tick);
    }

    function start() {
      if (running) return;
      running = true;
      frame = win.requestAnimationFrame(tick);
    }

    /* ---------------------------------------------------------------
       Wire up
       --------------------------------------------------------------- */
    collectNodes();
    measure();
    draw();

    win.addEventListener("resize", function () { measure(); draw(); }, { passive: true });
    if (!REDUCED) {
      win.addEventListener("pointermove", onPointer, { passive: true });
      doc.addEventListener("pointerleave", onPointerOut);
    }

    /* Images decoding after load change the page height; keep the terminus
       and every node anchored to where their sections actually ended up. */
    if (win.ResizeObserver && doc.body) {
      var ro = new ResizeObserver(function () { measure(); draw(); });
      ro.observe(doc.body);
    }
    win.addEventListener("load", function () { measure(); draw(); });

    start();

    return {
      reveal: function () { root.classList.add("is-live"); },
      remeasure: function () { measure(); draw(); }
    };
  }

  win.OrionTrail = { build: build };
})(window, document);
