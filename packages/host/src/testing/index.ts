export { type FakeHostClock, type ManualClock, manualClock, realClock } from './clocks'
// The Ruken adapter's test layer, over `@ruken/sdk-host`'s fake host. Ruken-only (DIST spec §5.2); `FakeHosting`
// in `@mcthaydt/automata-testing` replaces it for target-neutral tests (DIST.4).
export { FakeHostHandle, HostingTest, type HostingTestOptions, TEST_GAME_ORIGIN } from './ruken/hosting-test'
export { runScoped } from './run'
