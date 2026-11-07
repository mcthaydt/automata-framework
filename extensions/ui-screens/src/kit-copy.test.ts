import { readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { cleanup, render, screen } from '@testing-library/svelte'
import { afterEach, describe, expect, it } from 'vitest'
import { copyKit, KIT_ROOT, kitSources, specifiersOf } from './testing/copy-kit'

// A game may copy a screen to change it, so each screen must work from the copy and reach only what a game has:
// `@automata/framework`, `svelte`, and the other files it copies.

const ALLOWED = [/^@automata\/framework$/, /^svelte(\/.*)?$/, /^\.\/[A-Za-z]+\.svelte$/]
const copies: string[] = []
afterEach(() => {
  cleanup()
  for (const dir of copies.splice(0)) rmSync(dir, { recursive: true, force: true })
})

describe('the kit’s files', () => {
  it('import only core’s public entries, svelte and each other', () => {
    const stray = kitSources().flatMap(({ from, text }) =>
      specifiersOf(text)
        .filter((spec) => !ALLOWED.some((ok) => ok.test(spec)))
        .map((spec) => `${from}: ${spec}`),
    )
    expect(stray).toEqual([])
  })

  it('copy to the places kit.json says, and the copy mounts', async () => {
    const game = copyKit()
    copies.push(game)
    const { default: Results } = await import(
      /* @vite-ignore */ join(game, 'src/screens/ResultsScreen.svelte')
    )
    render(Results, {
      title: 'Done',
      rows: [{ id: 'a', label: 'Ash', value: '1' }],
      actions: [{ id: 'again', label: 'Again', primary: true }],
      copy: { rows: 'Rows', empty: 'None', more: (n: number) => `+${n}` },
      onAction: () => {},
    })
    expect(screen.getByRole('heading', { name: 'Done' })).toBeInTheDocument()
    expect(readFileSync(join(game, 'src/screens/ResultsScreen.svelte'), 'utf8')).toContain('ResultsScreen')
    expect(KIT_ROOT).toContain('ui-screens')
  })
})
