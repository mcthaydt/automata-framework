import { validRange } from 'semver'
import { z } from 'zod'
import { ID_REGEX } from '../../shared/create-game/create-game.ts'

// `kit.json`, one in each kit folder of the Automata Plus repository. A kit is untrusted input:
// every path is checked here, before `automata add` reads or writes any file it names.

export interface KitFile {
  /** Relative to the kit's folder in the repository. */
  readonly from: string
  /** Relative to the game folder. */
  readonly to: string
}

export interface KitManifest {
  readonly name: string
  /** The core versions the kit works with: a semver range over the installed `@mcthaydt/automata` version. */
  readonly requires: { readonly core: string }
  readonly files: readonly KitFile[]
}

const PATH_PROBLEM = 'must be a relative path inside the folder, with / between names and no . or .. parts'

/**
 * A plain relative path: names separated by single `/`, none empty, `.` or `..`, no `\` and no drive letter, so
 * joining it to a folder can never leave that folder.
 */
function isPlainRelativePath(path: string): boolean {
  if (path.includes('\\') || /^[A-Za-z]:/.test(path)) return false
  return path.split('/').every((name) => name !== '' && name !== '.' && name !== '..')
}

/**
 * Folders a kit may not write into: git runs hooks from `.git`, and `automata check` runs tools from
 * `node_modules/.bin`, so a file there would run outside the game's own code. Compared without case, as macOS
 * and Windows file systems do. This is not a sandbox: the check after an add runs the kit's tests anyway.
 */
const PROTECTED_FOLDERS = new Set(['.git', 'node_modules'])

const writesIntoProtectedFolder = (path: string): boolean =>
  path.split('/').some((name) => PROTECTED_FOLDERS.has(name.toLowerCase()))

const kitPath = z.string().refine(isPlainRelativePath, PATH_PROBLEM)

const kitFile = z.object({
  from: kitPath,
  to: kitPath.refine((to) => !writesIntoProtectedFolder(to), 'may not write into .git or node_modules'),
})

/** Checks a `kit.json`. Unknown fields are dropped, so a newer kit format still reads. */
export const kitManifestSchema: z.ZodType<KitManifest> = z.object({
  name: z.string().regex(ID_REGEX, 'must be lowercase letters, digits and single hyphens'),
  requires: z.object({
    core: z.string().refine((range) => validRange(range) !== null, 'must be a semver range, such as >=0.0.2'),
  }),
  files: z
    .array(kitFile)
    .min(1, 'a kit copies at least one file')
    .superRefine((files, context) => {
      // Two files with one destination would make the copy depend on order; case-insensitive file systems
      // treat `a.ts` and `A.ts` as one file.
      const firstIndex = new Map<string, number>()
      files.forEach((file, index) => {
        const key = file.to.toLowerCase()
        const first = firstIndex.get(key)
        if (first === undefined) firstIndex.set(key, index)
        else
          context.addIssue({
            code: 'custom',
            path: [index, 'to'],
            message: `${file.to} is also the destination of files.${first}`,
          })
      })
      // A destination that is a folder of another (`src/a` and `src/a/b.ts`) cannot be both a file and a folder,
      // so the copy would fail half way.
      const folderOf = new Map<string, { readonly index: number; readonly to: string }>()
      files.forEach((file, index) => {
        const names = file.to.toLowerCase().split('/')
        for (let end = 1; end < names.length; end++) {
          const folder = names.slice(0, end).join('/')
          if (!folderOf.has(folder)) folderOf.set(folder, { index, to: file.to })
        }
      })
      files.forEach((file, index) => {
        const other = folderOf.get(file.to.toLowerCase())
        if (other !== undefined)
          context.addIssue({
            code: 'custom',
            path: [index, 'to'],
            message: `${file.to} is also a folder of the destination of files.${other.index}, ${other.to}`,
          })
      })
    }),
})
