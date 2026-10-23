// Schematic: The Last Light's puzzle and systems view (editor/src/client/schematic.ts, schematic-model.ts): the puzzle as a graph of
// actions, the systemic rules behind it, the solver and the claims it checks. It edits the scene's puzzle.toml and
// agents.toml; the gates come from the game's editor list (P-G1 for the puzzle, S-G1 and S-G3 for the agents).

export const schematicScreens = []

// ── Chain: the shutter's dependency graph ──
schematicScreens.push({
  id: 'schematic-chain',
  page: 'Suite · Schematic',
  name: 'Schematic · The shutter · iPad landscape',
  w: 1194,
  h: 834,
  note: 'The Bay’s puzzle read from the game’s own files: what must be true before the shutter opens, drawn from the goal back to what the player starts with. Every lock has at least two ways through it. A value that is a plain literal edits in place; a computed one goes through Ask. The solver runs each entry kit along the bottom.',
  build: (_S, P, Q, _A) => {
    const { F, R, C, T, I, alpha, spacer, region, line, eyebrow, pill, btn, ib, tabs, panelHead, dot } = P
    const { D, top, rail, listRow, gnode, edges, edgeLabel, stepperV, selectV } = Q
    const locks = [
      ['Flame', 'lighter · matches · rag torch', 3],
      ['Drum fuel', 'spirit · petrol · lighter fluid', 3],
      ['The Porter’s keys', 'warmth · latch him in', 2],
      ['Safe cranking', 'he warms · latched in', 2],
    ]
    const panel = region(
      'locks panel',
      56,
      52,
      264,
      602,
      { lay: 'col' },
      panelHead('Locks', ib('more')),
      C(
        { w: 'fill', pad: [0, 8], gap: 0 },
        locks.map((l, i) =>
          listRow({
            title: l[0],
            sub: l[1],
            icon: 'lock',
            h: 56,
            sel: i === 2,
            color: Q.ED.schematic.color,
            right: pill(`${l[2]} keys`, { color: 'state/ok', mono: true, h: 20, pad: 7 }),
          }),
        ),
      ),
      R({ w: 'fill', h: 12 }),
      C(
        { w: 'fill', pad: [0, 16], gap: 6 },
        eyebrow('Entry kits'),
        ...['minimal', 'typical', 'maximal'].map((k, i) =>
          R(
            { w: 'fill', h: 32, gap: 8 },
            I('check', { size: 14, color: 'state/ok' }),
            T(k, { style: 'Mono/12', w: 'fill' }),
            T(['lighter', '4 items', '8 items'][i], { style: 'Mono/11', color: 'text/faint' }),
          ),
        ),
        T('The Porter’s keys has the two ways the design asks for.', {
          style: 'Label/12',
          color: 'text/faint',
          w: 'fill',
          lh: 16,
        }),
      ),
    )
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
    const canvas = region(
      'chain',
      320,
      52,
      554,
      602,
      { fill: 'bg/canvas' },
      E,
      ...nodes,
      R(
        { name: 'legend', x: 8, y: 575, h: 24, gap: 10 },
        R({ gap: 5 }, dot('layer/sky', 8), T('action', { style: 'Mono/11', color: 'text/dim' })),
        R({ gap: 5 }, dot('phase/teach', 8), T('systemic', { style: 'Mono/11', color: 'text/dim' })),
        R({ gap: 5 }, dot('state/ok', 8), T('goal', { style: 'Mono/11', color: 'text/dim' })),
      ),
      edgeLabel(228, 396, 'safe while he warms (P2)', { color: 'phase/teach' }),
      R(
        {
          name: 'tools',
          x: 440,
          y: 560,
          pad: 4,
          gap: 2,
          r: 'radius/lg',
          fill: 'bg/surface',
          stroke: 'border/default',
        },
        ib('minus', { s: 36, size: 16 }),
        T('90%', { style: 'Mono/11', w: 34, align: 'center' }),
        ib('plus', { s: 36, size: 16 }),
      ),
    )
    const field = (k, v, o = {}) =>
      R(
        { w: 'fill', h: 40, gap: 8, pad: [0, 8], r: 'radius/md', fill: 'bg/field', stroke: 'border/default' },
        T(k, { style: 'Label/12', color: 'text/dim', w: 40 }),
        T(v, { style: 'Mono/12', w: 'fill', trunc: true, color: o.color }),
        o.lock
          ? I('lock', { size: 14, color: 'text/faint' })
          : I('chevron-right', { size: 14, color: 'text/faint' }),
      )
    const inspector = region(
      'inspector',
      874,
      52,
      320,
      602,
      { lay: 'col' },
      tabs([{ label: 'Action' }, { label: 'Code' }, { label: 'Ask' }], 0),
      F({ w: 'fill', h: 1, fill: 'border/default' }),
      C(
        { name: 'fields', w: 'fill', h: 'fill', pad: 12, gap: 6, clip: true },
        R(
          { w: 'fill', h: 28, gap: 8 },
          F({ w: 14, h: 14, r: 4, fill: alpha('layer/sky', 0.85) }),
          T('shutter.unlock', { style: 'Mono/12', wt: 600 }),
          spacer(),
          pill('literal', { color: 'state/ok', icon: 'check' }),
        ),
        R(
          { w: 'fill', gap: 8 },
          selectV('At', 'shutter', { mono: true }),
          selectV('Uses', 'keys', { mono: true }),
        ),
        eyebrow('When'),
        field('fact', 'padlock is true'),
        eyebrow('Then'),
        field('set', 'padlock → false'),
        field('take', 'keys'),
        field('set', 'keysAt → padlock'),
        field('do', 'checkpoint', { lock: true }),
        R(
          { w: 'fill', gap: 8 },
          selectV('Says', 'padlockOff', { mono: true }),
          stepperV('Seconds', '3', { unit: 's' }),
        ),
        R({ w: 'fill', h: 2 }),
        btn('Open the line in Writer', { icon: 'chat', w: 'fill' }),
      ),
    )
    const kit = (name, steps, ok, route) =>
      C(
        {
          name: `solve/${name}`,
          w: 'fill',
          h: 'fill',
          pad: 12,
          gap: 4,
          r: 'radius/md',
          fill: 'bg/raised',
          stroke: ok ? alpha('state/ok', 0.4) : alpha('state/bad', 0.6),
        },
        R(
          { w: 'fill', gap: 6 },
          I(ok ? 'check' : 'warn', { size: 14, color: ok ? 'state/ok' : 'state/bad' }),
          T(name, { style: 'Mono/12', wt: 600 }),
          spacer(),
          T(`${steps} actions`, { style: 'Mono/11', color: 'text/dim' }),
        ),
        T(route, { style: 'Mono/11', color: 'text/faint', w: 'fill', lh: 15 }),
      )
    const dock = region(
      'solver',
      56,
      654,
      1138,
      180,
      { lay: 'col' },
      line(0, 0, 1138, 1),
      R(
        { name: 'solver header', w: 'fill', h: 52, pad: [0, 8, 0, 16], gap: 10 },
        R(
          { gap: 16 },
          ...['Solver', 'Claims', 'Checks'].map((t, i) =>
            T(t, { style: 'Body/13 Medium', color: i === 0 ? 'text/primary' : 'text/dim' }),
          ),
        ),
        pill('3 of 3 solved', { color: 'state/ok', mono: true, icon: 'check' }),
        pill('5 claims hold', { color: 'state/ok', mono: true, icon: 'check' }),
        spacer(),
        btn('Run solver', { icon: 'play', kind: 'primary', h: 44 }),
      ),
      R(
        { w: 'fill', h: 'fill', pad: [0, 16, 12, 16], gap: 10 },
        kit(
          'minimal',
          14,
          true,
          'ambulance.search · drum.fuel · drum.light · keyHook.take · shutter.unlock · crank ×3',
        ),
        kit(
          'typical',
          12,
          true,
          'mortuarySink.fill · drum.douse · drum.light · keyHook.take · shutter.unlock · crank ×3',
        ),
        kit('maximal', 11, true, 'combine.torch · floor.lighter · keyHook.take · shutter.unlock · crank ×3'),
      ),
    )
    return F(
      { name: 'Schematic · The shutter · iPad landscape', w: 1194, h: 834, fill: 'bg/app', clip: true },
      top(1194, {
        title: 'The Bay',
        sub: D.paths.puzzle,
        ed: 'schematic',
        cs: 'puzzle/keys-two-ways',
        n: 1,
        checks: 'checks ok',
        reopened: true,
      }),
      rail(782, 'schematic'),
      panel,
      canvas,
      inspector,
      dock,
      line(0, 51, 1194, 1),
      line(55, 52, 1, 782),
      line(319, 52, 1, 602),
      line(873, 52, 1, 602),
    )
  },
})

// ── Agent: the Porter as a state machine ──
schematicScreens.push({
  id: 'schematic-agent',
  page: 'Suite · Schematic',
  name: 'Schematic · The Porter · iPad landscape',
  w: 1194,
  h: 834,
  note: 'The same view for the systems side: the Porter as an agent with eight modes, from agents.toml. Each arrow is a transition with a priority and the senses that fire it; the transitions out of drawn are the file’s (catch 90, re-route 60, arrive 40). Radii, speeds and timers are tunables and open in the Tuner.',
  build: (_S, P, Q, _A) => {
    const { F, R, C, T, I, spacer, region, line, eyebrow, pill, ib, tabs, panelHead, callout } = P
    const { D, top, rail, listRow, gnode, edges, edgeLabel, kvRow } = Q
    const panel = region(
      'agents panel',
      56,
      52,
      264,
      782,
      { lay: 'col' },
      panelHead('Systems', ib('more')),
      C(
        { w: 'fill', pad: [0, 8], gap: 0 },
        listRow({
          title: 'The Porter',
          sub: '8 modes',
          icon: 'person',
          h: 56,
          sel: true,
          color: Q.ED.schematic.color,
        }),
        listRow({ title: 'The ambulance crew', sub: 'a third pursuer on the yard', icon: 'users', h: 56 }),
        listRow({ title: 'World rules', sub: 'warmth, sound, touch', icon: 'bolt', h: 56 }),
        listRow({ title: 'Scenarios', sub: 'verify the systemic claims', icon: 'play', h: 56 }),
        listRow({ title: 'Fairness', sub: 'thresholds', icon: 'chart', h: 56 }),
      ),
      R({ w: 'fill', h: 12 }),
      C(
        { w: 'fill', pad: [0, 16], gap: 6 },
        eyebrow('Senses'),
        kvRow('warmth', 'lighter 6 · torch 8 · drum 12', { kw: 56, h: 24 }),
        kvRow('sound', 'any reach', { kw: 56, h: 24 }),
        kvRow('touch', 'radius 0.65 m', { kw: 56, h: 24 }),
        kvRow('sight', 'none: he is blind (P4)', { kw: 56, h: 24 }),
      ),
    )
    const M = (title, sub, x, y, o = {}) =>
      gnode(x, y, 150, 64, { title, sub, color: o.color || 'phase/teach', sel: o.sel, icon: o.icon })
    const nodes = [
      M('signing', 'at the ledger · 17 s', 20, 60, { icon: 'pencil' }),
      M('routine', 'his round · 1.0 m/s', 20, 200, { icon: 'walk' }),
      M('stirring', 'sniffs and turns · 2.5 s', 20, 340, { icon: 'drop' }),
      M('investigate', 'a noise · 1.6 m/s', 215, 40, { icon: 'speaker' }),
      M('drawn', 'to a warmth · 1.5 m/s', 215, 160, { icon: 'bolt', sel: true, color: 'accent/default' }),
      M('warming', 'at a flame · 4 s', 215, 290, { icon: 'lamp' }),
      M('searching', 'keys gone · 1.3 m/s', 400, 200, { icon: 'search' }),
      M('latched', 'out of play (P9)', 400, 340, { icon: 'lock', color: 'text/faint' }),
    ]
    const E = edges(0, 0, 554, 602, [
      { a: [95, 124], b: [95, 200], c: 'edge/default', v: true },
      { a: [95, 264], b: [95, 340], c: 'edge/default', v: true },
      { a: [170, 372], b: [215, 192], c: 'accent/default', o: 1, w: 2 },
      { a: [290, 224], b: [290, 290], c: 'accent/default', o: 1, w: 2, v: true },
      { a: [215, 322], b: [170, 232], c: 'edge/default', dash: true },
      { a: [170, 232], b: [215, 72], c: 'edge/default' },
      { a: [170, 232], b: [400, 232], c: 'edge/default', straight: true },
      { a: [365, 322], b: [400, 372], c: 'state/bad', dash: true },
    ])
    const canvas = region(
      'agent graph',
      320,
      52,
      554,
      782,
      { fill: 'bg/canvas' },
      E,
      ...nodes,
      edgeLabel(24, 148, 'signed in', { color: 'text/dim' }),
      edgeLabel(24, 288, 'feels a warmth', { color: 'text/dim' }),
      edgeLabel(266, 255, 'arrived', { color: 'accent/default' }),
      edgeLabel(232, 236, 'keys gone', { color: 'text/dim' }),
      edgeLabel(372, 296, 'door latched', { color: 'state/bad' }),
      R(
        {
          name: 'priority legend',
          x: 8,
          y: 520,
          w: 538,
          pad: 12,
          gap: 10,
          r: 'radius/md',
          fill: 'bg/surface',
          stroke: 'border/default',
          ay: 'start',
        },
        I('info', { size: 16, color: 'layer/sky' }),
        T(
          'Shows the main flow and the transitions out of the selected mode; the list on the right has all of them, highest priority first. Each speed, radius and time is a tunable.',
          { style: 'Label/12', color: 'text/dim', w: 'fill', lh: 16 },
        ),
      ),
    )
    const inspector = region(
      'inspector',
      874,
      52,
      320,
      782,
      { lay: 'col' },
      tabs([{ label: 'Mode' }, { label: 'Code' }, { label: 'Ask' }], 0),
      F({ w: 'fill', h: 1, fill: 'border/default' }),
      C(
        { name: 'fields', w: 'fill', h: 'fill', pad: 12, gap: 8, clip: true },
        R(
          { w: 'fill', h: 28, gap: 8 },
          F({ w: 14, h: 14, r: 4, fill: 'accent/default' }),
          T('drawn', { style: 'Mono/12', wt: 600 }),
          spacer(),
          pill('mode', { color: 'text/dim', mono: true }),
        ),
        T('Warmth draws him: he goes to it.', { style: 'Label/12', color: 'text/dim', w: 'fill' }),
        R(
          {
            w: 'fill',
            h: 56,
            pad: [0, 12],
            gap: 10,
            r: 'radius/md',
            fill: 'bg/field',
            stroke: 'border/default',
          },
          I('slider', { size: 18, color: Q.ED.tuner.color }),
          C(
            { w: 'fill', gap: 0 },
            T('speed · DRAWN_SPEED', { style: 'Mono/12' }),
            T('1.5 m/s, between 0.5 and 2.5', { style: 'Label/12', color: 'text/dim' }),
          ),
          T('Tuner', { style: 'Label/12', color: 'accent/default' }),
          I('chevron-right', { size: 14, color: 'text/dim' }),
        ),
        eyebrow('Transitions out'),
        C(
          { w: 'fill', gap: 4 },
          [
            ['drawn → drawn', 'touching Ada: caught (P5)', '90'],
            ['drawn → drawn', 're-routes to a moving warmth', '60'],
            ['drawn → warming', 'arrived at the warmth (P1)', '40'],
          ].map(([k, w, pr]) =>
            R(
              {
                w: 'fill',
                h: 52,
                pad: [0, 8, 0, 12],
                gap: 8,
                r: 'radius/md',
                fill: 'bg/field',
                stroke: 'border/default',
              },
              C(
                { w: 'fill', gap: 0 },
                T(k, { style: 'Mono/12' }),
                T(w, { style: 'Label/12', color: 'text/dim' }),
              ),
              T(pr, { style: 'Mono/12', color: 'accent/default' }),
              I('chevron-right', { size: 14, color: 'text/faint' }),
            ),
          ),
        ),
        callout(
          'info',
          'Noise does not reach him here (P2)',
          'Drawn or warming, he ignores sound. Add a mode or a sense through Ask; priorities, radii and times edit here.',
        ),
      ),
    )
    return F(
      { name: 'Schematic · The Porter · iPad landscape', w: 1194, h: 834, fill: 'bg/app', clip: true },
      top(1194, {
        title: 'The Porter',
        sub: D.paths.agents,
        ed: 'schematic',
        cs: 'puzzle/keys-two-ways',
        n: 1,
        checks: 'checks ok',
      }),
      rail(782, 'schematic'),
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
