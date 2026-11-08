// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { createRunGate } from '../../../playground/src/run-gate.ts'

const SITE = 'https://automata.example'
const parentWindow = {}
const run = { v: 1, type: 'run', runId: 1, code: 'export default 1' }

describe('the run gate', () => {
  it('accepts one run from the parent window with the site origin', () => {
    const gate = createRunGate(parentWindow, SITE)
    expect(gate({ source: parentWindow, origin: SITE, data: run })).toEqual(run)
  })

  it('drops a message from another window, another origin or of another shape, and stays open', () => {
    const gate = createRunGate(parentWindow, SITE)
    expect(gate({ source: {}, origin: SITE, data: run })).toBeUndefined()
    expect(gate({ source: parentWindow, origin: 'null', data: run })).toBeUndefined()
    expect(gate({ source: parentWindow, origin: 'https://evil.example', data: run })).toBeUndefined()
    expect(gate({ source: parentWindow, origin: SITE, data: { ...run, extra: 1 } })).toBeUndefined()
    expect(gate({ source: parentWindow, origin: SITE, data: 'run' })).toBeUndefined()
    expect(gate({ source: parentWindow, origin: SITE, data: run })).toEqual(run)
  })

  it('accepts no second run, ever', () => {
    const gate = createRunGate(parentWindow, SITE)
    gate({ source: parentWindow, origin: SITE, data: run })
    expect(gate({ source: parentWindow, origin: SITE, data: { ...run, runId: 2 } })).toBeUndefined()
  })
})
