---
'@mcthaydt/automata-ui': patch
---

Adds the M4.6 primitives: `Split`, `OptionGroup`, `PagerDots`, `PagedGrid` (with `paginate`, `fitShape`, `tileSide`, `trimRows`, `fitColumns`, `pageOf` and `wrapPage`), `Button`, `IconButton`, `Toggle`, `Slider`, `Chip`, `Modal`, `Sheet` and `Toast`, with the `--af-success` and `--af-danger-edge` theme tokens. `Dialog` now shares its modal scoping with `Modal` and `Sheet`; its behaviour is unchanged. Every visible string is a prop, and a nameless `IconButton` or a toned `Chip` or `Toast` without its `toneLabel` throws while it mounts.
