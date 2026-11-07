# 3D examples

Each file is one example of one feature of `@automata/3d`, run by `pnpm examples:3d` and checked by a journey in
`tests/e2e` (it boots under Ruken's headers and draws). A file starts with a header (what it shows, its controls, its
packages) and has `// --- figure ---`, `// --- level ---` or `// --- scene ---`, `// --- sim ---` and `// --- game ---`
sections, since each example is one file. Colours are the DUEL palette.

| Example | What it shows |
|---|---|
| [`figures/figures-walk.ts`](figures/figures-walk.ts) | A figure as data, walking a loop under the angled camera |
| [`figures/figures-stand-and-sliders.ts`](figures/figures-stand-and-sliders.ts) | One figure, three bodies from three sets of sliders, each standing |
| [`figures/figures-poses.ts`](figures/figures-poses.ts) | Poses as data, a clip blending the figure into each |
| [`figures/figures-clips.ts`](figures/figures-clips.ts) | Clips played over the walk |
| [`figures/figures-aim.ts`](figures/figures-aim.ts) | Head, chest and hand turning to follow a point |
| [`figures/figures-outfits-items.ts`](figures/figures-outfits-items.ts) | One figure changing outfits and the item in its hand |
| [`render3d/render3d-meshes.ts`](render3d/render3d-meshes.ts) | Lit boxes and model files |
| [`render3d/render3d-angled-camera.ts`](render3d/render3d-angled-camera.ts) | The angled camera, cut-away walls and a fading pillar |
| [`render3d/render3d-lighting-fog.ts`](render3d/render3d-lighting-fog.ts) | Baked lamp light, a lit walker and fog |
| [`look/look-pixel-art.ts`](look/look-pixel-art.ts) | The pixel-art look: a low-resolution field, DUEL colours, stepped light and an outline |
| [`world/world-level-room.ts`](world/world-level-room.ts) | A room built from a level file and drawn by the world builder |

The hair, wardrobe, furnished-room and generated-map examples show extensions, so they belong to the Plus port and not to
core. A time of day is read by the passes an extension registers, so an example of it goes with that extension.
