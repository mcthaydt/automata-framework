// @automata/tools/internal: what this repository's own games, tooling and tests import from the build tools
// (Ruken's headers and manifest checks, and the closed-beta scan). It is in `exports` and not in
// `publishConfig.exports`, so the published package has no such entry: a game author gets `defineShipConfig` from the
// root entry and the commands from the `automata` bin. Add a name here when a second place in this repository needs
// it, not before.
export { findPixi3d } from '../shared/ship/prepare/pixi3d-markers.ts'
export { inputsProblems, type ShipInputBindings } from '../shared/ship/targets/ruken/check-inputs.ts'
export { checkManifest } from '../shared/ship/targets/ruken/check-manifest.ts'
export { type RukenHeaderTarget, rukenHeaders } from '../shared/ship/targets/ruken/ruken-headers.ts'
export { rukenToml } from '../shared/ship/targets/ruken/ruken-toml.ts'
