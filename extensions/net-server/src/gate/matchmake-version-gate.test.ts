import { PROTOCOL_VERSION, ROOM_NAME } from '@automata/net'
import { netPlugin } from '@automata/net/sim'
import { createSim, definePlugin } from '@automata/sim'
import { afterEach, describe, expect, it } from 'vitest'
import { startTestServer, type TestServer } from '../test-support/colyseus-harness'
import { FIXTURE_CONTENT, fixtureGame, fixtureServer, walkPlugin } from '../test-support/fixture-game'
import { gameVersionOf, versionVerdict } from './matchmake-version-gate'

// The join check (spec §4.2, §6 "Schema or content hash differs → VERSION_MISMATCH", FloorFifty
// matchmake-version-gate.ts and race-room-join-check.test.ts): a client on another protocol, or built from another
// sim schema or other content, is refused at its matchmaking request, before a room opens or a seat is taken.

const OTHER = 'fedcba9876543210'

describe("the game's version", () => {
  it('is the protocol and the hashes a sim of the game reports', async () => {
    const version = await gameVersionOf(fixtureServer())
    const sim = await createSim({ seed: 1, plugins: fixtureGame.plugins, content: FIXTURE_CONTENT })
    expect(version).toEqual({
      protocol: PROTOCOL_VERSION,
      schemaHash: sim.describeSnapshot().header.schemaHash,
      contentHash: sim.contentHash,
    })
    sim.dispose()
  })

  it('moves with the content and with the sim schema', async () => {
    const base = await gameVersionOf(fixtureServer())
    const content = await gameVersionOf(fixtureServer({ content: { goal: 6 } }))
    const extra = definePlugin({ name: 'extra', components: [], systems: [] })
    const schema = await gameVersionOf(fixtureServer({ plugins: [netPlugin, walkPlugin, extra] }))
    expect(content.contentHash).not.toBe(base.contentHash)
    expect(content.schemaHash).toBe(base.schemaHash)
    expect(schema.schemaHash).not.toBe(base.schemaHash)
  })
})

describe('the verdict on join options', () => {
  const version = {
    protocol: PROTOCOL_VERSION,
    schemaHash: '0123456789abcdef',
    contentHash: 'abcdef0123456789',
  }
  const same = {
    protocol: PROTOCOL_VERSION,
    schemaHash: version.schemaHash,
    contentHash: version.contentHash,
  }

  it('finds the same version, or a mismatch in any of the three', () => {
    expect(versionVerdict({ ...same, name: 'Ada' }, version)).toBe('same')
    expect(versionVerdict({ ...same, protocol: PROTOCOL_VERSION + 1 }, version)).toBe('mismatch')
    expect(versionVerdict({ ...same, schemaHash: OTHER }, version)).toBe('mismatch')
    expect(versionVerdict({ ...same, contentHash: OTHER }, version)).toBe('mismatch')
  })

  // An old client may send a shape this server does not know; its protocol alone says it is another version.
  it('leaves options it cannot read to the room, unless the protocol already differs', () => {
    expect(versionVerdict(undefined, version)).toBe('unread')
    expect(versionVerdict('text', version)).toBe('unread')
    expect(versionVerdict({ ...same, protocol: '1' }, version)).toBe('unread')
    expect(versionVerdict({ protocol: PROTOCOL_VERSION }, version)).toBe('unread')
    expect(versionVerdict({ protocol: PROTOCOL_VERSION + 1 }, version)).toBe('mismatch')
  })
})

describe('the version gate in front of matchmaking', () => {
  let server: TestServer | undefined
  afterEach(async () => {
    await server?.close()
    server = undefined
  })

  it.each([
    ['another protocol', { protocol: PROTOCOL_VERSION + 1 }],
    ['another sim schema', { schemaHash: OTHER }],
    ['other content', { contentHash: OTHER }],
  ])('refuses a client on %s with VERSION_MISMATCH, and opens no room', async (_, over) => {
    server = await startTestServer()
    const response = await server.matchmake('create', { ...server.joinOptions('Ada'), ...over })
    expect(response.status).toBe(400)
    expect(((await response.json()) as { error: string }).error).toMatch(/^VERSION_MISMATCH: /)
    expect(server.runtime.rooms.size).toBe(0)
    expect(server.logs).toContainEqual({ event: 'refused', code: 'version' })
  })

  it('refuses a join by code on other content, and seats the same version', async () => {
    server = await startTestServer()
    const host = await server.create('Ada')
    const late = server.matchmake(`joinById`, { ...server.joinOptions('Bea'), contentHash: OTHER }, host.code)
    expect((await late).status).toBe(400)
    const guest = await server.joinById(host.code, 'Bea')
    expect(guest.of('seated')).toHaveLength(1)
  })

  it('leaves malformed options to the room, which refuses them', async () => {
    server = await startTestServer()
    // Colyseus runs the room's check once the socket opens, so the refusal reaches the SDK client, not the request.
    const join = server.colyseus.sdk.create(ROOM_NAME, { protocol: PROTOCOL_VERSION, name: 'Ada' })
    await expect(join).rejects.toThrow(/^REFUSED: /)
  })

  it('lets a reconnect through, which carries no version', async () => {
    server = await startTestServer()
    const response = await server.matchmake('reconnect', { reconnectionToken: 'not-a-token' }, 'ZZZZZZ')
    expect(((await response.json()) as { error?: string }).error ?? '').not.toMatch(/VERSION_MISMATCH/)
  })

  // Defence in depth (M7.3b left the hashes parsed and not compared): a join that reached the room some other way.
  it("is held by the room's own check too", async () => {
    server = await startTestServer()
    const host = await server.create('Ada')
    const room = server.room(host.code)
    const client = {} as Parameters<typeof room.onAuth>[0]
    expect(() => room.onAuth(client, { ...server?.joinOptions('Bea'), contentHash: OTHER })).toThrow(
      /^VERSION_MISMATCH: /,
    )
  })
})
