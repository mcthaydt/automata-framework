# Scene kit

Write an editor screen once as a small tree, then render it as HTML (artifacts, review) or as Figma frames
(auto-layout, token-bound fills, text styles). Owner: the 3D editor lane (ED3D). Consumed by the 2D lane (ED2D).

- `scene.mjs`: `S` has the builders `F` (frame), `row`, `col`, `spacer`, `T` (text), `V` (raw svg), `I` (icon from
  the shared dictionary, `S.icons`), `alpha(token, a)`, and `S.toHTML(tree)`. `makeScene()` is self-contained, so it
  can be stringified into Figma.
- `figma.mjs`: `figmaRuntime(figma, S).render(tree, { page, x, y, replace })` builds the tree on a Figma page;
  `callFor`, `installCall` and `runCall` return the `code` string for a `use_figma` call.
- `scene.test.mjs`: `node --test docs/design/editor-kit/scene/scene.test.mjs` (a mock Figma runs the runtime).

```js
import { S } from './scene.mjs'
const { F, col, row, T, I, spacer, alpha } = S
const card = F({ name: 'card', w: 320, h: 120, fill: 'bg/surface', r: 'radius/lg', stroke: 'border/default' },
  col({ x: 0, y: 0, w: 'fill', pad: 16, gap: 8 },
    T('Sector hall', { style: 'Title/15' }),
    row({ w: 'fill', gap: 8 }, I('pin', { color: 'layer/entities' }), spacer(), T('0.00 m', { style: 'Mono/12' }))))
```

Rules of the tree:
- Frame props: `name, x, y, w, h` (number, `'fill'` or `'hug'`), `lay` (`'row'`/`'col'`), `gap, pad` (number, `[v, h]` or
  `[t, r, b, l]`), `ax` (`start|center|end|between`), `ay` (`start|center|end`), `fill, stroke, sw, dash, r, clip, op,
  shadow` (`card|pop|sheet`), `abs` (absolute inside an auto-layout parent).
- Without `lay`, children sit at their `x, y`. With `lay`, they flow; `abs: true` takes one out of the flow.
- `'fill'` in an absolute parent means "to the parent's far edge"; in a row or column it shares the space.
- Colours are token names (`'bg/surface'`, the "Editor Kit" collection without its `color/` prefix), hex,
  `rgba(...)`, or `alpha('accent/default', .16)`. Numbers can be `'space/3'`, `'radius/lg'`. `S.defineTokens`
  adds more; Figma binds a token to the variable `color/<token>` when it exists and is opaque.
- Text: `style` is one of `S.text` (`Body/13`, `Label/12`, `Mono/12`, ...) and maps to the Figma text style of the same
  name; `size, wt, mono, ls, lh` override it. `w` wraps; `trunc` ellipsises; `align`, `up`, `color` as expected.
- `V(svg, { w, h, tint })` takes any svg with `width`, `height` and `viewBox`; `tint` rebinds its strokes and fills.

Figma workflow (a `use_figma` call carries at most 50 KB of code, so install once, then render by name):
1. `installCall()` stores the scene kit and runtime as source in text nodes on the page `_kit`. Editors add modules:
   `installCall([{ name: 'views3d', order: 32, fn: makeViews, call: 'makeViews(ctx.S, ctx.data3d)' }], 'none')`
   stores one module, in its own call, named `module:32:views3d`. A module is a function of `ctx` (the scene kit `S` and
   the modules with a lower `order`) and `call` is the expression that runs it. `kit: 'runtime'` refreshes only the
   runtime. Name modules per editor (`screens3d`, `screens2d`) so two editors share one file.
2. The call returns `[name, length, checksum]` for each node it stored. Compare them with `checksum(text)` of the
   source you meant to send, because a source retyped into a call wrongly otherwise shows up as a render error much later.
3. Per screen, `screenCall('split', { page: 'My page', x: 0, y: 0, replace: true }, 'screens3d')` renders
   `ctx.screens3d.split()`. `runCall('(S) => S.F({...})', opts)` renders a one-off builder instead. Keep builders
   self-contained functions of `S`.
4. `render` returns `{ id, nodes, warnings }`. Read the warnings (unbound tokens, failed nodes) and screenshot. A
   token binds only when the file has a variable named `color/<token>`; add one collection per editor for its extras
   (the 3D editor's `Editor 3D` holds `color/ent/*` and `color/view/*`).

Figma quirks the runtime already handles: a variable-bound paint loses its opacity the first time it is assigned
(`assignPaints` assigns twice), a frame with no `w`/`h` in an auto-layout parent hugs its content, and `figma.com`
screenshots are not reachable from the cloud sandbox, so ask `get_screenshot` for the base64 image.

Local preview: `S.toHTML(tree)` is a fragment with inline styles. Add `S.baseCss` and a font link (`S.fontsHref`,
IBM Plex Sans and Mono) around it.
