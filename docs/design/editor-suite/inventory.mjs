// The editor audit: every editor in The Last Light's suite and the game's own boards, what each edits, where it lives
// and whether AF keeps it. Read from the code at mcthaydt/PixiJS3D_Experiment_001 (main at 92e6704, 2026-10-22) and
// from AF's plan (docs/01-decomposition.md). The gallery and the README both read this one list.
//
// `verdict` is one of: kept, new, built, shell, planned.

export const VERDICTS = {
  kept: 'Kept',
  new: 'Kept, new editor',
  built: 'Already designed',
  shell: 'Kept in the shell',
  planned: 'Specified, not built',
}

export const INVENTORY = [
  {
    id: 'sequence',
    name: 'Sequence',
    edits:
      'The shots of a cutscene: lens and ease, caption lines, and the sound and light keys that ride on the timeline.',
    lives: 'src/scenes/<id>/cutscenes.ts, client timeline.ts',
    verdict: 'kept',
    home: 'cutscenes extension (M6)',
    screens: ['seq-timeline', 'seq-portrait'],
  },
  {
    id: 'tuner',
    name: 'Tuner',
    edits:
      'A scene’s tunables, each held to its own minimum, maximum, unit and note, with a lock and a measured fairness before and after.',
    lives: 'src/scenes/<id>/systems.ts (TUNABLES), client tuner.ts, tune-model.ts',
    verdict: 'kept',
    home: 'systems extension, with rows from feel and audio-synth',
    screens: ['tuner-sliders', 'tuner-fairness', 'tuner-portrait'],
  },
  {
    id: 'writer',
    name: 'Writer',
    edits: 'Lines, dialogue graphs, beats and hint ladders, linted as they are written.',
    lives: 'story.ts, dialogues.ts, beats.ts, help.ts, client writer.ts, script-model.ts',
    verdict: 'kept',
    home: 'narrative extension',
    screens: ['writer-lines', 'writer-dialogue', 'writer-portrait'],
  },
  {
    id: 'studio',
    name: 'Studio',
    edits:
      'A character’s look: turnaround, outfits, sliders and poses, with the pipeline stages and their gates (G1, G6, G7) beside it.',
    lives: 'characters/*.json, docs/art/*/character.json, client studio.ts, studio-model.ts',
    verdict: 'kept',
    home: 'pipelines extension (character pipeline, M3)',
    screens: ['studio-turnaround', 'studio-outfits', 'studio-poses', 'studio-portrait'],
  },
  {
    id: 'schematic',
    name: 'Schematic',
    edits: 'A scene’s puzzle chain and its agents: the facts, the goal, the hints and who acts on what.',
    lives: 'puzzle.ts, puzzle.json, systems.ts, client schematic.ts, schematic-model.ts',
    verdict: 'kept',
    home: 'puzzle and systems extensions',
    screens: ['schematic-chain', 'schematic-agent'],
  },
  {
    id: 'audio',
    name: 'Audio',
    edits:
      'Cue recipes (tones swept between two pitches, filtered noise, timing), the event that plays each cue, and the mix.',
    lives:
      'A game board, src/audio/board.ts; cues.ts and events.ts are edited by hand (editor-gaps 68 and 76)',
    verdict: 'new',
    home: 'audio-synth extension',
    screens: ['audio-cues'],
  },
  {
    id: 'feel',
    name: 'Feel',
    edits:
      'Game feel as a table: for each event what you see, hear, feel in the camera, read in the HUD and feel in the controller.',
    lives: 'A game board, src/feel/board.ts; effects.ts is edited by hand',
    verdict: 'new',
    home: 'feel extension',
    screens: ['feel-matrix'],
  },
  {
    id: 'levels',
    name: 'Levels',
    edits: 'Sectors, portals and props of a room.',
    lives: 'blockout.json, client levels.ts, level-tools.ts, model.ts',
    verdict: 'built',
    home: '3D level editor (ED3D) and 2D level editor (ED2D)',
    screens: [],
  },
  {
    id: 'review',
    name: 'Review desk',
    edits:
      'Nothing. It shows a change set’s diff, before and after, its checks and the gates it reopens, with a link to approve on GitHub.',
    lives: 'Specified in the editor suite spec, section 6.7; not built',
    verdict: 'planned',
    home: 'Editor shell',
    screens: ['review-desk', 'review-portrait'],
  },
  {
    id: 'interchange',
    name: 'Export and import',
    edits:
      'A scene as scene-interchange v2 TOML or JSON. Import shows a plan first and applies only a clean one.',
    lives: 'client interchange.ts',
    verdict: 'shell',
    home: 'Editor shell, over the content TOML and JSON the compiler reads',
    screens: ['interchange'],
  },
  {
    id: 'shell',
    name: 'Shell',
    edits:
      'Nothing by itself: the editor picker, change set, checks, gates, Ask, Undo and Ship around every editor.',
    lives: 'client main.ts, editor-api.ts, bridge.ts, on a server welded to the game',
    verdict: 'shell',
    home: 'Rebuilt on AF ports so any game can mount the editors',
    screens: ['suite-home', 'ask-diff', 'ship-dialog'],
  },
]

// Editors someone asked for or the spikes hint at, where no editor code exists.
export const NO_EDITOR_YET = [
  ['Sprite and animation', 'Partly the Studio’s poses. A frame editor is not designed here.'],
  ['Tileset', 'Belongs to the 2D level editor (ED2D).'],
  ['Material, entity and prefab', 'Belong to the 3D and 2D level editors.'],
  ['Particles', 'Cut from the plan (PD-5).'],
  ['UI and scene composer', 'No code and no plan.'],
  [
    'Spikes: figure workshop, fight and brawl replay, render sprites',
    'Experiments. AF keeps what they proved, not the screens.',
  ],
]
