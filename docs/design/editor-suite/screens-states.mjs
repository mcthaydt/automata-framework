// States: what the suite shows when something is off or not there yet (audit M6), like the level editors' States page.
// Each frame is a sheet of the panels at their real size, labelled, so a state can be read without a whole screen.
// The Code pane, a failing check and checks running; the game bridge down, Ask refusing, Ask at its cap, an empty editor.

export const statesScreens = []

statesScreens.push({
  id: 'states-code-checks',
  page: 'Suite · States',
  name: 'States · Code pane and checks',
  w: 1194,
  h: 834,
  note: 'The Code tab every inspector has: the source of the open file, read-only, with the changed line marked; literals change in the field tab and anything else through Ask. Beside it, a check failing in the top bar and the dock, and checks still running.',
  build: (_S, P, Q, _A) => {
    const { F, R, C, T, I, alpha, spacer, eyebrow, pill, btn, tabs, callout, diagRow } = P
    const { D, csPill, gatePill, mono, meter } = Q
    const card = (label, sub, x, y, w, h, ...kids) =>
      C(
        { name: `state/${label}`, x, y, w, h, gap: 10 },
        R({ w: 'fill', h: 20, gap: 8 }, eyebrow(label), mono(sub, { color: 'text/faint' })),
        F(
          {
            name: 'panel',
            w: 'fill',
            h: 'fill',
            r: 'radius/lg',
            fill: 'bg/surface',
            stroke: 'border/default',
            clip: true,
            lay: 'col',
          },
          ...kids,
        ),
      )
    const rows = D.tunables.rows.filter((r) => /_REACH$|EMBER_WARM/.test(r.n))
    const src = ['[warmth]']
    for (const r of rows) {
      src.push(`# ${r.u} · ${r.note}`)
      src.push(`${r.n} = { value = ${r.n === 'LIGHTER_REACH' ? 5 : r.v}, min = ${r.min}, max = ${r.max} }`)
    }
    const code = C(
      { name: 'source', w: 'fill', h: 'fill', pad: [8, 0], gap: 0, clip: true, fill: 'bg/canvas' },
      src.map((l, i) => {
        const changed = l.startsWith('LIGHTER_REACH')
        return R(
          {
            w: 'fill',
            h: 22,
            gap: 10,
            pad: [0, 10, 0, 0],
            fill: changed ? alpha('accent/default', 0.12) : null,
          },
          F({ w: 3, h: 22, fill: changed ? 'accent/default' : null }),
          T(String(i + 9), { style: 'Mono/11', color: 'text/faint', w: 22, align: 'right' }),
          T(l, {
            style: 'Mono/11',
            color: l.startsWith('#') ? 'text/faint' : l.startsWith('[') ? 'ed/tuner' : 'text/primary',
            w: 'fill',
            trunc: true,
          }),
        )
      }),
    )
    const codePane = card(
      'Code pane',
      'every inspector’s Code tab',
      24,
      72,
      340,
      738,
      tabs([{ label: 'Tunable' }, { label: 'Code' }, { label: 'Ask' }], 1),
      F({ w: 'fill', h: 1, fill: 'border/default' }),
      R(
        { w: 'fill', h: 40, pad: [0, 12], gap: 8 },
        I('code', { size: 14, color: 'text/dim' }),
        T(D.paths.tuning, { style: 'Mono/11', color: 'text/dim', w: 'fill', trunc: true }),
        pill('read-only', { color: 'text/faint', mono: true, h: 22, pad: 8 }),
      ),
      code,
      C(
        { w: 'fill', pad: 12, gap: 8 },
        T('Literals change in the Tunable tab. Anything else in this file goes through Ask.', {
          style: 'Label/12',
          color: 'text/dim',
          w: 'fill',
          lh: 17,
        }),
        btn('Ask about line 11', { icon: 'sparkles', w: 'fill' }),
      ),
    )
    const failing = card(
      'A check fails',
      'top bar and checks dock',
      388,
      72,
      782,
      318,
      R(
        { w: 'fill', h: 52, pad: [0, 12], gap: 8, fill: 'bg/raised' },
        csPill('edit/arrival-timing', 3),
        P.checksPill('1 check failed', 'state/bad'),
        gatePill('S-G2', 'open'),
        spacer(),
        btn('Ship', { kind: 'primary', h: 48, icon: 'external' }),
      ),
      F({ w: 'fill', h: 1, fill: 'border/default' }),
      C(
        { w: 'fill', pad: 12, gap: 10 },
        R(
          { w: 'fill', h: 28, gap: 8 },
          eyebrow('Checks'),
          pill('3 passed', { color: 'state/ok', mono: true, h: 22, pad: 8, icon: 'check' }),
          pill('1 failed', { color: 'state/bad', mono: true, h: 22, pad: 8, icon: 'warn' }),
          spacer(),
          btn('Run again', { icon: 'rotate' }),
        ),
        diagRow(
          {
            sev: 'error',
            code: 'fairness.first-threat',
            msg: 'With TORCH_REACH at 12, the Porter reaches the minimal kit at 18.2 s; the limit is 20 s.',
            path: 'systems_fairness · firstThreat · minimal kit',
          },
          { sel: true },
        ),
        R(
          { w: 'fill', gap: 8 },
          btn('Open TORCH_REACH in the Tuner', { icon: 'slider', w: 'fill' }),
          btn('Ask for a fix', { icon: 'sparkles', w: 'fill' }),
        ),
        T(
          'Ship still opens the draft PR, with the failure listed in it. Mark ready waits until checks pass.',
          {
            style: 'Label/12',
            color: 'text/faint',
            w: 'fill',
          },
        ),
      ),
    )
    const running = card(
      'Checks running',
      'after an edit',
      388,
      414,
      782,
      396,
      C(
        { w: 'fill', pad: 12, gap: 6 },
        R(
          { w: 'fill', h: 28, gap: 8 },
          eyebrow('Checks'),
          pill('2 of 5 done', { color: 'text/dim', mono: true, h: 22, pad: 8, icon: 'clock' }),
          spacer(),
          mono('started 14 s ago'),
        ),
        meter(758, 0.4, { h: 6 }),
        ...[
          ['cutscene audit', 'ok', 'every line plays'],
          ['direction audit', 'ok', 'shots C and D meet at 16.4 s'],
          ['systems validate', 'run', 'running'],
          ['systems fairness', 'wait', 'waits for validate'],
          ['playthrough · bay', 'wait', 'waits for validate'],
        ].map(([n, st, d]) =>
          R(
            { w: 'fill', h: 36, gap: 10 },
            st === 'ok'
              ? I('check', { size: 16, color: 'state/ok' })
              : I('clock', { size: 16, color: st === 'run' ? 'accent/default' : 'text/faint' }),
            T(n, { style: 'Body/13', w: 180, color: st === 'wait' ? 'text/dim' : 'text/primary' }),
            T(d, { style: 'Mono/11', color: 'text/dim', w: 'fill', trunc: true }),
          ),
        ),
        callout('info', 'You can keep editing', 'A new edit restarts the checks it touches.'),
      ),
    )
    return F(
      { name: 'States · Code pane and checks', w: 1194, h: 834, fill: 'bg/app', clip: true },
      R(
        { name: 'title', x: 24, y: 20, w: 1146, h: 32, gap: 12 },
        T('States', { style: 'Title/15' }),
        mono('the panels as they show when something is off or still running'),
      ),
      codePane,
      failing,
      running,
    )
  },
})

statesScreens.push({
  id: 'states-offline',
  page: 'Suite · States',
  name: 'States · Bridge down, Ask, empty',
  w: 1194,
  h: 834,
  note: 'When the game is not connected, edits still save and the preview says so. Ask can refuse (here, a change behind an approved gate) or reach the change set’s token cap, which only the owner raises. An editor with nothing in it yet starts from a template or from Ask, never a blank canvas.',
  build: (_S, P, Q, A) => {
    const { F, R, C, T, I, V, alpha, spacer, eyebrow, pill, btn, callout } = P
    const { mono, meter, askBtn, chip } = Q
    const card = (label, sub, x, y, w, h, ...kids) =>
      C(
        { name: `state/${label}`, x, y, w, h, gap: 10 },
        R({ w: 'fill', h: 20, gap: 8 }, eyebrow(label), mono(sub, { color: 'text/faint' })),
        F(
          {
            name: 'panel',
            w: 'fill',
            h: 'fill',
            r: 'radius/lg',
            fill: 'bg/surface',
            stroke: 'border/default',
            clip: true,
          },
          ...kids,
        ),
      )
    const bridge = card(
      'The game is not connected',
      'any preview or Play',
      24,
      72,
      560,
      350,
      V(A.bayArt({ lamp: 0.55, dim: 0.5 }), { name: 'art', x: 0, y: 0, w: 560, h: 320 }),
      F({ name: 'scrim', x: 0, y: 0, w: 560, h: 320, fill: alpha('bg/canvas', 0.7) }),
      C(
        {
          name: 'banner',
          x: 70,
          y: 70,
          w: 420,
          pad: 16,
          gap: 8,
          r: 'radius/lg',
          fill: 'bg/surface',
          stroke: alpha('state/warn', 0.6),
        },
        R(
          { gap: 8 },
          I('warn', { size: 18, color: 'state/warn' }),
          T('The game is not connected', { style: 'Title/15' }),
        ),
        T('Edits still save to the files. Preview and Play come back when it reconnects.', {
          style: 'Label/12',
          color: 'text/dim',
          w: 'fill',
          lh: 17,
        }),
        R(
          { w: 'fill', gap: 8 },
          mono('retrying in 5 s'),
          spacer(),
          btn('Reconnect', { kind: 'primary', h: 48, icon: 'rotate' }),
        ),
      ),
    )
    const bubble = (who, text, o = {}) =>
      C(
        {
          w: 'fill',
          pad: 12,
          gap: 4,
          r: 'radius/md',
          fill: o.me ? 'bg/raised' : alpha('ed/feel', 0.08),
          stroke: o.me ? 'border/default' : alpha('ed/feel', 0.4),
        },
        T(who, { style: 'Mono/11', color: o.me ? 'text/dim' : 'ed/feel' }),
        T(text, { style: 'Body/13', w: 'fill', lh: 19 }),
      )
    const refused = card(
      'Ask says no',
      'and says why',
      610,
      72,
      560,
      350,
      C(
        { x: 0, y: 0, w: 560, h: 320, pad: 16, gap: 10 },
        bubble('you', 'Let the Porter see Ada when she holds the lighter up.', { me: true }),
        bubble(
          'Ask',
          'I won’t: he is blind by design (P4), and his senses in agents.toml sit under P-G1, which the owner approved. A sound would reach him the same way. Shall I try that?',
        ),
        R(
          { w: 'fill', gap: 8 },
          btn('Try a sound instead', { icon: 'sparkles', w: 'fill' }),
          btn('Ask the owner', { icon: 'gate', w: 'fill' }),
        ),
      ),
    )
    const cap = card(
      'Ask reached its cap',
      'per change set',
      24,
      446,
      560,
      364,
      C(
        { x: 0, y: 0, w: 560, h: 334, pad: 16, gap: 12 },
        R({ w: 'fill', h: 28, gap: 8 }, T('Ask', { style: 'Body/13', w: 'fill' }), mono('60k of 60k tokens')),
        meter(528, 1, { h: 8, color: 'state/warn' }),
        callout(
          'warn',
          'Ask is paused for this change set',
          'The cap is the owner’s to raise. Everything you edit by hand still works, and checks still run.',
        ),
        R(
          { w: 'fill', gap: 8 },
          askBtn({ tokens: 'paused' }),
          spacer(),
          btn('Ask the owner to raise it', { icon: 'gate' }),
        ),
      ),
    )
    const empty = card(
      'An editor with nothing in it',
      'Schematic, a new scene',
      610,
      446,
      560,
      364,
      C(
        { x: 0, y: 0, w: 560, h: 334, pad: [28, 40], gap: 12, ax: 'center' },
        R(
          { w: 64, h: 64, r: 32, ax: 'center', ay: 'center', fill: alpha('ed/schematic', 0.14) },
          I('nav', { size: 28, color: 'ed/schematic' }),
        ),
        T('No puzzle in this scene yet', { style: 'Title/15', align: 'center', w: 'fill' }),
        T('A puzzle is locks and the keys that open them. Start from a shape, or describe it.', {
          style: 'Label/12',
          color: 'text/dim',
          align: 'center',
          w: 'fill',
          lh: 17,
        }),
        R(
          { gap: 8, ax: 'center', w: 'fill' },
          chip('one lock, two keys', { color: 'ed/schematic' }),
          chip('a chain of three', { color: 'ed/schematic' }),
          chip('a timed door', { color: 'ed/schematic' }),
        ),
        R(
          { gap: 8, ax: 'center', w: 'fill' },
          btn('Start from a shape', { kind: 'primary', h: 48, icon: 'plus' }),
          askBtn(),
        ),
      ),
    )
    return F(
      { name: 'States · Bridge down, Ask, empty', w: 1194, h: 834, fill: 'bg/app', clip: true },
      R(
        { name: 'title', x: 24, y: 20, w: 1146, h: 32, gap: 12 },
        T('States', { style: 'Title/15' }),
        mono('when the game, Ask or the content is not there'),
      ),
      bridge,
      refused,
      cap,
      empty,
    )
  },
})
