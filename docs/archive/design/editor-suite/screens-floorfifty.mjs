// The second game: FloorFifty mounts the same Tuner over its own `content/tuning.toml`. The layout is the Tuner the Owner
// approved; only the game, the file and the data change. FloorFifty declares its ranges in code
// (packages/shared/src/common/tuning.ts, the content spec's code-owned form), lists no gates, and checks its content
// with `pnpm content:check`. Values are the file's at SNEKPRTY/FloorFifty ee5d44e; the change and its results are
// illustrative.

export const floorFiftyScreens = []

floorFiftyScreens.push({
  id: 'ff-tuner',
  page: 'Suite · FloorFifty',
  name: 'Tuner · FloorFifty Movement · iPad landscape',
  w: 1194,
  h: 834,
  note: 'The same Tuner on a second game. FloorFifty’s tuning.toml names each tunable once with a bare number and keeps the ranges in code, so min and max are read-only here. Its editor list names no gates, so the bar says so; a base tuning change moves every revision, which the inspector says before you ship. The bottom shows the climb’s one rule: the bounce apex against the floor gap.',
  build: (_S, P, Q, _A) => {
    const { F, R, C, T, I, alpha, spacer, region, line, eyebrow, pill, btn, ib, tabs, panelHead, callout } = P
    const { D, top, rail, listRow, search, sliderRow, stepperV, kvRow, mono, select } = Q
    const rows = D.ff.tuning
    const by = (n) => rows.find((r) => r.n === n)
    const list = [
      { ...by('BOUNCE_VELOCITY'), v: 272 },
      by('GRAVITY'),
      by('MAX_MOVE_SPEED'),
      by('FAST_FALL_VELOCITY'),
      by('PLAYER_WIDTH'),
      by('PLAYER_HEIGHT'),
    ]
    const flags = { BOUNCE_VELOCITY: { sel: true, changed: true, was: 268.2 } }
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
        D.ff.groups.map(([name, icon, n], i) =>
          listRow({
            title: name,
            icon,
            sel: i === 0,
            color: Q.ED.tuner.color,
            h: 48,
            right: R(
              { gap: 6 },
              i === 0 ? pill('1 changed', { color: 'accent/default', h: 20, pad: 7, mono: true }) : null,
              T(String(n), { style: 'Mono/11', color: 'text/faint' }),
            ),
          }),
        ),
        R({ w: 'fill', h: 8 }),
        R(
          { w: 'fill', pad: [4, 8] },
          T(
            'Each slider stays inside the range FloorFifty declares in code. Modes override a few names; the slider shows the base value.',
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
        eyebrow('Movement'),
        mono('6 tunables'),
        spacer(),
        T('Showing the file value as a tick', { style: 'Label/12', color: 'text/faint' }),
      ),
      list.map((t) => sliderRow(t, { w: 530, ...(flags[t.n] || {}) })),
    )
    const t = by('BOUNCE_VELOCITY')
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
          stepperV('Value', '272', { unit: 'u/s', changed: true }),
          stepperV('File value', '268.2', { unit: 'u/s', disabled: true }),
        ),
        R(
          { w: 'fill', gap: 8 },
          stepperV('Min', '100', { unit: 'u/s', disabled: true, mark: 'code' }),
          stepperV('Max', '1200', { unit: 'u/s', disabled: true, mark: 'code' }),
        ),
        C(
          { name: 'layers', w: 'fill', gap: 2, pad: [8, 0, 0, 0] },
          eyebrow('Layers'),
          kvRow('base', 'content/tuning.toml', { h: 24, kw: 56 }),
          kvRow('modes', 'none override it', { h: 24, kw: 56 }),
          kvRow('stages', 'courseTuning is empty', { h: 24, kw: 56 }),
        ),
        callout(
          'info',
          'No gate · moves every revision',
          'FloorFifty lists no gates. Base physics moves contentRevision, rulesetRevision and every courseRevision, so older replays stop verifying.',
        ),
        R(
          { name: 'footer', w: 'fill', h: 44, gap: 8 },
          btn('Reset to 268.2', { icon: 'rotate', w: 'fill' }),
          btn('Ask…', { icon: 'sparkles', w: 'fill' }),
        ),
      ),
    )
    // The climb's rule, from tuning.ts: apex = BOUNCE_VELOCITY² / (2 × |GRAVITY|) against the floor gap.
    const M = [
      ['Bounce apex', 'v² / 2|g|', '130.78', '134.52', 'ok'],
      ['Floor gap', 'FLOOR_GAP_MIN', '128.57', '128.57', 'ok'],
      ['Margin above each floor', '> 0', '2.21', '5.95', 'warn'],
    ]
    const cell = (text, w, o = {}) =>
      T(text, { style: 'Mono/12', w, color: o.color || 'text/primary', align: o.align })
    const climb = region(
      'climb',
      56,
      606,
      1138,
      228,
      { lay: 'col' },
      line(0, 0, 1138, 1),
      R(
        { name: 'climb header', w: 'fill', h: 52, pad: [0, 8, 0, 16], gap: 8 },
        eyebrow('Climb'),
        pill('content check ok', { color: 'state/ok', mono: true, icon: 'check' }),
        pill('completability not run', { color: 'text/dim', mono: true, icon: 'clock' }),
        spacer(),
        T('Seeds', { style: 'Label/12', color: 'text/dim' }),
        P.inputBox('test seeds', { chevron: true, mono: true, w: 150 }),
        btn('Measure after', { kind: 'primary', h: 44, icon: 'play' }),
      ),
      F(
        { name: 'table', w: 'fill', h: 'fill', pad: [0, 16, 12, 16], lay: 'row', gap: 16 },
        C(
          { w: 'fill', h: 'fill', gap: 0 },
          R(
            { w: 'fill', h: 28, gap: 8 },
            cell('Rule', 230, { color: 'text/faint' }),
            cell('From', 120, { color: 'text/faint' }),
            cell('Before', 90, { color: 'text/faint' }),
            cell('After', 90, { color: 'text/faint' }),
            cell('', 40),
          ),
          M.map((m, i) =>
            R(
              { w: 'fill', h: 38, gap: 8, fill: i % 2 ? alpha('text/primary', 0.02) : null, pad: [0, 4] },
              T(m[0], { style: 'Body/13', w: 230 }),
              cell(m[1], 120, { color: 'text/dim' }),
              cell(m[2], 90, { color: 'text/dim' }),
              cell(m[3], 90, { color: m[4] === 'ok' ? 'text/primary' : 'state/warn' }),
              m[4] === 'ok'
                ? I('check', { size: 16, color: 'state/ok' })
                : I('warn', { size: 16, color: 'state/warn' }),
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
            T('The margin is the game’s feel: 2.21 is a near miss on every bounce. Feel the new one first.', {
              style: 'Label/12',
              color: 'text/dim',
              w: 'fill',
              lh: 16,
            }),
            select('Stage', 'rooftops', { lw: 40, mono: true }),
            btn('Race a bot here', { kind: 'primary', h: 48, icon: 'play', w: 'fill' }),
          ),
        ),
      ),
    )
    return F(
      { name: 'Tuner · FloorFifty Movement · iPad landscape', w: 1194, h: 834, fill: 'bg/app', clip: true },
      top(1194, {
        title: 'FloorFifty',
        sub: 'content/tuning.toml',
        game: 'FloorFifty',
        ed: 'tuner',
        cs: 'tune/bounce',
        n: 1,
        checks: 'checks ok',
        reopened: true,
        primary: 'Ship',
      }),
      rail(782, 'tuner'),
      panel,
      sliders,
      inspector,
      climb,
      line(0, 51, 1194, 1),
      line(55, 52, 1, 782),
      line(319, 52, 1, 554),
      line(873, 52, 1, 554),
    )
  },
})
