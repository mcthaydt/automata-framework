// The 3D level editor mockup frames: tablet landscape (1194 x 834) and portrait (834 x 1194), built from the
// widgets in ui.mjs and the drawings in views.mjs. Each function returns a scene tree (see scene.mjs).
//
// Self-contained on purpose: the Figma kit stringifies makeScreens and runs it inside `use_figma`.
// Everything shown is the real Last Light clinic (data.mjs); the validator messages and the Ask diff are examples.

export function makeScreens(S, Ui, Vw, D) {
  const { F, row, col, spacer, T, I, alpha } = S
  const Vec = S.V
  const { W, H, TOP, STATUS, RAIL, INSP, MID, AMBER } = Ui
  // The plan's width beside the rail and the inspector, and World's beside the inspector alone (no rail there).
  const PLAN_W = W - RAIL - INSP
  const {
    dot,
    divider,
    eyebrow,
    mono,
    kv,
    iconBtn,
    button,
    chip,
    seg,
    stepper,
    slider,
    toggle,
    searchField,
    key,
  } = Ui
  const { tile, toolRail, topBar, statusLine, section, inspector, layersSection } = Ui
  const { planView, dollView, walkView, floating, vpTag, vpControls, scaleBar } = Ui
  const clinic = D.scenes.clinic
  const hall = clinic.rooms.find((r) => r.id === 'hall')
  const areaOf = (pts) => {
    let a = 0
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i]
      const q = pts[(i + 1) % pts.length]
      a += p[0] * q[1] - q[0] * p[1]
    }
    return Math.abs(a / 2)
  }
  const m2 = (n) => n.toFixed(2)
  const hasFlag = (p, f) => (p[2] || '').includes(f)
  const IW = INSP - 32

  const shell = (name, bar, middle, status) =>
    F(
      { name, w: W, h: H, fill: 'bg/app', lay: 'col' },
      topBar({ w: W, ...bar }),
      row({ name: 'Workspace', w: W, h: MID, ay: 'start' }, ...middle),
      statusLine(W, status.items, status.hint),
    )

  // ── Shared inspector content ──
  const sectorCard = () =>
    col(
      { name: 'Selection · sector', w: INSP, pad: [12, 16], gap: 12 },
      eyebrow('Sector'),
      row(
        { w: IW, gap: 8 },
        F({ name: 'swatch', w: 14, h: 14, r: 3, fill: 'ent/wall' }),
        T('hall', { style: 'Title/15', w: 'fill' }),
        chip('clinic', { dot: 'ent/zone' }),
      ),
      mono(
        `${hall.pts.length} corners · ${hall.pts.filter((p) => hasFlag(p, 'p')).length} portals · ${areaOf(hall.pts).toFixed(1)} m²`,
      ),
      row(
        { w: IW, gap: 8 },
        stepper('Floor', m2(hall.f), 'm', 128),
        stepper('Ceiling', m2(hall.c), 'm', 128),
      ),
      slider('Light', 0.6, '0.60', IW),
      row(
        { w: IW, gap: 8, ay: 'start' },
        tile(6, 56, { label: 'floor' }),
        tile(0, 56, { label: 'walls' }),
        tile(5, 56, { label: 'ceiling' }),
        spacer(),
      ),
      row(
        { w: IW, gap: 6 },
        iconBtn('split', { w: 62, fill: 'bg/raised', stroke: 'border/default' }),
        iconBtn('layers', { w: 62, fill: 'bg/raised', stroke: 'border/default' }),
        iconBtn('copy', { w: 62, fill: 'bg/raised', stroke: 'border/default' }),
        iconBtn('trash', { w: 62, fill: 'bg/raised', stroke: 'border/default', color: 'state/bad' }),
      ),
    )

  // ── 1. Split: plan and 3D together ──
  const split = () => {
    const plan = planView(
      { w: 439, h: MID, cx: -0.15, cz: 0, ppm: 40, sel: ['hall'], name: 'Plan viewport' },
      vpTag('Plan', '40 px/m · grid 0.5 m'),
      vpControls(439, ['fit', 'grid', 'magnet'], ['grid', 'magnet']),
      scaleBar(12, MID - 34, 160, '4 m'),
    ).node
    const doll = dollView(
      { w: 394, h: MID, cx: 0, cz: 0.3, s: 28, dy: 50, sel: 'hall', name: '3D viewport' },
      vpTag('3D', 'orbit · pitch 30°'),
      vpControls(394, ['fit', 'layers'], []),
      floating(
        { name: 'camera mode', x: 72, y: MID - 68, pad: 2 },
        seg(
          [
            ['orbit', 'Orbit', 'orbit'],
            ['walk', 'Walk', 'walk'],
            ['game', 'Game cam', 'camera'],
          ],
          'orbit',
          { pad: 10 },
        ),
      ),
    )
    return shell(
      'Split · landscape',
      { mode: 'split', warns: 1 },
      [
        toolRail(MID, 'select'),
        plan,
        F({ name: 'divider', w: 1, h: MID, fill: 'border/default' }),
        doll,
        inspector(MID, layersSection({ active: 'Sectors' }), divider(), sectorCard()),
      ],
      {
        items: [
          ['x', '-1.60'],
          ['z', '1.40'],
          ['sector', 'hall'],
          ['F', '0.00'],
          ['C', '4.90'],
          ['grid', '0.50 m'],
          ['snap', 'on', 'state/ok'],
        ],
        hint: 'Select · tap a sector, drag to move · two fingers pan and zoom',
      },
    )
  }

  // ── 2. Draw: the sector tool, with Pencil precision aids ──
  const draw = () => {
    const pts = [
      [-4.875, -3.8],
      [-4.875, -6.8],
      [-1.9, -6.8],
    ]
    const cur = [-1.9, -3.8]
    const dim = (x, y, text) =>
      row(
        { name: 'length', x, y, h: 22, pad: [0, 7], r: 5, fill: alpha('bg/app', 0.88), stroke: AMBER },
        T(text, { style: 'Mono/11', color: AMBER }),
      )
    const loupe = (x, y) => {
      const g = `<path d="M35 0V140M0 35H140M105 0V140M0 105H140" stroke="#ffffff" stroke-opacity=".07"/><path d="M70 0V140M0 70H140" stroke="#ffffff" stroke-opacity=".12"/>`
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="140" height="140" viewBox="0 0 140 140">${g}<path d="M0 70H70V140" stroke="#cfd3dc" stroke-width="3" fill="none"/><path d="M70 70V0" stroke="#e0a54a" stroke-width="3" fill="none"/><path d="M0 70H70" stroke="#e0a54a" stroke-width="2" stroke-dasharray="5 4" fill="none"/><circle cx="70" cy="70" r="13" fill="none" stroke="#4fd1c5" stroke-width="2"/><rect x="64" y="64" width="12" height="12" fill="#e8e6e1" stroke="#e0a54a" stroke-width="2.5"/></svg>`
      return F(
        { name: 'loupe', x, y, w: 140, h: 164 },
        F(
          {
            name: 'lens',
            w: 140,
            h: 140,
            r: 70,
            clip: true,
            fill: 'view/plan',
            stroke: AMBER,
            sw: 2,
            shadow: 'pop',
          },
          Vec(svg, { w: 140, h: 140 }),
        ),
        row(
          {
            x: 15,
            y: 144,
            w: 110,
            h: 22,
            ax: 'center',
            r: 5,
            fill: alpha('bg/app', 0.9),
            stroke: 'border/default',
          },
          T('snap · vertex', { style: 'Mono/11', color: 'ent/nav' }),
        ),
      )
    }
    const nudge = (x, y) =>
      floating(
        { name: 'nudge pad', x, y, w: 148, h: 148, r: 74, shadow: 'pop' },
        F(
          { name: 'pad', w: 148, h: 148 },
          F({ x: 52, y: 6, w: 44, h: 44 }, iconBtn('arrow-up', { size: 20 })),
          F({ x: 52, y: 98, w: 44, h: 44 }, iconBtn('arrow-down', { size: 20 })),
          F({ x: 6, y: 52, w: 44, h: 44 }, iconBtn('chevron-left', { size: 20 })),
          F({ x: 98, y: 52, w: 44, h: 44 }, iconBtn('chevron-right', { size: 20 })),
          F(
            { x: 54, y: 54, w: 40, h: 40, r: 20, fill: AMBER, lay: 'row', ax: 'center', ay: 'center' },
            I('check', { size: 20, color: 'accent/ink' }),
          ),
        ),
      )
    const toolbar = floating(
      { name: 'sector tool options', x: 97, y: 12, h: 56, pad: [0, 6], gap: 8 },
      seg(
        [
          ['poly', 'Polygon', 'polygon'],
          ['rect', 'Rectangle', 'plan'],
          ['split', 'Split', 'split'],
          ['merge', 'Merge', 'layers'],
        ],
        'poly',
        { pad: 10 },
      ),
      chip('Grid 0.25 m', { icon: 'grid' }),
      chip('Snap', { icon: 'magnet', on: true }),
      chip('F 0.00 · C 4.90', { mono: true }),
    )
    const actions = floating(
      { name: 'draw actions', x: 242, y: MID - 12 - 60, h: 60, pad: [0, 6], gap: 8 },
      button('Undo point', { icon: 'undo' }),
      button('Close sector', { kind: 'primary', icon: 'check', h: 48 }),
    )
    const plan = planView(
      {
        w: PLAN_W,
        h: MID,
        cx: -2.4,
        cz: -3.4,
        ppm: 64,
        draft: { pts, cursor: cur },
        rulers: true,
        name: 'Plan viewport',
      },
      (p) => dim(p.X(-3.39) - 30, p.Y(-6.8) - 34, '2.98 m'),
      (p) => dim(p.X(-4.875) - 74, p.Y(-5.3) - 11, '3.00 m'),
      (p) =>
        floating(
          {
            name: 'shared wall hint',
            x: p.X(-3.4) - 84,
            y: p.Y(-3.8) + 12,
            h: 28,
            pad: [0, 10],
            gap: 6,
            r: 14,
          },
          I('portal', { size: 14, color: 'ent/portal' }),
          T('shares a wall with ward · portal?', { style: 'Mono/11', color: 'text/dim' }),
        ),
      (p) => loupe(p.X(-1.9) + 56, p.Y(-3.8) - 214),
      nudge(PLAN_W - 12 - 148, MID - 12 - 148),
      toolbar,
      actions,
    ).node
    const point = (i, p, len) =>
      row(
        { name: `point/${i}`, w: IW, h: 36, gap: 8 },
        F(
          {
            w: 20,
            h: 20,
            r: 10,
            fill: i === pts.length ? AMBER : 'bg/raised',
            stroke: 'border/strong',
            lay: 'row',
            ax: 'center',
            ay: 'center',
          },
          T(String(i), { style: 'Mono/11', color: i === pts.length ? 'accent/ink' : 'text/dim' }),
        ),
        mono(`${p[0].toFixed(3)}, ${p[1].toFixed(3)}`, { color: 'text/primary', w: 'fill' }),
        mono(len),
      )
    return shell(
      'Draw sector · landscape',
      { mode: 'plan', warns: 0 },
      [
        toolRail(MID, 'sector'),
        plan,
        inspector(
          MID,
          section(
            'New sector',
            INSP,
            row(
              { w: IW, h: 44, pad: [0, 12], r: 'radius/md', fill: 'bg/field', stroke: 'border/default' },
              T('sector 8', { style: 'Body/13', w: 'fill' }),
              I('pencil', { size: 16, color: 'text/faint' }),
            ),
            eyebrow('Points', { color: 'text/faint' }),
            point(1, pts[0], ''),
            point(2, pts[1], '3.00 m'),
            point(3, pts[2], '2.98 m'),
            row(
              { w: IW, h: 36, gap: 8 },
              F({ w: 20, h: 20, r: 10, stroke: AMBER, dash: [3, 3] }),
              mono('cursor → closes the sector', { color: 'text/faint', w: 'fill' }),
            ),
          ),
          divider(),
          section(
            'Heights · inherited from ward',
            INSP,
            row({ w: IW, gap: 8 }, stepper('Floor', '0.00', 'm', 128), stepper('Ceiling', '4.90', 'm', 128)),
            toggle('Rectilinear snap', true, IW),
            toggle('Portal to neighbours', true, IW),
          ),
          divider(),
          section(
            'Checks on close',
            INSP,
            ...[
              ['No overlap with other sectors', true],
              ['Corners wind the same way', true],
              ['Portal has a reverse', true],
            ].map(([t, ok]) =>
              row(
                { w: IW, h: 28, gap: 8 },
                I('check', { size: 16, color: ok ? 'state/ok' : 'state/warn' }),
                T(t, { style: 'Label/12', color: 'text/dim' }),
              ),
            ),
          ),
        ),
      ],
      {
        items: [
          ['x', '-1.90'],
          ['z', '-3.80'],
          ['snap', 'vertex ward.1', 'ent/nav'],
          ['edge', '2.98 m'],
          ['points', '3'],
          ['grid', '0.25 m'],
        ],
        hint: 'Sector · tap to place a point · tap the first point or Close to finish',
      },
    )
  }

  // ── 3. Walk: first person, with sticks, minimap and a wall selected ──
  const stick = (x, y, label, knob) =>
    F(
      { name: `stick/${label}`, x, y, w: 132, h: 156 },
      F({
        name: 'base',
        w: 132,
        h: 132,
        r: 66,
        fill: alpha('bg/app', 0.5),
        stroke: alpha('text/primary', 0.3),
      }),
      F({
        name: 'knob',
        x: knob[0],
        y: knob[1],
        w: 56,
        h: 56,
        r: 28,
        fill: alpha(AMBER, 0.3),
        stroke: AMBER,
        sw: 2,
      }),
      F({ x: 59, y: 8, w: 14, h: 14 }, I('chevron-up', { size: 14, color: 'text/faint' })),
      F({ x: 59, y: 110, w: 14, h: 14 }, I('chevron-down', { size: 14, color: 'text/faint' })),
      row(
        { name: 'label', x: 36, y: 136, w: 60, h: 20, ax: 'center', r: 10, fill: alpha('bg/app', 0.72) },
        mono(label),
      ),
    )
  const walk = () => {
    const w = PLAN_W
    const mini = planView({
      w: 176,
      h: 176,
      cx: 0,
      cz: 1.4,
      ppm: 11,
      cam: { x: 0, z: 3.8, yaw: 0 },
      layers: { nav: false, hot: false, lamps: false, boxes: false, labels: false, verts: false },
      name: 'minimap',
    }).node
    const view = walkView(
      {
        w,
        h: MID,
        cam: { x: 0, y: 1.6, z: 3.8, yaw: 0 },
        sel: { room: 'hall', edge: 4 },
        name: '3D viewport',
      },
      vpTag('Walk', 'eye 1.60 m · fov 69°'),
      F(
        {
          name: 'minimap frame',
          x: w - 12 - 176,
          y: 12,
          w: 176,
          h: 176,
          r: 12,
          clip: true,
          stroke: 'border/strong',
          shadow: 'card',
        },
        mini,
      ),
      floating(
        { name: 'selection chip', x: 262, y: 12, h: 36, pad: [0, 14], gap: 8, r: 18 },
        dot(AMBER, 8),
        T('hall · wall 4', { style: 'Label/12', color: AMBER }),
        mono('solid · 2.88 m'),
      ),
      F(
        { name: 'crosshair', x: w / 2 - 10, y: MID / 2 - 10, w: 20, h: 20 },
        F({ x: 9, y: 0, w: 2, h: 20, fill: alpha('text/primary', 0.6) }),
        F({ x: 0, y: 9, w: 20, h: 2, fill: alpha('text/primary', 0.6) }),
      ),
      stick(24, MID - 156 - 12, 'move', [38, 14]),
      stick(w - 24 - 132, MID - 156 - 12, 'look', [46, 44]),
      floating(
        { name: 'camera mode', x: (w - 232) / 2, y: MID - 68, pad: 2 },
        seg(
          [
            ['walk', 'Walk', 'walk'],
            ['fly', 'Fly', 'fly'],
            ['orbit', 'Orbit', 'orbit'],
          ],
          'walk',
          { pad: 10 },
        ),
      ),
      floating(
        { name: 'fly height', x: 24 + 132 + 16, y: MID - 12 - 100, w: 44, lay: 'col' },
        iconBtn('arrow-up', { size: 20, color: 'text/dim' }),
        iconBtn('arrow-down', { size: 20, color: 'text/dim' }),
      ),
    )
    const wall = hall.pts
    return shell(
      'Walk · landscape',
      { mode: '3d', warns: 1 },
      [
        toolRail(MID, 'select', Ui.WALK_TOOLS),
        view,
        inspector(
          MID,
          col(
            { name: 'Selection · wall', w: INSP, pad: [12, 16], gap: 12 },
            eyebrow('Wall'),
            row(
              { w: IW, gap: 8 },
              T('hall · wall 4', { style: 'Title/15', w: 'fill' }),
              chip('solid', { dot: 'ent/wall' }),
            ),
            mono(`(${wall[4][0]}, ${wall[4][1]}) → (${wall[5][0]}, ${wall[5][1]})`),
            seg(
              [
                ['solid', 'Solid'],
                ['portal', 'Portal'],
                ['door', 'Door'],
                ['window', 'Window'],
              ],
              'solid',
              { w: IW, pad: 4 },
            ),
            row(
              { w: IW, gap: 8 },
              stepper('Height', '4.90', 'm', 128),
              stepper('Tex scale', '1.00', '×', 128),
            ),
          ),
          divider(),
          section(
            'Material',
            INSP,
            row(
              { w: IW, gap: 12, ay: 'start' },
              tile(0, 72, { on: true }),
              col(
                { gap: 6, w: 'fill' },
                T('plaster-warm', { style: 'Title/15' }),
                mono('wall · 1 m tiles'),
                button('Change…', { icon: 'image', h: 36 }),
              ),
            ),
            slider('Brightness', 0.55, '0.55', IW),
            toggle('Hide from camera', false, IW),
            toggle('Handrail', false, IW),
          ),
          divider(),
          section(
            'Apply to',
            INSP,
            seg(
              [
                ['wall', 'This wall'],
                ['room', 'Room'],
                ['all', 'Matching'],
              ],
              'wall',
              { w: IW, pad: 4 },
            ),
          ),
        ),
      ],
      {
        items: [
          ['x', '0.00'],
          ['y', '1.60'],
          ['z', '3.80'],
          ['yaw', '0°'],
          ['sector', 'hall'],
          ['wall', '4', AMBER],
        ],
        hint: 'Walk · left stick moves, right stick looks · tap a wall to select',
      },
    )
  }

  // ── 4. World: levels, wings and phases ──
  const PHASES = D.facility.phases
  const PHASE_COLOR = ['phase/teach', 'phase/combine', 'phase/recover', 'phase/finish']
  const levelCard = (phaseIndex, on) => {
    const ph = PHASES[phaseIndex]
    const cw = 160
    const th = Vw.thumb(ph.scene, cw - 20, 132)
    return col(
      {
        name: `level/${ph.scene}`,
        w: cw,
        h: 236,
        r: 'radius/lg',
        fill: 'bg/surface',
        stroke: on ? AMBER : 'border/default',
        sw: on ? 2 : 1,
        pad: 10,
        gap: 8,
        shadow: on ? 'card' : undefined,
      },
      F(
        { name: 'thumbnail', w: cw - 20, h: 132, r: 8, fill: 'view/plan', clip: true },
        Vec(th.svg, { w: cw - 20, h: 132 }),
      ),
      T(ph.scene, { style: 'Title/15' }),
      mono(ph.name),
      row({ gap: 6 }, chip(ph.id, { dot: PHASE_COLOR[phaseIndex], mono: true })),
    )
  }
  const world = () => {
    const CW = W - INSP
    let dots = ''
    for (let y = 16; y < MID; y += 32) for (let x = 16; x < CW; x += 32) dots += `M${x} ${y}h1.6v1.6h-1.6z`
    const dotSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${CW}" height="${MID}" viewBox="0 0 ${CW} ${MID}"><path d="${dots}" fill="#ffffff" fill-opacity=".12"/></svg>`
    const wing = (x, w, name, off, ...cards) =>
      col(
        {
          name: `wing/${name}`,
          x,
          y: 64,
          w,
          h: 292,
          pad: 14,
          gap: 10,
          r: 'radius/xl',
          stroke: 'border/strong',
          dash: [6, 6],
        },
        row({ w: w - 28, gap: 8 }, eyebrow(`wing · ${name}`), spacer(), mono(off)),
        row({ gap: 12, ay: 'start' }, ...cards),
      )
    const joinLabel = (x, y, text) =>
      row(
        { name: 'join', x, y, h: 26, pad: [0, 10], gap: 6, r: 13, fill: 'bg/raised', stroke: 'ent/portal' },
        I('link', { size: 14, color: 'ent/portal' }),
        T(text, { style: 'Mono/11', color: 'text/primary' }),
      )
    const phaseBlock = (i) =>
      row(
        {
          name: `phase/${PHASES[i].id}`,
          w: 190,
          h: 64,
          r: 'radius/md',
          fill: 'bg/surface',
          stroke: 'border/default',
          clip: true,
          gap: 10,
        },
        F({ w: 5, h: 64, fill: PHASE_COLOR[i] }),
        col(
          { gap: 2, w: 'fill' },
          mono(PHASES[i].id, { color: PHASE_COLOR[i] }),
          T(PHASES[i].name, { style: 'Title/15' }),
          mono(PHASES[i].scene, { color: 'text/faint' }),
        ),
      )
    const timeline = F(
      { name: 'phase timeline', x: 24, y: 408, w: 832, h: 64 },
      ...[0, 1, 2, 3].flatMap((i) => [
        F({ x: i * 214, y: 0, w: 190, h: 64 }, phaseBlock(i)),
        i < 3
          ? F(
              { x: i * 214 + 190, y: 20, w: 24, h: 24 },
              I('chevron-right', { size: 20, color: 'text/faint' }),
            )
          : null,
      ]),
    )
    const J = D.facility.joins
    const end = (e) =>
      e.street ? `street ${e.street}` : `${e.phase} ${e.room}.${e.door || e.opening || `wall ${e.wall}`}`
    const joinsTable = col(
      {
        name: 'joins table',
        x: 24,
        y: 500,
        w: 520,
        pad: 14,
        gap: 6,
        r: 'radius/lg',
        fill: 'bg/surface',
        stroke: 'border/default',
      },
      eyebrow('Joins'),
      ...J.map((j) =>
        row(
          { name: `join/${j.id}`, w: 492, h: 30, gap: 10 },
          I('link', { size: 14, color: 'ent/portal' }),
          T(j.id, { style: 'Label/12', w: 96 }),
          mono(end(j.a), { w: 170, trunc: true }),
          I('chevron-right', { size: 14, color: 'text/faint' }),
          mono(end(j.b), { w: 'fill', trunc: true }),
        ),
      ),
    )
    const canvas = F(
      { name: 'World canvas', w: CW, h: MID, fill: 'view/plan', clip: true },
      Vec(dotSvg, { w: CW, h: MID }),
      vpTag('World', 'clinic wing · bay wing', 12, 12),
      wing(24, 532, 'clinic', '0, 0, 0 m', levelCard(0, false), levelCard(1, true), levelCard(3, false)),
      wing(640, 188, 'bay', '10.4 -1 -6.6', levelCard(2, false)),
      F({ name: 'join line', x: 556, y: 208, w: 84, h: 2, fill: 'ent/portal' }),
      joinLabel(546, 168, 'clinicDoor'),
      joinLabel(700, 372, 'shutter → street'),
      eyebrow('Phases', { x: 24, y: 380 }),
      timeline,
      joinsTable,
      vpControls(CW, ['fit', 'plus', 'minus'], []),
      floating(
        {
          name: 'level card',
          x: CW - 12 - 300,
          y: MID - 12 - 224,
          w: 300,
          lay: 'col',
          pad: 16,
          gap: 12,
          ay: 'start',
          shadow: 'pop',
        },
        row(
          { w: 268, gap: 8 },
          T('clinic', { style: 'Title/15', w: 'fill' }),
          chip('P1', { dot: 'phase/combine', mono: true }),
        ),
        mono(
          `${clinic.rooms.length} sectors · ${clinic.boxList.length} props · ${clinic.hotspots.length} hotspots · 10.1 × 13.8 m`,
          { w: 268 },
        ),
        row({ w: 268, gap: 8 }, stepper('Offset X', '0.00', 'm', 130), stepper('Offset Z', '0.00', 'm', 130)),
        row(
          { w: 268, gap: 8 },
          button('Duplicate', { icon: 'copy', w: 130 }),
          button('Open', { kind: 'primary', icon: 'chevron-right', w: 130 }),
        ),
      ),
    )
    const list = col(
      { name: 'Levels panel', w: INSP, h: MID, fill: 'bg/surface', pad: [12, 16], gap: 8 },
      eyebrow('Levels'),
      searchField('Search levels', IW),
      ...[1, 0, 2, 3].map((i) => {
        const ph = PHASES[i]
        const on = i === 1
        const th = Vw.thumb(ph.scene, 56, 44)
        return row(
          {
            name: `row/${ph.scene}`,
            w: IW,
            h: 60,
            pad: [0, 6],
            gap: 10,
            r: 'radius/md',
            fill: on ? 'accent/soft' : undefined,
            stroke: on ? AMBER : undefined,
          },
          F({ w: 56, h: 44, r: 6, fill: 'view/plan', clip: true }, Vec(th.svg, { w: 56, h: 44 })),
          col(
            { gap: 2, w: 'fill' },
            T(ph.scene, { style: 'Title/15', color: on ? AMBER : 'text/primary' }),
            mono(`${ph.id} · ${D.scenes[ph.scene].rooms.length} sectors`),
          ),
        )
      }),
      button('New level', { icon: 'plus', w: IW }),
      divider(),
      eyebrow('Facility'),
      kv('wings', '2'),
      kv('joins', String(D.facility.joins.length)),
      kv('phases', String(PHASES.length)),
    )
    return shell('World · landscape', { mode: 'plan', level: 'facility' }, [list, canvas], {
      items: [
        ['level', 'clinic'],
        ['wing', 'clinic'],
        ['phase', 'P1 Night Shift'],
        ['joins', String(D.facility.joins.length)],
      ],
      hint: 'World · drag a level to move its wing · tap a join to edit it',
    })
  }

  // ── 5. Materials: the picker, over the walk view ──
  const materials = () => {
    const base = walk()
    base.name = 'Materials · landscape'
    const SW = 760
    const SH = 560
    const cat = (name, n, on) =>
      row(
        {
          name: `category/${name}`,
          w: 144,
          h: 44,
          pad: [0, 12],
          r: 'radius/md',
          fill: on ? 'accent/soft' : undefined,
          stroke: on ? AMBER : undefined,
        },
        T(name, { style: 'Label/12', color: on ? AMBER : 'text/primary', w: 'fill' }),
        mono(String(n), { color: 'text/faint' }),
      )
    const grid = col(
      { name: 'tile grid', w: 372, pad: 16, gap: 10 },
      eyebrow('Walls · 6'),
      ...[0, 3].map((r0) =>
        row(
          { gap: 12, ay: 'start' },
          ...[0, 1, 2].map((i) => tile(r0 + i, 112, { on: r0 + i === 0, label: Ui.MATERIALS[r0 + i][0] })),
        ),
      ),
      eyebrow('Used in this level', {}),
      row({ gap: 8, ay: 'start' }, tile(0, 52), tile(6, 52), tile(4, 52), tile(7, 52), tile(10, 52)),
    )
    const preview = col(
      { name: 'preview', w: 220, pad: 16, gap: 12 },
      eyebrow('Selected'),
      tile(0, 188, { on: true }),
      T('plaster-warm', { style: 'Title/15' }),
      mono('wall · 1 m tiles · matte'),
      seg(
        [
          ['wall', 'Wall'],
          ['room', 'Room'],
          ['all', 'All'],
        ],
        'wall',
        { w: 188, pad: 4 },
      ),
      slider('Scale', 0.5, '1.00×', 188),
      slider('Brightness', 0.55, '0.55', 188),
      spacer(),
      button('Apply', { kind: 'primary', icon: 'check', h: 48, w: 188 }),
    )
    const sheet = col(
      {
        name: 'Material picker',
        x: (W - SW) / 2,
        y: (H - SH) / 2,
        w: SW,
        h: SH,
        r: 'radius/xl',
        fill: 'bg/surface',
        stroke: 'border/strong',
        shadow: 'pop',
        clip: true,
      },
      row(
        { w: SW, h: 64, pad: [0, 16], gap: 12 },
        T('Material', { style: 'Display/20' }),
        chip('hall · wall 4', { dot: 'ent/wall' }),
        spacer(),
        searchField('Search 11 materials', 240),
        iconBtn('close'),
      ),
      divider(false),
      row(
        { w: SW, h: SH - 65, ay: 'start' },
        col(
          { w: 168, h: SH - 65, pad: 12, gap: 4 },
          cat('Walls', 6, true),
          cat('Floors', 4, false),
          cat('Ceilings', 3, false),
          cat('Trim', 5, false),
          cat('Windows', 2, false),
          cat('Doors', 3, false),
        ),
        divider(true),
        grid,
        divider(true),
        preview,
      ),
    )
    base.c.push(F({ name: 'scrim', abs: true, x: 0, y: 0, w: W, h: H, fill: 'rgba(0,0,0,0.58)' }), {
      ...sheet,
      abs: true,
    })
    return base
  }

  // ── 6. Portrait: plan with the inspector as a bottom sheet ──
  const portrait = () => {
    const PW = 834
    const PH = 1194
    const vpH = PH - TOP - STATUS
    const sheetH = 440
    const strip = floating(
      { name: 'tool strip', x: 107, y: vpH - sheetH - 12 - 60, h: 60, pad: [0, 8], gap: 4 },
      Ui.TOOLS.map((t) =>
        t === '-'
          ? F({ name: 'divider', w: 1, h: 28, fill: 'border/default' })
          : iconBtn(t[1], { on: t[0] === 'select', size: 22 }),
      ),
    )
    const colW = 259
    const sheet = col(
      {
        name: 'Bottom sheet · half',
        x: 0,
        y: vpH - sheetH,
        w: PW,
        h: sheetH,
        fill: 'bg/surface',
        stroke: 'border/default',
        r: [16, 16, 0, 0],
        shadow: 'sheet',
        pad: [8, 16],
        gap: 12,
      },
      row(
        { w: PW - 32, h: 20, ax: 'center' },
        F({ name: 'handle', w: 40, h: 5, r: 3, fill: 'border/strong' }),
      ),
      row(
        { w: PW - 32, gap: 10 },
        F({ w: 14, h: 14, r: 3, fill: 'ent/wall' }),
        T('hall', { style: 'Title/15' }),
        chip('clinic', { dot: 'ent/zone' }),
        mono(`${hall.pts.length} corners · ${areaOf(hall.pts).toFixed(1)} m²`),
        spacer(),
        chip('½', { icon: 'chevron-up' }),
      ),
      seg(
        [
          ['sector', 'Sector'],
          ['walls', 'Walls'],
          ['things', 'Things'],
          ['checks', 'Checks'],
        ],
        'sector',
        { w: PW - 32, pad: 4 },
      ),
      row(
        { w: PW - 32, gap: 12 },
        stepper('Floor', '0.00', 'm', colW),
        stepper('Ceiling', '4.90', 'm', colW),
        stepper('Light', '0.60', '', colW),
      ),
      row(
        { w: PW - 32, gap: 12, ay: 'start' },
        tile(6, 64, { label: 'floor' }),
        tile(0, 64, { label: 'walls' }),
        tile(5, 64, { label: 'ceiling' }),
        spacer(),
        col(
          { gap: 8, w: 330 },
          toggle('Hide from camera', false, 330),
          toggle('Portal to neighbours', true, 330),
        ),
      ),
      row(
        { w: PW - 32, gap: 8 },
        button('Split', { icon: 'split', w: 194 }),
        button('Merge', { icon: 'layers', w: 194 }),
        button('Duplicate', { icon: 'copy', w: 194 }),
        button('Delete', { icon: 'trash', w: 190, color: 'state/bad' }),
      ),
    )
    const plan = planView(
      { w: PW, h: vpH, cx: -0.15, cz: 8.3, ppm: 40, sel: ['hall'], name: 'Plan viewport' },
      vpTag('Plan', '40 px/m'),
      vpControls(PW, ['fit', 'grid', 'magnet', 'layers'], ['grid', 'magnet']),
      strip,
      sheet,
    ).node
    return F(
      { name: 'Portrait · 834×1194', w: PW, h: PH, fill: 'bg/app', lay: 'col' },
      topBar({ w: PW, compact: true, mode: 'plan', warns: 1 }),
      plan,
      statusLine(
        PW,
        [
          ['x', '-1.60'],
          ['z', '1.40'],
          ['sector', 'hall'],
          ['snap', 'on', 'state/ok'],
        ],
        'Sheet: drag the handle for peek · half · full',
      ),
    )
  }

  // ── 7. Gestures, Pencil and keys ──
  const glyph = (kind) => {
    const A = '#e0a54a'
    const P = '#e8e6e1'
    const finger = (x, y) => `<circle cx="${x}" cy="${y}" r="6" fill="${P}" fill-opacity=".9"/>`
    const arrow = (d, head) =>
      `<path d="${d}" stroke="${A}" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="${head}" stroke="${A}" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`
    const bodies = {
      tap: `${finger(28, 28)}<circle cx="28" cy="28" r="16" fill="none" stroke="${A}" stroke-width="2"/>`,
      double: `${finger(28, 28)}<circle cx="28" cy="28" r="14" fill="none" stroke="${A}" stroke-width="2"/><circle cx="28" cy="28" r="22" fill="none" stroke="${A}" stroke-width="1.5" stroke-opacity=".5"/>`,
      drag: `${finger(14, 42)}${arrow('M20 36L40 16', 'M30 16H40V26')}`,
      pan: `${finger(18, 32)}${finger(34, 32)}${arrow('M14 14H42', 'M36 8l6 6-6 6')}`,
      pinch: `${finger(18, 38)}${finger(38, 18)}${arrow('M14 42L8 48', 'M8 42v6h6')}${arrow('M42 14L48 8', 'M42 8h6v6')}`,
      twist: `${finger(20, 36)}${finger(36, 20)}${arrow('M12 18A20 20 0 0 1 34 8', 'M28 4l6 4-4 6')}`,
      hold: `${finger(28, 28)}<circle cx="28" cy="28" r="20" fill="none" stroke="${A}" stroke-width="2" stroke-dasharray="6 5"/>`,
      swipe: `${finger(14, 22)}${finger(28, 22)}${finger(42, 22)}${arrow('M44 40H12', 'M18 34l-6 6 6 6')}`,
      hover: `<path d="M12 44L38 18l6 6L18 50z" fill="none" stroke="${P}" stroke-width="2"/><circle cx="14" cy="12" r="9" fill="none" stroke="#4fd1c5" stroke-width="2" stroke-dasharray="3 3"/>`,
      place: `<rect x="10" y="10" width="36" height="36" fill="none" stroke="${A}" stroke-width="2" stroke-dasharray="5 4"/><rect x="6" y="6" width="8" height="8" fill="${P}" stroke="${A}" stroke-width="2"/><rect x="42" y="6" width="8" height="8" fill="${P}" stroke="${A}" stroke-width="2"/><rect x="42" y="42" width="8" height="8" fill="${P}" stroke="${A}" stroke-width="2"/>`,
      squeeze: `<path d="M12 44L38 18l6 6L18 50z" fill="none" stroke="${P}" stroke-width="2"/><path d="M30 10c4-4 12-4 16 0M26 4c8-6 20-6 28 0" stroke="${A}" stroke-width="2" fill="none" stroke-linecap="round"/>`,
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" width="56" height="56" viewBox="0 0 56 56">${bodies[kind]}</svg>`
  }
  const gestureRow = (kind, title, text) =>
    row(
      { name: `gesture/${title}`, w: 320, gap: 14, ay: 'start' },
      F(
        { name: kind, w: 56, h: 56, r: 'radius/md', fill: 'bg/field', stroke: 'border/default', clip: true },
        Vec(glyph(kind), { w: 56, h: 56 }),
      ),
      col(
        { gap: 2, w: 'fill' },
        T(title, { style: 'Body/13 Medium' }),
        T(text, { style: 'Label/12', color: 'text/dim', w: 'fill' }),
      ),
    )
  const keyRow = (keys, text) =>
    row(
      { name: `keys/${text}`, w: 320, h: 34, gap: 6 },
      ...keys.map((k) => key(k)),
      T(text, { style: 'Label/12', color: 'text/dim', w: 'fill' }),
    )
  const column = (title, sub, ...kids) =>
    col(
      {
        name: `column/${title}`,
        w: 360,
        pad: 20,
        gap: 14,
        r: 'radius/lg',
        fill: 'bg/surface',
        stroke: 'border/default',
      },
      T(title, { style: 'Title/15' }),
      T(sub, { style: 'Label/12', color: 'text/dim', w: 320 }),
      ...kids,
    )
  const gestures = () =>
    F(
      {
        name: 'Gestures and keys · landscape',
        w: W,
        h: H,
        fill: 'bg/app',
        lay: 'col',
        pad: [28, 33],
        gap: 18,
      },
      row(
        { w: W - 66, gap: 12 },
        col(
          { gap: 4, w: 'fill' },
          eyebrow('Input · touch first'),
          T('Hands, Pencil, keyboard', { style: 'Display/20' }),
        ),
        chip('iPad Pro 11″ · Magic Keyboard', { icon: 'keyboard' }),
      ),
      row(
        { gap: 24, ay: 'start' },
        column(
          'Touch',
          'Fingers navigate and select. Nothing destructive needs a precise tap.',
          gestureRow('tap', 'Tap', 'Select. Tap empty space to deselect.'),
          gestureRow('drag', 'Drag', 'Move a sector, corner, wall or thing. Snaps to the grid.'),
          gestureRow('pan', 'Two-finger drag', 'Pan the plan. In 3D it orbits.'),
          gestureRow('pinch', 'Pinch', 'Zoom around the fingers.'),
          gestureRow('twist', 'Two-finger twist', 'Rotate the dollhouse.'),
          gestureRow('hold', 'Touch and hold', 'Context menu: split, link portal, copy, delete.'),
          gestureRow('swipe', 'Three-finger swipe', 'Undo left, redo right.'),
        ),
        column(
          'Pencil',
          'Pencil is for precision. It never pans, so a stray palm cannot move geometry.',
          gestureRow('hover', 'Hover', 'Preview the vertex, snap target and length before touching.'),
          gestureRow('place', 'Draw', 'Place sector corners. The loupe and nudge pad sit clear of the tip.'),
          gestureRow('double', 'Double-tap', 'Switch to the previous tool.'),
          gestureRow('squeeze', 'Squeeze', 'Open the tool palette at the tip.'),
        ),
        column(
          'Keyboard',
          'Every tool and mode has a key, Build-style, so a keyboard makes it fast.',
          eyebrow('Modes'),
          keyRow(['Tab'], 'Plan ↔ 3D'),
          keyRow(['1', '2', '3'], 'Plan · Split · 3D'),
          eyebrow('Tools'),
          keyRow(['V', 'S', 'X'], 'Select · Sector · Vertex'),
          keyRow(['P', 'D', 'N'], 'Portal · Door · Window'),
          keyRow(['B', 'H', 'L'], 'Prop · Hotspot · Lamp'),
          eyebrow('Walk'),
          keyRow(['W', 'A', 'S', 'D'], 'Move · ⇧ run'),
          keyRow(['Q', 'E'], 'Down · up (fly)'),
          eyebrow('Edit'),
          keyRow(['⌘', 'Z'], 'Undo · ⇧ redo'),
          keyRow(['⌥', 'tap'], 'Pick material'),
        ),
      ),
    )

  // ── 8. Checks and Ask ──
  const checks = () => {
    const issue = (n, kind, rule, text) =>
      col(
        { name: `issue/${n}`, w: IW, gap: 6 },
        row(
          { w: IW, gap: 8 },
          F(
            {
              w: 20,
              h: 20,
              r: 10,
              fill: kind === 'bad' ? 'state/bad' : 'state/warn',
              lay: 'row',
              ax: 'center',
              ay: 'center',
            },
            T(String(n), { style: 'Mono/11', color: 'accent/ink' }),
          ),
          mono(rule, { color: kind === 'bad' ? 'state/bad' : 'state/warn' }),
        ),
        T(text, { style: 'Body/13', w: IW }),
        row(
          { w: IW, gap: 8 },
          button('Locate', { h: 36, icon: 'crosshair' }),
          button('Fix…', { h: 36, icon: 'sparkle' }),
        ),
      )
    const ringAt = (p, x, z, color, label) =>
      F(
        { name: `marker/${label}`, x: p.X(x) - 16, y: p.Y(z) - 16, w: 32, h: 32 },
        F({ w: 32, h: 32, r: 16, stroke: color, sw: 2.5, fill: alpha(color, 0.18) }),
        row(
          { x: 24, y: -10, w: 20, h: 20, ax: 'center', r: 10, fill: color },
          T(label, { style: 'Mono/11', color: 'accent/ink' }),
        ),
      )
    const wallMark = (p, x0, z0, x1, z1, color, label) => {
      const vertical = x0 === x1
      return F({
        name: `segment/${label}`,
        x: p.X(Math.min(x0, x1)) - (vertical ? 2 : 0),
        y: p.Y(Math.min(z0, z1)) - (vertical ? 0 : 2),
        w: vertical ? 4 : Math.abs(p.X(x1) - p.X(x0)),
        h: vertical ? Math.abs(p.Y(z1) - p.Y(z0)) : 4,
        fill: color,
        r: 2,
      })
    }
    const plan = planView(
      { w: PLAN_W, h: MID, cx: -0.15, cz: 1.0, ppm: 46, name: 'Plan viewport' },
      (p) => wallMark(p, -1.9, -3.8, -1.9, -0.875, 'state/bad', '1'),
      (p) =>
        F(
          { name: 'issue 1', x: p.X(-1.9) + 10, y: p.Y(-2.3) - 10, w: 20, h: 20 },
          row(
            { w: 20, h: 20, ax: 'center', r: 10, fill: 'state/bad' },
            T('1', { style: 'Mono/11', color: 'accent/ink' }),
          ),
        ),
      (p) => wallMark(p, 1.725, -6.375, 1.725, -2.625, 'state/bad', '2'),
      (p) =>
        F(
          { name: 'issue 2', x: p.X(1.725) + 10, y: p.Y(-5.2) - 10, w: 20, h: 20 },
          row(
            { w: 20, h: 20, ax: 'center', r: 10, fill: 'state/bad' },
            T('2', { style: 'Mono/11', color: 'accent/ink' }),
          ),
        ),
      (p) => ringAt(p, -2.4, -3.3, 'state/warn', '3'),
      (p) =>
        F({
          name: 'ghost window',
          x: p.X(-1),
          y: p.Y(6.875) - 7,
          w: 2 * 46,
          h: 14,
          r: 3,
          fill: alpha(AMBER, 0.28),
          stroke: AMBER,
          sw: 2,
          dash: [5, 3],
        }),
      (p) =>
        row(
          {
            name: 'ghost label',
            x: p.X(-1) - 14,
            y: p.Y(6.875) - 44,
            h: 26,
            pad: [0, 10],
            gap: 6,
            r: 13,
            fill: alpha('bg/app', 0.9),
            stroke: AMBER,
          },
          I('window', { size: 14, color: AMBER }),
          T('+ window · 2.00 m · hall.wall 6', { style: 'Mono/11', color: AMBER }),
        ),
      vpTag('Plan', 'checks · ask preview'),
      floating(
        { name: 'ask decision', x: PLAN_W / 2 - 150, y: MID - 12 - 60, h: 60, pad: [0, 10], gap: 8 },
        I('sparkle', { size: 18, color: AMBER }),
        mono('1 change', { color: 'text/primary' }),
        button('Reject', { icon: 'close' }),
        button('Accept', { kind: 'primary', icon: 'check', h: 48 }),
      ),
    ).node
    return shell(
      'Checks and Ask · landscape',
      { mode: 'plan', errors: 2, warns: 1 },
      [
        toolRail(MID, 'select'),
        plan,
        inspector(
          MID,
          section(
            'Checks · 2 errors, 1 warning',
            INSP,
            issue(1, 'bad', 'portal-reverse', 'ward → hall has no reverse portal over the same segment.'),
            issue(
              2,
              'bad',
              'shared-wall',
              'closet.wall 4 and doorway.wall 1 are two solid walls on one line.',
            ),
            issue(3, 'warn', 'hotspot-reach', "Hotspot 'monitor' cannot be reached from spawn along nav."),
            row(
              { w: IW, gap: 8 },
              I('check', { size: 16, color: 'state/ok' }),
              T('9 more rules pass', { style: 'Label/12', color: 'text/dim' }),
            ),
          ),
          divider(),
          section(
            'Ask Claude',
            INSP,
            col(
              { w: IW, pad: 12, gap: 8, r: 'radius/md', fill: 'bg/field', stroke: 'border/default' },
              T('Add a window on the hall’s south wall, centred, 2 m wide.', {
                style: 'Body/13',
                w: IW - 24,
              }),
              row(
                { w: IW - 24, gap: 6 },
                chip('hall.wall 6', { mono: true }),
                spacer(),
                mono('2.1k / 8k tokens'),
              ),
            ),
            F(
              { name: 'token meter', w: IW, h: 4, r: 2, fill: 'bg/field' },
              F({ w: Math.round(IW * 0.26), h: 4, r: 2, fill: AMBER }),
            ),
            eyebrow('Proposed change'),
            ...[
              ['+', 'window on hall.wall 6', 'state/ok'],
              ['~', 'at 2.0 m, width 2.00 m', 'text/dim'],
              ['~', 'docs/art/blockout-clinic/blockout.json', 'text/dim'],
            ].map(([sign, text, c]) =>
              row(
                { w: IW, gap: 8 },
                mono(sign, { color: c }),
                mono(text, { color: 'text/primary', w: 'fill', trunc: true }),
              ),
            ),
          ),
        ),
      ],
      {
        items: [
          ['errors', '2', 'state/bad'],
          ['warnings', '1', 'state/warn'],
          ['change set', 'edit/clinic-ward-door'],
          ['ask', '1 pending', AMBER],
        ],
        hint: 'Nothing is written until checks pass and you accept',
      },
    )
  }

  // ── 9. Concept ──
  const concept = () => {
    const pw = 354
    const ph = 330
    const card = (title, text, view) =>
      col(
        { name: `preview/${title}`, w: pw, gap: 10 },
        F(
          {
            name: 'frame',
            w: pw,
            h: ph,
            r: 'radius/lg',
            clip: true,
            stroke: 'border/strong',
            fill: 'view/plan',
          },
          view,
        ),
        row({ w: pw, gap: 8 }, T(title, { style: 'Title/15' })),
        T(text, { style: 'Label/12', color: 'text/dim', w: pw }),
      )
    const principle = (icon, title, text) =>
      row(
        {
          name: `principle/${title}`,
          w: 262,
          gap: 12,
          pad: 14,
          r: 'radius/lg',
          fill: 'bg/surface',
          stroke: 'border/default',
          ay: 'start',
        },
        I(icon, { size: 22, color: AMBER }),
        col(
          { gap: 2, w: 'fill' },
          T(title, { style: 'Body/13 Medium' }),
          T(text, { style: 'Label/12', color: 'text/dim', w: 'fill' }),
        ),
      )
    const miniPlan = planView({
      w: pw,
      h: ph,
      cx: -0.15,
      cz: 0,
      ppm: 22,
      sel: ['hall'],
      layers: { labels: false, nav: false, hot: false },
      name: 'plan',
    }).node
    const miniDoll = dollView({ w: pw, h: ph, cx: 0, cz: 0.3, s: 19, dy: 30, sel: 'hall', name: 'doll' })
    const miniWalk = walkView({
      w: pw,
      h: ph,
      cam: { x: 0, y: 1.6, z: 3.8, yaw: 0 },
      sel: { room: 'hall', edge: 4 },
      name: 'walk',
    })
    return F(
      { name: 'Concept · landscape', w: W, h: H, fill: 'bg/app', lay: 'col', pad: [36, 40], gap: 18 },
      row(
        { w: W - 80 },
        eyebrow('Automata · 3D level editor · mockups'),
        spacer(),
        mono('iPad 11″ landscape · 1194 × 834'),
      ),
      col(
        { gap: 8 },
        T('LDtk × Build', { size: 52, wt: 600, lh: 58 }),
        T(
          'Draw sectors the way Build did. Organise levels the way LDtk does. On an iPad, with a Pencil, and the real game one tap away.',
          { size: 17, color: 'text/dim', w: 720, lh: 25 },
        ),
      ),
      row(
        { gap: 24, ay: 'start' },
        card(
          'Plan',
          'Sectors, portals, doors and things at grid precision. The only view that can draw.',
          miniPlan,
        ),
        card('Split', 'Plan and 3D at once. Select in one, see it in the other, edit either.', miniDoll),
        card('Walk', 'Stand inside the room. Tap a wall to retexture, resize or open it.', miniWalk),
      ),
      row(
        { gap: 12, ay: 'start' },
        principle('layers', 'Layers like LDtk', 'Sectors, walls, props, hotspots, lamps, nav, zones.'),
        principle('polygon', 'Sectors like Build', 'Rooms, portals, floor and ceiling heights, in metres.'),
        principle('check', 'Checked before saved', 'The game’s validator runs on every change.'),
        principle('sparkle', 'Claude as a tool', 'Ask for a change, review the diff, accept or reject.'),
      ),
    )
  }

  // ── 10. Foundations: tokens and components in use ──
  const foundations = () => {
    const sw = (token, label, w = 58) =>
      col(
        { name: `swatch/${token}`, w, gap: 4 },
        F({ w, h: 40, r: 6, fill: token, stroke: 'border/strong' }),
        mono(label || token.split('/')[1], { w, trunc: true }),
      )
    const block = (title, ...kids) =>
      col(
        {
          name: `block/${title}`,
          w: 360,
          pad: 16,
          gap: 12,
          r: 'radius/lg',
          fill: 'bg/surface',
          stroke: 'border/default',
        },
        eyebrow(title),
        ...kids,
      )
    const wrap = (...kids) => row({ gap: 6, ay: 'start' }, ...kids)
    const TY = [
      ['Display/20', 'Display 20 · 600'],
      ['Title/15', 'Title 15 · 600'],
      ['Body/13', 'Body 13 · 400'],
      ['Label/12', 'Label 12 · 500'],
      ['Eyebrow/11', 'EYEBROW 11 · 600'],
      ['Mono/12', 'Mono 12 · x -1.60 z 1.40'],
    ]
    const ent = [
      'wall',
      'portal',
      'door',
      'window',
      'hotspot',
      'lamp',
      'spawn',
      'anchor',
      'nav',
      'zone',
      'box',
    ]
    return F(
      { name: 'Foundations · landscape', w: W, h: H, fill: 'bg/app', lay: 'col', pad: [28, 33], gap: 16 },
      row(
        { w: W - 66 },
        col(
          { gap: 4, w: 'fill' },
          eyebrow('Foundations'),
          T('Editor Kit, plus the 3D entity colours', { style: 'Display/20' }),
        ),
        chip('44 px touch · 48 px primary', { icon: 'hand' }),
      ),
      row(
        { gap: 16, ay: 'start' },
        col(
          { gap: 16, w: 360 },
          block(
            'Surfaces',
            wrap(sw('bg/app'), sw('bg/surface'), sw('bg/raised'), sw('bg/field'), sw('bg/canvas')),
          ),
          block(
            'Text and accent',
            wrap(
              sw('text/primary'),
              sw('text/dim'),
              sw('text/faint'),
              sw('accent/default', 'accent'),
              sw('accent/soft', 'soft'),
            ),
          ),
          block(
            'State',
            wrap(
              sw('state/ok'),
              sw('state/warn'),
              sw('state/bad'),
              sw('border/default', 'border'),
              sw('border/strong', 'strong'),
            ),
          ),
          block(
            '3D entities',
            row({ gap: 6, ay: 'start' }, ...ent.slice(0, 6).map((e) => sw(`ent/${e}`, e, 48))),
            row({ gap: 6, ay: 'start' }, ...ent.slice(6).map((e) => sw(`ent/${e}`, e, 48))),
          ),
        ),
        col(
          { gap: 16, w: 360 },
          block('Type · IBM Plex', ...TY.map(([style, text]) => T(text, { style }))),
          block(
            'Layers and tools',
            row(
              { gap: 8, ay: 'start' },
              Ui.railBtn('polygon', 'Sector', true),
              Ui.railBtn('vertex', 'Vertex', false),
              Ui.railBtn('portal', 'Portal', false),
            ),
            layersSection({
              active: 'Props',
              hidden: ['Zones'],
              only: ['Sectors', 'Props', 'Lamps', 'Zones'],
            }),
          ),
        ),
        col(
          { gap: 16, w: 390 },
          block(
            'Buttons',
            wrap(
              button('Accept', { kind: 'primary', icon: 'check', h: 48 }),
              button('Reject', { icon: 'close' }),
              button('More', { kind: 'ghost' }),
            ),
          ),
          block(
            'Chips and segments',
            wrap(
              chip('clinic', { dot: 'ent/zone' }),
              chip('Snap', { icon: 'magnet', on: true }),
              chip('P1', { mono: true }),
            ),
            seg(
              [
                ['plan', 'Plan', 'plan'],
                ['split', 'Split', 'split'],
                ['3d', '3D', 'cube'],
              ],
              'split',
            ),
          ),
          block(
            'Fields',
            wrap(stepper('Floor', '0.00', 'm', 150), stepper('Ceiling', '4.90', 'm', 150)),
            slider('Light', 0.6, '0.60', 326),
            toggle('Rectilinear snap', true, 326),
          ),
          block(
            'Materials',
            wrap(tile(0, 56, { on: true }), tile(2, 56), tile(3, 56), tile(6, 56), tile(8, 56)),
          ),
        ),
      ),
    )
  }

  return { concept, foundations, split, draw, walk, world, materials, portrait, gestures, checks }
}
