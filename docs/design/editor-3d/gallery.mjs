// The review page for the 3D level editor mockups: every screen from screens.mjs rendered as HTML, scaled to
// the page width, each with a short note on what it shows. Run it to write the page to a file:
//   node docs/design/editor-3d/gallery.mjs <out.html>
import { writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { S } from '../editor-kit/scene/scene.mjs'
import { makeData } from './data.mjs'
import { makeScreens } from './screens.mjs'
import { makeUi } from './ui.mjs'
import { makeViews } from './views.mjs'

const LINKS = {
  figma: 'https://www.figma.com/design/8H4vY5xZj7xIedrvDdwg2d',
  pr: 'https://github.com/mcthaydt/automata-framework/pull/94',
}

// Order is the order of the page. `key` is the entry in makeScreens(); `id` is the anchor.
const NOTES = [
  {
    key: 'concept',
    id: 'concept',
    title: 'Concept',
    blurb:
      'One level, the clinic from The Last Light, shown three ways. Plan is where you draw, Split shows plan and 3D together, Walk puts you inside the room. The four cards at the bottom are the rules the other nine screens follow.',
    notes: [
      'Layers come from LDtk: sectors, walls, props, hotspots, lamps, nav and zones.',
      'Sectors, portals and heights come from Build, in metres.',
    ],
  },
  {
    key: 'foundations',
    id: 'foundations',
    title: 'Foundations',
    blurb:
      'The shared Editor Kit tokens plus the entity colours the 3D editor adds. Touch targets are 44 px and primary actions 48 px, on every screen.',
    notes: [
      'Figma variables live in the Editor Kit collection and a new Editor 3D collection.',
      'Type is IBM Plex Sans with Plex Mono for coordinates and ids.',
    ],
  },
  {
    key: 'split',
    id: 'split',
    title: 'Split',
    blurb:
      'Plan on the left, dollhouse in the middle, inspector at the edge. Select the hall in either view and both highlight it. The layer list is LDtk-style: show, hide and lock each layer, with a count beside it.',
    notes: [
      'Counts are real: 7 sectors, 44 walls, 21 props, 23 hotspots, 15 lamps, 18 nav nodes, 3 zones.',
      'Floor 0.00 m and ceiling 4.90 m are the hall’s values in blockout.json.',
    ],
  },
  {
    key: 'draw',
    id: 'draw',
    title: 'Draw a sector',
    blurb:
      'The Pencil flow. A loupe shows the corner under the tip and a nudge pad moves it one grid step at a time. Both sit clear of where the hand rests. Edge lengths show as you go, and the editor offers a portal when the new wall lies on a neighbour’s wall.',
    notes: [
      'Close sector is the 48 px primary action and sits next to Undo point.',
      'The inspector lists the points, inherited heights and the checks that run on close.',
    ],
  },
  {
    key: 'walk',
    id: 'walk',
    title: 'Walk',
    blurb:
      'The camera drops to eye height, 1.6 m. Two virtual sticks move and look, the crosshair picks a wall, and the inspector turns that wall into a portal, door or window or changes its height and material.',
    notes: [
      'A minimap shows where you stand and which way you face.',
      'Fly and Orbit are one tap away for checking a room from above.',
    ],
  },
  {
    key: 'materials',
    id: 'materials',
    title: 'Material picker',
    blurb:
      'A sheet over Walk. Categories on the left, tiles in the middle, a large preview with scale and brightness on the right. Tiles used in this level are pinned under the grid.',
    notes: ['The eleven tiles are procedural placeholders until real textures are chosen.'],
  },
  {
    key: 'world',
    id: 'world',
    title: 'World',
    blurb:
      'LDtk’s world view for The Last Light. Levels sit in wings with an offset, the four phases run in order along the bottom, and the joins table lists every door and street link between levels.',
    notes: ['All of it comes from facility.json: two wings, four phases, four joins.'],
  },
  {
    key: 'portrait',
    id: 'portrait',
    title: 'Portrait',
    tall: true,
    blurb:
      'In portrait the plan keeps the full height. The tool rail becomes a floating strip and the inspector becomes a bottom sheet with three heights: peek, half and full. The top bar shrinks to icons.',
    notes: ['834 × 1194, the iPad 11″ held upright.', 'Nothing is hidden to make it fit; the sheet scrolls.'],
  },
  {
    key: 'gestures',
    id: 'gestures',
    title: 'Gestures and keys',
    blurb:
      'Fingers navigate and select, the Pencil draws, a keyboard makes both faster. The Pencil never pans, so a resting palm cannot move geometry.',
    notes: ['Every mode and tool has a key, Build-style.'],
  },
  {
    key: 'checks',
    id: 'checks',
    title: 'Checks and Ask',
    blurb:
      'The game’s validator runs on every change and each error points at the wall on the plan. Ask Claude shows its proposed change as a ghost on the plan with a token budget. Nothing is written until checks pass and you accept.',
    notes: [
      'The messages and the proposed window are examples, not output of the real validator.',
      'The checks are modelled on the Last Light blockout rules: shared walls, openings and hotspot reach.',
    ],
  },
]

const DECISIONS = [
  'The iPad Pro 11″ is the reference tablet: 1194 × 834 landscape, 834 × 1194 portrait.',
  'Plan is the only view that draws. 3D is for walking, picking, painting and checking, as in Build.',
  'Edits go through the Last Light change-set flow, so every change is a branch and the validator gates it.',
  'Walk uses virtual sticks first. Gyro look is left out until someone asks for it.',
  'The editor is a package on the shared Editor Kit that the 2D editor also uses, so tokens and primitives match.',
]

const css = `
:root {
  --ground: #0c0d10; --panel: #14161a; --raised: #1b1e23; --line: #272b32;
  --ink: #e8e6e1; --ink-dim: #a2a4ab; --ink-faint: #70737b;
  --accent: #e0a54a; --accent-ink: #17120a; --shadow: rgba(0, 0, 0, 0.5);
  --sans: 'IBM Plex Sans', system-ui, sans-serif; --mono: 'IBM Plex Mono', ui-monospace, monospace;
  color-scheme: dark;
}
@media (prefers-color-scheme: light) {
  :root:not([data-theme="dark"]) {
    --ground: #edebe5; --panel: #f7f6f2; --raised: #ffffff; --line: #d8d5cb;
    --ink: #1a1b1e; --ink-dim: #4f5158; --ink-faint: #7a7c84;
    --accent: #8a5606; --accent-ink: #ffffff; --shadow: rgba(30, 24, 10, 0.18);
    color-scheme: light;
  }
}
:root[data-theme="light"] {
  --ground: #edebe5; --panel: #f7f6f2; --raised: #ffffff; --line: #d8d5cb;
  --ink: #1a1b1e; --ink-dim: #4f5158; --ink-faint: #7a7c84;
  --accent: #8a5606; --accent-ink: #ffffff; --shadow: rgba(30, 24, 10, 0.18);
  color-scheme: light;
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--ground); color: var(--ink); font: 15px/1.55 var(--sans); }
a { color: var(--accent); text-underline-offset: 3px; }
a:focus-visible, button:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; }
.wrap {
  max-width: 1226px; margin-inline: auto; display: flex; flex-direction: column; gap: 56px;
  padding-inline: max(16px, env(safe-area-inset-left, 0px)) max(16px, env(safe-area-inset-right, 0px));
  padding-block: 40px 72px;
}
.eyebrow { font: 600 11px/1.4 var(--mono); letter-spacing: 0.12em; text-transform: uppercase; color: var(--ink-faint); }
header { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 340px); gap: 32px 56px; align-items: end; }
h1 { margin: 6px 0 14px; font: 600 clamp(34px, 6vw, 56px)/1.05 var(--sans); letter-spacing: -0.02em; text-wrap: balance; }
.lead { margin: 0; max-width: 62ch; color: var(--ink-dim); font-size: 17px; }
dl.facts { margin: 0; display: grid; grid-template-columns: auto 1fr; gap: 6px 16px; font: 12px/1.5 var(--mono); }
dl.facts dt { color: var(--ink-faint); }
dl.facts dd { margin: 0; color: var(--ink); }
.links { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 18px; }
.links a, button.size {
  display: inline-flex; align-items: center; min-height: 40px; padding: 0 16px; border-radius: 10px;
  border: 1px solid var(--line); background: var(--panel); color: var(--ink); font: 500 13px/1 var(--sans); text-decoration: none;
}
.links a.primary { background: var(--accent); border-color: var(--accent); color: var(--accent-ink); }
button.size { cursor: pointer; }
button.size[aria-pressed="true"] { border-color: var(--accent); color: var(--accent); }
nav.index { display: flex; flex-wrap: wrap; gap: 8px; }
nav.index a {
  display: inline-flex; align-items: center; min-height: 36px; padding: 0 14px; border-radius: 18px; border: 1px solid var(--line);
  color: var(--ink-dim); font: 500 13px/1 var(--sans); text-decoration: none; background: var(--panel);
}
nav.index a:hover { color: var(--ink); border-color: var(--ink-faint); }
figure { margin: 0; display: flex; flex-direction: column; gap: 16px; scroll-margin-top: 24px; }
.bar { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.bar h2 { margin: 0; font: 600 22px/1.2 var(--sans); letter-spacing: -0.01em; }
.bar .dim { font: 12px/1.4 var(--mono); color: var(--ink-faint); margin-right: auto; margin-left: 14px; }
.stage {
  position: relative; border: 1px solid var(--line); border-radius: 14px; background: #0a0b0d; overflow-x: auto; overflow-y: hidden;
  box-shadow: 0 18px 40px -22px var(--shadow);
}
.stage.fit { overflow: hidden; }
.stage > :first-child { transform-origin: 0 0; }
figcaption { display: grid; grid-template-columns: minmax(0, 3fr) minmax(0, 2fr); gap: 16px 40px; }
figcaption p { margin: 0; max-width: 64ch; color: var(--ink-dim); }
figcaption ul { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 8px; font-size: 13px; color: var(--ink-dim); }
figcaption li { padding-left: 14px; position: relative; }
figcaption li::before { content: ''; position: absolute; left: 0; top: 0.62em; width: 6px; height: 2px; background: var(--accent); }
figure.tall { display: grid; grid-template-columns: minmax(0, 460px) minmax(0, 1fr); gap: 16px 40px; align-items: start; }
figure.tall .bar { grid-column: 1 / -1; }
figure.tall figcaption { grid-template-columns: minmax(0, 1fr); align-content: start; }
section.decisions { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 2fr); gap: 16px 56px; border-top: 1px solid var(--line); padding-top: 32px; }
section.decisions h2 { margin: 6px 0 0; font: 600 22px/1.2 var(--sans); }
section.decisions ol { margin: 0; padding-left: 20px; display: flex; flex-direction: column; gap: 10px; color: var(--ink-dim); max-width: 66ch; }
footer { border-top: 1px solid var(--line); padding-top: 20px; font: 12px/1.6 var(--mono); color: var(--ink-faint); }
@media (max-width: 860px) {
  header, figcaption, figure.tall, section.decisions { grid-template-columns: minmax(0, 1fr); }
  .wrap { gap: 44px; }
}
@media (prefers-reduced-motion: no-preference) { nav.index a { transition: color 120ms, border-color 120ms; } }
`

// Each screen is laid out at its design size and scaled to the width of its stage. Actual size shows it at 100%
// and lets the stage scroll sideways, which is the way to read a screen on a phone.
const script = `
const stages = [...document.querySelectorAll('.stage')]
const place = (stage) => {
  const screen = stage.firstElementChild
  const w = Number(stage.dataset.w)
  const h = Number(stage.dataset.h)
  const actual = stage.classList.contains('actual')
  const scale = actual ? 1 : Math.min(1, stage.clientWidth / w)
  screen.style.transform = 'scale(' + scale + ')'
  stage.style.height = Math.round(h * scale) + 'px'
  stage.classList.toggle('fit', !actual)
}
for (const stage of stages) {
  new ResizeObserver(() => place(stage)).observe(stage)
  place(stage)
}
for (const button of document.querySelectorAll('button.size')) {
  button.addEventListener('click', () => {
    const stage = document.getElementById(button.dataset.stage)
    const on = stage.classList.toggle('actual')
    button.setAttribute('aria-pressed', String(on))
    button.textContent = on ? 'Fit to width' : 'Actual size'
    place(stage)
  })
}
`

const esc = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const figureHtml = (note, tree) => {
  const stageId = `stage-${note.id}`
  return `<figure id="${note.id}"${note.tall ? ' class="tall"' : ''}>
  <div class="bar"><h2>${esc(note.title)}</h2><span class="dim">${tree.w} × ${tree.h}</span><button class="size" type="button" id="size-${note.id}" data-stage="${stageId}" aria-pressed="false">Actual size</button></div>
  <div class="stage" id="${stageId}" data-w="${tree.w}" data-h="${tree.h}" role="img" aria-label="${esc(`${note.title} mockup. ${note.blurb}`)}">${S.toHTML(tree)}</div>
  <figcaption><p>${esc(note.blurb)}</p><ul>${note.notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul></figcaption>
</figure>`
}

export const buildGallery = () => {
  const data = makeData()
  const views = makeViews(S, data)
  const screens = makeScreens(S, makeUi(S, views, data), views, data)
  const clinic = data.scenes.clinic
  return `<title>3D Level Editor Mockups</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${S.fontsHref}">
<style>${css}</style>
<div class="wrap">
  <header>
    <div>
      <div class="eyebrow">Automata · 3D level editor · mockups</div>
      <h1>LDtk × Build, on a tablet</h1>
      <p class="lead">A level editor for The Last Light that draws sectors the way Build did and organises levels the way LDtk does. Designed for an iPad with a Pencil first. Every screen uses the real clinic level.</p>
      <div class="links"><a class="primary" href="${LINKS.figma}" target="_blank" rel="noopener">Open in Figma</a><a href="${LINKS.pr}" target="_blank" rel="noopener">Design PR</a></div>
    </div>
    <dl class="facts">
      <dt>screens</dt><dd>${NOTES.length}</dd>
      <dt>tablet</dt><dd>iPad Pro 11″</dd>
      <dt>level</dt><dd>clinic · ${clinic.rooms.length} sectors</dd>
      <dt>touch</dt><dd>44 px · 48 px primary</dd>
      <dt>figma</dt><dd>page “3D · Screens”</dd>
    </dl>
  </header>
  <nav class="index" aria-label="Screens">${NOTES.map((n) => `<a href="#${n.id}">${esc(n.title)}</a>`).join('')}</nav>
  ${NOTES.map((n) => figureHtml(n, screens[n.key]())).join('\n  ')}
  <section class="decisions">
    <div><div class="eyebrow">Working assumptions</div><h2>What the build starts from</h2></div>
    <ol>${DECISIONS.map((d) => `<li>${esc(d)}</li>`).join('')}</ol>
  </section>
  <footer>Generated from docs/design/editor-3d. Figma variables: Editor Kit and Editor 3D. Fonts: IBM Plex Sans and Mono.</footer>
</div>
<script>${script}</script>`
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const out = process.argv[2]
  if (!out) throw new Error('usage: node gallery.mjs <out.html>')
  writeFileSync(out, buildGallery())
}
