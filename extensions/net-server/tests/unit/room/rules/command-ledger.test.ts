import { describe, expect, it } from 'vitest'
import { COMMAND_HISTORY, CommandLedger, requestIdOf } from '#src/features/room/rules/command-ledger.ts'
import { RoomCommandError } from '#src/features/room/rules/room-errors.ts'

// The command ledger, keyed by the wire's `req` (net's reqIdSchema)
// and answered with net's error codes.

/** A command that counts how often it actually ran. */
function counter(): { run: () => void; readonly runs: number } {
  let runs = 0
  return {
    run: () => {
      runs += 1
    },
    get runs() {
      return runs
    },
  }
}

describe('the command ledger', () => {
  it('runs a new request and answers it ok', () => {
    const ledger = new CommandLedger()
    const command = counter()
    expect(ledger.answer('s1', 'r1', command.run)).toEqual({
      result: { req: 'r1', ok: true },
      replayed: false,
    })
    expect(command.runs).toBe(1)
  })

  it('replays a repeated request id without running it again', () => {
    const ledger = new CommandLedger()
    const command = counter()
    ledger.answer('s1', 'r1', command.run)
    expect(ledger.answer('s1', 'r1', command.run)).toEqual({
      result: { req: 'r1', ok: true },
      replayed: true,
    })
    expect(command.runs).toBe(1)
  })

  it('answers a refusal with its own code, and replays the refusal', () => {
    const ledger = new CommandLedger()
    let runs = 0
    const refuse = (): void => {
      runs += 1
      throw new RoomCommandError('REFUSED', 'only the host adds a bot')
    }
    expect(ledger.answer('s1', 'r1', refuse).result).toEqual({
      req: 'r1',
      ok: false,
      error: { code: 'REFUSED', message: 'only the host adds a bot' },
    })
    expect(ledger.answer('s1', 'r1', refuse).replayed).toBe(true)
    expect(runs).toBe(1)
  })

  it('answers an unexpected throw with a generic message, never the error’s text', () => {
    const ledger = new CommandLedger()
    const answer = ledger.answer('s1', 'r1', () => {
      throw new Error('internal detail a player must not see')
    })
    expect(answer.result).toEqual({
      req: 'r1',
      ok: false,
      error: { code: 'REFUSED', message: 'the server could not process that message' },
    })
  })

  it('keeps each session’s history apart', () => {
    const ledger = new CommandLedger()
    const command = counter()
    ledger.answer('s1', 'r1', command.run)
    expect(ledger.answer('s2', 'r1', command.run).replayed).toBe(false)
    expect(command.runs).toBe(2)
  })

  it('forgets the oldest answer once a session’s history is full', () => {
    const ledger = new CommandLedger(2)
    const command = counter()
    ledger.answer('s1', 'r1', command.run)
    ledger.answer('s1', 'r2', command.run)
    ledger.answer('s1', 'r3', command.run)
    // r1 was evicted to make room for r3, so resending it runs it again.
    expect(ledger.answer('s1', 'r1', command.run).replayed).toBe(false)
    // r3 was stored after the eviction and is still remembered.
    expect(ledger.answer('s1', 'r3', command.run).replayed).toBe(true)
  })

  it('holds sixty-four answers per session by default', () => {
    expect(COMMAND_HISTORY).toBe(64)
    const ledger = new CommandLedger()
    const command = counter()
    for (let id = 1; id <= 65; id += 1) ledger.answer('s1', `r${id}`, command.run)
    expect(ledger.answer('s1', 'r65', command.run).replayed).toBe(true)
    expect(ledger.answer('s1', 'r2', command.run).replayed).toBe(true)
    expect(ledger.answer('s1', 'r1', command.run).replayed).toBe(false)
  })

  it('forgets a session entirely', () => {
    const ledger = new CommandLedger()
    const command = counter()
    ledger.answer('s1', 'r1', command.run)
    ledger.forget('s1')
    expect(ledger.answer('s1', 'r1', command.run).replayed).toBe(false)
  })
})

describe('reading a request id', () => {
  it('reads the id a message carries', () => {
    expect(requestIdOf({ t: 'ready', req: 'abc', ready: true })).toBe('abc')
  })

  it('accepts ids of one and of sixty-four characters', () => {
    expect(requestIdOf({ req: 'x' })).toBe('x')
    expect(requestIdOf({ req: 'x'.repeat(64) })).toBe('x'.repeat(64))
  })

  it('finds nothing in an id that is not a string, without converting it', () => {
    expect(requestIdOf({ req: 42 })).toBeUndefined()
    expect(requestIdOf({ req: true })).toBeUndefined()
    expect(requestIdOf({ req: null })).toBeUndefined()
    expect(requestIdOf({ req: ['r1'] })).toBeUndefined()
    // A decoded object can carry a `toString` that is not a function, so converting it throws. Reading it must not.
    expect(() => requestIdOf({ req: { toString: 1 } })).not.toThrow()
    expect(requestIdOf({ req: { toString: 1 } })).toBeUndefined()
  })

  it('finds nothing in an empty or over-long id', () => {
    expect(requestIdOf({ req: '' })).toBeUndefined()
    expect(requestIdOf({ req: 'x'.repeat(65) })).toBeUndefined()
  })

  it('reads only the message’s own plain id, never an inherited or computed one', () => {
    expect(requestIdOf(Object.create({ req: 'r1' }))).toBeUndefined()
    const computed = Object.defineProperty({}, 'req', {
      enumerable: true,
      get: () => {
        throw new Error('a getter ran')
      },
    })
    expect(() => requestIdOf(computed)).not.toThrow()
    expect(requestIdOf(computed)).toBeUndefined()
  })

  it('finds nothing in a message without one', () => {
    expect(requestIdOf({ ready: true })).toBeUndefined()
    expect(requestIdOf(null)).toBeUndefined()
    expect(requestIdOf('ready')).toBeUndefined()
  })
})
