import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { render } from '@testing-library/svelte'
import { describe, expect, it } from 'vitest'
import Start from '../../../src/features/start/Start.svelte'
import { STEPS } from '../../../src/features/start/start-content'

const repo = resolve(process.cwd(), '..')
const read = (path: string) => readFileSync(resolve(repo, path), 'utf8')

describe('Start', () => {
  it('walks through four steps, each one command and what you see', () => {
    const view = render(Start)
    // The agent setup folded inside "Using a coding agent" has headings of its own; these are the page's.
    const own = view
      .getAllByRole('heading', { level: 2 })
      .filter((heading) => heading.closest('details') === null)
    expect(own.map((heading) => heading.textContent)).toEqual([
      '1. Make a game',
      '2. Play it',
      '3. Draw its level',
      '4. Put it online',
      'Using a coding agent',
    ])
    expect(STEPS[0]?.command).toBe('npx @mcthaydt/automata-tools create-game my-game')
  })

  it('gives only commands the framework answers to', () => {
    // What create-game prints next, the editor's command and the web build's scripts.
    expect(read('packages/tools/src/app/cli.ts')).toContain('cd ${dir} && pnpm install && pnpm dev')
    expect(STEPS[1]?.command).toBe('cd my-game && pnpm install && pnpm dev')
    expect(read('packages/tools/src/shared/create-game/template-level.ts')).toContain(
      'pnpm exec automata editor',
    )
    expect(STEPS[2]?.command).toBe('pnpm exec automata editor')
    expect(read('docs/guides/publish-to-web.md')).toContain(STEPS[3]?.command)
  })

  it('says nothing the framework no longer has', () => {
    const text = render(Start).container.textContent ?? ''
    for (const gone of [/base-2d/, /git clone/, /@af-examples/, /double jump/i])
      expect(text).not.toMatch(gone)
  })
})
