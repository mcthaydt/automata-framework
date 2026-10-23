// What changed since the Owner approved the suite (2026-10-23 07:50Z: "everything is perfect but the character one").
// Each row pairs a screen as approved (PR #134 at 74c1f2c) with the screen now, and says why in one line. The
// approved screens keep their layout; only their data and file targets changed. The Studio is redesigned.
//
//   [after id, before id (null for a new screen), title, why]

export const APPROVED_AT = '74c1f2c'

export const CHANGES = [
  [
    'studio-look',
    'studio-turnaround',
    'Studio · Look',
    'Redesigned: you tap a part of Ada to edit it, drag the hem to change a length and drag her sideways to turn, so the eight-view grid, the tab row and the forms are gone.',
  ],
  [
    'studio-pipeline',
    'studio-outfits',
    'Studio · Outfits and pipeline',
    'The garment form became the part you tap, with its other options folded; the pipeline that sat under every tab is a bar that opens as this drawer.',
  ],
  [
    'studio-pose',
    'studio-poses',
    'Studio · Poses',
    'Poses are thumbnails that play on Ada with a frame scrubber, the facts come from the art file, and requesting a new pose stays folded until asked for.',
  ],
  [
    'studio-first-run',
    null,
    'Studio · First run (new)',
    'A new character starts as a plain walker already on the stage with three steps, never an empty form.',
  ],
  [
    'studio-portrait',
    'studio-portrait',
    'Studio · Portrait',
    'The same stage at full width, outfits down its edge and the picked part’s fields as a bottom sheet.',
  ],
  [
    'ff-tuner',
    null,
    'Tuner on FloorFifty (new)',
    'The one added second-game screen: the same Tuner on FloorFifty’s content/tuning.toml, which lists no gates.',
  ],
  [
    'suite-home',
    'suite-home',
    'Suite home',
    'Cards and changed files name AF content files (cutscenes.toml, tuning.toml), and the checks row names the gates they reopen, C-G1 and S-G2.',
  ],
  [
    'review-desk',
    'review-desk',
    'Review desk',
    'The diff is the tuning.toml line, and the gate cards are C-G1 and S-G2, the gates the game’s editor list gives the two changed files.',
  ],
  [
    'ask-diff',
    'ask-diff',
    'Ask',
    'Ask proposes a TOML diff to cutscenes.toml and tuning.toml instead of edits to TypeScript.',
  ],
  [
    'ship-dialog',
    'ship-dialog',
    'Ship',
    'Ship lists C-G1 and S-G2 as reopened; it said no gates were reopened.',
  ],
  [
    'interchange',
    'interchange',
    'Export and import',
    'The import plan reads rows from the two TOML files; the layout is the one you approved.',
  ],
  [
    'seq-timeline',
    'seq-timeline',
    'Sequence',
    'The file is cutscenes.toml and the bar shows C-G1, which the change to shot C’s end reopens.',
  ],
  ['seq-portrait', 'seq-portrait', 'Sequence · portrait', 'The same file and C-G1 as the landscape view.'],
  [
    'tuner-sliders',
    'tuner-sliders',
    'Tuner',
    'Tunables use their tuning.toml names, LIGHTER_REACH starts from the file’s 6 (it said 8), and the bar shows S-G2.',
  ],
  [
    'tuner-fairness',
    'tuner-fairness',
    'Tuner · Fairness',
    'Fairness measures the same change (LIGHTER_REACH 6 to 5) under S-G2.',
  ],
  [
    'tuner-portrait',
    'tuner-portrait',
    'Tuner · portrait',
    'The same names, values and S-G2 as the landscape view.',
  ],
  ['writer-lines', 'writer-lines', 'Writer', 'Lines come from story.toml and the bar shows N-G1.'],
  [
    'writer-dialogue',
    'writer-dialogue',
    'Writer · Dialogue',
    'The graph is dialogues.toml under N-G1, and reply nodes show their id and the condition they set.',
  ],
  [
    'writer-portrait',
    'writer-portrait',
    'Writer · portrait',
    'story.toml and N-G1, as in the landscape view.',
  ],
  ['schematic-chain', 'schematic-chain', 'Schematic · Chain', 'The puzzle’s gate is P-G1; it showed S-G2.'],
  [
    'schematic-agent',
    'schematic-agent',
    'Schematic · Agent',
    'The Porter’s transitions are the file’s (drawn to drawn at 90 and 60, drawn to warming at 40), under S-G1 and S-G3.',
  ],
  [
    'audio-cues',
    'audio-cues',
    'Audio',
    'The bus levels are the file’s (master 0.55, music and effects ducked 9 dB under dialogue) and the bar shows Q-AUD.',
  ],
  ['feel-matrix', 'feel-matrix', 'Feel', 'The file is effects.toml and the bar shows Q-FEEL.'],
  [
    'review-portrait',
    'review-portrait',
    'Review desk · portrait',
    'The same change set, TOML diff and C-G1 and S-G2 as the landscape desk.',
  ],
]
