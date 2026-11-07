import { netPlugin } from '@automata/net/sim'
import { defineCommand, definePlugin } from '@automata/sim'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { defineServer, ROOM_SOURCE, type ServerGameDef } from './server-game'

// defineServer (M7 spec §4.3): a game's server, checked once before any room runs it.

const Move = defineCommand('move', z.object({ dx: z.number().int() }).strict())
const game = definePlugin({ name: 'game', commands: [Move] })
const def: ServerGameDef = { plugins: [netPlugin, game], seats: { min: 1, max: 4 } }

describe('defineServer', () => {
  it('fills the lobby defaults: a three-second countdown once everyone is ready', () => {
    expect(defineServer(def).lobby).toEqual({ countdownSeconds: 3, startWhen: 'all-ready' })
    expect(defineServer({ ...def, lobby: { countdownSeconds: 0, startWhen: 'host' } }).lobby).toEqual({
      countdownSeconds: 0,
      startWhen: 'host',
    })
  })

  it.each([
    ['no seat', { min: 0, max: 4 }],
    ['more seats than the wire has', { min: 1, max: 17 }],
    ['a minimum above the maximum', { min: 3, max: 2 }],
    ['a fractional seat count', { min: 1, max: 2.5 }],
  ])('refuses %s', (_, seats) => {
    expect(() => defineServer({ ...def, seats })).toThrow(/seats/)
  })

  it('refuses a negative countdown', () => {
    expect(() => defineServer({ ...def, lobby: { countdownSeconds: -1, startWhen: 'all-ready' } })).toThrow(
      /countdown/,
    )
  })

  it("refuses a game without net's plugin: the room seats players with its commands", () => {
    expect(() => defineServer({ ...def, plugins: [game] })).toThrow(/netPlugin/)
  })

  it("knows each command a client may send by its schema, and keeps net's seat commands for the room", () => {
    const server = defineServer(def)
    expect(server.clientCommand('move')).toBe(Move)
    expect(server.clientCommand('seat.join')).toBeUndefined()
    expect(server.clientCommand('seat.leave')).toBeUndefined()
    expect(server.clientCommand('nope')).toBeUndefined()
  })

  it('gives the room its own sim source, above every seat', () => {
    expect(ROOM_SOURCE).toBe(255)
  })
})
