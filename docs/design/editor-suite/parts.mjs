// Shared parts for the editor suite mockups (sequence, tuner, writer, studio, schematic, audio, feel, shell).
//
// `suiteParts` and `artParts` are self-contained on purpose (no imports, no outer variables): build.mjs stringifies
// them so the same source runs inside `use_figma`. They sit on the scene kit `S` and the 2D editor's parts `P`
// (../editor-2d/parts.mjs), so the suite reads as one family with the level editors.

export function suiteParts(S, P, D) {
  const { F, spacer, T, V, I, alpha } = S
  const { R, C, region, line, eyebrow, dot, pill, btn, ib, inputBox } = P

  // One colour per editor, in the `Editor Suite` collection, so each editor binds its own variable instead of
  // borrowing FloorFifty's layer and phase tokens. The values are the hues the Owner approved, except `ed/audio`: it was
  // `state/warn`'s yellow, so its selections read as warnings (audit M3), and is now a cyan no state colour uses.
  S.defineTokens({
    'ed/sequence': '#a58be0',
    'ed/tuner': '#5aa9a0',
    'ed/writer': '#6aa8e8',
    'ed/studio': '#e07a6a',
    'ed/schematic': '#7e8de0',
    'ed/audio': '#4ec3d6',
    'ed/feel': '#d977b0',
    'ed/levels': '#e0a54a',
    'ed/review': '#6fbf73',
    'edge/default': '#8e8c85',
  })
  S.defineIcons({
    wave: '<path d="M2 12h2.5l2-6 3 12 3-9 2 6 2-3H22"/>',
    chat: '<path d="M4 5h16v11H10l-6 4z"/><path d="M8 9h8M8 12.5h5"/>',
    speaker: '<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 9a4 4 0 0 1 0 6M19 6.5a8 8 0 0 1 0 11"/>',
    film: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 4v16M17 4v16M3 9h4M3 15h4M17 9h4M17 15h4"/>',
    branch:
      '<circle cx="6" cy="5" r="2"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="9" r="2"/><path d="M6 7v10M18 11c0 4-6 3-12 6"/>',
    code: '<path d="M9 7l-5 5 5 5M15 7l5 5-5 5"/>',
    gate: '<path d="M5 21V8l7-4 7 4v13"/><path d="M9 21v-7h6v7"/>',
    person: '<circle cx="12" cy="8" r="3.5"/><path d="M5 20c1-4 4-6 7-6s6 2 7 6"/>',
    bolt: '<path d="M13 3L5 14h6l-1 7 8-11h-6z"/>',
    matrix:
      '<rect x="4" y="4" width="16" height="16" rx="1"/><path d="M4 9.5h16M4 14.5h16M10 4v16M15 4v16"/>',
    heart: '<path d="M12 20s-7-4.5-8.5-9A4.5 4.5 0 0 1 12 7a4.5 4.5 0 0 1 8.5 4c-1.5 4.5-8.5 9-8.5 9z"/>',
    vibrate: '<rect x="8" y="4" width="8" height="16" rx="2"/><path d="M4 8v8M20 8v8M2 10.5v3M22 10.5v3"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    loop: '<path d="M17 4l3 3-3 3"/><path d="M20 7H8a4 4 0 0 0-4 4M7 20l-3-3 3-3"/><path d="M4 17h12a4 4 0 0 0 4-4"/>',
    stop: '<rect x="6" y="6" width="12" height="12" rx="1.5"/>',
    pause: '<path d="M8 5v14M16 5v14"/>',
    'step-back': '<path d="M6 5v14M19 5l-9 7 9 7z"/>',
    'step-fwd': '<path d="M18 5v14M5 5l9 7-9 7z"/>',
    'lock-open': '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 7.5-2"/>',
    diff: '<path d="M12 4v10M7 9h10M7 19h10"/>',
    palette:
      '<path d="M12 3a9 9 0 1 0 0 18c1.5 0 2-1 1.5-2.2-.5-1.2.3-2.3 1.6-2.3H17a4 4 0 0 0 4-4c0-5-4-9.5-9-9.5z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10.5" cy="7" r="1"/><circle cx="15" cy="7.5" r="1"/>',
    shuffle:
      '<path d="M4 7h4c4 0 4 10 8 10h4M4 17h4c1.5 0 2.5-1 3.3-2.3M14.7 9.3C15.5 8 16.5 7 18 7h2"/><path d="M18 4l3 3-3 3M18 14l3 3-3 3"/>',
    book: '<path d="M5 4h10a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/><path d="M5 17a3 3 0 0 1 3-3h10"/>',
    ladder: '<path d="M8 3v18M16 3v18M8 7h8M8 12h8M8 17h8"/>',
    chart: '<path d="M5 20V10M12 20V4M19 20v-7"/>',
    send: '<path d="M4 12l16-8-6 16-3-7z"/>',
    tag: '<path d="M4 4h8l8 8-8 8-8-8z"/><circle cx="8.5" cy="8.5" r="1"/>',
    terminal: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 9l3 3-3 3M12 15h5"/>',
    users:
      '<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 19c.6-3.5 3-5 6-5s5.4 1.5 6 5M15.5 14.3c3 0 4.8 1.4 5.5 4.7"/>',
    sparkles: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/>',
    split2: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 12h18"/>',
    frames:
      '<rect x="3" y="6" width="5" height="12" rx="1"/><rect x="9.5" y="6" width="5" height="12" rx="1"/><rect x="16" y="6" width="5" height="12" rx="1"/>',
    hash: '<path d="M9 4L7 20M17 4l-2 16M4 9h16M3 15h16"/>',
    transfer: '<path d="M7 20V6M3 10l4-4 4 4M17 4v14M13 14l4 4 4-4"/>',
  })

  // One colour and icon per editor, from the `ed/*` tokens above.
  const ED = {
    levels3d: { name: 'Levels 3D', icon: 'cube', color: 'layer/tiles' },
    levels2d: { name: 'Levels 2D', icon: 'tile', color: 'ed/levels' },
    sequence: { name: 'Sequence', icon: 'film', color: 'ed/sequence' },
    tuner: { name: 'Tuner', icon: 'slider', color: 'ed/tuner' },
    writer: { name: 'Writer', icon: 'chat', color: 'ed/writer' },
    studio: { name: 'Studio', icon: 'person', color: 'ed/studio' },
    schematic: { name: 'Schematic', icon: 'nav', color: 'ed/schematic' },
    audio: { name: 'Audio', icon: 'wave', color: 'ed/audio' },
    feel: { name: 'Feel', icon: 'bolt', color: 'ed/feel' },
    review: { name: 'Review', icon: 'check', color: 'ed/review' },
  }

  // The gates a file reopens, read from the game's editor list (D.editors, `content/editors.toml`): the first row whose
  // glob matches the path. A game that lists no gates for a file gets none; the editor never makes one up.
  const globRe = (g) => new RegExp(`^${g.replace(/[.]/g, '\\.').replace(/\*/g, '[^/]*')}$`)
  const fileRow = (path, game = 'The Last Light') =>
    (D.editors[game] || []).find((r) => globRe(r[0]).test(path)) || null
  const gatesFor = (path, game) => {
    const row = fileRow(path, game)
    return row ? row[2] : []
  }

  // The suite rail (56 wide): one entry per editor, the same on every wide screen. `active` is a key of ED.
  const RAIL = ['sequence', 'tuner', 'writer', 'studio', 'schematic', 'audio', 'feel', 'levels2d', 'review']
  const railLabel = {
    sequence: 'Sequence',
    tuner: 'Tuner',
    writer: 'Writer',
    studio: 'Studio',
    schematic: 'Schematic',
    audio: 'Audio',
    feel: 'Feel',
    levels2d: 'Levels',
    review: 'Review',
  }
  const rail = (h, active) =>
    region(
      'rail',
      0,
      52,
      56,
      h,
      { lay: 'col', gap: 2, pad: [8, 0], ay: 'center' },
      RAIL.map((k) => {
        const on = k === active
        const c = ED[k].color
        return C(
          {
            name: `rail/${railLabel[k]}`,
            w: 56,
            h: 56,
            ax: 'center',
            ay: 'center',
            gap: 2,
            fill: on ? alpha(c, 0.14) : null,
          },
          I(ED[k].icon, { size: 22, color: on ? c : 'text/dim' }),
          T(railLabel[k], { size: 10, wt: 500, color: on ? c : 'text/dim' }),
        )
      }),
    )

  // The portrait twin of the rail: a 64 high tab bar with the same nine editors.
  const tabBar = (w, y, active) =>
    region(
      'tab bar',
      0,
      y,
      w,
      64,
      { lay: 'row', fill: 'bg/surface' },
      F({ name: 'divider', abs: true, x: 0, y: 0, w, h: 1, fill: 'border/default' }),
      RAIL.map((k) => {
        const on = k === active
        const c = ED[k].color
        return C(
          {
            name: `tab/${railLabel[k]}`,
            w: 'fill',
            h: 64,
            ax: 'center',
            ay: 'center',
            gap: 2,
            fill: on ? alpha(c, 0.14) : null,
          },
          I(ED[k].icon, { size: 22, color: on ? c : 'text/dim' }),
          T(railLabel[k], { size: 10, wt: 500, color: on ? c : 'text/dim' }),
        )
      }),
    )
  // The compact top bar for portrait: back, document, change set, checks, Ask as an icon, undo, primary action.
  const topP = (w, o = {}) =>
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
        T(o.title || 'Untitled', { style: 'Title/15' }),
        T(o.sub || '', { style: 'Mono/11', color: 'text/faint' }),
      ),
      o.cs === false ? null : csPill(o.cs || 'edit/arrival-timing', o.n == null ? 2 : o.n),
      o.checks === false ? null : P.checksPill(o.checks || 'checks ok', o.tone || 'state/ok'),
      o.gates === undefined ? null : topGates(o),
      spacer(),
      o.mid,
      ib('sparkles', { color: 'ed/feel', fill: alpha('ed/feel', 0.12), stroke: alpha('ed/feel', 0.5) }),
      ib('undo'),
      o.primary === false
        ? null
        : btn(o.primary || 'Ship', { kind: 'primary', h: 48, icon: o.primaryIcon || 'external' }),
    )

  const shell = (name, w, h, ...kids) => F({ name, w, h, fill: 'bg/app', clip: true }, ...kids)
  const mono = (s, o = {}) => T(s, { style: 'Mono/11', color: 'text/dim', ...o })

  // ── Top bar: back, document, editor, change set, checks, gates, Ask, undo, primary action ──
  const csPill = (branch, n) =>
    R(
      { name: 'change set', h: 32, pad: [0, 12], gap: 6, r: 16, fill: 'bg/raised', stroke: 'border/default' },
      I('branch', { size: 14, color: 'text/dim' }),
      T(branch, { style: 'Mono/11', color: 'text/primary' }),
      n ? T(`· ${n}`, { style: 'Mono/11', color: 'accent/default' }) : null,
    )
  const gatePill = (name, state = 'open') => {
    const c = { idle: 'text/dim', open: 'accent/default', ok: 'state/ok', bad: 'state/bad' }[state]
    return pill(name, {
      color: c,
      mono: true,
      h: 28,
      pad: 10,
      icon: state === 'open' ? 'rotate' : state === 'ok' ? 'check' : null,
    })
  }
  const askBtn = (o = {}) =>
    R(
      {
        name: 'ask',
        h: 44,
        pad: [0, 14],
        gap: 8,
        r: 'radius/md',
        fill: alpha('ed/feel', 0.12),
        stroke: alpha('ed/feel', 0.5),
      },
      I('sparkles', { size: 18, color: 'ed/feel' }),
      T('Ask', { style: 'Body/13 Medium', color: 'ed/feel' }),
      o.tokens ? T(o.tokens, { style: 'Mono/11', color: 'text/dim' }) : null,
    )
  // The top bar's gate pills: `o.gates` when given, else the gates the game lists for the open file (`o.sub`). They
  // read `open` when the change set touches the file (`o.reopened`), `idle` otherwise; a game with none says so.
  const topGates = (o) => {
    if (o.gates === false) return null
    const list = o.gates || gatesFor(o.sub || '', o.game).map((g) => [g, o.reopened ? 'open' : 'idle'])
    if (!list.length) return pill('no gates', { color: 'text/faint', mono: true, h: 28, pad: 10 })
    return list.map((g) => gatePill(g[0], g[1]))
  }
  const edPill = (key) => pill(ED[key].name, { color: ED[key].color, icon: ED[key].icon, h: 28 })
  const top = (w, o = {}) =>
    region(
      'topbar',
      0,
      0,
      w,
      52,
      { lay: 'row', ay: 'center', pad: [0, 8], gap: 8 },
      ib(o.menu ? 'menu' : 'chevron-left'),
      C(
        { gap: 0 },
        T(o.title || 'Untitled', { style: 'Title/15' }),
        T(o.sub || '', { style: 'Mono/11', color: 'text/faint' }),
      ),
      o.ed ? edPill(o.ed) : null,
      o.cs === false ? null : csPill(o.cs || 'edit/arrival-timing', o.n == null ? 2 : o.n),
      o.checks === false ? null : P.checksPill(o.checks || 'checks ok', o.tone || 'state/ok'),
      topGates(o),
      spacer(),
      o.mid,
      o.ask === false ? null : askBtn({ tokens: o.tokens || '38k' }),
      ib('undo'),
      ib('redo', { disabled: o.redo !== true }),
      o.primary === false
        ? null
        : btn(o.primary || 'Ship', { kind: 'primary', h: 48, icon: o.primaryIcon || 'external' }),
    )

  // ── Status bar (28 high) ──
  const status = (w, y, left = [], right = []) =>
    region(
      'status',
      0,
      y,
      w,
      28,
      { lay: 'row', ay: 'center', pad: [0, 16], gap: 16 },
      F({ name: 'divider', abs: true, x: 0, y: 0, w, h: 1, fill: 'border/default' }),
      left.map((s) => (typeof s === 'string' ? mono(s) : s)),
      spacer(),
      right.map((s) => (typeof s === 'string' ? mono(s) : s)),
    )

  // ── Lists ──
  const listRow = (o) =>
    R(
      {
        name: `row/${o.title}`,
        w: 'fill',
        h: o.h || 44,
        pad: [0, 10, 0, o.icon || o.lead ? 10 : 12],
        gap: 10,
        r: 'radius/md',
        fill: o.sel ? alpha(o.color || 'accent/default', 0.12) : null,
        stroke: o.sel ? alpha(o.color || 'accent/default', 0.6) : null,
        op: o.dim ? 0.55 : undefined,
      },
      o.lead,
      o.icon ? I(o.icon, { size: 18, color: o.iconColor || o.color || 'text/dim' }) : null,
      C(
        { w: 'fill', gap: 0 },
        T(o.title, {
          style: o.mono ? 'Mono/12' : 'Body/13 Medium',
          w: 'fill',
          trunc: true,
          color: o.bad ? 'state/bad' : 'text/primary',
        }),
        o.sub ? T(o.sub, { style: 'Mono/11', color: 'text/dim', w: 'fill', trunc: true }) : null,
      ),
      o.right,
      o.changed ? dot('accent/default', 7) : null,
      o.lock ? I('lock', { size: 14, color: 'text/faint' }) : null,
    )
  const search = (text, o = {}) => inputBox(text, { icon: 'search', dim: true, h: o.h || 40, w: o.w })
  const groupHead = (text, right) =>
    R({ w: 'fill', h: 30, pad: [0, 12] }, eyebrow(text), spacer(), right ? mono(right) : null)
  const sectionTitle = (text, right) =>
    R({ w: 'fill', h: 28, pad: [8, 0, 0, 0] }, eyebrow(text), spacer(), right)
  // The visible chip stays 28 px (36 in portrait) inside a 44 px touch row (audit M2), so rows of chips keep their look.
  const chip = (text, o = {}) => {
    const c = o.color || 'text/dim'
    return R(
      { name: `chip/${text}`, h: 44 },
      R(
        {
          name: 'face',
          h: o.h || 28,
          pad: [0, o.x == null ? 10 : o.x],
          gap: 6,
          r: 'radius/sm',
          fill: o.on ? alpha(c, 0.18) : 'bg/field',
          stroke: o.on ? alpha(c, 0.7) : 'border/default',
        },
        o.dotColor ? dot(o.dotColor, 7) : null,
        T(text, { style: o.mono ? 'Mono/11' : 'Label/12', color: o.on ? c : 'text/primary' }),
        o.remove ? I('close', { size: 12, color: 'text/faint' }) : null,
      ),
    )
  }
  const swatch = (hex, s = 20, o = {}) =>
    F({
      name: 'swatch',
      w: s,
      h: s,
      r: o.r == null ? 5 : o.r,
      fill: hex,
      stroke: o.sel ? 'accent/default' : 'border/strong',
      sw: o.sel ? 2 : 1,
    })
  const meter = (w, v, o = {}) =>
    F(
      { name: 'meter', w, h: o.h || 6, r: 3, fill: 'bg/field', stroke: 'border/default', clip: true },
      F({ w: Math.max(2, w * v), h: o.h || 6, r: 3, fill: o.color || 'accent/default' }),
    )
  const card = (name, w, h, o = {}, ...kids) =>
    F(
      {
        name,
        w,
        h,
        r: 'radius/lg',
        fill: o.fill || 'bg/surface',
        stroke: o.stroke === undefined ? 'border/default' : o.stroke,
        clip: true,
        lay: o.lay,
        gap: o.gap,
        pad: o.pad,
        ax: o.ax,
        ay: o.ay,
        x: o.x,
        y: o.y,
      },
      ...kids,
    )
  const kvRow = (k, v, o = {}) =>
    R(
      { w: 'fill', h: o.h || 26, gap: 8 },
      T(k, { style: 'Label/12', color: 'text/dim', w: o.kw || 92 }),
      typeof v === 'string'
        ? T(v, {
            style: o.sans ? 'Body/13' : 'Mono/12',
            color: o.color || 'text/primary',
            w: 'fill',
            trunc: true,
          })
        : v,
    )

  // ── Inputs ──
  // A labelled stepper row: the same shape as the 2D editor's field, with a literal/computed mark.
  const stepper = (name, value, o = {}) => {
    const bad = o.bad
    return R(
      { name: `field/${name}`, w: 'fill', h: 44, gap: 8, op: o.disabled ? 0.45 : undefined },
      C(
        { w: o.lw || 96, gap: 0 },
        T(name, { style: 'Label/12', color: bad ? 'state/bad' : 'text/dim' }),
        o.mark ? T(o.mark, { style: 'Mono/11', color: o.markColor || 'text/faint' }) : null,
      ),
      R(
        {
          w: 'fill',
          h: 44,
          ax: 'between',
          r: 'radius/md',
          fill: 'bg/field',
          stroke: bad ? 'state/bad' : o.focus ? 'accent/default' : 'border/default',
        },
        ib('minus', { size: 16 }),
        R(
          { gap: 4 },
          T(value, { style: 'Mono/12', color: bad ? 'state/bad' : 'text/primary' }),
          o.unit ? T(o.unit, { style: 'Mono/11', color: 'text/faint' }) : null,
        ),
        ib('plus', { size: 16 }),
      ),
    )
  }
  const select = (name, value, o = {}) =>
    R(
      { name: `select/${name}`, w: 'fill', h: 44, gap: 8, op: o.disabled ? 0.45 : undefined },
      T(name, { style: 'Label/12', color: 'text/dim', w: o.lw || 96 }),
      inputBox(value, { chevron: true, mono: o.mono, h: 44 }),
    )
  // The same two, labelled above, for narrow columns (two to a row in the 320 px inspector).
  const stepperV = (name, value, o = {}) =>
    C(
      { name: `field/${name}`, w: 'fill', gap: 2, op: o.disabled ? 0.45 : undefined },
      R(
        { w: 'fill', h: 16, gap: 6 },
        T(name, { style: 'Label/12', color: o.bad ? 'state/bad' : 'text/dim' }),
        o.mark ? T(o.mark, { style: 'Mono/11', color: o.markColor || 'text/faint' }) : null,
      ),
      R(
        {
          w: 'fill',
          h: 44,
          ax: 'between',
          r: 'radius/md',
          fill: 'bg/field',
          stroke: o.bad ? 'state/bad' : o.focus ? 'accent/default' : 'border/default',
        },
        ib('minus', { size: 16 }),
        R(
          { gap: 4 },
          T(value, {
            style: 'Mono/12',
            color: o.bad ? 'state/bad' : o.changed ? 'accent/default' : 'text/primary',
          }),
          o.unit ? T(o.unit, { style: 'Mono/11', color: 'text/faint' }) : null,
        ),
        ib('plus', { size: 16 }),
      ),
    )
  const selectV = (name, value, o = {}) =>
    C(
      { name: `select/${name}`, w: 'fill', gap: 2, op: o.disabled ? 0.45 : undefined },
      T(name, { style: 'Label/12', color: 'text/dim' }),
      inputBox(value, { chevron: true, mono: o.mono, h: 44 }),
    )
  // A 40 × 24 switch centred in a 48 × 44 touch target (audit M2).
  const toggle = (on, o = {}) =>
    R(
      { name: 'toggle', w: 48, h: 44, ax: 'center' },
      R(
        {
          name: 'switch',
          w: 40,
          h: 24,
          pad: 3,
          r: 12,
          ax: on ? 'end' : 'start',
          fill: on ? alpha(o.color || 'accent/default', 0.35) : 'bg/field',
          stroke: on ? o.color || 'accent/default' : 'border/strong',
        },
        F({ w: 18, h: 18, r: 9, fill: on ? o.color || 'accent/default' : 'text/faint' }),
      ),
    )
  const toggleRow = (text, on, sub, o = {}) =>
    R(
      { w: 'fill', h: sub ? 48 : 44, gap: 12 },
      C(
        { w: 'fill', gap: 0 },
        T(text, { style: 'Body/13' }),
        sub ? T(sub, { style: 'Label/12', color: 'text/dim', w: 'fill' }) : null,
      ),
      toggle(on, o),
    )
  const textArea = (text, w, h, o = {}) =>
    F(
      {
        name: 'textarea',
        w,
        h,
        r: 'radius/md',
        fill: 'bg/field',
        stroke: o.focus ? 'accent/default' : 'border/default',
        clip: true,
        lay: 'col',
        pad: 12,
        gap: 4,
      },
      T(text, { style: o.mono ? 'Mono/12' : 'Body/13', w: 'fill', lh: o.lh || 20, color: o.color }),
    )

  // ── Slider row (tuner): name and note, track with min/max, value, state ──
  // o: sel, changed (was), locked, ro ('linked' | 'inherited' | 'computed'), bad
  const sliderRow = (t, o = {}) => {
    const w = o.w || 520
    const trackW = w - 232
    const frac = (v) => Math.max(0, Math.min(1, (v - t.min) / (t.max - t.min)))
    const x = trackW * frac(t.v)
    const ro = o.ro
    const accent = ro ? 'text/faint' : o.sel ? 'accent/default' : 'phase/teach'
    return F(
      {
        name: `tunable/${t.n}`,
        w,
        h: 76,
        r: 'radius/md',
        fill: o.sel ? alpha('accent/default', 0.08) : null,
        stroke: o.sel ? alpha('accent/default', 0.6) : null,
        op: ro && ro !== 'computed' ? 0.8 : undefined,
      },
      T(t.n, { x: 12, y: 8, style: 'Mono/12', color: o.bad ? 'state/bad' : 'text/primary', wt: 600 }),
      t.note
        ? T(t.note, { x: 12, y: 26, w: trackW, style: 'Label/12', color: 'text/dim', trunc: true })
        : null,
      // track
      F({ name: 'track', x: 12, y: 54, w: trackW, h: 4, r: 2, fill: 'bg/field', stroke: 'border/default' }),
      F({ name: 'fill', x: 12, y: 54, w: Math.max(2, x), h: 4, r: 2, fill: alpha(accent, ro ? 0.4 : 1) }),
      o.was != null
        ? F({ name: 'was', x: 12 + trackW * frac(o.was) - 1, y: 49, w: 2, h: 14, r: 1, fill: 'text/faint' })
        : null,
      F({
        name: 'thumb halo',
        x: 12 + x - 17,
        y: 56 - 17,
        w: 34,
        h: 34,
        r: 17,
        fill: ro ? null : alpha(accent, o.sel ? 0.22 : 0.1),
      }),
      F({
        name: 'thumb',
        x: 12 + x - 9,
        y: 56 - 9,
        w: 18,
        h: 18,
        r: 9,
        fill: ro ? 'bg/raised' : accent,
        stroke: ro ? 'border/strong' : 'bg/canvas',
        sw: 2,
      }),
      T(String(t.min), { x: 12, y: 62, style: 'Mono/11', color: 'text/faint' }),
      // The max label ends at the track's end, however many digits it has.
      T(String(t.max), {
        x: 12 + trackW - 14 - Math.max(0, String(t.max).length - 2) * 6.6,
        y: 62,
        style: 'Mono/11',
        color: 'text/faint',
        align: 'right',
      }),
      // value box
      R(
        {
          name: 'value',
          x: w - 208 + 0,
          y: 14,
          w: 116,
          h: 44,
          ax: 'center',
          gap: 4,
          r: 'radius/md',
          fill: 'bg/field',
          stroke: o.sel ? 'accent/default' : 'border/default',
        },
        T(String(t.v), { style: 'Mono/12', color: o.changed ? 'accent/default' : 'text/primary', wt: 600 }),
        T(t.u, { style: 'Mono/11', color: 'text/faint' }),
      ),
      // state: lock, linked, was
      o.locked
        ? R(
            {
              x: w - 84,
              y: 14,
              w: 44,
              h: 44,
              ax: 'center',
              r: 'radius/md',
              fill: alpha('state/warn', 0.14),
              stroke: alpha('state/warn', 0.5),
            },
            I('lock', { size: 18, color: 'state/warn' }),
          )
        : ro
          ? R(
              { x: w - 84, y: 14, w: 72, h: 44, ax: 'center', r: 'radius/md', stroke: 'border/default' },
              T(ro, { style: 'Mono/11', color: 'text/dim' }),
            )
          : R(
              { x: w - 84, y: 14, w: 44, h: 44, ax: 'center', r: 'radius/md' },
              I('lock-open', { size: 18, color: 'text/faint' }),
            ),
      o.was != null
        ? T(`was ${o.was}`, { x: w - 208, y: 60, style: 'Mono/11', color: 'accent/default' })
        : null,
      o.changed && o.was == null ? dot('accent/default', 7) : null,
    )
  }

  // ── Diff ──
  const diff = (rows, w, o = {}) =>
    C(
      { name: 'diff', w, h: 'hug', r: 'radius/md', fill: 'bg/field', stroke: 'border/default', clip: true },
      rows.map((r) => {
        const k = r[0]
        const c = k === '+' ? 'state/ok' : k === '-' ? 'state/bad' : 'text/dim'
        return R(
          {
            w: 'fill',
            h: o.rowH || 22,
            pad: [0, 8],
            gap: 8,
            fill: k === '+' ? alpha('state/ok', 0.1) : k === '-' ? alpha('state/bad', 0.1) : null,
          },
          T(String(r[1] == null ? '' : r[1]), {
            style: 'Mono/11',
            color: 'text/faint',
            w: 26,
            align: 'right',
          }),
          T(k === ' ' ? '' : k, { style: 'Mono/11', color: c, w: 10 }),
          T(r[2], {
            style: 'Mono/11',
            color: k === ' ' ? 'text/dim' : 'text/primary',
            w: 'fill',
            trunc: true,
          }),
        )
      }),
    )

  // ── Timeline lanes ──
  // Draws `rows` as lanes inside a dock `w` wide. Positions are relative to the dock's own origin (x0 = label width).
  // row: { label, h, sub, items: [{ k: 'blk'|'key'|'mark'|'curve'|'run', t, t1, label, color, sel, pts }] }
  const lanes = (o) => {
    const { w, dur, y0 = 0, rows, labelW = 96, padR = 16 } = o
    const laneW = w - labelW - padR
    const tx = (t) => labelW + (t / dur) * laneW
    const kids = []
    let y = y0
    rows.forEach((r, i) => {
      const h = r.h || 26
      kids.push(
        F({ name: `row/${r.label}`, x: 0, y, w, h, fill: i % 2 ? alpha('text/primary', 0.02) : null }),
      )
      kids.push(
        T(r.label, {
          x: r.sub ? 28 : 16,
          y: y + (h - 16) / 2,
          style: 'Label/12',
          color: r.sub ? 'text/faint' : 'text/dim',
        }),
      )
      for (const it of r.items || []) {
        const c = it.color || r.color || 'text/dim'
        if (it.k === 'blk') {
          const x0 = tx(it.t)
          const bw = Math.max(6, tx(it.t1) - x0 - 1)
          kids.push(
            F(
              {
                name: `blk/${it.label || ''}`,
                x: x0,
                y: y + 3,
                w: bw,
                h: h - 6,
                r: 5,
                fill: alpha(c, it.sel ? 0.4 : 0.2),
                stroke: it.sel ? c : alpha(c, it.dash ? 0.5 : 0.35),
                sw: it.sel ? 2 : 1,
                dash: it.dash ? [3, 3] : undefined,
                clip: true,
              },
              F({ x: 0, y: 0, w: 3, h: h - 6, fill: c }),
              it.label
                ? T(it.label, {
                    x: 9,
                    y: (h - 6 - 14) / 2,
                    size: 11,
                    wt: it.sel ? 600 : 500,
                    color: it.sel ? 'text/primary' : c,
                    w: Math.max(4, bw - 12),
                    trunc: true,
                  })
                : null,
            ),
          )
        } else if (it.k === 'key') {
          const x = tx(it.t)
          const s = it.sel ? 14 : 11
          kids.push(
            V(
              `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 12 12"><path d="M6 0.5l5.5 5.5-5.5 5.5-5.5-5.5z" fill="#ffffff"/></svg>`,
              {
                name: `key@${it.t}`,
                x: x - s / 2,
                y: y + (h - s) / 2,
                w: s,
                h: s,
                tint: it.sel ? 'accent/default' : c,
              },
            ),
          )
          if (it.label)
            kids.push(T(it.label, { x: x + 9, y: y + (h - 14) / 2, style: 'Mono/11', color: 'text/dim' }))
        } else if (it.k === 'mark') {
          kids.push(F({ name: 'mark', x: tx(it.t) - 1, y: y + 3, w: 2, h: h - 6, fill: c }))
          if (it.label)
            kids.push(T(it.label, { x: tx(it.t) + 5, y: y + (h - 14) / 2, style: 'Mono/11', color: c }))
        } else if (it.k === 'curve') {
          const pts = it.pts.map(
            ([t, v]) => `${+(tx(t) - labelW).toFixed(1)},${+(h - 4 - v * (h - 8)).toFixed(1)}`,
          )
          const hex = S.hex6(c)
          kids.push(
            V(
              `<svg xmlns="http://www.w3.org/2000/svg" width="${laneW}" height="${h}" viewBox="0 0 ${laneW} ${h}"><path d="M${pts.join('L')}" fill="none" stroke="${hex}" stroke-width="1.6" stroke-linejoin="round"/><path d="M${pts.join('L')}L${+(tx(it.pts[it.pts.length - 1][0]) - labelW).toFixed(1)} ${h - 2}L${+(tx(it.pts[0][0]) - labelW).toFixed(1)} ${h - 2}Z" fill="${hex}" fill-opacity=".12"/></svg>`,
              { name: 'curve', x: labelW, y, w: laneW, h },
            ),
          )
        }
      }
      y += h
    })
    return { kids, tx, laneW, height: y - y0 }
  }
  const ruler = (o) => {
    const { w, dur, step = 2, y = 0, labelW = 96, padR = 16, minor = 1 } = o
    const laneW = w - labelW - padR
    const tx = (t) => labelW + (t / dur) * laneW
    let d = ''
    const onStep = (t) => Math.abs(Math.round(t / step) * step - t) < 1e-6
    for (let t = 0; t <= dur + 0.001; t += minor)
      d += `M${+(tx(t) - labelW).toFixed(1)} ${onStep(t) ? 4 : 8}V14`
    const kids = [
      V(
        `<svg xmlns="http://www.w3.org/2000/svg" width="${laneW}" height="16" viewBox="0 0 ${laneW} 16"><path d="${d}" stroke="#454952" stroke-width="1" fill="none"/></svg>`,
        {
          name: 'ticks',
          x: labelW,
          y: y + 18,
          w: laneW,
          h: 16,
        },
      ),
    ]
    // The last label ends at its tick, so it never runs past the lane.
    for (let t = 0; t <= dur + 0.001; t += step) {
      const label = String(+t.toFixed(2))
      const last = t + step > dur + 0.001
      const x = last ? tx(t) - label.length * 6.6 : tx(t) - (t < 10 ? 3 : 6)
      kids.push(T(label, { x, y, style: 'Mono/11', color: 'text/faint' }))
    }
    return kids
  }
  const playhead = (x, y, h, text) => [
    F({ name: 'playhead', x: x - 1, y, w: 2, h, fill: 'accent/default' }),
    R(
      {
        name: 'playhead handle',
        x: x - 26,
        y: y - 2,
        h: 20,
        pad: [0, 8],
        ax: 'center',
        r: 10,
        fill: 'accent/default',
        w: 52,
      },
      T(text, { style: 'Mono/11', color: 'accent/ink', wt: 600 }),
    ),
  ]

  // ── Graph primitives (absolute): node cards and edges ──
  // o: title, sub, color, sel, icon, badge, state ('ok' | 'bad' | 'warn'), dash
  const gnode = (x, y, w, h, o) =>
    F(
      {
        name: `node/${o.title}`,
        x,
        y,
        w,
        h,
        r: 'radius/md',
        fill: o.sel ? alpha(o.color || 'accent/default', 0.14) : 'bg/raised',
        stroke: o.sel
          ? o.color || 'accent/default'
          : o.state === 'bad'
            ? alpha('state/bad', 0.7)
            : 'border/strong',
        sw: o.sel ? 2 : 1,
        dash: o.dash ? [4, 3] : undefined,
        clip: true,
        shadow: o.sel ? 'card' : undefined,
      },
      F({ name: 'accent', x: 0, y: 0, w: 4, h, fill: o.color || 'text/faint' }),
      o.icon ? I(o.icon, { x: 14, y: 12, size: 16, color: o.color || 'text/dim' }) : null,
      T(o.title, {
        x: o.icon ? 38 : 14,
        y: 10,
        style: 'Mono/12',
        wt: 600,
        w: w - (o.icon ? 50 : 24) - (o.badge ? o.badge.length * 6.6 + 24 : 0),
        trunc: true,
      }),
      o.sub ? T(o.sub, { x: 14, y: 32, style: 'Label/12', color: 'text/dim', w: w - 26, trunc: true }) : null,
      o.sub2
        ? T(o.sub2, {
            x: 14,
            y: 54,
            style: 'Mono/11',
            color: o.sub2Color || 'text/faint',
            w: w - 26,
            trunc: true,
          })
        : null,
      o.badge
        ? R(
            {
              name: 'badge',
              x: w - (o.badge.length * 6.6 + 20) - 8,
              y: 7,
              w: o.badge.length * 6.6 + 20,
              h: 20,
              gap: 0,
            },
            pill(o.badge, {
              color:
                o.state === 'bad' ? 'state/bad' : o.state === 'ok' ? 'state/ok' : o.badgeColor || 'text/dim',
              mono: true,
              h: 20,
              pad: 7,
            }),
          )
        : null,
    )
  // Edges over the region (x0, y0, w, h), one svg per colour so Figma binds each group to its token.
  // e: { a: [x, y], b: [x, y], c: token, dash, w, o, ar, v, straight } in region coordinates.
  const edges = (x0, y0, w, h, list) => {
    const path = (e) => {
      const [ax, ay] = e.a
      const [bx, by] = e.b
      const dx = Math.max(24, Math.abs(bx - ax) * 0.45)
      const dy = Math.max(24, Math.abs(by - ay) * 0.45)
      const hex = S.hex6(e.c || 'edge/default')
      const sx = ax < bx || e.straight ? 1 : -1
      const d = e.v
        ? `M${ax} ${ay}C${ax} ${ay + dy} ${bx} ${by - dy} ${bx} ${by}`
        : e.straight
          ? `M${ax} ${ay}L${bx} ${by}`
          : `M${ax} ${ay}C${ax + dx * sx} ${ay} ${bx - dx * sx} ${by} ${bx} ${by}`
      const ang = e.v
        ? Math.PI / 2
        : Math.atan2(by - (e.straight ? ay : by), bx - (e.straight ? ax : bx - dx * sx)) || 0
      const c1 = Math.cos(ang)
      const s1 = Math.sin(ang)
      const p = (px, py) => `${+(bx + px * c1 - py * s1).toFixed(1)} ${+(by + px * s1 + py * c1).toFixed(1)}`
      const head = e.ar === false ? '' : `<path d="M${p(0, 0)}L${p(-8, -4.5)}L${p(-8, 4.5)}Z" fill="${hex}"/>`
      return `<path d="${d}" fill="none" stroke="${hex}" stroke-width="${e.w || 1.6}" ${e.dash ? 'stroke-dasharray="5 4"' : ''}/>${head}`
    }
    const groups = []
    for (const e of list) {
      const key = `${e.c || 'edge/default'}@${e.o == null ? 0.85 : e.o}`
      let g = groups.find((x) => x.key === key)
      if (!g) {
        g = { key, c: e.c || 'edge/default', o: e.o == null ? 0.85 : e.o, body: '' }
        groups.push(g)
      }
      g.body += path(e)
    }
    return groups.map((g) =>
      V(
        `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${g.body}</svg>`,
        {
          name: `edges/${g.c}`,
          x: x0,
          y: y0,
          w,
          h,
          op: g.o,
          tint: g.c,
        },
      ),
    )
  }
  const edgeLabel = (x, y, text, o = {}) =>
    R(
      { name: `edge/${text}`, x, y, h: 20, pad: [0, 7], r: 10, fill: 'bg/surface', stroke: 'border/default' },
      T(text, { style: 'Mono/11', color: o.color || 'text/dim' }),
    )

  // The Bay's shutter chain (puzzle.toml), drawn from the goal back to what the player starts with. Shared by the
  // landscape and portrait Schematic screens; x places its 554 x 602 frame inside the canvas.
  const shutterGraph = (x) => {
    const act = (title, sub, x, y, o = {}) =>
      gnode(x, y, o.w || 128, 64, { title, sub, color: o.color || 'layer/sky', sel: o.sel, state: o.state })
    const sys = (title, sub, x, y) => gnode(x, y, 128, 64, { title, sub, color: 'phase/teach' })
    const Y = [18, 124, 230, 330, 430, 536]
    const X4 = [6, 142, 278, 414]
    const nodes = [
      act('drum.light', 'lighter · matches · torch', X4[0], Y[0]),
      act('burner.light', 'in the mortuary', X4[1], Y[0]),
      act('floor.lighter', 'hold the flame up', X4[2], Y[0]),
      act('floor.bottle', 'throw into the mortuary', X4[3], Y[0]),
      sys('porterAtDrum', 'warmth draws him (P1)', X4[0], Y[1]),
      sys('porterAtBurner', 'into the mortuary', X4[1], Y[1]),
      sys('porterAtFlame', 'goes to where it burned', X4[2], Y[1]),
      sys('porterLatched', 'banging, then quiet (P9)', X4[3], Y[1]),
      act('keyHook.take', 'keysAt hook → Ada', 76, Y[2]),
      act('mortuaryDoor.keys', 'keysAt door → Ada', 330, Y[2], { w: 156 }),
      act('shutter.unlock', 'uses keys · padlock off', 212, Y[3], { sel: true }),
      act('shutter.crank1', 'a 10 m noise (P3)', 6, Y[4]),
      act('shutter.crank2', 'a 10 m noise (P3)', 212, Y[4]),
      act('shutter.open', 'crank 3 · cutscene dawn', 414, Y[4], { color: 'state/ok' }),
      gnode(212, Y[5], 124, 52, { title: 'goal', sub: 'shutter = 3', icon: 'flag', color: 'state/ok' }),
    ]
    const bottom = (x, y, w = 128) => [x + w / 2, y + 64]
    const top_ = (x, y, w = 128) => [x + w / 2, y]
    const E = edges(0, 0, 554, 602, [
      { a: bottom(X4[0], Y[0]), b: top_(X4[0], Y[1]), c: 'layer/sky', v: true },
      { a: bottom(X4[1], Y[0]), b: top_(X4[1], Y[1]), c: 'layer/sky', v: true },
      { a: bottom(X4[2], Y[0]), b: top_(X4[2], Y[1]), c: 'layer/sky', v: true },
      { a: bottom(X4[3], Y[0]), b: top_(X4[3], Y[1]), c: 'layer/sky', v: true },
      { a: bottom(X4[0], Y[1]), b: top_(76, Y[2]), c: 'phase/teach', v: true },
      { a: bottom(X4[1], Y[1]), b: top_(76, Y[2]), c: 'phase/teach', v: true },
      { a: bottom(X4[2], Y[1]), b: top_(76, Y[2]), c: 'phase/teach', v: true },
      { a: bottom(X4[3], Y[1]), b: top_(330, Y[2], 156), c: 'phase/teach', v: true },
      { a: bottom(76, Y[2]), b: top_(212, Y[3]), c: 'layer/sky', v: true },
      { a: bottom(330, Y[2], 156), b: top_(212, Y[3]), c: 'layer/sky', v: true },
      { a: bottom(212, Y[3]), b: top_(212, Y[4]), c: 'layer/sky', v: true },
      { a: [134, Y[4] + 32], b: [212, Y[4] + 32], c: 'layer/sky', straight: true },
      { a: [340, Y[4] + 32], b: [414, Y[4] + 32], c: 'layer/sky', straight: true },
      { a: bottom(414, Y[4]), b: top_(212, Y[5]), c: 'state/ok', v: true },
    ])
    return F(
      { name: 'shutter chain', x, y: 0, w: 554, h: 602 },
      E,
      ...nodes,
      edgeLabel(228, 396, 'safe while he warms (P2)', { color: 'phase/teach' }),
    )
  }

  // ── Charts ──
  // series: [{ pts: [[x, y]], hex, w }], band: { y0, y1 } in data units, domain [xmin, xmax, ymin, ymax]
  const chart = (w, h, o) => {
    const [x0, x1, y0, y1] = o.domain
    const px = (v) => +(((v - x0) / (x1 - x0)) * (w - 2)).toFixed(1) + 1
    const py = (v) => +((1 - (v - y0) / (y1 - y0)) * (h - 2)).toFixed(1) + 1
    let g = ''
    for (let i = 0; i <= 4; i++)
      g += `<path d="M0 ${+((i / 4) * (h - 2) + 1).toFixed(1)}H${w}" stroke="#33363c" stroke-width="1" stroke-opacity=".6"/>`
    if (o.band)
      g += `<rect x="0" y="${py(o.band.y1)}" width="${w}" height="${+(py(o.band.y0) - py(o.band.y1)).toFixed(1)}" fill="${o.band.hex || '#6fbf73'}" fill-opacity=".1"/><path d="M0 ${py(o.band.y0)}H${w}" stroke="${o.band.hex || '#6fbf73'}" stroke-width="1" stroke-dasharray="4 3"/>`
    for (const s of o.series) {
      const pts = s.pts.map(([a, b]) => `${px(a)} ${py(b)}`)
      g += `<path d="M${pts.join('L')}" fill="none" stroke="${s.hex}" stroke-width="${s.w || 2}" stroke-linejoin="round" stroke-linecap="round"/>`
      if (s.dots)
        for (const [a, b] of s.pts)
          g += `<circle cx="${px(a)}" cy="${py(b)}" r="3.2" fill="${s.hex}" stroke="#1a1b1e" stroke-width="1.5"/>`
    }
    if (o.marker != null)
      g += `<path d="M${px(o.marker)} 0V${h}" stroke="#e0a54a" stroke-width="1.5" stroke-dasharray="3 3"/>`
    return V(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${g}</svg>`,
      { name: o.name || 'chart', w, h, x: o.x, y: o.y },
    )
  }

  // ── Studio pipeline dock (1138 x 180): the stages of a character's route, then the gates the owner decides ──
  // o: stages [{ id, state: 'ok' | 'stale' | 'never', at, out }], gates [{ id, name, decision, by }], route
  const pipeline = (o = {}) => {
    const W = 1138
    const tone = {
      ok: 'state/ok',
      stale: 'state/warn',
      never: 'text/faint',
      approved: 'state/ok',
      open: 'accent/default',
    }
    const stage = (s, _i) =>
      C(
        {
          name: `stage/${s.id}`,
          w: 192,
          h: 100,
          pad: 12,
          gap: 4,
          r: 'radius/md',
          fill: 'bg/raised',
          stroke: s.sel ? 'accent/default' : 'border/default',
        },
        R(
          { w: 'fill', gap: 6 },
          P.dot(tone[s.state], 8),
          T(s.id, { style: 'Mono/12', wt: 600 }),
          spacer(),
          T(s.state === 'ok' ? 'ran' : s.state === 'stale' ? 'stale' : 'not run', {
            style: 'Mono/11',
            color: tone[s.state],
          }),
        ),
        T(s.at || '—', { style: 'Label/12', color: 'text/dim', w: 'fill', trunc: true }),
        T(s.out || '', { style: 'Mono/11', color: 'text/faint', w: 'fill', trunc: true }),
      )
    const gate = (g) =>
      C(
        {
          name: `gate/${g.id}`,
          w: 128,
          h: 100,
          pad: 12,
          gap: 4,
          r: 'radius/md',
          fill: g.decision === 'approved' ? alpha('state/ok', 0.08) : 'bg/field',
          stroke: g.decision === 'approved' ? alpha('state/ok', 0.4) : 'border/default',
        },
        R(
          { w: 'fill', gap: 6 },
          I(g.decision === 'approved' ? 'check' : 'gate', { size: 14, color: tone[g.decision] }),
          T(g.id, { style: 'Mono/12', wt: 600 }),
        ),
        T(g.name, { style: 'Label/12', color: 'text/dim', w: 'fill', trunc: true }),
        T(g.decision === 'approved' ? `${g.by} approved` : 'awaiting owner', {
          style: 'Mono/11',
          color: tone[g.decision],
          w: 'fill',
          trunc: true,
        }),
      )
    const stages = o.stages || []
    const flow = []
    stages.forEach((s, i) => {
      if (i) flow.push(I('chevron-right', { size: 16, color: 'text/faint' }))
      flow.push(stage(s, i))
    })
    return region(
      'pipeline',
      o.x == null ? 56 : o.x,
      o.y == null ? 654 : o.y,
      W,
      o.h || 180,
      { lay: 'col' },
      line(0, 0, W, 1),
      R(
        { name: 'pipeline header', w: 'fill', h: 52, pad: [0, 8, 0, 16], gap: 10 },
        eyebrow('Pipeline'),
        pill(o.route || 'procedural route', { color: 'text/dim', mono: true }),
        P.checksPill(o.checks || 'builder check ok · 14', 'state/ok'),
        spacer(),
        btn('Check', { icon: 'check' }),
        btn('Estimate', { icon: 'chart' }),
        btn('Run', { icon: 'lock', kind: 'ghost', disabled: true }),
      ),
      R(
        { name: 'flow', w: 'fill', h: 'fill', pad: [0, 16, 12, 16], gap: 8 },
        ...flow,
        F({ w: 8, h: 8 }),
        R({ w: 1, h: 100, fill: 'border/default' }),
        F({ w: 8, h: 8 }),
        (o.gates || []).map(gate),
      ),
    )
  }

  // ── Garment row and swatch grid (studio) ──
  const SW = {
    navy: '#233a63',
    starch: '#e4e0d0',
    starchShade: '#c9c5b4',
    black: '#1b1b1e',
    stocking: '#c9b49a',
    cream: '#eadbc9',
    maroon: '#6e2a2f',
    denim: '#3d5a80',
    bootBrown: '#5a3a22',
    auburn: '#7a3d22',
    eyeDark: '#2b1d16',
    skin: '#e8c7a9',
  }
  const garmentRow = (g, o = {}) =>
    R(
      {
        name: `garment/${g.kind}`,
        w: 'fill',
        h: 56,
        pad: [0, 10, 0, 6],
        gap: 10,
        r: 'radius/md',
        fill: o.sel ? alpha(ED.studio.color, 0.12) : 'bg/field',
        stroke: o.sel ? alpha(ED.studio.color, 0.6) : 'border/default',
      },
      R({ w: 24, h: 56, ax: 'center' }, I('grip', { size: 16, color: 'text/faint' })),
      F({ name: 'swatch', w: 24, h: 24, r: 6, fill: SW[g.swatch] || '#888888', stroke: 'border/strong' }),
      C(
        { w: 'fill', gap: 0 },
        T(g.kind, { style: 'Body/13 Medium' }),
        T(g.sub, { style: 'Mono/11', color: 'text/dim', w: 'fill', trunc: true }),
      ),
      o.sel
        ? I('chevron-down', { size: 16, color: 'text/dim' })
        : I('chevron-right', { size: 16, color: 'text/faint' }),
    )

  // ── Dim and popover wrappers ──
  const dim = (w, h, a = 0.55) => F({ name: 'scrim', x: 0, y: 0, w, h, fill: alpha('bg/canvas', a) })

  // ── Studio: the character on a stage you touch ──
  // The character is the picker: tap a part to open its fields, drag the hem to change a length, drag sideways to
  // turn. Outfits and poses are thumbnails under the stage, the inspector shows the picked part's few fields with the
  // rest folded, and the pipeline is a bar that opens as a drawer. `A` is artParts (for the figure); o.mode is
  // 'look' | 'pose' | 'first', o.drawer opens the pipeline.
  const studioRoster = (A, o = {}) => {
    const thumb = (outfit) =>
      F(
        { name: 'thumb', w: 40, h: 48, r: 6, fill: 'bg/canvas', clip: true, stroke: 'border/default' },
        V(A.figure(0, { outfit }), { x: 6, y: -2, w: 28, h: 63 }),
      )
    const rows = [
      ['Ada Voss', '3 outfits', 'nurse'],
      ['the Porter', '1 outfit', 'cape'],
      ['the Night Nurse', '1 outfit', 'nurse'],
      ['the ambulance crew', '1 outfit', 'street'],
    ]
    return region(
      'roster',
      56,
      52,
      216,
      782,
      { lay: 'col' },
      P.panelHead('Characters', ib('plus')),
      C(
        { w: 'fill', pad: [0, 8], gap: 2 },
        o.first
          ? listRow({
              title: 'New character',
              sub: 'not saved yet',
              h: 64,
              sel: true,
              color: ED.studio.color,
              lead: thumb('starter'),
            })
          : null,
        rows.map(([title, sub, outfit], i) =>
          listRow({
            title,
            sub,
            h: 64,
            sel: !o.first && i === 0,
            color: ED.studio.color,
            lead: thumb(outfit),
            changed: !o.first && i === 0,
          }),
        ),
      ),
    )
  }
  // A thumbnail card under the stage: an outfit, a pose or a starter.
  const studioCard = (A, label, fig, o = {}) =>
    C(
      { name: `card/${label}`, w: o.w || 96, gap: 4 },
      F(
        {
          name: 'thumb',
          w: o.w || 96,
          h: o.h || 112,
          r: 'radius/md',
          fill: o.add ? null : 'bg/surface',
          stroke: o.sel ? ED.studio.color : 'border/default',
          sw: o.sel ? 2 : 1,
          dash: o.add ? [4, 3] : undefined,
          clip: true,
        },
        o.add
          ? R(
              { x: 0, y: 0, w: o.w || 96, h: o.h || 112, ax: 'center', ay: 'center' },
              I('plus', { size: 22, color: 'accent/default' }),
            )
          : V(fig.rig ? A.rigFigure(fig.rig).svg : A.figure(fig.view || 0, fig), {
              x: ((o.w || 96) - 46) / 2,
              y: 4,
              w: 46,
              h: 104,
            }),
      ),
      T(label, {
        style: 'Label/12',
        w: o.w || 96,
        align: 'center',
        color: o.add ? 'accent/default' : o.sel ? ED.studio.color : 'text/primary',
        trunc: true,
      }),
    )
  // A slider sized for the inspector: value, the file's value as a tick, a 44 px thumb target.
  const studioSlider = (name, v, was, min, max, w = 296) => {
    const fr = (x) => (x - min) / (max - min)
    return C(
      { name: `slider/${name}`, w, gap: 2 },
      R(
        { w, h: 24, gap: 8 },
        T(name, { style: 'Label/12', color: 'text/dim' }),
        spacer(),
        T(v.toFixed(2), { style: 'Mono/12', color: ED.studio.color }),
        was == null ? null : T(`was ${was.toFixed(2)}`, { style: 'Mono/11', color: 'text/faint' }),
      ),
      F(
        { name: 'track area', w, h: 44 },
        F({ name: 'track', x: 0, y: 20, w, h: 4, r: 2, fill: 'bg/field', stroke: 'border/default' }),
        F({ name: 'fill', x: 0, y: 20, w: w * fr(v), h: 4, r: 2, fill: ED.studio.color }),
        was == null
          ? null
          : F({ name: 'was', x: w * fr(was) - 1, y: 14, w: 2, h: 16, r: 1, fill: 'text/faint' }),
        F({
          name: 'thumb',
          x: w * fr(v) - 22,
          y: 0,
          w: 44,
          h: 44,
          r: 22,
          fill: alpha(ED.studio.color, 0.16),
        }),
        F({
          name: 'knob',
          x: w * fr(v) - 9,
          y: 13,
          w: 18,
          h: 18,
          r: 9,
          fill: ED.studio.color,
          stroke: 'bg/canvas',
          sw: 2,
        }),
      ),
    )
  }
  // A joint's limit: the allowed range filled, a thumb (44 px target) at each end, the joint's current angle as a tick.
  const studioRange = (name, lo, hi, cur, max, w = 296) => {
    const fr = (x) => x / max
    const thumb = (v, end) => [
      F({
        name: `thumb/${end}`,
        x: w * fr(v) - 22,
        y: 0,
        w: 44,
        h: 44,
        r: 22,
        fill: alpha(ED.studio.color, 0.12),
      }),
      F({
        name: `knob/${end}`,
        x: w * fr(v) - 9,
        y: 13,
        w: 18,
        h: 18,
        r: 9,
        fill: ED.studio.color,
        stroke: 'bg/canvas',
        sw: 2,
      }),
    ]
    return C(
      { name: `range/${name}`, w, gap: 2 },
      R(
        { w, h: 24, gap: 8 },
        T(name, { style: 'Label/12', color: 'text/dim' }),
        spacer(),
        T(`${lo}° to ${hi}°`, { style: 'Mono/12', color: ED.studio.color }),
        T(`now ${cur}°`, { style: 'Mono/11', color: 'text/faint' }),
      ),
      F(
        { name: 'track area', w, h: 44 },
        F({ name: 'track', x: 0, y: 20, w, h: 4, r: 2, fill: 'bg/field', stroke: 'border/default' }),
        F({
          name: 'range',
          x: w * fr(lo),
          y: 20,
          w: w * (fr(hi) - fr(lo)),
          h: 4,
          r: 2,
          fill: ED.studio.color,
        }),
        F({ name: 'now', x: w * fr(cur) - 1, y: 12, w: 2, h: 20, r: 1, fill: 'text/primary' }),
        ...thumb(lo, 'low'),
        ...thumb(hi, 'high'),
      ),
    )
  }
  // A folded section: one row that names what is inside and opens in place.
  const fold = (title, sub, o = {}) =>
    R(
      {
        name: `fold/${title}`,
        w: 'fill',
        h: 52,
        pad: [0, 12],
        gap: 10,
        r: 'radius/md',
        fill: 'bg/field',
        stroke: 'border/default',
      },
      o.icon ? I(o.icon, { size: 16, color: 'text/dim' }) : null,
      C(
        { w: 'fill', gap: 0 },
        T(title, { style: 'Body/13 Medium', w: 'fill', trunc: true }),
        T(sub, { style: 'Label/12', color: 'text/dim', w: 'fill', trunc: true }),
      ),
      I('chevron-right', { size: 16, color: 'text/faint' }),
    )
  const apronSwatches = (per = 5) => {
    const names = [
      'starch',
      'cream',
      'starchShade',
      'stocking',
      'navy',
      'maroon',
      'denim',
      'bootBrown',
      'auburn',
      'black',
    ]
    const sw = (n) =>
      F({
        name: `swatch/${n}`,
        w: 44,
        h: 44,
        r: 8,
        fill: SW[n],
        stroke: n === 'starch' ? ED.studio.color : 'border/strong',
        sw: n === 'starch' ? 3 : 1,
      })
    const rows = []
    for (let i = 0; i < names.length; i += per)
      rows.push(R({ w: 'fill', gap: 8 }, names.slice(i, i + per).map(sw)))
    return C(
      { name: 'colour', w: 'fill', gap: 8 },
      T('Colour', { style: 'Label/12', color: 'text/dim' }),
      ...rows,
    )
  }
  // A pose made by hand: Ada crouching to a low drawer, feet pinned, her right hand dragged down to the handle.
  const CROUCH = {
    hips: [20, 67],
    head: -1,
    hands: [
      [3, 66],
      [27, 64],
    ],
    feet: [
      [15.5, 81],
      [24.5, 81],
    ],
  }
  // The rig over the figure: bones and joints, a handle on each effector (hips, head, hands, feet) with a 44 px
  // target, pins on the feet, the dragged hand's last place, and the elbow's limit as a wedge. `j` is rigFigure's
  // joints, `at` maps figure units to the stage, `sc` is the figure's scale.
  const rigHandles = (j, at, box, sc, o = {}) => {
    const hex = S.hex6(ED.studio.color)
    const deg = (a, b) => (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI
    const base = deg(j.shoulders[0], j.elbows[0])
    let bend = deg(j.elbows[0], j.hands[0]) - base
    if (bend > 180) bend -= 360
    if (bend < -180) bend += 360
    const lim = 145
    const sgn = bend < 0 ? -1 : 1
    const pt = (c, r, a) => [
      +(c[0] + r * Math.cos((a * Math.PI) / 180)).toFixed(2),
      +(c[1] + r * Math.sin((a * Math.PI) / 180)).toFixed(2),
    ]
    const e = j.elbows[0]
    const w0 = pt(e, 7, base)
    const w1 = pt(e, 7, base + sgn * lim)
    const line = (a, b) => `M${a[0].toFixed(2)} ${a[1].toFixed(2)}L${b[0].toFixed(2)} ${b[1].toFixed(2)}`
    const bones = [
      line(j.hips, j.chest),
      line(j.chest, j.head),
      line(j.shoulders[0], j.shoulders[1]),
      line(j.hipJoints[0], j.hipJoints[1]),
      ...[0, 1].map((i) => line(j.shoulders[i], j.elbows[i]) + line(j.elbows[i], j.hands[i])),
      ...[0, 1].map((i) => line(j.hipJoints[i], j.knees[i]) + line(j.knees[i], j.feet[i])),
    ]
    const dots = [j.chest, ...j.shoulders, ...j.elbows, ...j.hipJoints, ...j.knees]
      .map((p) => `<circle cx="${p[0].toFixed(2)}" cy="${p[1].toFixed(2)}" r=".7" fill="#ffffff"/>`)
      .join('')
    const wedge = o.limit
      ? `<path d="M${e[0].toFixed(2)} ${e[1].toFixed(2)}L${w0[0]} ${w0[1]}A7 7 0 0 ${sgn > 0 ? 1 : 0} ${w1[0]} ${w1[1]}Z" fill="${hex}" fill-opacity=".18" stroke="${hex}" stroke-width=".3" stroke-dasharray="1 .6"/>`
      : ''
    const kids = [
      V(
        `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="90" viewBox="0 0 40 90">${wedge}<path d="${bones.join('')}" fill="none" stroke="${hex}" stroke-width=".45" stroke-linecap="round"/>${dots}</svg>`,
        { name: 'rig', ...box },
      ),
    ]
    const handle = (name, p, h = {}) => {
      const [x, y] = at(p[0], p[1])
      kids.push(
        F({
          name: `handle/${name}`,
          x: x - 22,
          y: y - 22,
          w: 44,
          h: 44,
          r: 22,
          fill: h.sel ? alpha(ED.studio.color, 0.2) : null,
        }),
        F({
          name: `knob/${name}`,
          x: x - 8,
          y: y - 8,
          w: 16,
          h: 16,
          r: 8,
          fill: h.sel ? ED.studio.color : h.pin ? 'text/primary' : 'bg/canvas',
          stroke: h.pin ? 'bg/canvas' : ED.studio.color,
          sw: 2,
        }),
      )
      if (h.pin) kids.push(I('pin', { x: x - 7, y: y + 12, size: 14, color: 'text/primary' }))
    }
    if (o.ghost) {
      const [gx, gy] = at(o.ghost[0], o.ghost[1])
      const [hx, hy] = at(j.hands[0][0], j.hands[0][1])
      kids.push(
        V(
          `<svg xmlns="http://www.w3.org/2000/svg" width="${box.w}" height="${box.h}" viewBox="0 0 ${box.w} ${box.h}"><path d="M${(gx - box.x).toFixed(1)} ${(gy - box.y).toFixed(1)}L${(hx - box.x).toFixed(1)} ${(hy - box.y).toFixed(1)}" stroke="${hex}" stroke-width="1.5" stroke-dasharray="4 4"/></svg>`,
          { name: 'drag path', ...box },
        ),
        F({
          name: 'was here',
          x: gx - 8,
          y: gy - 8,
          w: 16,
          h: 16,
          r: 8,
          stroke: ED.studio.color,
          sw: 1.5,
          dash: [3, 3],
        }),
      )
    }
    handle('hips', j.hips)
    handle('head', j.head)
    handle('hand.R', j.hands[0], { sel: o.sel === 'hand.R' })
    handle('hand.L', j.hands[1])
    handle('foot.R', j.feet[0], { pin: o.pinFeet })
    handle('foot.L', j.feet[1], { pin: o.pinFeet })
    return { kids, bend: Math.round(Math.abs(bend)), lim }
  }
  // The character on the stage, with the picked part, the hem handle, the turn dial or the frame strip.
  const studioStage = (A, o) => {
    const W = o.w
    const sc = o.sc
    const fw = 40 * sc
    const fh = 90 * sc
    const fx0 = (W - fw) / 2
    const fy = o.fy == null ? 64 : o.fy
    const apron = 0.5
    const kids = []
    const fig =
      o.mode === 'pose'
        ? { pose: 'reach' }
        : o.mode === 'first'
          ? { outfit: 'starter' }
          : { apron, hi: 'apron', hiColor: S.hex6(ED.studio.color) }
    const rig = o.mode === 'ik' ? A.rigFigure(CROUCH) : null
    kids.push(V(rig ? rig.svg : A.figure(0, fig), { name: 'character', x: fx0, y: fy, w: fw, h: fh }))
    const at = (gx, gy) => [fx0 + gx * sc, fy + gy * sc]
    if (rig) {
      const box = { x: fx0, y: fy, w: fw, h: fh }
      const r = rigHandles(rig.joints, at, box, sc, {
        sel: 'hand.R',
        pinFeet: true,
        limit: true,
        ghost: [6, 58],
      })
      const e = at(rig.joints.elbows[0][0], rig.joints.elbows[0][1])
      const h = at(rig.joints.hands[0][0], rig.joints.hands[0][1])
      const f = at(20, rig.joints.feet[0][1])
      kids.push(
        ...r.kids,
        R(
          { x: e[0] - 196, y: e[1] - 50, w: 170, ax: 'end' },
          pill(`elbow ${r.bend}° · limit 0–${r.lim}°`, { color: ED.studio.color, mono: true, h: 28 }),
        ),
        R(
          { x: h[0] - 168, y: h[1] - 14, w: 140, ax: 'end' },
          pill('right hand', { color: ED.studio.color, h: 28, icon: 'hand' }),
        ),
        R(
          { x: f[0] - 80, y: f[1] + 30, w: 160, ax: 'center' },
          pill('both feet pinned', { color: 'text/dim', h: 28, icon: 'pin' }),
        ),
      )
    }
    if (o.mode === 'look') {
      const hem = at(20, 38 + Math.round((22 * apron) / 0.6))
      const was = at(20, 60)
      const edge = at(12.5, 47)
      kids.push(
        F({
          name: 'file hem',
          x: hem[0] - 9 * sc,
          y: was[1] - 1,
          w: 18 * sc,
          h: 2,
          dash: [3, 3],
          stroke: 'text/faint',
        }),
        F({
          name: 'hem target',
          x: hem[0] - 22,
          y: hem[1] - 22,
          w: 44,
          h: 44,
          r: 22,
          fill: alpha(ED.studio.color, 0.2),
        }),
        F({
          name: 'hem handle',
          x: hem[0] - 9,
          y: hem[1] - 9,
          w: 18,
          h: 18,
          r: 9,
          fill: ED.studio.color,
          stroke: 'bg/canvas',
          sw: 2,
        }),
        R(
          { x: hem[0] + 14 * sc, y: hem[1] - 14 },
          pill('length 0.50 · was 0.60', { color: ED.studio.color, mono: true, h: 28 }),
        ),
        F({ name: 'tag line', x: edge[0] - 56, y: edge[1], w: 54, h: 1, fill: ED.studio.color }),
        R(
          { x: edge[0] - 56 - 76, y: edge[1] - 14, w: 76, ax: 'end' },
          pill('apron', { color: ED.studio.color, h: 28, icon: 'hand' }),
        ),
      )
    }
    if (o.mode === 'first')
      kids.push(
        F({
          name: 'tap ring',
          x: fx0 + 20 * sc - 30,
          y: fy + 48 * sc - 30,
          w: 60,
          h: 60,
          r: 30,
          stroke: ED.studio.color,
          sw: 2,
          dash: [5, 4],
        }),
        R(
          { x: fx0 + 20 * sc + 76, y: fy + 48 * sc - 14 },
          pill('tap a part', { color: ED.studio.color, h: 28, icon: 'hand' }),
        ),
      )
    const y1 = fy + fh + 8
    if (o.mode === 'pose') {
      kids.push(
        R(
          { name: 'frames', x: (W - 420) / 2, y: y1, w: 420, h: 44, gap: 6, ax: 'center' },
          ib('play', { color: ED.studio.color }),
          [0, 1, 2, 3, 4, 5, 6, 7].map((i) =>
            F({
              name: `frame/${i + 1}`,
              w: 30,
              h: 30,
              r: 6,
              fill: i === 2 ? ED.studio.color : i < 2 ? alpha(ED.studio.color, 0.35) : 'bg/field',
              stroke: 'border/default',
            }),
          ),
          T('3 / 8', { style: 'Mono/12', color: 'text/dim' }),
        ),
        T('reach · drag along the frames to scrub', {
          x: 0,
          y: y1 + 48,
          w: W,
          align: 'center',
          style: 'Mono/11',
          color: 'text/dim',
        }),
      )
    } else {
      const views = ['front', 'front right', 'right', 'back right', 'back', 'back left', 'left', 'front left']
      kids.push(
        R(
          { name: 'turn', x: (W - 260) / 2, y: y1, w: 260, h: 44, gap: 10, ax: 'center' },
          ib('chevron-left'),
          views.map((v, i) =>
            F({ name: `view/${v}`, w: 10, h: 10, r: 5, fill: i === 0 ? ED.studio.color : 'border/strong' }),
          ),
          ib('chevron-right'),
        ),
        T(
          o.mode === 'first'
            ? 'front · drag the character sideways to turn'
            : 'front · drag Ada sideways to turn',
          {
            x: 0,
            y: y1 + 48,
            w: W,
            align: 'center',
            style: 'Mono/11',
            color: 'text/dim',
          },
        ),
      )
    }
    const sy = y1 + 76
    if (o.mode === 'look')
      kids.push(
        eyebrow('Outfits', { x: 12, y: sy }),
        R(
          { name: 'outfits', x: 12, y: sy + 22, gap: 8, ay: 'start' },
          studioCard(A, 'nurse', { apron }, { sel: true }),
          studioCard(A, 'cape', { outfit: 'cape' }),
          studioCard(A, 'street', { outfit: 'street' }),
          studioCard(A, 'New outfit', {}, { add: true }),
        ),
      )
    if (o.mode === 'pose')
      kids.push(
        eyebrow('Poses · from the art file', { x: 12, y: sy }),
        R(
          { name: 'poses', x: 12, y: sy + 22, gap: 8, ay: 'start' },
          ['flinch', 'look', 'reach', 'read', 'sit', 'sleep'].map((p) =>
            studioCard(A, p, { pose: p, view: p === 'look' ? 7 : 0 }, { w: 74, sel: p === 'reach' }),
          ),
          studioCard(A, 'Request', {}, { w: 74, add: true }),
        ),
      )
    if (o.mode === 'ik')
      kids.push(
        eyebrow('Poses · yours and the art file’s', { x: 12, y: sy }),
        R(
          { name: 'poses', x: 12, y: sy + 22, gap: 8, ay: 'start' },
          studioCard(A, 'by hand', { rig: CROUCH }, { w: 74, sel: true }),
          ['reach', 'flinch', 'look', 'sit'].map((p) =>
            studioCard(A, p, { pose: p, view: p === 'look' ? 7 : 0 }, { w: 74 }),
          ),
          studioCard(A, 'Save pose', {}, { w: 74, add: true }),
        ),
      )
    if (o.mode === 'first')
      kids.push(
        eyebrow('Starters', { x: 12, y: sy }),
        R(
          { name: 'starters', x: 12, y: sy + 22, gap: 8, ay: 'start' },
          studioCard(A, 'plain walker', { outfit: 'starter' }, { sel: true }),
          studioCard(A, 'from Ada', {}),
          studioCard(A, 'from the Porter', { outfit: 'cape' }),
          studioCard(A, 'from the crew', { outfit: 'street' }),
        ),
      )
    return kids
  }
  const studioSteps = () =>
    C(
      {
        name: 'first steps',
        x: 12,
        y: 68,
        w: 200,
        pad: 12,
        gap: 8,
        r: 'radius/md',
        fill: 'bg/surface',
        stroke: 'border/default',
      },
      eyebrow('Three steps'),
      [
        ['1', 'Pick a starter below', true],
        ['2', 'Tap a part to change it', false],
        ['3', 'Check, then ask the owner for G1', false],
      ].map(([n, text, done]) =>
        R(
          { w: 'fill', gap: 8, ay: 'start' },
          R(
            {
              w: 20,
              h: 20,
              r: 10,
              ax: 'center',
              fill: done ? ED.studio.color : 'bg/field',
              stroke: 'border/default',
            },
            done
              ? I('check', { size: 12, color: 'accent/ink' })
              : T(n, { style: 'Mono/11', color: 'text/dim' }),
          ),
          T(text, { style: 'Label/12', w: 'fill', color: done ? 'text/dim' : 'text/primary' }),
        ),
      ),
    )
  // The inspector's fields for each mode. Only the picked part's own fields show; the rest are folded rows.
  const studioFields = (o) => {
    if (o.mode === 'first')
      return C(
        { name: 'empty', w: 'fill', h: 'fill', pad: [48, 24], gap: 12, ax: 'center' },
        R(
          { w: 64, h: 64, r: 32, ax: 'center', ay: 'center', fill: alpha(ED.studio.color, 0.14) },
          I('hand', { size: 28, color: ED.studio.color }),
        ),
        T('Tap a part of the character', { style: 'Title/15', align: 'center', w: 'fill' }),
        T(
          'Hair, dress, legs and shoes each open here with only their own fields. Everything else stays folded until you need it.',
          {
            style: 'Label/12',
            color: 'text/dim',
            align: 'center',
            w: 'fill',
            lh: 17,
          },
        ),
        F({ w: 8, h: 8 }),
        T('Or describe the character', { style: 'Label/12', color: 'text/faint' }),
        askBtn(),
      )
    if (o.mode === 'ik')
      return C(
        { name: 'fields', w: 'fill', h: 'fill', pad: 12, gap: 12, clip: true },
        R(
          { w: 'fill', h: 28, gap: 8 },
          F({ w: 14, h: 14, r: 7, fill: ED.studio.color }),
          T('Right hand', { style: 'Title/15' }),
          spacer(),
          pill('arm · two-bone IK', { color: 'text/dim', mono: true }),
        ),
        T(
          'Drag the hand and the elbow follows, inside its limit. Pinned feet stay put while you move the hips.',
          {
            style: 'Label/12',
            color: 'text/dim',
            w: 'fill',
            lh: 17,
          },
        ),
        toggleRow('Pin this hand', false, 'Hold it in place while the body moves'),
        C(
          { w: 'fill', gap: 4 },
          T('Elbow bends', { style: 'Label/12', color: 'text/dim' }),
          P.seg(['Out', 'Down', 'Back'], 0, { w: 296 }),
        ),
        studioRange('Elbow limit', 0, 145, 44, 180),
        R(
          { w: 'fill', gap: 8 },
          btn('Mirror to left', { icon: 'copy', w: 'fill' }),
          btn('Back to rest', { icon: 'rotate', w: 'fill' }),
        ),
        fold('Every joint', '20 joints · turn any one by hand', { icon: 'list' }),
        fold('Save as a pose', 'adds crouch.drawer to Ada’s clips', { icon: 'plus' }),
        fold('Animate from here', 'keys this pose on a timeline', { icon: 'film' }),
      )
    if (o.mode === 'pose')
      return C(
        { name: 'fields', w: 'fill', h: 'fill', pad: 12, gap: 10, clip: true },
        R({ w: 'fill', h: 28, gap: 8 }, T('reach', { style: 'Title/15' }), spacer(), gatePill('G7', 'ok')),
        T(
          'One of six actions in the art file. Tap another pose under the stage, or tap Ada to change her look.',
          {
            style: 'Label/12',
            color: 'text/dim',
            w: 'fill',
            lh: 17,
          },
        ),
        C(
          { w: 'fill', gap: 0 },
          kvRow('Action', '285'),
          kvRow('Cell', 'the preset’s'),
          kvRow('Preset', 'standard'),
          kvRow('Height', '1.62 m'),
        ),
        C(
          { w: 'fill', gap: 4 },
          T('Light', { style: 'Label/12', color: 'text/dim' }),
          P.seg(['Hall light off', 'on'], 0),
        ),
        fold('Request a new pose', 'writes the action, checks it, estimates the cost', { icon: 'plus' }),
        fold('Pose file', D.paths.art, { icon: 'code' }),
        P.callout(
          'warn',
          'The paid run is the owner’s',
          'A new pose waits for gate G7 before the atlas job runs.',
        ),
      )
    return C(
      { name: 'fields', w: 'fill', h: 'fill', pad: 12, gap: 12, clip: true },
      R(
        { w: 'fill', h: 28, gap: 8 },
        F({ w: 14, h: 14, r: 4, fill: SW.starch, stroke: 'border/strong' }),
        T('apron', { style: 'Title/15' }),
        spacer(),
        pill('nurse outfit', { color: 'text/dim', mono: true }),
      ),
      T('Tap another part of Ada to switch. Drag the hem on the stage to change the length.', {
        style: 'Label/12',
        color: 'text/dim',
        w: 'fill',
        lh: 17,
      }),
      apronSwatches(),
      studioSlider('Length', 0.5, 0.6, 0.2, 1),
      fold('More apron options', 'shade · straps · bib · pockets'),
      fold('Everything in this outfit', '10 parts · top, skirt, apron, shoes…'),
      fold('In the story', 'nurse in clinic, bay and clinic-dawn'),
    )
  }
  const studioPipeBar = (x, y, w, mode) => {
    const first = mode === 'first'
    return R(
      { name: 'pipeline bar', x, y, w, h: 56, pad: [0, 8, 0, 12], gap: 8, fill: 'bg/app' },
      F({ name: 'divider', abs: true, x: 0, y: 0, w, h: 1, fill: 'border/default' }),
      dot(first ? 'text/faint' : mode === 'pose' ? 'state/ok' : 'state/warn', 8),
      eyebrow('Pipeline'),
      mono(
        first
          ? 'not run yet'
          : mode === 'pose'
            ? 'atlas ran 12 Oct'
            : mode === 'ik' || mode === 'anim'
              ? 'sheet stale · new pose'
              : 'builder stale · sheet stale',
        {
          trunc: true,
        },
      ),
      spacer(),
      first
        ? null
        : mode === 'pose'
          ? gatePill('G7', 'ok')
          : mode === 'ik' || mode === 'anim'
            ? gatePill('G6', 'open')
            : gatePill('G1 · G6', 'open'),
      btn('Check', { icon: 'check' }),
      ib('chevron-up'),
    )
  }
  const studioView = (A, o) => {
    const mode = o.mode
    const H = o.drawer ? 602 : 782
    const stageKids = studioStage(A, { mode, w: 602, sc: o.drawer ? 2.6 : 4.2 })
    const stage = region(
      'stage',
      272,
      52,
      602,
      H,
      { fill: 'bg/canvas', clip: true },
      R(
        { name: 'modes', x: 12, y: 12, w: 336 },
        P.seg(['Look', 'Pose', 'Animate', 'Play'], mode === 'pose' || mode === 'ik' ? 1 : 0, { w: 336 }),
      ),
      mode === 'pose' || mode === 'ik'
        ? R(
            { name: 'pose by', x: 370, y: 12, w: 220, ax: 'end' },
            P.seg(['Presets', 'By hand'], mode === 'ik' ? 1 : 0, { w: 220 }),
          )
        : R(
            { name: 'hint', x: 360, y: 12, w: 230, h: 44, gap: 6, ax: 'end' },
            I('hand', { size: 14, color: 'text/faint' }),
            T('tap a part · drag to turn', { style: 'Label/12', color: 'text/faint' }),
          ),
      mode === 'first' ? studioSteps() : null,
      ...stageKids,
      o.drawer ? null : studioPipeBar(0, H - 56, 602, mode),
    )
    const inspector = region(
      'inspector',
      874,
      52,
      320,
      H,
      { lay: 'col' },
      P.tabs(
        [
          { label: mode === 'pose' ? 'Pose' : mode === 'ik' ? 'Joint' : 'Part' },
          { label: 'Code' },
          { label: 'Ask' },
        ],
        0,
      ),
      F({ w: 'fill', h: 1, fill: 'border/default' }),
      studioFields({ mode }),
    )
    const first = mode === 'first'
    return F(
      { name: o.name, w: 1194, h: 834, fill: 'bg/app', clip: true },
      top(1194, {
        title: first ? 'New character' : 'Ada Voss',
        sub: first
          ? 'content/characters/new.json'
          : mode === 'pose'
            ? D.paths.art
            : mode === 'ik'
              ? D.paths.clips
              : D.paths.character,
        ed: 'studio',
        cs: first ? 'studio/new-character' : mode === 'ik' ? 'studio/ada-crouch' : 'studio/ada-apron',
        n: first ? 0 : 1,
        checks: first ? 'not checked yet' : 'character check ok',
        tone: first ? 'text/dim' : undefined,
        reopened: !first && mode !== 'pose',
        gates: mode === 'pose' ? [['G1–G7', 'idle']] : undefined,
      }),
      rail(782, 'studio'),
      studioRoster(A, { first }),
      stage,
      inspector,
      o.drawer
        ? pipeline({
            stages: [
              { id: 'builder', state: 'stale', at: 'apron changed just now', out: 'run Check to refresh' },
              { id: 'sheet', state: 'stale', at: 'ran yesterday', out: 'review-x4.png' },
              { id: 'play', state: 'stale', at: 'ran yesterday', out: 'hall-off · hall-on' },
            ],
            gates: [
              { id: 'G1', name: 'look', decision: 'open' },
              { id: 'G6', name: 'figure', decision: 'open' },
            ],
            checks: 'character check ok',
          })
        : null,
      line(0, 51, 1194, 1),
      line(55, 52, 1, 782),
      line(271, 52, 1, H),
      line(873, 52, 1, H),
    )
  }
  // Animate: a clip is keys on the rig's handles over time, played over the procedural layers (Last Light's motion.ts:
  // walk or idle, lean, breath and sway keep running unless a key holds that part). It steps at the gait's pose rate,
  // like the game, or plays smooth. The stage shows the pose at the playhead with the keys either side as onion skins.
  const studioAnimate = (A) => {
    const REST = {
      hips: [20, 58],
      head: 0,
      hands: [
        [6.5, 58],
        [33.5, 58],
      ],
      feet: CROUCH.feet,
    }
    const MID = {
      hips: [20, 62],
      head: -1,
      hands: [
        [6, 58],
        [26, 60],
      ],
      feet: CROUCH.feet,
    }
    const mix = (a, b, t) => +(a + (b - a) * t).toFixed(2)
    const mixP = (a, b, t) => [mix(a[0], b[0], t), mix(a[1], b[1], t)]
    const lerpRig = (a, b, t) => ({
      hips: mixP(a.hips, b.hips, t),
      head: mix(a.head, b.head, t),
      hands: [mixP(a.hands[0], b.hands[0], t), mixP(a.hands[1], b.hands[1], t)],
      feet: a.feet,
    })
    const now = 0.45
    const cur = lerpRig(REST, MID, now / 0.6)
    const W = 602
    const H = 452
    const sc = 3.4
    const fw = 40 * sc
    const fh = 90 * sc
    const fx0 = (W - fw) / 2
    const fy = 60
    const box = { x: fx0, y: fy, w: fw, h: fh }
    const at = (gx, gy) => [fx0 + gx * sc, fy + gy * sc]
    const onion = (pose, name) =>
      F(
        { name, x: fx0, y: fy, w: fw, h: fh, op: 0.25 },
        V(A.rigFigure(pose).svg, { x: 0, y: 0, w: fw, h: fh }),
      )
    const rig = A.rigFigure(cur)
    const handles = rigHandles(rig.joints, at, box, sc, { sel: 'hand.R', pinFeet: true })
    const hex = S.hex6(ED.studio.color)
    // A key: a diamond, filled when it is the selected one. x and y centre it; null leaves it to the layout.
    const diamond = (name, x, y, d, on) =>
      V(
        `<svg xmlns="http://www.w3.org/2000/svg" width="${d}" height="${d}" viewBox="0 0 12 12"><path d="M6 1l5 5-5 5-5-5z" fill="${on ? hex : '#111214'}" stroke="${hex}" stroke-width="1.4"/></svg>`,
        x == null ? { name, w: d, h: d } : { name, x: x - d / 2, y: y - d / 2, w: d, h: d },
      )
    const trail = [REST.hands[0], MID.hands[0], CROUCH.hands[0]].map((p) => at(p[0], p[1]))
    const stage = region(
      'stage',
      272,
      52,
      W,
      H,
      { fill: 'bg/canvas', clip: true },
      R({ name: 'modes', x: 12, y: 12, w: 336 }, P.seg(['Look', 'Pose', 'Animate', 'Play'], 2, { w: 336 })),
      R(
        { name: 'hint', x: 360, y: 12, w: 230, h: 44, gap: 6, ax: 'end' },
        I('hand', { size: 14, color: 'text/faint' }),
        T('drag a handle to key it', { style: 'Label/12', color: 'text/faint' }),
      ),
      onion(REST, 'onion/key 1'),
      onion(CROUCH, 'onion/key 3'),
      V(rig.svg, { name: 'character', ...box }),
      V(
        `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><path d="M${trail.map((p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join('L')}" fill="none" stroke="${hex}" stroke-width="1.5" stroke-dasharray="2 4" stroke-linecap="round"/></svg>`,
        { name: 'trail', x: 0, y: 0, w: W, h: H },
      ),
      ...trail.map((p, i) => diamond(`trail key ${i + 1}`, p[0], p[1], 12, i === 1)),
      ...handles.kids,
      R(
        { name: 'view', x: 12, y: H - 56, w: W - 24, h: 44, gap: 8 },
        chip('Onion skin', { on: true, color: ED.studio.color }),
        chip('Hand trail', { on: true, color: ED.studio.color }),
        spacer(),
        T('front · drag Ada sideways to turn', { style: 'Mono/11', color: 'text/dim' }),
      ),
    )
    const clips = region(
      'clips',
      56,
      52,
      216,
      782,
      { lay: 'col' },
      P.panelHead('Clips · Ada', ib('plus')),
      C(
        { w: 'fill', pad: [0, 8], gap: 2 },
        [
          ['walk', 'procedural · brisk gait', 'walk', false],
          ['idle', 'procedural · breath, shift', 'clock', false],
          ['reach', 'action · 1.4 s out and back', 'hand', false],
          ['crouch.drawer', 'keyed · 1.2 s · new', 'film', true],
          ['flinch', 'action', 'hand', false],
          ['sit', 'action', 'hand', false],
          ['sleep', 'action', 'hand', false],
        ].map(([title, sub, icon, sel]) =>
          listRow({ title, sub, icon, h: 52, mono: true, sel, changed: sel, color: ED.studio.color }),
        ),
      ),
      R(
        { w: 'fill', pad: [12, 16] },
        T(
          'Walk, idle and the actions are procedural, from the figure’s gait. A keyed clip plays over them and holds only the parts it keys.',
          { style: 'Label/12', color: 'text/faint', w: 'fill', lh: 16 },
        ),
      ),
    )
    const inspector = region(
      'inspector',
      874,
      52,
      320,
      H,
      { lay: 'col' },
      P.tabs([{ label: 'Key' }, { label: 'Code' }, { label: 'Ask' }], 0),
      F({ w: 'fill', h: 1, fill: 'border/default' }),
      C(
        { name: 'fields', w: 'fill', h: 'fill', pad: 12, gap: 10, clip: true },
        R(
          { w: 'fill', h: 28, gap: 8 },
          diamond('key', null, null, 14, true),
          T('Right hand · key 2', { style: 'Title/15' }),
          spacer(),
          pill('of 3', { color: 'text/dim', mono: true }),
        ),
        R(
          { w: 'fill', gap: 8 },
          stepperV('At', '0.60', { unit: 's' }),
          selectV('Ease', 'smooth', { mono: true }),
        ),
        C(
          { w: 'fill', gap: 4 },
          T('Plays as', { style: 'Label/12', color: 'text/dim' }),
          P.seg(['Pose steps', 'Smooth'], 0, { w: 296 }),
          T('12 poses a second, from Ada’s brisk gait', { style: 'Mono/11', color: 'text/faint' }),
        ),
        toggleRow('Hold over the idle', true, 'Breath and sway stop moving this hand'),
        R(
          { w: 'fill', gap: 8 },
          btn('Key every handle', { icon: 'plus', w: 'fill' }),
          btn('Delete key', { kind: 'danger', icon: 'trash', w: 'fill' }),
        ),
      ),
    )
    const dur = 1.2
    const TW = 922
    const rows = [
      { label: 'Hips', color: ED.studio.color, items: [0, 0.6, 1].map((t) => ({ k: 'key', t })) },
      { label: 'Head', color: ED.studio.color, items: [0, 0.6].map((t) => ({ k: 'key', t })) },
      {
        label: 'Hand R',
        color: ED.studio.color,
        items: [
          { k: 'key', t: 0 },
          { k: 'key', t: 0.6, sel: true },
          { k: 'key', t: 1 },
        ],
      },
      { label: 'Hand L', color: ED.studio.color, items: [0, 1].map((t) => ({ k: 'key', t })) },
      { label: 'Foot R', color: 'text/dim', items: [{ k: 'blk', t: 0, t1: dur, label: 'pinned' }] },
      { label: 'Foot L', color: 'text/dim', items: [{ k: 'blk', t: 0, t1: dur, label: 'pinned' }] },
      {
        label: 'Under it',
        color: 'text/faint',
        items: [{ k: 'blk', t: 0, t1: dur, label: 'idle · breath and sway, procedural', dash: true }],
      },
      { label: 'Events', color: 'ed/audio', items: [{ k: 'key', t: 1, label: 'pickup' }] },
    ]
    const L = lanes({ w: TW, dur, y0: 78, rows, labelW: 96, padR: 16 })
    const dock = region(
      'timeline',
      272,
      504,
      TW,
      330,
      { lay: null },
      line(0, 0, TW, 1),
      R(
        { name: 'timeline header', x: 0, y: 0, w: TW, h: 44, pad: [0, 8, 0, 16], gap: 10 },
        eyebrow('Clip'),
        T('0.45 / 1.20 s', { style: 'Mono/12' }),
        mono('pose 6 of 15'),
        spacer(),
        ib('step-back'),
        ib('play', { on: true }),
        ib('step-fwd'),
        ib('loop'),
        F({ w: 8, h: 8 }),
        P.seg(['Steps', 'Smooth'], 0, { w: 180 }),
      ),
      ...ruler({ w: TW, dur, step: 0.2, y: 46, labelW: 96, padR: 16, minor: 1 / 12 }),
      ...L.kids,
      ...playhead(L.tx(now), 66, 78 + L.height - 66, now.toFixed(2)),
    )
    return F(
      { name: 'Studio · Animate · iPad landscape', w: 1194, h: 834, fill: 'bg/app', clip: true },
      top(1194, {
        title: 'Ada Voss',
        sub: D.paths.clips,
        ed: 'studio',
        cs: 'studio/ada-crouch',
        n: 1,
        checks: 'character check ok',
        reopened: true,
      }),
      rail(782, 'studio'),
      clips,
      stage,
      inspector,
      dock,
      line(0, 51, 1194, 1),
      line(55, 52, 1, 782),
      line(271, 52, 1, 782),
      line(873, 52, 1, H),
    )
  }
  // Portrait: the stage takes the width, the picked part's fields are a bottom sheet, characters are a chip.
  const studioPortrait = (A) => {
    const W = 834
    const sheetY = 752
    const stage = region(
      'stage',
      0,
      108,
      W,
      sheetY - 108,
      { fill: 'bg/canvas', clip: true },
      ...studioStage(A, { mode: 'look', w: W, sc: 4.6, fy: 28 }).slice(0, 9),
      R(
        { name: 'outfits', x: W - 112, y: 16, gap: 8, lay: 'col' },
        ...[
          ['nurse', { apron: 0.5 }, true],
          ['cape', { outfit: 'cape' }, false],
          ['street', { outfit: 'street' }, false],
        ].map(([label, fig, sel]) => studioCard(A, label, fig, { w: 96, h: 112, sel })),
        studioCard(A, 'New outfit', {}, { w: 96, h: 112, add: true }),
      ),
    )
    const sheet = C(
      {
        name: 'bottom sheet',
        x: 0,
        y: sheetY,
        w: W,
        h: 1074 - sheetY,
        pad: [8, 16, 16, 16],
        gap: 12,
        r: [16, 16, 0, 0],
        fill: 'bg/surface',
        stroke: 'border/default',
        shadow: 'sheet',
      },
      R({ w: 'fill', h: 16, ax: 'center' }, F({ name: 'handle', w: 40, h: 5, r: 3, fill: 'border/strong' })),
      R(
        { w: 'fill', h: 28, gap: 8 },
        F({ w: 14, h: 14, r: 4, fill: SW.starch, stroke: 'border/strong' }),
        T('apron', { style: 'Title/15' }),
        pill('nurse outfit', { color: 'text/dim', mono: true }),
        spacer(),
        T('tap another part to switch', { style: 'Label/12', color: 'text/faint' }),
      ),
      apronSwatches(10),
      studioSlider('Length', 0.5, 0.6, 0.2, 1, 802),
      R(
        { w: 'fill', gap: 8 },
        fold('More apron options', 'shade · straps · bib · pockets'),
        fold('Everything in this outfit', '10 parts'),
      ),
    )
    return F(
      { name: 'Studio · Look · iPad portrait', w: W, h: 1194, fill: 'bg/app', clip: true },
      topP(W, {
        title: 'Ada Voss',
        sub: 'ada.json',
        cs: 'studio/ada-apron',
        n: 1,
        checks: 'checks ok',
        gates: [['G1 · G6', 'open']],
      }),
      R(
        { name: 'chrome', x: 16, y: 58, w: W - 32, h: 44, gap: 8 },
        R(
          {
            name: 'character picker',
            gap: 8,
            h: 44,
            pad: [0, 12],
            r: 'radius/md',
            fill: 'bg/raised',
            stroke: 'border/default',
          },
          F(
            { w: 22, h: 28, r: 4, fill: 'bg/canvas', clip: true },
            V(A.figure(0), { x: 2, y: 0, w: 18, h: 40 }),
          ),
          T('Ada Voss', { style: 'Body/13 Medium' }),
          I('chevron-down', { size: 14, color: 'text/dim' }),
        ),
        P.seg(['Look', 'Pose', 'Animate', 'Play'], 0, { w: 336 }),
        spacer(),
        I('hand', { size: 14, color: 'text/faint' }),
        T('tap a part · drag to turn', { style: 'Label/12', color: 'text/faint' }),
      ),
      stage,
      sheet,
      studioPipeBar(0, 1074, W, 'look'),
      tabBar(W, 1130, 'studio'),
      line(0, 51, W, 1),
    )
  }

  return {
    shutterGraph,
    studioView,
    studioAnimate,
    studioPortrait,
    D,
    ED,
    fileRow,
    gatesFor,
    topGates,
    rail,
    tabBar,
    topP,
    shell,
    mono,
    csPill,
    gatePill,
    askBtn,
    edPill,
    top,
    status,
    listRow,
    search,
    groupHead,
    sectionTitle,
    chip,
    swatch,
    meter,
    card,
    kvRow,
    stepper,
    stepperV,
    select,
    selectV,
    toggle,
    toggleRow,
    textArea,
    sliderRow,
    diff,
    lanes,
    ruler,
    playhead,
    gnode,
    edges,
    edgeLabel,
    chart,
    dim,
    pipeline,
    SW,
    garmentRow,
  }
}

// ── Illustrative art: shapes stand in for production assets, as in the level editor mockups ──
export function artParts(S, _P, _Q) {
  const { F, V } = S
  const rng = (seed) => {
    let s = seed >>> 0
    return () => {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0
      return s / 4294967296
    }
  }
  const fx = (n) => +n.toFixed(1)

  // The loading bay of The Last Light's act two: a back wall with a roller shutter, a desk lamp, the ambulance.
  // 480 x 270 art units. o: lamp 0..1 (the bayFill light), dim 0..1, ada: [x, y] | false
  const bayArt = (o = {}) => {
    const lamp = o.lamp == null ? 0.7 : o.lamp
    const r = rng(7)
    let dots = ''
    for (let i = 0; i < 160; i++)
      dots += `<rect x="${fx(r() * 480)}" y="${fx(r() * 270)}" width="1.5" height="1.5" fill="#000" fill-opacity=".16"/>`
    let slats = ''
    for (let y = 50; y < 168; y += 9) slats += `<path d="M300 ${y}H452" stroke="#2c3441" stroke-width="1.2"/>`
    let tiles = ''
    for (let i = -6; i <= 14; i++)
      tiles += `<path d="M${240 + i * 12} 168L${240 + i * 74} 270" stroke="#252d3a" stroke-width="1"/>`
    for (const y of [186, 208, 236]) tiles += `<path d="M0 ${y}H480" stroke="#252d3a" stroke-width="1"/>`
    const ada =
      o.ada === false
        ? ''
        : `<g transform="translate(${o.ada ? o.ada[0] : 238} ${o.ada ? o.ada[1] : 168})"><ellipse cx="9" cy="34" rx="12" ry="3" fill="#000" fill-opacity=".35"/><rect x="3" y="14" width="12" height="20" fill="#233a63"/><rect x="5" y="16" width="8" height="12" fill="#e4e0d0"/><rect x="4" y="3" width="10" height="11" fill="#e8c7a9"/><path d="M3 4h12v5H3z" fill="#7a3d22"/><rect x="3" y="33" width="4" height="4" fill="#111"/><rect x="11" y="33" width="4" height="4" fill="#111"/></g>`
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="270" viewBox="0 0 480 270">` +
      `<defs><radialGradient id="lamp" cx=".5" cy=".45" r=".6"><stop offset="0" stop-color="#ffd58a" stop-opacity="${fx(0.55 * lamp)}"/><stop offset="1" stop-color="#ffd58a" stop-opacity="0"/></radialGradient></defs>` +
      `<rect width="480" height="270" fill="#141a24"/><rect width="480" height="170" fill="#1b2330"/><path d="M0 170H480V270H0z" fill="#232b38"/>` +
      tiles +
      `<rect x="296" y="44" width="160" height="126" fill="#38414f"/>${slats}<rect x="296" y="44" width="160" height="5" fill="#4b5565"/>` +
      `<rect x="40" y="96" width="196" height="76" rx="6" fill="#c9d0d9"/><rect x="40" y="132" width="196" height="8" fill="#b5463c"/><rect x="52" y="104" width="46" height="24" rx="3" fill="#5a7894"/><rect x="104" y="104" width="46" height="24" rx="3" fill="#5a7894"/><circle cx="80" cy="176" r="15" fill="#0c0f14"/><circle cx="196" cy="176" r="15" fill="#0c0f14"/><circle cx="80" cy="176" r="6" fill="#6b7482"/><circle cx="196" cy="176" r="6" fill="#6b7482"/>` +
      `<rect x="330" y="150" width="86" height="28" fill="#4a3a2d"/><rect x="334" y="178" width="6" height="22" fill="#3a2d22"/><rect x="406" y="178" width="6" height="22" fill="#3a2d22"/>` +
      `<rect x="350" y="116" width="16" height="34" fill="#3b4a5c"/><rect x="351" y="104" width="14" height="14" fill="#c9a98a"/><rect x="346" y="100" width="22" height="5" fill="#2a2f38"/>` +
      `<rect x="278" y="20" width="4" height="26" fill="#2c3441"/><path d="M262 46h36l-6 10h-24z" fill="#8a6f3d"/><ellipse cx="280" cy="150" rx="150" ry="120" fill="url(#lamp)"/>` +
      ada +
      (o.dim ? `<rect width="480" height="270" fill="#040612" fill-opacity="${o.dim}"/>` : '') +
      dots +
      `</svg>`
    return svg
  }
  // A 16:9 picture card from art svg (480 x 270 units).
  const picture = (w, svg, o = {}) => {
    const h = Math.round((w * 270) / 480)
    return F(
      {
        name: o.name || 'picture',
        x: o.x,
        y: o.y,
        w,
        h,
        r: o.r == null ? 6 : o.r,
        clip: true,
        fill: 'bg/canvas',
      },
      V(svg, { name: 'art', w, h }),
    )
  }
  // Camera viewfinder overlay on a w x h picture: corner brackets, thirds, action-safe frame.
  const viewfinder = (w, h, o = {}) => {
    const m = 14
    const c = '#e0a54a'
    const L = 18
    const corner = (x, y, dx, dy) =>
      `<path d="M${x} ${y + dy * L}V${y}H${x + dx * L}" stroke="${c}" stroke-width="2" fill="none"/>`
    let g =
      corner(m, m, 1, 1) + corner(w - m, m, -1, 1) + corner(m, h - m, 1, -1) + corner(w - m, h - m, -1, -1)
    if (o.thirds !== false)
      g += `<path d="M${w / 3} ${m}V${h - m}M${(2 * w) / 3} ${m}V${h - m}M${m} ${h / 3}H${w - m}M${m} ${(2 * h) / 3}H${w - m}" stroke="#fff" stroke-opacity=".18" stroke-width="1"/>`
    g += `<rect x="${w * 0.06}" y="${h * 0.08}" width="${w * 0.88}" height="${h * 0.84}" fill="none" stroke="#fff" stroke-opacity=".22" stroke-dasharray="4 4"/>`
    if (o.ghost)
      g += `<rect x="${o.ghost[0]}" y="${o.ghost[1]}" width="${o.ghost[2]}" height="${o.ghost[3]}" fill="none" stroke="${c}" stroke-opacity=".7" stroke-dasharray="5 4" stroke-width="1.5"/>`
    return V(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${g}</svg>`,
      { name: 'viewfinder', w, h, x: o.x || 0, y: o.y || 0 },
    )
  }

  // A procedural figure, drawn from 8 views (0 front, then clockwise) on a 40 x 90 grid. o: lit, walk (0..1), outfit,
  // apron (length 0..1, the file's 0.6 by default), pose ('flinch' | 'look' | 'reach' | 'read' | 'sit' | 'sleep'),
  // hi (a part to outline: 'apron' | 'hair' | 'dress' | 'shoes').
  const figure = (view, o = {}) => {
    const back = view >= 3 && view <= 5
    const side = view === 2 || view === 6
    const quarter = view === 1 || view === 3 || view === 5 || view === 7
    const flip = view >= 5 && view <= 7 ? -1 : 1
    const bw = side ? 13 : quarter ? 17 : 21
    const cx = 20
    const skin = '#e8c7a9'
    const hair = '#7a3d22'
    const dress = { cape: '#1a2745', street: '#6e2a2f', starter: '#5b6270' }[o.outfit] || '#233a63'
    const apron = '#e4e0d0'
    const apronH = Math.round(22 * ((o.apron == null ? 0.6 : o.apron) / 0.6))
    const walk = o.walk || 0
    const legA = Math.round(walk * 4)
    const pose = o.pose
    const sit = pose === 'sit'
    const g = []
    g.push(`<ellipse cx="${cx}" cy="86" rx="${bw / 2 + 4}" ry="3" fill="#000" fill-opacity=".35"/>`)
    if (sit)
      g.push(
        '<rect x="8" y="70" width="24" height="5" fill="#5a3a22"/><rect x="10" y="75" width="3" height="11" fill="#5a3a22"/><rect x="27" y="75" width="3" height="11" fill="#5a3a22"/>',
      )
    const body = []
    // legs
    const lx = side ? cx - 3 : cx - bw / 4 - 1
    if (sit)
      body.push(
        `<rect x="${fx(lx - 2)}" y="58" width="5" height="12" fill="#c9b49a"/><rect x="${fx(cx + bw / 4 - 3)}" y="58" width="5" height="12" fill="#c9b49a"/><rect x="${fx(lx - 3)}" y="69" width="7" height="4" fill="#111"/><rect x="${fx(cx + bw / 4 - 4)}" y="69" width="7" height="4" fill="#111"/>`,
      )
    else {
      body.push(
        `<rect x="${fx(lx - 2)}" y="58" width="5" height="${22 + legA}" fill="#c9b49a"/><rect x="${fx(side ? lx + 1 : cx + bw / 4 - 3)}" y="58" width="5" height="${22 - legA}" fill="#c9b49a"/>`,
      )
      body.push(
        `<rect x="${fx(lx - 3)}" y="${79 + legA}" width="7" height="4" fill="#111"/><rect x="${fx(side ? lx + 0 : cx + bw / 4 - 4)}" y="${79 - legA}" width="7" height="4" fill="#111"/>`,
      )
    }
    // skirt and torso
    body.push(
      `<path d="M${cx - bw / 2 - 1} 62L${cx - bw / 2 + 1} 36H${cx + bw / 2 - 1}L${cx + bw / 2 + 1} 62z" fill="${dress}"/>`,
    )
    if (o.outfit !== 'street' && o.outfit !== 'starter') {
      if (!back)
        body.push(
          `<rect x="${cx - bw / 2 + 3}" y="38" width="${bw - 6}" height="${apronH}" fill="${apron}"/>`,
        )
      else
        body.push(
          `<path d="M${cx - bw / 2 + 3} 38L${cx + bw / 2 - 3} 56M${cx + bw / 2 - 3} 38L${cx - bw / 2 + 3} 56" stroke="${apron}" stroke-width="2"/>`,
        )
    } else if (o.outfit === 'street')
      body.push(`<rect x="${cx - bw / 2 + 1}" y="44" width="${bw - 2}" height="2" fill="#1b1b1e"/>`)
    if (o.outfit === 'cape')
      body.push(
        `<path d="M${cx - bw / 2 - 2} 34H${cx + bw / 2 + 2}L${cx + bw / 2 + 3} 50H${cx - bw / 2 - 3}z" fill="#101a31"/><path d="M${cx - bw / 2 - 3} 50H${cx + bw / 2 + 3}" stroke="#9c3327" stroke-width="2"/>`,
      )
    // arms: straight down, or bent to a pose's hands
    const sl = [cx - bw / 2 - 2, 39]
    const sr = [cx + bw / 2 + 2, 39]
    const hands = {
      flinch: [
        [cx - 6, 30],
        [cx + 5, 27],
      ],
      look: [
        [sl[0] - 1, 58],
        [cx + 3, 24],
      ],
      reach: [
        [sl[0] - 1, 58],
        [cx + bw / 2 + 8, 21],
      ],
      read: [
        [cx - 4, 47],
        [cx + 4, 47],
      ],
      sit: [
        [cx - 5, 60],
        [cx + 5, 60],
      ],
    }[pose]
    if (hands && !side) {
      const arm = (s, h) =>
        `<path d="M${s[0]} ${s[1]}L${fx((s[0] + h[0]) / 2 + (h[0] < s[0] ? 2 : -2))} ${fx((s[1] + h[1]) / 2 + 4)}L${fx(h[0])} ${fx(h[1])}" fill="none" stroke="${dress}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"/><rect x="${fx(h[0] - 1.5)}" y="${fx(h[1] - 1.5)}" width="3" height="3" fill="${skin}"/>`
      body.push(arm(sl, hands[0]), arm(sr, hands[1]))
      if (pose === 'read')
        body.push(
          `<rect x="${cx - 7}" y="40" width="14" height="10" fill="#eadbc9" stroke="#9b8f7c" stroke-width=".6"/>`,
        )
    } else if (!side)
      body.push(
        `<rect x="${cx - bw / 2 - 4}" y="38" width="4" height="${20 + legA / 2}" fill="${dress}"/><rect x="${cx + bw / 2}" y="38" width="4" height="${20 - legA / 2}" fill="${dress}"/>`,
      )
    else body.push(`<rect x="${cx - 2}" y="38" width="4" height="${21 + legA}" fill="${dress}"/>`)
    // head
    const hw = side ? 12 : 15
    const hx = pose === 'flinch' ? -1 : pose === 'look' ? 1 : 0
    body.push(`<rect x="${cx - hw / 2 + hx}" y="18" width="${hw}" height="17" fill="${back ? hair : skin}"/>`)
    if (!back) {
      const fox = (side ? 1 : quarter ? flip * 2 : 0) + hx * 2
      body.push(`<rect x="${cx - hw / 2 + hx}" y="16" width="${hw}" height="8" fill="${hair}"/>`)
      if (pose === 'sleep' || pose === 'flinch')
        body.push(
          `<rect x="${fx(cx - 4 + fox)}" y="28" width="2" height="1" fill="#2b1d16"/><rect x="${fx(cx + 2 + fox)}" y="28" width="2" height="1" fill="#2b1d16"/>`,
        )
      else {
        body.push(
          `<rect x="${fx(cx - 4 + fox + (side ? flip * 3 : 0))}" y="27" width="2" height="2" fill="#2b1d16"/>`,
        )
        if (!side) body.push(`<rect x="${fx(cx + 2 + fox)}" y="27" width="2" height="2" fill="#2b1d16"/>`)
      }
    } else body.push(`<rect x="${cx - hw / 2 - 1}" y="16" width="${hw + 2}" height="12" fill="${hair}"/>`)
    // the selected part's outline, drawn over the figure
    const box = {
      apron: [cx - bw / 2 + 2, 37, bw - 4, apronH + 2],
      hair: [cx - hw / 2 - 1, 15, hw + 2, 10],
      dress: [cx - bw / 2 - 2, 35, bw + 4, 28],
      shoes: [lx - 4, 78, cx + bw / 4 + 4 - (lx - 4), 6],
    }[o.hi]
    if (box)
      body.push(
        `<rect x="${fx(box[0])}" y="${fx(box[1])}" width="${fx(box[2])}" height="${fx(box[3])}" fill="none" stroke="${o.hiColor || '#e07a6a'}" stroke-width=".7" stroke-dasharray="1.6 1"/>`,
      )
    if (pose === 'sleep')
      g.push(
        `<g transform="translate(1 86) rotate(-90) scale(.44)">${body.join('')}</g><rect x="16" y="75" width="23" height="10" rx="2" fill="#c9c5b4"/><rect x="1" y="85" width="38" height="2" fill="#5a3a22"/>`,
      )
    else if (pose === 'flinch') g.push(`<g transform="rotate(-8 20 86)">${body.join('')}</g>`)
    else g.push(sit ? `<g transform="translate(0 4)">${body.join('')}</g>` : body.join(''))
    if (o.lit) g.push(`<rect x="0" y="0" width="40" height="90" fill="#f99b4e" fill-opacity=".16"/>`)
    return `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="90" viewBox="0 0 40 90">${g.join('')}</svg>`
  }

  // A figure posed through its rig, front view, in figure()'s 40 × 90 space. The Last Light's rig (render/figure/rig.ts)
  // solves each limb with two-bone IK; this draws the same idea flat. o.hips is the pelvis [x, y], o.head a sideways
  // lean, o.hands and o.feet the effectors, screen left first (Ada's right). Returns the SVG and every joint, so the
  // stage can put handles on them.
  const rigFigure = (o = {}) => {
    const hip = o.hips || [20, 58]
    const sy = hip[1] - 19
    const hd = o.head || 0
    const bw = 21
    const solve = (a, t, l1, l2, bend) => {
      const dx = t[0] - a[0]
      const dy = t[1] - a[1]
      const d0 = Math.hypot(dx, dy) || 1
      const d = Math.min(Math.max(d0, Math.abs(l1 - l2) + 0.01), l1 + l2 - 0.01)
      const ux = dx / d0
      const uy = dy / d0
      const ca = (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d)
      const sa = Math.sqrt(Math.max(0, 1 - ca * ca))
      const mid = [a[0] + l1 * (ux * ca - uy * bend * sa), a[1] + l1 * (uy * ca + ux * bend * sa)]
      return [mid, [a[0] + ux * d, a[1] + uy * d]]
    }
    const sh = [
      [hip[0] - bw / 2 - 2, sy],
      [hip[0] + bw / 2 + 2, sy],
    ]
    const hp = [
      [hip[0] - 4.5, hip[1]],
      [hip[0] + 4.5, hip[1]],
    ]
    const hands = o.hands || [
      [sh[0][0] - 1, sy + 19],
      [sh[1][0] + 1, sy + 19],
    ]
    const feet = o.feet || [
      [hp[0][0], 81],
      [hp[1][0], 81],
    ]
    const arm = [solve(sh[0], hands[0], 10, 10, 1), solve(sh[1], hands[1], 10, 10, -1)]
    const leg = [solve(hp[0], feet[0], 11.6, 11.6, 1), solve(hp[1], feet[1], 11.6, 11.6, -1)]
    const dress = '#233a63'
    const g = [`<ellipse cx="20" cy="86" rx="14" ry="3" fill="#000" fill-opacity=".35"/>`]
    const seg = (a, b, c, w, col) =>
      `<path d="M${fx(a[0])} ${fx(a[1])}L${fx(b[0])} ${fx(b[1])}L${fx(c[0])} ${fx(c[1])}" fill="none" stroke="${col}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"/>`
    for (let i = 0; i < 2; i++) {
      g.push(seg(hp[i], leg[i][0], leg[i][1], 5, '#c9b49a'))
      g.push(
        `<rect x="${fx(leg[i][1][0] - 3.5)}" y="${fx(leg[i][1][1] - 1.5)}" width="7" height="4" fill="#111"/>`,
      )
    }
    const hem = hip[1] + 4
    g.push(
      `<path d="M${hip[0] - bw / 2 - 1} ${hem}L${hip[0] - bw / 2 + 1} ${sy - 3}H${hip[0] + bw / 2 - 1}L${hip[0] + bw / 2 + 1} ${hem}z" fill="${dress}"/>`,
      `<rect x="${hip[0] - bw / 2 + 3}" y="${sy - 1}" width="${bw - 6}" height="${Math.min(22, hem - sy - 1)}" fill="#e4e0d0"/>`,
    )
    for (let i = 0; i < 2; i++) {
      g.push(seg(sh[i], arm[i][0], arm[i][1], 4, dress))
      g.push(
        `<rect x="${fx(arm[i][1][0] - 1.5)}" y="${fx(arm[i][1][1] - 1.5)}" width="3" height="3" fill="#e8c7a9"/>`,
      )
    }
    const hx = hip[0] + hd
    g.push(
      `<rect x="${fx(hx - 7.5)}" y="${sy - 21}" width="15" height="17" fill="#e8c7a9"/>`,
      `<rect x="${fx(hx - 7.5)}" y="${sy - 23}" width="15" height="8" fill="#7a3d22"/>`,
      `<rect x="${fx(hx - 4 + hd)}" y="${sy - 12}" width="2" height="2" fill="#2b1d16"/><rect x="${fx(hx + 2 + hd)}" y="${sy - 12}" width="2" height="2" fill="#2b1d16"/>`,
    )
    return {
      svg: `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="90" viewBox="0 0 40 90">${g.join('')}</svg>`,
      joints: {
        hips: hip,
        head: [hx, sy - 13],
        chest: [hip[0], sy],
        shoulders: sh,
        elbows: [arm[0][0], arm[1][0]],
        hands: [arm[0][1], arm[1][1]],
        hipJoints: hp,
        knees: [leg[0][0], leg[1][0]],
        feet: [leg[0][1], leg[1][1]],
      },
    }
  }

  // A waveform: seeded noise shaped by an envelope. kind: 'tone' | 'hiss'
  const waveSvg = (w, h, o = {}) => {
    const r = rng(o.seed || 3)
    const n = Math.floor(w / 2)
    let top = ''
    let bot = ''
    for (let i = 0; i < n; i++) {
      const t = i / n
      // Rise over `attack` (a fraction of the cue), then fade out.
      const rise = Math.sin((Math.PI / 2) * Math.min(1, t / (o.attack || 0.25)))
      const env = rise ** 0.6 * Math.exp(-t * (o.decay || 2.2))
      const amp =
        (o.kind === 'tone' ? Math.abs(Math.sin(t * (o.cycles || 40))) * 0.7 + 0.2 : r() * 0.8 + 0.2) *
        env *
        (h / 2 - 3)
      top += `${i ? 'L' : 'M'}${i * 2} ${fx(h / 2 - amp)}`
      bot = `L${i * 2} ${fx(h / 2 + amp)}${bot}`
    }
    const c = o.hex || S.hex6('ed/audio')
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><path d="M0 ${h / 2}H${w}" stroke="#33363c"/><path d="${top}${bot}Z" fill="${c}" fill-opacity=".35" stroke="${c}" stroke-width="1"/></svg>`
  }
  // A top-down path trace (systems trace): rooms as outlines, a route, the pursuer's route.
  const traceSvg = (w, h) =>
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 320 180"><rect x="6" y="6" width="130" height="80" fill="none" stroke="#454952"/><rect x="136" y="6" width="90" height="80" fill="none" stroke="#454952"/><rect x="226" y="6" width="88" height="168" fill="none" stroke="#454952"/><rect x="6" y="86" width="220" height="88" fill="none" stroke="#454952"/><path d="M40 130H110L150 100H200L260 60" fill="none" stroke="#e0a54a" stroke-width="2.2" stroke-linejoin="round"/><path d="M270 150H196L170 120H120L84 36" fill="none" stroke="#d9645a" stroke-width="2" stroke-dasharray="5 3"/><circle cx="40" cy="130" r="4" fill="#e0a54a"/><circle cx="270" cy="150" r="4" fill="#d9645a"/><circle cx="260" cy="60" r="4" fill="#6fbf73"/></svg>`

  return { rng, fx, bayArt, picture, viewfinder, figure, rigFigure, waveSvg, traceSvg }
}
