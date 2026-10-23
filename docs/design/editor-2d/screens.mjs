// Screens for the 2D editor mockups. Each `build(S, P)` returns one scene tree (see ../editor-kit/scene).
// Builders are self-contained functions of the kit `S` and the parts `P` (parts.mjs), so build.mjs can render
// the same source to HTML and to Figma.

export const screens = []

// ── Compose: the hero. iPad landscape 1194 x 834 (the `wide` shell) ──
screens.push({
  id: 'compose',
  page: '2D · Stage',
  name: 'Compose · Rooftops · iPad landscape',
  w: 1194,
  h: 834,
  note: 'Layers front first on the left, the framed phone view in the middle with a sink handle on the selected layer, fields on the right, and the climb dock along the bottom.',
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
      region,
      line,
      eyebrow,
      label,
      pill,
      btn,
      ib,
      seg,
      field,
      tabs,
      panelHead,
      rail,
      topbar,
      layerRow,
      artRow,
      art,
      sceneCard,
      dock,
    } = P
    const front = [...D.layers].reverse()
    const sel = 'cityMid'
    const cityMid = D.layers.find((l) => l.a === sel)
    const only = D.layers.map((l) => l.a).filter((a) => a !== sel)

    const panel = region(
      'layers panel',
      56,
      52,
      264,
      634,
      { lay: 'col' },
      panelHead('Layers', ib('plus'), ib('more')),
      R({ w: 'fill', h: 20, pad: [0, 16] }, T('FRONT', { style: 'Mono/11', color: 'text/faint', ls: 1 })),
      C(
        { name: 'layer list (scrolls)', w: 'fill', h: 'fill', pad: [0, 8], gap: 0, clip: true },
        front.map((l) => layerRow(l, { sel: l.a === sel })),
      ),
      C(
        { name: 'stage art (pinned)', w: 'fill', pad: [8, 8, 8, 8], gap: 0 },
        F({ w: 'fill', h: 1, fill: 'border/default' }),
        R({ w: 'fill', h: 28, pad: [0, 8] }, eyebrow('Stage art')),
        artRow('sun', 'Sun', 'world.sun'),
        artRow('image', 'Select still', 'still.rooftopsPreview'),
      ),
    )
    const scroll = F({ name: 'scrollbar', x: 313, y: 124, w: 3, h: 170, r: 2, fill: 'border/strong' })

    const px = 140
    const py = 22
    const canvas = region(
      'canvas',
      320,
      52,
      554,
      634,
      { fill: 'bg/canvas' },
      F({
        name: 'device',
        x: px,
        y: py,
        w: 274,
        h: 589,
        r: 22,
        fill: 'bg/raised',
        stroke: 'border/strong',
        sw: 2,
      }),
      sceneCard(270, 585, { name: 'Rooftops at floor 8', x: px + 2, y: py + 2, r: 20, course: true }),
      F({
        name: 'selection extent',
        x: px + 2,
        y: py + 2 + 350,
        w: 270,
        h: 235,
        stroke: 'accent/default',
        sw: 1.5,
        dash: [5, 4],
      }),
      F({
        name: 'sink handle halo',
        x: px + 2 + 135 - 22,
        y: py + 2 + 350 - 22,
        w: 44,
        h: 44,
        r: 22,
        fill: alpha('accent/default', 0.2),
      }),
      F({
        name: 'sink handle',
        x: px + 2 + 135 - 14,
        y: py + 2 + 350 - 14,
        w: 28,
        h: 28,
        r: 14,
        fill: 'accent/default',
        stroke: 'bg/canvas',
        sw: 2,
      }),
      I('arrow-up', { x: px + 2 + 135 - 9, y: py + 2 + 350 - 12, size: 11, color: 'accent/ink', sw: 2.4 }),
      I('arrow-down', { x: px + 2 + 135 - 2, y: py + 2 + 350 + 1, size: 11, color: 'accent/ink', sw: 2.4 }),
      R(
        {
          name: 'selection tag',
          x: px + 2 + 150,
          y: py + 2 + 350 - 40,
          h: 24,
          pad: [0, 8],
          gap: 6,
          r: 6,
          fill: 'accent/default',
        },
        T('cityMid · sink 270', { style: 'Mono/11', color: 'accent/ink', wt: 600 }),
      ),
      // tools
      C(
        {
          name: 'canvas tools',
          x: 8,
          y: 8,
          pad: 4,
          gap: 2,
          r: 'radius/lg',
          fill: 'bg/surface',
          stroke: 'border/default',
        },
        ib('cursor', { on: true }),
        ib('hand'),
        ib('grid'),
        ib('ruler'),
      ),
      R(
        {
          name: 'viewport chip',
          x: 396,
          y: 8,
          h: 32,
          pad: [0, 12],
          gap: 8,
          r: 16,
          fill: 'bg/surface',
          stroke: 'border/default',
        },
        I('mapPin', { size: 14, color: 'text/dim' }),
        T('Phone 390×844', { style: 'Mono/11' }),
        I('chevron-down', { size: 14, color: 'text/dim' }),
      ),
      R(
        {
          name: 'floor chip',
          x: 8,
          y: 594,
          h: 32,
          pad: [0, 12],
          gap: 8,
          r: 16,
          fill: 'bg/surface',
          stroke: 'border/default',
        },
        T('floor 8', { style: 'Mono/11', color: 'accent/default' }),
        T('cameraY 2 810', { style: 'Mono/11', color: 'text/dim' }),
      ),
      R(
        {
          name: 'zoom',
          x: 452,
          y: 590,
          h: 36,
          pad: [0, 4],
          gap: 0,
          r: 'radius/md',
          fill: 'bg/surface',
          stroke: 'border/default',
        },
        ib('minus', { s: 36, size: 16 }),
        T('75%', { style: 'Mono/11', w: 34, align: 'center' }),
        ib('plus', { s: 36, size: 16 }),
      ),
    )

    const inspector = region(
      'inspector',
      874,
      52,
      320,
      634,
      { lay: 'col' },
      tabs([{ label: 'Layer' }, { label: 'Stage' }, { label: 'Checks', badge: '2' }], 0),
      F({ w: 'fill', h: 1, fill: 'border/default' }),
      C(
        { name: 'fields', w: 'fill', h: 'fill', pad: 12, gap: 8, clip: true },
        R(
          { w: 'fill', h: 28, gap: 8 },
          F({ w: 14, h: 14, r: 4, fill: alpha('layer/city', 0.85) }),
          T('world.cityMid', { style: 'Title/15' }),
          spacer(),
          pill('Order valid', { color: 'state/ok', icon: 'check' }),
        ),
        R(
          {
            name: 'art picker',
            w: 'fill',
            h: 56,
            pad: [8, 12, 8, 8],
            gap: 10,
            r: 'radius/md',
            fill: 'bg/field',
            stroke: 'border/default',
          },
          sceneCard(56, 40, { name: 'plate thumbnail', hide: only, vy: 340, r: 6 }),
          C(
            { w: 'fill', gap: 1 },
            T('world.cityMid', { style: 'Mono/12' }),
            R(
              { gap: 5 },
              I('check', { size: 12, color: 'state/ok' }),
              T('in the art manifest', { style: 'Mono/11', color: 'text/dim' }),
            ),
          ),
          I('chevron-down', { size: 16, color: 'text/dim' }),
        ),
        R(
          { w: 'fill', h: 44, gap: 8 },
          T('Plate', { style: 'Label/12', color: 'text/dim', w: 84 }),
          seg(['sky', 'city'], 1),
        ),
        field('Depth', cityMid.depth.toFixed(2)),
        field('Sink', String(cityMid.sink), { unit: 'px' }),
        field('Haze', cityMid.haze.toFixed(3)),
        field('Arc', (cityMid.depth / 0.35).toFixed(2), { unit: 'auto' }),
        R(
          { w: 'fill', h: 44, gap: 8 },
          T('Extend', { style: 'Label/12', color: 'text/dim', w: 84 }),
          seg(['none', 'skirt', 'tile', 'plate'], 1),
        ),
        field('Drift', 'sky only', { disabled: true }),
      ),
      R(
        { name: 'footer', w: 'fill', h: 68, pad: [12, 12], gap: 8 },
        btn('Duplicate', { icon: 'copy', w: 'fill' }),
        btn('Delete', { kind: 'danger', icon: 'trash', w: 'fill' }),
      ),
    )

    return F(
      { name: 'Compose · Rooftops · iPad landscape', w: 1194, h: 834, fill: 'bg/app', clip: true },
      topbar(1194),
      rail(782, 0),
      panel,
      scroll,
      canvas,
      inspector,
      dock({ floor: 8 }),
      line(0, 51, 1194, 1),
      line(55, 52, 1, 782),
      line(319, 52, 1, 634),
      line(873, 52, 1, 634),
    )
  },
})

// ── Course: seed, phrases, generated floors, demand ──
screens.push({
  id: 'course',
  page: '2D · Stage',
  name: 'Course · seed 35229 · iPad landscape',
  w: 1194,
  h: 834,
  note: 'The generated floors as bars with horizontal bounds, the reach of one bounce and per-floor demand, the phrase card on the right and a floor strip below. Geometry is illustrative until ED2D.1 ports the generator.',
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
      region,
      line,
      eyebrow,
      label,
      pill,
      btn,
      ib,
      seg,
      field,
      tabs,
      panelHead,
      rail,
      topbar,
      courseSvg,
      rng,
      phaseColor,
      callout,
    } = P
    const { rows } = courseSvg(464, 634, { floors: 20 })
    const SEL = 8
    const phaseOf = (f) => (f >= 1 && f <= 19 ? rows[f].phase : null)
    const demandOf = (f) =>
      f >= 1 && f <= 19 ? Math.min(1.15, Math.abs(rows[f].x - rows[f - 1].x) / 0.9) : null
    const rr = rng(77)
    const demand = {}
    for (let f = 1; f <= 50; f++) demand[f] = f <= 19 ? demandOf(f) : 0.25 + rr() * 0.8
    const dColor = (d) => (d > 0.85 ? 'state/warn' : 'text/dim')

    // panel
    const phraseRow = (p, sel) =>
      R(
        {
          name: `phrase/${p.name}`,
          w: 'fill',
          h: 48,
          pad: [0, 8, 0, 8],
          gap: 10,
          r: 'radius/md',
          fill: sel ? alpha('accent/default', 0.12) : null,
          stroke: sel ? alpha('accent/default', 0.6) : null,
        },
        F({ w: 4, h: 30, r: 2, fill: phaseColor(p.name) }),
        C(
          { w: 'fill', gap: 0 },
          T(p.name, { style: 'Body/13 Medium' }),
          T(`floors ${p.from}–${p.to} · ${p.to - p.from + 1}`, { style: 'Mono/11', color: 'text/dim' }),
        ),
        I('chevron-right', { size: 16, color: 'text/faint' }),
      )
    const extRow = ([a, b]) =>
      R(
        { name: `extension/${a}`, w: 'fill', h: 44, pad: [0, 8, 0, 8], gap: 10, r: 'radius/md' },
        F({ w: 4, h: 26, r: 2, fill: 'border/strong' }),
        C(
          { w: 'fill', gap: 0 },
          T(`floors ${a}–${b}`, { style: 'Body/13 Medium' }),
          T('purpose set', { style: 'Mono/11', color: 'text/dim' }),
        ),
        I('chevron-right', { size: 16, color: 'text/faint' }),
      )
    const panel = region(
      'course panel',
      56,
      52,
      264,
      634,
      { lay: 'col' },
      panelHead('Course', ib('more')),
      C(
        { name: 'seed card', w: 'fill', pad: 0, gap: 0 },
        C(
          { w: 'fill', pad: [0, 16], gap: 0 },
          C(
            { w: 'fill', pad: 12, gap: 6, r: 'radius/md', fill: 'bg/field', stroke: 'border/default' },
            R(
              { w: 'fill', gap: 8 },
              eyebrow('Seed'),
              spacer(),
              pill('pinned', { color: 'accent/default', icon: 'lock', h: 22, pad: 8 }),
            ),
            R(
              { w: 'fill', gap: 4 },
              T('35229', { mono: true, size: 22, wt: 600 }),
              spacer(),
              ib('dice'),
              ib('lock', { on: true }),
            ),
            T('Reaches courseRevision, so a replay on this stage depends on it.', {
              style: 'Label/12',
              color: 'text/dim',
              w: 'fill',
              lh: 16,
            }),
          ),
        ),
      ),
      C(
        { name: 'phrase list', w: 'fill', h: 'fill', pad: [8, 8], gap: 0, clip: true },
        R({ w: 'fill', h: 28, pad: [0, 8] }, eyebrow('Phrases')),
        D.phrases.map((p) => phraseRow(p, p.name === 'combine')),
        R({ w: 'fill', h: 32, pad: [8, 8, 0, 8] }, eyebrow('Extension · 20–49')),
        D.extension.map(extRow),
      ),
    )

    // canvas: floors bottom-up
    const yOf = (f) => 580 - f * 27
    const cx = (f) => 288 + rows[f].x * 232
    const bars = []
    for (let f = 0; f <= 19; f++) {
      const r = rows[f]
      const ph = phaseOf(f)
      const c = ph ? phaseColor(ph) : 'text/dim'
      const w = f === 0 ? 464 : Math.round(r.bw * 464)
      const x = f === 0 ? 56 : Math.round(cx(f) - w / 2)
      const sel = f === SEL
      bars.push(
        F({ name: `strip ${f}`, x: 8, y: yOf(f) - 8, w: 4, h: 27, fill: alpha(c, ph ? 0.9 : 0.25) }),
        T(String(f), {
          x: 20,
          y: yOf(f) - 3,
          style: 'Mono/11',
          color: sel ? 'accent/default' : 'text/faint',
        }),
        F({
          name: `floor ${f}`,
          x,
          y: yOf(f),
          w,
          h: 10,
          r: 3,
          fill: sel ? 'accent/default' : f === 0 ? 'bg/raised' : alpha(c, 0.8),
          stroke: sel ? 'text/primary' : null,
          sw: 1.5,
        }),
      )
      if (r.moving)
        bars.push(T('↔', { x: x + w / 2 - 6, y: yOf(f) - 17, style: 'Mono/12', color: 'accent/default' }))
      const d = demandOf(f)
      if (d != null)
        bars.push(
          F({
            name: `demand ${f}`,
            x: 528,
            y: yOf(f) + 2,
            w: Math.round(d * 22),
            h: 6,
            r: 2,
            fill: alpha(dColor(d), d > 0.85 ? 0.9 : 0.55),
          }),
        )
    }
    const reach = 209
    const sx = cx(SEL)
    const rx0 = Math.max(56, Math.round(sx - reach))
    const rx1 = Math.min(520, Math.round(sx + reach))
    const bounds = V(
      `<svg xmlns="http://www.w3.org/2000/svg" width="554" height="634" viewBox="0 0 554 634"><path d="M56 56V600M520 56V600" stroke="#454952" stroke-width="1" stroke-dasharray="3 5" fill="none"/></svg>`,
      { name: 'horizontal bounds', x: 0, y: 0, w: 554, h: 634 },
    )
    const canvas = region(
      'canvas',
      320,
      52,
      554,
      634,
      { fill: 'bg/canvas' },
      bounds,
      F({
        name: 'extension marker',
        x: 56,
        y: 10,
        w: 464,
        h: 38,
        r: 8,
        fill: alpha('text/dim', 0.06),
        stroke: 'border/strong',
        dash: [4, 4],
      }),
      R(
        { x: 150, y: 20, gap: 8 },
        I('arrow-up', { size: 14, color: 'text/dim' }),
        T('Floors 20–49 · extension, 3 ranges', { style: 'Mono/11', color: 'text/dim' }),
      ),
      F({
        name: 'reach of one bounce',
        x: rx0,
        y: yOf(SEL) - 6,
        w: rx1 - rx0,
        h: 22,
        r: 11,
        fill: alpha('accent/default', 0.1),
        stroke: alpha('accent/default', 0.55),
        dash: [4, 3],
      }),
      bars,
      R(
        {
          name: 'floor tag',
          x: Math.min(380, Math.round(sx + 30)),
          y: yOf(SEL) - 34,
          h: 24,
          pad: [0, 8],
          r: 6,
          fill: 'accent/default',
        },
        T(`floor ${SEL} · demand ${demandOf(SEL).toFixed(2)}`, {
          style: 'Mono/11',
          color: 'accent/ink',
          wt: 600,
        }),
      ),
      R(
        { name: 'toggles', x: 8, y: 596, gap: 6 },
        pill('Bounds', { color: 'accent/default', h: 30, pad: 12 }),
        pill('Reach', { color: 'accent/default', h: 30, pad: 12 }),
        pill('Demand', { color: 'accent/default', h: 30, pad: 12 }),
      ),
      R(
        { name: 'legend', x: 340, y: 600, gap: 6 },
        F({ w: 10, h: 6, r: 2, fill: alpha('state/warn', 0.9) }),
        T('needs most of a bounce', { style: 'Mono/11', color: 'text/dim' }),
      ),
    )

    const sel = D.phrases[1]
    const inspector = region(
      'inspector',
      874,
      52,
      320,
      634,
      { lay: 'col' },
      tabs([{ label: 'Phrase' }, { label: 'Tuning' }], 0),
      F({ w: 'fill', h: 1, fill: 'border/default' }),
      C(
        { name: 'fields', w: 'fill', h: 'fill', pad: 12, gap: 8, clip: true },
        R(
          { w: 'fill', h: 28, gap: 8 },
          F({ w: 4, h: 20, r: 2, fill: phaseColor(sel.name) }),
          T(sel.name, { style: 'Title/15' }),
          spacer(),
          pill(`floors ${sel.from}–${sel.to}`, { color: phaseColor(sel.name), mono: true }),
        ),
        field('From', String(sel.from)),
        field('To', String(sel.to)),
        field('Sink at end', String(sel.sink), { unit: 'citySink' }),
        C(
          { name: 'purpose', w: 'fill', gap: 6 },
          label('Purpose'),
          R(
            { w: 'fill', pad: 12, r: 'radius/md', fill: 'bg/field', stroke: 'border/default', ay: 'start' },
            T(
              'Four of the six steps need most of one bounce of travel. Committing horizontally early, and holding it, is the only way across; a late correction lands short.',
              { style: 'Body/13', w: 'fill', lh: 19 },
            ),
          ),
        ),
        callout(
          'ok',
          'Floors 1–19 covered',
          'Four phrases in order, no gaps or overlaps. The race takes floors 1–19.',
        ),
      ),
      R(
        { name: 'footer', w: 'fill', h: 68, pad: [12, 12], gap: 8 },
        btn('Reroll seed', { icon: 'dice', w: 'fill' }),
        btn('Fit phrases', { icon: 'check', w: 'fill', disabled: true }),
      ),
    )

    // dock: the floor strip
    const cells = []
    for (let f = 1; f <= 50; f++) {
      const x = 16 + (f - 1) * 22.12
      const ph = f <= 19 ? phaseOf(f) : null
      const c = ph ? phaseColor(ph) : 'text/dim'
      const d = demand[f]
      cells.push(
        F(
          {
            name: `cell ${f}`,
            x,
            y: 56,
            w: 20,
            h: 48,
            r: 4,
            fill: alpha(c, ph ? 0.2 : 0.07),
            stroke: f === SEL ? 'accent/default' : null,
            sw: 1.5,
          },
          F({ x: 0, y: 0, w: 20, h: 3, fill: ph ? c : 'border/strong' }),
          F({
            x: 3,
            y: 48 - Math.round(d * 38),
            w: 14,
            h: Math.round(d * 38),
            r: 2,
            fill: alpha(dColor(d), d > 0.85 ? 0.9 : 0.5),
          }),
        ),
        f % 5 === 0 || f === SEL
          ? T(String(f), {
              x: x + (f < 10 ? 6 : 3),
              y: 108,
              style: 'Mono/11',
              color: f === SEL ? 'accent/default' : 'text/faint',
            })
          : null,
      )
    }
    const dock = region(
      'dock',
      56,
      686,
      1138,
      148,
      { fill: 'bg/surface' },
      line(0, 0, 1138, 1),
      R(
        { x: 0, y: 0, w: 1138, h: 44, pad: [0, 16], gap: 10 },
        eyebrow('Floors'),
        T(`Floor ${SEL}`, { style: 'Mono/12' }),
        T(`demand ${demandOf(SEL).toFixed(2)} · combine`, { style: 'Mono/11', color: 'text/dim' }),
        spacer(),
        pill('demand per floor', { color: 'text/dim', dot: true }),
        pill('floors 1–50', { color: 'text/dim', mono: true }),
      ),
      cells,
    )

    return F(
      { name: 'Course · seed 35229 · iPad landscape', w: 1194, h: 834, fill: 'bg/app', clip: true },
      topbar(1194),
      rail(782, 1),
      panel,
      canvas,
      inspector,
      dock,
      line(0, 51, 1194, 1),
      line(55, 52, 1, 782),
      line(319, 52, 1, 634),
      line(873, 52, 1, 634),
    )
  },
})

// ── Set pieces: the story of a climb ──
screens.push({
  id: 'pieces',
  page: '2D · Stage',
  name: 'Set pieces · skyFlash at floor 45 · iPad landscape',
  w: 1194,
  h: 834,
  note: 'Pieces grouped by floor, the selected one playing over the composition, kind-specific fields with the flash-rate check, and a lane per kind across the climb.',
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
      region,
      line,
      eyebrow,
      label,
      pill,
      btn,
      ib,
      seg,
      field,
      tabs,
      panelHead,
      rail,
      topbar,
      sceneCard,
      callout,
      inputBox,
      tx,
    } = P
    const SEL = 3
    const sel = D.pieces[SEL]
    const secs = (ms) => `${(ms / 1000).toFixed(1)} s`
    const floors = [...new Set(D.pieces.map((p) => p.floor))]
    const rowsOf = []
    for (const f of floors) {
      rowsOf.push(
        R(
          { w: 'fill', h: 28, pad: [0, 8] },
          T(`FLOOR ${f}`, { style: 'Mono/11', color: 'text/faint', ls: 1 }),
        ),
      )
      D.pieces.forEach((p, i) => {
        if (p.floor !== f) return
        const k = D.kinds[p.kind]
        rowsOf.push(
          R(
            {
              name: `piece/${p.kind}@${p.floor}`,
              w: 'fill',
              h: 52,
              pad: [0, 8, 0, 8],
              gap: 10,
              r: 'radius/md',
              fill: i === SEL ? alpha('accent/default', 0.12) : null,
              stroke: i === SEL ? alpha('accent/default', 0.6) : null,
            },
            R(
              { w: 32, h: 32, ax: 'center', r: 8, fill: alpha(k.color, 0.18) },
              I(k.icon, { size: 16, color: k.color }),
            ),
            C(
              { w: 'fill', gap: 0 },
              T(p.kind, { style: 'Body/13 Medium' }),
              T(p.note || 'no options', { style: 'Mono/11', color: 'text/dim', w: 'fill', trunc: true }),
            ),
            T(secs(p.hold), { style: 'Mono/11', color: 'text/dim' }),
          ),
        )
      })
    }
    const panel = region(
      'pieces panel',
      56,
      52,
      264,
      634,
      { lay: 'col' },
      panelHead('Set pieces', ib('plus')),
      C({ name: 'piece list', w: 'fill', h: 'fill', pad: [0, 8], gap: 0, clip: true }, rowsOf),
    )

    const px = 150
    const py = 14
    const canvas = region(
      'canvas',
      320,
      52,
      554,
      634,
      { fill: 'bg/canvas' },
      F({
        name: 'device',
        x: px,
        y: py,
        w: 254,
        h: 549,
        r: 22,
        fill: 'bg/raised',
        stroke: 'border/strong',
        sw: 2,
      }),
      sceneCard(250, 541.7, { name: 'skyFlash preview', x: px + 2, y: py + 2, r: 20, flash: 0.22 }),
      R(
        {
          name: 'preview chip',
          x: 8,
          y: 8,
          h: 32,
          pad: [0, 12],
          gap: 8,
          r: 16,
          fill: 'bg/surface',
          stroke: 'border/default',
        },
        I('sparkle', { size: 14, color: 'state/warn' }),
        T('skyFlash at floor 45', { style: 'Mono/11' }),
      ),
      R(
        {
          name: 'race chip',
          x: 398,
          y: 8,
          h: 32,
          pad: [0, 12],
          gap: 8,
          r: 16,
          fill: 'bg/surface',
          stroke: 'border/default',
        },
        T('50-floor race', { style: 'Mono/11', color: 'text/dim' }),
      ),
      R(
        {
          name: 'transport',
          x: 8,
          y: 586,
          w: 538,
          h: 44,
          gap: 8,
          pad: [0, 8],
          r: 'radius/lg',
          fill: 'bg/surface',
          stroke: 'border/default',
        },
        ib('play', { on: true, s: 36 }),
        F(
          { name: 'track', w: 'fill', h: 4, r: 2, fill: 'border/strong' },
          F({ x: 0, y: 0, w: 168, h: 4, r: 2, fill: 'accent/default' }),
          F({ x: 118, y: -4, w: 2, h: 12, fill: 'state/warn' }),
          F({ x: 306, y: -4, w: 2, h: 12, fill: 'state/warn' }),
        ),
        T('2.4 s / 6.0 s', { style: 'Mono/11', color: 'text/dim' }),
      ),
    )

    const k = D.kinds[sel.kind]
    const inspector = region(
      'inspector',
      874,
      52,
      320,
      634,
      { lay: 'col' },
      tabs([{ label: 'Piece' }, { label: 'Checks', badge: '0' }], 0),
      F({ w: 'fill', h: 1, fill: 'border/default' }),
      C(
        { name: 'fields', w: 'fill', h: 'fill', pad: 12, gap: 8, clip: true },
        R(
          { w: 'fill', h: 32, gap: 8 },
          R(
            { w: 28, h: 28, ax: 'center', r: 8, fill: alpha(k.color, 0.18) },
            I(k.icon, { size: 16, color: k.color }),
          ),
          T(sel.kind, { style: 'Title/15' }),
          spacer(),
          pill(`floor ${sel.floor}`, { color: 'text/dim', mono: true }),
        ),
        field('Floor', String(sel.floor)),
        field('Hold', String(sel.hold), { unit: 'ms' }),
        field('Flashes', '2'),
        R(
          { w: 'fill', h: 44, gap: 8 },
          T('Tone', { style: 'Label/12', color: 'text/dim', w: 84 }),
          inputBox('lightning', { chevron: true, mono: true }),
        ),
        field('Kick', '3'),
        callout(
          'ok',
          'Under the flash limit',
          '2 flashes in 6.0 s is 0.33 a second. WCAG 2.3.1 allows up to 3 in any one second.',
        ),
      ),
      R(
        { name: 'footer', w: 'fill', h: 68, pad: [12, 12], gap: 8 },
        btn('Duplicate', { icon: 'copy', w: 'fill' }),
        btn('Delete', { kind: 'danger', icon: 'trash', w: 'fill' }),
      ),
    )

    const lanes = Object.keys(D.kinds)
    const kids = []
    for (let f = 0; f <= 50; f += 5)
      kids.push(T(String(f), { x: tx(f) - (f < 10 ? 3 : 6), y: 45, style: 'Mono/11', color: 'text/faint' }))
    lanes.forEach((kind, i) => {
      const y = 62 + i * 17
      const kc = D.kinds[kind].color
      kids.push(
        F({ name: `lane ${kind}`, x: 88, y: y + 8, w: 1034, h: 1, fill: 'border/default' }),
        T(kind, { x: 16, y: y + 1, style: 'Label/12', color: 'text/dim', size: 11 }),
      )
      D.pieces.forEach((p, j) => {
        if (p.kind !== kind) return
        const on = j === SEL
        kids.push(
          F(
            {
              name: `${p.kind}@${p.floor}`,
              x: Math.min(tx(p.floor) - 24, 1138 - 66),
              y,
              w: 48,
              h: 16,
              r: 8,
              fill: alpha(kc, on ? 0.45 : 0.22),
              stroke: kc,
              sw: on ? 2 : 1,
            },
            T(secs(p.hold), { x: 8, y: 1, size: 10, wt: 500, mono: true, color: 'text/primary' }),
          ),
        )
      })
    })
    kids.push(F({ name: 'playhead', x: tx(sel.floor) - 1, y: 44, w: 2, h: 104, fill: 'accent/default' }))
    const dock = region(
      'dock',
      56,
      686,
      1138,
      148,
      { fill: 'bg/surface' },
      line(0, 0, 1138, 1),
      R(
        { x: 0, y: 0, w: 1138, h: 44, pad: [0, 16], gap: 10 },
        eyebrow('Pieces by kind'),
        T('floors 1–50', { style: 'Mono/11', color: 'text/dim' }),
        spacer(),
        pill('placed on a 50-floor race, scaled to any other', { color: 'text/dim', h: 24 }),
      ),
      kids,
    )

    return F(
      {
        name: 'Set pieces · skyFlash at floor 45 · iPad landscape',
        w: 1194,
        h: 834,
        fill: 'bg/app',
        clip: true,
      },
      topbar(1194),
      rail(782, 2),
      panel,
      canvas,
      inspector,
      dock,
      line(0, 51, 1194, 1),
      line(55, 52, 1, 782),
      line(319, 52, 1, 634),
      line(873, 52, 1, 634),
    )
  },
})

// ── Home: stages in this workspace ──
screens.push({
  id: 'home',
  page: '2D · Home',
  name: 'Home · stages · iPad landscape',
  w: 1194,
  h: 834,
  note: 'Where a session starts: sources on the left (workspace, an attached folder, files), the four shipped stages with their validity, templates for a new stage, and the selected stage on the right.',
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
      region,
      line,
      eyebrow,
      label,
      pill,
      btn,
      ib,
      kv,
      sceneCard,
      inputBox,
      callout,
      dot,
    } = P
    const looks = {
      dawn: {
        vy: 230,
        hide: [
          'cloudsHigh',
          'cloudsLow',
          'birds',
          'rooftopsHorizon',
          'cityFar',
          'cityMid',
          'rooftopDetails',
          'rooftopProps',
        ],
      },
      rooftops: { vy: 260 },
      'snow-shrine': { vy: 260, tone: 'snow', hide: ['birds', 'rooftopsHorizon', 'cityMid', 'rooftopProps'] },
      'sunken-dome': {
        vy: 260,
        tone: 'deep',
        hide: ['clouds', 'cloudsHigh', 'cloudsLow', 'birds', 'rooftopDetails', 'rooftopProps'],
      },
    }
    const SEL = 1
    const card = (st, i) => {
      const col = i % 2
      const rowI = Math.floor(i / 2)
      const sel = i === SEL
      return C(
        {
          name: `stage/${st.id}`,
          x: 24 + col * 293,
          y: 72 + rowI * 238,
          w: 269,
          h: 222,
          gap: 0,
          r: 'radius/lg',
          fill: 'bg/surface',
          stroke: sel ? 'accent/default' : 'border/default',
          sw: sel ? 2 : 1,
          clip: true,
          shadow: sel ? 'card' : undefined,
        },
        sceneCard(269, 140, { ...looks[st.id], name: `${st.name} thumbnail` }),
        C(
          { w: 'fill', h: 'fill', pad: [10, 12], gap: 3 },
          R(
            { w: 'fill', gap: 8 },
            T(st.name, { style: 'Title/15' }),
            spacer(),
            pill('Valid', { color: 'state/ok', icon: 'check', h: 22, pad: 8 }),
          ),
          T(`content/stages/${st.file}`, { style: 'Mono/11', color: 'text/faint', w: 'fill', trunc: true }),
          T(`${st.seed ? `seed ${st.seed} · ` : ''}${st.layers} layers · ${st.pieces} pieces`, {
            style: 'Mono/11',
            color: 'text/dim',
            w: 'fill',
            trunc: true,
          }),
        ),
      )
    }
    const tmpl = (icon, name, sub, i) =>
      C(
        {
          name: `template/${name}`,
          x: 24 + i * 142,
          y: 616,
          w: 134,
          h: 96,
          pad: 12,
          gap: 6,
          r: 'radius/lg',
          fill: 'bg/surface',
          stroke: 'border/default',
        },
        I(icon, { size: 22, color: 'accent/default' }),
        T(name, { style: 'Body/13 Medium' }),
        T(sub, { style: 'Mono/11', color: 'text/dim', w: 'fill', trunc: true }),
      )

    const src = (icon, title, sub, sel) =>
      R(
        {
          name: `source/${title}`,
          w: 'fill',
          h: 56,
          pad: [0, 10],
          gap: 10,
          r: 'radius/md',
          fill: sel ? alpha('accent/default', 0.12) : null,
          stroke: sel ? alpha('accent/default', 0.6) : null,
        },
        I(icon, { size: 20, color: sel ? 'accent/default' : 'text/dim' }),
        C(
          { w: 'fill', gap: 0 },
          T(title, { style: 'Body/13 Medium', w: 'fill', trunc: true }),
          T(sub, { style: 'Mono/11', color: 'text/dim', w: 'fill', trunc: true }),
        ),
      )
    const panel = region(
      'sources panel',
      0,
      52,
      264,
      782,
      { lay: 'col' },
      R({ w: 'fill', h: 48, pad: [0, 16] }, eyebrow('Open from')),
      C(
        { w: 'fill', pad: [0, 8], gap: 2 },
        src('box', 'This workspace', '4 stages · browser storage', true),
        src('folder', 'floorfifty/content/stages', 'Folder · read and write', false),
        src('file', 'Files…', 'Pick .toml files', false),
      ),
      spacer(),
      C(
        { name: 'storage', w: 'fill', pad: 16, gap: 8 },
        F({ w: 'fill', h: 1, fill: 'border/default' }),
        eyebrow('Storage'),
        R({ w: 'fill', gap: 8 }, dot('state/ok', 8), T('Autosave on', { style: 'Body/13' })),
        R({ w: 'fill', gap: 8 }, dot('state/ok', 8), T('Persistent storage granted', { style: 'Body/13' })),
        T('Edits are kept in a journal until you export, so a crash never loses them.', {
          style: 'Label/12',
          color: 'text/dim',
          w: 'fill',
          lh: 16,
        }),
      ),
    )

    const centre = region(
      'stages',
      264,
      52,
      610,
      782,
      { fill: 'bg/app' },
      T('Stages', { x: 24, y: 24, style: 'Display/20' }),
      T('4 in this workspace', { x: 108, y: 29, style: 'Body/13', color: 'text/dim' }),
      R(
        { x: 366, y: 16, w: 220, h: 44 },
        inputBox('Search stages', { icon: 'search', dim: true, w: 'fill' }),
      ),
      D.stages.map(card),
      T('START FROM A TEMPLATE', { x: 24, y: 590, style: 'Eyebrow/11', color: 'text/dim', up: false }),
      tmpl('file', 'Empty', 'one sky plate', 0),
      tmpl('layers', 'Simple city', 'sky + 3 skylines', 1),
      tmpl('cloud', 'Sky only', 'plate and clouds', 2),
      tmpl('copy', 'Copy of…', 'start from a stage', 3),
    )

    const st = D.stages[SEL]
    const inspector = region(
      'summary',
      874,
      52,
      320,
      782,
      { lay: 'col' },
      C(
        { w: 'fill', h: 'fill', pad: 16, gap: 12 },
        sceneCard(288, 168, { ...looks.rooftops, name: 'preview', r: 12 }),
        R(
          { w: 'fill', gap: 8 },
          T(st.name, { style: 'Display/20' }),
          spacer(),
          pill('Valid', { color: 'state/ok', icon: 'check' }),
        ),
        C(
          { w: 'fill', gap: 0 },
          kv('File', 'rooftops.toml'),
          kv('Seed', String(st.seed)),
          kv('Layers', String(st.layers)),
          kv('Phrases', '4 + 3 extension'),
          kv('Set pieces', String(st.pieces)),
          kv('Modified', st.when, { mono: false }),
        ),
        callout(
          'ok',
          'No errors',
          'Opens clean. 2 notes: art aliases are unchecked until a manifest is loaded.',
        ),
        spacer(),
        btn('Open', { kind: 'primary', h: 48, icon: 'external', w: 'fill' }),
        R(
          { w: 'fill', gap: 8 },
          btn('Duplicate', { icon: 'copy', w: 'fill' }),
          btn('Export', { icon: 'download', w: 'fill' }),
        ),
        btn('Delete from workspace', { kind: 'danger', icon: 'trash', w: 'fill' }),
      ),
    )

    const top = region(
      'topbar',
      0,
      0,
      1194,
      52,
      { lay: 'row', ay: 'center', pad: [0, 8, 0, 16], gap: 10 },
      F(
        { name: 'mark', w: 28, h: 28, r: 8, fill: 'accent/default' },
        T('A', { x: 9, y: 5, style: 'Title/15', color: 'accent/ink' }),
      ),
      T('Automata Editor', { style: 'Title/15' }),
      spacer(),
      pill('Workspace · autosave on', { color: 'state/ok', dot: true, h: 32, pad: 12 }),
      btn('Open…', { icon: 'folder' }),
      btn('New stage', { kind: 'primary', h: 48, icon: 'plus' }),
    )

    return F(
      { name: 'Home · stages · iPad landscape', w: 1194, h: 834, fill: 'bg/app', clip: true },
      top,
      panel,
      centre,
      inspector,
      line(0, 51, 1194, 1),
      line(263, 52, 1, 782),
      line(873, 52, 1, 782),
    )
  },
})

// ── Checks: an error with its fixes ──
screens.push({
  id: 'checks',
  page: '2D · States',
  name: 'Checks · layer order error · iPad landscape',
  w: 1194,
  h: 834,
  note: 'After a depth drag breaks the city order: diagnostics grouped by severity, the offending layer outlined on the canvas, and the failing field with its two repairs. Export stays available (errors are shown, not enforced).',
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
      region,
      line,
      eyebrow,
      label,
      pill,
      btn,
      ib,
      field,
      tabs,
      panelHead,
      rail,
      topbar,
      sceneCard,
      diagRow,
      callout,
      seg,
    } = P
    const diags = [
      {
        sev: 'error',
        code: 'layerOrder',
        msg: 'cityMid is nearer than cityNear. Within the city, a layer may not be further than the one before it.',
        path: 'theme.layers[7].depth',
        fix: true,
      },
      {
        sev: 'warning',
        code: 'flashRate',
        msg: 'skyFlash at floor 45 flashes 20 times in 6.0 s: 3.3 a second, over the limit of 3.',
        path: 'theme.setPieces[3].flashes',
        fix: true,
      },
      {
        sev: 'info',
        code: 'unknownAssetAlias',
        msg: '12 art aliases are unchecked: no art manifest is loaded.',
        path: 'theme.layers',
      },
      {
        sev: 'info',
        code: 'emptyPurpose',
        msg: 'Extension 30–39 has no purpose text.',
        path: 'course.extension[1].purpose',
      },
    ]
    const chip = (text, n, c, on) =>
      R(
        {
          name: `filter/${text}`,
          h: 32,
          pad: [0, 10],
          gap: 6,
          r: 16,
          fill: on ? alpha(c, 0.16) : null,
          stroke: on ? alpha(c, 0.6) : 'border/default',
        },
        T(text, { style: 'Label/12', color: on ? c : 'text/dim' }),
        T(String(n), { style: 'Mono/11', color: on ? c : 'text/faint' }),
      )
    const panel = region(
      'checks panel',
      56,
      52,
      264,
      782,
      { lay: 'col' },
      panelHead('Checks'),
      R(
        { w: 'fill', h: 44, pad: [0, 12], gap: 6 },
        chip('Errors', 1, 'state/bad', true),
        chip('Warnings', 1, 'state/warn', true),
        chip('Info', 2, 'layer/sky', true),
      ),
      C(
        { name: 'diagnostics', w: 'fill', h: 'fill', pad: [4, 12], gap: 8, clip: true },
        diags.map((d, i) => diagRow(d, { sel: i === 0 })),
      ),
    )

    const px = 140
    const py = 96
    const canvas = region(
      'canvas',
      320,
      52,
      554,
      782,
      { fill: 'bg/canvas' },
      F({
        name: 'device',
        x: px,
        y: py,
        w: 274,
        h: 589,
        r: 22,
        fill: 'bg/raised',
        stroke: 'border/strong',
        sw: 2,
      }),
      sceneCard(270, 585, {
        name: 'Rooftops with cityMid out of order',
        x: px + 2,
        y: py + 2,
        r: 20,
        bad: true,
      }),
      F({
        name: 'offending layer',
        x: px + 2,
        y: py + 2 + 350,
        w: 270,
        h: 235,
        stroke: 'state/bad',
        sw: 1.5,
        dash: [5, 4],
      }),
      R(
        {
          name: 'tag',
          x: px + 2 + 12,
          y: py + 2 + 350 - 30,
          h: 24,
          pad: [0, 8],
          gap: 6,
          r: 6,
          fill: 'state/bad',
        },
        I('warn', { size: 12, color: 'bg/app' }),
        T('cityMid 0.40 > cityNear 0.35', { style: 'Mono/11', color: 'bg/app', wt: 600 }),
      ),
      R(
        {
          name: 'chip',
          x: 8,
          y: 8,
          h: 32,
          pad: [0, 12],
          gap: 8,
          r: 16,
          fill: 'bg/surface',
          stroke: 'border/default',
        },
        I('warn', { size: 14, color: 'state/bad' }),
        T('Preview still renders; the file will not compile', { style: 'Mono/11', color: 'text/dim' }),
      ),
    )

    const inspector = region(
      'inspector',
      874,
      52,
      320,
      782,
      { lay: 'col' },
      tabs([{ label: 'Layer' }, { label: 'Stage' }, { label: 'Checks', badge: '4', tone: 'state/bad' }], 2),
      F({ w: 'fill', h: 1, fill: 'border/default' }),
      C(
        { name: 'detail', w: 'fill', h: 'fill', pad: 12, gap: 10, clip: true },
        R(
          { w: 'fill', h: 28, gap: 8 },
          F({ w: 10, h: 10, r: 5, fill: 'state/bad' }),
          T('layerOrder', { style: 'Mono/12', color: 'state/bad', wt: 600 }),
          spacer(),
          pill('error', { color: 'state/bad' }),
        ),
        T(
          'cityMid is nearer than cityNear. Within the city, a layer may not be further than the one before it.',
          { style: 'Body/13', w: 'fill', lh: 19 },
        ),
        T('theme.layers[7].depth', { style: 'Mono/11', color: 'text/faint' }),
        field('Depth', '0.40', { bad: true }),
        T('Allowed here: 0.15 to 0.35', { style: 'Label/12', color: 'state/bad' }),
        C(
          {
            name: 'order',
            w: 'fill',
            pad: 10,
            gap: 6,
            r: 'radius/md',
            fill: 'bg/field',
            stroke: 'border/default',
          },
          eyebrow('City order, far to near'),
          ...[
            ['cityFar', '0.15', false],
            ['cityMid', '0.40', true],
            ['cityNear', '0.35', false],
          ].map(([n, d, bad]) =>
            R(
              { w: 'fill', h: 24, gap: 8 },
              I(bad ? 'warn' : 'check', { size: 14, color: bad ? 'state/bad' : 'state/ok' }),
              T(n, { style: 'Mono/12', color: bad ? 'state/bad' : 'text/primary' }),
              spacer(),
              T(d, { style: 'Mono/12', color: bad ? 'state/bad' : 'text/dim' }),
            ),
          ),
        ),
        spacer(),
        eyebrow('Fixes'),
        btn('Reorder: put cityMid after cityNear', { kind: 'primary', h: 48, w: 'fill', icon: 'arrow-down' }),
        btn('Lower depth to 0.35', { w: 'fill', icon: 'check' }),
        T('Either is one undo step.', { style: 'Label/12', color: 'text/dim' }),
      ),
    )

    return F(
      { name: 'Checks · layer order error · iPad landscape', w: 1194, h: 834, fill: 'bg/app', clip: true },
      topbar(1194, { dirty: true, checks: '1 error', tone: 'state/bad', noRedo: true }),
      rail(782, 0),
      panel,
      canvas,
      inspector,
      line(0, 51, 1194, 1),
      line(55, 52, 1, 782),
      line(319, 52, 1, 782),
      line(873, 52, 1, 782),
    )
  },
})

// ── Level: LDtk-style tile painting ──
screens.push({
  id: 'level',
  page: '2D · Level',
  name: 'Level · Courtyard · iPad landscape',
  w: 1194,
  h: 834,
  note: 'The generic level editor: tools on the rail, layers and the tileset palette on the left, the level on the canvas with a selected entity and its reference, typed entity fields on the right, and the levels of the world below.',
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
      region,
      line,
      eyebrow,
      label,
      pill,
      btn,
      ib,
      seg,
      field,
      tabs,
      panelHead,
      rail,
      topbar,
      rng,
      callout,
      inputBox,
      dot,
    } = P
    const TOOLS = [
      ['cursor', 'Select'],
      ['brush', 'Brush'],
      ['rect', 'Rect'],
      ['bucket', 'Fill'],
      ['eraser', 'Erase'],
      ['pick', 'Pick'],
      ['stamp', 'Stamp'],
      ['dice', 'Random'],
    ]

    // layers
    const layerRowL = (icon, name, sub, color, o = {}) =>
      R(
        {
          name: `layer/${name}`,
          w: 'fill',
          h: 48,
          pad: [0, 8, 0, 8],
          gap: 8,
          r: 'radius/md',
          fill: o.sel ? alpha('accent/default', 0.12) : null,
          stroke: o.sel ? alpha('accent/default', 0.6) : null,
        },
        I('eye', { size: 16, color: 'text/dim' }),
        R({ w: 28, h: 28, ax: 'center', r: 6, fill: alpha(color, 0.2) }, I(icon, { size: 16, color })),
        C(
          { w: 'fill', gap: 0 },
          T(name, { style: 'Body/13 Medium' }),
          T(sub, { style: 'Mono/11', color: 'text/dim' }),
        ),
        I('lock', { size: 14, color: o.locked ? 'accent/default' : 'text/faint' }),
      )
    const swatches = [
      '#7a4a3e',
      '#c7794f',
      '#4e5568',
      '#3b4258',
      '#6a5a4a',
      '#8fa0c0',
      '#5a8f6a',
      '#d9a23a',
      '#2c3350',
      '#a58be0',
      '#6aa8e8',
      '#e07a6a',
      '#9b6a4a',
      '#5b6275',
      '#b9c4dc',
      '#3f6f8a',
      '#8a4f3f',
      '#e0a54a',
      '#2e3556',
      '#c04a8a',
      '#4a7a5a',
      '#6a6a78',
      '#d8d4dc',
      '#1d2240',
    ]
    const tiles = swatches.map((c, i) =>
      F(
        {
          name: `tile ${i}`,
          x: 16 + (i % 6) * 38,
          y: ((i / 6) | 0) * 38,
          w: 34,
          h: 34,
          r: 4,
          fill: c,
          stroke: i === 1 ? 'accent/default' : 'border/default',
          sw: i === 1 ? 2 : 1,
        },
        i % 3 === 0 ? F({ x: 0, y: 0, w: 34, h: 6, fill: '#ffffff', op: 0.18 }) : null,
      ),
    )
    const panel = region(
      'level panel',
      56,
      52,
      264,
      634,
      { lay: 'col' },
      panelHead('Layers', ib('plus')),
      C(
        { w: 'fill', pad: [0, 8], gap: 2 },
        layerRowL('box', 'Entities', 'Entities layer', 'layer/entities'),
        layerRowL('tile', 'Tiles', 'Tiles · rooftop-tiles', 'layer/tiles', { sel: true }),
        layerRowL('grid', 'Collision', 'IntGrid · 3 values', 'layer/intgrid', { locked: true }),
        layerRowL('image', 'Backdrop', 'Tiles · parallax', 'layer/sky'),
      ),
      R(
        { w: 'fill', h: 36, pad: [8, 16, 0, 16] },
        eyebrow('Tileset · rooftop-tiles'),
        spacer(),
        T('16 px', { style: 'Mono/11', color: 'text/faint' }),
      ),
      F({ name: 'palette', w: 'fill', h: 160 }, tiles),
      R(
        { w: 'fill', h: 44, pad: [0, 16], gap: 6 },
        pill('Flip X', { color: 'text/dim', h: 28, pad: 12 }),
        pill('Flip Y', { color: 'text/dim', h: 28, pad: 12 }),
        pill('Auto-layer', { color: 'text/faint', h: 28, pad: 12 }),
      ),
    )

    // canvas: a 32 x 36 tilemap at 16 px
    const TS = 16
    const COLS = 32
    const ROWS = 36
    const grid = Array.from({ length: ROWS }, () => Array(COLS).fill(0))
    const put = (r, c0, c1, t) => {
      for (let c = c0; c <= c1; c++) grid[r][c] = t
    }
    for (let r = 32; r < ROWS; r++) put(r, 0, COLS - 1, r === 32 ? 2 : 1)
    for (let r = 6; r < 32; r++) {
      put(r, 0, 1, 3)
      put(r, 30, 31, 3)
    }
    for (const [r, a, b] of [
      [28, 5, 11],
      [25, 14, 20],
      [22, 22, 28],
      [19, 8, 14],
      [16, 17, 23],
      [13, 4, 9],
      [10, 12, 18],
    ]) {
      put(r, a, b, 2)
      put(r + 1, a, b, 1)
    }
    const fills = { 1: '#7a4a3e', 2: '#8a523f', 3: '#4e5568' }
    let rects = ''
    for (let r = 0; r < ROWS; r++) {
      let c = 0
      while (c < COLS) {
        const t = grid[r][c]
        if (!t) {
          c++
          continue
        }
        let e = c
        while (e + 1 < COLS && grid[r][e + 1] === t) e++
        rects += `<rect x="${c * TS}" y="${r * TS}" width="${(e - c + 1) * TS}" height="${TS}" fill="${fills[t]}"/>`
        if (t === 2)
          rects += `<rect x="${c * TS}" y="${r * TS}" width="${(e - c + 1) * TS}" height="3" fill="#c7794f"/>`
        c = e + 1
      }
    }
    let lines = ''
    for (let i = 0; i <= COLS; i++) lines += `M${i * TS} 0V${ROWS * TS}`
    for (let i = 0; i <= ROWS; i++) lines += `M0 ${i * TS}H${COLS * TS}`
    const W = COLS * TS
    const H = ROWS * TS
    const level = V(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="#14161c"/>${rects}<path d="${lines}" stroke="#ffffff" stroke-opacity=".07" stroke-width="1" fill="none"/><path d="M${12 * TS} ${33 * TS - 1}l8 -14l8 14zM${16 * TS + 8} ${33 * TS - 1}l8 -14l8 14z" fill="#d9645a"/></svg>`,
      { name: 'tilemap', x: 21, y: 12, w: W, h: H },
    )
    const ox = 21
    const oy = 12
    const at = (c, r) => [ox + c * TS, oy + r * TS]
    const [sx, sy] = at(6, 27)
    const [ex, ey] = at(16, 24)
    const [dx, dy] = at(15, 8)
    const [e2x, e2y] = at(10, 18)
    const pick = (c, r) => {
      const [x, y] = at(c, r)
      return F({ name: 'coin', x: x + 4, y: y + 4, w: 8, h: 8, r: 4, fill: 'state/warn' })
    }
    const canvas = region(
      'canvas',
      320,
      52,
      554,
      634,
      { fill: 'bg/canvas' },
      level,
      F({ name: 'Start', x: sx + 2, y: sy - 16, w: 12, h: 16, r: 4, fill: 'state/ok' }),
      F({ name: 'Slime A', x: ex, y: ey + 4, w: 16, h: 12, r: 6, fill: 'state/bad' }),
      F({ name: 'Slime B', x: e2x, y: e2y + 4, w: 16, h: 12, r: 6, fill: 'state/bad' }),
      F(
        {
          name: 'Door',
          x: dx,
          y: dy - 8,
          w: 16,
          h: 24,
          r: 3,
          fill: alpha('accent/default', 0.25),
          stroke: 'accent/default',
        },
        I('door', { size: 12, color: 'accent/default', x: 2, y: 6 }),
      ),
      pick(7, 26),
      pick(8, 26),
      pick(16, 23),
      pick(10, 17),
      pick(19, 14),
      pick(20, 14),
      V(
        `<svg xmlns="http://www.w3.org/2000/svg" width="554" height="634" viewBox="0 0 554 634"><path d="M${ex + 8} ${ey + 8}C${ex + 8} ${ey - 80} ${dx + 8} ${dy + 100} ${dx + 8} ${dy + 24}" stroke="#e0a54a" stroke-width="1.4" stroke-dasharray="4 3" fill="none"/></svg>`,
        { name: 'reference', x: 0, y: 0, w: 554, h: 634 },
      ),
      F({
        name: 'selection',
        x: ex - 3,
        y: ey + 1,
        w: 22,
        h: 18,
        stroke: 'accent/default',
        sw: 1.5,
        dash: [4, 3],
      }),
      ...[
        [-4, 0],
        [18, 0],
        [-4, 16],
        [18, 16],
      ].map(([a, b]) =>
        F({
          name: 'handle',
          x: ex + a,
          y: ey + 1 + b - 3,
          w: 7,
          h: 7,
          fill: 'accent/default',
          stroke: 'bg/canvas',
          sw: 1,
        }),
      ),
      R(
        { name: 'entity tag', x: ex + 24, y: ey - 22, h: 22, pad: [0, 8], r: 6, fill: 'accent/default' },
        T('Slime · 12, 24', { style: 'Mono/11', color: 'accent/ink', wt: 600 }),
      ),
      R(
        {
          name: 'grid chip',
          x: 8,
          y: 598,
          h: 28,
          pad: [0, 10],
          gap: 8,
          r: 14,
          fill: 'bg/surface',
          stroke: 'border/default',
        },
        I('magnet', { size: 14, color: 'accent/default' }),
        T('snap · 16 px', { style: 'Mono/11', color: 'text/dim' }),
      ),
      R(
        {
          name: 'input chip',
          x: 326,
          y: 598,
          h: 28,
          pad: [0, 10],
          gap: 8,
          r: 14,
          fill: 'bg/surface',
          stroke: 'border/default',
        },
        I('pencil', { size: 14, color: 'text/dim' }),
        T('Pencil draws · finger pans', { style: 'Mono/11', color: 'text/dim' }),
      ),
    )

    const inspector = region(
      'inspector',
      874,
      52,
      320,
      634,
      { lay: 'col' },
      tabs([{ label: 'Entity' }, { label: 'Level' }, { label: 'Checks', badge: '0' }], 0),
      F({ w: 'fill', h: 1, fill: 'border/default' }),
      C(
        { name: 'fields', w: 'fill', h: 'fill', pad: 12, gap: 8, clip: true },
        R(
          { w: 'fill', h: 32, gap: 8 },
          R(
            { w: 28, h: 28, ax: 'center', r: 8, fill: alpha('layer/entities', 0.2) },
            I('box', { size: 16, color: 'layer/entities' }),
          ),
          T('Slime', { style: 'Title/15' }),
          spacer(),
          pill('Entities', { color: 'layer/entities' }),
        ),
        field('X', '12', { unit: 'tiles' }),
        field('Y', '24', { unit: 'tiles' }),
        field('hp', '3', { unit: 'int' }),
        R(
          { w: 'fill', h: 44, gap: 8 },
          T('patrol', { style: 'Label/12', color: 'text/dim', w: 84 }),
          seg(['still', 'walk', 'jump'], 1),
        ),
        R(
          { w: 'fill', h: 44, gap: 8 },
          T('target', { style: 'Label/12', color: 'text/dim', w: 84 }),
          inputBox('Door', { icon: 'link', chevron: true }),
        ),
        R(
          { w: 'fill', h: 44, gap: 8 },
          T('tint', { style: 'Label/12', color: 'text/dim', w: 84 }),
          R(
            {
              w: 'fill',
              h: 44,
              pad: [0, 12],
              gap: 10,
              r: 'radius/md',
              fill: 'bg/field',
              stroke: 'border/default',
            },
            F({ w: 20, h: 20, r: 5, fill: 'state/bad' }),
            T('#d9645a', { style: 'Mono/12' }),
          ),
        ),
        R(
          { w: 'fill', gap: 8, h: 32 },
          T('tags', { style: 'Label/12', color: 'text/dim', w: 84 }),
          pill('enemy', { color: 'text/dim' }),
          pill('ground', { color: 'text/dim' }),
          pill('+', { color: 'accent/default' }),
        ),
      ),
      R(
        { name: 'footer', w: 'fill', h: 68, pad: [12, 12], gap: 8 },
        btn('Duplicate', { icon: 'copy', w: 'fill' }),
        btn('Delete', { kind: 'danger', icon: 'trash', w: 'fill' }),
      ),
    )

    // dock: the levels of the world
    const names = ['Courtyard', 'Stairwell', 'Rooftop run', 'Boiler room', 'Clock tower']
    const cards = names.map((n, i) =>
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
          stroke: i === 0 ? 'accent/default' : 'border/default',
          sw: i === 0 ? 2 : 1,
          clip: true,
        },
        F(
          { w: 'fill', h: 56, fill: 'bg/canvas' },
          F({ x: 8, y: 40, w: 148, h: 12, fill: '#7a4a3e' }),
          F({ x: 30 + i * 9, y: 26, w: 40, h: 5, fill: '#8a523f' }),
          F({ x: 90, y: 14 + (i % 2) * 6, w: 36, h: 5, fill: '#8a523f' }),
        ),
        R(
          { w: 'fill', h: 32, pad: [0, 10], gap: 6 },
          T(n, { style: 'Label/12' }),
          spacer(),
          T(['32×36', '24×48', '64×24', '32×28', '28×60'][i], { style: 'Mono/11', color: 'text/faint' }),
        ),
      ),
    )
    const dock = region(
      'dock',
      56,
      686,
      1138,
      148,
      { fill: 'bg/surface' },
      line(0, 0, 1138, 1),
      R(
        { x: 0, y: 2, w: 1138, h: 48, pad: [0, 16], gap: 10 },
        eyebrow('World'),
        T('Rooftop climb · 5 levels', { style: 'Mono/11', color: 'text/dim' }),
        spacer(),
        btn('World map', { icon: 'world' }),
      ),
      cards,
      R(
        {
          name: 'new level',
          x: 16 + 5 * 176,
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

    return F(
      { name: 'Level · Courtyard · iPad landscape', w: 1194, h: 834, fill: 'bg/app', clip: true },
      topbar(1194, {
        title: 'Courtyard',
        file: 'levels/courtyard.af2d.json',
        kind: 'Level',
        center: seg(['Level', 'World', 'Definitions'], 0, { w: 300 }),
        checks: 'Checks ok',
        tone: 'state/ok',
      }),
      rail(782, 1, TOOLS),
      panel,
      canvas,
      inspector,
      dock,
      line(0, 51, 1194, 1),
      line(55, 52, 1, 782),
      line(319, 52, 1, 634),
      line(873, 52, 1, 634),
    )
  },
})

// ── World map ──
screens.push({
  id: 'world',
  page: '2D · Level',
  name: 'World map · free layout · iPad landscape',
  w: 1194,
  h: 834,
  note: "Levels as rectangles on a free canvas with depth, a portal link between two of them, and the selected level's world position, size and fields on the right.",
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
      region,
      line,
      eyebrow,
      label,
      pill,
      btn,
      ib,
      seg,
      field,
      tabs,
      panelHead,
      rail,
      topbar,
      rng,
      inputBox,
      callout,
    } = P
    const WORLD_RAIL = [
      ['cursor', 'Select'],
      ['hand', 'Pan'],
      ['plus', 'Add'],
      ['link', 'Link'],
    ]
    const levels = [
      { n: 'Courtyard', s: '32×36', x: 60, y: 400, w: 150, h: 168, sel: true },
      { n: 'Stairwell', s: '24×48', x: 250, y: 318, w: 112, h: 234 },
      { n: 'Rooftop run', s: '64×24', x: 60, y: 190, w: 300, h: 112 },
      { n: 'Boiler room', s: '32×28', x: 390, y: 470, w: 140, h: 120 },
      { n: 'Clock tower', s: '28×60', x: 390, y: 160, w: 128, h: 280 },
    ]
    const listRow = (l) =>
      R(
        {
          name: `level/${l.n}`,
          w: 'fill',
          h: 52,
          pad: [0, 8, 0, 12],
          gap: 10,
          r: 'radius/md',
          fill: l.sel ? alpha('accent/default', 0.12) : null,
          stroke: l.sel ? alpha('accent/default', 0.6) : null,
        },
        F({ w: 4, h: 28, r: 2, fill: l.sel ? 'accent/default' : 'border/strong' }),
        C(
          { w: 'fill', gap: 0 },
          T(l.n, { style: 'Body/13 Medium' }),
          T(`${l.s} tiles`, { style: 'Mono/11', color: 'text/dim' }),
        ),
        I('chevron-right', { size: 16, color: 'text/faint' }),
      )
    const panel = region(
      'levels panel',
      56,
      52,
      264,
      782,
      { lay: 'col' },
      panelHead('Levels', ib('plus')),
      C({ w: 'fill', h: 'fill', pad: [0, 8], gap: 2, clip: true }, levels.map(listRow)),
    )
    let dots = ''
    for (let x = 20; x < 554; x += 40) for (let y = 20; y < 782; y += 40) dots += `M${x} ${y}h1`
    const levelBox = (l) => {
      const r = rng(l.w + l.h)
      const bits = []
      for (let i = 0; i < 6; i++)
        bits.push(
          F({
            x: 8 + Math.floor(r() * (l.w - 52)),
            y: 34 + Math.floor(r() * Math.max(10, l.h - 50)),
            w: 28 + Math.floor(r() * 24),
            h: 5,
            fill: '#7a4a3e',
            op: 0.8,
          }),
        )
      bits.push(F({ x: 0, y: l.h - 16, w: l.w, h: 16, fill: '#7a4a3e', op: 0.8 }))
      return F(
        {
          name: `level ${l.n}`,
          x: l.x,
          y: l.y,
          w: l.w,
          h: l.h,
          r: 8,
          fill: 'bg/surface',
          stroke: l.sel ? 'accent/default' : 'border/strong',
          sw: l.sel ? 2 : 1,
          clip: true,
          shadow: l.sel ? 'card' : undefined,
        },
        bits,
        T(l.n, { x: 8, y: 6, style: 'Body/13 Medium' }),
        T(l.s, { x: 8, y: 20, style: 'Mono/11', color: 'text/faint' }),
      )
    }
    const canvas = region(
      'canvas',
      320,
      52,
      554,
      782,
      { fill: 'bg/canvas' },
      V(
        `<svg xmlns="http://www.w3.org/2000/svg" width="554" height="782" viewBox="0 0 554 782"><path d="${dots}" stroke="#ffffff" stroke-opacity=".18" stroke-width="2" stroke-linecap="round" fill="none"/><path d="M210 480H250" stroke="#e0a54a" stroke-width="1.6" stroke-dasharray="4 3" fill="none"/><path d="M362 400H390" stroke="#454952" stroke-width="1.4" stroke-dasharray="4 3" fill="none"/><circle cx="210" cy="480" r="4" fill="#e0a54a"/><circle cx="250" cy="480" r="4" fill="#e0a54a"/></svg>`,
        { name: 'grid and links', x: 0, y: 0, w: 554, h: 782 },
      ),
      levels.map(levelBox),
      ...[
        [56, 396],
        [206, 396],
        [56, 564],
        [206, 564],
      ].map(([a, b]) =>
        F({ name: 'handle', x: a, y: b, w: 8, h: 8, fill: 'accent/default', stroke: 'bg/canvas', sw: 1 }),
      ),
      R(
        {
          name: 'link tag',
          x: 60,
          y: 576,
          h: 22,
          pad: [0, 8],
          gap: 6,
          r: 6,
          fill: alpha('accent/default', 0.2),
          stroke: 'accent/default',
        },
        I('portal', { size: 12, color: 'accent/default' }),
        T('east → Stairwell', { style: 'Mono/11', color: 'accent/default' }),
      ),
      R({ name: 'layout', x: 8, y: 8, w: 250, h: 44 }, seg(['Free', 'GridVania', 'Linear'], 0, { w: 250 })),
      R(
        {
          name: 'zoom',
          x: 430,
          y: 738,
          h: 36,
          pad: [0, 4],
          r: 'radius/md',
          fill: 'bg/surface',
          stroke: 'border/default',
        },
        ib('minus', { s: 36, size: 16 }),
        T('50%', { style: 'Mono/11', w: 34, align: 'center' }),
        ib('plus', { s: 36, size: 16 }),
      ),
    )

    const inspector = region(
      'inspector',
      874,
      52,
      320,
      782,
      { lay: 'col' },
      tabs([{ label: 'Level' }, { label: 'Project' }], 0),
      F({ w: 'fill', h: 1, fill: 'border/default' }),
      C(
        { name: 'fields', w: 'fill', h: 'fill', pad: 12, gap: 8, clip: true },
        R(
          { w: 'fill', h: 44, gap: 8 },
          T('Name', { style: 'Label/12', color: 'text/dim', w: 84 }),
          inputBox('Courtyard'),
        ),
        eyebrow('World position'),
        field('X', '12', { unit: 'tiles' }),
        field('Y', '18', { unit: 'tiles' }),
        field('Depth', '0'),
        eyebrow('Size'),
        field('Width', '32', { unit: 'tiles' }),
        field('Height', '36', { unit: 'tiles' }),
        R(
          { w: 'fill', h: 44, gap: 8 },
          T('Backdrop', { style: 'Label/12', color: 'text/dim', w: 84 }),
          R(
            {
              w: 'fill',
              h: 44,
              pad: [0, 12],
              gap: 10,
              r: 'radius/md',
              fill: 'bg/field',
              stroke: 'border/default',
            },
            F({ w: 20, h: 20, r: 5, fill: 'bg/canvas', stroke: 'border/strong' }),
            T('#0a0b0d', { style: 'Mono/12' }),
          ),
        ),
        eyebrow('Neighbours'),
        R(
          {
            w: 'fill',
            h: 44,
            pad: [0, 12],
            gap: 10,
            r: 'radius/md',
            fill: 'bg/field',
            stroke: 'border/default',
          },
          I('portal', { size: 16, color: 'accent/default' }),
          T('Stairwell', { style: 'Body/13' }),
          spacer(),
          T('east', { style: 'Mono/11', color: 'text/dim' }),
        ),
      ),
      R(
        { name: 'footer', w: 'fill', h: 68, pad: [12, 12], gap: 8 },
        btn('Open level', { kind: 'primary', h: 48, w: 'fill', icon: 'external' }),
      ),
    )

    return F(
      { name: 'World map · free layout · iPad landscape', w: 1194, h: 834, fill: 'bg/app', clip: true },
      topbar(1194, {
        title: 'Rooftop climb',
        file: 'rooftop-climb.af2d.json',
        kind: 'Level project',
        center: seg(['Level', 'World', 'Definitions'], 1, { w: 300 }),
        checks: 'Checks ok',
        tone: 'state/ok',
      }),
      rail(782, 0, WORLD_RAIL),
      panel,
      canvas,
      inspector,
      line(0, 51, 1194, 1),
      line(55, 52, 1, 782),
      line(319, 52, 1, 782),
      line(873, 52, 1, 782),
    )
  },
})

// ── Compose, portrait: the `medium` shell ──
screens.push({
  id: 'compose-portrait',
  page: '2D · Stage',
  name: 'Compose · Rooftops · iPad portrait',
  w: 834,
  h: 1194,
  note: "The same document in the medium shell: the canvas takes the full width, layers open as a drawer, fields as a second drawer, and the climb is a bottom sheet above the tab bar. A floating bar keeps the selected layer's sink within thumb reach.",
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
      region,
      line,
      eyebrow,
      pill,
      btn,
      ib,
      panelHead,
      layerRow,
      artRow,
      checksPill,
      sceneCard,
      dock,
      RAIL,
    } = P
    const k = 380 / 270
    const dx = 370
    const dy = 14
    const front = [...D.layers].reverse()
    const top = region(
      'topbar',
      0,
      0,
      834,
      52,
      { lay: 'row', ay: 'center', pad: [0, 8], gap: 8 },
      ib('layers', { on: true }),
      C(
        { gap: 0 },
        T('Rooftops', { style: 'Title/15' }),
        T(D.stage.file, { style: 'Mono/11', color: 'text/faint' }),
      ),
      spacer(),
      ib('undo'),
      ib('redo', { disabled: true }),
      checksPill('2 info', 'text/dim'),
      ib('slider'),
      btn('Export', { kind: 'primary', h: 48, icon: 'download' }),
    )
    const canvas = region(
      'canvas',
      0,
      52,
      834,
      910,
      { fill: 'bg/canvas' },
      F({
        name: 'device',
        x: dx,
        y: dy,
        w: 384,
        h: 827,
        r: 26,
        fill: 'bg/raised',
        stroke: 'border/strong',
        sw: 2,
      }),
      sceneCard(380, 585 * k, { name: 'Rooftops at floor 8', x: dx + 2, y: dy + 2, r: 24, course: true }),
      F({
        name: 'selection extent',
        x: dx + 2,
        y: dy + 2 + 350 * k,
        w: 380,
        h: 235 * k,
        stroke: 'accent/default',
        sw: 1.5,
        dash: [5, 4],
      }),
      F({
        name: 'sink handle halo',
        x: dx + 2 + 190 - 24,
        y: dy + 2 + 350 * k - 24,
        w: 48,
        h: 48,
        r: 24,
        fill: alpha('accent/default', 0.2),
      }),
      F({
        name: 'sink handle',
        x: dx + 2 + 190 - 16,
        y: dy + 2 + 350 * k - 16,
        w: 32,
        h: 32,
        r: 16,
        fill: 'accent/default',
        stroke: 'bg/canvas',
        sw: 2,
      }),
      I('arrow-up', {
        x: dx + 2 + 190 - 11,
        y: dy + 2 + 350 * k - 14,
        size: 12,
        color: 'accent/ink',
        sw: 2.4,
      }),
      I('arrow-down', {
        x: dx + 2 + 190 - 1,
        y: dy + 2 + 350 * k + 2,
        size: 12,
        color: 'accent/ink',
        sw: 2.4,
      }),
      R(
        {
          name: 'selection tag',
          x: dx + 2 + 214,
          y: dy + 2 + 350 * k - 44,
          h: 26,
          pad: [0, 10],
          r: 6,
          fill: 'accent/default',
        },
        T('cityMid · sink 270', { style: 'Mono/12', color: 'accent/ink', wt: 600 }),
      ),
      R(
        {
          name: 'selected layer bar',
          x: 400,
          y: 852,
          h: 52,
          pad: [0, 6],
          gap: 2,
          r: 26,
          fill: 'bg/surface',
          stroke: 'border/strong',
          shadow: 'card',
        },
        ib('minus'),
        T('sink 270', { style: 'Mono/12', w: 84, align: 'center' }),
        ib('plus'),
        F({ w: 1, h: 24, fill: 'border/default' }),
        ib('copy'),
        ib('trash', { color: 'state/bad' }),
      ),
      R(
        {
          name: 'viewport chip',
          x: 316,
          y: 8,
          h: 32,
          pad: [0, 12],
          gap: 8,
          r: 16,
          fill: 'bg/surface',
          stroke: 'border/default',
        },
        T('Phone 390×844', { style: 'Mono/11' }),
        I('chevron-down', { size: 14, color: 'text/dim' }),
      ),
    )
    const drawer = region(
      'layers drawer',
      0,
      52,
      300,
      910,
      { lay: 'col' },
      panelHead('Layers', ib('plus'), ib('close')),
      R({ w: 'fill', h: 20, pad: [0, 16] }, T('FRONT', { style: 'Mono/11', color: 'text/faint', ls: 1 })),
      C(
        { name: 'layer list', w: 'fill', pad: [0, 8], gap: 0 },
        front.map((l) => layerRow(l, { sel: l.a === 'cityMid' })),
      ),
      R({ w: 'fill', h: 20, pad: [0, 16] }, T('BACK', { style: 'Mono/11', color: 'text/faint', ls: 1 })),
      C(
        { name: 'stage art', w: 'fill', pad: [8, 8], gap: 0 },
        F({ w: 'fill', h: 1, fill: 'border/default' }),
        R({ w: 'fill', h: 28, pad: [0, 8] }, eyebrow('Stage art')),
        artRow('sun', 'Sun', 'world.sun'),
        artRow('image', 'Select still', 'still.rooftopsPreview'),
      ),
    )
    const sheet = F(
      { name: 'climb sheet', x: 0, y: 962, w: 834, h: 168, fill: 'bg/surface' },
      F({ x: 0, y: 0, w: 834, h: 1, fill: 'border/default' }),
      F({ name: 'handle', x: 399, y: 8, w: 36, h: 4, r: 2, fill: 'border/strong' }),
    )
    const tabs = region(
      'tab bar',
      0,
      1130,
      834,
      64,
      { lay: 'row', fill: 'bg/surface' },
      ...RAIL.map(([ic, text], i) =>
        C(
          {
            name: `tab/${text}`,
            w: 'fill',
            h: 64,
            ax: 'center',
            ay: 'center',
            gap: 2,
            fill: i === 0 ? alpha('accent/default', 0.13) : null,
          },
          I(ic, { size: 22, color: i === 0 ? 'accent/default' : 'text/dim' }),
          T(text, { size: 11, wt: 500, color: i === 0 ? 'accent/default' : 'text/dim' }),
        ),
      ),
    )
    return F(
      { name: 'Compose · Rooftops · iPad portrait', w: 834, h: 1194, fill: 'bg/app', clip: true },
      top,
      canvas,
      drawer,
      sheet,
      dock({ w: 834, x: 0, y: 982, compact: true, floor: 8 }),
      tabs,
      line(0, 51, 834, 1),
      line(299, 52, 1, 910),
      line(0, 1130, 834, 1),
    )
  },
})

// ── Export dialog ──
screens.push({
  id: 'export',
  page: '2D · States',
  name: 'Export · diff and destinations',
  w: 720,
  h: 820,
  note: 'Export shows the text diff against the file as it was loaded: only the changed lines differ, comments and layout are untouched. Writing to a folder is offered only when a folder is attached and there are no errors.',
  build: (S, P) => {
    const { F, R, C, T, I, alpha, spacer, eyebrow, pill, btn, callout, dialog, modalFrame } = P
    const line = (kind, text) => {
      const c =
        kind === '+'
          ? 'state/ok'
          : kind === '-'
            ? 'state/bad'
            : text.startsWith('@@')
              ? 'layer/sky'
              : 'text/dim'
      return R(
        {
          w: 'fill',
          h: 20,
          pad: [0, 8],
          gap: 10,
          fill: kind === '+' ? alpha('state/ok', 0.12) : kind === '-' ? alpha('state/bad', 0.12) : null,
        },
        T(kind === ' ' ? '' : kind, { style: 'Mono/12', color: c, w: 10 }),
        T(text, {
          style: 'Mono/12',
          color: kind === ' ' && !text.startsWith('@@') ? 'text/dim' : c,
          w: 'fill',
          trunc: true,
        }),
      )
    }
    const body = [
      R(
        { w: 'fill', h: 28, gap: 8 },
        I('file', { size: 16, color: 'text/dim' }),
        T('rooftops.toml', { style: 'Mono/12' }),
        pill('2 lines changed', { color: 'text/dim', mono: true }),
        spacer(),
        pill('No errors', { color: 'state/ok', icon: 'check' }),
      ),
      C(
        {
          name: 'diff',
          w: 'fill',
          pad: [8, 0],
          gap: 0,
          r: 'radius/md',
          fill: 'bg/field',
          stroke: 'border/default',
          clip: true,
        },
        R({ w: 'fill', h: 24, pad: [0, 8] }, eyebrow('Against the file as loaded')),
        line(' ', '@@ [[theme.layers]]  world.cityMid'),
        line(' ', 'alias = "world.cityMid"'),
        line('-', 'depth = 0.24'),
        line('+', 'depth = 0.26'),
        line(' ', 'sink = 270'),
        line(' ', '…'),
        line(' ', '@@ [[theme.setPieces]]  skyFlash'),
        line(' ', 'kind = "skyFlash"'),
        line('-', 'flashes = 2'),
        line('+', 'flashes = 3'),
        line(' ', 'tone = "lightning"'),
      ),
      callout(
        'ok',
        'Comments and layout are untouched',
        'Everything outside the two changed lines is byte for byte the file you opened.',
      ),
      eyebrow('Export to'),
      R(
        { w: 'fill', gap: 8 },
        btn('Download', { icon: 'download', w: 'fill' }),
        btn('Share', { icon: 'external', w: 'fill' }),
        btn('Copy text', { icon: 'copy', w: 'fill' }),
      ),
    ]
    return modalFrame(
      'Export · diff and destinations',
      640,
      740,
      dialog('export dialog', 640, 740, 'Export stage', body, [
        btn('Cancel', { kind: 'ghost' }),
        btn('Write to floorfifty/content/stages', { kind: 'primary', h: 48, icon: 'save' }),
      ]),
    )
  },
})

// ── Recovery dialog ──
screens.push({
  id: 'recover',
  page: '2D · States',
  name: 'Recover · unsaved work',
  w: 600,
  h: 480,
  note: 'After a crash or a closed tab the journal is offered back before anything else loads. Restore replays the saved edits; Discard drops them and opens the file on disk.',
  build: (S, P) => {
    const { F, R, C, T, I, alpha, spacer, btn, kv, dialog, modalFrame, callout } = P
    const body = [
      R(
        { w: 'fill', gap: 14, ay: 'start' },
        R(
          { w: 44, h: 44, ax: 'center', ay: 'center', r: 22, fill: alpha('accent/default', 0.16) },
          I('rotate', { size: 22, color: 'accent/default' }),
        ),
        C(
          { w: 'fill', gap: 4 },
          T('Restore your unsaved work?', { style: 'Display/20', w: 'fill' }),
          T('Rooftops was open when the app closed. Its edits were saved to the journal as you made them.', {
            style: 'Body/13',
            color: 'text/dim',
            w: 'fill',
            lh: 19,
          }),
        ),
      ),
      C(
        { w: 'fill', pad: [8, 12], gap: 0, r: 'radius/md', fill: 'bg/field', stroke: 'border/default' },
        kv('Stage', 'Rooftops', { mono: false }),
        kv('Last autosave', '12:38'),
        kv('Edits saved', '7'),
        kv('File on disk', 'unchanged since 11:02', { mono: false }),
      ),
    ]
    return modalFrame(
      'Recover · unsaved work',
      520,
      400,
      dialog('recover dialog', 520, 400, 'Recover', body, [
        btn('Discard', {}),
        btn('Restore edits', { kind: 'primary', h: 48, icon: 'rotate' }),
      ]),
    )
  },
})

// ── Parse error ──
screens.push({
  id: 'parse-error',
  page: '2D · States',
  name: 'Open failed · TOML syntax error',
  w: 720,
  h: 600,
  note: 'A file that does not parse is never replaced: the error names its line and column, shows the lines around it read-only, and offers another file.',
  build: (S, P) => {
    const { F, R, C, T, I, alpha, spacer, btn, dialog, modalFrame, callout, eyebrow } = P
    const rows = [
      [9, 'platformAlias = "world.platform"', false],
      [10, '', false],
      [11, '[courseTuning', true],
      [12, '', false],
      [13, '# The representative course.', false],
    ]
    const body = [
      T('rooftops.toml could not be opened', { style: 'Display/20', w: 'fill' }),
      R(
        { w: 'fill', gap: 8 },
        I('warn', { size: 16, color: 'state/bad' }),
        T('Line 11, column 14: expected "]" to close the table header', {
          style: 'Mono/12',
          color: 'state/bad',
          w: 'fill',
        }),
      ),
      C(
        {
          name: 'source',
          w: 'fill',
          pad: [8, 0],
          gap: 0,
          r: 'radius/md',
          fill: 'bg/field',
          stroke: 'border/default',
          clip: true,
        },
        R({ w: 'fill', h: 24, pad: [0, 12] }, eyebrow('Read only')),
        ...rows.flatMap(([n, text, bad]) => [
          R(
            { w: 'fill', h: 22, pad: [0, 12], gap: 12, fill: bad ? alpha('state/bad', 0.14) : null },
            T(String(n), {
              style: 'Mono/12',
              color: bad ? 'state/bad' : 'text/faint',
              w: 20,
              align: 'right',
            }),
            T(text || ' ', {
              style: 'Mono/12',
              color: bad ? 'text/primary' : 'text/dim',
              w: 'fill',
              trunc: true,
            }),
          ),
          bad
            ? R(
                { w: 'fill', h: 20, pad: [0, 12], gap: 12 },
                T(' ', { w: 20 }),
                T('             ^', { style: 'Mono/12', color: 'state/bad' }),
              )
            : null,
        ]),
      ),
      callout(
        'info',
        'Nothing was written',
        'The file on disk is unchanged. Fix the line in a text editor, or open another file.',
      ),
    ]
    return modalFrame(
      'Open failed · TOML syntax error',
      640,
      520,
      dialog('parse error dialog', 640, 520, 'Open', body, [
        btn('Copy error', { icon: 'copy' }),
        btn('Open another file', { kind: 'primary', h: 48, icon: 'folder' }),
      ]),
    )
  },
})

// ── Stage settings (the inspector's Stage tab) ──
screens.push({
  id: 'stage-settings',
  page: '2D · States',
  name: 'Stage settings · inspector tab',
  w: 360,
  h: 674,
  note: 'The Stage tab of the inspector: identity, presentation (cosmetic, reaches contentRevision only) and the courseTuning table, which is empty on Rooftops on purpose.',
  build: (S, P) => {
    const { F, R, C, T, I, alpha, spacer, btn, tabs, eyebrow, field, inputBox, pill, label, callout } = P
    const row2 = (name, input) =>
      R({ w: 'fill', h: 44, gap: 8 }, T(name, { style: 'Label/12', color: 'text/dim', w: 84 }), input)
    return F(
      { name: 'Stage settings · inspector tab', w: 360, h: 674, fill: '#06070a', clip: true },
      F(
        {
          name: 'inspector',
          x: 20,
          y: 20,
          w: 320,
          h: 634,
          fill: 'bg/surface',
          stroke: 'border/default',
          lay: 'col',
          clip: true,
        },
        tabs([{ label: 'Layer' }, { label: 'Stage' }, { label: 'Checks', badge: '2' }], 1),
        F({ w: 'fill', h: 1, fill: 'border/default' }),
        C(
          { w: 'fill', h: 'fill', pad: 12, gap: 8, clip: true },
          eyebrow('Identity'),
          row2('Id', inputBox('rooftops', { mono: true, icon: 'lock', dim: true })),
          row2('Name', inputBox('Rooftops')),
          row2('Platform', inputBox('world.platform', { mono: true, chevron: true })),
          F({ w: 'fill', h: 4 }),
          eyebrow('Presentation'),
          row2('Profile', inputBox('aquarian', { mono: true, chevron: true })),
          field('Refraction', '0.65'),
          field('Light height', '60'),
          field('Horizon lift', '24'),
          F({ w: 'fill', h: 4 }),
          eyebrow('Course tuning'),
          R(
            {
              w: 'fill',
              pad: 12,
              gap: 10,
              ay: 'start',
              r: 'radius/md',
              stroke: 'border/strong',
              dash: [4, 4],
            },
            I('info', { size: 16, color: 'text/dim' }),
            T('No overrides. The race runs on the base layer alone.', {
              style: 'Label/12',
              color: 'text/dim',
              w: 'fill',
              lh: 17,
            }),
          ),
          btn('Add override', { kind: 'ghost', icon: 'plus' }),
        ),
      ),
    )
  },
})

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
