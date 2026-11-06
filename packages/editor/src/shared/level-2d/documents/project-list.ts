import { classifyStorageError } from '../../kit/storage/project-store.ts'
import type { Workspace } from '../../kit/storage/workspace.ts'
import { levelImages } from '../canvas/draw/level-images'
import type { LevelPreview, ProfileRegistry, ProfileSummary } from '../profiles/profile'
import { readDocument } from './read-document'

// The projects Home shows: one entry for each file in the workspace that a profile claims, and
// nothing for images, journals or anything else. Reading a whole workspace on each refresh is fine at the size a tablet
// session has; if it ever is not, this is the one place to add a cache.

interface Listed {
  readonly path: string
  readonly size: number
  readonly mtime: number
}

/** A card's preview level, stamped with what its thumbnail is drawn from besides the file itself. */
export type CardPreview = LevelPreview & {
  /**
   * The level's image paths with their modification times (`assets/terrain.png@1700000000000`, or `@missing`), so a
   * replaced or newly imported image gives the card a new thumbnail key.
   */
  readonly images: string
}

export interface ProfileRef {
  readonly id: string
  readonly label: string
}

export type ProjectEntry =
  | (Listed & {
      readonly status: 'ok'
      readonly profile: ProfileRef
      /** Findings of the profile's checks, by severity; info is not counted. */
      readonly errors: number
      readonly warnings: number
      /** The profile's words for what the project holds; `undefined` when the profile gives none. */
      readonly summary: ProfileSummary | undefined
      /** The level the card draws as a thumbnail; `undefined` when the profile has none to show. */
      readonly preview: CardPreview | undefined
    })
  /** A profile claims the file and it does not open: Home shows the reason and offers the text view. */
  | (Listed & { readonly status: 'broken'; readonly profile: ProfileRef; readonly message: string })
  | (Listed & { readonly status: 'ambiguous'; readonly candidates: readonly ProfileRef[] })

const ref = (profile: ProfileRef): ProfileRef => ({ id: profile.id, label: profile.label })
const baseName = (path: string): string => path.slice(path.lastIndexOf('/') + 1)

/** Rejects when the workspace cannot be listed (a `StorageError`); a file that cannot be read becomes a broken entry. */
export async function listProjects(
  workspace: Workspace,
  registry: ProfileRegistry,
): Promise<readonly ProjectEntry[]> {
  const files = await workspace.store.list()
  const assets = files.map((file) => file.path)
  const modified = new Map(files.map((file) => [file.path, file.mtime]))
  /** A preview naming a level its project lacks has nothing to draw, so it is dropped here. */
  const stamped = (preview: LevelPreview | undefined): CardPreview | undefined => {
    if (preview === undefined || !preview.project.levels.some((level) => level.id === preview.level))
      return undefined
    const images = levelImages(preview.project, preview.level)
      .map((path) => `${path}@${modified.get(path) ?? 'missing'}`)
      .join(' ')
    return { ...preview, images }
  }
  const entries: ProjectEntry[] = []
  for (const file of files) {
    const listed: Listed = { path: file.path, size: file.size, mtime: file.mtime }
    const name = baseName(file.path)
    /** A file that could not be read or decoded is still a project when its name says which profile it is for. */
    const broken = (message: string): void => {
      const [only, other] = registry.sniff(name, '')
      if (only !== undefined && other === undefined)
        entries.push({ ...listed, status: 'broken', profile: ref(only), message })
    }
    let bytes: Uint8Array | undefined
    try {
      bytes = await workspace.store.read(file.path)
    } catch (error) {
      broken(classifyStorageError(error).message)
      continue
    }
    if (bytes === undefined) continue
    const read = readDocument(registry, name, bytes)
    switch (read.status) {
      case 'parsed': {
        const findings = read.profile.check(read.value, { assets })
        entries.push({
          ...listed,
          status: 'ok',
          profile: ref(read.profile),
          errors: findings.filter((finding) => finding.severity === 'error').length,
          warnings: findings.filter((finding) => finding.severity === 'warning').length,
          summary: read.profile.summary?.(read.value),
          preview: stamped(read.profile.preview?.(read.value)),
        })
        break
      }
      case 'invalid':
        entries.push({
          ...listed,
          status: 'broken',
          profile: ref(read.profile),
          message: read.errors[0]?.message ?? 'The file does not open.',
        })
        break
      case 'choose':
        entries.push({ ...listed, status: 'ambiguous', candidates: read.candidates.map(ref) })
        break
      case 'notText':
        broken('The file is not text.')
        break
      case 'tooLarge':
        broken('The file is over 16 MB.')
        break
      case 'unrecognised':
        break
    }
  }
  return entries.sort((a, b) => b.mtime - a.mtime || (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))
}
