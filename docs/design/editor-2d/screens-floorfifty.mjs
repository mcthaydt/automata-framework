// Screens for the 2D editor's FloorFifty stage profile (the stage-specific views and the stage file's states).
// Each `build(S, P)` returns one scene tree (see ../editor-kit/scene).
// Builders are self-contained functions of the kit `S` and the parts `P` (parts.mjs), so build.mjs can render
// the same source to HTML and to Figma.

export const screens = []

// ── Compose: the hero. iPad landscape 1194 x 834 (the `wide` shell) ──
screens.push({
  id: 'ff-compose',
  page: '2D · Profile FloorFifty',
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
  id: 'ff-course',
  page: '2D · Profile FloorFifty',
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
  id: 'ff-pieces',
  page: '2D · Profile FloorFifty',
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

// ── Compose, portrait: the `medium` shell ──
screens.push({
  id: 'ff-portrait',
  page: '2D · Profile FloorFifty',
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

// ── Stage settings (the inspector's Stage tab) ──
screens.push({
  id: 'ff-settings',
  page: '2D · Profile FloorFifty',
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

// ── Checks: an error with its fixes ──
screens.push({
  id: 'ff-checks',
  page: '2D · Profile FloorFifty',
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

// ── Export dialog ──
screens.push({
  id: 'ff-export',
  page: '2D · Profile FloorFifty',
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

// ── Parse error ──
screens.push({
  id: 'ff-parse-error',
  page: '2D · Profile FloorFifty',
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
