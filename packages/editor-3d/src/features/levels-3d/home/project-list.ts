// The projects Home shows (ED3D spec §8; kit spec §4.7): one entry for each level a profile opens, newest first, and
// nothing for textures, notes or JSON no profile claims. Only `.json` files are
// read, so a workspace imported from a game checkout does not decode every image on each refresh.
import type { ProjectStore } from '@automata/editor/kit/core'
import type { ParseIssue } from '../../../shared/level-session/file-codec'
import { problemCount } from '../checks/problem-count'
import { readLevel } from '../document/read-level'

interface Listed {
  readonly path: string
  readonly size: number
  readonly mtime: number
}

export type ProjectEntry =
  | (Listed & {
      readonly status: 'ok'
      readonly profile: string
      /** Problems the profile's checks found, by severity, run without the game's lists. */
      readonly errors: number
      readonly warnings: number
    })
  /** A profile claims the file and refuses it: Home shows why and offers the text view. */
  | (Listed & {
      readonly status: 'broken'
      readonly profile: string
      readonly message: string
    })

/** The first issue as one line: its JSON path (dotted) and its message. */
const firstIssue = (issues: readonly ParseIssue[]): string => {
  const issue = issues[0]
  if (issue === undefined) return 'The file does not open.'
  return issue.path.length === 0 ? issue.message : `${issue.path.join('.')}: ${issue.message}`
}

/** One entry for a file, or nothing when it is no project. */
function entryOf(listed: Listed, bytes: Uint8Array): ProjectEntry | undefined {
  const read = readLevel(bytes)
  if (read.status === 'invalid')
    return {
      ...listed,
      status: 'broken',
      profile: read.profile.id,
      message: firstIssue(read.issues),
    }
  if (read.status !== 'parsed') return undefined
  const results = read.profile.checks(read.value)
  return {
    ...listed,
    status: 'ok',
    profile: read.profile.id,
    errors: problemCount(results, 'error'),
    warnings: problemCount(results, 'warning'),
  }
}

/**
 * Rejects when the workspace cannot be listed (the kit's `StorageError`): without a listing there is no Home. A file
 * that cannot be read, or that went between the listing and the read, is left out: the next refresh tries again.
 */
export async function listProjects(store: ProjectStore): Promise<readonly ProjectEntry[]> {
  const entries: ProjectEntry[] = []
  for (const file of await store.list()) {
    if (!file.path.endsWith('.json')) continue
    let bytes: Uint8Array | undefined
    try {
      bytes = await store.read(file.path)
    } catch {
      continue
    }
    if (bytes === undefined) continue
    const entry = entryOf({ path: file.path, size: file.size, mtime: file.mtime }, bytes)
    if (entry !== undefined) entries.push(entry)
  }
  return entries.sort((a, b) => b.mtime - a.mtime || (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))
}
