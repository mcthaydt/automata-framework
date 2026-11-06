// @mcthaydt/automata-tools/internal: what this repository's own tooling, games and tests import (Ruken's headers
// and manifest checks, the ship steps, the Files and ProcessRunner services). It is in `exports` and not in
// `publishConfig.exports`, so the published package has no such entry: a game author gets `defineShipConfig` from
// the root entry and the commands from the `automata` bin.
export { SHIP_PACKAGE } from '../shared/package-name.ts'

export {
  type ItchConfig,
  type ItchSettings,
  itchConfigSchema,
} from '../shared/ship/config/itch-config.schema.ts'
export { defineShipConfig, type ShipConfig } from '../shared/ship/config/ship-config.ts'
export { type TauriConfig, tauriConfigSchema } from '../shared/ship/config/tauri-config.schema.ts'
export * from '../shared/ship/errors.ts'
export { portsFor } from '../shared/ship/ports/ports-for.ts'
export {
  type BoardName,
  boardNamesIn,
  declaredBoardsIn,
  findUndeclaredBoards,
  isBoardSource,
  type UndeclaredBoardFound,
} from '../shared/ship/prepare/board-names.ts'
export { checkVersion } from '../shared/ship/prepare/check-version.ts'
export {
  type DeclaredInputs,
  declaredInputsIn,
  findInputsProblems,
  isInputsSource,
  keysBindingsIn,
} from '../shared/ship/prepare/input-bindings.ts'
export {
  declaredOrientationIn,
  findOrientationMismatches,
  gameOrientationsIn,
  isOrientationSource,
  type OrientationMismatchFound,
  type PlayedOrientation,
} from '../shared/ship/prepare/orientation.ts'
export {
  findPixi3d,
  PIXI3D_EXTRAS_MARKERS,
  PIXI3D_MARKERS,
  type Pixi3dFound,
} from '../shared/ship/prepare/pixi3d-markers.ts'
export { type PrepareInput, prepareBuild } from '../shared/ship/prepare/prepare-build.ts'
export { findRootAbsoluteReferences } from '../shared/ship/prepare/root-absolute.ts'
export {
  type EnvValue,
  findSecretsInBuild,
  parseEnvFile,
  readEnvValues,
  type SecretFound,
  scanTextForSecrets,
} from '../shared/ship/prepare/secret-scan.ts'
export { findExecutable } from '../shared/ship/publish/find-executable.ts'
export { isLocalStack, type PublishBuildInput, publishBuild } from '../shared/ship/publish/publish-build.ts'
export { ITCH_LIMITS, ITCH_LIMITS_SOURCE } from '../shared/ship/targets/itch/itch-limits.ts'
export { type PrepareItchInput, prepareItch } from '../shared/ship/targets/itch/prepare-itch.ts'
export {
  type PublishDownloadsError,
  type PublishDownloadsInput,
  publishDownloadsToItch,
} from '../shared/ship/targets/itch/publish-downloads-to-itch.ts'
export {
  ITCH_FIRST_PUSH_CHECKLIST,
  type PublishItchInput,
  publishToItch,
} from '../shared/ship/targets/itch/publish-to-itch.ts'
export { inputsProblems, type ShipInputBindings } from '../shared/ship/targets/ruken/check-inputs.ts'
export { checkManifest } from '../shared/ship/targets/ruken/check-manifest.ts'
export {
  type PublishInput,
  publishToRuken,
  rukenCliPath,
} from '../shared/ship/targets/ruken/publish-to-ruken.ts'
export { type RukenHeaderTarget, rukenHeaders } from '../shared/ship/targets/ruken/ruken-headers.ts'
export { rukenToml } from '../shared/ship/targets/ruken/ruken-toml.ts'
export {
  type PrepareTauriError,
  type PrepareTauriInput,
  prepareTauri,
  TAURI_CLI,
} from '../shared/ship/targets/tauri/prepare-tauri.ts'
export * from './node-services.ts'
