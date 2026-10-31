# GAME-3D.1c part 3: review images (2026-10-31)

Wick's first slash landing on the training dummy, and the sparks it throws (DESIGN.md §7.6). Taken from a production
build (`vite build` + `vite preview`) in headless Chromium with SwiftShader at 844 × 390, after New game, pressing J.

Two throwaway patches made the moment capturable; both were reverted and neither is committed:
- `content/first-slice.ts`: the dummy stood 1 m ahead of the spawn (0, −1) instead of in the kiln (2, 9), so the
  first slash reaches it.
- `views/feel.ts`: the presentation clock stopped 40 ms after a hit, so the screenshot (which takes about 1.7 s under
  SwiftShader, far longer than the sparks' 150 ms) shows them mid-flight.

| Image | What it shows |
|---|---|
| `play-before-slash-844x390.png` | The dummy 1 m ahead of Wick, before the slash |
| `play-hit-sparks-844x390.png` | 40 ms after `slash-1`'s hit: four small ember-orange sparks thrown out from the dummy's chest. The shake at that moment is under a pixel (power 1 is 1 px, two thirds decayed), so it does not show in a still |

Not shown as stills: the shake (1, 2 or 4 px by power, 120 ms; `views/feel.test.ts`), its absence under reduced
motion, the parry and block colours, and the move clips themselves (placeholders until GAME-3D.1j; their timing is
held by `content.test.ts`'s G3-d check).
