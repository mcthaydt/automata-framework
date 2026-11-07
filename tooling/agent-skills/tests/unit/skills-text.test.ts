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

const RETIRED = [
  'src/sim/',
  'reference host',
  'networked truth',
  'vitest run src/',
  'physics entry points',
  "Ruken's CSP",
  "Ruken's Content-Security-Policy",
]

describe('the skills', () => {
  it.each(skills)('$name names nothing the framework retired', ({ text }) => {
    for (const words of RETIRED) expect(text, words).not.toContain(words)
  })

  it('say the no-eval rule once, and explain its proof without naming Ruken', () => {
    // A stranger building for itch.io does not know what "Ruken's rules" are, so the proof line says what is done.
    const verify = skills.find((skill) => skill.name === 'automata-verify')?.text ?? ''
    expect(verify.match(/may not use `eval` on any target/g)).toHaveLength(1)
    expect(verify).not.toContain("under Ruken's rules")
    expect(verify).toContain(
      'automata check --csp` opens your build in Chromium under a strict Content-Security-Policy',
    )
  })

  it('open the 2D editor with one command and no build step', () => {
    const editor = skills.find((skill) => skill.name === 'automata-editor')?.text ?? ''
    expect(editor).toContain('automata editor')
    expect(editor).not.toMatch(/pnpm --filter .* build/)
  })
})
