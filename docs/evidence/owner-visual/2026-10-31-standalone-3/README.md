# STANDALONE.3 review images: 2D editor mockups without the stage profile

Rendered with `node docs/design/editor-2d/build.mjs screen <id> out.html`, then
`pnpm exec playwright screenshot --browser chromium --viewport-size=W,H file://out.html <id>-<side>.png`.
`before` is `main` at `bb0b330c`; `after` is this branch. These are mockup sources, not the built editor: no built
screen, golden or screenshot test changed.

| Image | What differs |
|---|---|
| `home-before.png` / `home-after.png` (1194x834) | The stage project card and the stage template are gone; the counts read 3 projects; the Files source says "Pick a .af2d.json file"; the template note says "a game's own document kind". The selected project and the inspector are unchanged. |
| `kit-before.png` / `kit-after.png` (1194x1900) | The kind pill reads "Platformer" and the type samples read "Mossgate · Moss Steps · 4 layers". Everything else is unchanged. |

The profile's eight screens (`ff-*`) and their gallery section are deleted, so they have no after image. The kit's
layered-scene parts (the city layer rows, the sky/city switch, the Stage tab, the flash-rate message) still use the old
stage data. Replacing them is a follow-up, as is retiring the stage-profile page of the Figma file.
