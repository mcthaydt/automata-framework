import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { GET as llmsIndex } from '#src/routes/llms.txt/+server.ts'
import { AGENT_PROMPT } from '#src/shared/content/agent-prompt.ts'

// The launch covers 2D and 3D games, so the words a visitor first meets never narrow Automata to one of them: not the
// prompt Home copies, not the description search engines show, not llms.txt.

const repo = resolve(process.cwd(), '..')
const read = (path: string) => readFileSync(resolve(repo, path), 'utf8')

describe('the launch words', () => {
  it('make no promise of 2D only in the prompt a visitor copies', () => {
    expect(AGENT_PROMPT).not.toMatch(/\b2D\b/)
    expect(AGENT_PROMPT).toContain('I want to make a browser game with Automata')
  })

  it('leave 2D out of the default page description, and do not say "draw the levels"', () => {
    const meta = read('site/src/shared/components/PageMeta.svelte')
    const description = /description = '([^']*)'/.exec(meta)?.[1] ?? ''
    expect(description).not.toMatch(/\b2D\b|draw the levels/i)
    expect(description).toContain('Finish the game your agent started')
  })

  it('leave 2D out of llms.txt, which an agent reads first', async () => {
    expect(await llmsIndex().text()).not.toMatch(/\b2D\b/)
  })

  it('say the API file holds the beta packages a new game imports, marked beta', async () => {
    const text = await llmsIndex().text()
    expect(text).toContain('Every export of the')
    expect(text).toContain('and the beta packages a new game imports, marked beta')
  })

  it('call the editors guide by what a person does, not "draw levels"', async () => {
    expect(await llmsIndex().text()).toContain('- [Open the editors on your game](/docs/editor)')
  })
})
