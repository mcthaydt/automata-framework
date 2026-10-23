// The sample data behind the suite mockups: The Last Light's Bay scene (act two), read from the game's own files at
// PixiJS3D_Experiment_001. Names, times, values and bounds are the file's. Measured results (fairness, checks, token
// counts) are illustrative: the mockups do not run the game.
//
// Self-contained on purpose (no imports, no outer variables): build.mjs stringifies it with the parts, so the same
// source runs inside `use_figma`.

export function suiteData() {
  const tunable = (n, v, min, max, u, note, extra = {}) => ({ n, v, min, max, u, note, ...extra })

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

  // src/scenes/bay/systems.ts TUNABLES (a selection, with the file's bounds and notes).
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
        'lighterReach',
        6,
        2,
        12,
        'm',
        'P1: a lit lighter draws him from this far (along open ways, not through walls)',
        { was: 8 },
      ),
      tunable('torchReach', 8, 2, 14, 'm', 'P1: a lit rag torch draws him from this far'),
      tunable('drumReach', 12, 4, 16, 'm', 'P1: the burning oil drum draws him from this far'),
      tunable('burnerReach', 12, 4, 16, 'm', 'P1: the lit gas burner draws him from this far'),
      tunable('routineSpeed', 1, 0.5, 2, 'm/s', 'P6: his round (Ada walks 3 m/s)'),
      tunable('drawnSpeed', 1.5, 0.5, 2.5, 'm/s', 'P1: going to a warmth'),
      tunable('touch', 0.65, 0.3, 1, 'm', 'P5: how close he must come to catch Ada'),
      tunable(
        'emberWarm',
        4,
        0,
        10,
        's',
        'P10: where a flame went out he warms this long, then resumes his round',
      ),
      tunable(
        'stepLoudness',
        1.8,
        0,
        5,
        'm',
        "P4: how far Ada's footsteps carry; standing still she makes none",
        { locked: true },
      ),
      tunable(
        'signIn',
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

  return {
    scene: { id: 'bay', name: 'The Bay', path: 'src/scenes/bay' },
    arrival,
    cutscenes,
    tunables,
    c1,
    puzzle,
  }
}
