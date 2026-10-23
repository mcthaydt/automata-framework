// The suite around the editors: the home screen, the review desk, Ask, Ship and the interchange dialog. Shared by every editor.

export const suiteScreens = []

// ── Home ──
suiteScreens.push({
  id: 'suite-home',
  page: 'Suite · Shell',
  name: 'Suite home · iPad landscape',
  w: 1194,
  h: 834,
  note: 'One place to start: the editors for the open scene, what each one edits (the AF content file the game’s editor list names) and the change set everything lands in, with the gates it reopens. Levels opens the 2D and 3D level editors.',
  build: (_S, P, Q, _A) => {
    const { F, R, C, T, I, alpha, spacer, region, line, eyebrow, pill, btn, inputBox } = P
    const { D, top, ED, mono } = Q
    const cards = [
      [
        'sequence',
        'Shots, lenses, lines, sound and light, on a timeline.',
        'scenes/bay/cutscenes.toml',
        ['7 cutscenes', 'text/dim'],
      ],
      [
        'tuner',
        'Tunables as sliders, with fairness measured before and after.',
        'scenes/bay/tuning.toml',
        ['1 changed', 'accent/default'],
      ],
      [
        'writer',
        'Lines, conversations, beats and hints, with the lint.',
        'scenes/bay/story.toml · dialogues.toml',
        ['4 conversations', 'text/dim'],
      ],
      [
        'studio',
        'Characters: turnaround, outfits, sliders and poses.',
        'characters/*.json',
        ['4 characters', 'text/dim'],
      ],
      [
        'schematic',
        'The puzzle as a graph, and the systems behind it.',
        'scenes/bay/puzzle.toml · agents.toml',
        ['3 of 3 kits solved', 'state/ok'],
      ],
      [
        'audio',
        'Sounds as recipes of voices, with the mix and the size budget.',
        'audio/cues.toml',
        ['75 cues', 'text/dim'],
      ],
      [
        'feel',
        'Events and the five channels each one answers on.',
        'feel/effects.toml',
        ['9 events', 'text/dim'],
      ],
      [
        'levels2d',
        'Rooms, boxes and tiles: the level editors, 3D and 2D.',
        'levels/bay/blockout.json',
        ['2D · 3D', 'text/dim'],
      ],
      [
        'review',
        'Open change sets, their checks, playthroughs and gates.',
        'GitHub',
        ['2 gates waiting', 'accent/default'],
      ],
    ]
    const card = ([key, about, file, pillSpec], i) => {
      const e = ED[key]
      const x = 24 + (i % 3) * 282
      const y = 112 + Math.floor(i / 3) * 206
      return C(
        {
          name: `editor/${e.name}`,
          x,
          y,
          w: 266,
          h: 190,
          pad: 16,
          gap: 8,
          r: 'radius/lg',
          fill: 'bg/surface',
          stroke: 'border/default',
          abs: true,
        },
        R(
          { w: 'fill', gap: 12 },
          R(
            { w: 44, h: 44, ax: 'center', r: 22, fill: alpha(e.color, 0.16) },
            I(e.icon, { size: 22, color: e.color }),
          ),
          T(key === 'levels2d' ? 'Levels' : e.name, { style: 'Title/15' }),
          spacer(),
          I('chevron-right', { size: 18, color: 'text/faint' }),
        ),
        T(about, { style: 'Body/13', color: 'text/dim', w: 'fill', lh: 18 }),
        spacer(),
        T(file, { style: 'Mono/11', color: 'text/faint', w: 'fill', trunc: true }),
        R({ w: 'fill', gap: 6 }, pill(pillSpec[0], { color: pillSpec[1], mono: true, h: 24 })),
      )
    }
    const files = [
      [D.paths.cutscenes, '+3 −3'],
      [D.paths.tuning, '+1 −1'],
    ]
    const side = region(
      'change set',
      874,
      52,
      320,
      782,
      { lay: 'col', pad: 16, gap: 10 },
      R(
        { w: 'fill', h: 28, gap: 8 },
        eyebrow('Change set'),
        spacer(),
        pill('2 changes', { color: 'accent/default', mono: true, h: 22, pad: 8 }),
      ),
      R(
        {
          w: 'fill',
          h: 44,
          gap: 8,
          pad: [0, 12],
          r: 'radius/md',
          fill: 'bg/raised',
          stroke: 'border/default',
        },
        I('branch', { size: 16, color: 'text/dim' }),
        T('edit/arrival-timing', { style: 'Mono/12', w: 'fill', trunc: true }),
      ),
      C(
        { w: 'fill', gap: 2 },
        ...files.map(([f, d]) =>
          R(
            { w: 'fill', h: 32, gap: 8 },
            T(f.replace('content/scenes/bay/', ''), { style: 'Mono/12', w: 'fill', trunc: true }),
            T(d, { style: 'Mono/11', color: 'text/dim' }),
          ),
        ),
      ),
      F({ w: 'fill', h: 1, fill: 'border/default' }),
      eyebrow('Checks'),
      R(
        { w: 'fill', gap: 6 },
        P.checksPill('checks ok', 'state/ok'),
        pill(`${files.flatMap(([f]) => Q.gatesFor(f)).join(' · ')} reopened`, {
          color: 'accent/default',
          mono: true,
          icon: 'gate',
        }),
      ),
      F({ w: 'fill', h: 1, fill: 'border/default' }),
      eyebrow('Pick up where you left off'),
      C(
        { w: 'fill', gap: 4 },
        [
          ['sequence', 'arrival · Shot C', '12 min ago'],
          ['tuner', 'LIGHTER_REACH', '31 min ago'],
          ['writer', 'bay.cutscene.arrival.3', 'yesterday'],
        ].map(([k, t, w]) =>
          R(
            { w: 'fill', h: 48, pad: [0, 8], gap: 10, r: 'radius/md' },
            I(ED[k].icon, { size: 18, color: ED[k].color }),
            C(
              { w: 'fill', gap: 0 },
              T(t, { style: 'Mono/12', w: 'fill', trunc: true }),
              T(w, { style: 'Label/12', color: 'text/faint' }),
            ),
            I('chevron-right', { size: 14, color: 'text/faint' }),
          ),
        ),
      ),
      spacer(),
      btn('Review this change set', { icon: 'check', w: 'fill' }),
    )
    return F(
      { name: 'Suite home · iPad landscape', w: 1194, h: 834, fill: 'bg/app', clip: true },
      top(1194, {
        menu: true,
        title: 'The Last Light',
        sub: 'Automata editors · content/editors.toml',
        ed: null,
        cs: 'edit/arrival-timing',
        n: 2,
        checks: 'checks ok',
        gates: false,
        primary: 'Ship',
        mid: R({ w: 190 }, inputBox('The Bay · act two', { chevron: true, h: 44 })),
      }),
      R(
        { name: 'heading', x: 24, y: 68, w: 826, h: 36, gap: 12 },
        T('Editors', { style: 'Display/20' }),
        mono('for The Bay'),
        spacer(),
        btn('New scene', { icon: 'plus', kind: 'ghost' }),
      ),
      ...cards.map(card),
      side,
      line(0, 51, 1194, 1),
      line(873, 52, 1, 782),
    )
  },
})

// ── Review desk ──
suiteScreens.push({
  id: 'review-desk',
  page: 'Suite · Shell',
  name: 'Review desk · iPad landscape',
  w: 1194,
  h: 834,
  note: 'The owner’s view of a change set on an iPad: what changed, how it looks before and after, which checks ran and passed, and the gates it reopens, each with a link to approve on GitHub. The editor shows gates and never records one.',
  build: (_S, P, Q, _A) => {
    const { F, R, C, T, I, alpha, spacer, region, line, eyebrow, pill, btn, ib, panelHead, callout } = P
    const { D, top, rail, listRow, diff, mono, meter } = Q
    const sets = [
      ['edit/arrival-timing', '2 files · reopens C-G1, S-G2', 'gate', 'accent/default', true],
      ['studio/ada-apron', '1 change · reopens G1, G6', 'clock', 'text/dim', false],
      ['story/porter-arrival', '1 change · lint 1 error', 'warn', 'state/bad', false],
      ['puzzle/keys-two-ways', '1 change · checks ok', 'check', 'state/ok', false],
    ]
    const panel = region(
      'change sets',
      56,
      52,
      264,
      782,
      { lay: 'col' },
      panelHead('Change sets', ib('more')),
      C(
        { w: 'fill', pad: [0, 8], gap: 0 },
        sets.map(([name, sub, icon, c, sel]) =>
          listRow({ title: name, sub, icon, iconColor: c, h: 56, mono: true, sel, color: Q.ED.review.color }),
        ),
      ),
      R({ w: 'fill', h: 12 }),
      C(
        { w: 'fill', pad: [0, 16], gap: 6 },
        eyebrow('Open gates'),
        ...[
          ['C-G1', 'cutscenes'],
          ['S-G2', 'tunables'],
          ['G6', 'figure'],
          ['N-G1', 'screenplay'],
          ['P-G1', 'puzzle'],
        ].map(([g, n]) =>
          R(
            { w: 'fill', h: 28, gap: 8 },
            P.dot('accent/default', 7),
            T(g, { style: 'Mono/12', w: 52 }),
            T(n, { style: 'Label/12', color: 'text/dim' }),
          ),
        ),
      ),
    )
    const cardF = (name, h, ...kids) =>
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
    const center = region(
      'evidence',
      320,
      52,
      554,
      782,
      { lay: 'col', pad: 12, gap: 10, fill: 'bg/app' },
      R(
        { w: 'fill', h: 28, gap: 8 },
        T('edit/arrival-timing', { style: 'Mono/12', wt: 600 }),
        pill('draft PR', { color: 'text/dim', icon: 'branch', mono: true }),
        spacer(),
        mono('2 files'),
      ),
      cardF(
        'what changed',
        150,
        R(
          { w: 'fill', h: 20, gap: 8 },
          eyebrow('What changed'),
          spacer(),
          mono('tuning.toml · 1 of 2 files'),
        ),
        diff(
          [
            [' ', 11, '# m · P1: a lit lighter draws him from this far (along open ways, not through walls)'],
            ['-', 12, 'LIGHTER_REACH = { value = 6, min = 2, max = 12 }'],
            ['+', 12, 'LIGHTER_REACH = { value = 5, min = 2, max = 12 }'],
          ],
          530,
          { rowH: 24 },
        ),
      ),
      cardF(
        'before and after',
        262,
        R(
          { w: 'fill', h: 20, gap: 8 },
          eyebrow('Tension over the run'),
          mono('typical kit · 3 seeds'),
          spacer(),
          pill('before', { color: 'text/dim', dot: true, mono: true, h: 22, pad: 8 }),
          pill('after', { color: 'accent/default', dot: true, mono: true, h: 22, pad: 8 }),
        ),
        Q.chart(506, 190, {
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
      cardF(
        'checks',
        248,
        R(
          { w: 'fill', h: 20, gap: 8 },
          eyebrow('Checks'),
          spacer(),
          pill('4 passed', { color: 'state/ok', mono: true, h: 22, pad: 8, icon: 'check' }),
          pill('1 running', { color: 'text/dim', mono: true, h: 22, pad: 8, icon: 'clock' }),
        ),
        ...[
          ['cutscene audit', 'ok', 'every line plays and no shot is empty'],
          ['direction audit', 'ok', 'shots C and D meet at 16.4 s'],
          ['systems validate', 'ok', 'LIGHTER_REACH 5 inside 2 to 12'],
          ['systems fairness', 'ok', 'first threat 24.1 s · limit 20 s'],
          ['playthrough · bay', 'run', 'step 41 of 58 · 1 min 12 s so far'],
        ].map(([n, s, d]) =>
          R(
            { w: 'fill', h: 36, gap: 10 },
            s === 'ok'
              ? I('check', { size: 16, color: 'state/ok' })
              : I('clock', { size: 16, color: 'text/dim' }),
            T(n, { style: 'Body/13', w: 150 }),
            T(d, { style: 'Mono/11', color: 'text/dim', w: 'fill', trunc: true }),
          ),
        ),
      ),
    )
    const gate = (id, name, why, state) =>
      C(
        {
          name: `gate/${id}`,
          w: 'fill',
          pad: 12,
          gap: 6,
          r: 'radius/md',
          fill: state === 'none' ? 'bg/field' : alpha('accent/default', 0.08),
          stroke: state === 'none' ? 'border/default' : alpha('accent/default', 0.5),
        },
        R(
          { w: 'fill', gap: 8 },
          I('gate', { size: 16, color: state === 'none' ? 'text/faint' : 'accent/default' }),
          T(id, { style: 'Mono/12', wt: 600 }),
          T(name, { style: 'Label/12', color: 'text/dim' }),
          spacer(),
          T(state === 'none' ? 'not reopened' : 'open', {
            style: 'Mono/11',
            color: state === 'none' ? 'text/faint' : 'accent/default',
          }),
        ),
        T(why, { style: 'Label/12', color: 'text/dim', w: 'fill', lh: 16 }),
        state === 'none' ? null : btn('Approve on GitHub', { icon: 'external', h: 44, w: 'fill' }),
      )
    const right = region(
      'gates',
      874,
      52,
      320,
      782,
      { lay: 'col', pad: 12, gap: 10 },
      R({ w: 'fill', h: 28, gap: 8 }, eyebrow('Gates this reopens')),
      gate(
        'C-G1',
        'cutscenes',
        'Reopened by cutscenes.toml: shot C ends at 16.4 s, shot D starts there.',
        'open',
      ),
      gate(
        'S-G2',
        'tunables',
        'Reopened by tuning.toml: LIGHTER_REACH 6 → 5. Read the fairness above first.',
        'open',
      ),
      callout(
        'info',
        'Approving happens on GitHub',
        'The editor shows each gate and links to the action that records it. It never records a decision.',
      ),
      F({ w: 'fill', h: 1, fill: 'border/default' }),
      eyebrow('Spend'),
      R({ w: 'fill', h: 28, gap: 8 }, T('Ask', { style: 'Body/13', w: 'fill' }), mono('12k of 60k tokens')),
      meter(296, 0.21, { h: 8 }),
      R({ w: 'fill', h: 28, gap: 8 }, T('Paid pipeline runs', { style: 'Body/13', w: 'fill' }), mono('none')),
      spacer(),
      btn('Open the draft PR', { icon: 'external', w: 'fill' }),
      btn('Mark ready for review', { kind: 'primary', h: 48, icon: 'check', w: 'fill' }),
    )
    return F(
      { name: 'Review desk · iPad landscape', w: 1194, h: 834, fill: 'bg/app', clip: true },
      top(1194, {
        title: 'Review',
        sub: D.games[0].repo,
        ed: 'review',
        cs: 'edit/arrival-timing',
        n: 2,
        checks: 'checks ok',
        gates: [
          ['C-G1', 'open'],
          ['S-G2', 'open'],
        ],
        primary: 'Ship',
      }),
      rail(782, 'review'),
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

// ── Ask: Claude's diff for the selection ──
suiteScreens.push({
  id: 'ask-diff',
  page: 'Suite · Shell',
  name: 'Ask · a diff to accept · iPad landscape',
  w: 1194,
  h: 834,
  note: 'Anything structural is a request to Claude about what is selected. The answer is a diff of the content file, checked by the content compiler before it can be written, with a token cap. Accept writes it into the change set; reject leaves the file alone. Locked keys and generated files are refused.',
  build: (_S, P, Q, A) => {
    const { F, R, C, T, I, V, alpha, spacer, region, line, eyebrow, pill, btn, ib, callout } = P
    const { top, rail, diff, mono, meter, chip, textArea } = Q
    const sheet = region(
      'ask sheet',
      574,
      52,
      620,
      782,
      { lay: 'col', fill: 'bg/surface' },
      R(
        { name: 'sheet header', w: 'fill', h: 56, pad: [0, 8, 0, 20], gap: 10 },
        I('sparkles', { size: 20, color: 'ed/feel' }),
        T('Ask', { style: 'Title/15' }),
        T('arrival · Shot C', { style: 'Mono/12', color: 'text/dim' }),
        spacer(),
        ib('close'),
      ),
      F({ w: 'fill', h: 1, fill: 'border/default' }),
      C(
        { w: 'fill', h: 'fill', pad: 20, gap: 12, clip: true },
        C(
          { w: 'fill', gap: 6 },
          eyebrow('Claude will see'),
          R(
            { w: 'fill', gap: 6 },
            chip('cutscenes.toml · arrival', { mono: true, static: true }),
            chip('playhead 12.40 s', { mono: true, static: true }),
            chip('line arrival.2', { mono: true, static: true }),
            chip('a frame grab', { mono: true, static: true }),
          ),
        ),
        textArea('Hold on the run sheet a beat longer.', 580, 72, { focus: true, lh: 22 }),
        R(
          { w: 'fill', h: 44, gap: 8 },
          mono('38k of 60k tokens'),
          meter(160, 0.63, { h: 6 }),
          spacer(),
          btn('Send', { kind: 'primary', h: 44, icon: 'send' }),
        ),
        F({ w: 'fill', h: 1, fill: 'border/default' }),
        R(
          { w: 'fill', h: 24, gap: 8 },
          eyebrow('Proposal'),
          pill('content check ok', { color: 'state/ok', mono: true, icon: 'check', h: 22, pad: 8 }),
          pill('cutscene lint ok', { color: 'state/ok', mono: true, icon: 'check', h: 22, pad: 8 }),
          spacer(),
          mono('2 keys in 1 file'),
        ),
        T(
          'Shot C now ends at 16.4 s instead of 15.7 s, and the light keys that ride on its cut move with it. The caption for the Porter at 16.2 s stays where it is.',
          { style: 'Body/13', w: 'fill', lh: 19 },
        ),
        diff(
          [
            [' ', 31, '[[arrival.shot]]  # C: the run sheet on the stretcher'],
            [' ', 32, 'from = 10.0'],
            ['-', 33, 'to = 15.7'],
            ['+', 33, 'to = 16.4'],
            ['-', 41, 'bayFill = [[10, 2.4], [15.65, 2.4], [15.7, 0.6]]'],
            ['+', 41, 'bayFill = [[10, 2.4], [16.35, 2.4], [16.4, 0.6]]'],
          ],
          580,
          { rowH: 26 },
        ),
        callout(
          'warn',
          'Shot D starts at 15.7 s',
          'The next shot’s cut did not move, so shot C and D would overlap for 0.7 s. Ask for both, or accept and retime D yourself.',
        ),
        spacer(),
        R(
          { w: 'fill', h: 48, gap: 8 },
          btn('Reject', { icon: 'close', w: 120 }),
          btn('Ask again', { icon: 'rotate', w: 140 }),
          spacer(),
          btn('Accept into the change set', { kind: 'primary', h: 48, icon: 'check' }),
        ),
      ),
    )
    return F(
      { name: 'Ask · a diff to accept · iPad landscape', w: 1194, h: 834, fill: 'bg/app', clip: true },
      top(1194, {
        title: 'arrival',
        sub: Q.D.paths.cutscenes,
        ed: 'sequence',
        cs: 'edit/arrival-timing',
        n: 2,
        checks: 'checks ok',
        reopened: true,
      }),
      rail(782, 'sequence'),
      F(
        { name: 'timeline behind', x: 56, y: 52, w: 518, h: 782, fill: 'bg/surface' },
        V(A.bayArt({ lamp: 1 }), { x: 0, y: 40, w: 518, h: 291 }),
        F({ x: 0, y: 360, w: 518, h: 422, fill: 'bg/app' }),
      ),
      F({ name: 'scrim', x: 56, y: 52, w: 518, h: 782, fill: alpha('bg/canvas', 0.62) }),
      sheet,
      line(0, 51, 1194, 1),
      line(55, 52, 1, 782),
      line(573, 52, 1, 782),
    )
  },
})

// ── Ship dialog ──
suiteScreens.push({
  id: 'ship-dialog',
  page: 'Suite · Shell',
  name: 'Ship · push and open a draft PR',
  w: 720,
  h: 700,
  note: 'Ship pushes the change set’s branch and opens a draft pull request. The description is drafted from the changes, the checks and the gates the game’s editor list names for each file, and the owner edits it first. Gates still need the owner.',
  build: (_S, P, Q, _A) => {
    const { R, C, T, spacer, eyebrow, btn, callout, inputBox, dialog, modalFrame } = P
    const { D, mono, textArea } = Q
    const body = [
      C(
        { w: 'fill', gap: 4 },
        T('Title', { style: 'Label/12', color: 'text/dim' }),
        inputBox('Hold on the run sheet a beat longer (arrival, shot C)', { h: 44 }),
      ),
      C(
        { w: 'fill', gap: 4 },
        R(
          { w: 'fill', gap: 8 },
          T('Description', { style: 'Label/12', color: 'text/dim' }),
          spacer(),
          btn('Write it up', { icon: 'sparkles', h: 36, kind: 'ghost' }),
        ),
        textArea(
          'Retimes shot C of the Bay’s arrival cutscene to end at 16.4 s, a beat longer on the run sheet, starts shot D there and moves the light keys with it. Lowers LIGHTER_REACH from 6 to 5 m; first threat moves from 21.3 s to 24.1 s. Checks pass. Reopens C-G1 (cutscenes) and S-G2 (tunables) for the owner.',
          600,
          128,
          { lh: 19 },
        ),
      ),
      C(
        { w: 'fill', gap: 4 },
        eyebrow('Changes'),
        R({ w: 'fill', h: 32, gap: 8 }, T(D.paths.cutscenes, { style: 'Mono/12', w: 'fill' }), mono('+3 −3')),
        R({ w: 'fill', h: 32, gap: 8 }, T(D.paths.tuning, { style: 'Mono/12', w: 'fill' }), mono('+1 −1')),
      ),
      callout(
        'info',
        `Reopens ${[D.paths.cutscenes, D.paths.tuning].flatMap((f) => Q.gatesFor(f)).join(' and ')} for the owner`,
        'C-G1 for the cutscene, S-G2 for the tunable. Pushing opens a draft PR that links to approve each; the editor does not record them.',
      ),
    ]
    return modalFrame(
      'Ship · push and open a draft PR',
      640,
      620,
      dialog('ship', 640, 620, 'Ship this change set', body, [
        btn('Close'),
        btn('Push and open draft PR', { kind: 'primary', h: 48, icon: 'external' }),
      ]),
    )
  },
})

// ── Interchange ──
suiteScreens.push({
  id: 'interchange',
  page: 'Suite · Shell',
  name: 'Import · plan, then apply',
  w: 800,
  h: 760,
  note: 'A scene exports as one JSON or TOML document and imports back through a plan: what would change in which content file, the gate each change reopens, what is refused and why. Nothing is written until the plan is clean and the owner applies it.',
  build: (_S, P, Q, _A) => {
    const { R, C, T, I, alpha, spacer, eyebrow, pill, btn, seg, callout, dialog, modalFrame } = P
    const { mono } = Q
    const row = (ok, title, sub) =>
      R(
        {
          w: 'fill',
          h: 52,
          pad: [0, 12],
          gap: 10,
          r: 'radius/md',
          fill: ok ? 'bg/field' : alpha('state/bad', 0.08),
          stroke: ok ? 'border/default' : alpha('state/bad', 0.5),
        },
        I(ok ? 'check' : 'warn', { size: 18, color: ok ? 'state/ok' : 'state/bad' }),
        C(
          { w: 'fill', gap: 0 },
          T(title, { style: 'Mono/12', w: 'fill', trunc: true }),
          T(sub, { style: 'Label/12', color: ok ? 'text/dim' : 'state/bad', w: 'fill', trunc: true }),
        ),
      )
    const body = [
      seg(['Export', 'Import'], 1),
      R(
        {
          w: 'fill',
          h: 52,
          pad: [0, 12],
          gap: 10,
          r: 'radius/md',
          fill: 'bg/field',
          stroke: 'border/default',
        },
        I('file', { size: 18, color: 'text/dim' }),
        C(
          { w: 'fill', gap: 0 },
          T('bay-arrival-edit.toml', { style: 'Mono/12' }),
          T('scene-interchange v2 · scene bay · read', { style: 'Label/12', color: 'text/dim' }),
        ),
        pill('parsed', { color: 'state/ok', icon: 'check', mono: true }),
      ),
      R(
        { w: 'fill', h: 28, gap: 8 },
        eyebrow('Plan'),
        pill('2 changes', { color: 'state/ok', mono: true, h: 22, pad: 8 }),
        pill('1 refused', { color: 'state/bad', mono: true, h: 22, pad: 8 }),
        spacer(),
        mono('dry run: nothing written'),
      ),
      C(
        { w: 'fill', gap: 6 },
        row(true, 'cutscenes.toml · arrival shot C · to', '15.7 → 16.4 s · reopens C-G1'),
        row(true, 'tuning.toml · LIGHTER_REACH', '6 → 5 m · inside 2 to 12 · reopens S-G2'),
        row(false, 'tuning.toml · TORCH_REACH', 'refused: 16 is outside 2 to 14 (tuning.range)'),
      ),
      callout(
        'warn',
        'Fix or drop the refused change',
        'Apply stays off until the plan is clean. The file keeps its other changes.',
      ),
    ]
    return modalFrame(
      'Import · plan, then apply',
      720,
      680,
      dialog('import', 720, 680, 'Export and import', body, [
        btn('Close'),
        btn('Apply 2 changes', { kind: 'primary', h: 48, disabled: true }),
      ]),
    )
  },
})
