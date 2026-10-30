// `@mcthaydt/automata-net/testing`: the deterministic link harness (M7 spec §4.7) and the scripted Colyseus SDK the
// client's tests run on (M7.5a).

export {
  type FakeColyseus,
  type FakeOutcome,
  type FakeRoom,
  type FakeSocket,
  fakeColyseus,
} from './fake-colyseus'
export { createLink, type LinkOptions, type Transport, type WireData } from './link'
