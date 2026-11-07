# Font provenance: `packages/content/src/assets/fixtures/fonts`

| Asset | Used by | Source | Licence | Date |
|---|---|---|---|---|
| `pixelify-sans-latin-400-normal.woff2` (7 692 bytes) | the font subset and build tests (M5.5) | Copied unchanged from `@fontsource/pixelify-sans` 5.3.0, `files/pixelify-sans-latin-400-normal.woff2` (the package Emberwick depends on) | SIL Open Font License 1.1, Copyright 2021 The Pixelify Sans Project Authors; the licence is `OFL-PixelifySans.txt` beside it, from the package's `LICENSE` | 2026-10-18 |
| `noto-sans-jp-endonym.woff2` (1 552 bytes) | the font build test: a second face covering what the first lacks (M5.5) | Copied unchanged from FloorFifty `apps/client/public/fonts/noto-sans-jp-endonym.woff2` at `ac72660`: Noto Sans JP (google/fonts `ofl/notosansjp`, variable weight) cut by FloorFifty's `subset-fonts.ts` to the endonym 日本語 | SIL Open Font License 1.1, Copyright 2014-2021 Adobe (http://www.adobe.com/), with Reserved Font Name 'Source'; the licence is `OFL-NotoSansCJK.txt` beside it, from FloorFifty's `apps/client/public/fonts/OFL-NotoSansCJK.txt` | 2026-10-18 |

SHA-256:
- `pixelify-sans-latin-400-normal.woff2`: `d830612ac9131788ebae754b9268f83f7c1d3ffa9bc0f9a5514207a8283fe71e`. It holds Latin glyphs only, so a CJK character such as `日` is missing from any subset of it.
- `noto-sans-jp-endonym.woff2`: `bd498710082abd038bce0c7ac71bd0ee12ac3917dd2d0e9df3f20af6e3082ded`. It holds 日, 本 and 語 and nothing Latin.
