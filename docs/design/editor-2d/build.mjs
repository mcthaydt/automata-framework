// Renders the 2D editor mockups from one source.
//
//   node build.mjs html <out.html> [--local-fonts <dir>]   every screen at 1:1 in one long page, for screenshots
//   node build.mjs gallery <out.html>                      the review gallery published as an artifact
//   node build.mjs screen <id> <out.html>                  one screen at 1:1, for screenshots
//   node build.mjs figma-parts                             the `use_figma` code that installs parts.mjs on page _kit
//   node build.mjs figma <id>                              the `use_figma` code that renders one screen
//   node build.mjs list
//
// The scene kit lives in ../editor-kit/scene (owned by the 3D editor lane).

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { S } from '../editor-kit/scene/scene.mjs'
import { gallery } from './gallery.mjs'
import { parts } from './parts.mjs'
import { screens } from './screens.mjs'

const [cmd, ...rest] = process.argv.slice(2)
const P = parts(S)
const byId = (id) => {
  const s = screens.find((x) => x.id === id)
  if (!s) throw new Error(`unknown screen "${id}"; have ${screens.map((x) => x.id).join(', ')}`)
  return s
}
const html = (s) => S.toHTML(s.build(S, P))

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
const arg = (name) => {
  const i = rest.indexOf(name)
  return i >= 0 ? rest[i + 1] : undefined
}

if (cmd === 'list') {
  for (const s of screens) console.log(`${s.id}\t${s.page}\t${s.w}x${s.h}\t${s.name}`)
} else if (cmd === 'screen') {
  const s = byId(rest[0])
  const page =
    `<!doctype html><meta charset="utf-8"><style>${S.baseCss}${fontFaces(arg('--local-fonts'))}</style>` +
    (arg('--local-fonts') ? '' : `<link rel="stylesheet" href="${S.fontsHref}">`) +
    `<div style="position:relative;width:${s.w}px;height:${s.h}px">${html(s)}</div>`
  writeFileSync(rest[1], page)
} else if (cmd === 'html') {
  const out = rest[0]
  const cards = screens
    .map(
      (s) =>
        `<section data-id="${s.id}" data-w="${s.w}" data-h="${s.h}"><h2>${s.name}</h2><p>${s.note || ''}</p><div class="frame"><div class="stage" style="width:${s.w}px;height:${s.h}px">${html(s)}</div></div></section>`,
    )
    .join('\n')
  writeFileSync(
    out,
    `<!doctype html><meta charset="utf-8"><title>2D editor mockups</title><style>${S.baseCss}${fontFaces(arg('--local-fonts'))}</style>${arg('--local-fonts') ? '' : `<link rel="stylesheet" href="${S.fontsHref}">`}${cards}`,
  )
} else if (cmd === 'gallery') {
  writeFileSync(rest[0], gallery(screens, html, S))
} else if (cmd === 'figma-parts') {
  // Installed once on page _kit as a text node `parts-2d`; each screen call loads it beside `scene-kit`.
  const src = `${parts.toString()}\nconst P = parts(S)\n`
  const strip = (t) =>
    t
      .split('\n')
      .map((l) => l.replace(/^\s+/, ''))
      .filter((l) => l && !l.startsWith('//'))
      .join('\n')
  const body = strip(src)
  console.log(
    `const page = figma.root.children.find((p) => p.name === '_kit')\nawait figma.setCurrentPageAsync(page)\nawait figma.loadFontAsync({ family: 'Inter', style: 'Regular' })\nconst src = ${JSON.stringify(body)}\nfor (const old of page.children.filter((c) => c.name === 'parts-2d')) old.remove()\nconst t = figma.createText()\nt.name = 'parts-2d'\nt.characters = src\nreturn { id: t.id, chars: src.length }`,
  )
} else if (cmd === 'figma') {
  const s = byId(rest[0])
  const strip = (t) =>
    t
      .split('\n')
      .map((l) => l.replace(/^\s+/, ''))
      .filter((l) => l && !l.startsWith('//'))
      .join('\n')
  const x = rest[1] === undefined ? 0 : Number(rest[1])
  console.log(`const page = figma.root.children.find((p) => p.name === '_kit')
await figma.setCurrentPageAsync(page)
const src = (name) => page.children.find((c) => c.name === name).characters
const { S, R, P } = new Function('figma', src('scene-kit') + '\\n' + src('figma-runtime') + '\\nconst S = makeScene()\\nconst R = figmaRuntime(figma, S)\\n' + src('parts-2d') + '\\nreturn { S, R, P }')(figma)
const build = ${strip(s.build.toString())}
return await R.render(build(S, P), ${JSON.stringify({ page: s.page, x, replace: true })})`)
} else {
  console.error(
    'usage: build.mjs list | html <out> | gallery <out> | screen <id> <out> | figma-parts | figma <id> [x]',
  )
  process.exit(1)
}
