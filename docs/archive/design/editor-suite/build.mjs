// Renders the editor suite mockups (sequence, tuner, writer, studio, schematic, audio, feel and the shared shell) from one source.
//
//   node build.mjs list
//   node build.mjs screen <id> <out.html> [--local-fonts <dir>]   one screen at 1:1, for screenshots
//   node build.mjs html <out.html> [--local-fonts <dir>]          every screen at 1:1 in one long page
//   node build.mjs gallery <out.html> [--pr <url>] [--before <dir>] [--since <dir>]
//                                                                 the review gallery published as an artifact; --before
//                                                                 names the approved checkout's editor-suite dir, --since
//                                                                 the one the latest changes are measured from
//   node build.mjs figma-parts [n]                                `use_figma` code that stores chunk n of the suite parts on page _kit
//   node build.mjs figma-parts count                              how many chunks there are
//   node build.mjs figma-collection                               `use_figma` code that adds the "Editor Suite" colour variables
//   node build.mjs figma <id> [x]                                 `use_figma` code that renders one screen
//
// The scene kit lives in ../editor-kit/scene (owned by the 3D editor lane) and the 2D parts in ../editor-2d.

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parts } from '../editor-2d/parts.mjs'
import { S } from '../editor-kit/scene/scene.mjs'
import { suiteData } from './data.mjs'
import { gallery } from './gallery.mjs'
import { artParts, suiteParts } from './parts.mjs'
import { screens } from './screens.mjs'

const [cmd, ...rest] = process.argv.slice(2)
const P = parts(S)
const D = suiteData()
const Q = suiteParts(S, P, D)
const A = artParts(S, P, Q)
const byId = (id) => {
  const s = screens.find((x) => x.id === id)
  if (!s) throw new Error(`unknown screen "${id}"; have ${screens.map((x) => x.id).join(', ')}`)
  return s
}
const html = (s) => S.toHTML(s.build(S, P, Q, A))
const SUITE_TOKENS = [
  'sequence',
  'tuner',
  'writer',
  'studio',
  'schematic',
  'audio',
  'feel',
  'levels',
  'review',
]
  .map((k) => `ed/${k}`)
  .concat('edge/default')
const arg = (name) => {
  const i = rest.indexOf(name)
  return i >= 0 ? rest[i + 1] : undefined
}

const fontFaces = (dir) => {
  if (!dir) return ''
  const face = (family, file, wt) => {
    const path = `${dir}/${file}`
    if (!existsSync(path)) return ''
    return `@font-face{font-family:'${family}';font-weight:${wt};src:url(data:font/woff2;base64,${readFileSync(path).toString('base64')}) format('woff2')}`
  }
  return (
    [400, 500, 600, 700]
      .map((w) => face('IBM Plex Sans', `ibm-plex-sans-latin-${w}-normal.woff2`, w))
      .join('') +
    [400, 500, 600].map((w) => face('IBM Plex Mono', `ibm-plex-mono-latin-${w}-normal.woff2`, w)).join('')
  )
}

// The screens as an older checkout drew them (`--before <its editor-suite dir>`), for the gallery's before and after.
const beforeScreens = async (dir) => {
  if (!dir) return undefined
  const at = (f) => new URL(f, `file://${resolve(dir)}/`).href
  const { parts: oldParts } = await import(at('../editor-2d/parts.mjs'))
  const { S: oldS } = await import(at('../editor-kit/scene/scene.mjs'))
  const { suiteData: oldData } = await import(at('data.mjs'))
  const { artParts: oldArt, suiteParts: oldSuite } = await import(at('parts.mjs'))
  const { screens: oldScreens } = await import(at('screens.mjs'))
  const p = oldParts(oldS)
  const q = oldSuite(oldS, p, oldData())
  const a = oldArt(oldS, p, q)
  return Object.fromEntries(
    oldScreens.map((s) => [s.id, { w: s.w, h: s.h, html: oldS.toHTML(s.build(oldS, p, q, a)) }]),
  )
}

// Drops comment lines and indentation so a source fits the 50 KB a `use_figma` call carries.
const strip = (t) =>
  t
    .split('\n')
    .map((l) => l.replace(/^\s+/, ''))
    .filter((l) => l && !l.startsWith('//'))
    .join('\n')

// The suite's parts as one script for the Figma side: data, parts, art, then the three constants a screen reads.
const suiteSource = () =>
  strip(
    [
      suiteData.toString(),
      suiteParts.toString(),
      artParts.toString(),
      'const D = suiteData()',
      'const Q = suiteParts(S, P, D)',
      'const A = artParts(S, P, Q)',
    ].join('\n'),
  )
const CHUNK = 38000
const chunks = () => {
  const lines = suiteSource().split('\n')
  const out = ['']
  for (const l of lines) {
    if ((out[out.length - 1] + l).length > CHUNK) out.push('')
    out[out.length - 1] += `${l}\n`
  }
  return out.map((c) => c.slice(0, -1))
}
const hash = (text) => [...text].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 0)

if (cmd === 'list') {
  for (const s of screens) console.log(`${s.id}\t${s.page}\t${s.w}x${s.h}\t${s.name}`)
} else if (cmd === 'screen') {
  const s = byId(rest[0])
  const fonts = arg('--local-fonts')
  const page =
    `<!doctype html><meta charset="utf-8"><style>${S.baseCss}${fontFaces(fonts)}</style>` +
    (fonts ? '' : `<link rel="stylesheet" href="${S.fontsHref}">`) +
    `<div style="position:relative;width:${s.w}px;height:${s.h}px">${html(s)}</div>`
  writeFileSync(rest[1], page)
} else if (cmd === 'html') {
  const fonts = arg('--local-fonts')
  const cards = screens
    .map(
      (s) =>
        `<section data-id="${s.id}" data-w="${s.w}" data-h="${s.h}"><h2>${s.name}</h2><p>${s.note || ''}</p><div class="frame"><div class="stage" style="width:${s.w}px;height:${s.h}px">${html(s)}</div></div></section>`,
    )
    .join('\n')
  writeFileSync(
    rest[0],
    `<!doctype html><meta charset="utf-8"><title>Editor suite mockups</title><style>${S.baseCss}${fontFaces(fonts)}</style>${fonts ? '' : `<link rel="stylesheet" href="${S.fontsHref}">`}${cards}`,
  )
} else if (cmd === 'gallery') {
  writeFileSync(
    rest[0],
    gallery(screens, html, S, {
      pr: arg('--pr'),
      before: await beforeScreens(arg('--before')),
      since: await beforeScreens(arg('--since')),
    }),
  )
} else if (cmd === 'figma-parts') {
  const all = chunks()
  if (rest[0] === 'count') {
    console.log(JSON.stringify(all.map((c) => ({ length: c.length, hash: hash(c) }))))
  } else {
    const n = Number(rest[0] || 1)
    const text = all[n - 1]
    console.log(
      `const page = figma.root.children.find((p) => p.name === '_kit')\nawait figma.setCurrentPageAsync(page)\nawait figma.loadFontAsync({ family: 'Inter', style: 'Regular' })\nconst src = ${JSON.stringify(text)}\nfor (const old of page.children.filter((c) => c.name === 'parts-suite-${n}')) old.remove()\nconst t = figma.createText()\nt.name = 'parts-suite-${n}'\nt.characters = src\nreturn { id: t.id, chunk: ${n}, length: src.length, hash: [...src].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 0) }`,
    )
  }
} else if (cmd === 'figma-collection') {
  // The suite adds one colour per editor and the graph edge colour beside the Editor Kit variables.
  console.log(`const existing = (await figma.variables.getLocalVariableCollectionsAsync()).find((c) => c.name === 'Editor Suite')
const collection = existing || figma.variables.createVariableCollection('Editor Suite')
const made = []
// The async lookup: Figma's dynamic-page mode refuses the synchronous getVariableById.
const vars = []
for (const id of collection.variableIds) vars.push(await figma.variables.getVariableByIdAsync(id))
for (const [name, hex] of ${JSON.stringify(SUITE_TOKENS.map((t) => [`color/${t}`, S.tokens[t]]))}) {
  // Creates a missing variable and resets an existing one's value, so a changed hue (ed/audio) reaches Figma.
  const old = vars.find((v) => v && v.name === name)
  const v = old || figma.variables.createVariable(name, collection, 'COLOR')
  if (!old) v.scopes = ['ALL_FILLS', 'STROKE_COLOR']
  const h = hex.replace('#', '')
  v.setValueForMode(collection.defaultModeId, { r: parseInt(h.slice(0, 2), 16) / 255, g: parseInt(h.slice(2, 4), 16) / 255, b: parseInt(h.slice(4, 6), 16) / 255, a: 1 })
  made.push(old ? name + ' (updated)' : name)
}
return { collection: collection.id, made }`)
} else if (cmd === 'figma') {
  const s = byId(rest[0])
  const x = rest[1] === undefined ? 0 : Number(rest[1])
  const n = chunks().length
  console.log(`const page = figma.root.children.find((p) => p.name === '_kit')
await figma.setCurrentPageAsync(page)
const src = (name) => page.children.find((c) => c.name === name).characters
const suite = ${JSON.stringify(Array.from({ length: n }, (_, i) => i + 1))}.map((i) => src('parts-suite-' + i)).join('\\n')
const { S, R, P, Q, A } = new Function('figma', src('scene-kit') + '\\n' + src('figma-runtime') + '\\nconst S = makeScene()\\nconst R = figmaRuntime(figma, S)\\n' + src('parts-2d') + '\\n' + suite + '\\nreturn { S, R, P, Q, A }')(figma)
const build = ${strip(s.build.toString())}
return await R.render(build(S, P, Q, A), ${JSON.stringify({ page: s.page, x, replace: true })})`)
} else {
  console.error(
    'usage: build.mjs list | screen <id> <out> | html <out> | gallery <out> | figma-parts [n|count] | figma-collection | figma <id> [x]',
  )
  process.exit(1)
}
