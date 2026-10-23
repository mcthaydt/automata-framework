// Run with: node --test docs/design/editor-kit/scene/scene.test.mjs
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { callFor, figmaRuntime, installCall, prelude, runCall, screenCall } from './figma.mjs'
import { S } from './scene.mjs'

const { F, row, col, T, I, spacer, alpha } = S

const sample = () =>
  F(
    { name: 'sample', w: 400, h: 200, fill: 'bg/app' },
    col(
      {
        name: 'card',
        x: 10,
        y: 10,
        w: 380,
        gap: 8,
        pad: 12,
        fill: 'bg/surface',
        r: 'radius/lg',
        stroke: 'border/default',
      },
      T('Sector hall', { style: 'Title/15' }),
      row(
        { gap: 8, w: 'fill' },
        I('pin', { color: 'layer/entities' }),
        spacer(),
        T('0.00 m', { style: 'Mono/12' }),
      ),
      F({ w: 'fill', h: 40, fill: alpha('accent/default', 0.2), stroke: 'accent/default', dash: true }),
    ),
  )

test('resolve handles tokens, hex, rgba and alpha', () => {
  assert.equal(S.hex6('accent/default'), '#e0a54a')
  assert.equal(S.css('#fff'), 'rgba(255,255,255,1)')
  assert.equal(S.css('rgba(0,0,0,0.5)'), 'rgba(0,0,0,0.5)')
  assert.equal(S.css(alpha('state/ok', 0.5)), 'rgba(111,191,115,0.5)')
  assert.throws(() => S.resolve('nope/nope'), /unknown colour token/)
})

test('toHTML places children by layout and by x, y', () => {
  const html = S.toHTML(sample())
  assert.match(html, /data-name="sample" style="[^"]*width:400px;height:200px/)
  assert.match(html, /flex-direction:column/)
  assert.match(html, /left:10px;top:10px/)
  assert.match(html, /<svg [^>]*>/)
  assert.match(html, /Sector hall/)
  assert.match(html, /outline:1px dashed/)
})

test('toHTML escapes text and rejects unknown icons', () => {
  assert.match(S.toHTML(T('a < b & c')), /a &lt; b &amp; c/)
  assert.throws(() => I('no-such-icon'), /unknown icon/)
})

// A tiny stand-in for the Figma Plugin API: enough to run the runtime end to end and keep it honest.
const mockFigma = () => {
  const make = (type) => {
    const node = {
      type,
      children: [],
      width: 0,
      height: 0,
      x: 0,
      y: 0,
      appendChild(c) {
        c.parent = node
        node.children.push(c)
      },
      resize(w, h) {
        node.width = w
        node.height = h
      },
      remove() {
        node.parent.children.splice(node.parent.children.indexOf(node), 1)
      },
      setBoundVariable() {},
      async setTextStyleIdAsync(id) {
        node.styleId = id
      },
    }
    // Figma resets the opacity of a variable-bound paint the first time it is assigned to a node.
    for (const field of ['fills', 'strokes']) {
      let value = []
      Object.defineProperty(node, field, {
        get: () => value,
        set: (paints) => {
          const before = value
          value = paints.map((p, i) => ({
            ...p,
            opacity: p.boundVariables && !before[i]?.boundVariables ? 1 : p.opacity,
          }))
        },
      })
    }
    if (type === 'TEXT') {
      Object.defineProperty(node, 'characters', {
        get: () => node._c,
        set: (v) => {
          node._c = v
          if (node.textAutoResize === 'WIDTH_AND_HEIGHT' || !node.textAutoResize) {
            node.width = v.length * 7
            node.height = 18
          }
        },
      })
    }
    return node
  }
  const page = { ...make('PAGE'), name: 'Page 1' }
  const fig = {
    root: { children: [page] },
    currentPage: page,
    createFrame: () => make('FRAME'),
    createText: () => make('TEXT'),
    createPage() {
      const p = { ...make('PAGE'), name: 'Page' }
      fig.root.children.push(p)
      return p
    },
    createNodeFromSvg() {
      const g = make('FRAME')
      g.width = 24
      g.height = 24
      const v = make('VECTOR')
      v.strokes = [{ type: 'SOLID' }]
      g.appendChild(v)
      return g
    },
    async setCurrentPageAsync(p) {
      fig.currentPage = p
    },
    async loadFontAsync() {},
    getLocalTextStylesAsync: async () => [
      { name: 'Title/15', id: 'S:1' },
      { name: 'Mono/12', id: 'S:2' },
    ],
    variables: {
      getLocalVariablesAsync: async () => [
        { name: 'color/bg/app', id: 'V:1' },
        { name: 'color/bg/surface', id: 'V:2' },
        { name: 'color/accent/default', id: 'V:3' },
      ],
      setBoundVariableForPaint: (paint, _field, v) => ({ ...paint, boundVariables: { color: v.id } }),
    },
  }
  return fig
}

test('the Figma runtime renders a tree and reports unbound tokens', async () => {
  const fig = mockFigma()
  const R = figmaRuntime(fig, S)
  const out = await R.render(sample(), { page: '3D · Test' })
  assert.equal(out.size[0], 400)
  assert.ok(out.nodes >= 7)
  assert.ok(out.warnings.some((w) => w.includes('unbound token border/default')))
  const page = fig.root.children.find((p) => p.name === '3D · Test')
  const root = page.children[0]
  assert.equal(root.name, 'sample')
  assert.equal(root.fills[0].boundVariables.color, 'V:1')
  const card = root.children[0]
  assert.equal(card.layoutMode, 'VERTICAL')
  assert.equal(card.itemSpacing, 8)
  const title = card.children[0]
  assert.equal(title.styleId, 'S:1')
})

test('a translucent token keeps its opacity once it is bound to a variable', async () => {
  const fig = mockFigma()
  await figmaRuntime(fig, S).render(sample(), { page: 'P' })
  const card = fig.root.children.find((p) => p.name === 'P').children[0].children[0]
  const tint = card.children[2]
  assert.equal(tint.fills[0].boundVariables.color, 'V:3')
  assert.equal(tint.fills[0].opacity, 0.2)
  assert.equal(tint.strokes[0].opacity, 1)
})

test('render replaces a frame of the same name on request', async () => {
  const fig = mockFigma()
  const R = figmaRuntime(fig, S)
  await R.render(sample(), { page: 'P', x: 0 })
  await R.render(sample(), { page: 'P', x: 0, replace: true })
  assert.equal(fig.root.children.find((p) => p.name === 'P').children.length, 1)
})

test('call builders produce runnable, self-contained source', () => {
  for (const src of [
    prelude(),
    callFor(sample()),
    installCall([{ name: 'x', order: 1, fn: () => 1, call: 'x()' }]),
    screenCall('x'),
    runCall('(S) => S.F({ w: 1, h: 1 })'),
  ]) {
    assert.doesNotThrow(() => new Function('figma', `return (async () => {${src}})`))
  }
  assert.match(callFor(sample(), { page: 'x' }), /return await R\.render/)
})
