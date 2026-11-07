export { type FakeHostClock, type ManualClock, manualClock, realClock } from './clocks'
// The Ruken adapter over `@ruken/sdk-host`'s fake host, for tests that need Ruken's own SDK in between. Ruken-only;
// `fakeHosting` is the target-neutral fake.
export {
  type FakeHostHandle,
  type HostingTestOptions,
  type HostingTestSession,
  openHostingTest,
  TEST_GAME_ORIGIN,
  withHostingTest,
} from './ruken/hosting-test'
