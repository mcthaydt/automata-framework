// The 2D editor's screens in gallery order: the general editor (Home, Level, Tilesets, Entities, World, states),
// the FloorFifty stage profile, and the kit sheet. Each file exports an array of
// `{ id, page, name, w, h, note, build(S, P) }`; the builders are self-contained so build.mjs can render them
// to HTML and to Figma.

import { screens as floorfifty } from './screens-floorfifty.mjs'
import { screens as general } from './screens-general.mjs'

export const screens = [...general, ...floorfifty]

// ── Kit sheet: the tokens and the parts every screen above is made of ──
screens.push({
  id: 'kit',
  page: 'Kit',
  name: 'Kit · colour, type and 2D parts',
  w: 1194,
  h: 1260,
  note: 'The Editor Kit tokens (shared with the 3D editor) and the controls the 2D screens are assembled from. Every touch target is 44 high; the one primary action per screen is 48.',
  build: (S, P) => {
    const {
      D,
      F,
      R,
      C,
      T,
      I,
      V,
      alpha,
      spacer,
      eyebrow,
      label,
      pill,
      btn,
      ib,
      seg,
      field,
      inputBox,
      callout,
      tabs,
      layerRow,
      diagRow,
      dot,
    } = P
    const sec = (title, ...kids) => C({ name: title, w: 'fill', gap: 10 }, eyebrow(title), ...kids)
    const names = Object.keys(S.tokens).filter((n) => n !== 'accent/soft')
    const swatch = (n) =>
      C(
        { name: n, w: 108, gap: 4 },
        F({ w: 108, h: 44, r: 8, fill: n, stroke: 'border/default' }),
        T(n, { style: 'Mono/11', w: 108, trunc: true }),
        T(S.tokens[n], { style: 'Mono/11', color: 'text/faint' }),
      )
    const swatchRows = []
    for (let i = 0; i < names.length; i += 5)
      swatchRows.push(R({ gap: 10, ay: 'start' }, names.slice(i, i + 5).map(swatch)))
    const typeRows = Object.keys(S.text).map((n) =>
      R(
        { name: n, w: 'fill', h: 30, gap: 12 },
        T(n, { style: 'Mono/11', color: 'text/faint', w: 110 }),
        T('Rooftops · cityMid sink 270', { style: n, w: 'fill', trunc: true }),
      ),
    )
    const space = R(
      { gap: 10, ay: 'end' },
      ...['space/1', 'space/2', 'space/3', 'space/4', 'space/5', 'space/6'].map((n) =>
        C(
          { gap: 4, ax: 'center' },
          F({ w: S.num(n), h: S.num(n), fill: 'accent/default', r: 2 }),
          T(n.replace('space/', ''), { style: 'Mono/11', color: 'text/faint' }),
        ),
      ),
    )
    const radii = R(
      { gap: 10, ay: 'end' },
      ...['radius/sm', 'radius/md', 'radius/lg', 'radius/xl'].map((n) =>
        C(
          { gap: 4 },
          F({ w: 44, h: 44, r: n, fill: 'bg/raised', stroke: 'border/strong' }),
          T(`${n.replace('radius/', '')} ${S.num(n)}`, { style: 'Mono/11', color: 'text/faint' }),
        ),
      ),
    )
    const targets = R(
      { gap: 10, ay: 'end' },
      C(
        { gap: 4 },
        F({ w: 44, h: 44, r: 8, fill: alpha('accent/default', 0.16), stroke: 'accent/default' }),
        T('hit 44', { style: 'Mono/11', color: 'text/faint' }),
      ),
      C(
        { gap: 4 },
        F({ w: 48, h: 48, r: 8, fill: 'accent/default' }),
        T('primary 48', { style: 'Mono/11', color: 'text/faint' }),
      ),
    )

    const left = C(
      { x: 32, y: 88, w: 580, gap: 28 },
      sec('Colour', ...swatchRows),
      sec('Type', ...typeRows),
      sec('Space, radius, targets', space, radii, targets),
    )
    const right = C(
      { x: 650, y: 88, w: 512, gap: 24 },
      sec(
        'Buttons',
        R(
          { gap: 8 },
          btn('Export', { kind: 'primary', h: 48, icon: 'download' }),
          btn('Preview', { icon: 'play' }),
          btn('Delete', { kind: 'danger', icon: 'trash' }),
          btn('Cancel', { kind: 'ghost' }),
        ),
      ),
      sec(
        'Icon buttons and pills',
        R(
          { gap: 8 },
          ib('undo'),
          ib('redo', { disabled: true }),
          ib('eye', { on: true }),
          ib('lock'),
          ib('plus'),
          ib('more'),
        ),
        R(
          { gap: 8 },
          pill('FloorFifty stage', { color: 'accent/default' }),
          pill('Valid', { color: 'state/ok', icon: 'check' }),
          pill('1 error', { color: 'state/bad', icon: 'warn' }),
          pill('2 info', { color: 'state/warn', icon: 'info' }),
          pill('city', { color: 'layer/city' }),
        ),
      ),
      sec(
        'Controls',
        seg(['sky', 'city'], 1),
        field('Depth', '0.24'),
        field('Drift', 'sky only', { disabled: true }),
        field('Depth', '0.40', { bad: true }),
        inputBox('world.cityMid', { mono: true, chevron: true }),
        C(
          { w: 'fill', gap: 0 },
          tabs([{ label: 'Layer' }, { label: 'Stage' }, { label: 'Checks', badge: '2' }], 0),
          F({ w: 'fill', h: 1, fill: 'border/default' }),
        ),
      ),
      sec(
        'Layer rows',
        layerRow(D.layers[7], { sel: true }),
        layerRow(D.layers[6], {}),
        layerRow(D.layers[5], { hidden: true }),
        layerRow(D.layers[8], { bad: true }),
      ),
      sec(
        'Messages',
        callout('ok', 'Order valid', 'cityMid sits between cityFar and cityNear.'),
        callout('warn', 'Flash rate', '3.3 a second, over the limit of 3.'),
        callout('bad', 'layerOrder', 'cityMid is nearer than cityNear.'),
        callout('info', 'Unchecked aliases', 'No art manifest is loaded.'),
      ),
    )

    return F(
      { name: 'Kit · colour, type and 2D parts', w: 1194, h: 1260, fill: 'bg/app', clip: true },
      T('Editor Kit · 2D parts', { x: 32, y: 28, style: 'Display/20' }),
      T(
        "Tokens are the Figma variables of the Editor Kit collection; text styles are the file's. Shared with the 3D editor.",
        { x: 32, y: 58, style: 'Body/13', color: 'text/dim' },
      ),
      left,
      right,
    )
  },
})
