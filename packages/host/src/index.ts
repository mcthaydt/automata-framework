// The host contract (DIST spec §4), target-neutral: no adapter is exported here. A build's adapter comes from
// `@mcthaydt/automata-host/target`, chosen by the build's condition (DIST spec §5.3).

export { HostError, HostHandshakeFailed } from './contract/errors'
export {
  type AnalyticsProps,
  HOST_EXIT_CAP,
  Hosting,
  type HostingLeaderboards,
  type HostingOptions,
  type HostingSaves,
} from './contract/hosting'
export * from './contract/index'
// The Ruken adapter's test seam, a type only, until DIST.4 replaces the runtime's `sdkEnv` seam with `FakeHosting`.
export type { HostingSeams } from './ruken/hosting-ruken'
export { findRukenSdkMarkers, RUKEN_SDK_MARKERS } from './sdk-markers'
