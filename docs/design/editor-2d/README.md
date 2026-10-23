# 2D editor mockups

Thirteen screens for the 2D editor ([spec](../../superpowers/specs/2026-10-23-editor-2d-design.md)), written once as
scene-kit trees and rendered both as HTML and as Figma frames, so the artifact and the Figma file cannot drift apart.
They are review material, not production code: nothing here ships.

- Figma file: [Automata Editors](https://www.figma.com/design/8H4vY5xZj7xIedrvDdwg2d), pages `2D · Stage`, `2D · Level`,
  `2D · Home`, `2D · States` and `Kit`.
- `parts.mjs`: the 2D editor's building blocks (top bar, rail, panels, fields, dock, dialogs) and the Rooftops data
  they show. Layer names, depth, sink, haze, seed, phrases, extension ranges and set pieces are the values in FloorFifty's
  `content/stages/rooftops.toml`. The artwork, the course geometry and the sample level are illustrative.
- `screens.mjs`: the screens, each `{ id, page, name, w, h, note, build(S, P) }`.
- `gallery.mjs`: the review page published as an artifact.
- `build.mjs`: the commands below. The scene kit it imports is `../editor-kit/scene/`, owned by the 3D editor lane.

```sh
node build.mjs list                              # screens, pages and sizes
node build.mjs screen compose out.html           # one screen at 1:1, for a screenshot
node build.mjs gallery out.html                  # the review page for the Artifact tool
node build.mjs figma-parts                       # `use_figma` code that stores parts.mjs on the _kit page (once)
node build.mjs figma compose 0                   # `use_figma` code that renders one screen at x = 0 on its page
```

`figma` code loads the kit (`scene-kit`), its Figma runtime (`figma-runtime`) and `parts-2d` from text nodes on the
`_kit` page. The 3D lane keeps its own modules in `module:3x` nodes; keep `parts-2d` outside that range.

Frame x offsets used in the Figma file: `2D · Stage` compose 0, course 1294, pieces 2588, portrait 3882; `2D · States`
checks 0, export 1294, recover 2094, parse error 2794, stage settings 3594; `2D · Level` level 0, world 1294.
