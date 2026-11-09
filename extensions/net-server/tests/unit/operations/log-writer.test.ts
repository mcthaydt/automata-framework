import { describe, expect, it } from 'vitest'
import { colyseusLogger, createLogWriter, levelOf, toLogLine } from '#src/features/operations/log-writer.ts'
import { serverLogLine } from '#src/features/operations/server-log-line.schema.ts'
import type { RoomLogEvent } from '#src/shared/game/server-config.ts'

// The writer: one line per event, parsed by `serverLogLine`, and nothing outside the
// schema's fields ever written. Every planted value below is an obvious fake.

const PLANTED = {
  token: 'FAKE-TOKEN-not-a-secret-0001',
  session: 'fake-session-id-0002',
  authorization: 'Bearer FAKE-BEARER-0003',
  name: 'PlantedKite',
  roomCode: 'QZXW7K',
  ip: '203.0.113.77',
}

function capture(): { lines: string[]; log: (event: RoomLogEvent) => void } {
  const lines: string[] = []
  const log = createLogWriter({ write: (line) => lines.push(line), now: () => 1_790_000_000_123 })
  return { lines, log }
}

describe('levelOf', () => {
  it.each([
    ['fatal', 'fatal'],
    ['refused', 'warn'],
    ['tick.slow', 'warn'],
    ['step.slow', 'warn'],
    ['input.late', 'warn'],
    ['room.error', 'warn'],
    ['replay.failed', 'warn'],
    ['start.refused', 'fatal'],
    ['room.created', 'info'],
    ['drain.done', 'info'],
  ])('%s is %s', (event, level) => {
    expect(levelOf(event)).toBe(level)
  })
})

describe('createLogWriter', () => {
  it('writes one JSON line per event, ending in a newline, with ts from the clock and level from the event', () => {
    const { lines, log } = capture()
    log({ event: 'seat.joined', room: '4', seat: 1 })
    log({ event: 'refused', code: 'busy' })
    expect(lines).toEqual([
      '{"ts":1790000000123,"level":"info","event":"seat.joined","room":"4","seat":1}\n',
      '{"ts":1790000000123,"level":"warn","event":"refused","code":"busy"}\n',
    ])
    for (const line of lines) expect(serverLogLine.safeParse(JSON.parse(line)).success).toBe(true)
  })

  it('drops every field the schema does not have, so planted secrets never reach the line', () => {
    const { lines, log } = capture()
    log({ event: 'seat.joined', room: '4', seat: 0, ...PLANTED } as RoomLogEvent)
    expect(lines).toHaveLength(1)
    for (const value of Object.values(PLANTED)) expect(lines[0]).not.toContain(value)
    expect(JSON.parse(lines[0] as string)).toEqual({
      ts: 1_790_000_000_123,
      level: 'info',
      event: 'seat.joined',
      room: '4',
      seat: 0,
    })
  })

  it.each([
    { event: 'refused', code: PLANTED.ip },
    { event: 'refused', code: PLANTED.authorization },
    { event: 'room.created', room: PLANTED.roomCode },
    { event: `player ${PLANTED.name}` },
  ])('writes log.invalid, and none of the line, for a value the schema refuses: %j', (event) => {
    const { lines, log } = capture()
    log(event)
    expect(lines).toEqual(['{"ts":1790000000123,"level":"warn","event":"log.invalid"}\n'])
  })

  it('keeps only the schema fields when it builds a line', () => {
    const event = { event: 'tick.slow', room: '2', ms: 40, token: PLANTED.token }
    expect(toLogLine(event, 7)).toEqual({
      ts: 7,
      level: 'warn',
      event: 'tick.slow',
      room: '2',
      ms: 40,
    })
  })
})

describe('colyseusLogger', () => {
  it('turns errors and warnings into text-free lines and drops the rest', () => {
    const events: RoomLogEvent[] = []
    const logger = colyseusLogger((event) => events.push(event))
    logger.error(`room ${PLANTED.roomCode} failed for ${PLANTED.ip}`, new Error(PLANTED.token))
    logger.warn(`seat ${PLANTED.name}`)
    logger.info(`"${PLANTED.roomCode}" ready`)
    logger.debug(PLANTED.session)
    logger.trace(PLANTED.session)
    expect(events).toEqual([{ event: 'colyseus.error' }, { event: 'colyseus.warn' }])
  })
})
