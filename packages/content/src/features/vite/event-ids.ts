// The events a game can say, for Feel and Audio's "What happens in the game?". The sim's event files (found by their
// role suffix, `.event.ts`) name each event with `defineEvent('<id>'`; reading them as text means the editors need no
// build of the game's code. An id that is not written out as a string (a variable, a template) is skipped: the editors
// keep a box for an event this cannot see.

import type { Dirent } from 'node:fs'
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const EVENT_FILE = /\.event\.ts$/
const DEFINE_EVENT = /\bdefineEvent\(\s*(?:'([^'\\\n]+)'|"([^"\\\n]+)")/g

/** The ids written out in `sources`, sorted and once each; only files ending `.event.ts` are read. */
export function eventIds(sources: readonly { readonly path: string; readonly text: string }[]): string[] {
  const ids = new Set<string>()
  for (const { path, text } of sources) {
    if (!EVENT_FILE.test(path)) continue
    for (const match of text.matchAll(DEFINE_EVENT)) {
      const id = match[1] ?? match[2]
      if (id !== undefined) ids.add(id)
    }
  }
  return [...ids].sort()
}

/** Every `.event.ts` file under the game's `src/`, `node_modules` left out. A game with no `src/` has none. */
async function readEventFiles(root: string): Promise<{ path: string; text: string }[]> {
  const found: { path: string; text: string }[] = []
  const walk = async (dir: string): Promise<void> => {
    let entries: Dirent[]
    try {
      entries = await readdir(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      const path = join(dir, entry.name)
      if (entry.isDirectory()) {
        if (entry.name !== 'node_modules') await walk(path)
      } else if (EVENT_FILE.test(entry.name)) found.push({ path, text: await readFile(path, 'utf8') })
    }
  }
  await walk(join(root, 'src'))
  return found
}

/** Writes `<outDir>/events.json`, a JSON array of the game's event ids, when it differs from what is there. */
export async function writeEventIds(root: string, outDir: string): Promise<void> {
  const text = `${JSON.stringify(eventIds(await readEventFiles(root)), null, 2)}\n`
  const path = join(root, outDir, 'events.json')
  try {
    if ((await readFile(path, 'utf8')) === text) return
  } catch {
    // Not there yet: written below.
  }
  await mkdir(join(root, outDir), { recursive: true })
  await writeFile(path, text)
}

/** Whether a changed path is a file `writeEventIds` reads. */
export const isEventFile = (path: string): boolean => EVENT_FILE.test(path) && !path.includes('node_modules')
