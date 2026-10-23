// Renders a scene tree (see scene.mjs) to Figma frames through the Plugin API.
//
// The runtime is a plain function so it can be stringified and pasted into a `use_figma` call:
//   import { callFor } from './figma.mjs'
//   console.log(callFor(tree, { page: '3D · Screens', x: 0, y: 0 }))   // paste the output as `code`
// See README.md for the install-once workflow that keeps big screens out of every call.

import { makeScene } from './scene.mjs'

export function figmaRuntime(figma, S) {
  const warnings = []
  let vars = new Map()
  let styles = new Map()
  const fonts = new Set()
  let count = 0

  const weightStyle = (wt) =>
    ({ 400: 'Regular', 500: 'Medium', 600: 'SemiBold', 700: 'Bold' })[wt] || 'Regular'
  const fontOf = (t) => ({ family: t.mono ? 'IBM Plex Mono' : 'IBM Plex Sans', style: weightStyle(t.wt) })
  const loadFont = async (font) => {
    const key = `${font.family}/${font.style}`
    if (fonts.has(key)) return
    await figma.loadFontAsync(font)
    fonts.add(key)
  }

  const init = async () => {
    vars = new Map()
    for (const v of await figma.variables.getLocalVariablesAsync()) vars.set(v.name, v)
    styles = new Map()
    for (const s of await figma.getLocalTextStylesAsync()) styles.set(s.name, s)
    for (const wt of [400, 500, 600, 700]) {
      await loadFont(fontOf({ mono: false, wt }))
      if (wt < 700) await loadFont(fontOf({ mono: true, wt }))
    }
  }

  // Bound to the variable "color/<token>" when the token is opaque and the variable exists in the file.
  const paintOf = (spec) => {
    const c = S.resolve(spec)
    if (!c) return null
    let paint = { type: 'SOLID', color: { r: c.r, g: c.g, b: c.b }, opacity: c.a }
    const v = c.token && c.tokenAlpha === 1 ? vars.get(`color/${c.token}`) : null
    if (v) paint = figma.variables.setBoundVariableForPaint(paint, 'color', v)
    else if (c.token) warnings.push(`unbound token ${c.token}`)
    return paint
  }
  const numVar = (token) => (typeof token === 'string' ? vars.get(token) : null)
  const bindNum = (node, field, token) => {
    const v = numVar(token)
    if (v) node.setBoundVariable(field, v)
  }

  const MAIN = { start: 'MIN', center: 'CENTER', end: 'MAX', between: 'SPACE_BETWEEN' }
  const CROSS = { start: 'MIN', center: 'CENTER', end: 'MAX', stretch: 'MIN' }

  const shadowsOf = (sh) =>
    (typeof sh === 'string' ? S.shadows[sh] : sh).map((s) => {
      const c = S.resolve(s.color)
      return {
        type: 'DROP_SHADOW',
        color: { r: c.r, g: c.g, b: c.b, a: c.a },
        offset: { x: s.x, y: s.y },
        radius: s.blur,
        spread: s.spread,
        visible: true,
        blendMode: 'NORMAL',
      }
    })

  // Size and position inside the parent. ctx: { node, lay } of the parent.
  const sizeAndPlace = (node, n, ctx, fallback) => {
    const free = !ctx.lay || n.abs
    if (n.abs && ctx.lay) node.layoutPositioning = 'ABSOLUTE'
    if (free) {
      node.x = n.x || 0
      node.y = n.y || 0
    }
    const pw = ctx.node.width
    const ph = ctx.node.height
    const wNum =
      typeof n.w === 'number' ? n.w : n.w === 'fill' && free ? Math.max(1, pw - (n.x || 0)) : fallback.w
    const hNum =
      typeof n.h === 'number' ? n.h : n.h === 'fill' && free ? Math.max(1, ph - (n.y || 0)) : fallback.h
    if (node.type !== 'TEXT') node.resize(Math.max(0.01, wNum), Math.max(0.01, hNum))
    return { wNum, hNum }
  }
  const applySizing = (node, n, ctx, selfLay) => {
    const inLay = ctx.lay && !n.abs
    if (n.w === 'fill' && inLay) node.layoutSizingHorizontal = 'FILL'
    else if (n.w === 'hug' && (selfLay || node.type === 'TEXT')) node.layoutSizingHorizontal = 'HUG'
    else if (node.type !== 'TEXT') node.layoutSizingHorizontal = 'FIXED'
    if (n.h === 'fill' && inLay) node.layoutSizingVertical = 'FILL'
    else if (n.h === 'hug' && (selfLay || node.type === 'TEXT')) node.layoutSizingVertical = 'HUG'
    else if (node.type !== 'TEXT') node.layoutSizingVertical = 'FIXED'
  }

  const buildFrame = async (n, ctx) => {
    const f = figma.createFrame()
    count++
    f.name = n.name || 'Frame'
    f.fills = n.fill ? [paintOf(n.fill)] : []
    f.clipsContent = !!n.clip
    if (n.stroke) {
      f.strokes = [paintOf(n.stroke)]
      f.strokeWeight = n.sw == null ? 1 : n.sw
      f.strokeAlign = 'INSIDE'
      if (n.dash) f.dashPattern = Array.isArray(n.dash) ? n.dash : [4, 4]
    }
    if (n.r != null) {
      if (Array.isArray(n.r)) {
        const [a, b, c, d] = n.r.map(S.num)
        f.topLeftRadius = a
        f.topRightRadius = b
        f.bottomRightRadius = c
        f.bottomLeftRadius = d
      } else {
        f.cornerRadius = S.num(n.r)
        if (typeof n.r === 'string') {
          for (const field of ['topLeftRadius', 'topRightRadius', 'bottomLeftRadius', 'bottomRightRadius'])
            bindNum(f, field, n.r)
        }
      }
    }
    if (n.shadow) f.effects = shadowsOf(n.shadow)
    if (n.op != null) f.opacity = n.op
    if (n.lay) {
      f.layoutMode = n.lay === 'row' ? 'HORIZONTAL' : 'VERTICAL'
      f.itemSpacing = S.num(n.gap) || 0
      if (typeof n.gap === 'string') bindNum(f, 'itemSpacing', n.gap)
      const [pt, pr, pb, pl] = S.padOf(n.pad)
      f.paddingTop = pt
      f.paddingRight = pr
      f.paddingBottom = pb
      f.paddingLeft = pl
      f.primaryAxisAlignItems = MAIN[n.ax || 'start']
      f.counterAxisAlignItems = CROSS[n.ay || 'start']
    }
    ctx.node.appendChild(f)
    sizeAndPlace(f, n, ctx, { w: 100, h: 100 })
    applySizing(f, n, ctx, !!n.lay)
    const here = { node: f, lay: n.lay || null }
    for (const k of n.c) await build(k, here)
    return f
  }

  const buildText = async (n, ctx) => {
    const t = figma.createText()
    count++
    const style = n.style && !n.size && !n.wt && n.mono == null ? styles.get(n.style) : null
    const spec = S.styleOf(n)
    if (style) await t.setTextStyleIdAsync(style.id)
    else {
      const font = fontOf(spec)
      await loadFont(font)
      t.fontName = font
      t.fontSize = spec.size
      t.lineHeight = { unit: 'PIXELS', value: spec.lh }
      t.letterSpacing = { unit: 'PIXELS', value: spec.ls }
    }
    t.characters = n.s
    t.fills = [paintOf(n.color || 'text/primary')]
    if (n.align) t.textAlignHorizontal = { left: 'LEFT', center: 'CENTER', right: 'RIGHT' }[n.align]
    if (n.up) t.textCase = 'UPPER'
    if (n.op != null) t.opacity = n.op
    t.name = n.name || n.s.slice(0, 40)
    ctx.node.appendChild(t)
    const free = !ctx.lay || n.abs
    if (n.abs && ctx.lay) t.layoutPositioning = 'ABSOLUTE'
    if (free) {
      t.x = n.x || 0
      t.y = n.y || 0
    }
    if (n.w == null || n.w === 'hug') {
      t.textAutoResize = 'WIDTH_AND_HEIGHT'
    } else {
      t.textAutoResize = 'HEIGHT'
      const w = typeof n.w === 'number' ? n.w : free ? Math.max(1, ctx.node.width - (n.x || 0)) : t.width
      t.resize(w, t.height)
      if (n.w === 'fill' && !free) t.layoutSizingHorizontal = 'FILL'
      if (n.trunc) {
        t.textTruncation = 'ENDING'
        t.maxLines = 1
      }
    }
    return t
  }

  const tintAll = (node, spec) => {
    const paint = paintOf(spec)
    const walk = (x) => {
      if ('strokes' in x && x.strokes.length) x.strokes = x.strokes.map(() => paint)
      if ('fills' in x && Array.isArray(x.fills) && x.fills.length) x.fills = x.fills.map(() => paint)
      if ('children' in x) for (const k of x.children) walk(k)
    }
    walk(node)
  }

  const buildVector = async (n, ctx) => {
    const g = figma.createNodeFromSvg(n.svg)
    count++
    g.name = n.name || 'Vector'
    g.fills = []
    g.clipsContent = false
    if (n.tint) tintAll(g, n.tint)
    if (n.op != null) g.opacity = n.op
    ctx.node.appendChild(g)
    const w = typeof n.w === 'number' ? n.w : g.width
    const h = typeof n.h === 'number' ? n.h : g.height
    if (n.abs && ctx.lay) g.layoutPositioning = 'ABSOLUTE'
    if (!ctx.lay || n.abs) {
      g.x = n.x || 0
      g.y = n.y || 0
    }
    g.resize(w, h)
    return g
  }

  const build = async (n, ctx) => {
    try {
      if (n.k === 'f') return await buildFrame(n, ctx)
      if (n.k === 't') return await buildText(n, ctx)
      return await buildVector(n, ctx)
    } catch (e) {
      warnings.push(`${n.name || n.s || n.k}: ${e.message || e}`)
      return null
    }
  }

  // Renders `tree` (a frame with a numeric w and h) onto page `page`. Returns what to check afterwards.
  const render = async (tree, opts = {}) => {
    await init()
    count = 0
    warnings.length = 0
    let page = figma.root.children.find((p) => p.name === opts.page)
    if (!page && opts.page) {
      page = figma.createPage()
      page.name = opts.page
    }
    page = page || figma.currentPage
    await figma.setCurrentPageAsync(page)
    let x = opts.x
    if (x == null) x = page.children.reduce((m, c) => Math.max(m, c.x + c.width), -200) + 200
    if (opts.replace) {
      for (const old of page.children.filter((c) => c.name === tree.name)) old.remove()
    }
    const root = await build({ ...tree, x, y: opts.y || 0 }, { node: page, lay: null })
    return {
      id: root?.id,
      name: root?.name,
      size: root && [root.width, root.height],
      nodes: count,
      warnings: [...new Set(warnings)].slice(0, 20),
    }
  }

  return { render, init, paintOf }
}

// Everything a `use_figma` call needs before it can render: the scene kit and the runtime, as source.
export const prelude = () =>
  `${makeScene.toString()}\n${figmaRuntime.toString()}\nconst S = makeScene()\nconst R = figmaRuntime(figma, S)\n`

// A whole call: render this tree (JSON-embedded) and return the result.
export const callFor = (tree, opts = {}) =>
  `${prelude()}const tree = ${JSON.stringify(tree)}\nreturn await R.render(tree, ${JSON.stringify(opts)})\n`

// Install-once: store the prelude in a text node on page "_kit" so later calls only carry a builder.
export const installCall = () =>
  `const page = figma.root.children.find((p) => p.name === '_kit') || figma.createPage()
page.name = '_kit'
await figma.setCurrentPageAsync(page)
await figma.loadFontAsync({ family: 'Inter', style: 'Regular' })
const src = ${JSON.stringify(prelude())}
for (const old of page.children.filter((c) => c.name === 'scene-kit')) old.remove()
const t = figma.createText()
t.name = 'scene-kit'
t.characters = src
return { id: t.id, chars: src.length }
`

// A call that loads the installed prelude, builds a tree with `builderSource` (a function of S), renders it.
export const runCall = (builderSource, opts = {}) =>
  `const page = figma.root.children.find((p) => p.name === '_kit')
await figma.setCurrentPageAsync(page)
const node = page.children.find((c) => c.name === 'scene-kit')
const { S, R } = new Function('figma', node.characters + '\\nreturn { S, R }')(figma)
const build = ${builderSource}
return await R.render(build(S), ${JSON.stringify(opts)})
`
