// Sequence editor: The Last Light's cutscene timeline (editor/src/client/timeline.ts), redesigned for the iPad.
// Each `build(S, P, Q, A)` returns one scene tree and is self-contained, so build.mjs can render it to HTML and to Figma.

export const sequenceScreens = []

// ── Timeline: the hero ──
sequenceScreens.push({
  id: 'seq-timeline',
  page: 'Suite · Sequence',
  name: 'Sequence · arrival · iPad landscape',
  w: 1194,
  h: 834,
  note: 'Cutscenes on the left, the camera preview with a filmstrip of the four shots in the middle, the selected shot on the right and the timeline along the bottom. Times, lenses and eases edit in place; a computed camera path is read-only and goes through Ask.',
  build: (_S, P, Q, A) => {
    const {
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
      seg,
      tabs,
      panelHead,
      inputBox,
    } = P
    const { D, top, rail, listRow, stepperV, selectV, lanes, ruler, playhead, mono } = Q
    const arr = D.arrival
    const sel = 'C'
    const now = 12.4
    const W = 1138
    const camera = arr.shots.map((s) => ({
      k: 'blk',
      t: s.t0,
      t1: s.t1,
      label: `${s.n}  ${s.lens[0]}${s.lens[0] === s.lens[1] ? '' : `→${s.lens[1]}`} mm`,
      sel: s.n === sel,
    }))
    const rows = [
      { label: 'Camera', h: 30, color: 'layer/city', items: camera },
      {
        label: 'Ada',
        color: 'layer/entities',
        items: [
          { k: 'blk', t: 2.2, t1: 3, label: '' },
          { k: 'blk', t: 5, t1: 9.6, label: 'look' },
          ...[0, 2.2, 3, 5, 9.6].map((t) => ({ k: 'key', t })),
        ],
      },
      {
        label: 'Porter',
        color: 'layer/entities',
        items: [
          { k: 'blk', t: 15.8, t1: 16.1, label: '' },
          { k: 'blk', t: 16.1, t1: 22, label: 'mutter' },
          ...[0, 15.8, 16.1].map((t) => ({ k: 'key', t })),
        ],
      },
      {
        label: 'Lines',
        h: 30,
        color: 'layer/sky',
        items: arr.lines.map((l) => ({
          k: 'blk',
          t: l.t,
          t1: l.t1,
          label: `${l.who || '—'} · ${l.id.replace('bay.cutscene.', '')}`,
        })),
      },
      {
        label: 'Sound',
        color: 'layer/intgrid',
        items: arr.sound.map((s) => ({ k: 'key', t: s.t, label: s.label })),
      },
      {
        label: 'Light · bayFill',
        sub: true,
        color: 'state/warn',
        items: [
          { k: 'key', t: 10, label: '2.4' },
          { k: 'key', t: 15.65 },
          { k: 'key', t: 15.7, label: '0.6' },
        ],
      },
      {
        label: 'Light · eastFill',
        sub: true,
        color: 'state/warn',
        items: [
          { k: 'key', t: 10, label: '0.9' },
          { k: 'key', t: 15.65 },
        ],
      },
      { label: 'Fade', h: 30, color: 'text/dim', items: [{ k: 'curve', pts: arr.fade }] },
      { label: 'States · Shake', color: 'text/faint', items: [] },
    ]
    const L = lanes({ w: W, dur: arr.dur, y0: 78, rows, labelW: 96, padR: 16 })
    const px = L.tx(now)
    const dockH = 330
    const dock = region(
      'timeline',
      56,
      504,
      W,
      dockH,
      { lay: null },
      line(0, 0, W, 1),
      R(
        { name: 'timeline header', x: 0, y: 0, w: W, h: 44, pad: [0, 8, 0, 16], gap: 10 },
        eyebrow('Timeline'),
        T('12.40 / 22.00 s', { style: 'Mono/12' }),
        mono('frame 372 · 30 fps'),
        spacer(),
        ib('step-back'),
        ib('play', { on: true }),
        ib('step-fwd'),
        ib('loop'),
        F({ w: 8, h: 8 }),
        T('Rate', { style: 'Label/12', color: 'text/dim' }),
        seg(['24', '30', '60'], 1, { w: 132 }),
        seg(['¼×', '½×', '1×'], 2, { w: 132 }),
      ),
      ...ruler({ w: W, dur: arr.dur, step: 2, y: 46, labelW: 96, padR: 16, minor: 1 }),
      ...L.kids,
      ...playhead(px, 66, 78 + L.height - 66, now.toFixed(2)),
    )

    const cutscenes = region(
      'cutscenes panel',
      56,
      52,
      264,
      452,
      { lay: 'col' },
      panelHead('Cutscenes', ib('plus'), ib('more')),
      R(
        { w: 'fill', h: 52, pad: [0, 8] },
        inputBox(`${D.scene.name} · ${D.scene.id}`, { chevron: true, mono: true }),
      ),
      C(
        { name: 'cutscene list', w: 'fill', h: 'fill', pad: [0, 8], gap: 0, clip: true },
        D.cutscenes.map((c) =>
          listRow({
            title: c.id,
            sub: c.sub,
            icon: c.icon,
            sel: c.id === 'arrival',
            color: Q.ED.sequence.color,
            h: 48,
            mono: true,
          }),
        ),
      ),
    )

    // The camera preview: the Bay at the playhead, a viewfinder over it, the filmstrip under it.
    const W2 = 554
    const H2 = 312
    const shots = arr.shots
    const strip = shots.map((s, i) =>
      F(
        {
          name: `shot ${s.n}`,
          x: 17 + i * 132,
          y: 372,
          w: 124,
          h: 70,
          r: 6,
          clip: true,
          fill: 'bg/canvas',
          stroke: s.n === sel ? 'accent/default' : 'border/default',
          sw: s.n === sel ? 2 : 1,
        },
        V(A.bayArt({ ada: i === 3 ? false : undefined, lamp: i === 2 ? 1 : 0.55, dim: i === 3 ? 0.35 : 0 }), {
          name: 'art',
          w: 124,
          h: 70,
        }),
        R(
          { x: 0, y: 70 - 20, w: 124, h: 20, pad: [0, 7], fill: alpha('bg/canvas', 0.78) },
          T(`${s.n}  ${s.t0.toFixed(1)}–${s.t1.toFixed(1)}`, {
            style: 'Mono/11',
            color: s.n === sel ? 'accent/default' : 'text/dim',
          }),
        ),
      ),
    )
    const canvas = region(
      'camera preview',
      320,
      52,
      W2,
      452,
      { fill: 'bg/canvas' },
      F(
        { x: 0, y: 40, w: W2, h: H2, clip: true },
        V(A.bayArt({ lamp: 1, ada: [236, 168] }), { name: 'art', w: W2, h: H2 }),
        A.viewfinder(W2, H2, { ghost: [180, 70, 190, 150] }),
      ),
      R(
        {
          name: 'shot chip',
          x: 8,
          y: 4,
          h: 32,
          pad: [0, 12],
          gap: 8,
          r: 16,
          fill: 'bg/surface',
          stroke: 'border/default',
        },
        I('camera', { size: 14, color: Q.ED.sequence.color }),
        T('Shot C', { style: 'Label/12' }),
        T('28 → 34 mm · smooth', { style: 'Mono/11', color: 'text/dim' }),
      ),
      R(
        {
          name: 'cut chip',
          x: 478,
          y: 4,
          h: 32,
          pad: [0, 12],
          gap: 6,
          r: 16,
          fill: alpha('accent/default', 0.14),
          stroke: alpha('accent/default', 0.6),
        },
        T('cut', { style: 'Mono/11', color: 'accent/default' }),
      ),
      R(
        {
          name: 'caption',
          x: 77,
          y: 40 + H2 - 48,
          w: 400,
          h: 30,
          ax: 'center',
          r: 6,
          fill: alpha('bg/canvas', 0.7),
        },
        T('On the stretcher, a run sheet. PT: VOSS, A. (STAFF NURSE). DOA 04:17.', {
          size: 11,
          wt: 500,
          color: 'text/primary',
        }),
      ),
      ...strip,
    )

    const inspector = region(
      'inspector',
      874,
      52,
      320,
      452,
      { lay: 'col' },
      tabs([{ label: 'Shot' }, { label: 'Code' }, { label: 'Ask' }], 0),
      F({ w: 'fill', h: 1, fill: 'border/default' }),
      C(
        { name: 'fields', w: 'fill', h: 'fill', pad: 12, gap: 8, clip: true },
        R(
          { w: 'fill', h: 28, gap: 8 },
          F({ w: 14, h: 14, r: 4, fill: alpha('layer/city', 0.85) }),
          T('Shot C', { style: 'Title/15' }),
          spacer(),
          pill('literal', { color: 'state/ok', icon: 'check' }),
        ),
        T('The run sheet on the stretcher, tilting down onto it', {
          style: 'Label/12',
          color: 'text/dim',
          w: 'fill',
          lh: 16,
        }),
        R(
          { w: 'fill', gap: 8 },
          stepperV('Starts', '10.00', { unit: 's' }),
          stepperV('Ends', '15.70', { unit: 's' }),
        ),
        R(
          { w: 'fill', gap: 8 },
          stepperV('Lens in', '28', { unit: 'mm' }),
          stepperV('Lens out', '34', { unit: 'mm', changed: true }),
        ),
        R(
          { w: 'fill', gap: 8 },
          selectV('Ease', 'smooth', { mono: true }),
          C(
            { w: 'fill', gap: 2 },
            T('Cut on entry', { style: 'Label/12', color: 'text/dim' }),
            R({ w: 'fill', h: 44 }, Q.toggle(true)),
          ),
        ),
        R(
          {
            name: 'computed path',
            w: 'fill',
            pad: 10,
            gap: 10,
            ay: 'start',
            r: 'radius/md',
            fill: 'bg/field',
            stroke: 'border/default',
          },
          I('lock', { size: 18, color: 'text/faint' }),
          C(
            { w: 'fill', gap: 2 },
            T('Camera path is computed', { style: 'Body/13 Medium' }),
            T('sheet.x − 0.8, MATTRESS + 1.3, sheet.z − 1.0', {
              style: 'Mono/11',
              color: 'text/dim',
              w: 'fill',
              lh: 15,
            }),
            T('Ask to move it; times, lenses and eases edit here.', {
              style: 'Label/12',
              color: 'text/faint',
              w: 'fill',
              lh: 16,
            }),
          ),
        ),
      ),
    )

    return F(
      { name: 'Sequence · arrival · iPad landscape', w: 1194, h: 834, fill: 'bg/app', clip: true },
      top(1194, {
        title: 'arrival',
        sub: 'src/scenes/bay/cutscenes.ts',
        ed: 'sequence',
        cs: 'edit/arrival-timing',
        n: 2,
        checks: 'checks ok',
        mid: btn('Play', { icon: 'play' }),
      }),
      rail(782, 'sequence'),
      cutscenes,
      canvas,
      inspector,
      dock,
      line(0, 51, 1194, 1),
      line(55, 52, 1, 782),
      line(319, 52, 1, 452),
      line(873, 52, 1, 452),
    )
  },
})

// ── Timeline in portrait ──
sequenceScreens.push({
  id: 'seq-portrait',
  page: 'Suite · Sequence',
  name: 'Sequence · arrival · iPad portrait',
  w: 834,
  h: 1194,
  note: 'The medium shell: preview and filmstrip on top, the selected shot as an inline sheet, the timeline below it, and the editor tab bar. The cutscene list is the chip at the top left.',
  build: (_S, P, Q, A) => {
    const { F, R, T, I, V, alpha, spacer, region, line, eyebrow, pill, ib, seg } = P
    const { D, topP, tabBar, stepperV, selectV, lanes, ruler, playhead } = Q
    const arr = D.arrival
    const now = 12.4
    const W = 834
    const rows = [
      {
        label: 'Camera',
        h: 30,
        color: 'layer/city',
        items: arr.shots.map((s) => ({ k: 'blk', t: s.t0, t1: s.t1, label: s.n, sel: s.n === 'C' })),
      },
      {
        label: 'Ada',
        color: 'layer/entities',
        items: [
          { k: 'blk', t: 2.2, t1: 3, label: '' },
          { k: 'blk', t: 5, t1: 9.6, label: 'look' },
        ],
      },
      { label: 'Porter', color: 'layer/entities', items: [{ k: 'blk', t: 16.1, t1: 22, label: 'mutter' }] },
      {
        label: 'Lines',
        h: 30,
        color: 'layer/sky',
        items: arr.lines.map((l) => ({
          k: 'blk',
          t: l.t,
          t1: l.t1,
          label: l.id.replace('bay.cutscene.', ''),
        })),
      },
      {
        label: 'Sound',
        color: 'layer/intgrid',
        items: arr.sound.map((s) => ({ k: 'key', t: s.t, label: s.label })),
      },
      {
        label: 'Light · bayFill',
        sub: true,
        color: 'state/warn',
        items: [
          { k: 'key', t: 10, label: '2.4' },
          { k: 'key', t: 15.7, label: '0.6' },
        ],
      },
      {
        label: 'Light · eastFill',
        sub: true,
        color: 'state/warn',
        items: [{ k: 'key', t: 10, label: '0.9' }],
      },
      { label: 'Fade', h: 30, color: 'text/dim', items: [{ k: 'curve', pts: arr.fade }] },
      { label: 'States · Shake', color: 'text/faint', items: [] },
    ]
    const L = lanes({ w: W, dur: arr.dur, y0: 76, rows, labelW: 96, padR: 16 })
    const px = L.tx(now)
    const timeline = region(
      'timeline',
      0,
      800,
      W,
      330,
      { lay: null },
      line(0, 0, W, 1),
      F({ name: 'handle', x: 399, y: 5, w: 36, h: 4, r: 2, fill: 'border/strong' }),
      R(
        { name: 'timeline header', x: 0, y: 10, w: W, h: 44, pad: [0, 8, 0, 16], gap: 6 },
        eyebrow('Timeline'),
        T('12.40 / 22.00 s', { style: 'Mono/12' }),
        spacer(),
        ib('step-back'),
        ib('play', { on: true }),
        ib('step-fwd'),
        seg(['24', '30', '60'], 1, { w: 132 }),
      ),
      ...ruler({ w: W, dur: arr.dur, step: 2, y: 54, labelW: 96, padR: 16, minor: 1 }),
      ...L.kids.map((k) => k),
      ...playhead(px, 72, 76 + L.height - 72, now.toFixed(2)),
    )
    const W2 = 834
    const H2 = 469
    const strip = arr.shots.map((s, i) =>
      F(
        {
          name: `shot ${s.n}`,
          x: 16 + i * 200,
          y: 529,
          w: 192,
          h: 108,
          r: 8,
          clip: true,
          fill: 'bg/canvas',
          stroke: s.n === 'C' ? 'accent/default' : 'border/default',
          sw: s.n === 'C' ? 2 : 1,
        },
        V(A.bayArt({ ada: i === 3 ? false : undefined, lamp: i === 2 ? 1 : 0.55, dim: i === 3 ? 0.35 : 0 }), {
          name: 'art',
          w: 192,
          h: 108,
        }),
        R(
          { x: 0, y: 108 - 24, w: 192, h: 24, pad: [0, 9], fill: alpha('bg/canvas', 0.78) },
          T(`${s.n}  ${s.t0.toFixed(1)}–${s.t1.toFixed(1)} s`, {
            style: 'Mono/11',
            color: s.n === 'C' ? 'accent/default' : 'text/dim',
          }),
        ),
      ),
    )
    const canvas = region(
      'camera preview',
      0,
      52,
      W2,
      585,
      { fill: 'bg/canvas' },
      F(
        { x: 0, y: 0, w: W2, h: H2, clip: true },
        V(A.bayArt({ lamp: 1, ada: [236, 168] }), { name: 'art', w: W2, h: H2 }),
        A.viewfinder(W2, H2, { ghost: [270, 110, 290, 230] }),
      ),
      R(
        {
          name: 'cutscene chip',
          x: 8,
          y: 8,
          h: 36,
          pad: [0, 12],
          gap: 8,
          r: 18,
          fill: 'bg/surface',
          stroke: 'border/default',
        },
        I('film', { size: 16, color: Q.ED.sequence.color }),
        T('arrival', { style: 'Mono/12' }),
        T('The Bay', { style: 'Label/12', color: 'text/dim' }),
        I('chevron-down', { size: 14, color: 'text/dim' }),
      ),
      R(
        {
          name: 'shot chip',
          x: 590,
          y: 8,
          h: 36,
          pad: [0, 12],
          gap: 8,
          r: 18,
          fill: 'bg/surface',
          stroke: 'border/default',
        },
        T('Shot C', { style: 'Label/12' }),
        T('28 → 34 mm', { style: 'Mono/11', color: 'text/dim' }),
        T('cut', { style: 'Mono/11', color: 'accent/default' }),
      ),
      R(
        {
          name: 'caption',
          x: 157,
          y: H2 - 52,
          w: 520,
          h: 34,
          ax: 'center',
          r: 6,
          fill: alpha('bg/canvas', 0.7),
        },
        T('On the stretcher, a run sheet. PT: VOSS, A. (STAFF NURSE). DOA 04:17.', { size: 12, wt: 500 }),
      ),
      ...strip.map((s) => ({ ...s, y: s.y - 52 })),
    )
    const sheet = region(
      'shot sheet',
      0,
      637,
      W,
      163,
      { lay: 'col', pad: [10, 16, 0, 16], gap: 6 },
      line(0, 0, W, 1),
      R(
        { w: 'fill', h: 24, gap: 8 },
        F({ w: 14, h: 14, r: 4, fill: alpha('layer/city', 0.85) }),
        T('Shot C', { style: 'Title/15' }),
        T('literal · times, lenses and eases edit in place', { style: 'Label/12', color: 'text/dim' }),
        spacer(),
        pill('literal', { color: 'state/ok', icon: 'check', h: 22, pad: 8 }),
      ),
      R(
        { w: 'fill', gap: 8 },
        stepperV('Starts', '10.00', { unit: 's' }),
        stepperV('Ends', '15.70', { unit: 's' }),
        stepperV('Lens in', '28', { unit: 'mm' }),
        stepperV('Lens out', '34', { unit: 'mm', changed: true }),
        selectV('Ease', 'smooth', { mono: true }),
      ),
      R(
        {
          name: 'computed path',
          w: 'fill',
          h: 36,
          pad: [0, 10],
          gap: 8,
          r: 'radius/md',
          fill: 'bg/field',
          stroke: 'border/default',
        },
        I('lock', { size: 16, color: 'text/faint' }),
        T('Camera path is computed', { style: 'Label/12', color: 'text/dim' }),
        T('sheet.x − 0.8, MATTRESS + 1.3, sheet.z − 1.0', {
          style: 'Mono/11',
          color: 'text/faint',
          w: 'fill',
          trunc: true,
        }),
        T('Ask to move it', { style: 'Label/12', color: 'ed/feel' }),
      ),
    )
    return F(
      { name: 'Sequence · arrival · iPad portrait', w: 834, h: 1194, fill: 'bg/app', clip: true },
      topP(834, {
        title: 'arrival',
        sub: 'cutscenes.ts',
        cs: 'edit/arrival-timing',
        n: 2,
        checks: 'checks ok',
      }),
      canvas,
      sheet,
      timeline,
      tabBar(834, 1130, 'sequence'),
      line(0, 51, 834, 1),
    )
  },
})
