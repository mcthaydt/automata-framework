import { openDocument } from '@automata/editor/kit/documents'
import { checkSystems, systemsDefShape } from '@automata/systems/sim'
import { describe, expect, it } from 'vitest'
import { newAgent, newSystemsFile, systemsFileText } from '#src/features/schematic/starter.ts'

describe('a new file', () => {
  const def = newSystemsFile('hall', newAgent('guard'))

  it('passes the shape and every check', () => {
    expect(systemsDefShape.safeParse(def).success).toBe(true)
    const problems: string[] = []
    checkSystems(def, { hooks: [] }, (_path, message) => problems.push(message))
    expect(problems).toEqual([])
  })

  it('has the fairness of a careful player who wins 9 times in 10, and every list empty', () => {
    expect(def.fairness).toEqual({
      cautiousWin: 0.9,
      firstThreatAfter: 20,
      telegraph: 1.5,
      maxDeathsPerRun: 1,
      safeWindowMargin: 1.3,
    })
    expect([def.objects, def.matrix, def.rules, def.scenarios]).toEqual([[], [], [], []])
    expect(def.tunables).toEqual({})
    expect(def.agents.map((a) => a.id)).toEqual(['guard'])
  })

  it('writes TOML that reads back as the same scene', () => {
    const text = systemsFileText(def)
    expect(text).toContain('scene = "hall"')
    const back = openDocument('hall.toml', text).value()
    expect(back).toEqual(JSON.parse(JSON.stringify(def)))
  })

  it('gives a new character a mode with a speed and nothing else', () => {
    const agent = newAgent('sentry')
    expect(agent.modes).toEqual(['patrol'])
    expect(agent.speed).toEqual({ patrol: 1.2 })
    expect(agent.initial).toBe('patrol')
    expect(agent.transitions).toEqual([])
  })
})
