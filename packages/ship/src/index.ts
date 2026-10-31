// @mcthaydt/automata-ship: Ruken packaging, publish and dev hosting for AF games (ship spec), and itch.io
// packaging and publish (PUB spec §4).
/** The name this package is published under. */
export const SHIP_PACKAGE = '@mcthaydt/automata-ship'

export { type ItchConfig, type ItchSettings, itchConfigSchema } from './config/itch-config.schema.ts'
export { defineShipConfig, type ShipConfig } from './config/ship-config.ts'
export { BUILD_ID_PATTERN, buildIdFor } from './deploy/build-id.ts'
export * from './errors.ts'
export { portsFor } from './ports/ports-for.ts'
export {
  type BoardName,
  boardNamesIn,
  declaredBoardsIn,
  findUndeclaredBoards,
  isBoardSource,
  type UndeclaredBoardFound,
} from './prepare/board-names.ts'
export { checkVersion } from './prepare/check-version.ts'
export {
  type DeclaredInputs,
  declaredInputsIn,
  findInputsProblems,
  isInputsSource,
  keysBindingsIn,
} from './prepare/input-bindings.ts'
export {
  declaredOrientationIn,
  findOrientationMismatches,
  gameOrientationsIn,
  isOrientationSource,
  type OrientationMismatchFound,
  type PlayedOrientation,
} from './prepare/orientation.ts'
export {
  findPixi3d,
  PIXI3D_EXTRAS_MARKERS,
  PIXI3D_MARKERS,
  type Pixi3dFound,
} from './prepare/pixi3d-markers.ts'
export { type PrepareInput, prepareBuild } from './prepare/prepare-build.ts'
export { findRootAbsoluteReferences } from './prepare/root-absolute.ts'
export {
  type EnvValue,
  findSecretsInBuild,
  parseEnvFile,
  readEnvValues,
  type SecretFound,
  scanTextForSecrets,
} from './prepare/secret-scan.ts'
export { findExecutable } from './publish/find-executable.ts'
export { isLocalStack, type PublishBuildInput, publishBuild } from './publish/publish-build.ts'
export { type TestRemoteInput, testRemote } from './remote/test-remote.ts'
export { ITCH_LIMITS, ITCH_LIMITS_SOURCE } from './targets/itch/itch-limits.ts'
export { type PrepareItchInput, prepareItch } from './targets/itch/prepare-itch.ts'
export {
  ITCH_FIRST_PUSH_CHECKLIST,
  type PublishItchInput,
  publishToItch,
} from './targets/itch/publish-to-itch.ts'
export { inputsProblems, type ShipInputBindings } from './targets/ruken/check-inputs.ts'
export { checkManifest } from './targets/ruken/check-manifest.ts'
export { type DeployDevInput, deployDev } from './targets/ruken/deploy-dev.ts'
export { type PublishInput, publishToRuken, rukenCliPath } from './targets/ruken/publish-to-ruken.ts'
export { rukenToml } from './targets/ruken/ruken-toml.ts'
