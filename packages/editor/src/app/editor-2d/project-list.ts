import { classifyStorageError } from '../../shared/kit/storage/project-store.ts'
import { baseName } from '../../shared/kit/storage/store-path.ts'
import type { Workspace } from '../../shared/kit/storage/workspace.ts'
import { levelImages } from '../../shared/level-2d/canvas/draw/level-images'
import type { LevelPreview, ProfileRegistry, ProfileSummary } from '../../shared/level-2d/profiles/profile'
import { readDocument } from '../../shared/level-2d/profiles/read-document'
import type {
  CardPreview,
  Listed,
  ProfileRef,
  ProjectEntry,
} from '../../shared/level-2d/session/editor-app-types'

// The projects Home shows: one entry for each file in the workspace that a profile claims, and
// nothing for images, journals or anything else. Reading a whole workspace on each refresh is fine at the size a tablet
// session has; if it ever is not, this is the one place to add a cache.

const ref = (profile: ProfileRef): ProfileRef => ({ id: profile.id, label: profile.label })

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
