// Schematic as a suite editor: `schematic` in the editor list. It opens the scenes the list hands it (the behaviour,
// places and puzzle files that share a name) and starts the first; a game with no files has one scene to start.
import {
  defineSuiteEditor,
  type SuiteEditor,
  type SuiteUndo,
  type WorkspaceFile,
} from '@automata/editor/kit/ports'
import { canvas, inspector, panel, status } from './SchematicRegions.svelte'
import { findFacts } from './schematic-facts.ts'
import { SchematicSession, scenesOf } from './schematic-session.svelte.ts'

export interface SchematicOptions {
  /** The address of the game's dev page, when the editors were opened in the game's folder. */
  readonly gameUrl?: string | undefined
}

/** Undo, Redo and the labels follow the steps the editor wrote, whichever of the scene's files each changed. */
function undoOf(session: SchematicSession): SuiteUndo {
  return {
    canUndo: () => session.undoLabel !== undefined,
    canRedo: () => session.redoLabel !== undefined,
    undoLabel: () => session.undoLabel,
    redoLabel: () => session.redoLabel,
    undo: () => void session.followStep(true),
    redo: () => void session.followStep(false),
    subscribe: (listener) => session.subscribe(listener),
  }
}

const FOLDER_RANK = ['content/systems/', 'content/nav/', 'content/puzzles/']

/**
 * One row on Home for a scene, not one for each of its files: the characters', the places' and the puzzle's files share
 * a name, and "Hall" three times says nothing a person can tell apart. The scene's characters file stands for it.
 */
export function homeFilesOf(files: readonly WorkspaceFile[]): WorkspaceFile[] {
  const rank = (file: WorkspaceFile): number => {
    const at = FOLDER_RANK.findIndex((folder) => file.path.startsWith(folder))
    return at === -1 ? FOLDER_RANK.length : at
  }
  const byScene = new Map<string, WorkspaceFile>()
  for (const file of [...files].sort((a, b) => rank(a) - rank(b))) {
    const scene = scenesOf([file.path])[0] ?? file.path
    if (!byScene.has(scene)) byScene.set(scene, file)
  }
  return [...byScene.values()]
}

export function createSchematic(options: SchematicOptions = {}): SuiteEditor<SchematicSession> {
  return defineSuiteEditor<SchematicSession>({
    id: 'schematic',
    label: 'Schematic',
    icon: 'list',
    hue: 'color/ed/schematic',
    async open(files, ports) {
      const session = new SchematicSession(
        ports,
        await findFacts(ports, options.gameUrl),
        scenesOf(files.map((file) => file.path)),
      )
      await session.select(session.scenes[0] ?? 'main')
      return session
    },
    homeFiles: homeFilesOf,
    draftView: (session) =>
      `${session.scene}|${JSON.stringify(session.chosen)}|${JSON.stringify(session.selected)}`,
    regions: { panel, canvas, inspector, status },
    undo: undoOf,
  })
}
