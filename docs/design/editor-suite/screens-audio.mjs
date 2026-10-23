// Audio and Feel: the game's two boards (src/audio/board.ts, src/feel/board.ts), which the Last Light editor suite never had as editors
// (editor-gaps #68 and #76 are the audio half), designed as editors for the framework's audio-synth and feel extensions.

export const audioScreens = []

// ── Audio cues ──
audioScreens.push({
  id: 'audio-cues',
  page: 'Suite · Audio',
  name: 'Audio · bang · iPad landscape',
  w: 1194,
  h: 834,
  note: 'Every sound is a recipe of voices the synth schedules, so the editor edits the recipe: tones swept between two pitches, filtered noise, when each starts and how long it rings. Cues are tuned here and audition through the same synth the game uses; the mix and the size budget sit along the bottom.',
  build: (_S, P, Q, A) => {
    const { F, R, C, T, V, alpha, spacer, region, line, eyebrow, pill, btn, ib, seg, tabs, panelHead } = P
    const { top, rail, listRow, search, chip, lanes, ruler, stepperV, toggleRow, meter, mono } = Q
    const cues = [
      ['bang', 'The breaker blows', { sel: true }],
      ['bottle', 'Glass shatters on the floor', {}],
      ['beep', 'One monitor beep', {}],
      ['alarm', 'The monitor alarm', {}],
      ['door', 'A heavy door opens', {}],
      ['pickup', 'Ada takes or uses something', {}],
      ['rattle', 'A door rattles in its frame', { draft: true }],
      ['porterMutter', 'The Porter’s muttered barks', { draft: true, sample: true }],
    ]
    const panel = region(
      'cues panel',
      56,
      52,
      264,
      602,
      { lay: 'col' },
      panelHead('Cues', ib('plus'), ib('more')),
      R(
        { w: 'fill', h: 44, pad: [0, 8], gap: 4 },
        chip('all', { on: true, color: Q.ED.audio.color }),
        chip('effects'),
        chip('ui'),
        chip('music'),
      ),
      R({ w: 'fill', h: 52, pad: [0, 8] }, search('Search cues')),
      C(
        { name: 'cue list (scrolls)', w: 'fill', h: 'fill', pad: [0, 8], gap: 0, clip: true },
        cues.map(([id, about, o]) =>
          listRow({
            title: id,
            sub: about,
            icon: o.sample ? 'file' : 'wave',
            h: 52,
            mono: true,
            sel: o.sel,
            color: Q.ED.audio.color,
            right: o.draft ? pill('draft', { color: 'state/warn', mono: true, h: 20, pad: 7 }) : null,
          }),
        ),
      ),
    )
    const dur = 1.25
    const W = 530
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
          color: 'layer/intgrid',
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
    const center = region(
      'cue editor',
      320,
      52,
      554,
      602,
      { fill: 'bg/app' },
      R(
        { name: 'header', x: 12, y: 12, w: 530, h: 28, gap: 8 },
        T('bang', { style: 'Mono/12', wt: 600 }),
        pill('effects', { color: Q.ED.audio.color, dot: true, mono: true }),
        pill('world', { color: 'text/dim', icon: 'pin', mono: true }),
        spacer(),
        mono('1.25 s · 3 voices'),
      ),
      T('The breaker blows: a low thump, a crack and the hiss after it.', {
        x: 12,
        y: 44,
        w: 530,
        style: 'Label/12',
        color: 'text/dim',
      }),
      F(
        {
          name: 'waveform',
          x: 12,
          y: 72,
          w: 530,
          h: 150,
          r: 'radius/lg',
          fill: 'bg/canvas',
          stroke: 'border/default',
          clip: true,
        },
        V(A.waveSvg(514, 134, { kind: 'hiss', seed: 5, decay: 2.6, attack: 0.02, hex: '#e6c35c' }), {
          x: 8,
          y: 8,
          w: 514,
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
        { name: 'play row', x: 12, y: 234, w: 530, h: 48, gap: 8 },
        btn('Play', { kind: 'primary', h: 48, icon: 'play', w: 110 }),
        btn('Loop', { icon: 'loop' }),
        btn('Place', { icon: 'pin' }),
        spacer(),
        pill('no clicks', { color: 'state/ok', mono: true, icon: 'check' }),
        pill('peak −6.2 dB', { color: 'state/ok', mono: true }),
      ),
      R(
        { name: 'voices header', x: 12, y: 296, w: 530, h: 28, gap: 8 },
        eyebrow('Voices'),
        spacer(),
        btn('Add voice', { icon: 'plus', h: 36 }),
      ),
      F(
        {
          name: 'voices',
          x: 12,
          y: 328,
          w: 530,
          h: 150,
          r: 'radius/md',
          fill: 'bg/surface',
          stroke: 'border/default',
          clip: true,
        },
        ...ruler({ w: W, dur, step: 0.25, minor: 0.05, y: 6, labelW: 70, padR: 10 }),
        ...L.kids,
      ),
      R(
        { name: 'used by', x: 12, y: 490, w: 530, h: 36, gap: 8 },
        eyebrow('Played by'),
        chip('cutscene arrival · 0.2 s', { mono: true }),
        chip('noise.bang', { mono: true }),
      ),
    )
    const inspector = region(
      'inspector',
      874,
      52,
      320,
      602,
      { lay: 'col' },
      tabs([{ label: 'Voice' }, { label: 'Cue' }, { label: 'Ask' }], 0),
      F({ w: 'fill', h: 1, fill: 'border/default' }),
      C(
        { name: 'fields', w: 'fill', h: 'fill', pad: 12, gap: 8, clip: true },
        R(
          { w: 'fill', h: 28, gap: 8 },
          F({ w: 14, h: 14, r: 4, fill: alpha('layer/intgrid', 0.85) }),
          T('Voice 1 · tone', { style: 'Title/15' }),
          spacer(),
          pill('literal', { color: 'state/ok', icon: 'check' }),
        ),
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
        stepperV('Volume', '0.80'),
        F({ w: 'fill', h: 1, fill: 'border/default' }),
        toggleRow('World sound', true, 'Panned and quieter with distance'),
        toggleRow('Draft', false, 'A placeholder until the audio pass'),
        R(
          { w: 'fill', gap: 8 },
          btn('Mute voice', { icon: 'eye-off', w: 'fill' }),
          btn('Delete', { kind: 'danger', icon: 'trash', w: 'fill' }),
        ),
      ),
    )
    const bus = (name, v, note, c) =>
      C(
        {
          name: `bus/${name}`,
          w: 'fill',
          h: 'fill',
          pad: 12,
          gap: 6,
          r: 'radius/md',
          fill: 'bg/raised',
          stroke: 'border/default',
        },
        R({ w: 'fill', gap: 8 }, T(name, { style: 'Mono/12', wt: 600 }), spacer(), mono(`${v.toFixed(2)}`)),
        meter(150, v, { color: c, h: 8 }),
        T(note, { style: 'Label/12', color: 'text/faint', w: 'fill', trunc: true }),
      )
    const dock = region(
      'mix',
      56,
      654,
      1138,
      180,
      { lay: 'col' },
      line(0, 0, 1138, 1),
      R(
        { name: 'mix header', w: 'fill', h: 52, pad: [0, 8, 0, 16], gap: 10 },
        eyebrow('Mix'),
        pill('2.7 of 4 MB', { color: 'state/ok', mono: true, icon: 'check' }),
        mono('inlined files and samples'),
        spacer(),
        btn('Offline render check', { icon: 'check' }),
        btn('Reset mix', { icon: 'rotate' }),
      ),
      R(
        { w: 'fill', h: 'fill', pad: [0, 16, 12, 16], gap: 10 },
        bus('music', 0.55, 'ducks −8 dB under dialogue', 'layer/city'),
        bus('effects', 0.8, 'world sounds attenuate', 'layer/intgrid'),
        bus('ui', 0.6, 'no ducking', 'layer/sky'),
        bus('dialogue', 0.9, 'ducks music', 'layer/entities'),
      ),
    )
    return F(
      { name: 'Audio · bang · iPad landscape', w: 1194, h: 834, fill: 'bg/app', clip: true },
      top(1194, {
        title: 'bang',
        sub: 'src/audio/cues.ts',
        ed: 'audio',
        cs: 'audio/breaker-thump',
        n: 1,
        checks: 'checks ok',
        gates: [['audio check', 'ok']],
      }),
      rail(782, 'audio'),
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

// ── Feel matrix ──
audioScreens.push({
  id: 'feel-matrix',
  page: 'Suite · Feel',
  name: 'Feel · bang · iPad landscape',
  w: 1194,
  h: 834,
  note: 'Game feel as a table of events and the five channels each one answers on: what you see, hear, feel in the camera, read in the HUD and feel in the controller. Every event reaches a row or a stated reason. The bottom strip previews what reduce motion and reduce flashing drop.',
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
      callout,
    } = P
    const { top, rail, listRow, search, lanes, ruler, stepperV, mono } = Q
    const CH = ['visual', 'audio', 'camera', 'ui', 'haptic']
    const CC = {
      visual: 'layer/sky',
      audio: 'layer/intgrid',
      camera: 'layer/city',
      ui: 'layer/tiles',
      haptic: 'layer/entities',
    }
    const rows = [
      ['pickup', ['audio', 'ui']],
      ['bang', ['visual', 'audio', 'camera', 'ui', 'haptic']],
      ['catch', ['visual', 'audio', 'camera', 'ui', 'haptic']],
      ['ambush', ['visual', 'audio', 'camera', 'ui', 'haptic']],
      ['light', ['visual', 'audio', 'ui']],
      ['step', ['visual', 'audio', 'ui']],
      ['hide', ['visual', 'audio', 'ui']],
      ['save', ['audio', 'ui']],
      ['doorFollow', ['audio', 'camera', 'ui', 'haptic']],
    ]
    const dots = (have) =>
      R(
        { gap: 3 },
        CH.map((c) =>
          F({
            name: c,
            w: 8,
            h: 8,
            r: 4,
            fill: have.includes(c) ? CC[c] : null,
            stroke: have.includes(c) ? null : 'border/strong',
          }),
        ),
      )
    const panel = region(
      'events panel',
      56,
      52,
      264,
      602,
      { lay: 'col' },
      panelHead('Events', ib('plus'), ib('more')),
      R({ w: 'fill', h: 52, pad: [0, 8] }, search('Search events')),
      C(
        { w: 'fill', h: 'fill', pad: [0, 8], gap: 0, clip: true },
        rows.map(([id, have]) =>
          listRow({
            title: id,
            sub: have.length === 5 ? 'all five channels' : `${have.length} channels`,
            icon: 'bolt',
            h: 44,
            mono: true,
            sel: id === 'bang',
            color: Q.ED.feel.color,
            right: dots(have),
          }),
        ),
        R({ w: 'fill', h: 6 }),
        R({ w: 'fill', h: 28, pad: [0, 12] }, eyebrow('Without a row')),
        listRow({
          title: 'noise.bottle',
          sub: 'its sound carries it',
          icon: 'info',
          h: 44,
          mono: true,
          dim: true,
        }),
      ),
    )
    const dur = 0.8
    const W = 530
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
            { k: 'blk', t: 0, t1: 0.066, label: '' },
            { k: 'mark', t: 0.08, label: 'flash 2 f' },
          ],
        },
        { label: 'audio', h: 34, color: CC.audio, items: [{ k: 'blk', t: 0, t1: 0.6, label: 'noise.bang' }] },
        {
          label: 'camera',
          h: 34,
          color: CC.camera,
          items: [
            { k: 'blk', t: 0, t1: 0.12, label: '', sel: true },
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
    const center = region(
      'feel editor',
      320,
      52,
      554,
      602,
      { fill: 'bg/app' },
      R(
        { name: 'header', x: 12, y: 12, w: 530, h: 28, gap: 8 },
        T('bang', { style: 'Mono/12', wt: 600 }),
        pill('from noise.bang', { color: 'text/dim', mono: true }),
        spacer(),
        pill('coverage ok', { color: 'state/ok', mono: true, icon: 'check' }),
      ),
      T('The breaker blows: a 2-frame white flash on the fuse box, a 120 ms micro-shake, a low thump.', {
        x: 12,
        y: 44,
        w: 530,
        style: 'Label/12',
        color: 'text/dim',
        lh: 16,
      }),
      F(
        {
          name: 'preview',
          x: 12,
          y: 84,
          w: 530,
          h: 210,
          r: 'radius/lg',
          fill: 'bg/canvas',
          stroke: 'border/default',
          clip: true,
        },
        V(A.bayArt({ ada: [236, 150], lamp: 0.6 }), { name: 'art', x: -6, y: -3, w: 542, h: 244 }),
        F({ name: 'flash', x: 0, y: 0, w: 530, h: 210, fill: alpha('#eadbc9', 0.78) }),
        R(
          { name: 'frame chip', x: 8, y: 8, h: 26, pad: [0, 10], r: 13, fill: alpha('bg/canvas', 0.8) },
          T('frame 1 of 2 · flash 0.8', { style: 'Mono/11', color: 'text/primary' }),
        ),
      ),
      R(
        { name: 'scrub', x: 12, y: 300, w: 530, h: 44, gap: 8 },
        ib('step-back'),
        ib('play', { on: true }),
        ib('step-fwd'),
        spacer(),
        mono('0.03 / 0.80 s'),
        btn('Audition', { icon: 'speaker', kind: 'primary', h: 44 }),
      ),
      R(
        { name: 'lanes header', x: 12, y: 352, w: 530, h: 28, gap: 8 },
        eyebrow('Channels'),
        mono('what each channel does, and when'),
        spacer(),
      ),
      F(
        {
          name: 'channels',
          x: 12,
          y: 384,
          w: 530,
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
    const inspector = region(
      'inspector',
      874,
      52,
      320,
      602,
      { lay: 'col' },
      tabs([{ label: 'Effect' }, { label: 'Code' }, { label: 'Ask' }], 0),
      F({ w: 'fill', h: 1, fill: 'border/default' }),
      C(
        { name: 'fields', w: 'fill', h: 'fill', pad: 12, gap: 8, clip: true },
        R(
          { w: 'fill', h: 28, gap: 8 },
          I('sparkle', { size: 16, color: CC.visual }),
          T('visual · flash', { style: 'Title/15' }),
          spacer(),
          pill('literal', { color: 'state/ok', icon: 'check' }),
        ),
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
      ),
    )
    const dock = region(
      'accessibility',
      56,
      654,
      1138,
      180,
      { lay: 'col' },
      line(0, 0, 1138, 1),
      R(
        { name: 'header', w: 'fill', h: 52, pad: [0, 8, 0, 16], gap: 10 },
        eyebrow('Preview as a player who…'),
        seg(['Normal', 'Reduces motion', 'Reduces flashing'], 0, { w: 380 }),
        spacer(),
        pill('feel coverage ok', { color: 'state/ok', mono: true, icon: 'check' }),
        btn('Run coverage', { icon: 'check' }),
      ),
      R(
        { w: 'fill', h: 'fill', pad: [0, 16, 12, 16], gap: 10 },
        ...[
          [
            'Reduces motion',
            'Drops the camera channel and particles, and holds UI flourishes still.',
            'camera',
          ],
          [
            'Reduces flashing',
            'Drops flashes and flicker. A bang keeps its sound, its prompt pulse and its rumble.',
            'visual',
          ],
          [
            'Every row answers',
            'Audio and UI are what remain, so every row has both. A new event needs a row or a reason.',
            'audio',
          ],
        ].map(([k, v, c]) =>
          C(
            {
              w: 'fill',
              h: 'fill',
              pad: 12,
              gap: 4,
              r: 'radius/md',
              fill: 'bg/raised',
              stroke: 'border/default',
            },
            R({ gap: 8 }, F({ w: 10, h: 10, r: 5, fill: CC[c] }), T(k, { style: 'Body/13 Medium' })),
            T(v, { style: 'Label/12', color: 'text/dim', w: 'fill', lh: 16 }),
          ),
        ),
      ),
    )
    return F(
      { name: 'Feel · bang · iPad landscape', w: 1194, h: 834, fill: 'bg/app', clip: true },
      top(1194, {
        title: 'bang',
        sub: 'src/feel/effects.ts',
        ed: 'feel',
        cs: 'feel/breaker-shake',
        n: 1,
        checks: 'checks ok',
        gates: [['feel coverage', 'ok']],
      }),
      rail(782, 'feel'),
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
