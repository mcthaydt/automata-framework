# GAME-3D.1d part 4: review images (2026-10-31)

The enemies' placeholder figures, the Wisp's placeholder mask and the windup glow (DESIGN.md §8.1 rule 1, §8.5).
Taken from a production build (`vite build` + `vite preview`) in headless Chromium with SwiftShader at 844 × 390,
after New game, with Wick standing still.

One throwaway patch made the moment capturable; it was reverted and is not committed:
- `content/first-slice.ts`: the hall gained four foes (a Sootling at −1.6, 0.2; an Ash Knight at 1.6, 0.6; the
  Warden at 0, 2.6; a Wisp at −2.6, 2) so they stand in the first view. The first slice itself has no foes.

| Image | What it shows |
|---|---|
| `enemies-sootling-windup-844x390.png` | Tick 36. Right of Wick, the Sootling (the 120 cm figure scaled to 0.9 m) in its bite's windup, its eyes lit orange. Left, the Ash Knight (1.8 m). Behind, the Warden (the 240 cm figure scaled to 3.2 m). By the pillar, the Wisp's mask (an orange box) hovering at 2.2 m |
| `warden-slam-windup-844x390.png` | Tick 180. The Warden in its slam's windup, its arm raised by the placeholder clip and its eyes lit orange. The Sootling has fallen back to recover, and the knight is circling |

The figures, clips and the mask are placeholders until GAME-3D.1j authors them in the Studio (the target figure
with its sliders and coat changed, and one generated clip shape per move). Not shown as stills: the unblockable
windup's white-yellow pulse (the breath, phase 2 only; `views/enemies.test.ts`), and the ash burst on a defeat (dark
ash sparks with no shake; `views/feel.test.ts`).

A first capture showed no Wisp: its box view was given the raw Q16.16 row (65,536 times too far away). It is now
wrapped in `inMetres` like the figures, and the second capture shows it.
