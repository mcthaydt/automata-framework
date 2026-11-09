// The game's furniture, materials and characters, read for the level that names them (Levels 3D spec §7). Furniture is
// `world-props/*.toml`, materials `world-swatches/*.toml` and characters `figures/*.toml`, in the content folder that
// holds the level's `levels/` folder. They are read through the suite workspace (a listing of a folder, then `read`) and
// checked with core's own content schemas; this editor never writes them. A game with none of these gives the empty
// library, which asks nothing of the level: the room then offers only the names its own file holds.
import {
  type WorldLibrary,
  type WorldProp,
  type WorldSwatch,
  worldPropContent,
  worldSwatchContent,
} from '@automata/3d/world-content'
import type { SuiteWorkspace } from '@automata/editor/kit/ports'
import { fileTitle } from '@automata/editor/suite'
import { parse as parseToml } from 'smol-toml'

export interface GameLibrary {
  /** Whether the game has any of the three folders: only then can a name be called missing. */
  readonly found: boolean
  readonly swatches: ReadonlyMap<string, WorldSwatch>
  readonly props: ReadonlyMap<string, WorldProp>
  /** The characters' names, one per `figures/*.toml`. */
  readonly figures: readonly string[]
  /** A sentence for each record that did not parse and so was left out. */
  readonly problems: readonly string[]
}

export const EMPTY_LIBRARY: GameLibrary = {
  found: false,
  swatches: new Map(),
  props: new Map(),
  figures: [],
  problems: [],
}

/** Core's shape of the library, for its rules (`resolveProp`, `hasSwatch`): the editor and the game ask the same ones. */
export const worldLibrary = (library: GameLibrary): WorldLibrary => ({
  swatches: Object.fromEntries(library.swatches),
  props: Object.fromEntries(library.props),
})

/** The folder that holds the level's `levels/` folder (`''` for the game's root), or nothing for a level not in one. */
function contentRootOf(levelPath: string): string | undefined {
  const steps = levelPath.split('/')
  const at = steps.lastIndexOf('levels', -2)
  return at < 0 ? undefined : steps.slice(0, at).join('/')
}

/** The name a record has: its file's name, when the file sits directly in the folder and is TOML. */
const nameOf = (folder: string, path: string): string | undefined => {
  const rest = path.slice(folder.length + 1)
  return rest.endsWith('.toml') && !rest.includes('/') ? rest.slice(0, -'.toml'.length) : undefined
}

async function readRecords(
  workspace: SuiteWorkspace,
  folder: string,
): Promise<readonly { readonly name: string; readonly text: string | undefined }[]> {
  const paths = (await workspace.list?.(folder)) ?? []
  return Promise.all(
    paths.flatMap((path) => {
      const name = nameOf(folder, path)
      return name === undefined
        ? []
        : [
            workspace
              .read(path)
              .catch(() => undefined)
              .then((read) => ({ name, text: read?.text })),
          ]
    }),
  )
}

/** The records of a folder that parse with `schema`, by name; the rest named in `problems`. */
async function readKind<T>(
  workspace: SuiteWorkspace,
  folder: string,
  schema: { safeParse(value: unknown): { success: boolean; data?: unknown } },
  noun: string,
  what: string,
  problems: string[],
): Promise<Map<string, T>> {
  const out = new Map<string, T>()
  for (const { name, text } of await readRecords(workspace, folder)) {
    let parsed: { success: boolean; data?: unknown } = { success: false }
    try {
      if (text !== undefined) parsed = schema.safeParse(parseToml(text))
    } catch {
      // A file that is not TOML is a record that does not parse.
    }
    if (parsed.success) out.set(name, parsed.data as T)
    else
      problems.push(
        `The ${noun} "${fileTitle(name)}" in the game isn't written the way ${what} is, so it was left out.`,
      )
  }
  return out
}

export async function readGameLibrary(levelPath: string, workspace: SuiteWorkspace): Promise<GameLibrary> {
  const root = contentRootOf(levelPath)
  if (root === undefined || workspace.list === undefined) return EMPTY_LIBRARY
  const at = (folder: string): string => (root === '' ? folder : `${root}/${folder}`)
  const problems: string[] = []
  const [swatches, props, figures] = await Promise.all([
    readKind<WorldSwatch>(
      workspace,
      at('world-swatches'),
      worldSwatchContent.schema,
      'material',
      'a material',
      problems,
    ),
    readKind<WorldProp>(
      workspace,
      at('world-props'),
      worldPropContent.schema,
      'furniture',
      'furniture',
      problems,
    ),
    readRecords(workspace, at('figures')),
  ])
  const found = swatches.size + props.size + figures.length + problems.length > 0
  if (!found) return EMPTY_LIBRARY
  return { found, swatches, props, figures: figures.map((figure) => figure.name), problems }
}
