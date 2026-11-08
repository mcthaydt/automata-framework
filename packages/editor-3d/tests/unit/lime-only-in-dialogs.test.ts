import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// Lime is the one confirm of the layer a person is working in: the Publish button in the header, or a dialog's own. The 3D
// editors' screens inside the shell therefore have no lime button of their own, and only these dialogs may ask for one.
const DIALOGS = ['HeldSaveDialog.svelte', 'ErrorPanel.svelte', 'NewLevelDialog.svelte', 'MaterialSheet.svelte']

const SRC = new URL('../../src/', import.meta.url).pathname

function* svelteFiles(dir: string): Generator<string> {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) yield* svelteFiles(path)
    else if (entry.name.endsWith('.svelte')) yield path
  }
}

describe('the 3D editors’ lime buttons', () => {
  it('are only the confirms of dialogs', () => {
    const asking = [...svelteFiles(SRC)]
      .filter((path) => readFileSync(path, 'utf8').includes('variant="primary"'))
      .map((path) => path.split('/').at(-1))
    expect(asking.filter((name) => !DIALOGS.includes(name as string))).toEqual([])
  })
})
