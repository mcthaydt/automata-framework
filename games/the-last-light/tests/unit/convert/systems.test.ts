import { parse } from 'smol-toml'
import { describe, expect, it } from 'vitest'
import { rewriteCalls } from '../../../tools/convert/systems.ts'

const TEXT = `scene = "prologue"

[[rules]]
id = "R15"
text = "Light costs fuel."

[[rules.when]]
[rules.when.not]
fact = "light"
is = "off"

[[rules.then]]
call = "burnLight"

[[rules]]
id = "footsteps"
text = "Steps."

[[rules.then]]
call = "footsteps"

[[rules]]
id = "lightsOut"
text = "Lights out."

[[rules.then]]
call = "wake"

[[matrix]]
row = "light"
col = "tool:handLamp"
verb = "the paraffin goes down"
rule = "R15"

[[agents]]
id = "nurse"
hooks = [ "chase", "replan", "fleeGoal", "stop", "leave" ]

[[agents.transitions]]
from = "*"
to = "hunt"

[[agents.transitions.do]]
call = "chase"

[[agents.transitions]]
from = "patrol"
to = "patrol"

[[agents.transitions.do]]
call = "fleeGoal"

[[agents.transitions]]
from = "hunt"
to = "hunt"

[[agents.transitions.do]]
call = "replan"
`

function rewritten() {
  const { files, report } = rewriteCalls(TEXT)
  return { file: parse(files['content/systems/prologue.toml'] as string) as any, report }
}

const callsIn = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.flatMap(callsIn)
    : typeof value === 'object' && value !== null
      ? Object.entries(value).flatMap(([k, v]) => (k === 'call' ? [String(v)] : callsIn(v)))
      : []

describe('rewriteCalls', () => {
  it('turns a matrix cell that cited the dropped fuel rule into a cut that says where the fuel burns', () => {
    const { file, report } = rewritten()
    expect(file.matrix[0].rule).toBeUndefined()
    expect(file.matrix[0].cut).toMatch(/lamp feature/)
    expect(report).toContainEqual(expect.objectContaining({ where: 'matrix light × tool:handLamp' }))
  })

  it('writes chase as a goTo the player and fleeGoal as a flee from light', () => {
    const { file } = rewritten()
    expect(file.agents[0].transitions[0].do[0]).toEqual({ goTo: 'player' })
    expect(file.agents[0].transitions[1].do[0]).toEqual({ flee: 'light' })
  })

  it('drops the fuel rule and the footsteps rule, and says each', () => {
    const { file, report } = rewritten()
    expect(file.rules.map((rule: { id: string }) => rule.id)).toEqual(['lightsOut'])
    expect(report.filter((row) => row.did === 'dropped').map((row) => row.where)).toEqual([
      'rule R15',
      'rule footsteps',
    ])
  })

  it('leaves only the calls the game answers, and no longer declares chase or fleeGoal', () => {
    const { file } = rewritten()
    expect(callsIn(file).sort()).toEqual(['replan', 'wake'])
    expect(file.agents[0].hooks).toEqual(['replan', 'stop', 'leave'])
  })
})
