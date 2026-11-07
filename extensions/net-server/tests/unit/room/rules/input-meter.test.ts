import { describe, expect, it } from 'vitest'
import { InputMeter } from '#src/features/room/rules/input-meter.ts'

// The input meter, keyed by seat, with the budget as options (`commandsPerSeat`: a burst of tickHz, refilled a
// little above tickHz).

const P = 0
const Q = 1
const CAPACITY = 60
const PER_TICK = 2

const meter = (): InputMeter => new InputMeter({ capacity: CAPACITY, creditsPerTick: PER_TICK })

/** Spends until the meter refuses, and says how many commands got through. */
function spendAll(m: InputMeter, seat: number): number {
  let spent = 0
  while (m.spend(seat)) {
    spent += 1
    if (spent > 10_000) throw new Error('the meter never refused')
  }
  return spent
}

describe('the input meter', () => {
  it('lets a full budget spend one second of commands and no more', () => {
    const m = meter()
    m.fill(P)
    expect(spendAll(m, P)).toBe(CAPACITY)
    expect(m.spend(P)).toBe(false)
  })

  it('earns credit back each tick', () => {
    const m = meter()
    m.fill(P)
    spendAll(m, P)
    m.refill([P])
    expect(spendAll(m, P)).toBe(PER_TICK)
  })

  it('never banks past its capacity, however long a seat idles', () => {
    const m = meter()
    m.fill(P)
    for (let tick = 0; tick < 5; tick += 1) m.refill([P])
    expect(spendAll(m, P)).toBe(CAPACITY)
  })

  it('gives a seat it has never filled nothing until it earns it', () => {
    const m = meter()
    expect(m.spend(Q)).toBe(false)
    m.refill([Q])
    expect(spendAll(m, Q)).toBe(PER_TICK)
  })

  it('refills only the seats it is given', () => {
    const m = meter()
    m.fill(P)
    m.fill(Q)
    spendAll(m, P)
    spendAll(m, Q)
    m.refill([P])
    expect(m.spend(P)).toBe(true)
    expect(m.spend(Q)).toBe(false)
  })

  it('forgets a seat that left', () => {
    const m = meter()
    m.fill(P)
    m.forget(P)
    expect(m.spend(P)).toBe(false)
  })
})
