# ORION — luxury hotel website

A six-page site for a fictional hotel and private observatory in the Atacama
Highlands, built with hand-written HTML/CSS and **Anime.js v4** for motion.

Open `index.html` in a browser. No build step, no server required — every
dependency is either vendored locally or loaded from a CDN.

---

## Pages

| File | What it is |
| --- | --- |
| `index.html` | Home — 3D constellation hero, suites preview, observatory feature, stats, 3D carousel, testimonials |
| `about.html` | The House — story, extruded 3D wordmark, timeline, values, people, awards |
| `suites.html` | Suites & rates — filterable list of six rooms with 3D tilt |
| `experiences.html` | The dome, Table Nine, the rock baths, excursions |
| `gallery.html` | 3D carousel plus a masonry grid with a lightbox |
| `contact.html` | Reservation enquiry form with validation and a success state |

## Files

```
index.html … contact.html      the six pages
assets/css/base.css            tokens, reset, typography, nav, menu, footer
assets/css/pages.css           section components + the house photo grade
assets/js/anime.iife.min.js    Anime.js v4.0.2, vendored (works offline)
assets/js/orion.js             all site behaviour
assets/js/starfield.js         the hero star field + constellation
assets/img/favicon.svg         Orion glyph
```

---

## The 3D

Everything is real CSS 3D — `perspective`, `transform-style: preserve-3d` and
transforms on the Z axis. No WebGL, no Three.js.

**The hero star field** (`starfield.js`) is five depth planes at fixed negative
Z inside a `perspective: 900px` stage. Perspective shrinks anything pushed away
from the camera, so each plane is counter-scaled by `(P − z) / P` to still fill
the frame. Tilting the stage with the pointer then moves near planes further
than far ones — genuine parallax, not a faked offset. The Orion asterism is
inline SVG that draws itself in on load via animated `stroke-dashoffset`.

**The carousel** arranges plates on a cylinder: cell *i* sits at
`rotateY(i · θ) translateZ(R)` where `R = (w/2) / tan(π/n)`, and the ring
counter-rotates to bring a plate to the front. The ring is pushed back by `R`
so the front plate lands near the camera plane instead of looming. Drag it,
use the arrows, or press ← / →.

**Tilt cards** use Anime's `createAnimatable`, which gives each axis its own
eased channel so a card settles rather than snapping.

**The wordmark** on the About page is a stack of layered text-shadows forming a
brass extrusion, with each letter pushed further along Z and the whole word
rotating to follow the pointer.

## How motion is split

Anime.js drives every *discrete* transition — the preloader, the page-to-page
curtain, scroll reveals, the menu, counters, the carousel, form states.
Continuous pointer tracking (the cursor, tilt, parallax) is a small hand-rolled
lerp in one rAF loop, because that is the right tool for per-frame following.

## Authoring

- `data-reveal="up | lines | chars | stagger | z | fade | left | right | scale"`
  on any element, with optional `data-reveal-delay` and `data-reveal-stagger`.
  Multi-line headlines use `<span class="line"><span>…</span></span>` per line.
- `data-parallax="60"` — travel in px across one screen; `data-parallax-scale`
  adds a slight zoom.
- `data-tilt="8"` on a container plus `data-tilt-inner` on the child that moves.
- `data-count="2410"` with optional `-suffix`, `-prefix`, `-decimals`,
  `-group="false"`.
- `data-anim` marks above-the-fold elements the intro timeline owns; they are
  held back until the curtain lifts rather than being fired by the observer.

## Notes

- Photography is loaded from Unsplash and pulled toward the ink palette by a
  single "house grade" at the bottom of `pages.css` — change the filters there
  to regrade every image at once. Swap the URLs for your own shots.
- Fonts are Cormorant Garamond + Jost from Google Fonts, with real fallback
  stacks if they fail to load.
- `prefers-reduced-motion` is honoured throughout: animations resolve
  immediately instead of being skipped, so nothing stays invisible.
- All text meets WCAG AA. On a palette this dark that turns on one token:
  `--c-mute-2` carries every tertiary label, form label and placeholder, and
  is set to the lightest value the hierarchy allows while still clearing
  4.5:1 on all four ink shades. Darken it and the reservation form fails.
- Hover-only content has a touch fallback. The suite-card description
  expands via `grid-template-rows` on hover and is shown unconditionally
  under `(hover: none)`, where it would otherwise be unreachable.
- With JavaScript disabled the whole site still renders and reads; only the
  generated star field is missing.
- The star field container is `.sky`, not `.field` — the reservation form owns
  `.field`, and the two collided.
