// @vitest-environment node
import { fileURLToPath } from 'node:url'
import { expect, it } from 'vitest'
import { valueImportsOf } from '../testing/import-graph'

// `./extension` is loaded by a game's vite.config.ts and by `ship`, in Node: nothing reachable from it
// may pull in the DOM-bound packages (M1.5 spec §3.1).
const ENTRY = fileURLToPath(new URL('./index.ts', import.meta.url))

it('reaches no Svelte, ui or content value import', () => {
  const imports = [...valueImportsOf(ENTRY)]

  expect(imports.filter((name) => name === 'svelte' || name.startsWith('svelte/'))).toEqual([])
  expect(imports).not.toContain('@mcthaydt/automata-ui')
  expect(imports).not.toContain('@mcthaydt/automata-content')
})

it('loads in Node', async () => {
  await expect(import('./index')).resolves.toBeDefined()
})
