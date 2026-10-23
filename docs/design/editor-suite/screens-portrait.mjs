// The editors in the medium shell (iPad portrait, 834 x 1194): the canvas takes the width, lists and fields become sheets, the editors sit in a tab bar.

export const portraitScreens = []

// ── Tuner ──
portraitScreens.push({
  id: 'tuner-portrait',
  page: 'Suite · Portrait',
  name: 'Tuner · Warmth · iPad portrait',
  w: 834,
  h: 1194,
  note: 'Groups become a row of chips, the sliders take the full width, and the fairness check is a sheet above the tab bar. The selected tunable’s fields open as a drawer from the right.',
  build: (_S, P, Q, _A) => {
    const { F, R, C, T, I, alpha, spacer, region, line, eyebrow, pill, btn, inputBox } = P
    const { D, topP, tabBar, sliderRow, chip, mono, chart } = Q
    const rows = D.tunables.rows
    const by = (n) => rows.find((r) => r.n === n)
    const list = [by('lighterReach'), by('torchReach'), by('drumReach'), by('burnerReach'), by('emberWarm')]
    const flags = { lighterReach: { sel: true, changed: true, was: 8 }, emberWarm: { locked: true } }
    const chips = R(
      { name: 'groups', x: 0, y: 52, w: 834, h: 52, pad: [0, 16], gap: 8 },
      ...D.tunables.groups.map(([n, , c], i) =>
        chip(`${n} ${c}`, { on: i === 1, color: Q.ED.tuner.color, h: 36 }),
      ),
    )
    const sliders = C(
      { name: 'sliders', x: 16, y: 108, w: 802, h: 'hug', gap: 0 },
      R(
        { w: 'fill', h: 28, gap: 8 },
        eyebrow('Warmth'),
        mono('8 tunables'),
        spacer(),
        mono('file value as a tick'),
      ),
      list.map((t) => sliderRow(t, { w: 802, ...(flags[t.n] || {}) })),
    )
    const sheet = region(
      'fairness',
      0,
      560,
      834,
      570,
      { lay: 'col' },
      F({ name: 'divider', abs: true, x: 0, y: 0, w: 834, h: 1, fill: 'border/default' }),
      F({ name: 'handle', abs: true, x: 399, y: 8, w: 36, h: 4, r: 2, fill: 'border/strong' }),
      R(
        { w: 'fill', h: 56, pad: [8, 8, 0, 16], gap: 8 },
        eyebrow('Fairness'),
        pill('measured after', { color: 'state/ok', mono: true, icon: 'check' }),
        spacer(),
        btn('Measure after', { kind: 'primary', h: 44, icon: 'play' }),
      ),
      C(
        { w: 'fill', h: 'fill', pad: [0, 16, 12, 16], gap: 10 },
        F(
          {
            name: 'chart',
            w: 'fill',
            h: 170,
            r: 'radius/lg',
            fill: 'bg/surface',
            stroke: 'border/default',
            clip: true,
          },
          chart(778, 150, {
            x: 12,
            y: 10,
            domain: [0, 120, 0, 1],
            band: { y0: 0.6, y1: 1, hex: '#d9645a' },
            marker: 20,
            series: [
              {
                pts: [
                  [0, 0.02],
                  [20, 0.1],
                  [30, 0.3],
                  [45, 0.62],
                  [60, 0.7],
                  [75, 0.35],
                  [90, 0.2],
                  [120, 0.15],
                ],
                hex: '#8e8c85',
                w: 1.6,
              },
              {
                pts: [
                  [0, 0.02],
                  [24, 0.1],
                  [34, 0.28],
                  [50, 0.55],
                  [64, 0.66],
                  [80, 0.3],
                  [95, 0.18],
                  [120, 0.12],
                ],
                hex: '#e0a54a',
                w: 2.2,
                dots: true,
              },
            ],
          }),
        ),
        ...[
          ['First threat', '≥ 20 s', '24.1 s', '21.3 s', 'ok'],
          ['Entry kits solvable', '3 of 3', '3 of 3', '3 of 3', 'ok'],
          ['Catch while lit', '≤ 10 %', '6 %', '9 %', 'ok'],
        ].map((m, i) =>
          R(
            { w: 'fill', h: 40, gap: 8, pad: [0, 8], fill: i % 2 ? alpha('text/primary', 0.02) : null },
            T(m[0], { style: 'Body/13', w: 'fill' }),
            T(m[1], { style: 'Mono/12', color: 'text/dim', w: 70 }),
            T(m[2], { style: 'Mono/12', color: 'text/dim', w: 70 }),
            T(m[3], { style: 'Mono/12', w: 70 }),
            I('check', { size: 16, color: 'state/ok' }),
          ),
        ),
        R(
          { w: 'fill', h: 48, gap: 8 },
          R({ w: 'fill' }, inputBox('shutter', { chevron: true, mono: true })),
          btn('Play as Ada here', { kind: 'primary', h: 48, icon: 'play' }),
        ),
      ),
    )
    return F(
      { name: 'Tuner · Warmth · iPad portrait', w: 834, h: 1194, fill: 'bg/app', clip: true },
      topP(834, { title: 'The Bay', sub: 'systems.ts', cs: 'tune/lighter-reach', n: 1, checks: 'checks ok' }),
      chips,
      sliders,
      sheet,
      tabBar(834, 1130, 'tuner'),
      line(0, 51, 834, 1),
    )
  },
})

// ── Writer ──
portraitScreens.push({
  id: 'writer-portrait',
  page: 'Suite · Portrait',
  name: 'Writer · Lines · iPad portrait',
  w: 834,
  h: 1194,
  note: 'The selected line first, as text you edit and a preview of how it plays; its beat, hints and facts under it. The scene’s lines are a sheet above the tab bar with the lint status.',
  build: (_S, P, Q, A) => {
    const { F, R, C, T, I, V, alpha, spacer, region, line, eyebrow, pill, btn, dot, tabs } = P
    const { topP, tabBar, chip, textArea, mono, search } = Q
    const lines = [
      [
        'arrival.2',
        '—',
        'On the stretcher, a run sheet. PT: VOSS, A. (STAFF NURSE). DOA 04:17.',
        { lock: true },
      ],
      [
        'arrival.3',
        'The Porter',
        'Cold. Always so cold. Any little flame, and I come to it like a moth.',
        { sel: true, changed: true },
      ],
      [
        'ambulanceFirst',
        'Ada',
        'The rear doors hang open. On the stretcher, a clipboard with a run sheet.',
        {},
      ],
      ['keyHook', 'Ada', 'A hook by the door with a paper tag: KEYS. Empty.', {}],
      ['routine.1', 'The Porter', 'Cold. Always so cold down here. Any little flame, and there I am.', {}],
    ]
    const lineRow = ([id, who, text, o]) =>
      R(
        {
          name: `line/${id}`,
          w: 'fill',
          h: 56,
          pad: [0, 10, 0, 12],
          gap: 8,
          r: 'radius/md',
          fill: o.sel ? alpha(Q.ED.writer.color, 0.12) : null,
          stroke: o.sel ? alpha(Q.ED.writer.color, 0.6) : null,
        },
        C(
          { w: 'fill', gap: 1 },
          R(
            { w: 'fill', gap: 6 },
            T(id, { style: 'Mono/11', color: o.sel ? Q.ED.writer.color : 'text/dim' }),
            T(who, { style: 'Mono/11', color: 'text/faint', w: 'fill', trunc: true }),
          ),
          T(text, { style: 'Body/13', w: 'fill', trunc: true }),
        ),
        o.changed ? dot('accent/default', 7) : null,
        o.lock ? I('lock', { size: 14, color: 'text/faint' }) : null,
      )
    const meta = (label, ...kids) =>
      C({ w: 'fill', gap: 4 }, eyebrow(label), R({ w: 'fill', gap: 6 }, ...kids))
    const upper = C(
      { name: 'line editor', x: 0, y: 52, w: 834, h: 'hug', pad: [0, 16, 0, 16], gap: 8 },
      F(
        { w: 'fill', h: 44 },
        tabs([{ label: 'Lines' }, { label: 'Dialogues' }, { label: 'Beats' }, { label: 'Hints' }], 0),
      ),
      R(
        { w: 'fill', h: 28, gap: 8 },
        T('bay.cutscene.arrival.3', { style: 'Mono/12', wt: 600 }),
        pill('The Porter', { color: 'layer/entities', dot: true }),
        spacer(),
        mono('71 characters'),
      ),
      textArea('Cold. Always so cold. Any little flame, and I come to it like a moth.', 802, 84, {
        focus: true,
        lh: 22,
      }),
      F(
        {
          name: 'preview',
          w: 'fill',
          h: 250,
          r: 'radius/lg',
          fill: 'bg/canvas',
          stroke: 'border/default',
          clip: true,
        },
        V(A.bayArt({ ada: false, lamp: 0.55, dim: 0.3 }), { name: 'art', x: 0, y: -20, w: 802, h: 451 }),
        F(
          {
            name: 'caption box',
            x: 126,
            y: 168,
            w: 550,
            h: 62,
            r: 8,
            fill: alpha('bg/canvas', 0.82),
            stroke: 'border/strong',
          },
          T('THE PORTER', { x: 16, y: 9, style: 'Eyebrow/11', color: 'layer/entities' }),
          T('Cold. Always so cold. Any little flame, and I come to it like a moth.', {
            x: 16,
            y: 28,
            size: 13,
            wt: 500,
            w: 518,
            trunc: true,
          }),
        ),
      ),
      R(
        { w: 'fill', gap: 16, ay: 'start' },
        meta('Beat', chip('bay.warmth', { on: true, color: 'layer/sky', mono: true })),
        meta('Hints', chip('flameDrawsHim', { mono: true })),
        meta('Facts', chip('porterCold', { mono: true })),
      ),
    )
    const sheet = region(
      'lines sheet',
      0,
      690,
      834,
      440,
      { lay: 'col' },
      F({ name: 'divider', abs: true, x: 0, y: 0, w: 834, h: 1, fill: 'border/default' }),
      F({ name: 'handle', abs: true, x: 399, y: 8, w: 36, h: 4, r: 2, fill: 'border/strong' }),
      R(
        { w: 'fill', h: 56, pad: [8, 8, 0, 16], gap: 8 },
        eyebrow('Lines'),
        mono('41 in The Bay'),
        spacer(),
        pill('0 errors', { color: 'state/ok', mono: true, icon: 'check' }),
        pill('2 notes', { color: 'layer/sky', mono: true, icon: 'info' }),
        btn('Lint now', { icon: 'rotate' }),
      ),
      C(
        { w: 'fill', h: 'fill', pad: [0, 16], gap: 0, clip: true },
        R({ w: 'fill', h: 44 }, search('Search text and ids')),
        lines.map(lineRow),
      ),
    )
    return F(
      { name: 'Writer · Lines · iPad portrait', w: 834, h: 1194, fill: 'bg/app', clip: true },
      topP(834, { title: 'The Bay', sub: 'story.ts', cs: 'story/porter-arrival', n: 1, checks: 'checks ok' }),
      upper,
      sheet,
      tabBar(834, 1130, 'writer'),
      line(0, 51, 834, 1),
    )
  },
})

// ── Studio ──
portraitScreens.push({
  id: 'studio-portrait',
  page: 'Suite · Portrait',
  name: 'Studio · Turnaround · iPad portrait',
  w: 834,
  h: 1194,
  note: 'The eight directions at a larger size, the story rows under them and the pipeline as a strip above the tab bar. The roster is a chip at the top left.',
  build: (_S, P, Q, A) => {
    const { F, R, C, T, I, V, alpha, spacer, region, line, eyebrow, pill, btn, seg, tabs } = P
    const { topP, tabBar, mono, select } = Q
    const views = ['front', 'front right', 'right', 'back right', 'back', 'back left', 'left', 'front left']
    const cell = (v, i) =>
      F(
        {
          name: `view/${views[v]}`,
          x: 16 + (i % 4) * 202,
          y: 168 + Math.floor(i / 4) * 330,
          w: 194,
          h: 322,
          r: 'radius/lg',
          fill: 'bg/canvas',
          stroke: v === 0 ? alpha(Q.ED.studio.color, 0.7) : 'border/default',
          clip: true,
        },
        V(A.figure(v, { walk: v === 2 || v === 6 ? 0.6 : 0 }), { x: 40, y: 14, w: 114, h: 256 }),
        T(views[v], {
          x: 0,
          y: 292,
          w: 194,
          align: 'center',
          style: 'Mono/12',
          color: v === 0 ? Q.ED.studio.color : 'text/dim',
        }),
      )
    const stage = (id, state, at) =>
      C(
        { w: 'fill', h: 64, pad: 10, gap: 2, r: 'radius/md', fill: 'bg/raised', stroke: 'border/default' },
        R(
          { w: 'fill', gap: 6 },
          P.dot(state === 'ok' ? 'state/ok' : 'state/warn', 8),
          T(id, { style: 'Mono/12', wt: 600 }),
        ),
        T(at, { style: 'Label/12', color: 'text/dim', w: 'fill', trunc: true }),
      )
    const gate = (id) =>
      C(
        {
          w: 'fill',
          h: 64,
          pad: 10,
          gap: 2,
          r: 'radius/md',
          fill: alpha('state/ok', 0.08),
          stroke: alpha('state/ok', 0.4),
        },
        R(
          { w: 'fill', gap: 6 },
          I('check', { size: 14, color: 'state/ok' }),
          T(id, { style: 'Mono/12', wt: 600 }),
        ),
        T('approved · owner', { style: 'Mono/11', color: 'state/ok', w: 'fill', trunc: true }),
      )
    const top_ = C(
      { name: 'chrome', x: 0, y: 52, w: 834, h: 'hug', pad: [0, 16, 0, 16], gap: 8 },
      F(
        { w: 'fill', h: 44 },
        tabs(
          [
            { label: 'Turnaround' },
            { label: 'Outfits' },
            { label: 'Sliders' },
            { label: 'Poses' },
            { label: 'Test' },
          ],
          0,
        ),
      ),
      R(
        { w: 'fill', h: 52, gap: 8 },
        R(
          { gap: 8, h: 44, pad: [0, 12], r: 'radius/md', fill: 'bg/raised', stroke: 'border/default' },
          F(
            { w: 22, h: 28, r: 4, fill: 'bg/canvas', clip: true },
            V(A.figure(0), { x: 2, y: 0, w: 18, h: 40 }),
          ),
          T('Ada Voss', { style: 'Body/13 Medium' }),
          I('chevron-down', { size: 14, color: 'text/dim' }),
        ),
        R({ w: 170 }, select('Outfit', 'nurse', { lw: 50, mono: true })),
        seg(['Hall light off', 'on'], 0, { w: 220 }),
        spacer(),
        mono('8 views'),
      ),
    )
    const strip = region(
      'pipeline',
      0,
      848,
      834,
      282,
      { lay: 'col' },
      F({ name: 'divider', abs: true, x: 0, y: 0, w: 834, h: 1, fill: 'border/default' }),
      R(
        { w: 'fill', h: 56, pad: [0, 8, 0, 16], gap: 8 },
        eyebrow('Pipeline'),
        pill('procedural route', { color: 'text/dim', mono: true }),
        spacer(),
        btn('Check', { icon: 'check' }),
        btn('Estimate', { icon: 'chart' }),
      ),
      C(
        { w: 'fill', h: 'fill', pad: [0, 16, 16, 16], gap: 8 },
        R(
          { w: 'fill', gap: 8 },
          stage('builder', 'ok', 'ran 2 min ago'),
          stage('sheet', 'ok', 'ran yesterday'),
          stage('play', 'ok', 'ran yesterday'),
        ),
        R({ w: 'fill', gap: 8 }, gate('G1 look'), gate('G6 figure'), gate('G7 poses')),
        T('Gates are the owner’s: the editor shows them and never records one.', {
          style: 'Label/12',
          color: 'text/faint',
        }),
      ),
    )
    return F(
      { name: 'Studio · Turnaround · iPad portrait', w: 834, h: 1194, fill: 'bg/app', clip: true },
      topP(834, { title: 'Ada Voss', sub: 'ada.json', cs: 'studio/ada-hair', n: 2, checks: 'checks ok' }),
      top_,
      ...[0, 1, 2, 3, 4, 5, 6, 7].map(cell),
      strip,
      tabBar(834, 1130, 'studio'),
      line(0, 51, 834, 1),
    )
  },
})

// ── Review desk ──
portraitScreens.push({
  id: 'review-portrait',
  page: 'Suite · Portrait',
  name: 'Review desk · iPad portrait',
  w: 834,
  h: 1194,
  note: 'The owner’s review on an iPad held upright: one change set at a time, its evidence in one column, and the two actions that matter pinned above the tab bar. The editor links to GitHub to approve a gate and never records one.',
  build: (_S, P, Q, _A) => {
    const { F, R, C, T, I, alpha, spacer, region, line, eyebrow, pill, btn } = P
    const { topP, tabBar, diff, chart, mono } = Q
    const card = (name, h, ...kids) =>
      F(
        {
          name,
          w: 'fill',
          h,
          r: 'radius/lg',
          fill: 'bg/surface',
          stroke: 'border/default',
          clip: true,
          lay: 'col',
          pad: 12,
          gap: 8,
        },
        ...kids,
      )
    const body = C(
      { name: 'evidence', x: 0, y: 52, w: 834, h: 'hug', pad: [12, 16, 0, 16], gap: 10 },
      R(
        { w: 'fill', h: 44, gap: 8 },
        R(
          { h: 44, gap: 8, pad: [0, 12], r: 'radius/md', fill: 'bg/raised', stroke: 'border/default' },
          I('gate', { size: 16, color: 'accent/default' }),
          T('tune/lighter-reach', { style: 'Mono/12' }),
          I('chevron-down', { size: 14, color: 'text/dim' }),
        ),
        pill('draft PR', { color: 'text/dim', icon: 'branch', mono: true }),
        spacer(),
        mono('4 open · 1 gate waiting'),
      ),
      card(
        'what changed',
        130,
        R({ w: 'fill', h: 20, gap: 8 }, eyebrow('What changed'), spacer(), mono('systems.ts')),
        diff(
          [
            [' ', 12, "  torchReach: tunable(8, 2, 14, 'm', 'P1: a lit rag torch …'),"],
            ['-', 11, "  lighterReach: tunable(8, 2, 12, 'm', 'P1: a lit lighter …'),"],
            ['+', 11, "  lighterReach: tunable(6, 2, 12, 'm', 'P1: a lit lighter …'),"],
          ],
          778,
          { rowH: 24 },
        ),
      ),
      card(
        'tension',
        244,
        R(
          { w: 'fill', h: 20, gap: 8 },
          eyebrow('Tension over the run'),
          mono('typical kit'),
          spacer(),
          pill('before', { color: 'text/dim', dot: true, mono: true, h: 22, pad: 8 }),
          pill('after', { color: 'accent/default', dot: true, mono: true, h: 22, pad: 8 }),
        ),
        chart(778, 170, {
          domain: [0, 120, 0, 1],
          band: { y0: 0.6, y1: 1, hex: '#d9645a' },
          marker: 20,
          series: [
            {
              pts: [
                [0, 0.02],
                [20, 0.1],
                [30, 0.3],
                [45, 0.62],
                [60, 0.7],
                [75, 0.35],
                [90, 0.2],
                [120, 0.15],
              ],
              hex: '#8e8c85',
              w: 1.6,
            },
            {
              pts: [
                [0, 0.02],
                [24, 0.1],
                [34, 0.28],
                [50, 0.55],
                [64, 0.66],
                [80, 0.3],
                [95, 0.18],
                [120, 0.12],
              ],
              hex: '#e0a54a',
              w: 2.2,
              dots: true,
            },
          ],
        }),
      ),
      card(
        'checks',
        258,
        R(
          { w: 'fill', h: 20, gap: 8 },
          eyebrow('Checks'),
          spacer(),
          pill('4 passed', { color: 'state/ok', mono: true, h: 22, pad: 8, icon: 'check' }),
          pill('1 running', { color: 'text/dim', mono: true, h: 22, pad: 8, icon: 'clock' }),
        ),
        ...[
          ['cutscene audit', 'ok', 'every line plays'],
          ['narrative lint', 'ok', '0 errors · 2 notes'],
          ['puzzle solve', 'ok', '3 of 3 kits'],
          ['systems fairness', 'ok', 'first threat 21.3 s'],
          ['playthrough · bay', 'run', 'step 41 of 58'],
        ].map(([n, s, d]) =>
          R(
            { w: 'fill', h: 34, gap: 10 },
            s === 'ok'
              ? I('check', { size: 16, color: 'state/ok' })
              : I('clock', { size: 16, color: 'text/dim' }),
            T(n, { style: 'Body/13', w: 170 }),
            T(d, { style: 'Mono/11', color: 'text/dim', w: 'fill', trunc: true }),
          ),
        ),
      ),
      C(
        {
          name: 'gate S-G2',
          w: 'fill',
          pad: 12,
          gap: 8,
          r: 'radius/md',
          fill: alpha('accent/default', 0.08),
          stroke: alpha('accent/default', 0.5),
        },
        R(
          { w: 'fill', gap: 8 },
          I('gate', { size: 16, color: 'accent/default' }),
          T('S-G2', { style: 'Mono/12', wt: 600 }),
          T('tunables', { style: 'Label/12', color: 'text/dim' }),
          spacer(),
          T('open', { style: 'Mono/11', color: 'accent/default' }),
        ),
        T('Reopened by lighterReach 8 → 6. Read the fairness above, then approve.', {
          style: 'Label/12',
          color: 'text/dim',
          w: 'fill',
          lh: 16,
        }),
        btn('Approve on GitHub', { icon: 'external', h: 48, w: 'fill' }),
      ),
      R(
        { w: 'fill', h: 28, gap: 8 },
        T('Ask spend', { style: 'Body/13' }),
        mono('12k of 60k tokens'),
        spacer(),
        T('Paid runs', { style: 'Body/13' }),
        mono('none'),
      ),
    )
    const actions = region(
      'actions',
      0,
      1050,
      834,
      80,
      { lay: 'row', pad: [0, 16], gap: 8, ay: 'center' },
      F({ name: 'divider', abs: true, x: 0, y: 0, w: 834, h: 1, fill: 'border/default' }),
      btn('Open the draft PR', { icon: 'external', w: 'fill' }),
      btn('Mark ready for review', { kind: 'primary', h: 48, icon: 'check', w: 'fill' }),
    )
    return F(
      { name: 'Review desk · iPad portrait', w: 834, h: 1194, fill: 'bg/app', clip: true },
      topP(834, {
        title: 'Review',
        sub: 'PixiJS3D_Experiment_001',
        cs: 'tune/lighter-reach',
        n: 1,
        checks: 'checks ok',
      }),
      body,
      actions,
      tabBar(834, 1130, 'review'),
      line(0, 51, 834, 1),
    )
  },
})
