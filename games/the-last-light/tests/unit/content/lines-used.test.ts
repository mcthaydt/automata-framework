import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parse } from 'smol-toml'
import { describe, expect, it } from 'vitest'

// Every line the story has is shown by something the game does: a puzzle action's `say`, a caption, an objective row, a
// storylet, a hint, an item's name or text, or the register. A line nothing shows is dead weight a translator is paid for.
// (The plan asked for the narrative tool's screenplay, which plays the shortest route through a trace game over the sim;
// that plumbing is the extension's, so this is the check that holds without it: each line is used, none is lost.)

const ROOT = join(import.meta.dirname, '../../..')
const file = (path: string) => parse(readFileSync(join(ROOT, path), 'utf8')) as Record<string, any>

const lines = (file('content/lines/prologue.toml').lines as { id: string }[]).map((line) => line.id)
const puzzle = file('content/puzzles/prologue.toml')
const used = new Set<string>()

/** Every string value stored under a key named `line`, anywhere in `value`. */
function linesIn(value: unknown): void {
  if (Array.isArray(value)) for (const item of value) linesIn(item)
  else if (typeof value === 'object' && value !== null)
    for (const [key, child] of Object.entries(value)) {
      if ((key === 'line' || key === 'lines') && typeof child === 'string') used.add(child)
      else if (key === 'lines' && Array.isArray(child)) for (const id of child) used.add(String(id))
      else linesIn(child)
    }
}

// What a puzzle says: `say = "handover"` is the line `prologue.handover`; the fallback table names lines the same way.
for (const action of puzzle.actions as { say?: string }[]) if (action.say) used.add(`prologue.${action.say}`)
for (const fallback of Object.values(puzzle.fallback as Record<string, string>))
  used.add(`prologue.${fallback}`)
for (const item of puzzle.items as string[]) {
  used.add(`prologue.item.${item}`)
  used.add(`prologue.item.${item}.name`)
}
for (const path of [
  'content/hud/play.toml',
  'content/help/prologue.toml',
  'content/storylets/prologue.toml',
  'content/beats/prologue.toml',
])
  linesIn(file(path))
for (const beat of file('content/beats/prologue.toml').beats as { deliveredBy: string[] }[])
  for (const id of beat.deliveredBy) used.add(id)
for (const name of ['found', 'keypad', 'lights-out', 'opening', 'rest'])
  linesIn(file(`content/cutscenes/${name}.toml`))

/** Lines the game's own code says, which the files cannot name: the register (task 14) and the lamp's two. */
const SAID_BY_CODE = new Set([
  'prologue.registerAsk',
  'prologue.registerSign',
  'prologue.registerLeave',
  'prologue.registerSigned',
  'prologue.lampDry',
  'prologue.lighterEmpty',
])

/**
 * Lines the old prologue never showed either, kept because a line changes only on the Owner's word: act one's cloth torch
 * (`torch` is a tool the prologue never reaches) and the journal's entries (the journal screen is not in this slice).
 */
const NEVER_SHOWN_IN_THE_PROLOGUE = new Set([
  'prologue.torchOut',
  'prologue.combineTorch',
  'prologue.register.code',
  'prologue.register.supplyKey',
  'prologue.register.fillLamp',
  'prologue.register.darkShelf',
  'prologue.register.makeBed',
  'prologue.register.vigil',
])

describe('the story’s lines', () => {
  it('is each shown by something: nothing the game does leaves a line unsaid', () => {
    const unused = lines.filter(
      (id) => !used.has(id) && !SAID_BY_CODE.has(id) && !NEVER_SHOWN_IN_THE_PROLOGUE.has(id),
    )
    expect(unused).toEqual([])
  })

  it('names no line it does not have', () => {
    const have = new Set(lines)
    const missing = [...used].filter((id) => !have.has(id))
    expect(missing).toEqual([])
  })
})
