// The host contract, target-neutral: no adapter is exported here. A build's adapter comes from
// `@mcthaydt/automata-host/target`, chosen by the build's condition.

// The Ruken adapter's test seam, a type only, kept while the runtime's `sdkEnv` seam exists (`FakeHosting` is to replace it).
export type { HostingSeams } from '../features/targets/ruken/hosting-ruken'
export {
  findRukenSdkMarkers,
  findTauriMarkers,
  RUKEN_SDK_MARKERS,
  TAURI_MARKERS,
} from '../features/targets/sdk-markers'
export { HostError, HostHandshakeFailed } from '../shared/host/errors'
export {
  type AnalyticsProps,
  HOST_EXIT_CAP,
  Hosting,
  type HostingLeaderboards,
  type HostingOptions,
  type HostingSaves,
} from '../shared/host/hosting'
export * from '../shared/host/index'
