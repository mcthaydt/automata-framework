import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { render } from '@testing-library/svelte'
import { describe, expect, it } from 'vitest'
import Start from '#src/features/start/Start.svelte'
import { STEPS } from '#src/features/start/start-content.ts'

const repo = resolve(process.cwd(), '..')
const read = (path: string) => readFileSync(resolve(repo, path), 'utf8')

describe('Start', () => {
  it('walks through three steps: make it, open the editors, publish it', () => {
    const view = render(Start)
    // The agent setup folded inside "Using a coding agent" has headings of its own; these are the page's.
    const own = view
      .getAllByRole('heading', { level: 2 })
      .filter((heading) => heading.closest('details') === null)
    expect(own.map((heading) => heading.textContent)).toEqual([
      '1. Make a game',
      '2. Open the editors',
      '3. Publish it',
      'Using a coding agent',
    ])
    expect(STEPS[0]?.command).toBe('npx @automata/tools create-game my-game')
  })

  it('gives the commands create-game prints, and says where Publish is for the last step', () => {
    // What create-game prints next is Start's second step, word for word; the editors' Play and Publish are the rest.
    const next = /Next: (cd \$\{dir\} && pnpm install && pnpm \w+)\\n/.exec(read('packages/tools/src/app/cli.ts'))?.[1]
    expect(next).toBe('cd ${dir} && pnpm install && pnpm editor')
    expect(STEPS[1]?.command).toBe('cd my-game && pnpm install && pnpm editor')
    expect(STEPS[2]?.command).toBeUndefined()
    const view = render(Start)
    expect(view.container.textContent).toContain('Press Play')
    expect(view.container.textContent).toContain('Press Publish')
  })

  it('says nothing the framework no longer has', () => {
    const text = render(Start).container.textContent ?? ''
    for (const gone of [/base-2d/, /git clone/, /@af-examples/, /double jump/i])
      expect(text).not.toMatch(gone)
  })
})
