// Studio: The Last Light's character workshop (editor/src/client/studio.ts, studio-model.ts), redesigned after the
// Owner's review (2026-10-23: "it doesn't feel very intuitive like the rest"). The character is the picker: tap a part
// to edit it, drag the hem to change a length, drag sideways to turn, tap an outfit or pose under the stage. The
// inspector shows only the picked part's fields with the rest folded, and the pipeline is a bar that opens as a drawer.
// The shell (change set, checks, gates, Ask, Undo, Ship) is the one every editor uses. Built by `Q.studioView`.

export const studioScreens = []

studioScreens.push({
  id: 'studio-look',
  page: 'Suite · Studio',
  name: 'Studio · Look · iPad landscape',
  w: 1194,
  h: 834,
  note: 'Ada on a stage you touch. Tapping her apron outlined it and opened its fields; dragging the hem shortened it from 0.60 to 0.50 (the dashed line is the file’s value). Outfits sit under the stage, more apron options stay folded, and the change reopens G1 and G6.',
  build: (_S, _P, Q, A) => Q.studioView(A, { mode: 'look', name: 'Studio · Look · iPad landscape' }),
})

studioScreens.push({
  id: 'studio-pose',
  page: 'Suite · Studio',
  name: 'Studio · Pose · iPad landscape',
  w: 1194,
  h: 834,
  note: 'The poses from the art file as thumbnails under the stage; tapping one plays it on Ada, and dragging along the frames scrubs it (the frame count is illustrative). Requesting a new pose is a folded row, and its paid run waits for G7.',
  build: (_S, _P, Q, A) => Q.studioView(A, { mode: 'pose', name: 'Studio · Pose · iPad landscape' }),
})

studioScreens.push({
  id: 'studio-pipeline',
  page: 'Suite · Studio',
  name: 'Studio · Pipeline open · iPad landscape',
  w: 1194,
  h: 834,
  note: 'The pipeline bar opened as a drawer: the apron change made the builder, sheet and play stages stale, Check refreshes them, and G1 and G6 wait for the owner. The paid run stays locked.',
  build: (_S, _P, Q, A) =>
    Q.studioView(A, { mode: 'look', drawer: true, name: 'Studio · Pipeline open · iPad landscape' }),
})

studioScreens.push({
  id: 'studio-first-run',
  page: 'Suite · Studio',
  name: 'Studio · First run · iPad landscape',
  w: 1194,
  h: 834,
  note: 'A new character starts as a plain walker already on the stage, never a blank form. Three steps guide the first edit, other starters sit under the stage, and the empty inspector says what tapping does or offers Ask.',
  build: (_S, _P, Q, A) => Q.studioView(A, { mode: 'first', name: 'Studio · First run · iPad landscape' }),
})
