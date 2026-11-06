import type { ProjectStore } from '../../shared/kit/storage/project-store.ts'
import type { Profile } from '../../shared/level-2d/profiles/profile'

// What the Export view shows and allows (plan ED2D.7b; 2D editor spec §8 flow 9, ED2D-D12). Pure: the profile's targets
// with their files and sizes, the files of the chosen targets, and what each action may do. Errors never stop a
// download, a share or a copy; only writing into a game folder waits until Checks has no errors.

export interface ExportFileView {
  readonly path: string
  readonly contents: string
  /** UTF-8 bytes, what the file will weigh on disk. */
  readonly bytes: number
}

export interface ExportTargetView {
  readonly id: string
  readonly label: string
  readonly files: readonly ExportFileView[]
  readonly bytes: number
}

export interface ExportState {
  readonly files: readonly ExportFileView[]
  readonly bytes: number
  /** Some file is chosen. */
  readonly download: boolean
  /** The one chosen file, for Share and Copy, which take a single file. */
  readonly single: ExportFileView | undefined
  readonly write: { readonly ok: true } | { readonly ok: false; readonly why: string }
}

/** Where the document lives: a folder store is the only one Write to folder writes into. */
export interface ExportStore {
  readonly kind: ProjectStore['kind']
  readonly persistent: boolean
}

const encoder = new TextEncoder()
const sum = (files: readonly ExportFileView[]): number => files.reduce((total, file) => total + file.bytes, 0)

export function exportTargets(
  profile: Profile<unknown>,
  value: unknown,
  base: string,
): readonly ExportTargetView[] {
  return profile.exports.map((target) => {
    const files = target
      .files(value, base)
      .map((file) => ({ ...file, bytes: encoder.encode(file.contents).length }))
    return { id: target.id, label: target.label, files, bytes: sum(files) }
  })
}

export function sizeLabel(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function exportState(
  targets: readonly ExportTargetView[],
  chosen: ReadonlySet<string>,
  errors: number,
  store: ExportStore,
): ExportState {
  const files = targets.filter((target) => chosen.has(target.id)).flatMap((target) => target.files)
  const write =
    store.kind !== 'folder'
      ? { ok: false as const, why: 'Open a game folder to write into it.' }
      : errors > 0
        ? {
            ok: false as const,
            why: `Fix the ${errors} ${errors === 1 ? 'error' : 'errors'} in Checks first.`,
          }
        : { ok: true as const }
  return {
    files,
    bytes: sum(files),
    download: files.length > 0,
    single: files.length === 1 ? files[0] : undefined,
    write,
  }
}
