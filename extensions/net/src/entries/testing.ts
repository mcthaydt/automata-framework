// `@automata/net/testing`: the deterministic link harness (M7 spec §4.7) and the scripted Colyseus SDK the
// client's tests run on (M7.5a), and net's wire over a link for a room and its clients (M7.5b).

export {
  type FakeColyseus,
  type FakeOutcome,
  type FakeRoom,
  type FakeSocket,
  fakeColyseus,
} from '../testing/fake-colyseus'
export { createLink, type LinkOptions, type Transport, type WireData } from '../testing/link'
export {
  type LinkClient,
  type LinkRoomClient,
  linkClient,
  linkRoomClient,
  type RunEffect,
} from '../testing/link-client'
