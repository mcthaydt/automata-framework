import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { RUNTIME_SPECIFIERS } from '#src/features/player/runtime-manifest.ts'
import { scanSpecifiers } from '#src/features/player/vite-subset.ts'
import { gameFromDisk, newGame } from './fake-games.ts'

const emberwick = join(import.meta.dirname, '../../../../../games/emberwick')

/** Every package a source file names, as written, not a file of the game itself. */
async function packagesOf(
  files: readonly string[],
  read: (path: string) => Promise<string>,
): Promise<string[]> {
  const found = new Set<string>()
  for (const path of files)
    for (const { value } of scanSpecifiers(await read(path)))
      if (!/^[.#/]/.test(value) && value !== 'virtual:automata/content') found.add(value)
  return [...found].sort()
}

describe('the runtime the app carries', () => {
  it('serves every package Emberwick imports', async () => {
    const store = await gameFromDisk(emberwick)
    const sources = (await store.list('src/'))
      .map((entry) => entry.path)
      .filter((path) => path.endsWith('.ts'))
    const files = ['main.ts', ...sources]
    const text = new TextDecoder()
    const used = await packagesOf(files, async (path) => text.decode(await store.read(path)))
    expect(used.filter((specifier) => !RUNTIME_SPECIFIERS.includes(specifier))).toEqual([])
  })

  it('serves every package the 2D starter imports', async () => {
    const store = await newGame()
    const sources = (await store.list('src/'))
      .map((entry) => entry.path)
      .filter((path) => path.endsWith('.ts'))
    const text = new TextDecoder()
    const used = await packagesOf(sources, async (path) => text.decode(await store.read(path)))
    expect(used.filter((specifier) => !RUNTIME_SPECIFIERS.includes(specifier))).toEqual([])
  })

  it('has no three: the phone does not run it', () => {
    expect(
      RUNTIME_SPECIFIERS.filter((specifier) => specifier === 'three' || specifier.startsWith('three/')),
    ).toEqual([])
  })

  it('lists each specifier once, sorted', () => {
    expect(RUNTIME_SPECIFIERS).toEqual([...new Set(RUNTIME_SPECIFIERS)].sort())
    expect(readFileSync(join(emberwick, 'package.json'), 'utf8')).toContain('@mcthaydt/automata')
  })
})
