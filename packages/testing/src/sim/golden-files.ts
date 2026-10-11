// Reading and writing golden files (M2.3 spec §2 and §3.8). Node reads and writes with node:fs; a browser can
// only read, through the `readGolden` command that goldenCommands() registers. There is no browser write path,
// so a browser can never rebaseline a golden (AGENTS.md: never rebaseline per engine).
import { expect } from 'vitest'

/** True in Node; false in a Vitest browser page. */
export const inNode = (): boolean => typeof window === 'undefined'

/** Goldens are (re)recorded only in Node, and only with AUTOMATA_UPDATE_GOLDENS=1. */
export function updatingGoldens(): boolean {
  return inNode() && globalThis.process?.env?.AUTOMATA_UPDATE_GOLDENS === '1'
}

export const MISSING_COMMAND: string =
  'golden files are read in browsers through the readGolden command: add `commands: goldenCommands()` ' +
  "(from '@mcthaydt/automata-testing/sim') to this project's browser options in vitest.config.ts"

/**
 * An absolute golden path. A relative one is taken from the running test file's folder, the same in Node and in
 * a browser (Vitest reports the test file's path in both).
 */
export function resolveGoldenPath(path: string): string {
  if (path.startsWith('/') || /^[A-Za-z]:[\\/]/.test(path)) return path
  const testPath = expect.getState().testPath
  if (!testPath)
    throw new Error(`cannot resolve the golden path "${path}" outside a test; pass an absolute path`)
  const parts = testPath.replace(/\\/g, '/').split('/')
  parts.pop() // the test file's name
  for (const part of path.replace(/\\/g, '/').split('/')) {
    if (part === '..') parts.pop()
    else if (part !== '.' && part !== '') parts.push(part)
  }
  return parts.join('/')
}

const fromBase64 = (text: string): Uint8Array => Uint8Array.from(atob(text), (c) => c.charCodeAt(0))

/** The file's bytes, or undefined when it does not exist. */
export async function readGoldenFile(path: string): Promise<Uint8Array | undefined> {
  if (inNode()) {
    const fs = await import('node:fs/promises')
    try {
      return new Uint8Array(await fs.readFile(path))
    } catch (err) {
      if ((err as { code?: string }).code === 'ENOENT') return undefined
      throw err
    }
  }
  const { commands } = await import('vitest/browser')
  const readGolden = (commands as unknown as { readGolden?: (p: string) => Promise<string | null> })
    .readGolden
  if (typeof readGolden !== 'function') throw new Error(MISSING_COMMAND)
  const text = await readGolden(path)
  return text === null ? undefined : fromBase64(text)
}

/** The file system calls a write makes; tests replace them to interrupt a write. */
export interface GoldenWriteFs {
  writeFile(path: string, bytes: Uint8Array): Promise<void>
  rename(from: string, to: string): Promise<void>
  rm(path: string): Promise<void>
}

async function nodeWriteFs(): Promise<GoldenWriteFs> {
  const fs = await import('node:fs/promises')
  return {
    writeFile: (path, bytes) => fs.writeFile(path, bytes),
    rename: (from, to) => fs.rename(from, to),
    rm: (path) => fs.rm(path, { force: true }),
  }
}

/**
 * Writes atomically: a temp file in the same folder, then a rename over the golden, so an interrupted update
 * leaves the old golden whole. Node only.
 */
export async function writeGoldenFile(path: string, bytes: Uint8Array, fs?: GoldenWriteFs): Promise<void> {
  if (!inNode()) throw new Error('goldens are written only in Node, with AUTOMATA_UPDATE_GOLDENS=1')
  const ops = fs ?? (await nodeWriteFs())
  const { mkdir } = await import('node:fs/promises')
  const { dirname } = await import('node:path')
  await mkdir(dirname(path), { recursive: true })
  const temp = `${path}.${globalThis.process.pid}-${Math.random().toString(36).slice(2)}.tmp`
  try {
    await ops.writeFile(temp, bytes)
    await ops.rename(temp, path)
  } catch (err) {
    await ops.rm(temp)
    throw err
  }
}

/** The file's name, for reports. */
export const fileName = (path: string): string => path.replace(/\\/g, '/').split('/').pop() ?? path
