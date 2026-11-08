import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// A `var(--name)` with no definition draws nothing: the playhead, a selected step and a link all went missing that way.
const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..', '..', '..')
const editorSrc = join(root, '..', '..', 'packages', 'editor', 'src')

function filesUnder(dir: string, extensions: readonly string[]): string[] {
  return readdirSync(dir, { withFileTypes: true, recursive: true })
    .filter((entry) => entry.isFile() && extensions.some((extension) => entry.name.endsWith(extension)))
    .map((entry) => join(entry.parentPath, entry.name))
}

describe('the editors’ colours and spaces', () => {
  const sources = filesUnder(join(root, 'src'), ['.svelte', '.ts', '.css'])
  const defined = new Set(
    [...sources, ...filesUnder(editorSrc, ['.css', '.svelte', '.ts'])].flatMap((file) =>
      [...readFileSync(file, 'utf8').matchAll(/(--[a-z0-9-]+)\s*:/g)].map((match) => match[1] as string),
    ),
  )

  it('every var(--…) an editor uses is defined, in the kit’s tokens or in the editor itself', () => {
    const missing = sources.flatMap((file) =>
      [...readFileSync(file, 'utf8').matchAll(/var\((--[a-z0-9-]+)\s*\)/g)]
        .map((match) => match[1] as string)
        .filter((name) => !defined.has(name))
        .map((name) => `${file.slice(root.length + 1)}: ${name}`),
    )
    expect(missing).toEqual([])
  })
})
