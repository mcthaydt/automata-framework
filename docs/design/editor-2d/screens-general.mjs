// Screens for the general 2D editor: Home, the Level view for a platformer and for a top-down RPG (the same panel,
// toolbar, palette and inspector), Tilesets with auto-tile rules, Entity definitions, the World map, and the states
// every profile shares (Checks, Export, Recover, Open failed). Mossgate (platformer) and Hollowmere (RPG) are
// illustrative; nothing here is output of the real editor.
// Each `build(S, P)` returns one scene tree (see ../editor-kit/scene). Builders are self-contained functions of the
// kit `S` and the parts `P` (parts.mjs), so build.mjs can render the same source to HTML and to Figma.

export const screens = []

// ── Level · platformer ──
screens.push({
  id: 'level-platformer',
  page: '2D · Level',
  name: 'Level · Mossgate · Moss Steps · iPad landscape',
  w: 1194,
  h: 834,
  note: 'A platformer level in the general editor. The Collision IntGrid is the selected layer, so its values show over the tiles and its palette fills the panel; the Ground layer is an auto-layer that turns those cells into edges, corners and moss. A patrolling slime is selected: its typed fields, including a list of path points, come from its entity definition.',
  build: (S, P) => {
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
      field,
      tabs,
      panelHead,
      rail,
      topbar,
      NAV,
      toolbar,
      layerRowG,
      valueRow,
      fieldRow,
      colorBox,
      pointList,
      entityHead,
      levelDock,
      miniPlatform,
      PLAT,
      platformerArt,
      sprite,
      pathOver,
      selection,
      chip,
    } = P
    const s = PLAT.s
    const ox = 14
    const oy = 79
    const cx = (c) => ox + c * s
    const cy = (r) => oy + r * s

    const panel = region(
      'level panel',
      56,
      52,
      264,
      634,
      { lay: 'col' },
      panelHead('Layers', ib('plus')),
      C(
        { w: 'fill', pad: [0, 8], gap: 2 },
        layerRowG('box', 'Entities', 'Entities · 6 defs', 'layer/entities'),
        layerRowG('tile', 'Decor', 'Tiles · moss-terrain', 'layer/tiles'),
        layerRowG('sparkle', 'Ground', 'Auto · 47 rules', 'layer/city', { locked: true }),
        layerRowG('grid', 'Collision', 'IntGrid · 5 values', 'layer/intgrid', { sel: true }),
      ),
      R(
        { w: 'fill', h: 40, pad: [8, 16, 0, 16] },
        eyebrow('Collision values'),
        spacer(),
        T('overlay on', { style: 'Mono/11', color: 'text/faint' }),
      ),
      C(
        { name: 'values', w: 'fill', pad: [0, 8], gap: 2 },
        valueRow({ id: 'solid', value: 1, color: '#e0645a', sub: 'blocks from every side' }, { sel: true }),
        valueRow({ id: 'one-way', value: 2, color: '#e0a54a', sub: 'stand on from above' }),
        valueRow({ id: 'spike', value: 3, color: '#c04a8a', sub: 'hurts on touch' }),
        valueRow({ id: 'water', value: 4, color: '#4a9ae0', sub: 'swim' }),
        valueRow({ id: 'ladder', value: 5, color: '#5fbf7a', sub: 'climb' }),
      ),
    )

    const ex = cx(5) + 1
    const ey = cy(15)
    const canvas = region(
      'canvas',
      320,
      52,
      554,
      634,
      { fill: 'bg/canvas' },
      F({
        name: 'level bounds',
        x: ox - 1,
        y: oy - 1,
        w: 600,
        h: 530,
        stroke: alpha('accent/default', 0.45),
        sw: 1,
      }),
      V(platformerArt({ intgrid: true }), { name: 'level', x: ox, y: oy, w: 576, h: 528 }),
      sprite.player(cx(4) + 4, cy(19)),
      sprite.flag(cx(14) + 1, cy(19)),
      sprite.slime(cx(13) + 1, cy(12)),
      sprite.slime(ex, ey),
      ...[
        [4, 12],
        [6, 12],
        [12, 10],
        [14, 10],
        [19, 7],
        [21, 7],
      ].map(([c, r]) => sprite.coin(cx(c) + 6, cy(r) + 6)),
      sprite.door(cx(9) - 2, cy(6)),
      ...pathOver(
        [
          [cx(4) + 12, cy(15) - 8],
          [cx(8) + 12, cy(15) - 8],
        ],
        554,
        634,
        '#e0a54a',
      ),
      ...selection(ex - 4, ey - 21, 30, 25),
      R(
        { name: 'entity tag', x: ex + 34, y: ey - 48, h: 22, pad: [0, 8], r: 6, fill: 'accent/default' },
        T('slime · 5, 14', { style: 'Mono/11', color: 'accent/ink', wt: 600 }),
      ),
      toolbar(554, 1),
      chip(8, 598, 'magnet', 'snap · 16 px', { name: 'grid chip' }),
      chip(142, 598, 'search', '150%', { name: 'zoom chip' }),
      chip(326, 598, 'pencil', 'Pencil draws · finger pans', { name: 'input chip' }),
    )

    const inspector = region(
      'inspector',
      874,
      52,
      320,
      634,
      { lay: 'col' },
      tabs([{ label: 'Entity' }, { label: 'Level' }, { label: 'Checks', badge: '0' }], 0),
      F({ w: 'fill', h: 1, fill: 'border/default' }),
      C(
        { name: 'fields', w: 'fill', h: 'fill', pad: 12, gap: 8, clip: true },
        entityHead('drop', 'Slime', '#d9645a', 'q8m2c7d1', 'Entities'),
        field('x', '120', { unit: 'px' }),
        field('y', '360', { unit: 'px' }),
        field('hp', '3', { unit: '1 to 9' }),
        field('speed', '1.2', { unit: 'tiles/s' }),
        fieldRow(
          'patrol',
          pointList([
            [5, 14],
            [8, 14],
          ]),
          { h: 'hug', top: true },
        ),
        fieldRow('tint', colorBox('#d9645a')),
        R(
          { w: 'fill', gap: 8, h: 32 },
          T('tags', { style: 'Label/12', color: 'text/dim', w: 84 }),
          pill('enemy', { color: 'text/dim' }),
          pill('ground', { color: 'text/dim' }),
          pill('+', { color: 'accent/default' }),
        ),
      ),
      R(
        { name: 'footer', w: 'fill', h: 68, pad: [12, 12], gap: 8 },
        btn('Duplicate', { icon: 'copy', w: 'fill' }),
        btn('Delete', { kind: 'danger', icon: 'trash', w: 'fill' }),
      ),
    )

    return F(
      { name: 'Level · Mossgate · Moss Steps · iPad landscape', w: 1194, h: 834, fill: 'bg/app', clip: true },
      topbar(1194, {
        title: 'Moss Steps',
        file: 'mossgate.af2d.json',
        kind: 'Platformer',
        checks: 'Checks ok',
        tone: 'state/ok',
        preview: false,
      }),
      rail(782, 0, NAV),
      panel,
      canvas,
      inspector,
      levelDock(
        'World',
        'Mossgate · 5 levels',
        ['Old Gate', 'Moss Steps', 'Waterwheel', 'Cistern', 'Bell Tower'],
        1,
        miniPlatform,
        ['32×18', '48×22', '64×20', '28×30', '24×36'],
      ),
      line(0, 51, 1194, 1),
      line(55, 52, 1, 782),
      line(319, 52, 1, 634),
      line(873, 52, 1, 634),
    )
  },
})

// ── Level · top-down RPG ──
screens.push({
  id: 'level-rpg',
  page: '2D · Level',
  name: 'Level · Hollowmere · Village · iPad landscape',
  w: 1194,
  h: 834,
  note: 'A top-down RPG map in the same editor: the same layer panel, toolbar and inspector, with a different template behind them. The Entities layer is selected, so the palette lists entity definitions; the NPC is selected with its dialogue, facing and route, and the inn door shows the link it carries to another map.',
  build: (S, P) => {
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
      field,
      tabs,
      panelHead,
      rail,
      topbar,
      NAV,
      toolbar,
      layerRowG,
      defChip,
      pairs,
      fieldRow,
      textBox,
      pointList,
      entityHead,
      levelDock,
      miniMap,
      RPG,
      rpgArt,
      sprite,
      pathOver,
      selection,
      chip,
      seg,
    } = P
    const s = RPG.s
    const ox = 1
    const oy = 76
    const cx = (c) => ox + c * s
    const cy = (r) => oy + r * s
    const DEFS = [
      { id: 'player-start', icon: 'person', color: '#5fbf7a' },
      { id: 'npc', icon: 'chat', color: '#e0a54a' },
      { id: 'door', icon: 'door', color: '#4fb3c8' },
      { id: 'warp', icon: 'portal', color: '#a58be0' },
      { id: 'chest', icon: 'chest', color: '#c98a3a' },
      { id: 'sign', icon: 'sign', color: '#b98b54' },
      { id: 'trigger', icon: 'rect', color: '#8e8c85' },
      { id: 'enemy', icon: 'bolt', color: '#d9645a' },
    ]

    const panel = region(
      'level panel',
      56,
      52,
      264,
      634,
      { lay: 'col' },
      panelHead('Layers', ib('plus')),
      C(
        { w: 'fill', pad: [0, 8], gap: 2 },
        layerRowG('box', 'Entities', 'Entities · 8 defs', 'layer/entities', { sel: true }),
        layerRowG('image', 'Props', 'Objects · free', 'layer/sky'),
        layerRowG('sparkle', 'Walls art', 'Auto · 22 rules', 'layer/city', { locked: true }),
        layerRowG('grid', 'Walls', 'IntGrid · 3 values', 'layer/intgrid', { locked: true }),
        layerRowG('tile', 'Ground', 'Tiles · hollow-terrain', 'layer/tiles'),
      ),
      R(
        { w: 'fill', h: 40, pad: [8, 16, 0, 16] },
        eyebrow('Entity definitions'),
        spacer(),
        T('tap to arm', { style: 'Mono/11', color: 'text/faint' }),
      ),
      C(
        { name: 'definitions', w: 'fill', pad: [0, 8], gap: 6 },
        pairs(DEFS, (d) => defChip(d, { sel: d.id === 'npc' })),
      ),
    )

    const mx = cx(11) + 1
    const my = cy(11) + 20
    const canvas = region(
      'canvas',
      320,
      52,
      554,
      634,
      { fill: 'bg/canvas' },
      F({
        name: 'level bounds',
        x: ox - 1,
        y: oy - 1,
        w: 554,
        h: 530,
        stroke: alpha('accent/default', 0.45),
        sw: 1,
      }),
      V(rpgArt(), { name: 'level', x: ox, y: oy, w: 552, h: 528 }),
      sprite.player(cx(11) + 2, cy(15) + 22),
      sprite.sign(cx(9) + 1, cy(8) + 22),
      sprite.chest(cx(19), cy(10) + 22),
      sprite.npc(cx(8) + 2, cy(12) + 22, '#7a9be0'),
      F(
        {
          name: 'warp',
          x: cx(10),
          y: cy(21),
          w: 72,
          h: 24,
          fill: alpha('#a58be0', 0.25),
          stroke: '#a58be0',
          sw: 1.5,
          dash: [4, 3],
        },
        I('portal', { size: 14, color: '#a58be0', x: 29, y: 5 }),
      ),
      F({
        name: 'door link',
        x: cx(17) + 1,
        y: cy(6) + 3,
        w: 22,
        h: 21,
        r: 3,
        fill: alpha('#4fb3c8', 0.3),
        stroke: '#4fb3c8',
        sw: 1.5,
      }),
      ...pathOver(
        [
          [mx + 10, my + 2],
          [cx(15) + 12, my + 2],
          [cx(15) + 12, cy(13) + 24],
          [mx + 10, cy(13) + 24],
        ],
        554,
        634,
        '#e0a54a',
      ),
      sprite.npc(mx, my),
      ...selection(mx - 4, my - 28, 28, 32),
      R(
        { name: 'entity tag', x: mx + 34, y: my - 54, h: 22, pad: [0, 8], r: 6, fill: 'accent/default' },
        T('npc · Maren', { style: 'Mono/11', color: 'accent/ink', wt: 600 }),
      ),
      chip(cx(12), cy(7) + 2, 'link', 'Inn · inn-door', { name: 'door link chip', accent: true }),
      chip(cx(10) - 130, cy(21) - 30, 'link', 'Forest path · entry', { name: 'warp link chip' }),
      toolbar(554, 1),
      chip(8, 598, 'magnet', 'snap · 16 px', { name: 'grid chip' }),
      chip(142, 598, 'search', '150%', { name: 'zoom chip' }),
      chip(326, 598, 'pencil', 'Pencil draws · finger pans', { name: 'input chip' }),
    )

    const inspector = region(
      'inspector',
      874,
      52,
      320,
      634,
      { lay: 'col' },
      tabs([{ label: 'Entity' }, { label: 'Level' }, { label: 'Checks', badge: '0' }], 0),
      F({ w: 'fill', h: 1, fill: 'border/default' }),
      C(
        { name: 'fields', w: 'fill', h: 'fill', pad: 12, gap: 8, clip: true },
        entityHead('chat', 'NPC', '#e0a54a', 'b4t7w2n9', 'Entities'),
        fieldRow('name', P.inputBox('Maren')),
        fieldRow('dialogue', textBox('The inn’s cellar floods every spring. Mind the steps.', 3), {
          h: 'hug',
          top: true,
        }),
        fieldRow('facing', seg(['N', 'E', 'S', 'W'], 2)),
        fieldRow(
          'route',
          pointList(
            [
              [11, 11],
              [15, 11],
              [15, 13],
              [11, 13],
            ],
            { sel: 0 },
          ),
          { h: 'hug', top: true },
        ),
      ),
      R(
        { name: 'footer', w: 'fill', h: 68, pad: [12, 12], gap: 8 },
        btn('Duplicate', { icon: 'copy', w: 'fill' }),
        btn('Delete', { kind: 'danger', icon: 'trash', w: 'fill' }),
      ),
    )

    return F(
      { name: 'Level · Hollowmere · Village · iPad landscape', w: 1194, h: 834, fill: 'bg/app', clip: true },
      topbar(1194, {
        title: 'Village',
        file: 'hollowmere.af2d.json',
        kind: 'Top-down RPG',
        checks: 'Checks ok',
        tone: 'state/ok',
        preview: false,
      }),
      rail(782, 0, NAV),
      panel,
      canvas,
      inspector,
      levelDock(
        'World',
        'Hollowmere · 5 maps',
        ['Village', 'Inn', 'Cellar', 'Forest path', 'Shrine'],
        0,
        miniMap,
        ['23×22', '16×14', '20×16', '40×30', '18×18'],
      ),
      line(0, 51, 1194, 1),
      line(55, 52, 1, 782),
      line(319, 52, 1, 634),
      line(873, 52, 1, 634),
    )
  },
})

// ── Tilesets: the tileset, its tags and the auto-tile rules ──
screens.push({
  id: 'tileset',
  page: '2D · Level',
  name: 'Tilesets · Mossgate · auto-tile rules · iPad landscape',
  w: 1194,
  h: 834,
  note: 'The tileset and its auto-tile rules (LDtk-style): the sheet with tags and the selected tile, rule groups and rules on the left, the selected rule on the right (a 3×3 pattern of any, empty, filled, is and not; output tiles picked by a seeded hash; chance, flips, break on match), and a live preview of the IntGrid and what the rules make of it. The tileset here is a generated placeholder.',
  build: (S, P) => {
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
      field,
      tabs,
      panelHead,
      rail,
      topbar,
      NAV,
      seg,
      fieldRow,
      tilesetArt,
      blobSvg,
      patternSvg,
      terrainCell,
      TILESET,
      chip,
      label,
    } = P
    const thumb = (i, s, seed) => {
      const e = { u: !(i & 1), d: !(i & 2), l: !(i & 4), r: !(i & 8) }
      return V(
        `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">${terrainCell(0, 0, s, e, seed, 'dirt')}</svg>`,
        { name: `tile ${i}`, w: s, h: s },
      )
    }
    const E = 'empty'
    const Fl = 'filled'
    const A = 'any'
    const RULES = [
      ['Fill', [Fl, Fl, Fl, Fl, Fl, Fl, Fl, Fl, Fl], 15, 'any variant · 3 tiles'],
      ['Top edge', [E, E, E, A, Fl, A, Fl, Fl, Fl], 14, 'flip X · break'],
      ['Bottom edge', [Fl, Fl, Fl, A, Fl, A, E, E, E], 13, 'flip X · break'],
      ['Left edge', [E, Fl, A, E, Fl, Fl, E, Fl, A], 11, 'flip X · break'],
      ['Top corner', [E, E, E, E, Fl, Fl, E, Fl, Fl], 10, 'flip X · break'],
      ['Bottom corner', [E, Fl, Fl, E, Fl, Fl, E, E, E], 9, 'flip X · break'],
      ['Inner corner', [E, Fl, Fl, Fl, Fl, Fl, Fl, Fl, Fl], 7, 'flip X · flip Y'],
      ['Moss tufts', [A, E, A, A, Fl, A, A, Fl, A], 6, 'chance 30%'],
    ]
    const SEL = 1
    const row = (icon, name, sub, sel) =>
      R(
        {
          name: `row/${name}`,
          w: 'fill',
          h: 44,
          pad: [0, 8],
          gap: 10,
          r: 'radius/md',
          fill: sel ? alpha('accent/default', 0.12) : null,
          stroke: sel ? alpha('accent/default', 0.6) : null,
        },
        I(icon, { size: 18, color: sel ? 'accent/default' : 'text/dim' }),
        C(
          { w: 'fill', gap: 0 },
          T(name, { style: 'Body/13 Medium' }),
          T(sub, { style: 'Mono/11', color: 'text/dim', w: 'fill', trunc: true }),
        ),
      )
    const ruleRow = ([name, pat, tile, sub], i) =>
      R(
        {
          name: `rule/${name}`,
          w: 'fill',
          h: 44,
          pad: [0, 8, 0, 4],
          gap: 8,
          r: 'radius/md',
          fill: i === SEL ? alpha('accent/default', 0.12) : null,
          stroke: i === SEL ? alpha('accent/default', 0.6) : null,
        },
        I('grip', { size: 14, color: 'text/faint' }),
        V(patternSvg(pat, 10), { name: 'pattern', w: 30, h: 30 }),
        thumb(tile, 30, 7 + i),
        C(
          { w: 'fill', gap: 0 },
          T(name, { style: 'Body/13 Medium', w: 'fill', trunc: true }),
          T(sub, { style: 'Mono/11', color: 'text/dim', w: 'fill', trunc: true }),
        ),
      )

    const panel = region(
      'tilesets panel',
      56,
      52,
      264,
      782,
      { lay: 'col' },
      panelHead('Tilesets', ib('plus')),
      C(
        { w: 'fill', pad: [0, 8], gap: 2 },
        row('tile', 'moss-terrain', '16 px · placeholder', true),
        row('image', 'mossgate-props', '16 px · 24 tiles', false),
      ),
      R(
        { w: 'fill', h: 40, pad: [8, 16, 0, 16] },
        eyebrow('Auto · Ground'),
        spacer(),
        T('from Collision', { style: 'Mono/11', color: 'text/faint' }),
      ),
      C(
        { w: 'fill', pad: [0, 8], gap: 2 },
        row('layers', 'Terrain edges', '8 rules · 3 tiles each', true),
        row('layers', 'Corners', '6 rules', false),
        row('layers', 'Decoration', '4 rules · chance', false),
      ),
      R(
        { w: 'fill', h: 40, pad: [8, 16, 0, 16] },
        eyebrow('Rules · Terrain edges'),
        spacer(),
        ib('plus', { s: 32, size: 16 }),
      ),
      C({ name: 'rules', w: 'fill', pad: [0, 8], gap: 2 }, RULES.map(ruleRow)),
    )

    // the tileset sheet with tags and the selected tile
    const TS = 44
    const sx = 16
    const sy = 76
    let tagDots = ''
    for (const i of [...Array(16).keys(), ...[20, 21, 22, 23, 24, 25, 26, 27]])
      tagDots += `<circle cx="${(i % TILESET.cols) * TS + 7}" cy="${Math.floor(i / TILESET.cols) * TS + 7}" r="3.5" fill="#e0a54a" stroke="#14161c"/>`
    const selTile = 14
    const canvas = region(
      'canvas',
      320,
      52,
      554,
      782,
      { fill: 'bg/canvas' },
      R(
        { name: 'sheet header', x: 0, y: 0, w: 554, h: 52, pad: [0, 16], gap: 10, fill: 'bg/surface' },
        T('moss-terrain', { style: 'Title/15' }),
        pill('placeholder · generated', { color: 'state/warn', icon: 'info' }),
        spacer(),
        btn('Replace image', { icon: 'image' }),
      ),
      T('16 × 16 px tiles · spacing 0 · padding 0 · 10 × 4 tiles', {
        x: 16,
        y: 58,
        style: 'Mono/11',
        color: 'text/dim',
      }),
      V(tilesetArt(TS), { name: 'tileset', x: sx, y: sy + 8, w: TILESET.cols * TS, h: TILESET.rows * TS }),
      V(
        `<svg xmlns="http://www.w3.org/2000/svg" width="${TILESET.cols * TS}" height="${TILESET.rows * TS}" viewBox="0 0 ${TILESET.cols * TS} ${TILESET.rows * TS}">${tagDots}</svg>`,
        { name: 'solid tags', x: sx, y: sy + 8, w: TILESET.cols * TS, h: TILESET.rows * TS },
      ),
      F({
        name: 'selected tile',
        x: sx + (selTile % TILESET.cols) * TS,
        y: sy + 8 + Math.floor(selTile / TILESET.cols) * TS,
        w: TS,
        h: TS,
        stroke: 'accent/default',
        sw: 2.5,
      }),
      R(
        { name: 'tags', x: 16, y: 276, w: 522, h: 36, gap: 8 },
        label('Tags'),
        pill('solid', {
          color: 'accent/default',
          h: 32,
          pad: 14,
          fill: alpha('accent/default', 0.16),
          stroke: alpha('accent/default', 0.7),
        }),
        pill('one-way', { color: 'text/dim', h: 32, pad: 14 }),
        pill('hazard', { color: 'text/dim', h: 32, pad: 14 }),
        pill('water', { color: 'text/dim', h: 32, pad: 14 }),
        pill('+', { color: 'accent/default', h: 32, pad: 14 }),
        spacer(),
        T('24 tiles tagged solid', { style: 'Mono/11', color: 'text/faint' }),
      ),
      F({ name: 'divider', x: 16, y: 332, w: 522, h: 1, fill: 'border/default' }),
      R(
        { x: 16, y: 344, w: 522, h: 28, gap: 8 },
        eyebrow('Live preview'),
        spacer(),
        T('Ground · seed 4182', { style: 'Mono/11', color: 'text/faint' }),
        btn('Re-roll variation', { icon: 'dice', h: 32 }),
      ),
      T('IntGrid · Collision', { x: 16, y: 384, style: 'Label/12', color: 'text/dim' }),
      V(blobSvg(28, true), { name: 'intgrid preview', x: 16, y: 406, w: 252, h: 168 }),
      T('Result · Ground', { x: 286, y: 384, style: 'Label/12', color: 'text/dim' }),
      V(blobSvg(28, false), { name: 'result preview', x: 286, y: 406, w: 252, h: 168 }),
      F({
        name: 'rule highlight',
        x: 286 + 3 * 28,
        y: 406 + 28,
        w: 28,
        h: 28,
        stroke: 'accent/default',
        sw: 2,
        dash: [4, 3],
      }),
      T(
        'The outlined cell is where “Top edge” matched. Painting an IntGrid cell recomputes only the cells around it.',
        {
          x: 16,
          y: 592,
          w: 522,
          style: 'Label/12',
          color: 'text/dim',
          lh: 17,
        },
      ),
      chip(16, 642, 'info', 'Seeded hash: the same project makes the same tiles everywhere', {
        name: 'determinism chip',
      }),
    )

    // the selected rule
    const cellsSel = RULES[SEL][1]
    const legend = (kind, text) =>
      R(
        { name: `legend/${text}`, h: 28, gap: 4 },
        V(patternSvg([kind], 18, true), { w: 18, h: 18 }),
        T(text, { style: 'Mono/11', color: 'text/dim' }),
      )
    const inspector = region(
      'inspector',
      874,
      52,
      320,
      782,
      { lay: 'col' },
      tabs([{ label: 'Rule' }, { label: 'Group' }, { label: 'Tileset' }], 0),
      F({ w: 'fill', h: 1, fill: 'border/default' }),
      C(
        { name: 'fields', w: 'fill', h: 'fill', pad: 12, gap: 8, clip: true },
        R(
          { w: 'fill', h: 36, gap: 8 },
          T('Top edge', { style: 'Title/15' }),
          pill('rule 2', { color: 'text/dim', mono: true }),
          spacer(),
          pill('active', { color: 'state/ok', dot: true }),
        ),
        fieldRow('size', seg(['1×1', '3×3', '5×5'], 1)),
        R(
          { name: 'pattern', w: 'fill', ax: 'center' },
          V(patternSvg(cellsSel, 72), { name: 'pattern 3x3', w: 216, h: 216 }),
        ),
        R(
          { w: 'fill', gap: 8, ax: 'center' },
          legend('any', 'any'),
          legend('empty', 'empty'),
          legend('filled', 'filled'),
          legend('is', 'is'),
          legend('not', 'not'),
        ),
        T('Tap a cell to cycle. The gold cell is the one being decided.', {
          style: 'Label/12',
          color: 'text/dim',
          w: 'fill',
          lh: 17,
        }),
        R(
          { name: 'output', w: 'fill', gap: 8 },
          T('output', { style: 'Label/12', color: 'text/dim', w: 84 }),
          thumb(14, 40, 3),
          thumb(14, 40, 9),
          thumb(14, 40, 21),
          R(
            {
              w: 40,
              h: 40,
              ax: 'center',
              ay: 'center',
              r: 'radius/md',
              stroke: 'border/strong',
              dash: [3, 3],
            },
            I('plus', { size: 16, color: 'accent/default' }),
          ),
        ),
        field('chance', '100', { unit: '%' }),
        R(
          { w: 'fill', gap: 6 },
          pill('Flip X', { color: 'accent/default', icon: 'check', h: 32, pad: 12 }),
          pill('Flip Y', { color: 'text/dim', h: 32, pad: 12 }),
          pill('Break on match', { color: 'accent/default', icon: 'check', h: 32, pad: 12 }),
        ),
        field('outside', '0', { unit: 'empty' }),
      ),
      R(
        { name: 'footer', w: 'fill', h: 68, pad: [12, 12], gap: 8 },
        btn('Duplicate', { icon: 'copy', w: 'fill' }),
        btn('Delete', { kind: 'danger', icon: 'trash', w: 'fill' }),
      ),
    )

    return F(
      {
        name: 'Tilesets · Mossgate · auto-tile rules · iPad landscape',
        w: 1194,
        h: 834,
        fill: 'bg/app',
        clip: true,
      },
      topbar(1194, {
        title: 'Tilesets',
        file: 'mossgate.af2d.json',
        kind: 'Platformer',
        checks: 'Checks ok',
        tone: 'state/ok',
        preview: false,
      }),
      rail(782, 2, NAV),
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

// ── Entities: definitions with typed fields ──
screens.push({
  id: 'entities',
  page: '2D · Level',
  name: 'Entities · Hollowmere · NPC definition · iPad landscape',
  w: 1194,
  h: 834,
  note: 'Entity definitions (LDtk-style): what an NPC, a door or a warp is, and which typed fields it carries. The preview shows the shape, size and pivot; the form shows what the Level inspector builds from the fields; the field editor changes a field’s type, default, options and whether it is required. The same definitions screen serves a platformer’s slime and an RPG’s NPC.',
  build: (S, P) => {
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
      field,
      tabs,
      panelHead,
      rail,
      topbar,
      NAV,
      seg,
      fieldRow,
      inputBox,
      label,
      sprite,
    } = P
    const DEFS = [
      ['player-start', 'person', '#5fbf7a', '0 fields · single'],
      ['npc', 'chat', '#e0a54a', '5 fields · rect'],
      ['door', 'door', '#4fb3c8', '2 fields · rect'],
      ['warp', 'portal', '#a58be0', '2 fields · resizable'],
      ['chest', 'chest', '#c98a3a', '2 fields · rect'],
      ['sign', 'sign', '#b98b54', '1 field · rect'],
      ['trigger', 'rect', '#8e8c85', '1 field · resizable'],
      ['enemy', 'bolt', '#d9645a', '2 fields · rect'],
    ]
    const SEL = 1
    const defRow = ([id, icon, color, sub], i) =>
      R(
        {
          name: `def/${id}`,
          w: 'fill',
          h: 48,
          pad: [0, 8],
          gap: 10,
          r: 'radius/md',
          fill: i === SEL ? alpha('accent/default', 0.12) : null,
          stroke: i === SEL ? alpha('accent/default', 0.6) : null,
        },
        R({ w: 30, h: 30, ax: 'center', r: 8, fill: alpha(color, 0.22) }, I(icon, { size: 17, color })),
        C(
          { w: 'fill', gap: 0 },
          T(id, { style: 'Body/13 Medium' }),
          T(sub, { style: 'Mono/11', color: 'text/dim' }),
        ),
      )
    const panel = region(
      'entities panel',
      56,
      52,
      264,
      782,
      { lay: 'col' },
      panelHead('Definitions', ib('plus')),
      C({ w: 'fill', pad: [0, 8], gap: 2 }, DEFS.map(defRow)),
      R(
        { w: 'fill', h: 40, pad: [8, 16, 0, 16] },
        eyebrow('Level fields'),
        spacer(),
        T('every level', { style: 'Mono/11', color: 'text/faint' }),
      ),
      C(
        { w: 'fill', pad: [0, 8], gap: 2 },
        R(
          { name: 'level field area', w: 'fill', h: 44, pad: [0, 8], gap: 10, r: 'radius/md' },
          I('text', { size: 18, color: 'text/dim' }),
          C(
            { w: 'fill', gap: 0 },
            T('area', { style: 'Body/13 Medium' }),
            T('text · default “”', { style: 'Mono/11', color: 'text/dim' }),
          ),
        ),
      ),
    )

    // the preview: a 16 x 24 px NPC at 4x with its pivot
    const gx = 16
    const gy = 76
    const gw = 522
    const gh = 270
    let gl = ''
    for (let x = 0; x <= gw; x += 24) gl += `M${x} 0V${gh}`
    for (let y = 0; y <= gh; y += 24) gl += `M0 ${y}H${gw}`
    const bx = 261 - 32
    const by = 40
    const npcBox = (x, y, k) =>
      F(
        {
          name: 'shape',
          x,
          y,
          w: 16 * k,
          h: 24 * k,
          fill: alpha('#e0a54a', 0.18),
          stroke: '#e0a54a',
          sw: 1.5,
        },
        F({ x: 2 * k, y: 9 * k, w: 12 * k, h: 15 * k, r: 6 * k, fill: '#e0a54a', stroke: '#8a5a14' }),
        F({ x: 3.5 * k, y: 0, w: 9 * k, h: 9 * k, r: 4.5 * k, fill: '#f1d2a8', stroke: '#8a5a14' }),
      )
    const formRow = (name, type, ctl) =>
      R(
        { name: `form/${name}`, w: 'fill', h: 44, gap: 8 },
        T(name, { style: 'Label/12', color: 'text/dim', w: 84 }),
        ctl,
        pill(type, { color: 'text/faint', mono: true, h: 22, pad: 8 }),
      )
    const skeleton = (w, o = {}) =>
      R(
        {
          w: w || 'fill',
          h: o.h || 36,
          pad: [0, 12],
          r: 'radius/md',
          fill: 'bg/field',
          stroke: 'border/default',
        },
        T(o.text || ' ', { style: 'Body/13', color: 'text/dim' }),
      )
    const canvas = region(
      'canvas',
      320,
      52,
      554,
      782,
      { fill: 'bg/canvas' },
      R(
        { name: 'definition header', x: 0, y: 0, w: 554, h: 52, pad: [0, 16], gap: 10, fill: 'bg/surface' },
        R(
          { w: 28, h: 28, ax: 'center', r: 8, fill: alpha('#e0a54a', 0.22) },
          I('chat', { size: 16, color: '#e0a54a' }),
        ),
        T('npc', { style: 'Title/15' }),
        pill('2 instances · 1 map', { color: 'text/dim', mono: true }),
        spacer(),
        pill('rect 16×24 px', { color: 'text/dim', mono: true }),
        pill('pivot 0.5, 1', { color: 'text/dim', mono: true }),
      ),
      F(
        {
          name: 'preview',
          x: gx,
          y: gy,
          w: gw,
          h: gh,
          r: 'radius/lg',
          fill: '#14161c',
          stroke: 'border/default',
          clip: true,
        },
        V(
          `<svg xmlns="http://www.w3.org/2000/svg" width="${gw}" height="${gh}" viewBox="0 0 ${gw} ${gh}"><path d="${gl}" stroke="#ffffff" stroke-opacity=".06" fill="none"/></svg>`,
          { name: 'grid', x: 0, y: 0, w: gw, h: gh },
        ),
        npcBox(bx, by, 4),
        F({
          name: 'pivot',
          x: 261 - 8,
          y: by + 96 - 8,
          w: 16,
          h: 16,
          r: 8,
          fill: alpha('accent/default', 0.25),
          stroke: 'accent/default',
          sw: 2,
        }),
        T('pivot', { x: 261 + 14, y: by + 96 - 8, style: 'Mono/11', color: 'accent/default' }),
        F({ name: 'width line', x: bx, y: by + 96 + 14, w: 64, h: 1, fill: 'text/dim' }),
        T('16 px', { x: bx + 18, y: by + 96 + 18, style: 'Mono/11', color: 'text/dim' }),
        F({ name: 'height line', x: bx - 14, y: by, w: 1, h: 96, fill: 'text/dim' }),
        T('24', { x: bx - 38, y: by + 40, style: 'Mono/11', color: 'text/dim' }),
        T('Placed with its pivot on the snapped cell', {
          x: 16,
          y: gh - 28,
          style: 'Label/12',
          color: 'text/dim',
        }),
      ),
      R(
        { x: 16, y: 366, w: 522, h: 28, gap: 8 },
        eyebrow('Instance form'),
        spacer(),
        T('what the Level inspector builds', { style: 'Mono/11', color: 'text/faint' }),
      ),
      C(
        {
          name: 'form preview',
          x: 16,
          y: 400,
          w: 522,
          gap: 8,
          pad: [12, 16],
          r: 'radius/lg',
          fill: 'bg/surface',
          stroke: 'border/default',
        },
        formRow('name', 'text', skeleton(null, { text: 'Maren' })),
        formRow('dialogue', 'text · multiline', skeleton(null, { h: 52 })),
        formRow('facing', 'enum', seg(['N', 'E', 'S', 'W'], 2)),
        formRow('route', 'point · list', skeleton(null, { text: '1  11, 11     2  15, 11     + add point' })),
        formRow('follows', 'ref · npc', skeleton(null, { text: 'choose an NPC…' })),
      ),
    )

    // fields tab
    const TYPE_ICON = {
      int: 'hash',
      float: 'slider',
      bool: 'check',
      text: 'text',
      enum: 'list',
      color: 'drop',
      angle: 'angle',
      ref: 'link',
      point: 'pin',
    }
    const fieldItem = (id, type, sub, o = {}) =>
      R(
        {
          name: `field/${id}`,
          w: 'fill',
          h: 44,
          pad: [0, 8, 0, 4],
          gap: 8,
          r: 'radius/md',
          fill: o.sel ? alpha('accent/default', 0.12) : null,
          stroke: o.sel ? alpha('accent/default', 0.6) : null,
        },
        I('grip', { size: 14, color: 'text/faint' }),
        R(
          { w: 28, h: 28, ax: 'center', r: 7, fill: alpha('accent/default', 0.14) },
          I(TYPE_ICON[type], { size: 15, color: 'accent/default' }),
        ),
        C(
          { w: 'fill', gap: 0 },
          T(id, { style: 'Body/13 Medium' }),
          T(sub, { style: 'Mono/11', color: 'text/dim', w: 'fill', trunc: true }),
        ),
        o.required ? pill('required', { color: 'state/warn', h: 20, pad: 7 }) : null,
      )
    const typeChip = (t, on) =>
      R(
        {
          name: `type/${t}`,
          h: 36,
          pad: [0, 10],
          gap: 6,
          r: 18,
          fill: on ? alpha('accent/default', 0.16) : 'bg/field',
          stroke: on ? alpha('accent/default', 0.7) : 'border/default',
        },
        I(TYPE_ICON[t], { size: 14, color: on ? 'accent/default' : 'text/dim' }),
        T(t, { style: 'Label/12', color: on ? 'accent/default' : 'text/dim' }),
      )
    const inspector = region(
      'inspector',
      874,
      52,
      320,
      782,
      { lay: 'col' },
      tabs([{ label: 'Definition' }, { label: 'Fields', badge: '5' }], 1),
      F({ w: 'fill', h: 1, fill: 'border/default' }),
      C(
        { name: 'fields', w: 'fill', h: 'fill', pad: 12, gap: 4, clip: true },
        fieldItem('name', 'text', 'text · default “”', { required: true }),
        fieldItem('dialogue', 'text', 'text · multiline'),
        fieldItem('facing', 'enum', 'enum · N E S W · default S', { sel: true }),
        C(
          {
            name: 'field editor',
            w: 'fill',
            pad: 12,
            gap: 10,
            r: 'radius/md',
            fill: 'bg/field',
            stroke: alpha('accent/default', 0.5),
          },
          R(
            { w: 'fill', gap: 8 },
            label('Type'),
            spacer(),
            T('changing it checks every NPC first', { style: 'Mono/11', color: 'text/faint' }),
          ),
          R({ w: 'fill', gap: 6 }, typeChip('int', false), typeChip('float', false), typeChip('bool', false)),
          R({ w: 'fill', gap: 6 }, typeChip('text', false), typeChip('enum', true), typeChip('color', false)),
          R(
            { w: 'fill', gap: 6 },
            typeChip('angle', false),
            typeChip('ref', false),
            typeChip('point', false),
          ),
          R(
            { w: 'fill', gap: 6 },
            pill('N', { color: 'text/primary', h: 32, pad: 14, fill: 'bg/raised', stroke: 'border/default' }),
            pill('E', { color: 'text/primary', h: 32, pad: 14, fill: 'bg/raised', stroke: 'border/default' }),
            pill('S', {
              color: 'accent/default',
              h: 32,
              pad: 14,
              fill: alpha('accent/default', 0.16),
              stroke: alpha('accent/default', 0.7),
            }),
            pill('W', { color: 'text/primary', h: 32, pad: 14, fill: 'bg/raised', stroke: 'border/default' }),
            pill('+', { color: 'accent/default', h: 32, pad: 14 }),
          ),
          R(
            { w: 'fill', gap: 6 },
            pill('Required', { color: 'text/dim', h: 32, pad: 12 }),
            pill('List', { color: 'text/dim', h: 32, pad: 12 }),
            spacer(),
            T('default S', { style: 'Mono/11', color: 'text/dim' }),
          ),
        ),
        fieldItem('route', 'point', 'point · list'),
        fieldItem('follows', 'ref', 'ref · npc, player-start'),
        btn('Add field', { kind: 'ghost', icon: 'plus' }),
      ),
      R(
        { name: 'footer', w: 'fill', h: 68, pad: [12, 12], gap: 8 },
        btn('Duplicate', { icon: 'copy', w: 'fill' }),
        btn('Delete', { kind: 'danger', icon: 'trash', w: 'fill' }),
      ),
    )

    return F(
      {
        name: 'Entities · Hollowmere · NPC definition · iPad landscape',
        w: 1194,
        h: 834,
        fill: 'bg/app',
        clip: true,
      },
      topbar(1194, {
        title: 'Entities',
        file: 'hollowmere.af2d.json',
        kind: 'Top-down RPG',
        checks: 'Checks ok',
        tone: 'state/ok',
        preview: false,
      }),
      rail(782, 3, NAV),
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

// ── World map ──
screens.push({
  id: 'world',
  page: '2D · Level',
  name: 'World map · Hollowmere · free layout · iPad landscape',
  w: 1194,
  h: 834,
  note: 'The world map: five maps as rectangles on a free canvas, each with its own size and depth, and the links between them (a door, a trapdoor, a warp, a path) drawn from the reference fields on their entities. The selected map’s position, size and fields are on the right. Layout can switch to grid (LDtk’s GridVania, with neighbours) or to a linear sequence.',
  build: (S, P) => {
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
      field,
      tabs,
      panelHead,
      rail,
      topbar,
      NAV,
      seg,
      fieldRow,
      inputBox,
      label,
      rpgArt,
      chip,
    } = P
    const K = 0.4
    // [id, x, y, w, h] in world px; the canvas draws them at K
    const LV = [
      ['Village', 360, 220, 368, 352],
      ['Inn', 840, 150, 256, 224],
      ['Cellar', 840, 520, 320, 256],
      ['Forest path', 60, 700, 640, 480],
      ['Shrine', 800, 920, 368, 368],
    ]
    const ox = 20
    const oy = 80
    const px = (x) => ox + x * K
    const py = (y) => oy + y * K
    const thumbs = {
      Village: (w, h) => V(rpgArt(), { name: 'Village', w, h }),
      Inn: (w, h) => [
        F({ w, h, fill: '#8a6a4a' }),
        F({ x: 8, y: 8, w: w - 16, h: 14, fill: '#6b4a2c' }),
        F({ x: 14, y: h - 30, w: 22, h: 14, r: 3, fill: '#b98b54' }),
        F({ x: w - 40, y: h - 34, w: 24, h: 18, r: 3, fill: '#b98b54' }),
      ],
      Cellar: (w, h) => [
        F({ w, h, fill: '#4d5666' }),
        F({ x: 12, y: 12, w: 26, h: 26, fill: '#697386' }),
        F({ x: w - 40, y: h - 40, w: 26, h: 26, fill: '#697386' }),
      ],
      'Forest path': (w, h) => [
        F({ w, h, fill: '#2f6b3a' }),
        F({ x: w * 0.42, y: 0, w: w * 0.16, h, fill: '#cfae74' }),
        F({ x: 16, y: 20, w: 30, h: 30, r: 15, fill: '#1f4f2a' }),
        F({ x: w - 56, y: h - 60, w: 34, h: 34, r: 17, fill: '#1f4f2a' }),
        F({ x: 24, y: h - 50, w: 28, h: 28, r: 14, fill: '#1f4f2a' }),
      ],
      Shrine: (w, h) => [
        F({ w, h, fill: '#55904c' }),
        F({ x: w * 0.3, y: h * 0.3, w: w * 0.4, h: h * 0.4, fill: '#9aa3b5' }),
        F({ x: w * 0.42, y: h * 0.18, w: w * 0.16, h: h * 0.16, fill: '#697386' }),
      ],
    }
    const card = ([name, x, y, w, h], i) => {
      const cw = w * K
      const ch = h * K
      const sel = i === 0
      return F(
        {
          name: `level/${name}`,
          x: px(x),
          y: py(y),
          w: cw,
          h: ch,
          r: 4,
          fill: 'bg/field',
          stroke: sel ? 'accent/default' : 'border/strong',
          sw: sel ? 2 : 1,
          clip: true,
        },
        thumbs[name](cw, ch),
        R(
          { name: 'label', x: 6, y: 6, h: 22, pad: [0, 8], r: 6, fill: alpha('#000000', 0.62) },
          T(name, { style: 'Label/12', color: '#ffffff' }),
        ),
        R(
          { name: 'size', x: 6, y: ch - 26, h: 20, pad: [0, 6], r: 5, fill: alpha('#000000', 0.55) },
          T(`${w / 16}×${h / 16}`, { style: 'Mono/11', color: '#e8e6e1' }),
        ),
      )
    }
    // links, drawn behind the cards: from an entity on one map to an entity on another
    const mid = (name) => {
      const [, x, y, w, h] = LV.find((l) => l[0] === name)
      return [px(x + w / 2), py(y + h / 2)]
    }
    const [vx, vy] = mid('Village')
    const [ix, iy] = mid('Inn')
    const [cx2, cy2] = mid('Cellar')
    const [fx2, fy2] = mid('Forest path')
    const [sx, sy] = mid('Shrine')
    const arrow = (x1, y1, x2, y2, bend, color) => {
      const mx = (x1 + x2) / 2
      const my = (y1 + y2) / 2
      const dx = x2 - x1
      const dy = y2 - y1
      const len = Math.hypot(dx, dy) || 1
      const qx = mx - (dy / len) * bend
      const qy = my + (dx / len) * bend
      const ang = Math.atan2(y2 - qy, x2 - qx)
      const a1 = [x2 - 10 * Math.cos(ang - 0.45), y2 - 10 * Math.sin(ang - 0.45)]
      const a2 = [x2 - 10 * Math.cos(ang + 0.45), y2 - 10 * Math.sin(ang + 0.45)]
      return `<path d="M${x1} ${y1}Q${qx} ${qy} ${x2} ${y2}" fill="none" stroke="${color}" stroke-width="1.8" stroke-dasharray="6 4"/><path d="M${a1[0]} ${a1[1]}L${x2} ${y2}L${a2[0]} ${a2[1]}" fill="none" stroke="${color}" stroke-width="1.8" stroke-linejoin="round"/>`
    }
    // anchor points on card edges so the lines meet the maps instead of their centres
    const edge = (name, side) => {
      const [, x, y, w, h] = LV.find((l) => l[0] === name)
      return {
        r: [px(x + w), py(y + h / 2)],
        l: [px(x), py(y + h / 2)],
        t: [px(x + w / 2), py(y)],
        b: [px(x + w / 2), py(y + h)],
      }[side]
    }
    const links = [
      [edge('Village', 'r'), edge('Inn', 'l'), -18, '#4fb3c8', 'door'],
      [edge('Inn', 'b'), edge('Cellar', 't'), 0, '#4fb3c8', 'trapdoor'],
      [edge('Village', 'b'), edge('Forest path', 't'), 20, '#a58be0', 'warp'],
      [edge('Forest path', 'r'), edge('Shrine', 'l'), 18, '#a58be0', 'path'],
    ]
    // the curve's midpoint, where its label sits
    const midOf = ([a, b, bend]) => {
      const mx = (a[0] + b[0]) / 2
      const my = (a[1] + b[1]) / 2
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1
      const qx = mx - ((b[1] - a[1]) / len) * bend
      const qy = my + ((b[0] - a[0]) / len) * bend
      return [0.25 * a[0] + 0.5 * qx + 0.25 * b[0], 0.25 * a[1] + 0.5 * qy + 0.25 * b[1]]
    }
    let dots = ''
    for (let x = 0; x <= 554; x += 24)
      for (let y = 52; y <= 782; y += 24)
        dots += `<circle cx="${x}" cy="${y}" r="1" fill="#ffffff" fill-opacity=".1"/>`
    const linkChip = (x, y, text, color) =>
      R(
        {
          name: `link ${text}`,
          x,
          y,
          h: 22,
          pad: [0, 8],
          gap: 6,
          r: 11,
          fill: 'bg/surface',
          stroke: alpha(color, 0.7),
        },
        I('link', { size: 12, color }),
        T(text, { style: 'Mono/11', color }),
      )

    const panel = region(
      'world panel',
      56,
      52,
      264,
      782,
      { lay: 'col' },
      panelHead('Worlds', ib('plus')),
      C(
        { w: 'fill', pad: [0, 8], gap: 2 },
        R(
          {
            name: 'world/Overworld',
            w: 'fill',
            h: 48,
            pad: [0, 8],
            gap: 10,
            r: 'radius/md',
            fill: alpha('accent/default', 0.12),
            stroke: alpha('accent/default', 0.6),
          },
          I('world', { size: 18, color: 'accent/default' }),
          C(
            { w: 'fill', gap: 0 },
            T('Overworld', { style: 'Body/13 Medium' }),
            T('free · 5 maps', { style: 'Mono/11', color: 'text/dim' }),
          ),
        ),
      ),
      R({ w: 'fill', h: 40, pad: [8, 16, 0, 16] }, eyebrow('Layout')),
      C(
        { w: 'fill', pad: [0, 12], gap: 8 },
        seg(['Free', 'Grid', 'Row', 'Column'], 0),
        fieldRow('grid', P.inputBox('free layout', { dim: true })),
      ),
      R(
        { w: 'fill', h: 40, pad: [8, 16, 0, 16] },
        eyebrow('Maps'),
        spacer(),
        T('depth', { style: 'Mono/11', color: 'text/faint' }),
      ),
      C(
        { name: 'maps', w: 'fill', pad: [0, 8], gap: 2 },
        LV.map(([name, , , w, h], i) =>
          R(
            {
              name: `map/${name}`,
              w: 'fill',
              h: 44,
              pad: [0, 8],
              gap: 10,
              r: 'radius/md',
              fill: i === 0 ? alpha('accent/default', 0.12) : null,
              stroke: i === 0 ? alpha('accent/default', 0.6) : null,
            },
            I('layers', { size: 18, color: i === 0 ? 'accent/default' : 'text/dim' }),
            C(
              { w: 'fill', gap: 0 },
              T(name, { style: 'Body/13 Medium' }),
              T(`${w / 16}×${h / 16} cells`, { style: 'Mono/11', color: 'text/dim' }),
            ),
            T(`z${i === 3 ? 1 : 0}`, { style: 'Mono/11', color: 'text/faint' }),
          ),
        ),
      ),
    )

    const canvas = region(
      'canvas',
      320,
      52,
      554,
      782,
      { fill: 'bg/canvas' },
      V(
        `<svg xmlns="http://www.w3.org/2000/svg" width="554" height="782" viewBox="0 0 554 782">${dots}</svg>`,
        { name: 'dots', x: 0, y: 0, w: 554, h: 782 },
      ),
      V(
        `<svg xmlns="http://www.w3.org/2000/svg" width="554" height="782" viewBox="0 0 554 782">${links.map(([a, b, bend, c]) => arrow(a[0], a[1], b[0], b[1], bend, c)).join('')}</svg>`,
        { name: 'links', x: 0, y: 0, w: 554, h: 782 },
      ),
      ...LV.map(card),
      ...links.map((l) => {
        const [mx, my] = midOf(l)
        return linkChip(mx - 30, my - 11, l[4], l[3])
      }),
      F({
        name: 'selection',
        x: px(360),
        y: py(220),
        w: 368 * K,
        h: 352 * K,
        stroke: 'accent/default',
        sw: 2,
      }),
      F({
        name: 'selection handle',
        x: px(360) - 5,
        y: py(220) - 5,
        w: 10,
        h: 10,
        fill: 'accent/default',
        stroke: 'bg/canvas',
        sw: 1,
      }),
      F({
        name: 'selection handle',
        x: px(728) - 5,
        y: py(572) - 5,
        w: 10,
        h: 10,
        fill: 'accent/default',
        stroke: 'bg/canvas',
        sw: 1,
      }),
      region(
        'toolbar',
        0,
        0,
        554,
        52,
        { lay: 'row', ay: 'center', pad: [0, 8], gap: 2, fill: 'bg/surface' },
        ib('cursor', { on: true }),
        ib('hand'),
        ib('plus'),
        ib('link'),
        F({ w: 1, h: 24, fill: 'border/default' }),
        T('Drag a map to move it. Links come from reference fields.', {
          style: 'Label/12',
          color: 'text/dim',
          w: 'fill',
          trunc: true,
        }),
      ),
      chip(8, 744, 'search', '40%', { name: 'zoom chip' }),
      chip(84, 744, 'grid', 'free layout', { name: 'layout chip' }),
      chip(210, 744, 'pencil', 'Pencil moves · finger pans', { name: 'input chip' }),
    )

    const inspector = region(
      'inspector',
      874,
      52,
      320,
      782,
      { lay: 'col' },
      tabs([{ label: 'Map' }, { label: 'World' }, { label: 'Checks', badge: '0' }], 0),
      F({ w: 'fill', h: 1, fill: 'border/default' }),
      C(
        { name: 'fields', w: 'fill', h: 'fill', pad: 12, gap: 8, clip: true },
        R(
          { w: 'fill', h: 36, gap: 8 },
          T('Village', { style: 'Title/15' }),
          spacer(),
          pill('selected', { color: 'accent/default' }),
        ),
        fieldRow('name', inputBox('Village')),
        fieldRow('id', inputBox('village', { mono: true, icon: 'lock', dim: true })),
        field('x', '360', { unit: 'px' }),
        field('y', '220', { unit: 'px' }),
        field('width', '23', { unit: 'cells' }),
        field('height', '22', { unit: 'cells' }),
        field('depth', '0'),
        fieldRow('area', inputBox('Hollowmere')),
        R({ w: 'fill', h: 28, pad: [8, 0, 0, 0] }, eyebrow('Links')),
        ...[
          ['door', 'Inn · inn-door', '#4fb3c8'],
          ['warp', 'Forest path · entry', '#a58be0'],
        ].map(([k, to, c]) =>
          R(
            {
              name: `link/${k}`,
              w: 'fill',
              h: 40,
              pad: [0, 10],
              gap: 8,
              r: 'radius/md',
              fill: 'bg/field',
              stroke: 'border/default',
            },
            I('link', { size: 16, color: c }),
            T(k, { style: 'Label/12', color: 'text/dim', w: 40 }),
            T(to, { style: 'Mono/12', w: 'fill', trunc: true }),
            I('chevron-right', { size: 16, color: 'text/faint' }),
          ),
        ),
        T('Linked from: Forest path · exit. Neighbours are listed only in grid layouts.', {
          style: 'Label/12',
          color: 'text/dim',
          w: 'fill',
          lh: 17,
        }),
      ),
      R(
        { name: 'footer', w: 'fill', h: 68, pad: [12, 12], gap: 8 },
        btn('Duplicate', { icon: 'copy', w: 'fill' }),
        btn('Delete', { kind: 'danger', icon: 'trash', w: 'fill' }),
      ),
    )

    return F(
      {
        name: 'World map · Hollowmere · free layout · iPad landscape',
        w: 1194,
        h: 834,
        fill: 'bg/app',
        clip: true,
      },
      topbar(1194, {
        title: 'World',
        file: 'hollowmere.af2d.json',
        kind: 'Top-down RPG',
        checks: 'Checks ok',
        tone: 'state/ok',
        preview: false,
      }),
      rail(782, 1, NAV),
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

// ── Home ──
screens.push({
  id: 'home',
  page: '2D · Home',
  name: 'Home · projects · iPad landscape',
  w: 1194,
  h: 834,
  note: 'Where a session starts: sources on the left, every project in the workspace (a platformer, an RPG, a blank sketch and a FloorFifty stage, each opened by its own profile), templates for a new project, and the selected project on the right.',
  build: (S, P) => {
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
      kv,
      sceneCard,
      inputBox,
      callout,
      dot,
      G,
      platformerArt,
      rpgArt,
    } = P
    const crop = (art, w, h, k, y) =>
      F(
        { name: 'thumbnail', w, h, clip: true, fill: 'bg/canvas' },
        V(art, { name: 'art', x: 0, y: -y * k, w: w, h: w * k }),
      )
    const thumb = (id, w, h) => {
      if (id === 'mossgate')
        return F(
          { name: 'Mossgate thumbnail', w, h, clip: true, fill: 'bg/canvas' },
          V(platformerArt(), { name: 'art', x: 0, y: -(h * 0.55) * (w / 576) * 1.7, w, h: (w * 528) / 576 }),
        )
      if (id === 'hollowmere')
        return F(
          { name: 'Hollowmere thumbnail', w, h, clip: true, fill: 'bg/canvas' },
          V(rpgArt(), { name: 'art', x: 0, y: -(h * 0.35) * (w / 552) * 1.7, w, h: (w * 528) / 552 }),
        )
      if (id === 'rooftops') return sceneCard(w, h, { vy: 260, name: 'Rooftops thumbnail' })
      return F(
        { name: 'Tile sketch thumbnail', w, h, clip: true, fill: '#1b2230' },
        F({ x: 24, y: h - 40, w: w - 48, h: 16, fill: '#5a4636' }),
        F({ x: 24, y: h - 44, w: w - 48, h: 5, fill: '#6fae5b' }),
        F({ x: w * 0.3, y: h * 0.4, w: 56, h: 12, fill: '#5a4636' }),
      )
    }
    const kindColor = {
      Platformer: '#5fbf7a',
      'Top-down RPG': '#e0a54a',
      Blank: '#8e8c85',
      'FloorFifty stage': '#4a9ae0',
    }
    const SEL = 0
    const card = (pr, i) => {
      const col = i % 2
      const rowI = Math.floor(i / 2)
      const sel = i === SEL
      const warn = pr.state === 'warn'
      return C(
        {
          name: `project/${pr.id}`,
          x: 24 + col * 293,
          y: 72 + rowI * 238,
          w: 269,
          h: 222,
          gap: 0,
          r: 'radius/lg',
          fill: 'bg/surface',
          stroke: sel ? 'accent/default' : 'border/default',
          sw: sel ? 2 : 1,
          clip: true,
          shadow: sel ? 'card' : undefined,
        },
        thumb(pr.id, 269, 140),
        C(
          { w: 'fill', h: 'fill', pad: [10, 12], gap: 3 },
          R(
            { w: 'fill', gap: 8 },
            T(pr.name, { style: 'Title/15' }),
            spacer(),
            warn
              ? pill('1 warning', { color: 'state/warn', icon: 'warn', h: 22, pad: 8 })
              : pill('Valid', { color: 'state/ok', icon: 'check', h: 22, pad: 8 }),
          ),
          R(
            { w: 'fill', gap: 6 },
            pill(pr.kind, { color: kindColor[pr.kind], h: 20, pad: 8 }),
            T(pr.file, { style: 'Mono/11', color: 'text/faint', w: 'fill', trunc: true }),
          ),
          T(pr.stats, { style: 'Mono/11', color: 'text/dim', w: 'fill', trunc: true }),
        ),
      )
    }
    const tmpl = (icon, name, sub, i, tag) =>
      C(
        {
          name: `template/${name}`,
          x: 24 + i * 143,
          y: 616,
          w: 135,
          h: 104,
          pad: 12,
          gap: 5,
          r: 'radius/lg',
          fill: 'bg/surface',
          stroke: 'border/default',
        },
        R(
          { w: 'fill', gap: 6 },
          I(icon, { size: 22, color: 'accent/default' }),
          spacer(),
          tag ? pill(tag, { color: 'text/dim', h: 18, pad: 6, mono: true }) : null,
        ),
        T(name, { style: 'Body/13 Medium', w: 'fill', trunc: true }),
        T(sub, { style: 'Mono/11', color: 'text/dim', w: 'fill', trunc: true }),
      )
    const src = (icon, title, sub, sel) =>
      R(
        {
          name: `source/${title}`,
          w: 'fill',
          h: 56,
          pad: [0, 10],
          gap: 10,
          r: 'radius/md',
          fill: sel ? alpha('accent/default', 0.12) : null,
          stroke: sel ? alpha('accent/default', 0.6) : null,
        },
        I(icon, { size: 20, color: sel ? 'accent/default' : 'text/dim' }),
        C(
          { w: 'fill', gap: 0 },
          T(title, { style: 'Body/13 Medium', w: 'fill', trunc: true }),
          T(sub, { style: 'Mono/11', color: 'text/dim', w: 'fill', trunc: true }),
        ),
      )
    const panel = region(
      'sources panel',
      0,
      52,
      264,
      782,
      { lay: 'col' },
      R({ w: 'fill', h: 48, pad: [0, 16] }, eyebrow('Open from')),
      C(
        { w: 'fill', pad: [0, 8], gap: 2 },
        src('box', 'This workspace', '4 projects · browser storage', true),
        src('folder', 'mossgate/', 'Folder · read and write', false),
        src('file', 'Files…', 'Pick .af2d.json or stage .toml', false),
      ),
      spacer(),
      C(
        { name: 'storage', w: 'fill', pad: 16, gap: 8 },
        F({ w: 'fill', h: 1, fill: 'border/default' }),
        eyebrow('Storage'),
        R({ w: 'fill', gap: 8 }, dot('state/ok', 8), T('Autosave on', { style: 'Body/13' })),
        R({ w: 'fill', gap: 8 }, dot('state/ok', 8), T('Persistent storage granted', { style: 'Body/13' })),
        T('Edits are kept in a journal until you export, so a crash never loses them.', {
          style: 'Label/12',
          color: 'text/dim',
          w: 'fill',
          lh: 16,
        }),
      ),
    )
    const centre = region(
      'projects',
      264,
      52,
      610,
      782,
      { fill: 'bg/app' },
      T('Projects', { x: 24, y: 24, style: 'Display/20' }),
      T('4 in this workspace', { x: 120, y: 29, style: 'Body/13', color: 'text/dim' }),
      R(
        { x: 366, y: 16, w: 220, h: 44 },
        inputBox('Search projects', { icon: 'search', dim: true, w: 'fill' }),
      ),
      G.projects.map(card),
      T('START A NEW PROJECT', { x: 24, y: 590, style: 'Eyebrow/11', color: 'text/dim' }),
      tmpl('layers', 'Platformer', 'side view', 0),
      tmpl('world', 'Top-down RPG', 'maps · NPCs', 1),
      tmpl('file', 'Blank', 'own layers', 2),
      tmpl('cloud', 'FloorFifty stage', 'stage TOML', 3, 'profile'),
      T(
        'Templates are starting definitions: a profile you add (a game’s stage format) appears here beside them.',
        { x: 24, y: 736, w: 560, style: 'Label/12', color: 'text/dim', lh: 17 },
      ),
    )
    const pr = G.projects[SEL]
    const inspector = region(
      'summary',
      874,
      52,
      320,
      782,
      { lay: 'col' },
      C(
        { w: 'fill', h: 'fill', pad: 16, gap: 12 },
        F(
          { name: 'preview', w: 288, h: 168, r: 12, clip: true, fill: 'bg/canvas' },
          V(platformerArt(), { name: 'art', x: 0, y: -84, w: 288, h: 264 }),
        ),
        R(
          { w: 'fill', gap: 8 },
          T(pr.name, { style: 'Display/20' }),
          spacer(),
          pill('Valid', { color: 'state/ok', icon: 'check' }),
        ),
        C(
          { w: 'fill', gap: 0 },
          kv('File', 'mossgate.af2d.json'),
          kv('Template', 'Platformer', { mono: false }),
          kv('Levels', '5'),
          kv('Layers', '4'),
          kv('Entities', '6 definitions'),
          kv('Tilesets', '1 (placeholder)', { mono: false }),
          kv('Modified', pr.when, { mono: false }),
        ),
        callout(
          'ok',
          'No errors',
          'Opens clean. The tileset is a generated placeholder: import your own image any time.',
        ),
        spacer(),
        btn('Open', { kind: 'primary', h: 48, icon: 'external', w: 'fill' }),
        R(
          { w: 'fill', gap: 8 },
          btn('Duplicate', { icon: 'copy', w: 'fill' }),
          btn('Export', { icon: 'download', w: 'fill' }),
        ),
        btn('Delete from workspace', { kind: 'danger', icon: 'trash', w: 'fill' }),
      ),
    )
    const top = region(
      'topbar',
      0,
      0,
      1194,
      52,
      { lay: 'row', ay: 'center', pad: [0, 8, 0, 16], gap: 10 },
      F(
        { name: 'mark', w: 28, h: 28, r: 8, fill: 'accent/default' },
        T('A', { x: 9, y: 5, style: 'Title/15', color: 'accent/ink' }),
      ),
      T('Automata Editor', { style: 'Title/15' }),
      spacer(),
      pill('Workspace · autosave on', { color: 'state/ok', dot: true, h: 32, pad: 12 }),
      btn('Open…', { icon: 'folder' }),
      btn('New project', { kind: 'primary', h: 48, icon: 'plus' }),
    )
    return F(
      { name: 'Home · projects · iPad landscape', w: 1194, h: 834, fill: 'bg/app', clip: true },
      top,
      panel,
      centre,
      inspector,
      line(0, 51, 1194, 1),
      line(263, 52, 1, 782),
      line(873, 52, 1, 782),
    )
  },
})

// ── Level · iPad portrait ──
screens.push({
  id: 'level-portrait',
  page: '2D · Level',
  name: 'Level · Hollowmere · Village · iPad portrait',
  w: 834,
  h: 1194,
  note: 'The same map in the medium shell: the canvas takes the full width, layers open as a drawer, the palette is a bottom sheet above the tab bar, and the tools float within reach of the Pencil hand. Ground, a plain tiles layer, is selected, so the palette is the tileset; the brush footprint follows the Pencil.',
  build: (S, P) => {
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
      panelHead,
      checksPill,
      layerRowG,
      NAV,
      TOOLS,
      rpgArt,
      RPG,
      chip,
      label,
    } = P
    const s = RPG.s
    const ox = 282
    const oy = 110
    const cx = (c) => ox + c * s
    const cy = (r) => oy + r * s
    const top = region(
      'topbar',
      0,
      0,
      834,
      52,
      { lay: 'row', ay: 'center', pad: [0, 8], gap: 8 },
      ib('layers', { on: true }),
      C(
        { gap: 0 },
        T('Village', { style: 'Title/15' }),
        T('hollowmere.af2d.json', { style: 'Mono/11', color: 'text/faint' }),
      ),
      spacer(),
      ib('undo'),
      ib('redo', { disabled: true }),
      checksPill('Checks ok', 'state/ok'),
      ib('slider'),
      btn('Export', { kind: 'primary', h: 48, icon: 'download' }),
    )
    const canvas = region(
      'canvas',
      0,
      52,
      834,
      910,
      { fill: 'bg/canvas' },
      F({
        name: 'level bounds',
        x: ox - 1,
        y: oy - 1,
        w: 554,
        h: 530,
        stroke: alpha('accent/default', 0.45),
        sw: 1,
      }),
      V(rpgArt(), { name: 'level', x: ox, y: oy, w: 552, h: 528 }),
      F({
        name: 'brush footprint',
        x: cx(12),
        y: cy(11),
        w: 48,
        h: 48,
        fill: alpha('#cfae74', 0.55),
        stroke: 'accent/default',
        sw: 2,
      }),
      R(
        {
          name: 'brush tag',
          x: cx(12) + 54,
          y: cy(11) - 4,
          h: 24,
          pad: [0, 8],
          r: 6,
          fill: 'accent/default',
        },
        T('path · 2×2 · 12, 11', { style: 'Mono/11', color: 'accent/ink', wt: 600 }),
      ),
      R(
        {
          name: 'floating tools',
          x: 379,
          y: 836,
          h: 56,
          pad: [0, 6],
          gap: 2,
          r: 28,
          fill: 'bg/surface',
          stroke: 'border/strong',
          shadow: 'card',
        },
        TOOLS.map(([ic], i) => ib(ic, { on: i === 1 })),
      ),
      chip(316, 8, 'search', '150%', { name: 'zoom chip' }),
      chip(392, 8, 'magnet', 'snap · 16 px', { name: 'grid chip' }),
    )
    const drawer = region(
      'layers drawer',
      0,
      52,
      300,
      910,
      { lay: 'col' },
      panelHead('Layers', ib('plus'), ib('close')),
      C(
        { name: 'layer list', w: 'fill', pad: [0, 8], gap: 2 },
        layerRowG('box', 'Entities', 'Entities · 8 definitions', 'layer/entities'),
        layerRowG('image', 'Props', 'Objects · hollow-props', 'layer/sky'),
        layerRowG('sparkle', 'Walls art', 'Auto · from Walls', 'layer/city', { locked: true }),
        layerRowG('grid', 'Walls', 'IntGrid · 3 values', 'layer/intgrid', { locked: true }),
        layerRowG('tile', 'Ground', 'Tiles · hollow-terrain', 'layer/tiles', { sel: true }),
      ),
      R(
        { w: 'fill', h: 44, pad: [8, 16, 0, 16] },
        eyebrow('Layer'),
        spacer(),
        T('Ground', { style: 'Mono/12', color: 'text/dim' }),
      ),
      C(
        { w: 'fill', pad: [0, 16], gap: 8 },
        R(
          { w: 'fill', gap: 6 },
          pill('Opacity 100%', { color: 'text/dim', h: 32, pad: 12 }),
          pill('Grid 16 px', { color: 'text/dim', h: 32, pad: 12 }),
        ),
        T('Palette and the layer’s other settings are in the sheet below.', {
          style: 'Label/12',
          color: 'text/dim',
          w: 'fill',
          lh: 17,
        }),
      ),
    )
    const TILES = [
      ['grass', '#4f8a47'],
      ['grass 2', '#55904c'],
      ['path', '#cfae74'],
      ['path edge', '#a8864f'],
      ['water', '#3b82c4'],
      ['shore', '#8fc3ee'],
      ['stone', '#8a93a5'],
      ['planks', '#b98b54'],
      ['roof', '#b5533c'],
      ['wall', '#e0d2ae'],
    ]
    const tileBtn = ([n, c], i) =>
      F(
        {
          name: `tile ${n}`,
          x: 16 + i * 52,
          y: 76,
          w: 44,
          h: 44,
          r: 6,
          fill: c,
          stroke: i === 2 ? 'accent/default' : 'border/default',
          sw: i === 2 ? 3 : 1,
        },
        i === 3 ? F({ x: 0, y: 0, w: 44, h: 6, fill: '#cfae74' }) : null,
        i === 5 ? F({ x: 0, y: 36, w: 44, h: 8, fill: '#3b82c4' }) : null,
        i === 1 ? F({ x: 12, y: 14, w: 3, h: 9, fill: '#3a7038' }) : null,
      )
    const sheet = F(
      { name: 'palette sheet', x: 0, y: 962, w: 834, h: 168, fill: 'bg/surface' },
      F({ x: 0, y: 0, w: 834, h: 1, fill: 'border/default' }),
      F({ name: 'handle', x: 399, y: 8, w: 36, h: 4, r: 2, fill: 'border/strong' }),
      R(
        { x: 0, y: 20, w: 834, h: 44, pad: [0, 16], gap: 10 },
        eyebrow('Tileset · hollow-terrain'),
        T('placeholder', { style: 'Mono/11', color: 'text/faint' }),
        spacer(),
        pill('Flip X', { color: 'text/dim', h: 32, pad: 12 }),
        pill('Flip Y', { color: 'text/dim', h: 32, pad: 12 }),
        pill('Random', { color: 'text/dim', h: 32, pad: 12 }),
      ),
      TILES.map(tileBtn),
      T('Tap a tile, then draw with the Pencil. Drag across the strip for more.', {
        x: 16,
        y: 132,
        style: 'Label/12',
        color: 'text/dim',
      }),
    )
    const tabs = region(
      'tab bar',
      0,
      1130,
      834,
      64,
      { lay: 'row', fill: 'bg/surface' },
      ...NAV.map(([ic, text], i) =>
        C(
          {
            name: `tab/${text}`,
            w: 'fill',
            h: 64,
            ax: 'center',
            ay: 'center',
            gap: 2,
            fill: i === 0 ? alpha('accent/default', 0.13) : null,
          },
          I(ic, { size: 22, color: i === 0 ? 'accent/default' : 'text/dim' }),
          T(text, { size: 11, wt: 500, color: i === 0 ? 'accent/default' : 'text/dim' }),
        ),
      ),
    )
    return F(
      { name: 'Level · Hollowmere · Village · iPad portrait', w: 834, h: 1194, fill: 'bg/app', clip: true },
      top,
      canvas,
      drawer,
      sheet,
      tabs,
      line(0, 51, 834, 1),
      line(299, 52, 1, 910),
      line(0, 1130, 834, 1),
    )
  },
})

// ── Checks ──
screens.push({
  id: 'checks',
  page: '2D · States',
  name: 'Checks · Hollowmere · a broken link · iPad landscape',
  w: 1194,
  h: 834,
  note: 'Checks after the Inn’s entrance was deleted: diagnostics by severity, each tied to an object. The selected one is a door whose target no longer exists; the canvas shows it in place and the inspector offers the fix. The same panel lists the FloorFifty profile’s diagnostics for a stage.',
  build: (S, P) => {
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
      rail,
      topbar,
      NAV,
      diagRow,
      rpgArt,
      fieldRow,
      field,
      inputBox,
      entityHead,
      callout,
      label,
    } = P
    const DIAGS = [
      {
        sev: 'error',
        code: 'brokenRef',
        msg: 'Door “Inn door” points at inn-door in Inn, which no longer exists.',
        path: 'village · d3k7p0a1 · target',
        fix: true,
      },
      {
        sev: 'error',
        code: 'fieldMissing',
        msg: 'Warp has no target.',
        path: 'village · w9x2m4c6 · target',
        fix: true,
      },
      {
        sev: 'warning',
        code: 'entityOutOfBounds',
        msg: 'Chest is outside Village (368 × 352 px).',
        path: 'village · entities · c2h8q1r5',
        fix: true,
      },
      {
        sev: 'warning',
        code: 'tilesetImageChanged',
        msg: 'hollow-terrain.png is 160 × 64; the project recorded 144 × 64.',
        path: 'tilesets · hollow-terrain',
        fix: false,
      },
      {
        sev: 'info',
        code: 'ruleShadowed',
        msg: 'Rule “Wall corner” never fires: “Wall edge” matches first.',
        path: 'walls-art · rules',
        fix: false,
      },
      {
        sev: 'info',
        code: 'unusedDefinition',
        msg: 'No enemy has been placed yet.',
        path: 'entities · enemy',
        fix: false,
      },
    ]
    const panel = region(
      'checks panel',
      56,
      52,
      264,
      782,
      { lay: 'col' },
      panelHead('Checks', pill('2 errors', { color: 'state/bad', h: 24, pad: 8 })),
      C({ w: 'fill', pad: [0, 12], gap: 8 }, seg(['All 6', 'Errors 2', 'Warn 2', 'Info 2'], 1)),
      C(
        { name: 'diagnostics', w: 'fill', pad: [8, 8], gap: 6 },
        DIAGS.map((d, i) => diagRow(d, { sel: i === 0 })),
      ),
    )
    // the door in place at 2x, centred in a 522 x 360 card
    const door = [261 - 28, 132, 56, 48]
    const canvas = region(
      'canvas',
      320,
      52,
      554,
      782,
      { fill: 'bg/canvas' },
      R(
        { name: 'header', x: 0, y: 0, w: 554, h: 52, pad: [0, 16], gap: 10, fill: 'bg/surface' },
        T('Village', { style: 'Title/15' }),
        T('d3k7p0a1', { style: 'Mono/11', color: 'text/faint' }),
        spacer(),
        btn('Show in Level', { icon: 'layers', h: 36 }),
      ),
      F(
        {
          name: 'context',
          x: 16,
          y: 68,
          w: 522,
          h: 360,
          r: 'radius/lg',
          fill: '#14161c',
          stroke: 'border/default',
          clip: true,
        },
        V(rpgArt(), { name: 'map', x: -579, y: -156, w: 1104, h: 1056 }),
        F({
          name: 'broken door',
          x: 261 - 26,
          y: 132,
          w: 52,
          h: 48,
          r: 4,
          fill: alpha('state/bad', 0.22),
          stroke: 'state/bad',
          sw: 2,
        }),
        V(
          '<svg xmlns="http://www.w3.org/2000/svg" width="522" height="360" viewBox="0 0 522 360"><path d="M287 150C340 150 360 120 410 84" fill="none" stroke="#e0645a" stroke-width="2" stroke-dasharray="6 5"/><path d="M402 76l12 6l-8 10" fill="none" stroke="#e0645a" stroke-width="2"/></svg>',
          { name: 'link', x: 0, y: 0, w: 522, h: 360 },
        ),
        R(
          {
            name: 'missing',
            x: 380,
            y: 52,
            h: 28,
            pad: [0, 10],
            gap: 6,
            r: 14,
            fill: 'bg/surface',
            stroke: 'state/bad',
          },
          I('warn', { size: 14, color: 'state/bad' }),
          T('inn-door · missing', { style: 'Mono/11', color: 'state/bad' }),
        ),
      ),
      C(
        {
          x: 16,
          y: 448,
          w: 522,
          gap: 10,
          pad: 16,
          r: 'radius/lg',
          fill: 'bg/surface',
          stroke: alpha('state/bad', 0.5),
        },
        R(
          { w: 'fill', gap: 8 },
          I('warn', { size: 18, color: 'state/bad' }),
          T('brokenRef', { style: 'Mono/12', color: 'state/bad', wt: 600 }),
          spacer(),
          pill('error', { color: 'state/bad', h: 22, pad: 8 }),
        ),
        T('Door “Inn door” points at inn-door in Inn, which no longer exists.', {
          style: 'Body/13',
          w: 'fill',
          lh: 19,
        }),
        T(
          'Deleting an entity leaves links to it behind on purpose, so you see them here instead of the game finding a dead door later.',
          { style: 'Label/12', color: 'text/dim', w: 'fill', lh: 17 },
        ),
        R(
          { w: 'fill', gap: 8 },
          btn('Choose target', { kind: 'primary', h: 48, icon: 'link', w: 'fill' }),
          btn('Clear link', { icon: 'trash', w: 'fill' }),
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
      tabs([{ label: 'Entity' }, { label: 'Level' }, { label: 'Checks', badge: '2', tone: 'state/bad' }], 0),
      F({ w: 'fill', h: 1, fill: 'border/default' }),
      C(
        { name: 'fields', w: 'fill', h: 'fill', pad: 12, gap: 8, clip: true },
        entityHead('door', 'Door', '#4fb3c8', 'd3k7p0a1', 'Entities'),
        field('x', '408', { unit: 'px' }),
        field('y', '168', { unit: 'px' }),
        fieldRow('facing', seg(['N', 'E', 'S', 'W'], 2)),
        fieldRow(
          'target',
          R(
            { w: 'fill', h: 44, pad: [0, 12], gap: 8, r: 'radius/md', fill: 'bg/field', stroke: 'state/bad' },
            I('link', { size: 16, color: 'state/bad' }),
            T('inn-door', { style: 'Mono/12', color: 'state/bad', w: 'fill' }),
            I('chevron-down', { size: 16, color: 'text/dim' }),
          ),
          { bad: true },
        ),
        callout(
          'bad',
          'Target missing',
          'Inn has no entity inn-door. Pick another spawn or clear the link.',
          { action: btn('Choose target', { kind: 'ghost', icon: 'link', h: 36, pad: 0 }) },
        ),
      ),
      R(
        { name: 'footer', w: 'fill', h: 68, pad: [12, 12], gap: 8 },
        btn('Duplicate', { icon: 'copy', w: 'fill' }),
        btn('Delete', { kind: 'danger', icon: 'trash', w: 'fill' }),
      ),
    )
    return F(
      {
        name: 'Checks · Hollowmere · a broken link · iPad landscape',
        w: 1194,
        h: 834,
        fill: 'bg/app',
        clip: true,
      },
      topbar(1194, {
        title: 'Village',
        file: 'hollowmere.af2d.json',
        kind: 'Top-down RPG',
        dirty: true,
        checks: '2 errors',
        tone: 'state/bad',
        preview: false,
      }),
      rail(782, 4, NAV),
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

// ── Export ──
screens.push({
  id: 'export',
  page: '2D · States',
  name: 'Export · working file and AF content',
  w: 720,
  h: 860,
  note: 'Export offers the lossless project file and the AF content for the game (project.toml, world.toml, one file per level). Errors never stop an export: Download, Share and Copy still work, and only writing into a game folder waits until they are fixed.',
  build: (S, P) => {
    const { F, R, C, T, I, alpha, spacer, eyebrow, pill, btn, callout, dialog, modalFrame } = P
    const target = (name, files, size, on, sub) =>
      R(
        {
          name: `target/${name}`,
          w: 'fill',
          pad: [12, 12],
          gap: 12,
          r: 'radius/md',
          fill: on ? alpha('accent/default', 0.08) : 'bg/field',
          stroke: on ? alpha('accent/default', 0.6) : 'border/default',
        },
        F(
          { w: 24, h: 24, r: 6, fill: on ? 'accent/default' : null, stroke: on ? null : 'border/strong' },
          on ? I('check', { size: 16, color: 'accent/ink', x: 4, y: 4, sw: 2.6 }) : null,
        ),
        C(
          { w: 'fill', gap: 2 },
          T(name, { style: 'Body/13 Medium' }),
          T(sub, { style: 'Label/12', color: 'text/dim', w: 'fill', lh: 16 }),
          T(files, { style: 'Mono/11', color: 'text/faint', w: 'fill', trunc: true }),
        ),
        T(size, { style: 'Mono/12', color: 'text/dim' }),
      )
    const fileRow = (name, size, note) =>
      R(
        { w: 'fill', h: 28, pad: [0, 10], gap: 10 },
        I('file', { size: 14, color: 'text/dim' }),
        T(name, { style: 'Mono/12', w: 'fill', trunc: true }),
        T(note || '', { style: 'Mono/11', color: 'text/faint' }),
        T(size, { style: 'Mono/12', color: 'text/dim', w: 56, align: 'right' }),
      )
    const body = [
      eyebrow('What to export'),
      target(
        'Project file',
        'hollowmere.af2d.json',
        '41 KB',
        true,
        'Everything, lossless. Open it again here, in this editor, any time.',
      ),
      target(
        'AF content',
        'project.toml · world.toml · levels/ × 5',
        '38 KB',
        true,
        'What the game reads: tile rows, entities with their fields, links. Auto-layers are exported as resolved tiles.',
      ),
      C(
        {
          name: 'files',
          w: 'fill',
          pad: [6, 0],
          gap: 0,
          r: 'radius/md',
          fill: 'bg/field',
          stroke: 'border/default',
          clip: true,
        },
        R({ w: 'fill', h: 24, pad: [0, 10] }, eyebrow('8 files')),
        fileRow('hollowmere.af2d.json', '41.2 KB'),
        fileRow('project.toml', '2.1 KB'),
        fileRow('world.toml', '1.4 KB'),
        fileRow('levels/village.toml', '9.8 KB'),
        fileRow('… 4 more levels', '', ''),
      ),
      callout(
        'warn',
        '2 errors',
        'The game would reject a door and a warp with no target. You can still export; writing into a folder waits until Checks is clear.',
      ),
      eyebrow('Export to'),
      R(
        { w: 'fill', gap: 8 },
        btn('Download', { icon: 'download', w: 'fill', kind: 'primary', h: 48 }),
        btn('Share', { icon: 'external', w: 'fill' }),
        btn('Copy', { icon: 'copy', w: 'fill' }),
      ),
    ]
    return modalFrame(
      'Export · working file and AF content',
      640,
      780,
      dialog('export dialog', 640, 780, 'Export project', body, [
        btn('Cancel', { kind: 'ghost' }),
        btn('Write to hollowmere/', { icon: 'save', disabled: true }),
      ]),
    )
  },
})

// ── Recovery dialog ──
screens.push({
  id: 'recover',
  page: '2D · States',
  name: 'Recover · unsaved work',
  w: 600,
  h: 480,
  note: 'After a crash or a closed tab the journal is offered back before anything else loads. Restore replays the saved edits; Discard drops them and opens the file on disk. The same dialog serves every profile.',
  build: (S, P) => {
    const { F, R, C, T, I, alpha, spacer, btn, kv, dialog, modalFrame } = P
    const body = [
      R(
        { w: 'fill', gap: 14, ay: 'start' },
        R(
          { w: 44, h: 44, ax: 'center', ay: 'center', r: 22, fill: alpha('accent/default', 0.16) },
          I('rotate', { size: 22, color: 'accent/default' }),
        ),
        C(
          { w: 'fill', gap: 4 },
          T('Restore your unsaved work?', { style: 'Display/20', w: 'fill' }),
          T(
            'Hollowmere was open when the app closed. Its edits were saved to the journal as you made them.',
            { style: 'Body/13', color: 'text/dim', w: 'fill', lh: 19 },
          ),
        ),
      ),
      C(
        { w: 'fill', pad: [8, 12], gap: 0, r: 'radius/md', fill: 'bg/field', stroke: 'border/default' },
        kv('Project', 'Hollowmere', { mono: false }),
        kv('Last autosave', '12:38'),
        kv('Edits saved', '7'),
        kv('File on disk', 'unchanged since 11:02', { mono: false }),
      ),
    ]
    return modalFrame(
      'Recover · unsaved work',
      520,
      400,
      dialog('recover dialog', 520, 400, 'Recover', body, [
        btn('Discard', {}),
        btn('Restore edits', { kind: 'primary', h: 48, icon: 'rotate' }),
      ]),
    )
  },
})

// ── Open failed: a newer file ──
screens.push({
  id: 'open-failed',
  page: '2D · States',
  name: 'Open failed · a newer editor’s file',
  w: 720,
  h: 600,
  note: 'A project from a newer editor is opened read-only and never rewritten, so an older editor cannot quietly drop what it does not understand. A file that is not a project, or has keys this editor does not know, gets the same treatment with its own message.',
  build: (S, P) => {
    const { F, R, C, T, I, alpha, spacer, btn, dialog, modalFrame, callout, eyebrow } = P
    const rows = [
      [1, '{', false],
      [2, '\u00a0\u00a0"format": "af2d",', false],
      [3, '\u00a0\u00a0"version": 3,', true],
      [4, '\u00a0\u00a0"name": "Mossgate",', false],
      [5, '\u00a0\u00a0"template": "platformer",', false],
    ]
    const body = [
      T('mossgate.af2d.json is from a newer editor', { style: 'Display/20', w: 'fill' }),
      R(
        { w: 'fill', gap: 8 },
        I('warn', { size: 16, color: 'state/warn' }),
        T('Version 3. This editor reads up to version 1.', {
          style: 'Mono/12',
          color: 'state/warn',
          w: 'fill',
        }),
      ),
      C(
        {
          name: 'source',
          w: 'fill',
          pad: [8, 0],
          gap: 0,
          r: 'radius/md',
          fill: 'bg/field',
          stroke: 'border/default',
          clip: true,
        },
        R({ w: 'fill', h: 24, pad: [0, 12] }, eyebrow('Read only')),
        ...rows.map(([n, text, bad]) =>
          R(
            { w: 'fill', h: 22, pad: [0, 12], gap: 12, fill: bad ? alpha('state/warn', 0.14) : null },
            T(String(n), {
              style: 'Mono/12',
              color: bad ? 'state/warn' : 'text/faint',
              w: 20,
              align: 'right',
            }),
            T(text || ' ', {
              style: 'Mono/12',
              color: bad ? 'text/primary' : 'text/dim',
              w: 'fill',
              trunc: true,
            }),
          ),
        ),
      ),
      callout(
        'info',
        'Nothing was written',
        'The file on disk is unchanged. You can look at it here, copy its text, or open it with the newer editor.',
      ),
    ]
    return modalFrame(
      'Open failed · a newer editor’s file',
      640,
      520,
      dialog('open failed dialog', 640, 520, 'Open', body, [
        btn('Copy text', { icon: 'copy' }),
        btn('Open another file', { kind: 'primary', h: 48, icon: 'folder' }),
      ]),
    )
  },
})

// ── Refusal: a change that would invalidate instances ──
screens.push({
  id: 'refuse',
  page: '2D · States',
  name: 'Refused · a field change that would break instances',
  w: 640,
  h: 500,
  note: 'The definitions editor never loses data silently: retyping a field, or tightening its bounds, is refused with the exact instances that would stop validating. Deleting a definition that is in use shows the same list with a Delete anyway action that removes the uses as one undo step.',
  build: (S, P) => {
    const { F, R, C, T, I, alpha, spacer, btn, dialog, modalFrame, eyebrow, pill } = P
    const inst = (name, where, value) =>
      R(
        {
          name: `instance/${name}`,
          w: 'fill',
          h: 48,
          pad: [0, 12],
          gap: 10,
          r: 'radius/md',
          fill: 'bg/field',
          stroke: 'border/default',
        },
        R(
          { w: 28, h: 28, ax: 'center', r: 7, fill: alpha('#e0a54a', 0.22) },
          I('chat', { size: 16, color: '#e0a54a' }),
        ),
        C(
          { w: 'fill', gap: 0 },
          T(name, { style: 'Body/13 Medium' }),
          T(where, { style: 'Mono/11', color: 'text/dim' }),
        ),
        pill(value, { color: 'state/bad', mono: true, h: 22, pad: 8 }),
      )
    const body = [
      T('facing can’t become an int yet', { style: 'Display/20', w: 'fill' }),
      T('2 NPCs hold a value that would stop being valid. Nothing was changed.', {
        style: 'Body/13',
        color: 'text/dim',
        w: 'fill',
        lh: 19,
      }),
      eyebrow('Instances that would break'),
      inst('Maren', 'Village · b4t7w2n9', 'facing = S'),
      inst('Old Tobe', 'Village · n6k1d8y3', 'facing = W'),
      T('Change those two to a number first, or keep the type. Renaming a field keeps every value.', {
        style: 'Label/12',
        color: 'text/dim',
        w: 'fill',
        lh: 17,
      }),
    ]
    return modalFrame(
      'Refused · a field change that would break instances',
      560,
      420,
      dialog('refusal dialog', 560, 420, 'Change field', body, [
        btn('Show in Level', { icon: 'layers' }),
        btn('Keep the type', { kind: 'primary', h: 48 }),
      ]),
    )
  },
})
