# GAME-3D.1e part 5a: review images (2026-10-31)

The HUD (DESIGN.md §9.5) and the lock reticle (§8.1 rule 4). Taken from a production build (`vite build` +
`vite preview`) in headless Chromium with SwiftShader, after New game, with Wick standing still and Shift pressed
once (Toggle locks the Warden).

One throwaway patch made the moment capturable; it was reverted and is not committed:
- `content/first-slice.ts`: the hall gained the Warden at 0, 2.8, facing Wick. The first slice itself has no foes.
- `resources.ts`: the defaults gave 37 embers, a maximum of 5 hearts (Wick starts on 4 of them) and the Spark Sling
  equipped with 12 pellets, so every HUD part shows. (A first try patched `newGame()` instead; New game's sim still
  showed the defaults, so the patch moved to the resources. Not investigated further here: New game's 4 hearts
  equal the sim's default, so nothing in play differs.)

| Image | What it shows |
|---|---|
| `hud-reticle-844x390.png` | Hearts (4 full, 1 empty) and the embers at the top inline-start, under the frame's corner row; the boss bar, "The Ashen Warden", at the top centre; the equipped chip "Spark Sling × 12" at the bottom inline-end; the cyan lock ring round the Warden's feet |
| `hud-reticle-token-hurt-844x390.png` | About 100 ticks later: the Warden holds an attack token, so the ring has grown on its pulse (1 to 1.25 every 400 ms), and Wick has just been hit, so the hearts flash white-yellow for 400 ms |
| `hud-reticle-780x270.png` | The compact height: the same parts, nothing over the corner Pause, the boss bar narrowed to leave a full row of hearts clear on both sides |

## Against the reference (DESIGN.md §9.5; no mockup exists for the HUD)

- Hearts, top inline-start inside `visible`, half steps, flash on hurt: as specified. They sit under the frame's
  corner row, not level with Pause, because the play screen draws `hud.overlay` inside the frame's body.
- Embers under the hearts: as specified. Small keys wait on GAME-3D.1f (no sim state holds kiln keys yet).
- Equipped item and ammo: the desktop corner chip, at the bottom inline-end. In touch mode it is not drawn: the Item
  touch button's face (its icon and ammo) is GAME-3D.1h's.
- Lock reticle: the spec says "over the target". It is a flat ring round the target's feet, a little wider than its
  hurt cylinder: a ring over a 3.2 m Warden's head left the top of the view under the 25° camera, and a ring on the
  floor reads the same for a Sootling and the Warden. Cyan, apart from both colours of danger (§8.5). For the Owner's
  veto.
- Boss bar, top centre, its name localized: English, from one name map (`BOSS_NAMES`); the game has no message
  catalogue yet.

Two faults found by these captures and fixed before commit: the native `<meter>` drew a thin green line (now a
styled bar with `role="meter"`), and the first rings were not drawn (one call still passed the old argument, giving
NaN positions) and then stood upright (`@pixi/3d`'s torus is built flat, so the quarter turn was removed).
