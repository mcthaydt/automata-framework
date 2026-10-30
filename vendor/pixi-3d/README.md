# Vendored `@pixi/3d` beta

`@pixi/3d` (Pixi 3D) is a closed beta: the release is not on the public npm registry, and its terms allow no
public deployment. AF builds its 3D runtime on it now and stays private until Pixi 3D's public release (D-1,
M3R-D18; Owner, 2026-10-23: "we launch when pixi 3D goes public"). The Owner confirmed on 2026-10-30 that
0.1.0-beta.2 is the latest beta and asked for it to be vendored here, as `vendor/ruken/` is.

| Tarball | Package | Used by |
|---|---|---|
| `pixi-3d-0.1.0-beta.2.tgz` | `@pixi/3d` 0.1.0-beta.2 (MIT, `LICENSE`) | spike S7 (M3.1) and `packages/render-pixi3d` (M3.4), through a `file:` specifier. Peer: `pixi.js` ^8.22.0 (M3.2 moves core to 8.22); dependency: `meshoptimizer` ^1.2.0 |

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

Keep this tarball, the source that uses it and every build that contains it private. `ship prepare` refuses a
public bundle that contains `@pixi/3d` while D-1 stands (M3 spec §4.1). When Pixi 3D is public, replace the
`file:` specifier with the npm release, delete this folder and lift D-1 (the AF 1.0 launch task).
