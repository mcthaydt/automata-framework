import { copyFileSync, existsSync, lstatSync, mkdirSync, rmdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'

// Copies a kit's files into a game as one change: either every file is in place, or the game folder is put back
// as it was. Files are copied as bytes, so images and fonts in a kit survive.

export type EntryKind = 'missing' | 'file' | 'other'

/** What is at `path`, without following a link at its last name: a link or a folder is `other`. */
export function entryKind(path: string): EntryKind {
  try {
    return lstatSync(path).isFile() ? 'file' : 'other'
  } catch (error) {
    // ENOTDIR: a parent is a file, so nothing can be there (the copy itself will fail and be undone).
    const code = (error as NodeJS.ErrnoException).code
    if (code === 'ENOENT' || code === 'ENOTDIR') return 'missing'
    throw error
  }
}

export interface Placement {
  /** Absolute path of the staged file. */
  readonly source: string
  /** Relative to the game folder; a plain relative path (`kitManifestSchema`). */
  readonly destination: string
}

export type PlaceOutcome =
  | { readonly ok: true }
  | {
      readonly ok: false
      /** The destination being copied when it failed. */
      readonly failed: string
      readonly cause: string
      /** Paths the undo could not put back; empty when the game folder is as it was. */
      readonly notRestored: readonly string[]
    }

/** One undoable step: a folder this copy made, or a file it wrote (with a copy of what was there before). */
type Step =
  | { readonly kind: 'folder'; readonly path: string }
  | { readonly kind: 'file'; readonly path: string; readonly backup: string | undefined }

const messageOf = (error: unknown): string => (error instanceof Error ? error.message : String(error))

function undo(steps: readonly Step[]): string[] {
  const notRestored: string[] = []
  for (const step of [...steps].reverse()) {
    try {
      if (step.kind === 'folder') rmdirSync(step.path)
      else if (step.backup !== undefined) copyFileSync(step.backup, step.path)
      else if (entryKind(step.path) !== 'missing') rmSync(step.path)
    } catch {
      notRestored.push(step.path)
    }
  }
  return notRestored
}

/**
 * Copies each placement into `gameDir`, in order, making the folders it needs. A file already at a destination
 * is copied to `backupDir` first and is replaced (the caller has refused collisions unless `--force`). If any
 * step fails, every earlier step is undone in reverse: written files are removed or restored from their backup,
 * and made folders are removed.
 */
export function placeFiles(
  gameDir: string,
  placements: readonly Placement[],
  backupDir: string,
): PlaceOutcome {
  const steps: Step[] = []
  let current = ''
  try {
    mkdirSync(backupDir, { recursive: true })
    placements.forEach((placement, index) => {
      current = placement.destination
      const destination = join(gameDir, placement.destination)
      let folder = gameDir
      for (const name of placement.destination.split('/').slice(0, -1)) {
        folder = join(folder, name)
        if (existsSync(folder)) continue
        mkdirSync(folder)
        steps.push({ kind: 'folder', path: folder })
      }
      let backup: string | undefined
      if (entryKind(destination) === 'file') {
        backup = join(backupDir, String(index))
        copyFileSync(destination, backup)
      }
      // Recorded before the copy, so a copy that fails half way is undone too.
      steps.push({ kind: 'file', path: destination, backup })
      copyFileSync(placement.source, destination)
    })
    return { ok: true }
  } catch (error) {
    return { ok: false, failed: current, cause: messageOf(error), notRestored: undo(steps) }
  }
}
