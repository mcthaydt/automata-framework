import { describe, expect, it } from 'vitest'
import { templateFiles } from '#src/shared/create-game/template-files.ts'

// A coding agent (Claude Code, Codex) opens the game from GitHub with no other briefing, so the game says what it may
// change and how to hand a change back. The person says yes in the Automata app (the apps spec, section 8).

const files = templateFiles({ id: 'lantern-run', title: 'Lantern Run', frameworkVersion: '0.0.5' })
const text = (path: string): string => files.find((file) => file.path === path)?.text ?? ''

describe("a new game's AGENTS.md", () => {
  const agents = text('AGENTS.md')

  it('names the folders an agent may edit, and the file it may not', () => {
    expect(agents).toContain('`content/`')
    expect(agents).toContain('`src/`')
    expect(agents).toContain('`content/levels/*.toml`')
    expect(agents).toContain('`content/levels/*.af2d.json`')
    expect(agents).toContain('is made from the `content/levels/*.af2d.json`')
  })

  it('asks for a branch and a pull request, and says who says yes', () => {
    expect(agents).toContain('Work on a branch named claude/')
    expect(agents).toContain('open a pull request')
    expect(agents).toContain('The person says yes in the Automata app.')
  })

  it('is named for the game and says which checks to run', () => {
    expect(agents).toContain('# Lantern Run')
    expect(agents).toContain('pnpm check')
    expect(agents).toContain('pnpm test')
  })

  it("keeps the app's own folder out of git", () => {
    expect(text('.gitignore').split('\n')).toContain('.automata/')
  })
})
