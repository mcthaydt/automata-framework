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

Figma workflow (the code limit per call is 50 KB, so install once):
1. `node -e "import('./figma.mjs').then(m => console.log(m.installCall()))"` and run that as a `use_figma` call. It
   stores the kit as source in a text node on the page `_kit`.
2. Per screen, `runCall('(S) => S.F({...})', { page: 'My page', x: 0, replace: true })` loads the kit and renders the
   builder's tree. Keep builders self-contained functions of `S`.
3. `render` returns `{ id, nodes, warnings }`; read the warnings (unbound tokens, failed nodes) and screenshot.

Local preview: `S.toHTML(tree)` is a fragment with inline styles. Add `S.baseCss` and a font link (`S.fontsHref`,
IBM Plex Sans and Mono) around it.
