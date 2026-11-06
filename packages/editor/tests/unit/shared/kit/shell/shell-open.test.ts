import { describe, expect, test } from 'vitest'
import { type OpenState, reconcileOpen } from '#src/shared/kit/shell/shell-open.ts'

const closed: OpenState = { panel: false, inspector: false, dock: false }

describe('reconcileOpen', () => {
  test('in compact, opening a region closes the others: the one that just opened wins', () => {
    const previous: OpenState = { ...closed, panel: true }
    expect(reconcileOpen('compact', previous, { ...previous, inspector: true })).toEqual({
      ...closed,
      inspector: true,
    })
    expect(reconcileOpen('compact', previous, { ...previous, dock: true })).toEqual({ ...closed, dock: true })
  })

  test('in compact, closing a region leaves the rest as they are', () => {
    const previous: OpenState = { ...closed, dock: true }
    expect(reconcileOpen('compact', previous, closed)).toEqual(closed)
  })

  test('in compact, two regions open at once with none newly opened keeps the first of panel, inspector, dock', () => {
    const all: OpenState = { panel: true, inspector: true, dock: true }
    expect(reconcileOpen('compact', all, all)).toEqual({ ...closed, panel: true })
  })

  test('in compact, two regions newly open at once keeps the last of panel, inspector, dock', () => {
    expect(reconcileOpen('compact', closed, { panel: true, inspector: true, dock: false })).toEqual({
      ...closed,
      inspector: true,
    })
  })

  test('wide and medium let any combination stay open', () => {
    const all: OpenState = { panel: true, inspector: true, dock: true }
    expect(reconcileOpen('wide', closed, all)).toEqual(all)
    expect(reconcileOpen('medium', closed, all)).toEqual(all)
  })
})
