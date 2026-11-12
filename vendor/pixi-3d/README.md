# Vendored `@pixi/3d` beta

`@pixi/3d` (Pixi 3D) is a closed beta: the release is not on the public npm registry, and its terms allow no
public deployment. AF builds its 3D runtime on it now and stays private until Pixi 3D's public release (D-1,
M3R-D18; Owner, 2026-10-23: "we launch when pixi 3D goes public"). The Owner confirmed on 2026-10-30 that
0.1.0-beta.2 is the latest beta and asked for it to be vendored here, as `vendor/ruken/` is.

| Tarball | Package | Used by |
|---|---|---|
| `pixi-3d-0.1.0-beta.2.tgz` | `@pixi/3d` 0.1.0-beta.2 (MIT, `LICENSE`) | nothing in the workspace since the beta.3 move; the closed `FigureBuilder` submodule's view still vendors it and builds against it until its source is folded into the framework (`vendor/FigureBuilder` is read only). Peer: `pixi.js` ^8.22.0; dependency: `meshoptimizer` ^1.2.0 |
| `pixi-3d-0.1.0-beta.3.tgz` | `@pixi/3d` 0.1.0-beta.3 (MIT, the same `LICENSE`) | `packages/3d`, `packages/editor-3d`, `games/base-3d`, `extensions/character-kit`, `world-kit`, `lcd-panel`, `retro-crisp`, the root and `vendor/figure-builder` (the declarations build), through a `file:` specifier; `create-game --template 3d` and the consumer smoke. Peer: `pixi.js` ^8.23.0 (core is on 8.23.0); dependency: `meshoptimizer` ^1.2.0 |

**Source:** the release asset of `pixijs-userland/pixi-3d-beta` `v0.1.0-beta.2`, as The Last Light
(`mcthaydt/PixiJS3D_Experiment_001`) vendors it at `92e6704`; copied byte for byte on 2026-10-30. The Last
Light's README records the download, which needs a GitHub account invited to the beta:

```sh
gh release download v0.1.0-beta.2 -R pixijs-userland/pixi-3d-beta -p pixi-3d-0.1.0-beta.2.tgz -D vendor/pixi-3d
```

SHA-256 as copied:

```
f515c1b603da64e2d546ffc74a71d14a0218f9819b09d250310b55b9ff04013a  pixi-3d-0.1.0-beta.2.tgz
```

`pixi-3d-0.1.0-beta.3.tgz` is the release asset of `v0.1.0-beta.3`, downloaded by the Owner on 2026-11-11 with the same
command and handed over byte for byte:

```
5eb4c18eaf3fdb0f9b66603e34a9d232b96e039d508ce721647adb32015720ad  pixi-3d-0.1.0-beta.3.tgz
```

`release-notes-0.1.0-beta.3.txt` is that release's notes as `gh release view` prints them, saved by the Owner: the
behaviour changes the upgrade has to answer (tone mapping defaults to `none`, unlit colours drawn as authored, GPU
culling by default, the camera's zoom, per-texture samplers on WebGPU and more). Private, like the tarball.

Keep this tarball, the source that uses it and every build that contains it private. `ship prepare` refuses a
public bundle that contains `@pixi/3d` while D-1 stands (M3 spec §4.1). When Pixi 3D is public, replace the
`file:` specifier with the npm release, delete this folder and lift D-1 (the AF 1.0 launch task).
