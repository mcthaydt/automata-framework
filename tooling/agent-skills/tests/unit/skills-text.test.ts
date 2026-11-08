import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

// The skills teach today's framework: a game keeps its code in `src/features/`, `automata check` refuses a `src/sim/`
// folder, no target is the reference host, and the sim has no networked authority. Words from before the refactor
// fail here, so a skill cannot quietly go back to them.

const SKILLS = resolve(import.meta.dirname, '../../../../agents/automata/skills')
const skills = readdirSync(SKILLS).map((name) => ({
  name,
  text: readFileSync(join(SKILLS, name, 'SKILL.md'), 'utf8'),
}))

const RETIRED = ['src/sim/', 'reference host', 'networked truth', 'vitest run src/']

describe('the skills', () => {
  it.each(skills)('$name names nothing the framework retired', ({ text }) => {
    for (const words of RETIRED) expect(text, words).not.toContain(words)
  })

  it('open the editors with one command and no build step', () => {
    const editor = skills.find((skill) => skill.name === 'automata-editor')?.text ?? ''
    expect(editor).toContain('automata editor')
    expect(editor).not.toMatch(/pnpm --filter .* build/)
  })
})
