// Writer: The Last Light's story desk (editor/src/client/writer.ts): lines, dialogue graphs, beats and hints, with the lint along the bottom.

export const writerScreens = []

// ── Lines: the hero ──
writerScreens.push({
  id: 'writer-lines',
  page: 'Suite · Writer',
  name: 'Writer · Lines · iPad landscape',
  w: 1194,
  h: 834,
  note: 'Every line of the scene on the left, the selected line as text you edit in place with a preview of how it plays, its beat, hints and facts on the right, and the narrative lint along the bottom. A line the screenplay fixture pins shows a lock, and the editor refuses to change its wording.',
  build: (_S, P, Q, A) => {
    const { F, R, C, T, I, V, alpha, spacer, region, line, eyebrow, pill, btn, tabs, dot } = P
    const { top, rail, search, chip, textArea, select, mono } = Q
    const lines = [
      [
        'arrival.1',
        'Ada',
        'The door locks behind me. It is colder out here than the night was.',
        { lock: true },
      ],
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
      ['routine.3', 'The Porter', 'Keys on the hook while I sign in. Always the hook, then the pen.', {}],
      [
        'routine.5',
        'The Porter',
        'Three keys on my ring. The desk, the drawers, the padlock on the shutter.',
        {},
      ],
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
    const writerTabs = (active) =>
      R(
        { name: 'tabs', w: 'fill', h: 44 },
        ['Lines', 'Dialogues', 'Beats', 'Hints'].map((t, i) =>
          C(
            { w: 'fill', h: 44, gap: 0 },
            R(
              { w: 'fill', h: 42, ax: 'center' },
              T(t, { size: 12, wt: 500, color: i === active ? 'text/primary' : 'text/dim' }),
            ),
            F({ w: 'fill', h: 2, fill: i === active ? Q.ED.writer.color : null }),
          ),
        ),
      )
    const panel = region(
      'lines panel',
      56,
      52,
      264,
      554,
      { lay: 'col' },
      writerTabs(0),
      F({ w: 'fill', h: 1, fill: 'border/default' }),
      R({ w: 'fill', h: 52, pad: [0, 8] }, search('Search text and ids')),
      C(
        { name: 'line list (scrolls)', w: 'fill', h: 'fill', pad: [0, 8], gap: 0, clip: true },
        lines.map(lineRow),
      ),
      F({ name: 'scrollbar', abs: true, x: 257, y: 110, w: 3, h: 120, r: 2, fill: 'border/strong' }),
    )

    const center = region(
      'line editor',
      320,
      52,
      554,
      554,
      { lay: 'col', pad: 12, gap: 8, fill: 'bg/app' },
      R(
        { w: 'fill', h: 28, gap: 8 },
        T('bay.cutscene.arrival.3', { style: 'Mono/12', wt: 600 }),
        pill('The Porter', { color: 'layer/entities', dot: true }),
        spacer(),
        mono('71 characters'),
      ),
      textArea('Cold. Always so cold. Any little flame, and I come to it like a moth.', 530, 76, {
        focus: true,
        lh: 22,
      }),
      R(
        { w: 'fill', h: 24, gap: 8 },
        I('check', { size: 14, color: 'state/ok' }),
        T('Edits the line in story.toml in place. Nothing else in the file moves.', {
          style: 'Label/12',
          color: 'text/dim',
        }),
      ),
      R({ w: 'fill', h: 28, gap: 8 }, eyebrow('How it plays'), mono('cutscene arrival · 16.2 s')),
      F(
        {
          name: 'preview',
          w: 'fill',
          h: 280,
          r: 'radius/lg',
          fill: 'bg/canvas',
          stroke: 'border/default',
          clip: true,
        },
        V(A.bayArt({ ada: false, lamp: 0.55, dim: 0.3 }), { name: 'art', x: 0, y: -18, w: 530, h: 298 }),
        F(
          {
            name: 'caption box',
            x: 40,
            y: 200,
            w: 450,
            h: 58,
            r: 8,
            fill: alpha('bg/canvas', 0.82),
            stroke: 'border/strong',
          },
          T('THE PORTER', { x: 14, y: 8, style: 'Eyebrow/11', color: 'layer/entities' }),
          T('Cold. Always so cold. Any little flame, and I come to it like a moth.', {
            x: 14,
            y: 26,
            size: 12,
            wt: 500,
            w: 424,
            trunc: true,
          }),
        ),
      ),
    )
    const meta = (label, ...chips) =>
      C({ w: 'fill', gap: 4 }, eyebrow(label), R({ w: 'fill', gap: 6 }, ...chips))
    const inspector = region(
      'inspector',
      874,
      52,
      320,
      554,
      { lay: 'col' },
      tabs([{ label: 'Line' }, { label: 'Code' }, { label: 'Ask' }], 0),
      F({ w: 'fill', h: 1, fill: 'border/default' }),
      C(
        { name: 'fields', w: 'fill', h: 'fill', pad: 12, gap: 10, clip: true },
        select('Speaker', 'The Porter', { lw: 70 }),
        meta(
          'Delivers beat',
          chip('bay.warmth', { on: true, color: 'layer/sky', mono: true }),
          pill('required', { color: 'state/warn', mono: true, h: 22, pad: 8 }),
        ),
        meta(
          'Hints',
          chip('flameDrawsHim', { mono: true, remove: true }),
          chip('+ add', { color: 'accent/default' }),
        ),
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
        C(
          { w: 'fill', gap: 2, pad: [6, 0, 0, 0] },
          eyebrow('Plays in'),
          R(
            {
              w: 'fill',
              h: 44,
              gap: 8,
              pad: [0, 8],
              r: 'radius/md',
              fill: 'bg/field',
              stroke: 'border/default',
            },
            I('film', { size: 16, color: Q.ED.sequence.color }),
            T('arrival', { style: 'Mono/12' }),
            mono('16.2 s'),
            spacer(),
            T('Open', { style: 'Label/12', color: 'accent/default' }),
            I('chevron-right', { size: 14, color: 'text/dim' }),
          ),
          R(
            {
              w: 'fill',
              h: 44,
              gap: 8,
              pad: [0, 8],
              r: 'radius/md',
              fill: 'bg/field',
              stroke: 'border/default',
            },
            I('chat', { size: 16, color: Q.ED.writer.color }),
            T('bay.c1', { style: 'Mono/12' }),
            mono('not used'),
            spacer(),
          ),
        ),
      ),
    )

    const dock = region(
      'lint',
      56,
      606,
      1138,
      228,
      { lay: 'col' },
      line(0, 0, 1138, 1),
      R(
        { name: 'lint header', w: 'fill', h: 52, pad: [0, 8, 0, 16], gap: 8 },
        R(
          { gap: 16 },
          ...['Lint', 'Script wins', 'Checks'].map((t, i) =>
            T(t, { style: 'Body/13 Medium', color: i === 0 ? 'text/primary' : 'text/dim' }),
          ),
        ),
        pill('0 errors', { color: 'state/ok', mono: true, icon: 'check' }),
        pill('2 notes', { color: 'layer/sky', mono: true, icon: 'info' }),
        spacer(),
        btn('Lint now', { icon: 'rotate' }),
        btn('Run cutscene audit', { icon: 'film' }),
      ),
      C(
        { w: 'fill', h: 'fill', pad: [0, 16, 12, 16], gap: 6 },
        P.diagRow({
          sev: 'info',
          code: 'lint.speaker-missing',
          msg: 'bay.cutscene.arrival.2 has no speaker: it shows as a title card, which is what the cutscene wants.',
          path: 'story.toml · bay.cutscene.arrival.2',
        }),
        P.diagRow({
          sev: 'info',
          code: 'lint.fact-unused',
          msg: 'The fact porterCold is set by two lines and read by no hint.',
          path: 'story.toml · facts.porterCold',
        }),
      ),
    )
    return F(
      { name: 'Writer · Lines · iPad landscape', w: 1194, h: 834, fill: 'bg/app', clip: true },
      top(1194, {
        title: 'The Bay',
        sub: Q.D.paths.story,
        ed: 'writer',
        cs: 'story/porter-arrival',
        n: 1,
        checks: 'checks ok',
        reopened: true,
      }),
      rail(782, 'writer'),
      panel,
      center,
      inspector,
      dock,
      line(0, 51, 1194, 1),
      line(55, 52, 1, 782),
      line(319, 52, 1, 554),
      line(873, 52, 1, 554),
    )
  },
})

// ── Dialogue: a conversation as a graph ──
writerScreens.push({
  id: 'writer-dialogue',
  page: 'Suite · Writer',
  name: 'Writer · Dialogue graph · iPad landscape',
  w: 1194,
  h: 834,
  note: 'The Porter’s first conversation as a graph: the node he says four lines from, the three answers Ada can give with the stance each moves, and the replies. A node is selected for its lines, its choices and the facts it sets.',
  build: (_S, P, Q, _A) => {
    const { F, R, C, T, I, alpha, spacer, region, line, eyebrow, pill, btn, ib, tabs, callout } = P
    const { top, rail, search, listRow, gnode, edges, mono } = Q
    const writerTabs = (active) =>
      R(
        { name: 'tabs', w: 'fill', h: 44 },
        ['Lines', 'Dialogues', 'Beats', 'Hints'].map((t, i) =>
          C(
            { w: 'fill', h: 44, gap: 0 },
            R(
              { w: 'fill', h: 42, ax: 'center' },
              T(t, { size: 12, wt: 500, color: i === active ? 'text/primary' : 'text/dim' }),
            ),
            F({ w: 'fill', h: 2, fill: i === active ? Q.ED.writer.color : null }),
          ),
        ),
      )
    const panel = region(
      'dialogues panel',
      56,
      52,
      264,
      782,
      { lay: 'col' },
      writerTabs(1),
      F({ w: 'fill', h: 1, fill: 'border/default' }),
      R({ w: 'fill', h: 52, pad: [0, 8] }, search('Search conversations')),
      C(
        { w: 'fill', pad: [0, 8], gap: 0 },
        listRow({
          title: 'bay.c1',
          sub: 'the Porter · 5 nodes · 3 answers',
          icon: 'chat',
          sel: true,
          color: Q.ED.writer.color,
          h: 52,
          mono: true,
        }),
        listRow({ title: 'bay.c2', sub: 'the Porter · at the ledger', icon: 'chat', h: 52, mono: true }),
        listRow({ title: 'bay.c3', sub: 'the Porter · the river', icon: 'chat', h: 52, mono: true }),
        listRow({
          title: 'bay.radioProgramme',
          sub: 'the radio · 6 segments',
          icon: 'speaker',
          h: 52,
          mono: true,
        }),
      ),
    )
    // The graph: coordinates inside the 554 x 782 canvas. Each answer node carries the quote, its stance and the fact it sets.
    const nodes = [
      gnode(12, 335, 160, 96, {
        title: 'hear',
        sub: '4 lines · 3 answers',
        icon: 'chat',
        color: 'layer/sky',
        sel: true,
        badge: 'start',
        badgeColor: 'accent/default',
      }),
      gnode(214, 190, 170, 84, {
        title: 'staff',
        sub: 'staffReply: “Nights. Course you are.”',
        sub2: 'after “Staff. I’m on nights.” · porterMet = staff',
        icon: 'chat',
        color: 'layer/sky',
        badge: '−1',
        badgeColor: 'text/dim',
      }),
      gnode(214, 341, 170, 84, {
        title: 'unsure',
        sub: 'unsureReply: “That’s all right…”',
        sub2: 'after “I don’t know yet.” · porterMet = unsure',
        icon: 'chat',
        color: 'layer/sky',
        badge: '0',
        badgeColor: 'text/dim',
      }),
      gnode(214, 492, 170, 84, {
        title: 'yours',
        sub: 'yoursReply: “Well. There’s a drawer…”',
        sub2: 'after “I think I’m for you.” · porterMet = yours',
        icon: 'chat',
        color: 'layer/sky',
        badge: '+1',
        badgeColor: 'text/dim',
      }),
      gnode(430, 356, 112, 54, { title: 'end', sub: 'no lines', icon: 'flag', color: 'text/faint' }),
    ]
    const E = edges(0, 0, 554, 782, [
      { a: [172, 383], b: [214, 232], c: 'ed/writer' },
      { a: [172, 383], b: [214, 383], c: 'ed/writer' },
      { a: [172, 383], b: [214, 534], c: 'ed/writer' },
      { a: [384, 232], b: [430, 383], c: 'text/faint', dash: true },
      { a: [384, 383], b: [430, 383], c: 'text/faint', dash: true },
      { a: [384, 534], b: [430, 383], c: 'text/faint', dash: true },
    ])
    const canvas = region(
      'graph',
      320,
      52,
      554,
      782,
      { fill: 'bg/canvas' },
      E,
      ...nodes,
      R(
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
        ib('fit'),
        ib('plus'),
      ),
      R(
        {
          name: 'fact chip',
          x: 8,
          y: 738,
          h: 32,
          pad: [0, 12],
          gap: 8,
          r: 16,
          fill: 'bg/surface',
          stroke: 'border/default',
        },
        T('sets', { style: 'Mono/11', color: 'text/dim' }),
        T('porterMet', { style: 'Mono/11', color: 'accent/default' }),
        T('read by bay.c2 · bay.c3', { style: 'Mono/11', color: 'text/dim' }),
      ),
    )
    const lineIds = ['hear', 'inner', 'cold', 'ask']
    const inspector = region(
      'inspector',
      874,
      52,
      320,
      782,
      { lay: 'col' },
      tabs([{ label: 'Node' }, { label: 'Code' }, { label: 'Ask' }], 0),
      F({ w: 'fill', h: 1, fill: 'border/default' }),
      C(
        { name: 'fields', w: 'fill', h: 'fill', pad: 12, gap: 8, clip: true },
        R(
          { w: 'fill', h: 28, gap: 8 },
          F({ w: 14, h: 14, r: 4, fill: alpha('layer/sky', 0.85) }),
          T('hear', { style: 'Mono/12', wt: 600 }),
          spacer(),
          pill('start', { color: 'accent/default', mono: true, h: 22, pad: 8 }),
        ),
        eyebrow('Says', { w: 'fill' }),
        C(
          { w: 'fill', gap: 4 },
          lineIds.map((l) =>
            R(
              {
                w: 'fill',
                h: 40,
                pad: [0, 8, 0, 4],
                gap: 4,
                r: 'radius/md',
                fill: 'bg/field',
                stroke: 'border/default',
              },
              I('grip', { size: 16, color: 'text/faint' }),
              T(`bay.porter.c1.${l}`, { style: 'Mono/11', w: 'fill', trunc: true }),
              I('chevron-right', { size: 14, color: 'text/faint' }),
            ),
          ),
        ),
        eyebrow('Answers', { w: 'fill' }),
        C(
          { w: 'fill', gap: 4 },
          [
            ['staff', '−1'],
            ['unsure', '0'],
            ['yours', '+1'],
          ].map(([id, stance]) =>
            R(
              {
                w: 'fill',
                h: 44,
                pad: [0, 8, 0, 12],
                gap: 8,
                r: 'radius/md',
                fill: 'bg/field',
                stroke: 'border/default',
              },
              T(id, { style: 'Mono/12', w: 'fill' }),
              mono('stance'),
              T(stance, { style: 'Mono/12', color: 'accent/default' }),
              I('chevron-right', { size: 14, color: 'text/faint' }),
            ),
          ),
        ),
        R({ w: 'fill', h: 4 }),
        callout(
          'info',
          'Conditions are code',
          'When a node is gated by facts, the gate reads here and changes through Ask. Lines and answers edit in place.',
        ),
        btn('Preview the conversation', { icon: 'play', w: 'fill', kind: 'primary', h: 48 }),
      ),
    )
    return F(
      { name: 'Writer · Dialogue graph · iPad landscape', w: 1194, h: 834, fill: 'bg/app', clip: true },
      top(1194, {
        title: 'bay.c1',
        sub: Q.D.paths.dialogues,
        ed: 'writer',
        cs: 'story/porter-arrival',
        n: 1,
        checks: 'checks ok',
        reopened: true,
      }),
      rail(782, 'writer'),
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
