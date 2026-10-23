// Tuner: The Last Light's tunables as sliders (editor/src/client/tuner.ts, tune-model.ts), with fairness measured before and after.

export const tunerScreens = []

// ── Sliders: the hero ──
tunerScreens.push({
  id: 'tuner-sliders',
  page: 'Suite · Tuner',
  name: 'Tuner · Warmth · iPad landscape',
  w: 1194,
  h: 834,
  note: 'Tunable groups on the left, one slider per tunable in the middle with the file value marked, the selected tunable on the right, and the fairness check along the bottom. Each slider stays inside its own min and max; a locked or linked tunable is read-only and says why.',
  build: (_S, P, Q, _A) => {
    const { F, R, C, T, I, alpha, spacer, region, line, eyebrow, pill, btn, ib, tabs, panelHead, callout } = P
    const { D, top, rail, listRow, search, sliderRow, stepperV, kvRow, mono, select } = Q
    const rows = D.tunables.rows
    const by = (n) => rows.find((r) => r.n === n)
    const list = [
      by('lighterReach'),
      by('torchReach'),
      by('drumReach'),
      by('burnerReach'),
      {
        n: 'warmSpot',
        v: 1.4,
        min: 0.5,
        max: 3,
        u: 'm',
        note: 'P1: within this of a warmth he is warming at it',
      },
      by('emberWarm'),
      {
        n: 'retarget',
        v: 0.25,
        min: 0.05,
        max: 1,
        u: 's',
        note: "P1: drawn, he re-routes to a moving warmth (Ada's flame) this often",
      },
    ]
    const flags = {
      lighterReach: { sel: true, changed: true, was: 8 },
      emberWarm: { locked: true },
      retarget: { ro: 'linked' },
    }
    const panel = region(
      'groups panel',
      56,
      52,
      264,
      554,
      { lay: 'col' },
      panelHead('Tunables', ib('more')),
      R({ w: 'fill', h: 52, pad: [0, 8] }, search('Search names and notes')),
      C(
        { name: 'group list', w: 'fill', h: 'fill', pad: [0, 8], gap: 0, clip: true },
        D.tunables.groups.map(([name, icon, n], i) =>
          listRow({
            title: name,
            icon,
            sel: i === 1,
            color: Q.ED.tuner.color,
            h: 48,
            right: R(
              { gap: 6 },
              i === 1 ? pill('1 changed', { color: 'accent/default', h: 20, pad: 7, mono: true }) : null,
              T(String(n), { style: 'Mono/11', color: 'text/faint' }),
            ),
          }),
        ),
        R({ w: 'fill', h: 8 }),
        R(
          { w: 'fill', pad: [4, 8] },
          T(
            'Each slider stays inside its tunable’s min and max. Linked and inherited values are tuned where they live.',
            { style: 'Label/12', color: 'text/faint', w: 'fill', lh: 16 },
          ),
        ),
      ),
    )

    const sliders = region(
      'sliders',
      320,
      52,
      554,
      554,
      { lay: 'col', pad: [8, 12, 0, 12], gap: 0, fill: 'bg/app' },
      R(
        { w: 'fill', h: 28, gap: 8 },
        eyebrow('Warmth'),
        mono('8 tunables'),
        spacer(),
        T('Showing the file value as a tick', { style: 'Label/12', color: 'text/faint' }),
      ),
      list.map((t) => sliderRow(t, { w: 530, ...(flags[t.n] || {}) })),
      F({ name: 'scrollbar', abs: true, x: 548, y: 44, w: 3, h: 300, r: 2, fill: 'border/strong' }),
    )

    const t = by('lighterReach')
    const inspector = region(
      'inspector',
      874,
      52,
      320,
      554,
      { lay: 'col' },
      tabs([{ label: 'Tunable' }, { label: 'Code' }, { label: 'Ask' }], 0),
      F({ w: 'fill', h: 1, fill: 'border/default' }),
      C(
        { name: 'fields', w: 'fill', h: 'fill', pad: 12, gap: 10, clip: true },
        R(
          { w: 'fill', h: 24, gap: 8 },
          T(t.n, { style: 'Mono/12', wt: 600 }),
          spacer(),
          pill('changed', { color: 'accent/default', icon: 'rotate' }),
        ),
        T(t.note, { style: 'Label/12', color: 'text/dim', w: 'fill', lh: 16 }),
        R(
          { w: 'fill', gap: 8 },
          stepperV('Value', '6', { unit: 'm', changed: true }),
          stepperV('File value', '8', { unit: 'm', disabled: true }),
        ),
        R(
          { w: 'fill', gap: 8 },
          stepperV('Min', '2', { unit: 'm', disabled: true }),
          stepperV('Max', '12', { unit: 'm', disabled: true }),
        ),
        C(
          { name: 'used by', w: 'fill', gap: 2, pad: [8, 0, 0, 0] },
          eyebrow('Read by'),
          kvRow('porter', 'senses.warmth.lighter', { h: 24, kw: 56 }),
          kvRow('rules', 'storylets.flameReachesHim', { h: 24, kw: 56 }),
          kvRow('check', 'fairness: first threat', { h: 24, kw: 56 }),
        ),
        callout(
          'info',
          'Reopens gate S-G2',
          'A tunable change goes back to the owner. The editor shows the gate and never records a decision.',
        ),
        R(
          { name: 'footer', w: 'fill', h: 44, gap: 8 },
          btn('Reset to 8', { icon: 'rotate', w: 'fill' }),
          btn('Ask…', { icon: 'sparkles', w: 'fill' }),
        ),
      ),
    )

    // Fairness along the bottom: the last measure, before and after the change, then where to play it.
    const M = [
      ['First threat', '≥ 20 s', '24.1 s', '21.3 s', 'ok'],
      ['Entry kits solvable', '3 of 3', '3 of 3', '3 of 3', 'ok'],
      ['Catch while lit', '≤ 10 %', '6 %', '9 %', 'ok'],
    ]
    const cell = (text, w, o = {}) =>
      T(text, { style: 'Mono/12', w, color: o.color || 'text/primary', align: o.align })
    const fair = region(
      'fairness',
      56,
      606,
      1138,
      228,
      { lay: 'col' },
      line(0, 0, 1138, 1),
      R(
        { name: 'fairness header', w: 'fill', h: 52, pad: [0, 8, 0, 16], gap: 8 },
        eyebrow('Fairness'),
        pill('measured before', { color: 'text/dim', mono: true, icon: 'check' }),
        pill('measured after', { color: 'state/ok', mono: true, icon: 'check' }),
        spacer(),
        T('Seeds', { style: 'Label/12', color: 'text/dim' }),
        P.inputBox('default seeds', { chevron: true, mono: true, w: 150 }),
        btn('Measure after', { kind: 'primary', h: 44, icon: 'play' }),
      ),
      F(
        { name: 'table', w: 'fill', h: 'fill', pad: [0, 16, 12, 16], lay: 'row', gap: 16 },
        C(
          { w: 'fill', h: 'fill', gap: 0 },
          R(
            { w: 'fill', h: 28, gap: 8 },
            cell('Check', 230, { color: 'text/faint' }),
            cell('Limit', 90, { color: 'text/faint' }),
            cell('Before', 90, { color: 'text/faint' }),
            cell('After', 90, { color: 'text/faint' }),
            cell('', 40),
          ),
          M.map((m, i) =>
            R(
              { w: 'fill', h: 38, gap: 8, fill: i % 2 ? alpha('text/primary', 0.02) : null, pad: [0, 4] },
              T(m[0], { style: 'Body/13', w: 230 }),
              cell(m[1], 90, { color: 'text/dim' }),
              cell(m[2], 90, { color: 'text/dim' }),
              cell(m[3], 90, { color: m[4] === 'ok' ? 'text/primary' : 'state/bad' }),
              m[4] === 'ok'
                ? I('check', { size: 16, color: 'state/ok' })
                : I('warn', { size: 16, color: 'state/bad' }),
            ),
          ),
        ),
        R(
          {
            name: 'play here',
            w: 300,
            h: 'fill',
            pad: 12,
            gap: 8,
            r: 'radius/lg',
            fill: 'bg/raised',
            stroke: 'border/default',
          },
          C(
            { w: 'fill', gap: 6 },
            eyebrow('Try it'),
            T('Reload the stage with the current values, then put Ada at a spot.', {
              style: 'Label/12',
              color: 'text/dim',
              w: 'fill',
              lh: 16,
            }),
            select('Start', 'shutter', { lw: 40, mono: true }),
            btn('Play as Ada here', { kind: 'primary', h: 48, icon: 'play', w: 'fill' }),
          ),
        ),
      ),
    )
    return F(
      { name: 'Tuner · Warmth · iPad landscape', w: 1194, h: 834, fill: 'bg/app', clip: true },
      top(1194, {
        title: 'The Bay',
        sub: 'src/scenes/bay/systems.ts',
        ed: 'tuner',
        cs: 'tune/lighter-reach',
        n: 1,
        checks: 'checks ok',
        gates: [['S-G2', 'open']],
        primary: 'Ship',
      }),
      rail(782, 'tuner'),
      panel,
      sliders,
      inspector,
      fair,
      line(0, 51, 1194, 1),
      line(55, 52, 1, 782),
      line(319, 52, 1, 554),
      line(873, 52, 1, 554),
    )
  },
})

// ── Fairness: the measured run, before and after ──
tunerScreens.push({
  id: 'tuner-fairness',
  page: 'Suite · Tuner',
  name: 'Tuner · Fairness · iPad landscape',
  w: 1194,
  h: 834,
  note: 'The measure that runs before a tunable change leaves the editor: tension over a run, before and after, against the limits, with the route the pursuer took. The numbers are illustrative; the editor reads them from the game’s systems check and writes nothing.',
  build: (_S, P, Q, A) => {
    const {
      F,
      R,
      C,
      T,
      I,
      V,
      spacer,
      region,
      line,
      eyebrow,
      pill,
      btn,
      ib,
      tabs,
      panelHead,
      callout,
      diagRow,
    } = P
    const { top, rail, listRow, mono, chart } = Q
    const before = [
      [0, 0.02],
      [20, 0.1],
      [30, 0.3],
      [45, 0.62],
      [60, 0.7],
      [75, 0.35],
      [90, 0.2],
      [120, 0.15],
    ]
    const after = [
      [0, 0.02],
      [24, 0.1],
      [34, 0.28],
      [50, 0.55],
      [64, 0.66],
      [80, 0.3],
      [95, 0.18],
      [120, 0.12],
    ]
    const cw = 506
    const ch = 200
    const panel = region(
      'scenarios panel',
      56,
      52,
      264,
      782,
      { lay: 'col' },
      panelHead('Scenarios', ib('more')),
      C(
        { w: 'fill', pad: [0, 8], gap: 0 },
        listRow({
          title: 'minimal kit',
          sub: 'lighter · 20 s fuel',
          icon: 'check',
          iconColor: 'state/ok',
          h: 52,
          mono: true,
        }),
        listRow({
          title: 'typical kit',
          sub: 'lighter, basin, bottle, scalpel',
          icon: 'check',
          iconColor: 'state/ok',
          sel: true,
          color: Q.ED.tuner.color,
          h: 52,
          mono: true,
        }),
        listRow({
          title: 'maximal kit',
          sub: '8 items · 50 s fuel',
          icon: 'warn',
          iconColor: 'state/warn',
          h: 52,
          mono: true,
        }),
      ),
      R({ w: 'fill', h: 12 }),
      C(
        { w: 'fill', pad: [0, 16], gap: 8 },
        eyebrow('Run'),
        Q.kvRow('Seeds', 'default · 3', { kw: 70 }),
        Q.kvRow('Changed', 'lighterReach 8 → 6', { kw: 70, color: 'accent/default' }),
        Q.kvRow('Took', '41 s on this iPad', { kw: 70 }),
        btn('Measure again', { kind: 'primary', h: 48, icon: 'play', w: 'fill' }),
      ),
    )
    const center = region(
      'report',
      320,
      52,
      554,
      782,
      { lay: 'col', pad: [12, 12, 12, 12], gap: 12, fill: 'bg/app' },
      R(
        { w: 'fill', h: 28, gap: 8 },
        eyebrow('Tension over the run'),
        mono('typical kit · 3 seeds'),
        spacer(),
        pill('before', { color: 'text/dim', dot: true, mono: true, h: 22, pad: 8 }),
        pill('after', { color: 'accent/default', dot: true, mono: true, h: 22, pad: 8 }),
      ),
      F(
        {
          name: 'chart card',
          w: 'fill',
          h: 232,
          r: 'radius/lg',
          fill: 'bg/surface',
          stroke: 'border/default',
          clip: true,
        },
        chart(cw, ch, {
          x: 12,
          y: 12,
          domain: [0, 120, 0, 1],
          band: { y0: 0.6, y1: 1, hex: '#d9645a' },
          marker: 20,
          series: [
            { pts: before, hex: '#8e8c85', w: 1.6 },
            { pts: after, hex: '#e0a54a', w: 2.2, dots: true },
          ],
        }),
        T('peak 0.6', { x: 18, y: 14, style: 'Mono/11', color: 'state/bad' }),
        T('first threat 20 s', { x: 120, y: 16, style: 'Mono/11', color: 'accent/default' }),
        T('0 s', { x: 14, y: 214, style: 'Mono/11', color: 'text/faint' }),
        T('2 min', { x: 468, y: 214, style: 'Mono/11', color: 'text/faint' }),
      ),
      R({ w: 'fill', h: 28, gap: 8 }, eyebrow('Route'), mono('Ada and the Porter, seed 1')),
      R(
        { w: 'fill', h: 160, gap: 12 },
        F(
          {
            name: 'trace card',
            w: 280,
            h: 160,
            r: 'radius/lg',
            fill: 'bg/surface',
            stroke: 'border/default',
            clip: true,
          },
          V(A.traceSvg(264, 148), { name: 'trace', x: 8, y: 6, w: 264, h: 148 }),
        ),
        C(
          { w: 'fill', gap: 4 },
          R({ gap: 8 }, F({ w: 18, h: 3, fill: 'accent/default' }), T('Ada', { style: 'Label/12' })),
          R({ gap: 8 }, F({ w: 18, h: 3, fill: 'state/bad' }), T('The Porter', { style: 'Label/12' })),
          R({ gap: 8 }, P.dot('state/ok', 8), T('Shutter', { style: 'Label/12' })),
          T('He leaves the desk at 24 s, the drum burning, and reaches the mortuary door at 41 s.', {
            style: 'Label/12',
            color: 'text/dim',
            w: 'fill',
            lh: 16,
          }),
        ),
      ),
      R({ w: 'fill', h: 28, gap: 8 }, eyebrow('Findings'), mono('2')),
      C(
        { w: 'fill', gap: 8 },
        diagRow({
          sev: 'warning',
          code: 'fairness.catch-lit',
          msg: 'Catch while lit is 9 %, one point under the 10 % limit for the maximal kit.',
          path: 'systems.ts · fairness.catchWhileLit',
        }),
        diagRow({
          sev: 'info',
          code: 'first-threat.moved',
          msg: 'First threat moved from 24.1 s to 21.3 s; the limit is 20 s.',
          path: 'systems.ts · fairness.firstThreat',
        }),
      ),
    )
    const M = [
      ['First threat', '21.3 s', 'state/ok'],
      ['Longest calm', '38 s', 'state/ok'],
      ['Catch while lit', '9 %', 'state/warn'],
      ['Kits solvable', '3 of 3', 'state/ok'],
      ['Seeds', '3', null],
    ]
    const right = region(
      'measured',
      874,
      52,
      320,
      782,
      { lay: 'col' },
      tabs([{ label: 'Measured' }, { label: 'Checks', badge: 'ok', tone: 'state/ok' }, { label: 'Ask' }], 0),
      F({ w: 'fill', h: 1, fill: 'border/default' }),
      C(
        { w: 'fill', h: 'fill', pad: 12, gap: 8, clip: true },
        M.map((m) =>
          R(
            { w: 'fill', h: 40, pad: [0, 4], gap: 8 },
            T(m[0], { style: 'Body/13', w: 'fill' }),
            T(m[1], { style: 'Mono/12', color: m[2] || 'text/primary' }),
            m[2] ? I(m[2] === 'state/ok' ? 'check' : 'warn', { size: 16, color: m[2] }) : F({ w: 16, h: 16 }),
          ),
        ),
        R({ w: 'fill', h: 8 }),
        callout(
          'info',
          'Gate S-G2 is open',
          'Measured before and after, so the owner can read the change against its effect. The editor shows the gate and never records a decision.',
        ),
        R({ w: 'fill', h: 8 }),
        btn('Play as Ada here', { icon: 'play', w: 'fill' }),
        btn('Back to sliders', { icon: 'slider', w: 'fill' }),
      ),
    )
    return F(
      { name: 'Tuner · Fairness · iPad landscape', w: 1194, h: 834, fill: 'bg/app', clip: true },
      top(1194, {
        title: 'The Bay',
        sub: 'src/scenes/bay/systems.ts',
        ed: 'tuner',
        cs: 'tune/lighter-reach',
        n: 1,
        checks: 'checks ok',
        gates: [['S-G2', 'open']],
        primary: 'Ship',
      }),
      rail(782, 'tuner'),
      panel,
      center,
      right,
      line(0, 51, 1194, 1),
      line(55, 52, 1, 782),
      line(319, 52, 1, 782),
      line(873, 52, 1, 782),
    )
  },
})
