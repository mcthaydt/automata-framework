// Parts for the 2D editor mockups: the Rooftops data, components and illustrative art, built from the scene kit `S`.
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
      btn('Preview', { icon: 'play' }),
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
  }
}
