// The review gallery for the editor suite mockups: the audit of every editor, then every screen scaled to the viewer's
// width, with a full-size view. Written for the Artifact tool, which wraps the file in its own document skeleton, so it
// has no <html> or <head>.

import { APPROVED_AT, CHANGES, LATEST, SINCE_AT } from './changes.mjs'
import { INVENTORY, NO_EDITOR_YET, VERDICTS } from './inventory.mjs'

const GROUPS = [
  {
    id: 'shell',
    title: 'Shell',
    lead: 'One frame around every editor: the rail (tablet) or tab bar (portrait) to switch editor, the change set, checks, gates, Ask, Undo and Ship.',
    screens: [
      ['suite-home', 'Home', 'wide'],
      ['ask-diff', 'Ask', 'wide'],
      ['ship-dialog', 'Ship', 'half'],
      ['interchange', 'Import', 'half'],
      ['interchange-export', 'Export', 'half'],
    ],
  },
  {
    id: 'states',
    title: 'States',
    lead: 'The panels when something is off or still running: the Code pane, a failing check, checks in progress, the game not connected, Ask saying no or at its cap, and an empty editor.',
    screens: [
      ['states-code-checks', 'Code pane and checks', 'wide'],
      ['states-offline', 'Offline, refused and empty', 'wide'],
    ],
  },
  {
    id: 'review',
    title: 'Review desk',
    lead: 'The owner’s view of a change set: what changed, before and after, the checks, and the gates it reopens.',
    screens: [['review-desk', 'Review desk', 'wide']],
  },
  {
    id: 'sequence',
    title: 'Sequence',
    lead: 'Cutscenes on a timeline: shots, caption lines, sound and light keys. Shown on the Bay’s arrival.',
    screens: [['seq-timeline', 'Timeline', 'wide']],
  },
  {
    id: 'tuner',
    title: 'Tuner',
    lead: 'Bounded sliders for a game’s tunables in its content/tuning.toml, and a fairness measure that runs before and after a change. The last screen is the same editor on FloorFifty, which lists no gates.',
    screens: [
      ['tuner-sliders', 'Sliders', 'wide'],
      ['tuner-fairness', 'Fairness', 'wide'],
      ['ff-tuner', 'Second game: FloorFifty', 'wide'],
    ],
  },
  {
    id: 'writer',
    title: 'Writer',
    lead: 'Lines with their speaker, beat and hints, and a dialogue graph that shows who says what and what it sets.',
    screens: [
      ['writer-lines', 'Lines', 'wide'],
      ['writer-dialogue', 'Dialogue', 'wide'],
    ],
  },
  {
    id: 'studio',
    title: 'Studio',
    lead: 'The character on a stage you touch: tap a part to edit it, drag to turn, outfits and poses under the stage, pose by hand through an IK rig, animate on a timeline, the pipeline as a drawer.',
    screens: [
      ['studio-look', 'Look', 'wide'],
      ['studio-pose', 'Pose', 'wide'],
      ['studio-ik', 'Pose by hand', 'wide'],
      ['studio-animate', 'Animate', 'wide'],
      ['studio-pipeline', 'Pipeline open', 'wide'],
      ['studio-first-run', 'First run', 'wide'],
    ],
  },
  {
    id: 'schematic',
    title: 'Schematic',
    lead: 'A puzzle as a chain of facts and actions, and the agent that acts on it.',
    screens: [
      ['schematic-chain', 'Chain', 'wide'],
      ['schematic-agent', 'Agent', 'wide'],
    ],
  },
  {
    id: 'audio',
    title: 'Audio',
    lead: 'Cue recipes, the event that plays each, and the mix. New: The Last Light has this only as a game board.',
    screens: [['audio-cues', 'Cues', 'wide']],
  },
  {
    id: 'feel',
    title: 'Feel',
    lead: 'Game feel as a table of events and the five channels each one answers on. New: a game board in The Last Light.',
    screens: [['feel-matrix', 'Feel matrix', 'wide']],
  },
  {
    id: 'portrait',
    title: 'iPad held upright',
    lead: 'The same editors at 834 × 1194. Panels become sheets, the rail becomes a tab bar, and the essential action stays reachable.',
    screens: [
      ['seq-portrait', 'Sequence', 'third'],
      ['tuner-portrait', 'Tuner', 'third'],
      ['writer-portrait', 'Writer', 'third'],
      ['studio-portrait', 'Studio', 'third'],
      ['schematic-portrait', 'Schematic', 'third'],
      ['audio-portrait', 'Audio', 'third'],
      ['feel-portrait', 'Feel', 'third'],
      ['review-portrait', 'Review desk', 'third'],
    ],
  },
]

const FIGMA = 'https://www.figma.com/design/8H4vY5xZj7xIedrvDdwg2d'

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export function gallery(screens, htmlOf, S, options = {}) {
  const byId = Object.fromEntries(screens.map((s) => [s.id, s]))
  for (const g of GROUPS)
    for (const [id] of g.screens) if (!byId[id]) throw new Error(`gallery lists unknown screen "${id}"`)
  const listed = new Set(GROUPS.flatMap((g) => g.screens.map(([id]) => id)))
  const missing = screens.filter((s) => !listed.has(s.id)).map((s) => s.id)
  if (missing.length) throw new Error(`gallery does not list: ${missing.join(', ')}`)
  for (const row of INVENTORY)
    for (const id of row.screens) if (!byId[id]) throw new Error(`inventory lists unknown screen "${id}"`)

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

  const rowHtml = (r) => `<tr>
        <th scope="row" data-label="Editor">${r.screens.length ? `<a href="#${r.screens[0]}">${esc(r.name)}</a>` : esc(r.name)}</th>
        <td data-label="Edits">${esc(r.edits)}</td>
        <td data-label="Where it lives in The Last Light"><code>${esc(r.lives)}</code></td>
        <td data-label="Does AF keep it"><span class="tag ${r.verdict}">${esc(VERDICTS[r.verdict])}</span></td>
        <td data-label="Home in AF">${esc(r.home)}</td>
      </tr>`

  const inventory = `<section id="inventory" class="group">
  <header class="ghead"><h2>Every editor, read from the code</h2><p>The Last Light’s editor suite and its game boards, and what the framework does with each. The mockups below cover everything marked kept or new.</p></header>
  <div class="tablewrap">
    <table class="inv">
      <thead><tr><th scope="col">Editor</th><th scope="col">Edits</th><th scope="col">Where it lives in The Last Light</th><th scope="col">Does AF keep it</th><th scope="col">Home in AF</th></tr></thead>
      <tbody>
      ${INVENTORY.map(rowHtml).join('\n      ')}
      </tbody>
    </table>
  </div>
  <div class="notes">
    <h2>Asked for or hinted at, with no editor code</h2>
    <ul class="plain">
${NO_EDITOR_YET.map(([name, why]) => `      <li><strong>${esc(name)}.</strong> ${esc(why)}</li>`).join('\n')}
    </ul>
  </div>
</section>`

  // Before and after for each changed screen, when the build was given the approved checkout (`--before <dir>`).
  const before = options.before
  const since = options.since
  const side = (label, s) =>
    s
      ? `<div class="side"><span class="eyebrow">${label}</span><div class="frame" style="--w:${s.w};--h:${s.h};max-width:${s.w}px"><div class="stage" style="width:${s.w}px;height:${s.h}px">${s.html}</div></div></div>`
      : `<div class="side"><span class="eyebrow">${label}</span><div class="frame none" style="--w:1194;--h:834"><p>New screen</p></div></div>`
  const pair =
    (old) =>
    ([id, was, title, why]) => {
      if (!byId[id]) throw new Error(`changes list unknown screen "${id}"`)
      const now = byId[id]
      return `<article class="pair">
  <div class="cap"><h3>${esc(title)}</h3><a href="#${id}">See it below</a></div>
  <p>${esc(why)}</p>
  <div class="two">${side('Before', was && old[was])}${side('After', { w: now.w, h: now.h, html: htmlOf(now) })}</div>
</article>`
    }
  const changed = before
    ? `<section id="changed" class="group">
  <header class="ghead"><h2>What changed since you approved</h2><p>You approved every editor except the character editor on 23 October. Those screens keep the layout you approved; only their data and file targets changed, to AF content files and the gates each file reopens. The Studio is redesigned, and one second-game screen is added. Before is the version you approved (${APPROVED_AT}).</p></header>
  <div class="pairs">
${CHANGES.map(pair(before)).join('\n')}
  </div>
</section>`
    : ''
  const latest = since
    ? `<section id="latest" class="group">
  <header class="ghead"><h2>New since you accepted the Studio look</h2><p>You said the character editor is glorious and asked for an IK rig to pose by hand, and whether animation was missing. It was: Pose by hand and Animate are new Studio screens. Then the nine look fixes from the audit, each the smallest change that meets the standard: every chip and toggle is now 44 px to touch, Audio has its own colour, and the rest are below. Before is the version you accepted (${SINCE_AT}).</p></header>
  <div class="pairs">
${LATEST.map(pair(since)).join('\n')}
  </div>
</section>`
    : ''

  const nav = [
    ...(since ? [['latest', 'New']] : []),
    ...(before ? [['changed', 'What changed']] : []),
    ['inventory', 'Inventory'],
    ...GROUPS.map((g) => [g.id, g.title]),
  ]
    .map(([id, title]) => `<a href="#${id}">${esc(title)}</a>`)
    .join('')

  const prLink = options.pr
    ? `<a href="${esc(options.pr)}" target="_blank" rel="noopener">Pull request</a>`
    : ''

  return `<title>Automata Editor Suite</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${S.fontsHref}">
<style>
/* Layout: a review sheet. Short intro, the audit table, then each screen at the width of the page with its note above it. */
:root {
  --bg: #eceef2;
  --surface: #f7f8fa;
  --fg: #181b21;
  --dim: #5a6271;
  --line: #d2d6de;
  --accent: #86580a;
  --accent-fill: #f1dfbd;
  --focus: #1b5fd1;
  --ok: #1f6b3a;
  --ok-fill: #d9eddf;
  --new: #8a2f63;
  --new-fill: #f4dcea;
  --sans: 'IBM Plex Sans', system-ui, -apple-system, 'Segoe UI', sans-serif;
  --mono: 'IBM Plex Mono', ui-monospace, 'SF Mono', Menlo, monospace;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --bg: #0f1115; --surface: #15181e; --fg: #e8eaef; --dim: #9aa2b0; --line: #2a2f38;
    --accent: #e0a54a; --accent-fill: #3a2c12; --focus: #7fb0ff;
    --ok: #6fcf8e; --ok-fill: #17301f; --new: #e68bbd; --new-fill: #3a1d2d; color-scheme: dark;
  }
}
:root[data-theme="dark"] {
  --bg: #0f1115; --surface: #15181e; --fg: #e8eaef; --dim: #9aa2b0; --line: #2a2f38;
  --accent: #e0a54a; --accent-fill: #3a2c12; --focus: #7fb0ff;
  --ok: #6fcf8e; --ok-fill: #17301f; --new: #e68bbd; --new-fill: #3a1d2d; color-scheme: dark;
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
code { font: 400 12px/1.5 var(--mono); overflow-wrap: anywhere; }
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

.group { display: grid; gap: 24px; scroll-margin-top: 16px; min-width: 0; }
.ghead { display: grid; gap: 4px; padding-bottom: 12px; border-bottom: 1px solid var(--line); }
.ghead h2 { margin: 0; font: 600 22px/1.2 var(--sans); }
.ghead p { margin: 0; color: var(--dim); max-width: 70ch; }
.grid { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 40px 32px; align-items: start; }
.fig { margin: 0; display: grid; gap: 12px; min-width: 0; position: relative; scroll-margin-top: 16px; grid-column: span 3; }
.fig.wide { grid-column: 1 / -1; }
.fig.third { grid-column: span 2; }
.cap { display: flex; align-items: baseline; gap: 12px; }
.cap h3 { margin: 0; font: 600 17px/1.3 var(--sans); }
.dims { font: 400 12px/1 var(--mono); color: var(--dim); font-variant-numeric: tabular-nums; }
figcaption p { margin: 4px 0 0; color: var(--dim); max-width: 75ch; }
.fig.third figcaption p { font-size: 13px; }
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

.tablewrap { min-width: 0; border: 1px solid var(--line); border-radius: 10px; background: var(--surface); overflow-x: auto; }
table.inv { width: 100%; border-collapse: collapse; font-size: 14px; }
table.inv th, table.inv td { text-align: left; vertical-align: top; padding: 12px 14px; border-top: 1px solid var(--line); }
table.inv thead th { border-top: 0; font: 500 11px/1.3 var(--mono); letter-spacing: 0.08em; text-transform: uppercase; color: var(--dim); white-space: nowrap; }
table.inv tbody th { font-weight: 600; white-space: nowrap; }
table.inv td:nth-child(2) { min-width: 240px; }
table.inv td:nth-child(3) { min-width: 200px; color: var(--dim); }
.tag { display: inline-block; padding: 2px 8px; border-radius: 999px; font: 500 12px/1.5 var(--mono); border: 1px solid var(--line); white-space: nowrap; }
.tag.kept, .tag.shell, .tag.built { color: var(--ok); background: var(--ok-fill); border-color: transparent; }
.tag.new { color: var(--new); background: var(--new-fill); border-color: transparent; }
.tag.planned { color: var(--dim); }
.notes { display: grid; gap: 8px; max-width: 760px; color: var(--dim); font-size: 14px; }
.notes h2 { margin: 0; font: 600 16px/1.3 var(--sans); color: var(--fg); }
.notes p { margin: 0; max-width: 70ch; }
ul.plain { margin: 0; padding-left: 18px; display: grid; gap: 4px; max-width: 70ch; }
ul.plain strong { color: var(--fg); font-weight: 600; }
.last { max-width: 760px; }
.pairs { display: grid; gap: 40px; }
.pair { display: grid; gap: 8px; min-width: 0; }
.pair .cap a { font: 500 13px/1 var(--mono); display: inline-flex; align-items: center; min-height: 44px; }
.pair > p { margin: 0; color: var(--dim); max-width: 75ch; }
.two { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; align-items: start; }
.side { display: grid; gap: 6px; min-width: 0; }
.frame.none { display: grid; place-items: center; color: var(--dim); background: var(--surface); }
.frame.none p { margin: 0; font: 500 13px/1 var(--mono); }
@media (max-width: 860px) {
  .fig, .fig.third { grid-column: 1 / -1; }
  .grid { gap: 32px 0; }
  .two { grid-template-columns: minmax(0, 1fr); }
  table.inv, table.inv tbody, table.inv tr, table.inv th, table.inv td { display: block; }
  table.inv thead { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
  table.inv tr { padding: 12px 14px; border-top: 1px solid var(--line); display: grid; gap: 6px; }
  table.inv tr:first-child { border-top: 0; }
  table.inv th, table.inv td { padding: 0; border: 0; min-width: 0 !important; }
  table.inv tbody th { font-size: 16px; }
  table.inv td[data-label]::before { content: attr(data-label); display: block; font: 500 10px/1.6 var(--mono); letter-spacing: 0.08em; text-transform: uppercase; color: var(--dim); }
  table.inv td:nth-child(3) { color: var(--fg); }
}

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
    <h1>Automata Editor Suite</h1>
    <p>The editors that sit beside the level editors, designed for the iPad first in the same kit. <strong>Sequence, Tuner, Writer, Studio and Schematic</strong> come from The Last Light’s editor suite. <strong>Audio and Feel</strong> are the game’s two boards, turned into editors. A <strong>Review desk</strong> and one shared shell hold them together, and every editor switches from one rail. Each editor is general: the Bay is only the sample content.</p>
    <dl class="facts">
      <div><dt>Landscape</dt><dd>1194 × 834</dd></div>
      <div><dt>Portrait</dt><dd>834 × 1194</dd></div>
      <div><dt>Touch target</dt><dd>44 px, primary 48</dd></div>
      <div><dt>Type</dt><dd>IBM Plex</dd></div>
    </dl>
    <div class="links">
      <a class="primary" href="${FIGMA}" target="_blank" rel="noopener">Open in Figma</a>
      ${prLink}
    </div>
    <nav class="toc" aria-label="Sections">${nav}</nav>
  </header>
${latest}
${changed}
${inventory}
${sections}
  <section class="notes last" aria-labelledby="real">
    <h2 id="real">What is real and what is a placeholder</h2>
    <p>Names, values, bounds, shot times, line texts, gate names and file paths come from The Last Light’s Bay scene and its files. Measured results (fairness numbers, check results, token counts), lock states, the character art and the estimates are illustrative: the mockups do not run the game.</p>
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
  var frames = Array.prototype.slice.call(document.querySelectorAll('.frame:not(.none)'));
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
