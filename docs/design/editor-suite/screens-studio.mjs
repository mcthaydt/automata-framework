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
  id: 'studio-ik',
  page: 'Suite · Studio',
  name: 'Studio · Pose by hand · iPad landscape',
  w: 1194,
  h: 834,
  note: 'Posing by hand on the rig: a handle on each hand and foot, the hips, chest and head, a pole (the diamond) for the picked elbow and a look-at target (the crosshair), as the M3 characters spec §4.4 sets out. Ada’s feet are pinned, so dragging her hips down bent her knees; her right hand was dragged from the dashed ring to the drawer, and the elbow followed inside its limit (the wedge). The pose saves to her clips file. The rig and its two-bone IK are The Last Light’s (render/figure/rig.ts); pins and joint limits are new in AF.',
  build: (_S, _P, Q, A) => Q.studioView(A, { mode: 'ik', name: 'Studio · Pose by hand · iPad landscape' }),
})

studioScreens.push({
  id: 'studio-animate',
  page: 'Suite · Studio',
  name: 'Studio · Animate · iPad landscape',
  w: 1194,
  h: 834,
  note: 'A clip is keys on the rig’s handles over time, laid out like the Sequence timeline. The stage shows the pose at the playhead with the keys either side as onion skins and the hand’s path. Keys play over the procedural idle and step at Ada’s 12 poses a second (her brisk gait), like the game; Smooth previews between steps. The clip’s length (the game can stretch it), loop mode and the body parts it moves sit under the clip list; markers (contact) and cues (pickup) have their own row. Clips save to content/characters/ada.clips.json and reopen G6.',
  build: (_S, _P, Q, A) => Q.studioAnimate(A),
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
