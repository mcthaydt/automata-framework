// The editor suite as the framework's EDS spec defines it (docs/superpowers/specs/2026-10-30-editor-suite-design.md §2) and the
// business model of 2026-10-30 (docs/00-overview.md): the editors are free on the web and desktop, Plus is free, and iOS and
// Android editor apps are the one paid product. `status` is what the site may say; nothing here says an editor is released.
// A row moves to `available` only with a link to a build someone can open (the owner's M10.0 decision on a try-it build).

export interface EditorInfo {
  name: string
  edits: string
  home: 'framework' | 'plus'
  status: 'in-development'
}

export const SUITE_SPEC = 'https://github.com/mcthaydt/automata-framework/blob/main/docs/superpowers/specs/2026-10-30-editor-suite-design.md'

export const EDITORS: readonly EditorInfo[] = ([
  { name: 'Levels 2D', edits: 'Tile and entity levels as .af2d.json projects, exported to the game’s content.', home: 'framework' },
  { name: 'Levels 3D', edits: 'Rooms and sectors in the af-sector format: ledges, pits, camera views and walls.', home: 'framework' },
  { name: 'Tuner', edits: 'A game’s tunables, within the bounds the content compiler reports.', home: 'framework' },
  { name: 'Studio', edits: 'Procedural figures, poses and clips, and the figure library.', home: 'framework' },
  { name: 'Audio', edits: 'Sound recipes, rendered to audio files at build time.', home: 'framework' },
  { name: 'Feel', edits: 'Camera, pose, visual, word, haptic and audio effects by channel.', home: 'plus' },
  { name: 'Writer', edits: 'Dialogue, beats and hint ladders.', home: 'plus' },
  { name: 'Schematic', edits: 'Puzzle definitions and the agents and rules of a systems game.', home: 'plus' },
  { name: 'Sequence', edits: 'Cutscene shots, lenses, actors and cues.', home: 'plus' },
] as const).map((editor) => ({ ...editor, status: 'in-development' as const }))
