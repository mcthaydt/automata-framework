// New level (ED3D.13b; ED3D spec §4.6, ED3-q): a level's name becomes a folder and the one `af-sector/1` file in it, named
// like the folder, which Home then opens like any other level. A folder the workspace already has is never overwritten:
// the next free `name-2`, `name-3` is used.
import { type ProjectStore, storePathProblem } from '@automata/editor/kit/core'
import { newAfSectorLevel } from '../../../shared/level-session/af-sector/af-template'
import { freeRoot } from '../document/import-files'

export type CreateOutcome =
  | { readonly status: 'created'; readonly path: string }
  | { readonly status: 'refused'; readonly message: string }

/** A file-name word for a level's name: lowercase letters and digits, a hyphen between runs of anything else. */
const slugOf = (name: string): string =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

export async function createLevel(store: ProjectStore, name: string): Promise<CreateOutcome> {
  const level = newAfSectorLevel(name)
  if (!level.ok) return { status: 'refused', message: `Give the level a name: ${level.reason}.` }
  const slug = slugOf(name)
  if (slug === '')
    return { status: 'refused', message: 'The name needs a letter or a digit a file name can keep.' }
  // `freeRoot` counts `name 2`; a level's folder is a slug, so it counts `name-2`.
  let root = slug
  for (let n = 2; (await freeRoot(store, root)) !== root; n += 1) root = `${slug}-${n}`
  const path = `${root}/${root}.json`
  const problem = storePathProblem(path)
  if (problem !== undefined) return { status: 'refused', message: problem }
  await store.write(path, new TextEncoder().encode(level.text))
  return { status: 'created', path }
}
