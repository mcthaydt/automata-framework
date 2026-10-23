# 2D editor mockups

Twenty-one screens for the 2D editor ([spec](../../superpowers/specs/2026-10-23-editor-2d-design.md)), written once as
scene-kit trees and rendered both as HTML and as Figma frames, so the artifact and the Figma file cannot drift apart.
They are review material, not production code: nothing here ships.

The editor is one genre-general editor (a platformer level and a top-down RPG map in the LDtk model); FloorFifty stages
are a profile of it. The Mossgate (platformer) and Hollowmere (RPG) projects are illustrative.

- Figma file: [Automata Editors](https://www.figma.com/design/8H4vY5xZj7xIedrvDdwg2d), pages `2D · Home`, `2D · Level`,
  `2D · States`, `2D · Profile FloorFifty` and `Kit`.
- `parts.mjs`: the 2D editor's building blocks (top bar, rail, panels, fields, dock, dialogs), the general-editor
  data and artwork (Mossgate, Hollowmere, the tileset) and the Rooftops data the FloorFifty profile shows. Layer names,
  depth, sink, haze, seed, phrases, extension ranges and set pieces are the values in FloorFifty's
  `content/stages/rooftops.toml`. The artwork, the course geometry and the sample levels are illustrative.
- `screens.mjs`: assembles the screens, each `{ id, page, name, w, h, note, build(S, P) }`, from
  `screens-general.mjs` (home, levels, definitions, world, states) and `screens-floorfifty.mjs` (the profile).
- `gallery.mjs`: the review page published as an artifact.
- `build.mjs`: the commands below. The scene kit it imports is `../editor-kit/scene/`, owned by the 3D editor lane.

```sh
node build.mjs list                              # screens, pages and sizes
node build.mjs screen level-rpg out.html         # one screen at 1:1, for a screenshot
node build.mjs gallery out.html                  # the review page for the Artifact tool
node build.mjs figma-parts                       # `use_figma` code that stores parts.mjs on the _kit page (once)
node build.mjs figma level-rpg 1294             # `use_figma` code that renders one screen at x = 1294 on its page
```

`figma` code loads the kit (`scene-kit`), its Figma runtime (`figma-runtime`) and `parts-2d` from text nodes on the
`_kit` page. The 3D lane keeps its own modules in `module:3x` nodes; keep `parts-2d` outside that range.

Frame x offsets used in the Figma file (each frame's width plus 100):

| Page | Frames |
|---|---|
| `2D · Home` | home 0 |
| `2D · Level` | level-platformer 0, level-rpg 1294, tileset 2588, entities 3882, world 5176, level-portrait 6470 |
| `2D · States` | checks 0, export 1294, refuse 2114, recover 2854, open-failed 3554 |
| `2D · Profile FloorFifty` | ff-compose 0, ff-course 1294, ff-pieces 2588, ff-portrait 3882, ff-settings 4816, ff-checks 5276, ff-export 6570, ff-parse-error 7390 |
| `Kit` | kit 0 |
