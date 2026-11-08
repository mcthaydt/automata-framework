import { describe, expect, it } from 'vitest'
import { counterIds } from '#src/shared/level-2d/model/ids.ts'
import { checkProject } from '#src/shared/level-2d/profiles/level-project/project-checks.ts'
import { blankTemplate } from '#src/shared/level-2d/profiles/level-project/templates/blank.ts'
import { platformerTemplate } from '#src/shared/level-2d/profiles/level-project/templates/platformer.ts'
import { topdownRpgTemplate } from '#src/shared/level-2d/profiles/level-project/templates/topdown-rpg.ts'

describe('the starter projects', () => {
  it.each([platformerTemplate, topdownRpgTemplate, blankTemplate].map((t) => [t.id, t] as const))(
    '%s has no error and no warning (flow 1: a new project is valid)',
    (_id, template) => {
      const diagnostics = checkProject(template.create(counterIds()), {})
      expect(diagnostics.filter((d) => d.severity !== 'info')).toEqual([])
    },
  )

  it('lists only definitions nothing uses, and the empty level of a blank project, as info', () => {
    for (const template of [platformerTemplate, topdownRpgTemplate, blankTemplate]) {
      const codes = new Set(checkProject(template.create(counterIds()), {}).map((d) => d.code))
      for (const code of codes) expect(['unusedDefinition', 'emptyLevel']).toContain(code)
    }
    const blank = checkProject(blankTemplate.create(counterIds()), {}).map((d) => d.code)
    expect(blank).toContain('emptyLevel')
    const platformer = checkProject(platformerTemplate.create(counterIds()), {}).map((d) => d.code)
    expect(platformer).not.toContain('emptyLevel')
  })
})
