// The sample data behind the suite mockups. Two games mount the same editors:
// - The Last Light's Bay scene (act two), read from the game's own files at PixiJS3D_Experiment_001 (main at 92e6704).
//   Names, times, values and bounds are the file's. The game keeps them in TypeScript today; the mockups show them in
//   the AF content files a port would use (`paths` below; content spec §3.4 tuning names are UPPER_SNAKE).
// - FloorFifty, read from SNEKPRTY/FloorFifty (main at ee5d44e): `content/tuning.toml` and `content/juice.toml` as they
//   are, with the ranges FloorFifty declares in code.
// Measured results (fairness, checks, token counts) are illustrative: the mockups do not run either game.
//
// Self-contained on purpose (no imports, no outer variables): build.mjs stringifies it with the parts, so the same
// source runs inside `use_figma`.

export function suiteData() {
  const tunable = (n, v, min, max, u, note, extra = {}) => ({ n, v, min, max, u, note, ...extra })

  // Where each file of the Bay lives once The Last Light is on AF content (proposed; today the game has
  // src/scenes/bay/*.ts, src/audio/cues.ts, src/feel/effects.ts and src/render/figure/characters/*.json).
  const paths = {
    cutscenes: 'content/scenes/bay/cutscenes.toml',
    tuning: 'content/scenes/bay/tuning.toml',
    story: 'content/scenes/bay/story.toml',
    dialogues: 'content/scenes/bay/dialogues.toml',
    puzzle: 'content/scenes/bay/puzzle.toml',
    agents: 'content/scenes/bay/agents.toml',
    cues: 'content/audio/cues.toml',
    feel: 'content/feel/effects.toml',
    character: 'content/characters/ada.json',
    art: 'content/art/ada/character.json',
    blockout: 'content/levels/bay/blockout.json',
  }

  // The game's editor list (`content/editors.toml`, proposed): which editor opens a file, the gates a change to it
  // reopens and the checks it runs. Gate pills read this; the editor never invents a gate. The Last Light's rows follow
  // its editor.manifest.json and suite spec §6.6 (agents reopen S-G1 and S-G3); FloorFifty lists no gates.
  const editors = {
    'The Last Light': [
      [
        'content/scenes/*/cutscenes.toml',
        'sequence',
        ['C-G1'],
        ['cutscene_lint', 'cutscene_audit', 'direction_audit'],
      ],
      [
        'content/scenes/*/story.toml',
        'writer',
        ['N-G1'],
        ['narrative_lint', 'narrative_beats', 'narrative_hints'],
      ],
      [
        'content/scenes/*/dialogues.toml',
        'writer',
        ['N-G1'],
        ['narrative_dialogue_lint', 'narrative_stance'],
      ],
      [
        'content/scenes/*/tuning.toml',
        'tuner',
        ['S-G2'],
        ['systems_validate', 'systems_fairness', 'systems_playtest'],
      ],
      [
        'content/scenes/*/puzzle.toml',
        'schematic',
        ['P-G1'],
        ['puzzle_validate', 'puzzle_solve', 'puzzle_softlocks'],
      ],
      [
        'content/scenes/*/agents.toml',
        'schematic',
        ['S-G1', 'S-G3'],
        ['systems_validate', 'systems_emergent'],
      ],
      ['content/tools.toml', 'tuner', ['S-G2'], ['systems_validate']],
      ['content/audio/cues.toml', 'audio', ['Q-AUD'], ['audio_check']],
      ['content/feel/effects.toml', 'feel', ['Q-FEEL'], ['feel']],
      ['content/characters/*.json', 'studio', ['G1', 'G6'], ['character check']],
      [
        'content/art/*/character.json',
        'studio',
        ['G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7'],
        ['character check'],
      ],
      [
        'content/levels/*/blockout.json',
        'levels',
        ['E1', 'E2', 'E3', 'E4', 'LOOK-G1'],
        ['blockout generate'],
      ],
    ],
    FloorFifty: [
      ['content/tuning.toml', 'tuner', [], ['content check']],
      ['content/modes/*.toml', 'tuner', [], ['content check']],
      ['content/juice.toml', 'feel', [], ['content check']],
      ['content/stages/*.toml', 'levels', [], ['content check']],
    ],
  }
  const games = [
    { name: 'The Last Light', repo: 'mcthaydt/PixiJS3D_Experiment_001', scene: 'The Bay · act two' },
    { name: 'FloorFifty', repo: 'SNEKPRTY/FloorFifty', scene: 'Rooftops · Floors 20' },
  ]

  // src/scenes/bay/cutscenes.ts: `arrival`, as the timeline draws it (22 s, four shots A to D).
  const arrival = {
    id: 'arrival',
    dur: 22,
    shots: [
      {
        n: 'A',
        t0: 0,
        t1: 4.6,
        lens: [22, 24],
        ease: 'out',
        note: 'High over the well, craning down onto the clinic door',
      },
      {
        n: 'B',
        t0: 4.6,
        t1: 10,
        lens: [20, 20],
        ease: 'linear',
        note: 'Closer, across the dock, as she looks round the cold',
      },
      {
        n: 'C',
        t0: 10,
        t1: 15.7,
        lens: [28, 34],
        ease: 'smooth',
        note: 'The run sheet on the stretcher, tilting down onto it',
      },
      {
        n: 'D',
        t0: 15.7,
        t1: 22,
        lens: [20, 21],
        ease: 'linear',
        note: 'The Porter at the shutter, turning toward her voice',
      },
    ],
    ada: [
      { k: 'blk', t: 2.2, t1: 3, label: '', walk: true },
      { k: 'blk', t: 5, t1: 9.6, label: 'look' },
    ],
    porter: [
      { k: 'blk', t: 15.8, t1: 16.1, label: '', walk: true },
      { k: 'blk', t: 16.1, t1: 22, label: 'mutter' },
    ],
    lines: [
      {
        t: 4.6,
        t1: 10.2,
        who: 'Ada',
        id: 'bay.cutscene.arrival.1',
        text: 'The door locks behind me. It is colder out here than the night was.',
      },
      {
        t: 10.2,
        t1: 16.2,
        who: null,
        id: 'bay.cutscene.arrival.2',
        text: 'On the stretcher, a run sheet. PT: VOSS, A. (STAFF NURSE). DOA 04:17.',
      },
      {
        t: 16.2,
        t1: 22,
        who: 'The Porter',
        id: 'bay.cutscene.arrival.3',
        text: 'Cold. Always so cold. Any little flame, and I come to it like a moth.',
      },
    ],
    sound: [
      { t: 0.2, label: 'door' },
      { t: 15.7, label: 'rattle' },
    ],
    lights: [
      {
        lamp: 'bayFill',
        keys: [
          [10, 2.4],
          [15.65, 2.4],
          [15.7, 0.6],
        ],
      },
      {
        lamp: 'eastFill',
        keys: [
          [10, 0.9],
          [15.65, 0.9],
        ],
      },
    ],
    fade: [
      [0, 0],
      [21.3, 0],
      [22, 1],
    ],
  }

  // The scene's cutscenes (same file). Durations are the builder's; `dawn` is computed from where the Porter is.
  const cutscenes = [
    { id: 'arrival', sub: '22.0 s · 4 shots · 3 lines', tag: 'on entry from the clinic', icon: 'film' },
    { id: 'grapple', sub: 'close-up · Ada gives him the flame', tag: 'shared builder', icon: 'film' },
    { id: 'grappleCrew', sub: 'close-up · the crew, not the Porter', tag: 'shared builder', icon: 'film' },
    { id: 'caught', sub: '6.0 s · 2 shots · 1 line', tag: 'the Porter catches Ada', icon: 'film' },
    { id: 'caughtCrew', sub: '6.0 s · 2 shots · 1 line', tag: 'the crew catches Ada', icon: 'film' },
    { id: 'latched', sub: '10.0 s · 2 shots · 2 lines', tag: 'he is latched in', icon: 'film' },
    { id: 'dawn', sub: '20–23 s, computed · 6 shots', tag: 'the third crank', icon: 'film' },
  ]

  // src/scenes/bay/systems.ts TUNABLES (a selection, with the file's values, bounds and notes), named as AF tuning names.
  const tunables = {
    groups: [
      ['The Porter', 'person', 13],
      ['Warmth', 'bolt', 8],
      ['Noise', 'speaker', 7],
      ['Director', 'chart', 18],
      ['The crew', 'users', 22],
      ['Grapple', 'hand', 3],
    ],
    rows: [
      tunable(
        'LIGHTER_REACH',
        6,
        2,
        12,
        'm',
        'P1: a lit lighter draws him from this far (along open ways, not through walls)',
      ),
      tunable('TORCH_REACH', 8, 2, 14, 'm', 'P1: a lit rag torch draws him from this far'),
      tunable('DRUM_REACH', 12, 4, 16, 'm', 'P1: the burning oil drum draws him from this far'),
      tunable('BURNER_REACH', 12, 4, 16, 'm', 'P1: the lit gas burner draws him from this far'),
      tunable('ROUTINE_SPEED', 1, 0.5, 2, 'm/s', 'P6: his round (Ada walks 3 m/s)'),
      tunable('DRAWN_SPEED', 1.5, 0.5, 2.5, 'm/s', 'P1: going to a warmth'),
      tunable('TOUCH', 0.65, 0.3, 1, 'm', 'P5: how close he must come to catch Ada'),
      tunable(
        'EMBER_WARM',
        4,
        0,
        10,
        's',
        'P10: where a flame went out he warms this long, then resumes his round',
      ),
      tunable(
        'STEP_LOUDNESS',
        1.8,
        0,
        5,
        'm',
        "P4: how far Ada's footsteps carry; standing still she makes none",
        { locked: true },
      ),
      tunable(
        'SIGN_IN',
        17,
        0,
        30,
        's',
        'P11: as Ada arrives he signs her into the ledger this long at his first sitting',
      ),
    ],
  }

  // src/scenes/bay/dialogues.ts: bay.c1, the Porter's first conversation (lines are records in story.ts).
  const c1 = {
    id: 'bay.c1',
    nodes: [
      { id: 'hear', say: 4, choices: 3, x: 0 },
      { id: 'staff', say: 1, x: 1, stance: -1, set: 'porterMet = staff' },
      { id: 'unsure', say: 1, x: 1, stance: 0, set: 'porterMet = unsure' },
      { id: 'yours', say: 1, x: 1, stance: 1, set: 'porterMet = yours' },
      { id: 'end', say: 0, x: 2 },
    ],
  }

  // src/scenes/bay/puzzle.ts: the shutter's chain, as the schematic reads it.
  const puzzle = {
    goal: 'shutter = 3',
    facts: [
      ['drum', 'cold'],
      ['burner', 'false'],
      ['keysAt', 'porter'],
      ['padlock', 'true'],
      ['shutter', '0'],
      ['porterOut', 'false'],
    ],
    hints: ['warmth', 'keys', 'padlock', 'shutter'],
  }

  // FloorFifty: content/tuning.toml (values) against packages/shared/src/common/tuning.ts (code-owned ranges).
  // `layers`: the files that may override a name, in order (stages' courseTuning, then the mode's [tuning]).
  const ff = {
    tuning: [
      tunable('GRAVITY', -275, -1200, -100, 'u/s²', 'Pulls every racer down, every tick'),
      tunable(
        'BOUNCE_VELOCITY',
        268.2,
        100,
        1200,
        'u/s',
        'Applied on contact with any face of a floor, not only from above',
      ),
      tunable(
        'MAX_MOVE_SPEED',
        356,
        50,
        900,
        'u/s',
        'Fastest sideways speed; juice.toml lean.fullSpeed copies it',
      ),
      tunable('FAST_FALL_VELOCITY', -1341, -2000, -100, 'u/s', 'A held fast fall; a slam is 0.6 of it'),
      tunable(
        'PLAYER_WIDTH',
        59,
        16,
        96,
        'u',
        'The collision box, squarer than the 48 × 64 art sheet on purpose',
        { int: true },
      ),
      tunable(
        'PLAYER_HEIGHT',
        59,
        16,
        128,
        'u',
        'The collision box, squarer than the 48 × 64 art sheet on purpose',
        { int: true },
      ),
      tunable(
        'COURSE_FLOOR_COUNT',
        20,
        20,
        100,
        'floors',
        'Floors in one ascent, including the starting floor',
        {
          int: true,
          over: 'modes/infinite.toml · 50',
        },
      ),
    ],
    groups: [
      ['Movement', 'walk', 6],
      ['Floors', 'grid', 7],
      ['Course and race', 'flag', 4],
      ['Survival', 'chart', 12],
      ['Endless ramp', 'chart', 6],
    ],
    // content/juice.toml: each event and the channels it answers on.
    juice: {
      events: [
        ['bounce', { squash: '0.25', dust: '8 · 18 u', kick: '—', stop: '—', flash: '—', shake: '—' }],
        [
          'slam',
          {
            squash: '0.5',
            dust: '24 · ring · 6 sparks',
            kick: '10 u · 200 ms',
            stop: '50 ms',
            flash: '0.2',
            shake: '0.35',
          },
        ],
        ['collect', { squash: 'pop 1.08', dust: '8 · 16 u', kick: '—', stop: '—', flash: '—', shake: '—' }],
        ['wrap', { squash: '—', dust: '4 sparks', kick: '—', stop: '—', flash: '—', shake: '—' }],
        ['burst.spawn', { squash: '—', dust: '12 · 24 u', kick: '—', stop: '—', flash: '—', shake: '—' }],
        [
          'burst.finish',
          {
            squash: '—',
            dust: '40 · 12 sparks',
            kick: 'punch 0.045',
            stop: '—',
            flash: '0.45',
            shake: '0.6',
          },
        ],
      ],
      springs: [
        ['squash', 4, 0.35],
        ['lean', 3, 0.6],
        ['kick', 6, 0.4],
        ['word', 5, 0.45],
        ['jolt', 5, 0.3],
        ['hudPop', 5, 0.4],
      ],
    },
  }

  return {
    scene: { id: 'bay', name: 'The Bay', path: 'content/scenes/bay' },
    paths,
    editors,
    games,
    ff,
    arrival,
    cutscenes,
    tunables,
    c1,
    puzzle,
  }
}
