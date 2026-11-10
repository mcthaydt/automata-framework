# Spike eb-look (EnvironmentBuilder's look on @automata/3d, phase 2: the baseline)

Draws AF's four base scenes (`@automata/3d/base`'s interior and exterior, and world-kit's dressed variants) the way
EnvironmentBuilder frames them, on WebGL and WebGPU, and writes a side-by-side PNG per scene and view. The PNGs and what
they show are in `docs/superpowers/eb-look/`. Spikes are exempt from TDD; nothing here is imported by a package.

```sh
export PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers
ln -sfn ../../examples/3d/node_modules spikes/eb-look/node_modules     # once; git-ignored
EB_DIR=<EnvironmentBuilder's 1× frames> node spikes/eb-look/shoot.mjs   # default out: docs/superpowers/eb-look/baseline
```

`EB_DIR` holds `<scene>-<view>.png` at 1×, the files EnvironmentBuilder's `npm run render -- <dir>` writes (not the `-x`
ones). Without it the EB panel is grey and says so.

| File | What it is |
|---|---|
| `scene.ts` | One scene, one view: `?scene=`, `?view=diorama\|fp`, `?pref=webgl\|webgpu`, and `?look=0`, `?cast=0`, `?light=0` to leave the look, the figures or the baked room light out |
| `shoot.mjs` | Serves the page, shoots every scene × view × panel, composites the side-by-sides in the browser and writes `shots.json` (what each panel drew, its data and console errors) |

The cameras follow EB's `views`: the diorama is orthographic, pitched `pitch`° down with no yaw, at 96/2.6 × 2 texels a
metre, centred on `at`; first person is 320 × 200 at a 90° horizontal field of view, `eye` m over the floor at `at`,
facing `angle` (map degrees clockwise from east). The figures stand still with a plain gait and no stand pose (AF's base
pair names `loose`, `bounce` and two stands that only compiled content holds).
