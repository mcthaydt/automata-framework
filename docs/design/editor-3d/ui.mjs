// Widgets and app chrome for the 3D level editor mockups: buttons, chips, fields, the tool rail, top bar,
// inspector sections and the viewport wrappers that put a drawing from views.mjs on screen.
//
// Self-contained on purpose: the Figma kit stringifies makeUi and runs it inside `use_figma`.
// Sizes follow the editor rules: 44 px touch targets, 48 px primary actions, 320 px inspector, 56 px rail (the kit's geometry, ED3D-D12; the first mockups had 296 and 64).

export function makeUi(S, Vw, D) {
  const { F, row, col, spacer, T, I, alpha } = S
  const Vec = S.V
  const AMBER = 'accent/default'
  const W = 1194
  const H = 834
  const TOP = 52
  const STATUS = 32
  const RAIL = 56
  const INSP = 320
  const MID = H - TOP - STATUS

  const dot = (color, size = 8) => F({ name: 'dot', w: size, h: size, r: size / 2, fill: color })
  const divider = (vertical) =>
    F({ name: 'divider', w: vertical ? 1 : 'fill', h: vertical ? 'fill' : 1, fill: 'border/default' })
  const eyebrow = (s, o = {}) => T(s, { style: 'Eyebrow/11', color: 'text/faint', up: true, ...o })
  const mono = (s, o = {}) => T(s, { style: 'Mono/11', color: 'text/dim', ...o })
  const kv = (k, v, o = {}) =>
    row(
      { name: `kv/${k}`, gap: 5 },
      mono(k, { color: 'text/faint' }),
      mono(v, { color: o.color || 'text/primary' }),
    )

  // ── Buttons, chips, controls ──
  const iconBtn = (icon, o = {}) =>
    row(
      {
        name: o.name || `button/${icon}`,
        w: o.w || 44,
        h: o.h || 44,
        ax: 'center',
        r: 'radius/md',
        fill: o.on ? 'accent/soft' : o.fill,
        stroke: o.on ? AMBER : o.stroke,
        op: o.op,
      },
      I(icon, { size: o.size || 22, color: o.on ? AMBER : o.color || 'text/primary' }),
    )
  const button = (label, o = {}) => {
    const primary = o.kind === 'primary'
    const ink = primary ? 'accent/ink' : o.color || 'text/primary'
    return row(
      {
        name: `button/${label}`,
        w: o.w,
        h: o.h || 44,
        pad: [0, 16],
        gap: 8,
        ax: 'center',
        r: 'radius/md',
        fill: primary ? AMBER : o.kind === 'ghost' ? undefined : 'bg/raised',
        stroke: primary ? undefined : 'border/default',
      },
      o.icon ? I(o.icon, { size: 18, color: ink }) : null,
      T(label, { style: 'Body/13 Medium', color: ink }),
    )
  }
  const chip = (label, o = {}) =>
    row(
      {
        name: `chip/${label}`,
        h: o.h || 32,
        pad: [0, 12],
        gap: 6,
        r: 16,
        fill: o.on ? 'accent/soft' : 'bg/raised',
        stroke: o.on ? AMBER : 'border/default',
      },
      o.dot ? dot(o.dot) : null,
      o.icon ? I(o.icon, { size: 16, color: o.on ? AMBER : o.color || 'text/dim' }) : null,
      T(label, { style: o.mono ? 'Mono/11' : 'Label/12', color: o.on ? AMBER : o.color || 'text/primary' }),
    )
  const seg = (items, active, o = {}) =>
    row(
      {
        name: 'segmented',
        w: o.w,
        h: 44,
        pad: 2,
        gap: 2,
        r: 'radius/md',
        fill: 'bg/field',
        stroke: 'border/default',
      },
      items.map(([id, label, icon]) => {
        const on = id === active
        return row(
          {
            name: `segment/${label}`,
            w: o.w ? 'fill' : undefined,
            h: 40,
            pad: [0, o.pad || 14],
            gap: 6,
            ax: 'center',
            r: 6,
            fill: on ? 'accent/soft' : undefined,
            stroke: on ? AMBER : undefined,
          },
          icon ? I(icon, { size: 18, color: on ? AMBER : 'text/dim' }) : null,
          T(label, { style: 'Label/12', color: on ? AMBER : 'text/dim' }),
        )
      }),
    )
  // Value with minus and plus buttons; w is the whole control.
  const stepper = (label, value, unit, w = 128) =>
    col(
      { name: `field/${label}`, w, gap: 4 },
      eyebrow(label),
      row(
        { w, h: 44, r: 'radius/md', fill: 'bg/field', stroke: 'border/default' },
        row({ w: 38, h: 44, ax: 'center' }, I('minus', { size: 16, color: 'text/dim' })),
        row(
          { w: w - 76, h: 44, ax: 'center', gap: 3 },
          T(value, { style: 'Mono/12' }),
          unit ? T(unit, { style: 'Mono/11', color: 'text/faint' }) : null,
        ),
        row({ w: 38, h: 44, ax: 'center' }, I('plus', { size: 16, color: 'text/dim' })),
      ),
    )
  const slider = (label, v, text, w = INSP - 32) =>
    col(
      { name: `slider/${label}`, w, gap: 2 },
      row(
        { w },
        T(label, { style: 'Label/12', color: 'text/dim', w: 'fill' }),
        mono(text, { color: 'text/primary' }),
      ),
      F(
        { name: 'track', w, h: 28 },
        F({ x: 0, y: 11, w, h: 6, r: 3, fill: 'bg/field', stroke: 'border/default' }),
        F({ x: 0, y: 11, w: Math.round(w * v), h: 6, r: 3, fill: AMBER }),
        F({
          x: Math.round((w - 22) * v),
          y: 3,
          w: 22,
          h: 22,
          r: 11,
          fill: 'text/primary',
          stroke: AMBER,
          sw: 2,
        }),
      ),
    )
  const toggle = (label, on, w = INSP - 32) =>
    row(
      { name: `toggle/${label}`, w, h: 44, gap: 8 },
      T(label, { style: 'Body/13', w: 'fill' }),
      row(
        {
          w: 44,
          h: 26,
          r: 13,
          pad: 3,
          ax: on ? 'end' : 'start',
          fill: on ? AMBER : 'bg/field',
          stroke: on ? undefined : 'border/strong',
        },
        F({ w: 20, h: 20, r: 10, fill: on ? 'accent/ink' : 'text/dim' }),
      ),
    )
  const searchField = (text, w) =>
    row(
      {
        name: 'search',
        w,
        h: 44,
        pad: [0, 12],
        gap: 8,
        r: 'radius/md',
        fill: 'bg/field',
        stroke: 'border/default',
      },
      I('search', { size: 18, color: 'text/faint' }),
      T(text, { style: 'Body/13', color: 'text/faint' }),
    )
  const key = (label, o = {}) =>
    row(
      {
        name: `key/${label}`,
        h: 28,
        w: o.w,
        pad: [0, 8],
        ax: 'center',
        r: 6,
        fill: 'bg/field',
        stroke: 'border/strong',
      },
      T(label, { style: 'Mono/11', color: 'text/primary' }),
    )

  // ── Material tiles, drawn in code so the picker shows something real before the game's set is wired in ──
  const rnd = (seed) => {
    let s = seed
    return () => {
      s = (s * 1664525 + 1013904223) >>> 0
      return s / 4294967296
    }
  }
  const MATERIALS = [
    ['plaster-warm', 'plaster', 'wall'],
    ['plaster-green', 'paint', 'wall'],
    ['brick-red', 'brick', 'wall'],
    ['tile-white', 'tile', 'wall'],
    ['concrete', 'concrete', 'wall'],
    ['panel-steel', 'metal', 'wall'],
    ['lino-check', 'lino', 'floor'],
    ['oak-planks', 'wood', 'floor'],
    ['carpet-wine', 'carpet', 'floor'],
    ['grate', 'grate', 'floor'],
    ['glass-pane', 'glass', 'window'],
  ]
  const tileSvg = (kind, s, seed = 1) => {
    const r = rnd(seed * 7919 + s)
    const rect = (x, y, w, h, f) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${f}"/>`
    const specks = (color, n, size = 2) => {
      let d = ''
      for (let i = 0; i < n; i++)
        d += `M${Math.floor(r() * (s - size))} ${Math.floor(r() * (s - size))}h${size}v${size}h-${size}z`
      return `<path d="${d}" fill="${color}"/>`
    }
    const lines = (d, color, w = 1) => `<path d="${d}" stroke="${color}" stroke-width="${w}" fill="none"/>`
    let body = ''
    if (kind === 'plaster') body = rect(0, 0, s, s, '#8f8a7e') + specks('#a39e91', 70) + specks('#78746a', 45)
    else if (kind === 'paint')
      body = rect(0, 0, s, s, '#5f7f73') + specks('#6f9183', 50) + specks('#4f6c61', 30)
    else if (kind === 'concrete')
      body = rect(0, 0, s, s, '#6f7277') + specks('#82868b', 80, 3) + specks('#5c5f64', 60)
    else if (kind === 'carpet')
      body = rect(0, 0, s, s, '#5b3e46') + specks('#74505a', 150) + specks('#47303a', 90)
    else if (kind === 'tile') {
      const n = 4
      const q = s / n
      let d = ''
      for (let i = 1; i < n; i++) d += `M${i * q} 0V${s}M0 ${i * q}H${s}`
      body =
        rect(0, 0, s, s, '#bcc6c6') +
        rect(q, q, q, q, '#aeb9b9') +
        rect(q * 3, q * 2, q, q, '#aeb9b9') +
        lines(d, '#7d8a8b', 1.5)
    } else if (kind === 'brick') {
      const bh = s / 6
      let d = ''
      let b = ''
      for (let j = 0; j < 6; j++) {
        const off = j % 2 ? s / 6 : 0
        d += `M0 ${j * bh}H${s}`
        for (let i = -1; i < 4; i++) {
          const x = i * (s / 3) + off
          d += `M${x} ${j * bh}v${bh}`
          b += rect(
            x + 1,
            j * bh + 1,
            s / 3 - 2,
            bh - 2,
            ['#9a5a45', '#8c5140', '#a66450'][(i + j * 3 + 9) % 3],
          )
        }
      }
      body = rect(0, 0, s, s, '#5d4137') + b + lines(d, '#5d4137', 1.5)
    } else if (kind === 'wood') {
      const n = 5
      const q = s / n
      let d = ''
      let b = ''
      for (let i = 0; i < n; i++) {
        b += rect(i * q, 0, q, s, ['#a07a4c', '#946f43', '#aa8453', '#9a7448', '#a67f50'][i])
        d += `M${i * q} 0V${s}`
        for (let k = 0; k < 3; k++) d += `M${i * q + 4 + k * 6} ${r() * s}v${s * 0.25}`
      }
      body = b + lines(d, '#5f4527', 1)
    } else if (kind === 'lino') {
      const n = 4
      const q = s / n
      let b = rect(0, 0, s, s, '#c9c2a8')
      for (let i = 0; i < n; i++)
        for (let j = 0; j < n; j++) if ((i + j) % 2) b += rect(i * q, j * q, q, q, '#8a8470')
      body = b
    } else if (kind === 'metal') {
      const q = s / 2
      body =
        rect(0, 0, s, s, '#5d6672') +
        lines(`M${q} 0V${s}M0 ${q}H${s}`, '#3d444d', 2) +
        lines(`M3 3H${q - 3}M${q + 3} ${q + 3}H${s - 3}`, '#8a95a3', 1.5) +
        specks('#2f353c', 8, 3)
    } else if (kind === 'glass') {
      body =
        rect(0, 0, s, s, '#2d4a5a') +
        `<path d="M${s * 0.1} ${s}L${s * 0.55} 0H${s * 0.75}L${s * 0.3} ${s}z" fill="#9fd4e6" fill-opacity=".35"/>` +
        lines(`M0 ${s / 2}H${s}M${s / 2} 0V${s}`, '#7fb3c8', 2)
    } else if (kind === 'grate') {
      let d = ''
      for (let i = 1; i < 8; i++) d += `M${(i * s) / 8} 0V${s}M0 ${(i * s) / 8}H${s}`
      body = rect(0, 0, s, s, '#15161a') + lines(d, '#8f9bb3', 2)
    } else body = rect(0, 0, s, s, '#777')
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">${body}</svg>`
  }
  // A framed tile. o.on draws the selection ring, o.name sets a caption under it.
  const tile = (m, size, o = {}) => {
    const [id, kind] = typeof m === 'number' ? MATERIALS[m] : m
    const img = F(
      {
        name: `tile/${id}`,
        w: size,
        h: size,
        r: 6,
        clip: true,
        stroke: o.on ? AMBER : 'border/strong',
        sw: o.on ? 2 : 1,
      },
      Vec(tileSvg(kind, size, id.length), { name: id, w: size, h: size }),
    )
    if (!o.name && !o.label) return img
    return col(
      { name: `swatch/${id}`, w: size, gap: 4 },
      img,
      mono(o.label || id, { color: o.on ? AMBER : 'text/dim', w: size, trunc: true }),
    )
  }

  // ── App chrome ──
  const TOOLS = [
    ['select', 'cursor', 'Select'],
    ['sector', 'polygon', 'Sector'],
    ['vertex', 'vertex', 'Vertex'],
    ['portal', 'portal', 'Portal'],
    ['door', 'door', 'Door'],
    ['window', 'window', 'Window'],
    '-',
    ['prop', 'box', 'Prop'],
    ['hotspot', 'pin', 'Spot'],
    ['lamp', 'lamp', 'Lamp'],
    ['spawn', 'flag', 'Spawn'],
    '-',
    ['nav', 'nav', 'Nav'],
    ['zone', 'camera', 'Zone'],
  ]
  const WALK_TOOLS = [
    ['select', 'cursor', 'Select'],
    ['paint', 'image', 'Paint'],
    ['height', 'arrow-up', 'Height'],
    ['portal', 'portal', 'Portal'],
    ['door', 'door', 'Door'],
    ['window', 'window', 'Window'],
    '-',
    ['prop', 'box', 'Prop'],
    ['lamp', 'lamp', 'Lamp'],
    ['hotspot', 'pin', 'Spot'],
  ]
  const railBtn = (icon, label, on) =>
    col(
      {
        name: `tool/${label}`,
        w: 56,
        h: 48,
        ax: 'center',
        ay: 'center',
        gap: 1,
        r: 'radius/md',
        fill: on ? 'accent/soft' : undefined,
        stroke: on ? AMBER : undefined,
      },
      I(icon, { size: 20, color: on ? AMBER : 'text/primary' }),
      T(label, { style: 'Label/12', size: 11, color: on ? AMBER : 'text/dim' }),
    )
  const toolRail = (h, active, tools = TOOLS) =>
    col(
      { name: 'Tool rail', w: RAIL, h, pad: [10, 0], gap: 4, ay: 'center', fill: 'bg/surface' },
      tools.map((t) =>
        t === '-'
          ? F({ name: 'divider', w: 32, h: 1, fill: 'border/default' })
          : railBtn(t[1], t[2], t[0] === active),
      ),
    )

  const checksPill = (errors, warns) =>
    row(
      {
        name: 'Checks pill',
        h: 36,
        pad: [0, 12],
        gap: 8,
        r: 18,
        fill: 'bg/raised',
        stroke: errors ? 'state/bad' : 'border/default',
      },
      I(errors ? 'warn' : 'check', { size: 16, color: errors ? 'state/bad' : 'state/ok' }),
      T(errors ? `${errors} errors` : 'Checks pass', {
        style: 'Label/12',
        color: errors ? 'state/bad' : 'text/primary',
      }),
      warns ? T(`${warns} warn`, { style: 'Label/12', color: 'state/warn' }) : null,
    )

  // The top bar. o: width, mode ('plan' | 'split' | '3d'), level, errors, warns, compact (portrait: icons only).
  const topBar = (o) =>
    col(
      { name: 'Top bar', w: o.w, h: TOP, fill: 'bg/surface' },
      row(
        { w: o.w, h: TOP - 1, pad: [0, 8], gap: 4 },
        iconBtn('menu', { name: 'button/menu' }),
        row(
          { name: 'Level picker', h: 44, pad: [0, 10], gap: 8, r: 'radius/md' },
          o.compact ? null : T('The Last Light', { style: 'Label/12', color: 'text/faint' }),
          o.compact ? null : I('chevron-right', { size: 14, color: 'text/faint' }),
          T(o.level || 'clinic', { style: 'Title/15' }),
          I('chevron-down', { size: 16, color: 'text/dim' }),
        ),
        o.compact ? null : chip('edit/clinic-ward-door', { mono: true, icon: 'link' }),
        spacer(),
        seg(
          [
            ['plan', 'Plan', 'plan'],
            ['split', 'Split', 'split'],
            ['3d', '3D', 'cube'],
          ],
          o.mode || 'split',
        ),
        spacer(),
        iconBtn('undo'),
        iconBtn('redo', { op: 0.45 }),
        o.compact
          ? iconBtn(o.errors ? 'warn' : 'check', {
              name: 'button/checks',
              color: o.errors ? 'state/bad' : 'state/ok',
            })
          : checksPill(o.errors || 0, o.warns || 0),
        iconBtn('sparkle', { name: 'button/ask', color: AMBER }),
        o.compact
          ? iconBtn('play', { name: 'button/test', fill: AMBER, color: 'accent/ink' })
          : button('Test', { kind: 'primary', icon: 'play' }),
      ),
      divider(false),
    )

  // Build-style readout along the bottom: where the cursor is and what it is over.
  const statusLine = (w, items, hint) =>
    col(
      { name: 'Status line', w, h: STATUS, fill: 'bg/app' },
      divider(false),
      row(
        { w, h: STATUS - 1, pad: [0, 16], gap: 18 },
        items.map(([k, v, c]) => kv(k, v, { color: c })),
        spacer(),
        hint ? T(hint, { style: 'Mono/11', color: 'text/faint' }) : null,
      ),
    )

  // ── Inspector sections ──
  const section = (title, w, ...kids) =>
    col({ name: `section/${title}`, w, pad: [12, 16], gap: 8 }, eyebrow(title), ...kids)
  const inspector = (h, ...kids) =>
    col({ name: 'Inspector', w: INSP, h, fill: 'bg/surface', clip: true }, ...kids)

  const clinicCounts = () => {
    const c = D.scenes.clinic
    return {
      Sectors: c.rooms.length,
      Walls: c.rooms.reduce((n, r) => n + r.pts.length, 0),
      Props: c.boxList.length,
      Hotspots: c.hotspots.length,
      Lamps: c.lampList.length,
      Nav: Object.keys(c.nav.nodes).length,
      Zones: c.zones.length,
    }
  }
  const LAYERS = [
    ['Sectors', 'ent/wall', 'layers'],
    ['Walls', 'ent/portal', 'portal'],
    ['Props', 'ent/box', 'box'],
    ['Hotspots', 'ent/hotspot', 'pin'],
    ['Lamps', 'ent/lamp', 'lamp'],
    ['Nav', 'ent/nav', 'nav'],
    ['Zones', 'ent/zone', 'camera'],
  ]
  // o.active: the layer being edited; o.hidden: layers whose eye is off; o.locked; o.only: names to list
  const layersSection = (o = {}) => {
    const counts = clinicCounts()
    return section(
      'Layers',
      INSP,
      ...LAYERS.filter(([name]) => !o.only || o.only.includes(name)).map(([name, color]) => {
        const hidden = (o.hidden || []).includes(name)
        const on = name === o.active
        return row(
          {
            name: `layer/${name}`,
            w: INSP - 32,
            h: 40,
            pad: [0, 4],
            gap: 8,
            r: 'radius/md',
            fill: on ? 'accent/soft' : undefined,
            op: hidden ? 0.5 : undefined,
          },
          I(hidden ? 'eye-off' : 'eye', { size: 18, color: 'text/dim' }),
          dot(color, 10),
          T(name, { style: 'Label/12', color: on ? AMBER : 'text/primary', w: 'fill' }),
          mono(String(counts[name]), { color: 'text/faint' }),
          I('lock', { size: 14, color: (o.locked || []).includes(name) ? AMBER : 'text/faint' }),
        )
      }),
    )
  }

  // ── Viewports: a drawing from views.mjs inside a clipped frame, with overlay helpers ──
  const TONE = { room: 'text/dim', sel: AMBER, zone: 'ent/zone', ruler: 'text/dim' }
  const labelsOf = (labels) =>
    labels.flatMap((l) => [
      T(l.text, {
        x: l.x,
        y: l.y,
        w: l.w,
        align: l.align || 'center',
        style: l.mono ? 'Mono/11' : 'Label/12',
        color: TONE[l.tone] || 'text/dim',
      }),
      l.sub
        ? T(l.sub, { x: l.x, y: l.y + 15, w: l.w, align: 'center', style: 'Mono/11', color: 'text/faint' })
        : null,
    ])
  const planView = (o, ...overlays) => {
    const p = Vw.plan({ scene: 'clinic', ...o })
    // An overlay is a node, or a function of the drawing (p.X, p.Y map metres to pixels) that returns one.
    const node = F(
      { name: o.name || 'Plan viewport', w: o.w, h: o.h, fill: 'view/plan', clip: true },
      Vec(p.svg, { name: 'plan drawing', w: o.w, h: o.h }),
      labelsOf(p.labels),
      ...overlays.map((v) => (typeof v === 'function' ? v(p) : v)),
    )
    return { node, p }
  }
  const dollView = (o, ...overlays) =>
    F(
      { name: o.name || '3D viewport', w: o.w, h: o.h, fill: 'view/game', clip: true },
      Vec(Vw.doll({ scene: 'clinic', ...o }).svg, { name: 'dollhouse drawing', w: o.w, h: o.h }),
      ...overlays,
    )
  const walkView = (o, ...overlays) =>
    F(
      { name: o.name || '3D viewport', w: o.w, h: o.h, fill: 'view/game', clip: true },
      Vec(Vw.walk({ scene: 'clinic', ...o }).svg, { name: 'first person drawing', w: o.w, h: o.h }),
      ...overlays,
    )

  const floating = (props, ...kids) =>
    row(
      { fill: alpha('bg/surface', 0.94), stroke: 'border/default', r: 'radius/lg', shadow: 'card', ...props },
      ...kids,
    )
  const vpTag = (text, sub, x = 12, y = 12) =>
    row(
      {
        name: 'viewport tag',
        x,
        y,
        h: 28,
        pad: [0, 10],
        gap: 8,
        r: 14,
        fill: alpha('bg/app', 0.82),
        stroke: 'border/default',
      },
      T(text, { style: 'Eyebrow/11', color: 'text/dim', up: true }),
      sub ? mono(sub, { color: 'text/faint' }) : null,
    )
  // Vertical stack of viewport buttons at the top right.
  const vpControls = (w, icons, on = [], y = 12) =>
    floating(
      { name: 'viewport controls', x: w - 12 - 44, y, w: 44, lay: 'col', ay: 'center' },
      icons.map((i) => iconBtn(i, { on: on.includes(i), w: 44, h: 44, size: 20, color: 'text/dim' })),
    )
  const scaleBar = (x, y, px, label) =>
    F(
      { name: 'scale bar', x, y, w: px, h: 22 },
      F({ x: 0, y: 14, w: px, h: 2, fill: 'text/dim' }),
      F({ x: 0, y: 9, w: 2, h: 12, fill: 'text/dim' }),
      F({ x: px - 2, y: 9, w: 2, h: 12, fill: 'text/dim' }),
      mono(label, { x: 0, y: -2, w: px, align: 'center' }),
    )

  return {
    W,
    H,
    TOP,
    STATUS,
    RAIL,
    INSP,
    MID,
    AMBER,
    TOOLS,
    WALK_TOOLS,
    LAYERS,
    MATERIALS,
    dot,
    divider,
    eyebrow,
    mono,
    kv,
    iconBtn,
    button,
    chip,
    seg,
    stepper,
    slider,
    toggle,
    searchField,
    key,
    tileSvg,
    tile,
    toolRail,
    railBtn,
    checksPill,
    topBar,
    statusLine,
    section,
    inspector,
    layersSection,
    clinicCounts,
    planView,
    dollView,
    walkView,
    floating,
    vpTag,
    vpControls,
    scaleBar,
    labelsOf,
  }
}
