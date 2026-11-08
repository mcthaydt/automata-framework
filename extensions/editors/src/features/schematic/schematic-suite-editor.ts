// Schematic as a suite editor: `schematic` in the editor list. It opens the scenes the list hands it (the behaviour,
// places and puzzle files that share a name) and starts the first; a game with no files has one scene to start.
import {
  defineSuiteEditor,
  type SuiteAskTarget,
  type SuiteEditor,
  type SuiteUndo,
} from '@automata/editor/kit/ports'
import { canvas, panel, status } from './SchematicRegions.svelte'
import { findFacts } from './schematic-facts.ts'
import { SchematicSession, scenesOf } from './schematic-session.svelte.ts'

export interface SchematicOptions {
  /** The address of the game's dev page, when the editors were opened in the game's folder. */
  readonly gameUrl?: string | undefined
}

/** The open scene's behaviour file is what Undo, Redo and Ask work on. */
function undoOf(session: SchematicSession): SuiteUndo {
  const history = () => session.files.systems.history
  return {
    canUndo: () => history().canUndo,
    canRedo: () => history().canRedo,
    undoLabel: () => history().undoLabel,
    redoLabel: () => history().redoLabel,
    undo: () => void session.files.systems.follow(true),
    redo: () => void session.files.systems.follow(false),
    subscribe: (listener) => session.subscribe(listener),
  }
}

function askOf(session: SchematicSession): SuiteAskTarget {
  return {
    get path() {
      return session.files.systems.path
    },
    text: () => session.files.systems.history.state.text ?? '',
    scope: () => (session.chosen.kind === 'character' ? [`agents.${session.chosen.index}`] : []),
    locked: () => [],
    accept: (text, summary) => void session.files.systems.accept(text, summary),
  }
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
    regions: { panel, canvas, status },
    undo: undoOf,
    ask: askOf,
  })
}
