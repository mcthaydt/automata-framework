// `@automata/net/testing`: the deterministic link harness and the scripted Colyseus SDK the
// client's tests run on, and net's wire over a link for a room and its clients.

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
} from '../testing/link-client'
