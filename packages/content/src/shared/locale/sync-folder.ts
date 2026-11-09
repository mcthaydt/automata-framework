// Makes one folder match another by writing only what differs.
//
// Paraglide empties its `outdir` before it writes, so a dev server that watches the folder sees every message module
// vanish and come back on each compile, and a page that loads one in between fails ("Could not load
// src/paraglide/messages/title.js"). The compile goes to a temporary folder instead, and this brings the real one up
// to date: a file the compile did not change is not touched, a file it no longer makes is removed, and the folder is
// never empty on the way.

import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

/** What a sync did: how many files it wrote (new or changed) and how many it removed. */
export interface SyncResult {
  readonly written: number
  readonly removed: number
}

/** Every file under `folder`, as paths relative to it with `/`; none when the folder does not exist. */
async function filesUnder(folder: string, prefix = ''): Promise<string[]> {
  const entries = await readdir(join(folder, prefix), { withFileTypes: true }).catch(
    (error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') return []
      throw error
    },
  )
  const found: string[] = []
  for (const entry of entries) {
    const path = prefix === '' ? entry.name : `${prefix}/${entry.name}`
    if (entry.isDirectory()) found.push(...(await filesUnder(folder, path)))
    else found.push(path)
  }
  return found
}

async function readIfPresent(path: string): Promise<Buffer | undefined> {
  return readFile(path).catch((error: NodeJS.ErrnoException) => {
    if (error.code === 'ENOENT') return undefined
    throw error
  })
}

/** Folders under `folder` with nothing in them, deepest first, so removing each can empty its parent. */
async function emptyFolders(folder: string, prefix = ''): Promise<string[]> {
  const entries = await readdir(join(folder, prefix), { withFileTypes: true })
  const empty: string[] = []
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const path = prefix === '' ? entry.name : `${prefix}/${entry.name}`
    empty.push(...(await emptyFolders(folder, path)))
    if ((await readdir(join(folder, path))).length === 0) empty.push(path)
  }
  return empty
}

/** Brings `to` to what `from` holds, writing only the files that differ; `to` is made if it is not there. */
export async function syncFolder(from: string, to: string): Promise<SyncResult> {
  const wanted = await filesUnder(from)
  let written = 0
  for (const file of wanted) {
    const next = await readFile(join(from, file))
    const current = await readIfPresent(join(to, file))
    if (current !== undefined && current.equals(next)) continue
    await mkdir(dirname(join(to, file)), { recursive: true })
    await writeFile(join(to, file), next)
    written += 1
  }
  await mkdir(to, { recursive: true })
  const keep = new Set(wanted)
  let removed = 0
  for (const file of await filesUnder(to)) {
    if (keep.has(file)) continue
    await rm(join(to, file))
    removed += 1
  }
  for (const folder of await emptyFolders(to)) await rm(join(to, folder), { recursive: true, force: true })
  return { written, removed }
}
