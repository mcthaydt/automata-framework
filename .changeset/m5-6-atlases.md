---
"@mcthaydt/automata-content": patch
---

Atlas packing (M5.6): `content/atlases.toml`, the `@mcthaydt/automata-content/assets` entry (`buildAtlases`, the deterministic `packFrames`), and `automata-content assets`, which writes each atlas page's PNG and Pixi Spritesheet JSON. With a declared `content/palette.toml`, frames are checked against it (`offPalette`); a broken frame is `invalidAsset`.
