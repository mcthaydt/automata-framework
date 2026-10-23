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
    const list = [
      { ...by('LIGHTER_REACH'), v: 5 },
      by('TORCH_REACH'),
      by('DRUM_REACH'),
      by('BURNER_REACH'),
      by('EMBER_WARM'),
    ]
    const flags = { LIGHTER_REACH: { sel: true, changed: true, was: 6 }, EMBER_WARM: { locked: true } }
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
          ['First threat', '≥ 20 s', '21.3 s', '24.1 s', 'ok'],
          ['Entry kits solvable', '3 of 3', '3 of 3', '3 of 3', 'ok'],
          ['Catch while lit', '≤ 10 %', '9 %', '6 %', 'ok'],
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
      topP(834, {
        title: 'The Bay',
        sub: 'tuning.toml',
        cs: 'edit/arrival-timing',
        n: 2,
        checks: 'checks ok',
        gates: [['S-G2', 'open']],
      }),
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
  note: 'The selected line first, with its speaker picker, as text you edit and a preview of how it plays; its beat, hints, facts and motifs under it, each with + add. The scene’s lines are a sheet above the tab bar with the lint status.',
  build: (_S, P, Q, A) => {
    const { F, R, C, T, I, V, alpha, spacer, region, line, eyebrow, pill, btn, dot, tabs } = P
    const { topP, tabBar, chip, textArea, mono, search, select } = Q
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
        { w: 'fill', h: 44, gap: 12 },
        T('bay.cutscene.arrival.3', { style: 'Mono/12', wt: 600 }),
        mono('71 characters'),
        spacer(),
        F({ w: 300, h: 44 }, select('Speaker', 'The Porter', { lw: 70 })),
      ),
      textArea('Cold. Always so cold. Any little flame, and I come to it like a moth.', 802, 84, {
        focus: true,
        lh: 22,
      }),
      F(
        {
          name: 'preview',
          w: 'fill',
          h: 220,
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
        meta('Delivers beat', chip('bay.warmth', { on: true, color: 'layer/sky', mono: true })),
        meta(
          'Hints',
          chip('flameDrawsHim', { mono: true, remove: true }),
          chip('+ add', { color: 'accent/default' }),
        ),
      ),
      R(
        { w: 'fill', gap: 16, ay: 'start' },
        meta(
          'Facts',
          chip('porterCold', { mono: true, remove: true }),
          chip('+ add', { color: 'accent/default' }),
        ),
        meta(
          'Motifs',
          chip('warmth', { mono: true, remove: true }),
          chip('+ add', { color: 'accent/default' }),
        ),
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
      topP(834, {
        title: 'The Bay',
        sub: 'story.toml',
        cs: 'story/porter-arrival',
        n: 1,
        checks: 'checks ok',
        gates: [['N-G1', 'open']],
      }),
      upper,
      sheet,
      tabBar(834, 1130, 'writer'),
      line(0, 51, 834, 1),
    )
  },
})

// ── Schematic ──
portraitScreens.push({
  id: 'schematic-portrait',
  page: 'Suite · Portrait',
  name: 'Schematic · The shutter · iPad portrait',
  w: 834,
  h: 1194,
  note: 'Locks become a row of chips, the chain takes the full width with the solver’s result on it, and the picked action’s fields open as a bottom sheet: what must be true on the left, what it says and how long on the right.',
  build: (_S, P, Q, _A) => {
    const { F, R, C, T, I, alpha, spacer, region, line, eyebrow, pill, btn, ib, tabs, dot } = P
    const { D, topP, tabBar, chip, shutterGraph, stepperV, selectV } = Q
    const locks = R(
      { name: 'locks', x: 0, y: 52, w: 834, h: 52, pad: [0, 16], gap: 8 },
      ...[
        ['Flame', 3],
        ['Drum fuel', 3],
        ['The Porter’s keys', 2],
        ['Safe cranking', 2],
      ].map(([n, k], i) => chip(`${n} · ${k} ways`, { on: i === 2, color: Q.ED.schematic.color, h: 36 })),
    )
    const canvas = region(
      'chain',
      0,
      104,
      834,
      604,
      { fill: 'bg/canvas' },
      shutterGraph(140),
      R(
        { name: 'legend', x: 12, y: 572, h: 24, gap: 10 },
        R({ gap: 5 }, dot('layer/sky', 8), T('action', { style: 'Mono/11', color: 'text/dim' })),
        R({ gap: 5 }, dot('phase/teach', 8), T('systemic', { style: 'Mono/11', color: 'text/dim' })),
        R({ gap: 5 }, dot('state/ok', 8), T('goal', { style: 'Mono/11', color: 'text/dim' })),
      ),
      R(
        {
          name: 'tools',
          x: 690,
          y: 12,
          pad: 4,
          gap: 2,
          r: 'radius/lg',
          fill: 'bg/surface',
          stroke: 'border/default',
        },
        ib('minus', { size: 16 }),
        T('90%', { style: 'Mono/11', w: 34, align: 'center' }),
        ib('plus', { size: 16 }),
      ),
      R(
        { name: 'solver', x: 568, y: 544, w: 254, h: 48, gap: 8 },
        pill('3 of 3 solved', { color: 'state/ok', mono: true, icon: 'check' }),
        spacer(),
        btn('Run solver', { icon: 'play', h: 44 }),
      ),
    )
    const field = (k, v, o = {}) =>
      R(
        {
          w: 'fill',
          h: 44,
          gap: 8,
          pad: [0, 10],
          r: 'radius/md',
          fill: 'bg/field',
          stroke: 'border/default',
        },
        T(k, { style: 'Label/12', color: 'text/dim', w: 40 }),
        T(v, { style: 'Mono/12', w: 'fill', trunc: true }),
        I(o.lock ? 'lock' : 'chevron-right', { size: 14, color: 'text/faint' }),
      )
    const sheet = region(
      'action sheet',
      0,
      708,
      834,
      422,
      { lay: 'col' },
      F({ name: 'divider', abs: true, x: 0, y: 0, w: 834, h: 1, fill: 'border/default' }),
      F({ name: 'handle', abs: true, x: 399, y: 8, w: 36, h: 4, r: 2, fill: 'border/strong' }),
      R(
        { w: 'fill', h: 60, pad: [12, 8, 0, 16], gap: 10 },
        F({ w: 14, h: 14, r: 4, fill: alpha('layer/sky', 0.85) }),
        T('shutter.unlock', { style: 'Mono/12', wt: 600 }),
        pill('literal', { color: 'state/ok', icon: 'check' }),
        spacer(),
        F({ w: 300, h: 44 }, tabs([{ label: 'Action' }, { label: 'Code' }, { label: 'Ask' }], 0)),
      ),
      R(
        { w: 'fill', h: 'fill', pad: [4, 16, 12, 16], gap: 16, ay: 'start' },
        C(
          { name: 'when then', w: 'fill', gap: 6 },
          eyebrow('When'),
          field('fact', 'padlock is true'),
          R({ w: 'fill', h: 2 }),
          eyebrow('Then'),
          field('set', 'padlock → false'),
          field('take', 'keys'),
          field('set', 'keysAt → padlock'),
          field('do', 'checkpoint', { lock: true }),
        ),
        C(
          { name: 'where and says', w: 'fill', gap: 8 },
          R(
            { w: 'fill', gap: 8 },
            selectV('At', 'shutter', { mono: true }),
            selectV('Uses', 'keys', { mono: true }),
          ),
          R(
            { w: 'fill', gap: 8 },
            selectV('Says', 'padlockOff', { mono: true }),
            stepperV('Seconds', '3', { unit: 's' }),
          ),
          R({ w: 'fill', h: 4 }),
          btn('Open the line in Writer', { icon: 'chat', w: 'fill', h: 44 }),
        ),
      ),
    )
    return F(
      { name: 'Schematic · The shutter · iPad portrait', w: 834, h: 1194, fill: 'bg/app', clip: true },
      topP(834, {
        title: 'The Bay',
        sub: 'puzzle.toml',
        cs: 'puzzle/keys-two-ways',
        n: 1,
        checks: 'checks ok',
        gates: [['P-G1', 'open']],
      }),
      locks,
      canvas,
      sheet,
      tabBar(834, 1130, 'schematic'),
      line(0, 51, 834, 1),
    )
  },
})

// ── Audio ──
portraitScreens.push({
  id: 'audio-portrait',
  page: 'Suite · Portrait',
  name: 'Audio · bang · iPad portrait',
  w: 834,
  h: 1194,
  note: 'The cue list becomes a picker with the category chips beside it, the waveform and voices take the full width, and the picked voice’s fields with the mix under them are a sheet above the tab bar.',
  build: (_S, P, Q, A) => {
    const { F, R, C, T, V, alpha, spacer, region, line, eyebrow, pill, btn, ib, seg, tabs, inputBox } = P
    const { topP, tabBar, chip, lanes, ruler, stepperV, toggleRow, meter, mono } = Q
    const pick = R(
      { name: 'cue picker', x: 0, y: 52, w: 834, h: 60, pad: [0, 16], gap: 8 },
      F({ w: 240, h: 44 }, inputBox('bang', { chevron: true, mono: true, h: 44 })),
      chip('all', { on: true, color: Q.ED.audio.color, x: 16, h: 36 }),
      chip('effects', { h: 36 }),
      chip('ui', { x: 18, h: 36 }),
      chip('music', { h: 36 }),
      spacer(),
      ib('plus'),
    )
    const W = 802
    const dur = 1.25
    const L = lanes({
      w: W,
      dur,
      y0: 30,
      labelW: 70,
      padR: 10,
      rows: [
        {
          label: 'Voice 1',
          h: 36,
          color: 'ed/audio',
          items: [{ k: 'blk', t: 0, t1: 0.6, label: 'sine 90→30', sel: true }],
        },
        {
          label: 'Voice 2',
          h: 36,
          color: 'layer/sky',
          items: [{ k: 'blk', t: 0, t1: 0.4, label: 'hiss 900' }],
        },
        {
          label: 'Voice 3',
          h: 36,
          color: 'layer/sky',
          items: [{ k: 'blk', t: 0.05, t1: 1.25, label: 'hiss 4200 · q 3' }],
        },
      ],
    })
    const editor = C(
      { name: 'cue editor', x: 16, y: 116, w: W, h: 'hug', gap: 8 },
      R(
        { w: 'fill', h: 28, gap: 8 },
        T('bang', { style: 'Mono/12', wt: 600 }),
        pill('effects', { color: Q.ED.audio.color, dot: true, mono: true }),
        pill('world', { color: 'text/dim', icon: 'pin', mono: true }),
        T('The breaker blows: a low thump, a crack and the hiss after it.', {
          style: 'Label/12',
          color: 'text/dim',
          w: 'fill',
          trunc: true,
        }),
        mono('1.25 s · 3 voices'),
      ),
      F(
        {
          name: 'waveform',
          w: 'fill',
          h: 150,
          r: 'radius/lg',
          fill: 'bg/canvas',
          stroke: 'border/default',
          clip: true,
        },
        V(A.waveSvg(786, 134, { kind: 'hiss', seed: 5, decay: 2.6, attack: 0.02 }), {
          x: 8,
          y: 8,
          w: 786,
          h: 134,
        }),
        T('rendered offline, identical to the game', {
          x: 12,
          y: 130,
          style: 'Mono/11',
          color: 'text/faint',
        }),
      ),
      R(
        { name: 'play row', w: 'fill', h: 48, gap: 8 },
        btn('Play', { kind: 'primary', h: 48, icon: 'play', w: 110 }),
        btn('Loop', { icon: 'loop' }),
        btn('Place', { icon: 'pin' }),
        spacer(),
        pill('no clicks', { color: 'state/ok', mono: true, icon: 'check' }),
        pill('peak −6.2 dB', { color: 'state/ok', mono: true }),
      ),
      R(
        { name: 'voices header', w: 'fill', h: 44, gap: 8 },
        eyebrow('Voices'),
        spacer(),
        btn('Add voice', { icon: 'plus', h: 44 }),
      ),
      F(
        {
          name: 'voices',
          w: 'fill',
          h: 140,
          r: 'radius/md',
          fill: 'bg/surface',
          stroke: 'border/default',
          clip: true,
        },
        ...ruler({ w: W, dur, step: 0.25, minor: 0.05, y: 6, labelW: 70, padR: 10 }),
        ...L.kids,
      ),
      R(
        { name: 'used by', w: 'fill', h: 44, gap: 8 },
        eyebrow('Played by'),
        chip('cutscene arrival · 0.2 s', { mono: true }),
        chip('noise.bang', { mono: true }),
      ),
    )
    const bus = (name, v, c) =>
      C(
        {
          name: `bus/${name}`,
          w: 'fill',
          h: 64,
          pad: [10, 12],
          gap: 6,
          r: 'radius/md',
          fill: 'bg/raised',
          stroke: 'border/default',
        },
        R({ w: 'fill', gap: 8 }, T(name, { style: 'Mono/12', wt: 600 }), spacer(), mono(v.toFixed(2))),
        meter(160, v, { color: c, h: 8 }),
      )
    const sheet = region(
      'voice sheet',
      0,
      640,
      834,
      490,
      { lay: 'col' },
      F({ name: 'divider', abs: true, x: 0, y: 0, w: 834, h: 1, fill: 'border/default' }),
      F({ name: 'handle', abs: true, x: 399, y: 8, w: 36, h: 4, r: 2, fill: 'border/strong' }),
      R(
        { w: 'fill', h: 60, pad: [12, 8, 0, 16], gap: 10 },
        F({ w: 14, h: 14, r: 4, fill: alpha('ed/audio', 0.85) }),
        T('Voice 1 · tone', { style: 'Title/15' }),
        pill('literal', { color: 'state/ok', icon: 'check' }),
        spacer(),
        F({ w: 300, h: 44 }, tabs([{ label: 'Voice' }, { label: 'Cue' }, { label: 'Ask' }], 0)),
      ),
      R(
        { w: 'fill', pad: [4, 16, 0, 16], gap: 16, ay: 'start' },
        C(
          { name: 'sound', w: 'fill', gap: 8 },
          C(
            { w: 'fill', gap: 2 },
            T('Wave', { style: 'Label/12', color: 'text/dim' }),
            seg(['sine', 'square', 'saw', 'tri'], 0),
          ),
          R(
            { w: 'fill', gap: 8 },
            stepperV('From', '90', { unit: 'Hz' }),
            stepperV('To', '30', { unit: 'Hz', changed: true }),
          ),
          R(
            { w: 'fill', gap: 8 },
            stepperV('Starts', '0.00', { unit: 's' }),
            stepperV('Length', '0.60', { unit: 's' }),
          ),
        ),
        C(
          { name: 'place', w: 'fill', gap: 8 },
          stepperV('Volume', '0.80'),
          toggleRow('World sound', true, 'Panned and quieter with distance'),
          toggleRow('Draft', false, 'A placeholder until the audio pass'),
          R(
            { w: 'fill', gap: 8 },
            btn('Mute voice', { icon: 'eye-off', w: 'fill' }),
            btn('Delete', { kind: 'danger', icon: 'trash', w: 'fill' }),
          ),
        ),
      ),
      R(
        { name: 'mix header', w: 'fill', h: 68, pad: [16, 8, 0, 16], gap: 10 },
        eyebrow('Mix'),
        pill('2.7 of 4 MB', { color: 'state/ok', mono: true, icon: 'check' }),
        mono('dialogue ducks the rest −9 dB'),
        spacer(),
        btn('Offline render check', { icon: 'check' }),
      ),
      R(
        { w: 'fill', pad: [0, 16, 12, 16], gap: 10 },
        bus('master', 0.55, 'ed/audio'),
        bus('music', 1, 'ed/sequence'),
        bus('effects', 1, 'ed/audio'),
        bus('dialogue', 1, 'layer/entities'),
      ),
    )
    return F(
      { name: 'Audio · bang · iPad portrait', w: 834, h: 1194, fill: 'bg/app', clip: true },
      topP(834, {
        title: 'bang',
        sub: 'cues.toml',
        cs: 'audio/breaker-thump',
        n: 1,
        checks: 'audio check ok',
        gates: [['Q-AUD', 'open']],
      }),
      pick,
      editor,
      sheet,
      tabBar(834, 1130, 'audio'),
      line(0, 51, 834, 1),
    )
  },
})

// ── Feel ──
portraitScreens.push({
  id: 'feel-portrait',
  page: 'Suite · Portrait',
  name: 'Feel · bang · iPad portrait',
  w: 834,
  h: 1194,
  note: 'The event list becomes a picker with the reduce-motion and reduce-flashing preview beside it, the preview and its five channels take the full width, and the picked effect’s fields are a sheet above the tab bar.',
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
      callout,
      inputBox,
    } = P
    const { topP, tabBar, lanes, ruler, stepperV, mono } = Q
    const CC = {
      visual: 'layer/sky',
      audio: 'ed/audio',
      camera: 'layer/city',
      ui: 'layer/tiles',
      haptic: 'layer/entities',
    }
    const pick = R(
      { name: 'event picker', x: 0, y: 52, w: 834, h: 60, pad: [0, 16], gap: 12 },
      F({ w: 240, h: 44 }, inputBox('bang · all five channels', { chevron: true, mono: true, h: 44 })),
      spacer(),
      mono('preview as'),
      seg(['Normal', 'Reduces motion', 'Reduces flashing'], 0, { w: 400 }),
    )
    const W = 802
    const dur = 0.8
    const L = lanes({
      w: W,
      dur,
      y0: 28,
      labelW: 70,
      padR: 10,
      rows: [
        {
          label: 'visual',
          h: 34,
          color: CC.visual,
          items: [
            { k: 'blk', t: 0, t1: 0.066, label: '', sel: true },
            { k: 'mark', t: 0.08, label: 'flash 2 f' },
          ],
        },
        { label: 'audio', h: 34, color: CC.audio, items: [{ k: 'blk', t: 0, t1: 0.6, label: 'noise.bang' }] },
        {
          label: 'camera',
          h: 34,
          color: CC.camera,
          items: [
            { k: 'blk', t: 0, t1: 0.12, label: '' },
            { k: 'mark', t: 0.14, label: 'shake 2 px' },
          ],
        },
        {
          label: 'ui',
          h: 34,
          color: CC.ui,
          items: [
            { k: 'blk', t: 0, t1: 0.12, label: '' },
            { k: 'mark', t: 0.14, label: 'prompt-pulse' },
          ],
        },
        {
          label: 'haptic',
          h: 34,
          color: CC.haptic,
          items: [
            { k: 'blk', t: 0, t1: 0.14, label: '' },
            { k: 'mark', t: 0.16, label: 'rumble 0.8 / 0.4' },
          ],
        },
      ],
    })
    const editor = C(
      { name: 'feel editor', x: 16, y: 116, w: W, h: 'hug', gap: 8 },
      R(
        { w: 'fill', h: 28, gap: 8 },
        T('bang', { style: 'Mono/12', wt: 600 }),
        pill('from noise.bang', { color: 'text/dim', mono: true }),
        T('a 2-frame white flash, a 120 ms micro-shake, a low thump', {
          style: 'Label/12',
          color: 'text/dim',
          w: 'fill',
          trunc: true,
        }),
        pill('coverage ok', { color: 'state/ok', mono: true, icon: 'check' }),
      ),
      F(
        {
          name: 'preview',
          w: 'fill',
          h: 220,
          r: 'radius/lg',
          fill: 'bg/canvas',
          stroke: 'border/default',
          clip: true,
        },
        V(A.bayArt({ ada: [370, 160], lamp: 0.6 }), { name: 'art', x: 0, y: -100, w: 802, h: 451 }),
        F({ name: 'flash', x: 0, y: 0, w: 802, h: 220, fill: alpha('#eadbc9', 0.78) }),
        R(
          { name: 'frame chip', x: 8, y: 8, h: 26, pad: [0, 10], r: 13, fill: alpha('bg/canvas', 0.8) },
          T('frame 1 of 2 · flash 0.8', { style: 'Mono/11', color: 'text/primary' }),
        ),
      ),
      R(
        { name: 'scrub', w: 'fill', h: 48, gap: 8 },
        ib('step-back'),
        ib('play', { on: true }),
        ib('step-fwd'),
        spacer(),
        mono('0.03 / 0.80 s'),
        btn('Audition', { icon: 'speaker', kind: 'primary', h: 48 }),
      ),
      R({ w: 'fill', h: 28, gap: 8 }, eyebrow('Channels'), mono('what each channel does, and when')),
      F(
        {
          name: 'channels',
          w: 'fill',
          h: 200,
          r: 'radius/md',
          fill: 'bg/surface',
          stroke: 'border/default',
          clip: true,
        },
        ...ruler({ w: W, dur, step: 0.1, minor: 0.05, y: 4, labelW: 70, padR: 10 }),
        ...L.kids,
      ),
    )
    const sheet = region(
      'effect sheet',
      0,
      692,
      834,
      438,
      { lay: 'col' },
      F({ name: 'divider', abs: true, x: 0, y: 0, w: 834, h: 1, fill: 'border/default' }),
      F({ name: 'handle', abs: true, x: 399, y: 8, w: 36, h: 4, r: 2, fill: 'border/strong' }),
      R(
        { w: 'fill', h: 60, pad: [12, 8, 0, 16], gap: 10 },
        I('sparkle', { size: 16, color: CC.visual }),
        T('visual · flash', { style: 'Title/15' }),
        pill('literal', { color: 'state/ok', icon: 'check' }),
        spacer(),
        F({ w: 300, h: 44 }, tabs([{ label: 'Effect' }, { label: 'Code' }, { label: 'Ask' }], 0)),
      ),
      R(
        { w: 'fill', pad: [4, 16, 12, 16], gap: 16, ay: 'start' },
        C(
          { name: 'look', w: 'fill', gap: 8 },
          C(
            { w: 'fill', gap: 4 },
            T('Colour', { style: 'Label/12', color: 'text/dim' }),
            R(
              { w: 'fill', gap: 6 },
              ...['#eadbc9', '#9c3327', '#f99b4e', '#000000', '#a6aeba'].map((c, i) =>
                F({
                  name: c,
                  w: 44,
                  h: 44,
                  r: 8,
                  fill: c,
                  stroke: i === 0 ? 'accent/default' : 'border/strong',
                  sw: i === 0 ? 3 : 1,
                }),
              ),
            ),
            T('white · the game’s palette only', { style: 'Mono/11', color: 'text/faint' }),
          ),
          R({ w: 'fill', gap: 8 }, stepperV('Frames', '2'), stepperV('Alpha', '0.80')),
          stepperV('Starts', '0.00', { unit: 's' }),
        ),
        C(
          { name: 'access', w: 'fill', gap: 8 },
          callout(
            'warn',
            'Dropped by reduce flashing',
            'A player who turns it on sees no flash and no flicker. Audio and UI still answer, so the event never goes silent.',
          ),
          R(
            { w: 'fill', gap: 8 },
            btn('Add effect', { icon: 'plus', w: 'fill' }),
            btn('Delete', { kind: 'danger', icon: 'trash', w: 'fill' }),
          ),
          R(
            { w: 'fill', h: 44, gap: 8 },
            pill('feel coverage ok', { color: 'state/ok', mono: true, icon: 'check' }),
            spacer(),
            btn('Run coverage', { icon: 'check' }),
          ),
        ),
      ),
    )
    return F(
      { name: 'Feel · bang · iPad portrait', w: 834, h: 1194, fill: 'bg/app', clip: true },
      topP(834, {
        title: 'bang',
        sub: 'effects.toml',
        cs: 'feel/breaker-shake',
        n: 1,
        checks: 'feel check ok',
        gates: [['Q-FEEL', 'open']],
      }),
      pick,
      editor,
      sheet,
      tabBar(834, 1130, 'feel'),
      line(0, 51, 834, 1),
    )
  },
})

// ── Studio ──
portraitScreens.push({
  id: 'studio-portrait',
  page: 'Suite · Portrait',
  name: 'Studio · Look · iPad portrait',
  w: 834,
  h: 1194,
  note: 'The same stage at full width with outfits down its right edge, the picked part’s fields as a bottom sheet, the character as a chip at the top left and the pipeline as a bar above the tab bar.',
  build: (_S, _P, Q, A) => Q.studioPortrait(A),
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
          T('edit/arrival-timing', { style: 'Mono/12' }),
          I('chevron-down', { size: 14, color: 'text/dim' }),
        ),
        pill('draft PR', { color: 'text/dim', icon: 'branch', mono: true }),
        spacer(),
        mono('4 open · 2 gates waiting'),
      ),
      card(
        'what changed',
        130,
        R(
          { w: 'fill', h: 20, gap: 8 },
          eyebrow('What changed'),
          spacer(),
          mono('tuning.toml · 1 of 2 files'),
        ),
        diff(
          [
            [' ', 11, '# m · P1: a lit lighter draws him from this far …'],
            ['-', 12, 'LIGHTER_REACH = { value = 6, min = 2, max = 12 }'],
            ['+', 12, 'LIGHTER_REACH = { value = 5, min = 2, max = 12 }'],
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
          ['direction audit', 'ok', 'shots C and D meet at 16.4 s'],
          ['systems validate', 'ok', 'LIGHTER_REACH 5 inside 2 to 12'],
          ['systems fairness', 'ok', 'first threat 24.1 s'],
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
          name: 'gates C-G1 and S-G2',
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
          T('C-G1 · S-G2', { style: 'Mono/12', wt: 600 }),
          T('cutscenes · tunables', { style: 'Label/12', color: 'text/dim' }),
          spacer(),
          T('open', { style: 'Mono/11', color: 'accent/default' }),
        ),
        T(
          'Reopened by cutscenes.toml (shot C to 16.4 s) and tuning.toml (LIGHTER_REACH 6 → 5). Read the fairness above, then approve each.',
          {
            style: 'Label/12',
            color: 'text/dim',
            w: 'fill',
            lh: 16,
          },
        ),
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
        sub: 'The Last Light',
        cs: 'edit/arrival-timing',
        n: 2,
        checks: 'checks ok',
        gates: [['C-G1 · S-G2', 'open']],
        primary: false,
      }),
      body,
      actions,
      tabBar(834, 1130, 'review'),
      line(0, 51, 834, 1),
    )
  },
})
