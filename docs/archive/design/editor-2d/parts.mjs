// Parts for the 2D editor mockups: components shared by every screen, the general editor's art and sample data
// (Mossgate, a platformer; Hollowmere, a top-down RPG), and the FloorFifty profile's Rooftops data and art,
// built from the scene kit `S`.
//
// `parts` is self-contained on purpose (no imports, no outer variables): build.mjs stringifies it so the same
// source runs inside `use_figma`. The art is illustrative: shapes stand in for the production plates, and the
// course geometry is a plausible climb, not the output of FloorFifty's generator (that arrives with ED2D.1).

export function parts(S) {
  const { F, row, col, spacer, T, V, I, alpha } = S

  S.defineIcons({
    grip: '<circle cx="9" cy="6" r="1.3"/><circle cx="15" cy="6" r="1.3"/><circle cx="9" cy="12" r="1.3"/><circle cx="15" cy="12" r="1.3"/><circle cx="9" cy="18" r="1.3"/><circle cx="15" cy="18" r="1.3"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1"/>',
    download: '<path d="M12 4v11M7 11l5 5 5-5M5 20h14"/>',
    file: '<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5"/>',
    brush: '<path d="M18 3l3 3-9 9-3-3z"/><path d="M9 12c-3 0-4 2-4 4 0 2-1 3-2 4 3 1 7 0 7-4"/>',
    eraser: '<path d="M8 20h12M5 15l9-9 5 5-6 6H8z"/><path d="M9 11l5 5"/>',
    bucket:
      '<path d="M5 11l7-7 7 7-7 7z"/><path d="M19 15c1 1.5 1.5 2.5 1.5 3.5a1.5 1.5 0 0 1-3 0c0-1 .5-2 1.5-3.5z"/>',
    pick: '<path d="M14 6l4 4M17 3l4 4-3 3-4-4z"/><path d="M14 8l-9 9-1 4 4-1 9-9"/>',
    rect: '<rect x="4" y="6" width="16" height="12" rx="1"/>',
    stamp: '<path d="M9 10V6a3 3 0 0 1 6 0v4l3 4H6z"/><path d="M5 18h14v3H5z"/>',
    dice: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8.5 8.5v.1M15.5 8.5v.1M12 12v.1M8.5 15.5v.1M15.5 15.5v.1"/>',
    tile: '<path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z"/>',
    slider:
      '<path d="M4 8h10M18 8h2M4 16h2M10 16h10"/><circle cx="16" cy="8" r="2"/><circle cx="8" cy="16" r="2"/>',
    list: '<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/>',
    star: '<path d="M12 4l2.5 5.2 5.7.8-4.1 4 1 5.7L12 17l-5.1 2.7 1-5.7-4.1-4 5.7-.8z"/>',
    save: '<path d="M5 4h12l3 3v13H5z"/><path d="M8 4v6h8V4M8 20v-6h8v6"/>',
    external: '<path d="M14 4h6v6M20 4l-9 9M18 14v6H4V6h6"/>',
    mapPin: '<path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z"/>',
  })

  // ── Data: the shipped Rooftops stage (content/stages/rooftops.toml at the recorded FloorFifty commit) ──
  const D = {
    stage: { id: 'rooftops', name: 'Rooftops', file: 'content/stages/rooftops.toml', seed: 35229 },
    // Back to front, as in the file. The panel shows them front first.
    layers: [
      { a: 'rooftopsSky', plate: 'sky', depth: 0.06, sink: 200, extend: 'plate' },
      { a: 'cloudsHigh', plate: 'sky', depth: 0.06, sink: -330, extend: 'none', drift: 0.8 },
      { a: 'clouds', plate: 'sky', depth: 0.06, sink: -140, extend: 'none', drift: 1.5 },
      { a: 'cloudsLow', plate: 'sky', depth: 0.065, sink: 40, extend: 'none', drift: 2.2 },
      { a: 'birds', plate: 'sky', depth: 0.07, sink: 60, extend: 'none', drift: 0.9 },
      { a: 'rooftopsHorizon', plate: 'city', depth: 0.1, sink: 150, haze: 0.35, extend: 'skirt', arc: 0.05 },
      { a: 'cityFar', plate: 'city', depth: 0.15, sink: 240, haze: 0.25, extend: 'skirt' },
      { a: 'cityMid', plate: 'city', depth: 0.24, sink: 270, haze: 0.125, extend: 'skirt' },
      { a: 'cityNear', plate: 'city', depth: 0.35, sink: 290, haze: 0, extend: 'skirt' },
      { a: 'lanterns', plate: 'city', depth: 0.35, sink: 290, extend: 'tile' },
      { a: 'rooftopDetails', plate: 'city', depth: 0.42, sink: 180, extend: 'none' },
      { a: 'rooftopProps', plate: 'city', depth: 0.42, sink: 180, extend: 'none' },
    ],
    phrases: [
      { name: 'teach', from: 1, to: 5, sink: 0 },
      { name: 'combine', from: 6, to: 11, sink: 40 },
      { name: 'recover', from: 12, to: 15, sink: 120 },
      { name: 'finish', from: 16, to: 19, sink: 560 },
    ],
    extension: [
      [20, 29],
      [30, 39],
      [40, 49],
    ],
    pieces: [
      { floor: 10, kind: 'swarm', hold: 5000, note: 'speed 8 · 3 layers' },
      { floor: 22, kind: 'lightsOut', hold: 6000, note: '' },
      { floor: 34, kind: 'paletteShift', hold: 12000, note: 'mood sunset' },
      { floor: 45, kind: 'skyFlash', hold: 6000, note: '2 flashes · lightning' },
      { floor: 45, kind: 'weatherBurst', hold: 6000, note: 'rain · density 0.7' },
      { floor: 50, kind: 'lightsOut', hold: 4000, note: 'inverted' },
    ],
    kinds: {
      swarm: { icon: 'fly', color: 'layer/tiles' },
      lightsOut: { icon: 'lamp', color: 'layer/city' },
      paletteShift: { icon: 'drop', color: 'accent/default' },
      skyFlash: { icon: 'sparkle', color: 'state/warn' },
      weatherBurst: { icon: 'cloud', color: 'layer/sky' },
    },
    stages: [
      {
        id: 'dawn',
        name: 'Dawn',
        file: 'dawn.toml',
        layers: 3,
        pieces: 3,
        seed: null,
        state: 'ok',
        when: '3 days ago',
      },
      {
        id: 'rooftops',
        name: 'Rooftops',
        file: 'rooftops.toml',
        layers: 12,
        pieces: 6,
        seed: 35229,
        state: 'ok',
        when: '2 min ago',
      },
      {
        id: 'snow-shrine',
        name: 'Snow Shrine',
        file: 'snow-shrine.toml',
        layers: 7,
        pieces: 8,
        seed: 34528,
        state: 'ok',
        when: 'yesterday',
      },
      {
        id: 'sunken-dome',
        name: 'Sunken Dome',
        file: 'sunken-dome.toml',
        layers: 7,
        pieces: 7,
        seed: 107255,
        state: 'ok',
        when: 'yesterday',
      },
    ],
  }
  const phaseColor = (n) => `phase/${n}`

  // ── Small layout helpers: every auto-layout frame states its size, so Figma and HTML agree ──
  const R = (p, ...k) => row({ w: 'hug', h: 'hug', ...p }, ...k)
  const C = (p, ...k) => col({ w: 'hug', h: 'hug', ...p }, ...k)
  const region = (name, x, y, w, h, o, ...kids) =>
    F(
      {
        name,
        x,
        y,
        w,
        h,
        fill: o.fill === undefined ? 'bg/surface' : o.fill,
        lay: o.lay,
        gap: o.gap,
        pad: o.pad,
        ax: o.ax,
        ay: o.ay,
        clip: true,
      },
      ...kids,
    )
  const line = (x, y, w, h, c) => F({ name: 'divider', x, y, w, h, fill: c || 'border/default' })
  const label = (s, o = {}) => T(s, { style: 'Label/12', color: 'text/dim', ...o })
  const eyebrow = (s, o = {}) => T(s, { style: 'Eyebrow/11', color: 'text/dim', up: true, ...o })

  const dot = (c, s = 8) => F({ name: 'dot', w: s, h: s, r: s / 2, fill: c })
  const pill = (text, o = {}) => {
    const c = o.color || 'text/dim'
    return R(
      {
        name: `pill/${text}`,
        h: o.h || 24,
        pad: [0, o.pad == null ? 10 : o.pad],
        gap: 6,
        r: 12,
        fill: o.fill === undefined ? alpha(c, 0.14) : o.fill,
        stroke: o.stroke,
      },
      o.icon && I(o.icon, { size: 14, color: c }),
      o.dot && dot(c, 6),
      T(text, { style: o.mono ? 'Mono/11' : 'Label/12', color: c }),
    )
  }
  const btn = (text, o = {}) => {
    const kind = o.kind || 'secondary'
    const fg = { primary: 'accent/ink', secondary: 'text/primary', ghost: 'text/dim', danger: 'state/bad' }[
      kind
    ]
    return R(
      {
        name: `btn/${text}`,
        w: o.w || 'hug',
        h: o.h || 44,
        pad: [0, o.pad == null ? 16 : o.pad],
        gap: 8,
        ax: 'center',
        r: 'radius/md',
        fill: { primary: 'accent/default', secondary: 'bg/raised', ghost: null, danger: null }[kind],
        stroke: kind === 'secondary' ? 'border/default' : kind === 'danger' ? alpha('state/bad', 0.55) : null,
        op: o.disabled ? 0.4 : undefined,
      },
      o.icon && I(o.icon, { size: 18, color: fg }),
      T(text, { style: 'Body/13 Medium', color: fg }),
    )
  }
  const ib = (name, o = {}) => {
    const s = o.s || 44
    return R(
      {
        name: `ib/${name}`,
        w: s,
        h: o.h || s,
        ax: 'center',
        ay: 'center',
        r: 'radius/md',
        fill: o.on ? alpha('accent/default', 0.16) : o.fill,
        stroke: o.stroke,
        op: o.disabled ? 0.35 : undefined,
      },
      I(name, { size: o.size || 20, color: o.color || (o.on ? 'accent/default' : 'text/dim') }),
    )
  }
  const seg = (opts, sel, o = {}) =>
    R(
      {
        name: 'segmented',
        w: o.w || 'fill',
        h: 44,
        pad: 3,
        gap: 2,
        r: 'radius/md',
        fill: 'bg/field',
        stroke: 'border/default',
        op: o.disabled ? 0.4 : undefined,
      },
      opts.map((t, i) =>
        R(
          {
            name: `seg/${t}`,
            w: 'fill',
            h: 38,
            ax: 'center',
            r: 'radius/sm',
            fill: i === sel ? alpha('accent/default', 0.16) : null,
            stroke: i === sel ? alpha('accent/default', 0.7) : null,
          },
          T(t, { style: 'Label/12', color: i === sel ? 'accent/default' : 'text/dim' }),
        ),
      ),
    )
  const field = (name, value, o = {}) =>
    R(
      { name: `field/${name}`, w: 'fill', h: 44, gap: 8, op: o.disabled ? 0.4 : undefined },
      T(name, { style: 'Label/12', color: o.bad ? 'state/bad' : 'text/dim', w: 84 }),
      R(
        {
          w: 'fill',
          h: 44,
          ax: 'between',
          r: 'radius/md',
          fill: 'bg/field',
          stroke: o.bad ? 'state/bad' : 'border/default',
        },
        ib('minus', { size: 16 }),
        R(
          { gap: 4 },
          T(value, { style: 'Mono/12', color: o.bad ? 'state/bad' : 'text/primary' }),
          o.unit && T(o.unit, { style: 'Mono/11', color: 'text/faint' }),
        ),
        ib('plus', { size: 16 }),
      ),
    )
  const inputBox = (text, o = {}) =>
    R(
      {
        name: 'input',
        w: o.w || 'fill',
        h: o.h || 44,
        pad: [0, 12],
        gap: 8,
        r: 'radius/md',
        fill: 'bg/field',
        stroke: o.bad ? 'state/bad' : 'border/default',
      },
      o.icon && I(o.icon, { size: 16, color: 'text/dim' }),
      T(text, {
        style: o.mono ? 'Mono/12' : 'Body/13',
        color: o.dim ? 'text/dim' : 'text/primary',
        w: 'fill',
        trunc: true,
      }),
      o.chevron && I('chevron-down', { size: 16, color: 'text/dim' }),
    )
  const callout = (kind, title, body, o = {}) => {
    const c = { ok: 'state/ok', warn: 'state/warn', bad: 'state/bad', info: 'layer/sky' }[kind]
    const ic = { ok: 'check', warn: 'warn', bad: 'warn', info: 'info' }[kind]
    return R(
      {
        name: `callout/${kind}`,
        w: 'fill',
        pad: 12,
        gap: 10,
        ay: 'start',
        r: 'radius/md',
        fill: alpha(c, 0.1),
        stroke: alpha(c, 0.4),
      },
      I(ic, { size: 18, color: c }),
      C(
        { w: 'fill', gap: 2 },
        T(title, { style: 'Body/13 Medium', color: c }),
        T(body, { style: 'Label/12', color: 'text/dim', w: 'fill', lh: 17 }),
        o.action,
      ),
    )
  }
  const tabs = (items, active) =>
    R(
      { name: 'tabs', w: 'fill', h: 44 },
      items.map((t, i) =>
        C(
          { name: `tab/${t.label}`, w: 'fill', h: 44, gap: 0 },
          R(
            { w: 'fill', h: 42, ax: 'center', gap: 6 },
            T(t.label, { style: 'Body/13 Medium', color: i === active ? 'text/primary' : 'text/dim' }),
            t.badge && pill(t.badge, { color: t.tone || 'text/dim', h: 20, pad: 7, mono: true }),
          ),
          F({ w: 'fill', h: 2, fill: i === active ? 'accent/default' : null }),
        ),
      ),
    )
  const panelHead = (title, ...right) =>
    R({ name: `head/${title}`, w: 'fill', h: 48, pad: [0, 8, 0, 16] }, eyebrow(title), spacer(), ...right)

  // ── Shell regions (wide: 1194 x 834) ──
  const RAIL = [
    ['layers', 'Compose'],
    ['flag', 'Course'],
    ['sparkle', 'Pieces'],
    ['slider', 'Stage'],
    ['image', 'Assets'],
  ]
  const rail = (h, active, items) =>
    region(
      'rail',
      0,
      52,
      56,
      h,
      { lay: 'col', gap: 4, pad: [8, 0], ay: 'center' },
      (items || RAIL).map(([ic, text], i) =>
        C(
          {
            name: `rail/${text}`,
            w: 56,
            h: 56,
            ax: 'center',
            ay: 'center',
            gap: 2,
            fill: i === active ? alpha('accent/default', 0.13) : null,
          },
          I(ic, { size: 22, color: i === active ? 'accent/default' : 'text/dim' }),
          T(text, { size: 10, wt: 500, color: i === active ? 'accent/default' : 'text/dim' }),
        ),
      ),
    )
  const checksPill = (n, tone) =>
    pill(n, {
      color: tone,
      icon:
        tone === 'state/bad'
          ? 'warn'
          : tone === 'state/warn'
            ? 'warn'
            : tone === 'state/ok'
              ? 'check'
              : 'info',
      h: 32,
      pad: 12,
    })
  const topbar = (w, o = {}) =>
    region(
      'topbar',
      0,
      0,
      w,
      52,
      { lay: 'row', ay: 'center', pad: [0, 8], gap: 8 },
      ib('chevron-left'),
      C(
        { gap: 0 },
        T(o.title || 'Rooftops', { style: 'Title/15' }),
        T(o.file || D.stage.file, { style: 'Mono/11', color: 'text/faint' }),
      ),
      pill(o.kind || 'FloorFifty stage', { color: 'accent/default' }),
      o.status === false
        ? null
        : R(
            { gap: 6 },
            dot(o.dirty ? 'state/warn' : 'state/ok', 6),
            T(o.dirty ? 'Unsaved changes' : 'Autosaved 12:41', { style: 'Mono/11', color: 'text/dim' }),
          ),
      o.center ? [spacer(), o.center, spacer()] : spacer(),
      ib('undo'),
      ib('redo', { disabled: o.noRedo !== false }),
      checksPill(o.checks || '2 info', o.tone || 'text/dim'),
      o.preview === false ? null : btn('Preview', { icon: 'play' }),
      btn('Export', { kind: 'primary', h: 48, icon: 'download' }),
    )

  // ── Layer row (panel, 44 high) ──
  const layerRow = (L, o = {}) =>
    R(
      {
        name: `layer/${L.a}`,
        w: 'fill',
        h: 44,
        pad: [0, 8, 0, 2],
        gap: 4,
        r: 'radius/md',
        fill: o.sel ? alpha('accent/default', 0.12) : null,
        stroke: o.bad ? alpha('state/bad', 0.7) : o.sel ? alpha('accent/default', 0.6) : null,
        op: o.hidden ? 0.5 : undefined,
      },
      R({ w: 20, h: 44, ax: 'center' }, I('grip', { size: 16, color: 'text/faint' })),
      R({ w: 32, h: 44, ax: 'center' }, I(o.hidden ? 'eye-off' : 'eye', { size: 16, color: 'text/dim' })),
      F({
        name: 'swatch',
        w: 18,
        h: 18,
        r: 5,
        fill: L.plate === 'sky' ? alpha('layer/sky', 0.85) : alpha('layer/city', 0.85),
      }),
      C(
        { w: 'fill', gap: 0, name: 'text' },
        T(L.a, {
          style: 'Body/13 Medium',
          w: 'fill',
          trunc: true,
          color: o.bad ? 'state/bad' : 'text/primary',
        }),
        T(`${L.plate} · sink ${L.sink}`, { style: 'Mono/11', color: 'text/dim', w: 'fill', trunc: true }),
      ),
      T(L.depth.toFixed(2), { style: 'Mono/11', color: o.bad ? 'state/bad' : 'text/dim' }),
    )
  const artRow = (icon, title, sub, o = {}) =>
    R(
      {
        name: `art/${title}`,
        w: 'fill',
        h: 44,
        pad: [0, 8, 0, 8],
        gap: 8,
        r: 'radius/md',
        fill: o.sel ? alpha('accent/default', 0.12) : null,
        stroke: o.sel ? alpha('accent/default', 0.6) : null,
      },
      I(icon, { size: 18, color: 'accent/default' }),
      C(
        { w: 'fill', gap: 0 },
        T(title, { style: 'Body/13 Medium' }),
        T(sub, { style: 'Mono/11', color: 'text/dim', w: 'fill', trunc: true }),
      ),
      I('chevron-right', { size: 16, color: 'text/faint' }),
    )

  // ── Illustrative art: the Rooftops dawn, drawn at 270 x 585 and scaled by V ──
  const rng = (seed) => {
    let s = seed >>> 0
    return () => {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0
      return s / 4294967296
    }
  }
  const fx = (n) => +n.toFixed(1)
  const skyline = (seed, base, hMin, hMax, wMin, wMax, fill) => {
    const r = rng(seed)
    const out = []
    const tops = []
    let x = 0
    while (x < 270) {
      const bw = Math.min(wMin + r() * (wMax - wMin), 270 - x)
      const bh = hMin + r() * (hMax - hMin)
      out.push(
        `<rect x="${fx(x)}" y="${fx(base - bh)}" width="${fx(bw + 0.4)}" height="${fx(585 - base + bh)}" fill="${fill}"/>`,
      )
      tops.push([x, bw, base - bh])
      x += bw
    }
    return { svg: out.join(''), tops }
  }
  const cloud = (cx, cy, w, a) =>
    `<g fill="#ffffff" fill-opacity="${a}"><ellipse cx="${cx}" cy="${cy}" rx="${w / 2}" ry="${fx(w * 0.07)}"/><ellipse cx="${fx(cx - w * 0.18)}" cy="${fx(cy - w * 0.05)}" rx="${fx(w * 0.22)}" ry="${fx(w * 0.06)}"/><ellipse cx="${fx(cx + w * 0.2)}" cy="${fx(cy - w * 0.035)}" rx="${fx(w * 0.18)}" ry="${fx(w * 0.05)}"/></g>`
  const bird = (x, y) =>
    `<path d="M0 0q3-3.5 6 0q3-3.5 6 0" transform="translate(${x} ${y})" fill="none" stroke="#2a3552" stroke-opacity=".8" stroke-width="1.2" stroke-linecap="round"/>`

  // o: hide (aliases), dark 0..1 (lightsOut), flash 0..1, rain, mood ('sunset'), course (dashed preview floors), bad (alias drawn out of order)
  const art = (o = {}) => {
    const hide = o.hide || []
    const on = (a) => !hide.includes(a)
    const parts = []
    parts.push(
      '<defs>' +
        '<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4a82d2"/><stop offset=".4" stop-color="#8db4e6"/><stop offset=".66" stop-color="#d8d4dc"/><stop offset=".82" stop-color="#f6c9a4"/><stop offset="1" stop-color="#f8d9b6"/></linearGradient>' +
        '<radialGradient id="sun"><stop offset="0" stop-color="#fff6d6" stop-opacity=".95"/><stop offset=".45" stop-color="#ffe9b0" stop-opacity=".45"/><stop offset="1" stop-color="#ffe9b0" stop-opacity="0"/></radialGradient>' +
        '<linearGradient id="mood" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff7a3c" stop-opacity=".5"/><stop offset="1" stop-color="#b8337a" stop-opacity=".35"/></linearGradient>' +
        '</defs>',
    )
    if (on('rooftopsSky')) parts.push('<rect width="270" height="585" fill="url(#sky)"/>')
    else parts.push('<rect width="270" height="585" fill="#1c1e24"/>')
    if (on('cloudsHigh')) parts.push(cloud(62, 70, 120, 0.55), cloud(205, 108, 96, 0.42))
    if (on('clouds')) parts.push(cloud(128, 160, 150, 0.6), cloud(24, 205, 70, 0.5))
    if (on('cloudsLow')) parts.push(cloud(196, 252, 130, 0.62), cloud(44, 286, 90, 0.5))
    if (on('birds')) parts.push(bird(70, 196), bird(84, 188), bird(96, 200), bird(206, 142))
    parts.push(
      '<circle cx="205" cy="338" r="62" fill="url(#sun)"/><circle cx="205" cy="338" r="17" fill="#fff3c4"/>',
    )
    if (on('rooftopsHorizon')) {
      parts.push('<rect x="0" y="372" width="270" height="213" fill="#a9bbdb"/>')
      parts.push(skyline(11, 372, 6, 20, 8, 20, '#b6c1dc').svg)
      parts.push(
        '<g stroke="#d6e0f2" stroke-opacity=".6" stroke-width="1"><path d="M160 380h30M178 385h40M120 390h22"/></g>',
      )
    }
    if (on('cityFar')) parts.push(skyline(23, 408, 28, 66, 16, 32, '#8f9bbd').svg)
    if (on('cityMid')) parts.push(skyline(37, 446, 38, 92, 18, 36, o.bad ? '#7a6a96' : '#626f9b').svg)
    let near = null
    if (on('cityNear')) {
      near = skyline(51, 498, 48, 118, 24, 46, '#2e3556')
      parts.push(near.svg)
    }
    const windows = () => {
      if (!near) return ''
      const r = rng(9)
      const w = []
      for (const [x, bw, top] of near.tops) {
        for (let wy = top + 12; wy < top + 96 && wy < 585; wy += 11)
          for (let wx = x + 5; wx < x + bw - 5; wx += 8)
            if (r() < 0.42)
              w.push(
                `<rect x="${fx(wx)}" y="${fx(wy)}" width="2.6" height="3.8" fill="#ffd27a" fill-opacity=".9"/>`,
              )
      }
      return w.join('')
    }
    if (near && on('rooftopDetails')) {
      const r = rng(5)
      parts.push(
        '<g stroke="#1d2240" stroke-width="1.2">' +
          near.tops
            .filter(() => r() < 0.55)
            .map(([x, bw, top]) => `<path d="M${fx(x + bw / 2)} ${fx(top)}v-${fx(6 + r() * 9)}"/>`)
            .join('') +
          '</g>',
      )
    }
    if (near && on('rooftopProps')) {
      const r = rng(8)
      parts.push(
        near.tops
          .filter(() => r() < 0.35)
          .map(
            ([x, bw, top]) =>
              `<rect x="${fx(x + bw * 0.25)}" y="${fx(top - 5)}" width="5" height="5" fill="#e07a6a" fill-opacity=".85"/>`,
          )
          .join(''),
      )
    }
    if (on('lanterns')) parts.push(windows())
    if (o.mood === 'sunset') parts.push('<rect width="270" height="585" fill="url(#mood)"/>')
    if (o.tone === 'snow') parts.push('<rect width="270" height="585" fill="#dbe8ff" fill-opacity=".5"/>')
    if (o.tone === 'deep') parts.push('<rect width="270" height="585" fill="#0b4f6e" fill-opacity=".62"/>')
    if (o.dark)
      parts.push(`<rect width="270" height="585" fill="#040612" fill-opacity="${o.dark}"/>`, windows())
    if (o.rain) {
      const r = rng(3)
      let p = ''
      for (let i = 0; i < 46; i++) p += `M${fx(r() * 280)} ${fx(r() * 560)}l-5 16`
      parts.push(
        `<path d="${p}" stroke="#d6e4ff" stroke-opacity=".5" stroke-width="1" stroke-linecap="round" fill="none"/>`,
      )
    }
    if (o.flash) {
      parts.push(
        `<rect width="270" height="585" fill="#ffffff" fill-opacity="${o.flash}"/><path d="M150 0l-18 74l16-4l-24 86" fill="none" stroke="#ffffff" stroke-width="2.2" stroke-linejoin="round"/>`,
      )
    }
    if (o.course) {
      for (const [x, y, w] of [
        [44, 112, 62],
        [150, 178, 58],
        [78, 248, 66],
        [170, 316, 60],
        [60, 392, 64],
      ])
        parts.push(
          `<rect x="${x}" y="${y}" width="${w}" height="7" rx="3" fill="#e0a54a" fill-opacity=".3" stroke="#e0a54a" stroke-width="1.4" stroke-dasharray="4 3"/>`,
        )
      parts.push('<circle cx="132" cy="430" r="6" fill="#e0a54a"/>')
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" width="270" height="585" viewBox="0 0 270 585">${parts.join('')}</svg>`
  }
  // A scene card: the art scaled to w x h and cropped to the view window (vy = top of the window in art units).
  const sceneCard = (w, h, o = {}) => {
    const k = w / 270
    return F(
      {
        name: o.name || 'scene',
        x: o.x,
        y: o.y,
        w,
        h,
        r: o.r == null ? 0 : o.r,
        clip: true,
        fill: 'bg/canvas',
      },
      V(art(o), { name: 'art', x: 0, y: -(o.vy || 0) * k, w, h: 585 * k }),
    )
  }

  // ── Course art: a plausible climb of 20 floors, bars drawn bottom-up ──
  const courseSvg = (w, h, o = {}) => {
    const r = rng(35229)
    const floors = o.floors || 20
    const pitch = (h - 40) / floors
    const out = []
    let x = 0
    const rows = []
    for (let f = 0; f < floors; f++) {
      const phase = f < 1 ? 'teach' : f <= 5 ? 'teach' : f <= 11 ? 'combine' : f <= 15 ? 'recover' : 'finish'
      const step = phase === 'teach' ? 0.28 : phase === 'combine' ? 0.7 : phase === 'recover' ? 0.5 : 0.85
      x = Math.max(-0.78, Math.min(0.78, x + (r() * 2 - 1) * step))
      const moving = f >= 16 && f <= 18
      rows.push({ f, x, bw: 0.17 + r() * 0.05, moving, phase })
    }
    return { rows, pitch }
  }

  // label / value row for summaries
  const kv = (k, v, o = {}) =>
    R(
      { name: `kv/${k}`, w: 'fill', h: o.h || 28, gap: 8 },
      T(k, { style: 'Label/12', color: 'text/dim', w: 96 }),
      T(v, {
        style: o.mono === false ? 'Body/13' : 'Mono/12',
        color: o.color || 'text/primary',
        w: 'fill',
        trunc: true,
      }),
    )
  // one diagnostic in the Checks list
  const diagRow = (d, o = {}) => {
    const c = { error: 'state/bad', warning: 'state/warn', info: 'layer/sky' }[d.sev]
    return C(
      {
        name: `diag/${d.code}`,
        w: 'fill',
        pad: [10, 12],
        gap: 4,
        r: 'radius/md',
        fill: o.sel ? alpha(c, 0.1) : 'bg/field',
        stroke: o.sel ? alpha(c, 0.65) : 'border/default',
      },
      R(
        { w: 'fill', gap: 8 },
        dot(c, 8),
        T(d.code, { style: 'Mono/11', color: c, wt: 600 }),
        spacer(),
        d.fix ? pill('Fix', { color: 'accent/default', h: 22, pad: 9 }) : null,
      ),
      T(d.msg, { style: 'Body/13', w: 'fill', lh: 18 }),
      T(d.path, { style: 'Mono/11', color: 'text/faint', w: 'fill', trunc: true }),
    )
  }

  // modal chrome for the dialog frames
  const dialog = (name, w, h, title, body, footer) =>
    F(
      {
        name,
        w,
        h,
        r: 'radius/xl',
        fill: 'bg/surface',
        stroke: 'border/strong',
        shadow: 'pop',
        lay: 'col',
        clip: true,
      },
      R({ w: 'fill', h: 56, pad: [0, 8, 0, 20] }, T(title, { style: 'Title/15' }), spacer(), ib('close')),
      F({ w: 'fill', h: 1, fill: 'border/default' }),
      C({ w: 'fill', h: 'fill', pad: 20, gap: 12, clip: true }, body),
      F({ w: 'fill', h: 1, fill: 'border/default' }),
      R({ w: 'fill', h: 76, pad: [0, 16], gap: 8, ax: 'end' }, footer),
    )
  // a modal sits on a dimmed copy of the app
  const modalFrame = (name, w, h, dlg) =>
    F(
      { name, w: w + 80, h: h + 80, fill: '#06070a', clip: true },
      F({ name: 'dialog slot', x: 40, y: 40, w, h }, dlg),
    )

  // ── Climb dock (1138 x 148): ruler, phrase bands, set-piece pins, citySink curve, playhead ──
  const FLOORS = 50
  // Track geometry for a dock `w` wide: 88 px of row labels, then 50 floors to 16 px from the edge.
  const track = (w) => ({ x0: 88, w: (w || 1138) - 88 - 16 })
  const tx = (f, w) => {
    const t = track(w)
    return t.x0 + (f / FLOORS) * t.w
  }
  const dock = (o = {}) => {
    const W = o.w || 1138
    const TX = track(W).x0
    const TW = track(W).w
    const tx = (f) => TX + (f / FLOORS) * TW
    const floor = o.floor == null ? 8 : o.floor
    const kids = []
    kids.push(
      R(
        { name: 'dock header', x: 0, y: 0, w: W, h: 44, pad: [0, 16], gap: 10 },
        eyebrow('Climb'),
        T(`Floor ${floor}`, { style: 'Mono/12' }),
        T(`progress ${(floor / FLOORS).toFixed(2)}`, { style: 'Mono/11', color: 'text/dim' }),
        spacer(),
        ib('chevron-left'),
        ib('play', { on: o.playing }),
        ib('chevron-right'),
        o.compact ? null : F({ w: 8, h: 8 }),
        o.compact ? null : T('Race', { style: 'Label/12', color: 'text/dim' }),
        o.compact ? null : seg(['20', '50', '∞'], 1, { w: 156 }),
      ),
    )
    for (let f = 0; f <= FLOORS; f += 5) {
      kids.push(T(String(f), { x: tx(f) - (f < 10 ? 3 : 6), y: 45, style: 'Mono/11', color: 'text/faint' }))
    }
    for (let f = 0; f <= FLOORS; f++)
      kids.push(
        F({ name: 'tick', x: tx(f) - 0.5, y: 60, w: 1, h: f % 5 === 0 ? 5 : 3, fill: 'border/strong' }),
      )
    kids.push(
      T('Phrases', { x: 16, y: 70, style: 'Label/12', color: 'text/dim' }),
      T('Set pieces', { x: 16, y: 100, style: 'Label/12', color: 'text/dim' }),
      T('citySink', { x: 16, y: 126, style: 'Label/12', color: 'text/dim' }),
    )
    for (const p of D.phrases) {
      const x0 = tx(p.from - 0.5)
      const x1 = tx(p.to + 0.5)
      const c = phaseColor(p.name)
      kids.push(
        F(
          {
            name: `phrase/${p.name}`,
            x: x0 + 1,
            y: 66,
            w: x1 - x0 - 2,
            h: 24,
            r: 6,
            fill: alpha(c, o.phrase === p.name ? 0.42 : 0.22),
            stroke: o.phrase === p.name ? c : null,
          },
          F({ x: 0, y: 0, w: 3, h: 24, fill: c }),
          T(x1 - x0 < 100 ? p.name : `${p.name} ${p.from}–${p.to}`, {
            x: 9,
            y: 4,
            size: 11,
            wt: 600,
            color: c,
          }),
        ),
      )
    }
    for (const [a, b] of D.extension) {
      const x0 = tx(a - 0.5)
      const x1 = tx(b + 0.5)
      kids.push(
        F(
          {
            name: `extension/${a}`,
            x: x0 + 1,
            y: 66,
            w: x1 - x0 - 2,
            h: 24,
            r: 6,
            fill: alpha('text/dim', 0.08),
            stroke: 'border/strong',
            dash: [3, 3],
          },
          T(`ext ${a}–${b}`, { x: 9, y: 4, size: 11, wt: 500, color: 'text/faint' }),
        ),
      )
    }
    const at = {}
    D.pieces.forEach((p, i) => {
      at[p.floor] = (at[p.floor] || 0) + 1
      const n = at[p.floor]
      const same = D.pieces.filter((q) => q.floor === p.floor).length
      const k = D.kinds[p.kind]
      const cx = tx(p.floor) + (same > 1 ? (n === 1 ? -13 : 13) : 0)
      const sel = o.piece === i
      kids.push(
        F(
          {
            name: `pin/${p.kind}@${p.floor}`,
            x: cx - 13,
            y: 94,
            w: 26,
            h: 26,
            r: 13,
            fill: sel ? alpha(k.color, 0.3) : 'bg/raised',
            stroke: k.color,
            sw: sel ? 2 : 1,
          },
          I(k.icon, { size: 14, color: k.color, x: 6, y: 6 }),
        ),
      )
    })
    const kn = [
      [0, 0],
      [5, 0],
      [11, 40],
      [15, 120],
      [19, 560],
      [50, 560],
    ]
    const yy = (v) => +(21 - (v / 560) * 19).toFixed(1)
    const pts = kn.map(([f, v]) => `${+((f / FLOORS) * TW).toFixed(1)} ${yy(v)}`)
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="${TW}" height="22" viewBox="0 0 ${TW} 22">` +
      `<path d="M${pts.join('L')}L${TW} 22L0 22Z" fill="#e0a54a" fill-opacity=".13"/>` +
      `<path d="M${pts.join('L')}" fill="none" stroke="#e0a54a" stroke-width="1.6" stroke-linejoin="round"/>` +
      [5, 11, 15, 19]
        .map(
          (f, i) =>
            `<circle cx="${+((f / FLOORS) * TW).toFixed(1)}" cy="${yy([0, 40, 120, 560][i])}" r="2.8" fill="#e0a54a"/>`,
        )
        .join('') +
      '</svg>'
    kids.push(V(svg, { name: 'citySink curve', x: TX, y: 124, w: TW, h: 22 }))
    kids.push(F({ name: 'playhead', x: tx(floor) - 1, y: 44, w: 2, h: 102, fill: 'accent/default' }))
    kids.push(
      F(
        { name: 'playhead handle', x: tx(floor) - 12, y: 44, w: 24, h: 17, r: 8, fill: 'accent/default' },
        T(String(floor), { x: floor < 10 ? 8 : 5, y: 1, style: 'Mono/11', color: 'accent/ink' }),
      ),
    )
    return region(
      'dock',
      o.x == null ? 56 : o.x,
      o.y == null ? 686 : o.y,
      W,
      148,
      { fill: 'bg/surface' },
      line(0, 0, W, 1),
      kids,
    )
  }

  // ══ The general editor: data, shell pieces and illustrative art for the Level, World, Tilesets and Entities screens ══
  // Two reference projects, both illustrative: Mossgate (a platformer) and Hollowmere (a top-down RPG). The same
  // panel, toolbar, palette and inspector build both, which is the point of the screens that use these parts.
  const G = {
    projects: [
      {
        id: 'mossgate',
        name: 'Mossgate',
        kind: 'Platformer',
        file: 'mossgate.af2d.json',
        levels: ['Old Gate', 'Moss Steps', 'Waterwheel', 'Cistern', 'Bell Tower'],
        stats: '5 levels · 4 layers · 6 entities',
        state: 'ok',
        when: '2 min ago',
      },
      {
        id: 'hollowmere',
        name: 'Hollowmere',
        kind: 'Top-down RPG',
        file: 'hollowmere.af2d.json',
        levels: ['Village', 'Inn', 'Cellar', 'Forest path', 'Shrine'],
        stats: '5 maps · 5 layers · 8 entities',
        state: 'warn',
        when: 'yesterday',
      },
      {
        id: 'tile-sketch',
        name: 'Tile sketch',
        kind: 'Blank',
        file: 'tile-sketch.af2d.json',
        levels: ['Room'],
        stats: '1 level · 2 layers · 0 entities',
        state: 'ok',
        when: '3 days ago',
      },
    ],
  }
  const NAV = [
    ['layers', 'Level'],
    ['world', 'World'],
    ['tile', 'Tilesets'],
    ['box', 'Entities'],
    ['check', 'Checks'],
  ]
  const TOOLS = [
    ['cursor', 'Select'],
    ['brush', 'Brush'],
    ['rect', 'Rectangle'],
    ['bucket', 'Fill'],
    ['eraser', 'Eraser'],
    ['pick', 'Picker'],
    ['stamp', 'Stamp'],
    ['dice', 'Random'],
  ]
  S.defineIcons({
    chat: '<path d="M4 5h16v11H9l-5 4z"/>',
    route:
      '<circle cx="6" cy="18" r="2"/><circle cx="18" cy="6" r="2"/><path d="M8 18h6a3 3 0 0 0 0-6h-4a3 3 0 0 1 0-6h6"/>',
    spike: '<path d="M3 20l3-10 3 10zM9 20l3-10 3 10zM15 20l3-10 3 10z"/>',
    heart: '<path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2 4 4 0 0 1 7 2c0 5.5-7 10-7 10z"/>',
    coin: '<circle cx="12" cy="12" r="8"/><path d="M12 8v8M9.5 10.5h4a1.5 1.5 0 0 1 0 3h-3"/>',
    chest: '<rect x="4" y="9" width="16" height="10" rx="1"/><path d="M4 9a8 5 0 0 1 16 0M12 13v2"/>',
    person: '<circle cx="12" cy="8" r="3.5"/><path d="M5 20c0-4 3-6 7-6s7 2 7 6"/>',
    sign: '<path d="M4 5h16v8H4zM12 13v7"/>',
    text: '<path d="M5 6h14M12 6v13M9 19h6"/>',
    hash: '<path d="M9 4l-2 16M17 4l-2 16M4 9h16M3 15h16"/>',
    angle: '<path d="M4 19h16M4 19L16 7M9 19a5 5 0 0 0-2.5-4.3"/>',
    wave: '<path d="M3 9c3-3 6 3 9 0s6 3 9 0M3 15c3-3 6 3 9 0s6 3 9 0"/>',
    bolt: '<path d="M13 3L5 13h6l-1 8 8-10h-6z"/>',
  })

  // ── Shell pieces shared by the general screens ──
  const toolbar = (w, active, o = {}) =>
    region(
      'toolbar',
      0,
      0,
      w,
      52,
      { lay: 'row', ay: 'center', pad: [0, 8], gap: 2, fill: 'bg/surface' },
      TOOLS.map(([ic], i) => ib(ic, { on: i === active })),
      F({ name: 'divider', w: 1, h: 24, fill: 'border/default' }),
      R(
        {
          name: 'brush size',
          h: 36,
          pad: [0, 12],
          gap: 8,
          r: 18,
          fill: 'bg/field',
          stroke: 'border/default',
        },
        T('Size', { style: 'Label/12', color: 'text/dim' }),
        T(o.size || '2', { style: 'Mono/12' }),
      ),
      spacer(),
      o.right,
    )
  const layerRowG = (icon, name, sub, color, o = {}) =>
    R(
      {
        name: `layer/${name}`,
        w: 'fill',
        h: 48,
        pad: [0, 8],
        gap: 8,
        r: 'radius/md',
        fill: o.sel ? alpha('accent/default', 0.12) : null,
        stroke: o.sel ? alpha('accent/default', 0.6) : null,
        op: o.hidden ? 0.5 : undefined,
      },
      I(o.hidden ? 'eye-off' : 'eye', { size: 16, color: 'text/dim' }),
      R({ w: 28, h: 28, ax: 'center', r: 6, fill: alpha(color, 0.2) }, I(icon, { size: 16, color })),
      C(
        { w: 'fill', gap: 0 },
        T(name, { style: 'Body/13 Medium' }),
        T(sub, { style: 'Mono/11', color: 'text/dim', w: 'fill', trunc: true }),
      ),
      I('lock', { size: 14, color: o.locked ? 'accent/default' : 'text/faint' }),
    )
  const valueRow = (v, o = {}) =>
    R(
      {
        name: `value/${v.id}`,
        w: 'fill',
        h: 44,
        pad: [0, 8],
        gap: 10,
        r: 'radius/md',
        fill: o.sel ? alpha('accent/default', 0.12) : null,
        stroke: o.sel ? alpha('accent/default', 0.6) : null,
      },
      F({ name: 'swatch', w: 24, h: 24, r: 6, fill: alpha(v.color, 0.5), stroke: v.color }),
      C(
        { w: 'fill', gap: 0 },
        T(v.id, { style: 'Body/13 Medium' }),
        T(v.sub, { style: 'Mono/11', color: 'text/dim', w: 'fill', trunc: true }),
      ),
      T(String(v.value), { style: 'Mono/12', color: 'text/dim' }),
    )
  const defChip = (d, o = {}) =>
    R(
      {
        name: `def/${d.id}`,
        w: 'fill',
        h: 44,
        pad: [0, 8],
        gap: 8,
        r: 'radius/md',
        fill: o.sel ? alpha('accent/default', 0.12) : 'bg/field',
        stroke: o.sel ? alpha('accent/default', 0.6) : 'border/default',
      },
      R(
        { w: 26, h: 26, ax: 'center', r: 7, fill: alpha(d.color, 0.22) },
        I(d.icon, { size: 15, color: d.color }),
      ),
      T(d.id, {
        style: 'Label/12',
        color: o.sel ? 'accent/default' : 'text/primary',
        w: 'fill',
        trunc: true,
      }),
    )
  const pairs = (list, f) => {
    const out = []
    for (let i = 0; i < list.length; i += 2)
      out.push(R({ w: 'fill', gap: 6 }, f(list[i]), list[i + 1] ? f(list[i + 1]) : F({ w: 'fill', h: 44 })))
    return out
  }
  const fieldRow = (name, node, o = {}) =>
    R(
      { name: `field/${name}`, w: 'fill', h: o.h || 44, gap: 8, ay: o.top ? 'start' : 'center' },
      T(name, { style: 'Label/12', color: o.bad ? 'state/bad' : 'text/dim', w: 84 }),
      node,
    )
  const colorBox = (hex) =>
    R(
      { w: 'fill', h: 44, pad: [0, 12], gap: 10, r: 'radius/md', fill: 'bg/field', stroke: 'border/default' },
      F({ w: 20, h: 20, r: 5, fill: hex }),
      T(hex, { style: 'Mono/12' }),
    )
  const textBox = (text, lines, o = {}) =>
    C(
      {
        w: 'fill',
        h: 14 + lines * 18,
        pad: [8, 12],
        r: 'radius/md',
        fill: 'bg/field',
        stroke: o.bad ? 'state/bad' : 'border/default',
      },
      T(text, { style: 'Body/13', w: 'fill', lh: 18 }),
    )
  // an ordered list of points (a patrol path or a route): numbered rows with a grip
  const pointList = (pts, o = {}) =>
    C(
      { name: 'points', w: 'fill', gap: 4 },
      pts.map((p, i) =>
        R(
          {
            name: `point ${i + 1}`,
            w: 'fill',
            h: 36,
            pad: [0, 8],
            gap: 8,
            r: 'radius/md',
            fill: 'bg/field',
            stroke: o.sel === i ? alpha('accent/default', 0.7) : 'border/default',
          },
          R(
            { w: 22, h: 22, ax: 'center', r: 11, fill: alpha('accent/default', 0.2) },
            T(String(i + 1), { style: 'Mono/11', color: 'accent/default' }),
          ),
          T(`${p[0]}, ${p[1]}`, { style: 'Mono/12', w: 'fill' }),
          I('grip', { size: 14, color: 'text/faint' }),
        ),
      ),
      btn('Add point', { kind: 'ghost', icon: 'plus', h: 36 }),
    )
  const entityHead = (icon, name, color, id, layer) =>
    R(
      { name: 'entity head', w: 'fill', h: 40, gap: 8 },
      R({ w: 32, h: 32, ax: 'center', r: 9, fill: alpha(color, 0.22) }, I(icon, { size: 18, color })),
      C({ gap: 0 }, T(name, { style: 'Title/15' }), T(id, { style: 'Mono/11', color: 'text/faint' })),
      spacer(),
      pill(layer, { color: 'layer/entities' }),
    )
  // the world's levels as cards under the canvas
  const levelDock = (title, sub, names, sel, miniOf, sizes) =>
    region(
      'dock',
      56,
      686,
      1138,
      148,
      { fill: 'bg/surface' },
      line(0, 0, 1138, 1),
      R(
        { x: 0, y: 2, w: 1138, h: 48, pad: [0, 16], gap: 10 },
        eyebrow(title),
        T(sub, { style: 'Mono/11', color: 'text/dim' }),
        spacer(),
        btn('World map', { icon: 'world' }),
      ),
      names.map((n, i) =>
        C(
          {
            name: `level/${n}`,
            x: 16 + i * 176,
            y: 52,
            w: 164,
            h: 88,
            gap: 0,
            r: 'radius/md',
            fill: 'bg/field',
            stroke: i === sel ? 'accent/default' : 'border/default',
            sw: i === sel ? 2 : 1,
            clip: true,
          },
          F({ w: 'fill', h: 56, fill: 'bg/canvas', clip: true }, miniOf(i)),
          R(
            { w: 'fill', h: 32, pad: [0, 10], gap: 6 },
            T(n, { style: 'Label/12' }),
            spacer(),
            T(sizes[i], { style: 'Mono/11', color: 'text/faint' }),
          ),
        ),
      ),
      R(
        {
          name: 'new level',
          x: 16 + names.length * 176,
          y: 52,
          w: 160,
          h: 88,
          ax: 'center',
          gap: 6,
          r: 'radius/md',
          stroke: 'border/strong',
          dash: [4, 4],
        },
        I('plus', { size: 18, color: 'accent/default' }),
        T('New level', { style: 'Label/12', color: 'accent/default' }),
      ),
    )
  // thumbnails for the cards: a platformer step and a top-down map, in a few variants
  const miniPlatform = (i) => [
    F({ x: 0, y: 40, w: 164, h: 16, fill: '#5a4636' }),
    F({ x: 0, y: 38, w: 164, h: 4, fill: '#6fae5b' }),
    F({ x: 20 + i * 9, y: 26, w: 40, h: 6, fill: '#5a4636' }),
    F({ x: 20 + i * 9, y: 24, w: 40, h: 3, fill: '#6fae5b' }),
    F({ x: 94, y: 14 + (i % 2) * 6, w: 36, h: 6, fill: '#5a4636' }),
    F({ x: 94, y: 12 + (i % 2) * 6, w: 36, h: 3, fill: '#6fae5b' }),
  ]
  const miniMap = (i) => [
    F({ w: 164, h: 56, fill: '#4f8a47' }),
    F({ x: 70, y: 22, w: 24, h: 34, fill: '#cfae74' }),
    F({ x: 14 + i * 14, y: 8, w: 48, h: 22, fill: '#b5533c' }),
    F({ x: 14 + i * 14, y: 24, w: 48, h: 8, fill: '#e0d2ae' }),
    F({ x: 120, y: 34, w: 32, h: 16, r: 6, fill: '#3b82c4' }),
  ]

  // ── Platformer art: Moss Steps, 24 x 22 cells at 24 px (drawn at the editor's 150% zoom of 16 px tiles) ──
  const PLAT = { cols: 24, rows: 22, s: 24 }
  const platformerGrid = () => {
    const g = Array.from({ length: PLAT.rows }, () => Array(PLAT.cols).fill(' '))
    const set = (r, c0, c1, ch) => {
      for (let c = c0; c <= c1; c++) g[r][c] = ch
    }
    for (let r = 19; r < PLAT.rows; r++) set(r, 0, PLAT.cols - 1, '#')
    for (let r = 19; r < PLAT.rows; r++) set(r, 9, 12, ' ')
    set(21, 9, 12, '^')
    for (let r = 2; r < 19; r++) set(r, 0, 1, 'S')
    for (const [r, a, b] of [
      [15, 3, 8],
      [16, 3, 8],
      [12, 11, 16],
      [13, 11, 16],
      [6, 5, 10],
      [7, 5, 10],
    ])
      set(r, a, b, '#')
    set(9, 18, 22, '=')
    set(17, 17, 22, '~')
    set(18, 17, 22, '~')
    return g
  }
  const earth = {
    dirt: '#5a4636',
    dirtDark: '#3d2f25',
    stone: '#697386',
    stoneDark: '#4d5666',
    moss: '#6fae5b',
    mossDark: '#4f8a43',
  }
  // one terrain cell at (x, y) of size s; e says which sides are open (the neighbour is not terrain)
  const terrainCell = (x, y, s, e, seed, kind) => {
    const stone = kind === 'stone'
    const k = s / 24
    const r = rng(seed)
    let o = `<rect x="${x}" y="${y}" width="${s}" height="${s}" fill="${stone ? earth.stone : earth.dirt}"/>`
    for (let i = 0; i < 2; i++)
      o += `<rect x="${fx(x + (3 + r() * 14) * k)}" y="${fx(y + (7 + r() * 11) * k)}" width="${fx(4 * k)}" height="${fx(2.5 * k)}" rx="1" fill="${stone ? earth.stoneDark : earth.dirtDark}" fill-opacity=".6"/>`
    const dk = stone ? earth.stoneDark : earth.dirtDark
    if (e.d) o += `<rect x="${x}" y="${fx(y + s - 4 * k)}" width="${s}" height="${fx(4 * k)}" fill="${dk}"/>`
    if (e.l) o += `<rect x="${x}" y="${y}" width="${fx(3 * k)}" height="${s}" fill="${dk}"/>`
    if (e.r) o += `<rect x="${fx(x + s - 3 * k)}" y="${y}" width="${fx(3 * k)}" height="${s}" fill="${dk}"/>`
    if (e.u && !stone)
      o += `<rect x="${x}" y="${y}" width="${s}" height="${fx(7 * k)}" fill="${earth.moss}"/><path d="M${fx(x + 3 * k)} ${fx(y + 7 * k)}v${fx(4 * k)}h${fx(4 * k)}v${fx(-4 * k)}M${fx(x + 14 * k)} ${fx(y + 7 * k)}v${fx(3 * k)}h${fx(5 * k)}v${fx(-3 * k)}" fill="${earth.moss}"/><rect x="${x}" y="${fx(y + 5 * k)}" width="${s}" height="${fx(2 * k)}" fill="${earth.mossDark}"/>`
    if (e.u && stone) o += `<rect x="${x}" y="${y}" width="${s}" height="${fx(4 * k)}" fill="#8791a5"/>`
    return o
  }
  // o.intgrid: draw the Collision IntGrid over the tiles, as the editor does while that layer is selected
  const platformerArt = (o = {}) => {
    const { cols, rows, s } = PLAT
    const g = platformerGrid()
    const solid = (c, r) =>
      c < 0 || c >= cols || r >= rows ? true : r < 0 ? false : g[r][c] === '#' || g[r][c] === 'S'
    const W = cols * s
    const H = rows * s
    let p =
      '<defs><linearGradient id="bgm" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1b2f33"/><stop offset="1" stop-color="#12201f"/></linearGradient></defs>'
    p += `<rect width="${W}" height="${H}" fill="url(#bgm)"/>`
    p +=
      '<g fill="#1f3a3c" fill-opacity=".8"><ellipse cx="150" cy="430" rx="190" ry="120"/><ellipse cx="430" cy="470" rx="170" ry="110"/></g>'
    p +=
      '<g fill="#244648" fill-opacity=".7"><rect x="260" y="40" width="10" height="260"/><rect x="480" y="80" width="14" height="300"/><ellipse cx="265" cy="60" rx="42" ry="22"/><ellipse cx="487" cy="100" rx="52" ry="26"/></g>'
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        const ch = g[r][c]
        const x = c * s
        const y = r * s
        if (ch === '#' || ch === 'S')
          p += terrainCell(
            x,
            y,
            s,
            { u: !solid(c, r - 1), d: !solid(c, r + 1), l: !solid(c - 1, r), r: !solid(c + 1, r) },
            r * 131 + c * 17,
            ch === 'S' ? 'stone' : 'dirt',
          )
        else if (ch === '=')
          p += `<rect x="${x}" y="${y + 2}" width="${s}" height="8" rx="2" fill="#b98b54"/><rect x="${x}" y="${y + 8}" width="${s}" height="2" fill="#8a6234"/><circle cx="${x + 5}" cy="${y + 6}" r="1.2" fill="#6b4a24"/><circle cx="${x + s - 5}" cy="${y + 6}" r="1.2" fill="#6b4a24"/>`
        else if (ch === '^')
          p += `<path d="M${x + 1} ${y + s}l5.500 -13l5.500 13zM${x + 12} ${y + s}l5.500 -13l5.500 13z" fill="#d9645a"/><path d="M${x + 6.5} ${y + s - 13}l-1.500 3M${x + 18} ${y + s - 13}l-1.500 3" stroke="#f3a39b" stroke-width="1.200"/>`
        else if (ch === '~')
          p +=
            `<rect x="${x}" y="${y}" width="${s}" height="${s}" fill="#3b82c4" fill-opacity=".55"/>` +
            (g[r - 1] && g[r - 1][c] === '~'
              ? ''
              : `<path d="M${x} ${y + 4}q6 -4 12 0t12 0" fill="none" stroke="#a9d3f5" stroke-width="1.600"/>`)
      }
    if (o.intgrid) {
      const tint = { '#': '#e0645a', S: '#e0645a', '=': '#e0a54a', '^': '#c04a8a', '~': '#4a9ae0' }
      for (let r = 0; r < rows; r++)
        for (let c = 0; c < cols; c++) {
          const ch = g[r][c]
          if (!tint[ch]) continue
          const h = ch === '=' ? 10 : s
          p += `<rect x="${c * s + 1}" y="${r * s + (ch === '=' ? 1 : 1)}" width="${s - 2}" height="${h - 2}" fill="${tint[ch]}" fill-opacity="${ch === '^' ? 0.5 : 0.32}" stroke="${tint[ch]}" stroke-opacity=".75"/>`
        }
    }
    let gl = ''
    for (let i = 0; i <= cols; i++) gl += `M${i * s} 0V${H}`
    for (let i = 0; i <= rows; i++) gl += `M0 ${i * s}H${W}`
    p += `<path d="${gl}" stroke="#ffffff" stroke-opacity=".06" fill="none"/>`
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${p}</svg>`
  }

  // ── Top-down art: Village, 23 x 22 cells at 24 px ──
  const RPG = { cols: 23, rows: 22, s: 24 }
  const rpgGrid = () => {
    const g = Array.from({ length: RPG.rows }, () => Array(RPG.cols).fill('g'))
    const rect = (c0, r0, c1, r1, ch) => {
      for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) g[r][c] = ch
    }
    rect(2, 2, 6, 5, 'w')
    rect(6, 9, 16, 13, 'p')
    rect(10, 14, 12, 21, 'p')
    rect(17, 7, 17, 8, 'p')
    rect(4, 18, 4, 19, 'p')
    rect(4, 19, 10, 19, 'p')
    rect(14, 2, 20, 4, 'R')
    rect(14, 5, 20, 6, 'W')
    rect(2, 14, 6, 15, 'R')
    rect(2, 16, 6, 17, 'W')
    return g
  }
  const tree = (cx, cy) =>
    `<ellipse cx="${cx}" cy="${cy + 2}" rx="12" ry="5" fill="#000" fill-opacity=".25"/><rect x="${cx - 3}" y="${cy - 8}" width="6" height="11" fill="#6b4a2c"/><circle cx="${cx}" cy="${cy - 16}" r="14" fill="#2f6b3a"/><circle cx="${cx - 4}" cy="${cy - 20}" r="8" fill="#3f8a4a"/>`
  const RPG_TREES = [
    [30, 200],
    [26, 300],
    [196, 76],
    [270, 170],
    [464, 300],
    [500, 380],
    [440, 440],
    [352, 480],
    [28, 470],
    [100, 500],
  ]
  const rpgArt = (o = {}) => {
    const { cols, rows, s } = RPG
    const g = rpgGrid()
    const at = (c, r) => (c < 0 || c >= cols || r < 0 || r >= rows ? 'g' : g[r][c])
    const W = cols * s
    const H = rows * s
    const rr = rng(77)
    let p = ''
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        const ch = g[r][c]
        const x = c * s
        const y = r * s
        if (ch === 'g' || ch === 'p' || ch === 'w') {
          const base = ch === 'g' ? ((c + r) % 2 ? '#4f8a47' : '#55904c') : ch === 'p' ? '#cfae74' : '#3b82c4'
          p += `<rect x="${x}" y="${y}" width="${s}" height="${s}" fill="${base}"/>`
        }
        if (ch === 'g' && rr() < 0.3)
          p += `<path d="M${x + 6 + rr() * 10} ${y + 16}l-2 -5M${x + 9 + rr() * 8} ${y + 16}l1 -6" stroke="#3a7038" stroke-width="1.400" fill="none"/>`
        if (ch === 'p') {
          if (at(c, r - 1) === 'g') p += `<rect x="${x}" y="${y}" width="${s}" height="3" fill="#a8864f"/>`
          if (at(c, r + 1) === 'g')
            p += `<rect x="${x}" y="${y + s - 3}" width="${s}" height="3" fill="#a8864f"/>`
          if (at(c - 1, r) === 'g') p += `<rect x="${x}" y="${y}" width="3" height="${s}" fill="#a8864f"/>`
          if (at(c + 1, r) === 'g')
            p += `<rect x="${x + s - 3}" y="${y}" width="3" height="${s}" fill="#a8864f"/>`
          if (rr() < 0.25)
            p += `<rect x="${x + 5 + rr() * 10}" y="${y + 6 + rr() * 10}" width="3" height="2" fill="#b8955a"/>`
        }
        if (ch === 'w') {
          if (at(c, r - 1) !== 'w') p += `<rect x="${x}" y="${y}" width="${s}" height="3" fill="#8fc3ee"/>`
          if (at(c - 1, r) !== 'w') p += `<rect x="${x}" y="${y}" width="3" height="${s}" fill="#8fc3ee"/>`
          p += `<path d="M${x + 3} ${y + 9}q4 -3 8 0t8 0" fill="none" stroke="#a9d3f5" stroke-width="1.400"/>`
        }
        if (ch === 'R') {
          p += `<rect x="${x}" y="${y}" width="${s}" height="${s}" fill="#b5533c"/><path d="M${x} ${y + 8}H${x + s}M${x} ${y + 16}H${x + s}" stroke="#8f3f2c" stroke-width="1.600"/>`
          if (at(c, r - 1) !== 'R') p += `<rect x="${x}" y="${y}" width="${s}" height="4" fill="#cf6a50"/>`
        }
        if (ch === 'W') {
          p += `<rect x="${x}" y="${y}" width="${s}" height="${s}" fill="#e0d2ae"/>`
          if (at(c, r + 1) !== 'W')
            p += `<rect x="${x}" y="${y + s - 4}" width="${s}" height="4" fill="#b9a97f"/>`
        }
      }
    // windows and the inn door
    for (const [c, r] of [
      [15, 5],
      [19, 5],
      [3, 16],
      [5, 16],
    ])
      p += `<rect x="${c * s + 6}" y="${r * s + 5}" width="12" height="11" rx="1" fill="#2c3b57"/><path d="M${c * s + 12} ${r * s + 5}v11M${c * s + 6} ${r * s + 10.5}h12" stroke="#e0d2ae" stroke-width="1.400"/>`
    p += `<path d="M${17 * s + 3} ${6 * s + s}V${6 * s + 8}a9 9 0 0 1 18 0V${6 * s + s}z" fill="#7a4a2e"/><circle cx="${17 * s + 16}" cy="${6 * s + 16}" r="1.300" fill="#e0a54a"/>`
    // objects layer: trees, free-placed off the grid
    if (!o.hideObjects) for (const [tx, ty] of RPG_TREES) p += tree(tx, ty)
    let gl = ''
    for (let i = 0; i <= cols; i++) gl += `M${i * s} 0V${H}`
    for (let i = 0; i <= rows; i++) gl += `M0 ${i * s}H${W}`
    p += `<path d="${gl}" stroke="#ffffff" stroke-opacity=".07" fill="none"/>`
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${p}</svg>`
  }

  // ── Entity sprites (frames, so they stay editable in Figma) ──
  const sprite = {
    slime: (x, y) =>
      F(
        { name: 'Slime', x, y: y - 17, w: 22, h: 17, r: 9, fill: '#d9645a', stroke: '#8f3a34' },
        F({ x: 5, y: 5, w: 4, h: 4, r: 2, fill: '#fff' }),
        F({ x: 13, y: 5, w: 4, h: 4, r: 2, fill: '#fff' }),
      ),
    player: (x, y) =>
      F(
        { name: 'Player start', x, y: y - 24, w: 16, h: 24, r: 6, fill: '#5fbf7a', stroke: '#2d7a47' },
        F({ x: 9, y: 6, w: 4, h: 4, r: 2, fill: '#fff' }),
      ),
    coin: (x, y) => F({ name: 'Coin', x, y, w: 12, h: 12, r: 6, fill: '#e0a54a', stroke: '#8a5a14' }),
    door: (x, y, h = 44) =>
      F(
        {
          name: 'Door',
          x,
          y: y - h,
          w: 28,
          h,
          r: 4,
          fill: alpha('accent/default', 0.25),
          stroke: 'accent/default',
          sw: 1.5,
        },
        I('door', { size: 14, color: 'accent/default', x: 7, y: h / 2 - 7 }),
      ),
    flag: (x, y) =>
      F(
        { name: 'Checkpoint', x, y: y - 34, w: 22, h: 34 },
        F({ x: 2, y: 0, w: 2, h: 34, fill: '#c9d3e8' }),
        F({ x: 4, y: 2, w: 16, h: 12, r: 2, fill: '#5fbf7a' }),
      ),
    npc: (x, y, c) =>
      F(
        { name: 'NPC', x, y: y - 24, w: 20, h: 24 },
        F({ x: 2, y: 9, w: 16, h: 15, r: 7, fill: c || '#e0a54a', stroke: '#8a5a14' }),
        F({ x: 4, y: 0, w: 12, h: 12, r: 6, fill: '#f1d2a8', stroke: '#8a5a14' }),
      ),
    sign: (x, y) =>
      F(
        { name: 'Sign', x, y: y - 20, w: 22, h: 20 },
        F({ x: 10, y: 8, w: 3, h: 12, fill: '#6b4a2c' }),
        F({ x: 0, y: 0, w: 22, h: 11, r: 2, fill: '#b98b54', stroke: '#6b4a24' }),
      ),
    chest: (x, y) =>
      F(
        { name: 'Chest', x, y: y - 16, w: 24, h: 16, r: 3, fill: '#a8742f', stroke: '#5a3a14' },
        F({ x: 0, y: 6, w: 24, h: 3, fill: '#e0a54a' }),
      ),
  }
  // numbered handles on a dashed path through the given canvas points
  const pathOver = (pts, w, h, color) => [
    V(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><path d="M${pts.map((p) => p.join(' ')).join('L')}" fill="none" stroke="${color}" stroke-width="1.600" stroke-dasharray="5 4" stroke-linejoin="round"/></svg>`,
      { name: 'path', x: 0, y: 0, w, h },
    ),
    ...pts.map(([x, y], i) =>
      F(
        {
          name: `path point ${i + 1}`,
          x: x - 9,
          y: y - 9,
          w: 18,
          h: 18,
          r: 9,
          fill: color,
          stroke: 'bg/canvas',
          sw: 2,
          ax: 'center',
          ay: 'center',
          lay: 'row',
        },
        T(String(i + 1), { style: 'Mono/11', color: 'accent/ink', wt: 700 }),
      ),
    ),
  ]
  // a selection box with four corner handles
  const selection = (x, y, w, h) => [
    F({ name: 'selection', x, y, w, h, stroke: 'accent/default', sw: 1.5, dash: [4, 3] }),
    ...[
      [-4, -4],
      [w - 4, -4],
      [-4, h - 4],
      [w - 4, h - 4],
    ].map(([a, b]) =>
      F({
        name: 'handle',
        x: x + a,
        y: y + b,
        w: 8,
        h: 8,
        fill: 'accent/default',
        stroke: 'bg/canvas',
        sw: 1,
      }),
    ),
  ]
  const chip = (x, y, icon, text, o = {}) =>
    R(
      {
        name: o.name || 'chip',
        x,
        y,
        h: 28,
        pad: [0, 10],
        gap: 8,
        r: 14,
        fill: 'bg/surface',
        stroke: o.accent ? alpha('accent/default', 0.6) : 'border/default',
      },
      I(icon, { size: 14, color: o.accent ? 'accent/default' : 'text/dim' }),
      T(text, { style: 'Mono/11', color: o.accent ? 'accent/default' : 'text/dim' }),
    )

  // ── Tileset art: the placeholder terrain set, 10 x 4 tiles ──
  const TILESET = { cols: 10, rows: 4 }
  const tilesetArt = (s, o = {}) => {
    let p = `<rect width="${TILESET.cols * s}" height="${TILESET.rows * s}" fill="#14161c"/>`
    const tileAt = (i) => [(i % TILESET.cols) * s, Math.floor(i / TILESET.cols) * s]
    for (let i = 0; i < 16; i++) {
      const [x, y] = tileAt(i)
      p += terrainCell(x, y, s, { u: !(i & 1), d: !(i & 2), l: !(i & 4), r: !(i & 8) }, 40 + i, 'dirt')
    }
    for (let i = 0; i < 8; i++) {
      const [x, y] = tileAt(20 + i)
      p += terrainCell(
        x,
        y,
        s,
        { u: !(i & 1), d: !(i & 2), l: !(i & 4), r: !(i & 4 && i & 1) },
        90 + i,
        'stone',
      )
    }
    const k = s / 24
    const extra = [
      (x, y) =>
        `<rect x="${x}" y="${y + 2 * k}" width="${s}" height="${8 * k}" rx="2" fill="#b98b54"/><rect x="${x}" y="${y + 8 * k}" width="${s}" height="${2 * k}" fill="#8a6234"/>`,
      (x, y) =>
        `<rect x="${x + 4 * k}" y="${y + 2 * k}" width="${s - 4 * k}" height="${8 * k}" rx="2" fill="#b98b54"/><rect x="${x + 4 * k}" y="${y + 8 * k}" width="${s - 4 * k}" height="${2 * k}" fill="#8a6234"/>`,
      (x, y) =>
        `<path d="M${x + 2 * k} ${y + s}l${5.5 * k} ${-13 * k}l${5.5 * k} ${13 * k}zM${x + 12 * k} ${y + s}l${5.5 * k} ${-13 * k}l${5.5 * k} ${13 * k}z" fill="#d9645a"/>`,
      (x, y) =>
        `<rect x="${x}" y="${y}" width="${s}" height="${s}" fill="#3b82c4" fill-opacity=".55"/><path d="M${x} ${y + 5 * k}q${6 * k} ${-4 * k} ${12 * k} 0t${12 * k} 0" fill="none" stroke="#a9d3f5" stroke-width="1.600"/>`,
      (x, y) => `<rect x="${x}" y="${y}" width="${s}" height="${s}" fill="#3b82c4" fill-opacity=".55"/>`,
      (x, y) => `<circle cx="${x + s / 2}" cy="${y + s / 2}" r="${7 * k}" fill="#e0a54a" stroke="#8a5a14"/>`,
      (x, y) =>
        `<path d="M${x + 7 * k} ${y}v${s}M${x + s - 7 * k} ${y}v${s}M${x + 7 * k} ${y + 5 * k}h${s - 14 * k}M${x + 7 * k} ${y + 12 * k}h${s - 14 * k}M${x + 7 * k} ${y + 19 * k}h${s - 14 * k}" stroke="#a8742f" stroke-width="${2 * k}" fill="none"/>`,
      (x, y) =>
        `<rect x="${x + 4 * k}" y="${y + 2 * k}" width="${2 * k}" height="${s - 4 * k}" fill="#c9d3e8"/><rect x="${x + 6 * k}" y="${y + 3 * k}" width="${14 * k}" height="${10 * k}" rx="2" fill="#5fbf7a"/>`,
      (x, y) =>
        `<path d="M${x + s / 2} ${y + 3 * k}l${7 * k} ${8 * k}l${-7 * k} ${10 * k}l${-7 * k} ${-10 * k}z" fill="#8f6be0" stroke="#4d3a8a"/>`,
      (x, y) =>
        `<rect x="${x + 3 * k}" y="${y + 3 * k}" width="${s - 6 * k}" height="${s - 6 * k}" rx="4" fill="#2f6b3a"/>`,
    ]
    extra.forEach((f, j) => {
      const [x, y] = tileAt(30 + j)
      p += f(x, y)
    })
    let gl = ''
    for (let i = 0; i <= TILESET.cols; i++) gl += `M${i * s} 0V${TILESET.rows * s}`
    for (let i = 0; i <= TILESET.rows; i++) gl += `M0 ${i * s}H${TILESET.cols * s}`
    p += `<path d="${gl}" stroke="#ffffff" stroke-opacity=".12" fill="none"/>`
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${TILESET.cols * s}" height="${TILESET.rows * s}" viewBox="0 0 ${TILESET.cols * s} ${TILESET.rows * s}">${p}</svg>`
  }
  // an auto-tile preview: a blob of IntGrid cells drawn as the terrain the rules produce, or as the raw IntGrid
  const BLOB = ['.........', '..####...', '.######..', '.######..', '..####.#.', '#########']
  const blobSvg = (s, raw) => {
    const rows = BLOB.length
    const cols = BLOB[0].length
    const solid = (c, r) => (c < 0 || c >= cols || r >= rows ? true : r < 0 ? false : BLOB[r][c] === '#')
    let p = `<rect width="${cols * s}" height="${rows * s}" fill="#14161c"/>`
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        if (!solid(c, r) || BLOB[r][c] !== '#') continue
        if (raw)
          p += `<rect x="${c * s + 1}" y="${r * s + 1}" width="${s - 2}" height="${s - 2}" fill="#e0645a" fill-opacity=".34" stroke="#e0645a" stroke-opacity=".8"/>`
        else
          p += terrainCell(
            c * s,
            r * s,
            s,
            { u: !solid(c, r - 1), d: !solid(c, r + 1), l: !solid(c - 1, r), r: !solid(c + 1, r) },
            r * 131 + c * 17,
            'dirt',
          )
      }
    let gl = ''
    for (let i = 0; i <= cols; i++) gl += `M${i * s} 0V${rows * s}`
    for (let i = 0; i <= rows; i++) gl += `M0 ${i * s}H${cols * s}`
    p += `<path d="${gl}" stroke="#ffffff" stroke-opacity=".08" fill="none"/>`
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${cols * s}" height="${rows * s}" viewBox="0 0 ${cols * s} ${rows * s}">${p}</svg>`
  }
  // a rule's pattern drawn small: cells are 'any' | 'empty' | 'filled' | 'is' | 'not' (the centre is index 4 of 9)
  const patternSvg = (cells, s, plain) => {
    const n = Math.round(Math.sqrt(cells.length))
    let p = ''
    cells.forEach((c, i) => {
      const x = (i % n) * s
      const y = Math.floor(i / n) * s
      const centre = !plain && i === (cells.length - 1) / 2
      if (c === 'filled')
        p += `<rect x="${x + 1}" y="${y + 1}" width="${s - 2}" height="${s - 2}" rx="2" fill="#e0645a" fill-opacity=".45" stroke="#e0645a"/>`
      else if (c === 'empty')
        p += `<rect x="${x + 1}" y="${y + 1}" width="${s - 2}" height="${s - 2}" rx="2" fill="none" stroke="#8e8c85" stroke-dasharray="3 3"/>`
      else if (c === 'not')
        p += `<rect x="${x + 1}" y="${y + 1}" width="${s - 2}" height="${s - 2}" rx="2" fill="#e0645a" fill-opacity=".16" stroke="#e0645a" stroke-opacity=".7"/><path d="M${x + 4} ${y + s - 4}L${x + s - 4} ${y + 4}" stroke="#e8e6e1" stroke-width="2"/>`
      else if (c === 'is')
        p += `<rect x="${x + 1}" y="${y + 1}" width="${s - 2}" height="${s - 2}" rx="2" fill="#4a9ae0" fill-opacity=".45" stroke="#4a9ae0"/>`
      else
        p += `<circle cx="${x + s / 2}" cy="${y + s / 2}" r="${Math.max(1.5, s / 14)}" fill="#8e8c85" fill-opacity=".7"/>`
      if (centre)
        p += `<rect x="${x + 0.5}" y="${y + 0.5}" width="${s - 1}" height="${s - 1}" rx="3" fill="none" stroke="#e0a54a" stroke-width="${s > 30 ? 2 : 1.4}"/>`
    })
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${n * s}" height="${n * s}" viewBox="0 0 ${n * s} ${n * s}">${p}</svg>`
  }

  return {
    dialog,
    modalFrame,
    kv,
    diagRow,
    dock,
    tx,
    track,
    D,
    R,
    C,
    F,
    row,
    col,
    spacer,
    T,
    V,
    I,
    alpha,
    region,
    line,
    label,
    eyebrow,
    dot,
    pill,
    btn,
    ib,
    seg,
    field,
    inputBox,
    callout,
    tabs,
    panelHead,
    rail,
    topbar,
    checksPill,
    layerRow,
    artRow,
    art,
    sceneCard,
    courseSvg,
    rng,
    fx,
    phaseColor,
    RAIL,
    G,
    NAV,
    TOOLS,
    toolbar,
    layerRowG,
    valueRow,
    defChip,
    pairs,
    fieldRow,
    colorBox,
    textBox,
    pointList,
    entityHead,
    levelDock,
    miniPlatform,
    miniMap,
    PLAT,
    RPG,
    RPG_TREES,
    TILESET,
    platformerArt,
    rpgArt,
    sprite,
    pathOver,
    selection,
    chip,
    tilesetArt,
    blobSvg,
    patternSvg,
    terrainCell,
  }
}
