# The baked interior, and the look's effects (2026-11-11)

Branch `claude/eb-look-effects`, drawn with `spikes/eb-look` on WebGL (SwiftShader). EB's panel is its own CPU frame from
`claude/eb-base-renders` (`docs/renders/base/`). Why the interiors were black, and the fix, is in
[`../dark-interior.md`](../dark-interior.md).

```sh
export PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers
ln -sfn ../../examples/3d/node_modules spikes/eb-look/node_modules     # once; git-ignored
EB_GAMEPLAY=0 EB_DIR=<EB renders dir> node spikes/eb-look/shoot.mjs docs/refactor/eb-look/effects
EB_GAMEPLAY=0 EB_PANELS=fx EB_AT=night EB_VIEWS=diorama EB_SCENES=base-exterior,base-exterior-dressed \
  EB_DIR=<EB renders dir> node spikes/eb-look/shoot.mjs docs/refactor/eb-look/effects/fx-night
```

## The four base scenes in both views

`<scene>-<view>.png`, four panels: EB CPU, AF WebGL with the baked room light, AF WebGL with material light only, AF WebGPU.
The effects (shafts, particles) are on in the spike (`?fx=0` turns them off); the mood grade names no mood (the base
scenes name none, as EB's name none); the coloured outline is off (EB's base look has it off).

| Scene | Diorama | First person |
|---|---|---|
| base-interior | [diorama](base-interior-diorama.png) | [fp](base-interior-fp.png) |
| base-interior-dressed | [diorama](base-interior-dressed-diorama.png) | [fp](base-interior-dressed-fp.png) |
| base-exterior | [diorama](base-exterior-diorama.png) | [fp](base-exterior-fp.png) |
| base-exterior-dressed | [diorama](base-exterior-dressed-diorama.png) | [fp](base-exterior-dressed-fp.png) |

What the baked panel shows now: the interior's wall, floor and the pendant's pool read as EB's do (mean wall (58, 63, 64)
against EB's (56 to 67, 65 to 73, 63 to 70)), and the street's walls and pavement are close to EB's.

What still differs, and is not this batch's:
- **Figures** are near black in the baked exterior (the figure light is the FigureBuilder workstream's, and they were just as
  dark in [`../haze-sky/`](../haze-sky/)).
- **WebGPU** draws nothing here: the open `@pixi/3d` `sceneDepth` issue ([`../wp0/`](../wp0/README.md)).
- **No effect shows in the day scenes' base frames**: the street lamp's shaft burns at night; EB's wet ground, puddles and
  steam need rain or an emitter, and no base scene has one.

## The effects at night

[`fx-night/`](fx-night/): the base exterior and the dressed street at night (`?at=night`; EB's panel is its day frame, there
is no night one), in three AF panels: no effects, effects, effects and the coloured outline.

- **Shafts**: the street lamp's cone, warm, in whole steps and a 4 × 4 dither, with dust motes in the thickest of it
  ([`fx-night/base-exterior-diorama.png`](fx-night/base-exterior-diorama.png)).
- **Coloured outline**: the near shape's own deep step round the lamp post, the bin and the planter, a step lighter on the
  key's side ([`fx-night/base-exterior-dressed-diorama.png`](fx-night/base-exterior-dressed-diorama.png)).

Reflections, particles and the mood grade are not in these frames (no rain, no emitter, no mood); they are checked in real
Chromium WebGL2 pixels by `extensions/world-kit/tests/browser/sky/` and `packages/3d/tests/browser/parity/look/`.

`shots.json` beside each set has what each panel drew (renderer, passes, console errors).
