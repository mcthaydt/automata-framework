// The host contract, target-neutral: no adapter is exported here. A build's adapter comes from
// `@mcthaydt/automata/target`, chosen by the build's condition.

export {
  findRukenSdkMarkers,
  findTauriMarkers,
  RUKEN_SDK_MARKERS,
  TAURI_MARKERS,
} from '../features/targets/sdk-markers'
export type { HostHandshakeFailed, HostRefusal, HostResult } from '../shared/host/errors'
// The test seam of a target adapter, a type only, kept while the runtime's `sdkEnv` seam exists (`FakeHosting` is to replace it).
export type { HostingSeams } from '../shared/host/hosting'
export {
  type AnalyticsProps,
  HOST_EXIT_CAP_MS,
  type Hosting,
  type HostingLeaderboards,
  type HostingOptions,
  type HostingSaves,
} from '../shared/host/hosting'
export * from '../shared/host/index'
