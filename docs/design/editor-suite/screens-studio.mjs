// Studio: The Last Light's character workshop (editor/src/client/studio.ts, studio-model.ts): roster, turnaround, outfits, sliders and poses,
// with the pipeline and its gates along the bottom.

export const studioScreens = []

// ── Turnaround: the hero ──
studioScreens.push({
  id: 'studio-turnaround',
  page: 'Suite · Studio',
  name: 'Studio · Turnaround · iPad landscape',
  w: 1194,
  h: 834,
  note: 'The roster on the left, the character from eight directions in the middle, what the character is in the story on the right, and the pipeline with its gates along the bottom. The figure is a procedural stand-in; the editor draws the game’s own.',
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
      ib,
      seg,
      tabs,
      panelHead,
      inputBox,
    } = P
    const { top, rail, listRow, pipeline, select, mono } = Q
    const roster = [
      ['Ada Voss', 'procedural · 3 outfits', true],
      ['the Porter (F. Lamb)', 'procedural · 1 outfit', false],
      ['the Night Nurse', 'procedural · 1 outfit', false],
      ['the ambulance crew', 'procedural · 1 outfit', false],
    ]
    const panel = region(
      'roster panel',
      56,
      52,
      264,
      602,
      { lay: 'col' },
      panelHead('Characters', ib('plus'), ib('more')),
      C(
        { w: 'fill', pad: [0, 8], gap: 0 },
        roster.map(([name, sub, sel], i) =>
          listRow({
            title: name,
            sub,
            h: 64,
            sel,
            color: Q.ED.studio.color,
            lead: F(
              { name: 'thumb', w: 40, h: 48, r: 6, fill: 'bg/canvas', clip: true, stroke: 'border/default' },
              V(A.figure(0, { outfit: i === 3 ? 'cape' : undefined }), { x: 6, y: -2, w: 28, h: 63 }),
            ),
            changed: sel,
          }),
        ),
      ),
    )
    const tabRow = (items, active) =>
      R(
        { name: 'tabs', w: 'fill', h: 44 },
        items.map((t, i) =>
          C(
            { w: 'fill', h: 44, gap: 0 },
            R(
              { w: 'fill', h: 42, ax: 'center' },
              T(t, { style: 'Body/13 Medium', color: i === active ? 'text/primary' : 'text/dim' }),
            ),
            F({ w: 'fill', h: 2, fill: i === active ? Q.ED.studio.color : null }),
          ),
        ),
      )
    const views = ['front', 'front right', 'right', 'back right', 'back', 'back left', 'left', 'front left']
    const cell = (v, i) => {
      const x = 12 + (i % 4) * 134
      const y = 108 + Math.floor(i / 4) * 230
      return F(
        {
          name: `view/${views[v]}`,
          x,
          y,
          w: 128,
          h: 224,
          r: 'radius/md',
          fill: 'bg/canvas',
          stroke: v === 0 ? alpha(Q.ED.studio.color, 0.7) : 'border/default',
          clip: true,
        },
        V(A.figure(v, { walk: v === 2 || v === 6 ? 0.6 : 0 }), { x: 22, y: 10, w: 84, h: 189 }),
        T(views[v], {
          x: 0,
          y: 202,
          w: 128,
          align: 'center',
          style: 'Mono/11',
          color: v === 0 ? Q.ED.studio.color : 'text/dim',
        }),
      )
    }
    const center = region(
      'turnaround',
      320,
      52,
      554,
      602,
      { fill: 'bg/app' },
      F({ x: 0, y: 0, w: 554, h: 44 }, tabRow(['Turnaround', 'Outfits', 'Sliders', 'Poses', 'Test'], 0)),
      F({ x: 0, y: 43, w: 554, h: 1, fill: 'border/default' }),
      R(
        { name: 'view options', x: 12, y: 52, w: 530, h: 48, gap: 8 },
        R({ w: 180 }, select('Outfit', 'nurse', { lw: 52, mono: true })),
        seg(['Hall light off', 'on'], 0, { w: 200 }),
        spacer(),
        mono('8 views · 40×90'),
      ),
      ...[0, 1, 2, 3, 4, 5, 6, 7].map((v, i) => cell(v, i)),
    )
    const sceneRow = (scene, outfit, o = {}) =>
      R(
        { w: 'fill', h: 40, gap: 8 },
        T(scene, { style: 'Mono/12', w: 100, color: o.dim ? 'text/dim' : 'text/primary' }),
        I('chevron-right', { size: 14, color: 'text/faint' }),
        R({ w: 'fill' }, inputBox(outfit, { chevron: true, mono: true, h: 36, w: 'fill' })),
      )
    const inspector = region(
      'inspector',
      874,
      52,
      320,
      602,
      { lay: 'col' },
      tabs([{ label: 'Character' }, { label: 'Code' }, { label: 'Ask' }], 0),
      F({ w: 'fill', h: 1, fill: 'border/default' }),
      C(
        { name: 'fields', w: 'fill', h: 'fill', pad: 12, gap: 8, clip: true },
        R(
          { w: 'fill', h: 28, gap: 8 },
          T('Ada Voss', { style: 'Title/15' }),
          spacer(),
          pill('procedural', { color: 'text/dim', mono: true }),
        ),
        T('Staff nurse, nights at St. Agnes since 1979.', {
          style: 'Label/12',
          color: 'text/dim',
          w: 'fill',
        }),
        R(
          {
            w: 'fill',
            h: 44,
            pad: [0, 12],
            gap: 8,
            r: 'radius/md',
            fill: 'bg/field',
            stroke: 'border/default',
            op: 0.85,
          },
          I('lock', { size: 16, color: 'text/faint' }),
          T('Play', { style: 'Label/12', color: 'text/dim', w: 40 }),
          T('procedural', { style: 'Mono/12', w: 'fill' }),
          T('the owner’s, after G6', { style: 'Label/12', color: 'text/faint' }),
        ),
        R(
          { w: 'fill', gap: 8 },
          Q.selectV('Default outfit', 'nurse', { mono: true }),
          Q.selectV('Gait', 'brisk', { mono: true }),
        ),
        R(
          { w: 'fill', gap: 8 },
          Q.selectV('Skin', 'fair', { mono: true }),
          C({ w: 'fill', gap: 2 }, T('Hand', { style: 'Label/12', color: 'text/dim' }), seg(['L', 'R'], 1)),
        ),
        R({ w: 'fill', h: 6 }),
        eyebrow('In the story'),
        sceneRow('prologue', 'street'),
        sceneRow('clinic', 'nurse'),
        sceneRow('bay', 'nurse'),
        sceneRow('clinic-dawn', 'nurse'),
        C(
          { w: 'fill', gap: 0, pad: [4, 0, 0, 0] },
          T('Cutscene override', { style: 'Label/12', color: 'text/dim' }),
          mono('clinic-dawn:finaleHandover → street'),
        ),
      ),
    )
    const dock = pipeline({
      route: 'procedural route',
      stages: [
        { id: 'builder', state: 'ok', at: 'ran 2 min ago', out: 'ada.json → figure' },
        { id: 'sheet', state: 'ok', at: 'ran yesterday', out: 'review-x4.png' },
        { id: 'play', state: 'ok', at: 'ran yesterday', out: 'hall-off · hall-on' },
      ],
      gates: [
        { id: 'G1', name: 'look', decision: 'approved', by: 'owner' },
        { id: 'G6', name: 'figure', decision: 'approved', by: 'owner' },
        { id: 'G7', name: 'poses', decision: 'approved', by: 'owner' },
      ],
    })
    return F(
      { name: 'Studio · Turnaround · iPad landscape', w: 1194, h: 834, fill: 'bg/app', clip: true },
      top(1194, {
        title: 'Ada Voss',
        sub: 'src/render/figure/characters/ada.json',
        ed: 'studio',
        cs: 'studio/ada-hair',
        n: 2,
        checks: 'checks ok',
        gates: [
          ['G1', 'ok'],
          ['G6', 'ok'],
          ['G7', 'ok'],
        ],
      }),
      rail(782, 'studio'),
      panel,
      center,
      inspector,
      dock,
      line(0, 51, 1194, 1),
      line(55, 52, 1, 782),
      line(319, 52, 1, 602),
      line(873, 52, 1, 602),
    )
  },
})

// ── Outfits: garments, swatches and typed fields ──
studioScreens.push({
  id: 'studio-outfits',
  page: 'Suite · Studio',
  name: 'Studio · Outfits · iPad landscape',
  w: 1194,
  h: 834,
  note: 'An outfit is an ordered stack of garments. The selected garment’s fields are typed: swatches, numbers, switches and lists of values, each limited to what the character file accepts.',
  build: (_S, P, Q, A) => {
    const { F, R, C, T, I, V, spacer, region, line, pill, btn, ib, tabs, panelHead, callout } = P
    const { top, rail, listRow, pipeline, stepperV, selectV, toggleRow, chip, garmentRow, SW } = Q
    const panel = region(
      'roster panel',
      56,
      52,
      264,
      602,
      { lay: 'col' },
      panelHead('Characters', ib('plus'), ib('more')),
      C(
        { w: 'fill', pad: [0, 8], gap: 0 },
        ['Ada Voss', 'the Porter (F. Lamb)', 'the Night Nurse', 'the ambulance crew'].map((n, i) =>
          listRow({
            title: n,
            sub: i === 0 ? 'procedural · 3 outfits' : 'procedural',
            h: 64,
            sel: i === 0,
            color: Q.ED.studio.color,
            lead: F(
              { name: 'thumb', w: 40, h: 48, r: 6, fill: 'bg/canvas', clip: true, stroke: 'border/default' },
              V(A.figure(0), { x: 6, y: -2, w: 28, h: 63 }),
            ),
            changed: i === 0,
          }),
        ),
      ),
    )
    const tabRow = (items, active) =>
      R(
        { name: 'tabs', w: 'fill', h: 44 },
        items.map((t, i) =>
          C(
            { w: 'fill', h: 44, gap: 0 },
            R(
              { w: 'fill', h: 42, ax: 'center' },
              T(t, { style: 'Body/13 Medium', color: i === active ? 'text/primary' : 'text/dim' }),
            ),
            F({ w: 'fill', h: 2, fill: i === active ? Q.ED.studio.color : null }),
          ),
        ),
      )
    const garments = [
      { kind: 'top', swatch: 'navy', sub: 'navy · short sleeves · starch cuffs, collar' },
      { kind: 'skirt', swatch: 'navy', sub: 'navy · length 0.85 · flare 0.75 · folds 0.07' },
      { kind: 'legs', swatch: 'stocking', sub: 'stocking' },
      { kind: 'shoes', swatch: 'black', sub: 'black' },
      {
        kind: 'apron',
        swatch: 'starch',
        sub: 'starch · length 0.6 · bib · cross straps · pockets',
        sel: true,
      },
      { kind: 'belt', swatch: 'black', sub: 'black' },
    ]
    const center = region(
      'outfits',
      320,
      52,
      554,
      602,
      { fill: 'bg/app' },
      F({ x: 0, y: 0, w: 554, h: 44 }, tabRow(['Turnaround', 'Outfits', 'Sliders', 'Poses', 'Test'], 1)),
      F({ x: 0, y: 43, w: 554, h: 1, fill: 'border/default' }),
      R(
        { name: 'outfit chips', x: 12, y: 52, w: 530, h: 40, gap: 6 },
        chip('nurse', { on: true, color: Q.ED.studio.color, h: 36 }),
        chip('cape', { h: 36 }),
        chip('street', { h: 36 }),
        spacer(),
        btn('Duplicate', { icon: 'copy', h: 36 }),
      ),
      F(
        {
          name: 'preview',
          x: 12,
          y: 100,
          w: 150,
          h: 330,
          r: 'radius/lg',
          fill: 'bg/canvas',
          stroke: 'border/default',
          clip: true,
        },
        V(A.figure(0), { x: 15, y: 16, w: 120, h: 270 }),
        T('nurse · front', { x: 0, y: 302, w: 150, align: 'center', style: 'Mono/11', color: 'text/dim' }),
      ),
      C(
        { name: 'garment stack', x: 172, y: 100, w: 370, h: 'hug', gap: 4 },
        garments.map((g) => garmentRow(g, { sel: g.sel })),
        R(
          { w: 'fill', h: 44, ax: 'center', r: 'radius/md', stroke: 'border/default', dash: [4, 3], gap: 6 },
          I('plus', { size: 16, color: 'accent/default' }),
          T('Add garment', { style: 'Label/12', color: 'accent/default' }),
        ),
      ),
    )
    const sw = [
      'navy',
      'starch',
      'starchShade',
      'black',
      'stocking',
      'cream',
      'maroon',
      'denim',
      'bootBrown',
      'auburn',
    ]
    const inspector = region(
      'inspector',
      874,
      52,
      320,
      602,
      { lay: 'col' },
      tabs([{ label: 'Garment' }, { label: 'Code' }, { label: 'Ask' }], 0),
      F({ w: 'fill', h: 1, fill: 'border/default' }),
      C(
        { name: 'fields', w: 'fill', h: 'fill', pad: 12, gap: 8, clip: true },
        R(
          { w: 'fill', h: 28, gap: 8 },
          F({ w: 14, h: 14, r: 4, fill: SW.starch }),
          T('apron', { style: 'Title/15' }),
          spacer(),
          pill('nurse outfit', { color: 'text/dim', mono: true }),
        ),
        C(
          { w: 'fill', gap: 4 },
          T('Apron colour', { style: 'Label/12', color: 'text/dim' }),
          R(
            { w: 'fill', gap: 6 },
            ...sw.slice(0, 5).map((n) =>
              F({
                name: n,
                w: 44,
                h: 44,
                r: 8,
                fill: SW[n],
                stroke: n === 'starch' ? 'accent/default' : 'border/strong',
                sw: n === 'starch' ? 3 : 1,
              }),
            ),
          ),
          R(
            { w: 'fill', gap: 6 },
            ...sw
              .slice(5)
              .map((n) => F({ name: n, w: 44, h: 44, r: 8, fill: SW[n], stroke: 'border/strong' })),
          ),
        ),
        R(
          { w: 'fill', gap: 8 },
          selectV('Shade', 'starchShade', { mono: true }),
          selectV('Straps', 'cross', { mono: true }),
        ),
        R(
          { w: 'fill', gap: 8 },
          stepperV('Length', '0.60'),
          stepperV('Folds', '0.07', { disabled: true, mark: 'n/a' }),
        ),
        toggleRow('Bib', true),
        toggleRow('Pockets', true),
        callout(
          'info',
          'Limited to the file’s values',
          'Swatches, lists and ranges come from the character schema; a value it would refuse is not offered.',
        ),
        R(
          { w: 'fill', gap: 8 },
          btn('Duplicate', { icon: 'copy', w: 'fill' }),
          btn('Remove', { kind: 'danger', icon: 'trash', w: 'fill' }),
        ),
      ),
    )
    const dock = pipeline({
      stages: [
        { id: 'builder', state: 'stale', at: 'changed just now', out: 'run Check to refresh' },
        { id: 'sheet', state: 'stale', at: 'ran yesterday', out: 'review-x4.png' },
        { id: 'play', state: 'stale', at: 'ran yesterday', out: 'hall-off · hall-on' },
      ],
      gates: [
        { id: 'G1', name: 'look', decision: 'approved', by: 'owner' },
        { id: 'G6', name: 'figure', decision: 'open' },
        { id: 'G7', name: 'poses', decision: 'approved', by: 'owner' },
      ],
      checks: 'builder check ok · 14',
    })
    return F(
      { name: 'Studio · Outfits · iPad landscape', w: 1194, h: 834, fill: 'bg/app', clip: true },
      top(1194, {
        title: 'Ada Voss',
        sub: 'src/render/figure/characters/ada.json',
        ed: 'studio',
        cs: 'studio/ada-hair',
        n: 3,
        checks: 'checks ok',
        gates: [['G6', 'open']],
      }),
      rail(782, 'studio'),
      panel,
      center,
      inspector,
      dock,
      line(0, 51, 1194, 1),
      line(55, 52, 1, 782),
      line(319, 52, 1, 602),
      line(873, 52, 1, 602),
    )
  },
})

// ── Poses: request, estimate, review ──
studioScreens.push({
  id: 'studio-poses',
  page: 'Suite · Studio',
  name: 'Studio · Poses · iPad landscape',
  w: 1194,
  h: 834,
  note: 'The poses a character has, each with the gate the owner decided, and a form to request a new one. Asking for a pose writes the action into the character file as one undo step, then checks it and estimates the cost; the paid run stays the owner’s.',
  build: (_S, P, Q, A) => {
    const { F, R, C, T, I, V, region, line, btn, ib, tabs, panelHead, callout } = P
    const { top, rail, listRow, pipeline, stepperV, selectV } = Q
    const panel = region(
      'roster panel',
      56,
      52,
      264,
      602,
      { lay: 'col' },
      panelHead('Characters', ib('plus'), ib('more')),
      C(
        { w: 'fill', pad: [0, 8], gap: 0 },
        ['Ada Voss', 'the Porter (F. Lamb)', 'the Night Nurse', 'the ambulance crew'].map((n, i) =>
          listRow({
            title: n,
            sub: i === 0 ? 'atlas · 6 poses' : 'procedural',
            h: 64,
            sel: i === 0,
            color: Q.ED.studio.color,
            lead: F(
              { name: 'thumb', w: 40, h: 48, r: 6, fill: 'bg/canvas', clip: true, stroke: 'border/default' },
              V(A.figure(0), { x: 6, y: -2, w: 28, h: 63 }),
            ),
          }),
        ),
      ),
    )
    const tabRow = (items, active) =>
      R(
        { name: 'tabs', w: 'fill', h: 44 },
        items.map((t, i) =>
          C(
            { w: 'fill', h: 44, gap: 0 },
            R(
              { w: 'fill', h: 42, ax: 'center' },
              T(t, { style: 'Body/13 Medium', color: i === active ? 'text/primary' : 'text/dim' }),
            ),
            F({ w: 'fill', h: 2, fill: i === active ? Q.ED.studio.color : null }),
          ),
        ),
      )
    const poses = [
      ['flinch', 1, 0],
      ['look', 2, 0],
      ['reach', 3, 0],
      ['read', 1, 0.5],
      ['sit', 0, 0],
      ['sleep', 6, 0],
    ]
    const card = ([name, v, walk], i) => {
      const x = 12 + (i % 3) * 180
      const y = 56 + Math.floor(i / 3) * 252
      return F(
        {
          name: `pose/${name}`,
          x,
          y,
          w: 170,
          h: 244,
          r: 'radius/lg',
          fill: 'bg/surface',
          stroke: name === 'look' ? 'accent/default' : 'border/default',
          sw: name === 'look' ? 2 : 1,
          clip: true,
        },
        F(
          { x: 0, y: 0, w: 170, h: 196, fill: 'bg/canvas' },
          V(A.figure(v, { walk }), { x: 34, y: 14, w: 102, h: 168 }),
        ),
        T(name, { x: 12, y: 204, style: 'Mono/12', wt: 600 }),
        R(
          { x: 12, y: 222, h: 18, gap: 4 },
          I('check', { size: 12, color: 'state/ok' }),
          T('G7 approved', { style: 'Mono/11', color: 'state/ok' }),
        ),
      )
    }
    const center = region(
      'poses',
      320,
      52,
      554,
      602,
      { fill: 'bg/app' },
      F({ x: 0, y: 0, w: 554, h: 44 }, tabRow(['Turnaround', 'Outfits', 'Sliders', 'Poses', 'Test'], 3)),
      F({ x: 0, y: 43, w: 554, h: 1, fill: 'border/default' }),
      ...poses.map(card),
      R(
        { name: 'footer', x: 12, y: 562, w: 530, h: 32, gap: 8 },
        I('info', { size: 14, color: 'text/faint' }),
        T(
          'Pose atlases are lit from one side and baked at 128 px; the game plays them in place of the procedural figure.',
          { style: 'Label/12', color: 'text/faint', w: 'fill', trunc: true },
        ),
      ),
    )
    const inspector = region(
      'inspector',
      874,
      52,
      320,
      602,
      { lay: 'col' },
      tabs([{ label: 'New pose' }, { label: 'Code' }, { label: 'Ask' }], 0),
      F({ w: 'fill', h: 1, fill: 'border/default' }),
      C(
        { name: 'fields', w: 'fill', h: 'fill', pad: 12, gap: 8, clip: true },
        R({ w: 'fill', h: 28, gap: 8 }, T('Request a pose', { style: 'Title/15' })),
        R(
          { w: 'fill', gap: 8 },
          selectV('Action', 'lean', { mono: true }),
          selectV('Id', 'dawn-lean', { mono: true }),
        ),
        R({ w: 'fill', gap: 8 }, stepperV('Frames', '8'), stepperV('Rate', '12', { unit: 'fps' })),
        R(
          { w: 'fill', gap: 8 },
          stepperV('Cell', '128', { unit: 'px' }),
          stepperV('Span', '0.6', { unit: 's' }),
        ),
        R(
          {
            name: 'estimate',
            w: 'fill',
            pad: 12,
            gap: 10,
            ay: 'start',
            r: 'radius/md',
            fill: 'bg/field',
            stroke: 'border/default',
          },
          I('chart', { size: 18, color: 'text/dim' }),
          C(
            { w: 'fill', gap: 2 },
            T('Estimate: 1 job, about 6 credits', { style: 'Body/13 Medium' }),
            T('Illustrative: the editor reads the figure from the pipeline’s own estimate.', {
              style: 'Label/12',
              color: 'text/faint',
              w: 'fill',
              lh: 16,
            }),
          ),
        ),
        callout(
          'warn',
          'The paid run is the owner’s',
          'Request writes the action into character.json (one undo step) and runs the free check. The job needs gate G7.',
        ),
        btn('Request pose', { kind: 'primary', h: 48, icon: 'send', w: 'fill' }),
      ),
    )
    const dock = pipeline({
      route: 'atlas route',
      stages: [
        { id: 'sheet', state: 'ok', at: 'ran 12 Oct', out: 'ada-3d/atlas-render.png' },
        {
          id: 'pose',
          state: 'ok',
          sel: true,
          at: '6 actions',
          out: 'flinch · look · reach · read · sit · sleep',
        },
      ],
      gates: [
        { id: 'G1', name: 'look', decision: 'approved', by: 'owner' },
        { id: 'G6', name: 'figure', decision: 'approved', by: 'owner' },
        { id: 'G7', name: 'poses', decision: 'approved', by: 'owner' },
      ],
      checks: 'character check ok',
    })
    return F(
      { name: 'Studio · Poses · iPad landscape', w: 1194, h: 834, fill: 'bg/app', clip: true },
      top(1194, {
        title: 'Ada Voss',
        sub: 'docs/art/ada-3d/character.json',
        ed: 'studio',
        cs: 'studio/ada-hair',
        n: 3,
        checks: 'checks ok',
        gates: [['G7', 'ok']],
      }),
      rail(782, 'studio'),
      panel,
      center,
      inspector,
      dock,
      line(0, 51, 1194, 1),
      line(55, 52, 1, 782),
      line(319, 52, 1, 602),
      line(873, 52, 1, 602),
    )
  },
})
