// @mcthaydt/automata-ship: Ruken packaging, publish and dev hosting for AF games (ship spec).
/** The name this package is published under. */
export const SHIP_PACKAGE = '@mcthaydt/automata-ship'

export { defineShipConfig, type ShipConfig } from './config/ship-config.ts'
export { BUILD_ID_PATTERN, buildIdFor } from './deploy/build-id.ts'
export { type DeployDevInput, deployDev } from './deploy/deploy-dev.ts'
export * from './errors.ts'
export { inputsProblems, type ShipInputBindings } from './manifest/check-inputs.ts'
export { checkManifest } from './manifest/check-manifest.ts'
export { rukenToml } from './manifest/ruken-toml.ts'
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
  declaredOrientationIn,
  findOrientationMismatches,
  gameOrientationsIn,
  isOrientationSource,
  type OrientationMismatchFound,
  type PlayedOrientation,
} from './prepare/orientation.ts'
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
export { type PublishInput, publishToRuken, rukenCliPath } from './publish/publish-to-ruken.ts'
export { type TestRemoteInput, testRemote } from './remote/test-remote.ts'
