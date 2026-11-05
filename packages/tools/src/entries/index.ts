// @mcthaydt/automata-tools (the ship API, the create-game, check, add, build and editor commands, and the Files and
// ProcessRunner services they share): Ruken packaging, publish and dev hosting for AF games (ship spec), and itch.io
// packaging and publish (PUB spec §4).
/** The name this package is published under. */
export const SHIP_PACKAGE = '@mcthaydt/automata-tools'

export {
  type ItchConfig,
  type ItchSettings,
  itchConfigSchema,
} from '../features/ship/config/itch-config.schema.ts'
export { defineShipConfig, type ShipConfig } from '../features/ship/config/ship-config.ts'
export { type TauriConfig, tauriConfigSchema } from '../features/ship/config/tauri-config.schema.ts'
export { BUILD_ID_PATTERN, buildIdFor } from '../features/ship/deploy/build-id.ts'
export * from '../features/ship/errors.ts'
export { portsFor } from '../features/ship/ports/ports-for.ts'
export {
  type BoardName,
  boardNamesIn,
  declaredBoardsIn,
  findUndeclaredBoards,
  isBoardSource,
  type UndeclaredBoardFound,
} from '../features/ship/prepare/board-names.ts'
export { checkVersion } from '../features/ship/prepare/check-version.ts'
export {
  type DeclaredInputs,
  declaredInputsIn,
  findInputsProblems,
  isInputsSource,
  keysBindingsIn,
} from '../features/ship/prepare/input-bindings.ts'
export {
  declaredOrientationIn,
  findOrientationMismatches,
  gameOrientationsIn,
  isOrientationSource,
  type OrientationMismatchFound,
  type PlayedOrientation,
} from '../features/ship/prepare/orientation.ts'
export {
  findPixi3d,
  PIXI3D_EXTRAS_MARKERS,
  PIXI3D_MARKERS,
  type Pixi3dFound,
} from '../features/ship/prepare/pixi3d-markers.ts'
export { type PrepareInput, prepareBuild } from '../features/ship/prepare/prepare-build.ts'
export { findRootAbsoluteReferences } from '../features/ship/prepare/root-absolute.ts'
export {
  type EnvValue,
  findSecretsInBuild,
  parseEnvFile,
  readEnvValues,
  type SecretFound,
  scanTextForSecrets,
} from '../features/ship/prepare/secret-scan.ts'
export { findExecutable } from '../features/ship/publish/find-executable.ts'
export { isLocalStack, type PublishBuildInput, publishBuild } from '../features/ship/publish/publish-build.ts'
export { type TestRemoteInput, testRemote } from '../features/ship/remote/test-remote.ts'
export { ITCH_LIMITS, ITCH_LIMITS_SOURCE } from '../features/ship/targets/itch/itch-limits.ts'
export { type PrepareItchInput, prepareItch } from '../features/ship/targets/itch/prepare-itch.ts'
export {
  type PublishDownloadsError,
  type PublishDownloadsInput,
  publishDownloadsToItch,
} from '../features/ship/targets/itch/publish-downloads-to-itch.ts'
export {
  ITCH_FIRST_PUSH_CHECKLIST,
  type PublishItchInput,
  publishToItch,
} from '../features/ship/targets/itch/publish-to-itch.ts'
export { inputsProblems, type ShipInputBindings } from '../features/ship/targets/ruken/check-inputs.ts'
export { checkManifest } from '../features/ship/targets/ruken/check-manifest.ts'
export { type DeployDevInput, deployDev } from '../features/ship/targets/ruken/deploy-dev.ts'
export {
  type PublishInput,
  publishToRuken,
  rukenCliPath,
} from '../features/ship/targets/ruken/publish-to-ruken.ts'
export { type RukenHeaderTarget, rukenHeaders } from '../features/ship/targets/ruken/ruken-headers.ts'
export { rukenToml } from '../features/ship/targets/ruken/ruken-toml.ts'
export {
  type PrepareTauriError,
  type PrepareTauriInput,
  prepareTauri,
  TAURI_CLI,
} from '../features/ship/targets/tauri/prepare-tauri.ts'
export * from './from-cli.ts'
export * from './from-node.ts'
