// The review gallery for the 2D editor mockups: every screen scaled to the viewer's width, with a full-size view.
// Written for the Artifact tool, which wraps the file in its own document skeleton, so it has no <html> or <head>.

const GROUPS = [
  {
    id: 'stage',
    title: 'Stage editor',
    lead: 'Shapes a FloorFifty stage: parallax layers, the generated course and the set pieces, previewed in a framed phone view.',
    screens: [
      ['compose', 'Compose', 'wide'],
      ['course', 'Course', 'wide'],
      ['pieces', 'Set pieces', 'wide'],
      ['compose-portrait', 'Compose in portrait', 'half'],
      ['stage-settings', 'Stage settings', 'half'],
    ],
  },
  {
    id: 'level',
    title: 'Level editor',
    lead: 'A general tile and entity editor in the manner of LDtk, with a world map for arranging levels.',
    screens: [
      ['level', 'Level', 'wide'],
      ['world', 'World map', 'wide'],
    ],
  },
  {
    id: 'states',
    title: 'Start and states',
    lead: 'Opening, validating, exporting and recovering a file.',
    screens: [
      ['home', 'Home', 'wide'],
      ['checks', 'Checks', 'wide'],
      ['export', 'Export', 'half'],
      ['recover', 'Recover', 'half'],
      ['parse-error', 'Open failed', 'half'],
    ],
  },
  {
    id: 'kit',
    title: 'Kit',
    lead: 'Tokens and controls the screens are built from.',
    screens: [['kit', 'Editor Kit parts', 'wide']],
  },
]

const FIGMA = 'https://www.figma.com/design/8H4vY5xZj7xIedrvDdwg2d'
const PR = 'https://github.com/mcthaydt/automata-framework/pull/93'

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export function gallery(screens, htmlOf, S) {
  const byId = Object.fromEntries(screens.map((s) => [s.id, s]))
  for (const g of GROUPS)
    for (const [id] of g.screens) if (!byId[id]) throw new Error(`gallery lists unknown screen "${id}"`)
  const listed = new Set(GROUPS.flatMap((g) => g.screens.map(([id]) => id)))
  const missing = screens.filter((s) => !listed.has(s.id)).map((s) => s.id)
  if (missing.length) throw new Error(`gallery does not list: ${missing.join(', ')}`)

  const figure = ([id, title, size]) => {
    const s = byId[id]
    return `<figure id="${id}" class="fig ${size}" data-w="${s.w}" data-h="${s.h}">
  <figcaption>
    <div class="cap"><h3>${esc(title)}</h3><span class="dims">${s.w}×${s.h}</span></div>
    <p>${esc(s.note || '')}</p>
  </figcaption>
  <div class="frame" style="--w:${s.w};--h:${s.h};max-width:${s.w}px"><div class="stage" style="width:${s.w}px;height:${s.h}px">${htmlOf(s)}</div></div>
  <button type="button" class="open" aria-label="Open ${esc(title)} at full size">Full size</button>
</figure>`
  }

  const sections = GROUPS.map(
    (g) => `<section id="${g.id}" class="group">
  <header class="ghead"><h2>${esc(g.title)}</h2><p>${esc(g.lead)}</p></header>
  <div class="grid">
${g.screens.map(figure).join('\n')}
  </div>
</section>`,
  ).join('\n')

  const nav = GROUPS.map((g) => `<a href="#${g.id}">${esc(g.title)}</a>`).join('')

  return `<title>Automata 2D Editor</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${S.fontsHref}">
<style>
/* Layout: a review sheet. Short intro, then each screen at the width of the page with its note above it. */
:root {
  --bg: #eceef2;
  --surface: #f7f8fa;
  --fg: #181b21;
  --dim: #5a6271;
  --line: #d2d6de;
  --accent: #86580a;
  --accent-fill: #f1dfbd;
  --focus: #1b5fd1;
  --sans: 'IBM Plex Sans', system-ui, -apple-system, 'Segoe UI', sans-serif;
  --mono: 'IBM Plex Mono', ui-monospace, 'SF Mono', Menlo, monospace;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --bg: #0f1115; --surface: #15181e; --fg: #e8eaef; --dim: #9aa2b0; --line: #2a2f38;
    --accent: #e0a54a; --accent-fill: #3a2c12; --focus: #7fb0ff; color-scheme: dark;
  }
}
:root[data-theme="dark"] {
  --bg: #0f1115; --surface: #15181e; --fg: #e8eaef; --dim: #9aa2b0; --line: #2a2f38;
  --accent: #e0a54a; --accent-fill: #3a2c12; --focus: #7fb0ff; color-scheme: dark;
}
* { box-sizing: border-box; }
html { scroll-behavior: smooth; }
body {
  margin: 0;
  background: var(--bg);
  color: var(--fg);
  font: 15px/1.55 var(--sans);
  padding-block: 32px 64px;
  padding-left: max(16px, env(safe-area-inset-left, 0px));
  padding-right: max(16px, env(safe-area-inset-right, 0px));
  -webkit-font-smoothing: antialiased;
}
.wrap { max-width: 1194px; margin: 0 auto; display: flex; flex-direction: column; gap: 56px; }
a { color: var(--accent); text-underline-offset: 3px; }
a:focus-visible, button:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
.eyebrow { font: 500 11px/1 var(--mono); letter-spacing: 0.12em; text-transform: uppercase; color: var(--dim); }

.intro { display: grid; gap: 20px; max-width: 760px; }
.intro h1 { margin: 0; font: 700 clamp(28px, 5vw, 40px)/1.1 var(--sans); letter-spacing: -0.01em; text-wrap: balance; }
.intro p { margin: 0; color: var(--dim); max-width: 65ch; }
.intro p strong { color: var(--fg); font-weight: 600; }
.facts { display: flex; flex-wrap: wrap; gap: 8px 24px; margin: 0; padding: 14px 0 0; border-top: 1px solid var(--line); }
.facts div { display: grid; gap: 2px; }
.facts dt { font: 500 11px/1 var(--mono); letter-spacing: 0.1em; text-transform: uppercase; color: var(--dim); }
.facts dd { margin: 0; font: 500 14px/1.3 var(--mono); font-variant-numeric: tabular-nums; }
.links { display: flex; flex-wrap: wrap; gap: 10px; }
.links a {
  display: inline-flex; align-items: center; min-height: 44px; padding: 0 16px; border-radius: 8px;
  border: 1px solid var(--line); background: var(--surface); color: var(--fg); text-decoration: none; font-weight: 500;
}
.links a.primary { background: var(--accent-fill); border-color: var(--accent); color: var(--accent); }
nav.toc { display: flex; flex-wrap: wrap; gap: 4px 20px; }
nav.toc a { display: inline-flex; align-items: center; min-height: 44px; color: var(--dim); text-decoration: none; font: 500 13px/1 var(--mono); }
nav.toc a:hover { color: var(--fg); }

.group { display: grid; gap: 24px; scroll-margin-top: 16px; }
.ghead { display: grid; gap: 4px; padding-bottom: 12px; border-bottom: 1px solid var(--line); }
.ghead h2 { margin: 0; font: 600 22px/1.2 var(--sans); }
.ghead p { margin: 0; color: var(--dim); max-width: 70ch; }
.grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 40px 32px; align-items: start; }
.fig { margin: 0; display: grid; gap: 12px; min-width: 0; position: relative; scroll-margin-top: 16px; }
.fig.wide { grid-column: 1 / -1; }
.cap { display: flex; align-items: baseline; gap: 12px; }
.cap h3 { margin: 0; font: 600 17px/1.3 var(--sans); }
.dims { font: 400 12px/1 var(--mono); color: var(--dim); font-variant-numeric: tabular-nums; }
figcaption p { margin: 4px 0 0; color: var(--dim); max-width: 75ch; }
.frame {
  position: relative; width: 100%; aspect-ratio: var(--w) / var(--h); overflow: hidden;
  background: #0a0b0d; border: 1px solid var(--line); border-radius: 10px;
}
.stage { position: absolute; left: 0; top: 0; transform-origin: 0 0; }
.stage, .stage * { box-sizing: border-box; }
.stage [data-name] { font-synthesis: none; }
.open {
  justify-self: start; min-height: 44px; padding: 0 16px; border-radius: 8px; cursor: pointer;
  border: 1px solid var(--line); background: var(--surface); color: var(--fg); font: 500 13px/1 var(--sans);
}
.open:hover { border-color: var(--accent); }
.notes { display: grid; gap: 8px; max-width: 760px; color: var(--dim); font-size: 14px; }
.notes h2 { margin: 0; font: 600 16px/1.3 var(--sans); color: var(--fg); }
.notes p { margin: 0; max-width: 70ch; }
@media (max-width: 860px) { .grid { grid-template-columns: minmax(0, 1fr); } }

.viewer { position: fixed; inset: 0; z-index: 50; background: rgba(6, 7, 10, 0.92); overflow: auto; padding: 56px 16px 24px; }
.viewer[hidden] { display: none; }
.viewer .close {
  position: fixed; top: max(12px, env(safe-area-inset-top, 0px)); right: max(12px, env(safe-area-inset-right, 0px));
  min-height: 44px; padding: 0 18px; border-radius: 8px; border: 1px solid #454952; background: #1a1c21; color: #e8eaef;
  font: 500 14px/1 var(--sans); cursor: pointer; z-index: 2;
}
.viewer .title { position: fixed; top: max(12px, env(safe-area-inset-top, 0px)); left: max(16px, env(safe-area-inset-left, 0px)); color: #e8eaef; font: 500 14px/44px var(--mono); z-index: 2; }
.viewer .full { position: relative; margin: 0 auto; border: 1px solid #2a2e36; border-radius: 10px; overflow: hidden; background: #0a0b0d; }
.viewer .full .stage { position: absolute; transform: none; }
@media (prefers-reduced-motion: reduce) { html { scroll-behavior: auto; } }
</style>
<div class="wrap">
  <header class="intro">
    <span class="eyebrow">Design review · ${screens.length} screens</span>
    <h1>Automata 2D Editor</h1>
    <p>An editor for <strong>FloorFifty stages</strong> and general <strong>tile levels</strong>, designed for the iPad first. The stage editor covers a stage's parallax layers, its generated climbing course and its set pieces. The level editor follows LDtk, with layers, a tileset palette and a world map. Every stage screen shows Rooftops, one of the four stages FloorFifty ships.</p>
    <dl class="facts">
      <div><dt>Landscape</dt><dd>1194 × 834</dd></div>
      <div><dt>Portrait</dt><dd>834 × 1194</dd></div>
      <div><dt>Touch target</dt><dd>44 px, primary 48</dd></div>
      <div><dt>Type</dt><dd>IBM Plex</dd></div>
    </dl>
    <div class="links">
      <a class="primary" href="${FIGMA}" target="_blank" rel="noopener">Open in Figma</a>
      <a href="${PR}" target="_blank" rel="noopener">Spec and plan (PR 93)</a>
    </div>
    <nav class="toc" aria-label="Sections">${nav}</nav>
  </header>
${sections}
  <section class="notes" aria-labelledby="real">
    <h2 id="real">What is real and what is a placeholder</h2>
    <p>Layer names, depths, sinks, haze, seed 35229, the four phrases, the three extension ranges and the six set pieces are the values in Rooftops' stage file. The artwork, the course geometry and the sample level are illustrative. The Checks screen shows an invented error: cityMid's depth set to 0.40.</p>
    <p>Each frame is the same tree that was pushed to the Figma file, so the two match. Tap Full size to read a frame at 1:1.</p>
  </section>
</div>
<div class="viewer" id="viewer" role="dialog" aria-modal="true" aria-label="Full size view" hidden>
  <span class="title" id="viewer-title"></span>
  <button type="button" class="close" id="viewer-close">Close</button>
  <div class="full" id="viewer-full"></div>
</div>
<script>
(function () {
  var frames = Array.prototype.slice.call(document.querySelectorAll('.frame'));
  function fit(frame) {
    var stage = frame.firstElementChild;
    var w = parseFloat(stage.style.width);
    var scale = frame.clientWidth / w;
    stage.style.transform = 'scale(' + scale + ')';
  }
  function fitAll() { frames.forEach(fit); }
  fitAll();
  if (window.ResizeObserver) {
    var ro = new ResizeObserver(fitAll);
    frames.forEach(function (f) { ro.observe(f); });
  } else {
    window.addEventListener('resize', fitAll);
  }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitAll);

  var viewer = document.getElementById('viewer');
  var full = document.getElementById('viewer-full');
  var title = document.getElementById('viewer-title');
  var closeBtn = document.getElementById('viewer-close');
  var opener = null;
  function openViewer(fig, btn) {
    var stage = fig.querySelector('.stage');
    var clone = stage.cloneNode(true);
    clone.style.transform = 'none';
    full.innerHTML = '';
    full.style.width = stage.style.width;
    full.style.height = stage.style.height;
    full.appendChild(clone);
    title.textContent = fig.querySelector('h3').textContent + '  ' + fig.dataset.w + '×' + fig.dataset.h;
    opener = btn;
    viewer.hidden = false;
    viewer.scrollTop = 0;
    viewer.scrollLeft = 0;
    document.documentElement.style.overflow = 'hidden';
    closeBtn.focus();
  }
  function closeViewer() {
    viewer.hidden = true;
    full.innerHTML = '';
    document.documentElement.style.overflow = '';
    if (opener) opener.focus();
  }
  Array.prototype.forEach.call(document.querySelectorAll('.fig .open'), function (btn) {
    btn.addEventListener('click', function () { openViewer(btn.closest('.fig'), btn); });
  });
  closeBtn.addEventListener('click', closeViewer);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !viewer.hidden) closeViewer(); });
})();
</script>
`
}
