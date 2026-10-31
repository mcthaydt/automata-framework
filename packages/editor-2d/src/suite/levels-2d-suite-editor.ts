import { defineSuiteEditor, type SuiteEditor } from '@mcthaydt/automata-editor-kit/ports'
import { canvas, dock, inspector, panel, status } from './Levels2dRegions.svelte'
import { type Levels2dOptions, type Levels2dSession, levels2dUndo, openLevels2d } from './levels-2d-session'

// The 2D level editor as a suite editor (plan EDS.2d; editor suite spec §4.1, §4.7): `levels-2d` in the editor list,
// opened once per row group and kept for the app's life (EDS-D12). The host passes where instance ids come from (and,
// in the DOM tests, a stand-in canvas), so this is a factory rather than a constant.

export function createLevels2d(options: Levels2dOptions): SuiteEditor<Levels2dSession> {
  return defineSuiteEditor<Levels2dSession>({
    id: 'levels-2d',
    label: 'Levels 2D',
    icon: 'grid',
    hue: 'color/ed/levels',
    open: (files, ports) => openLevels2d(files, ports, options),
    regions: { panel, canvas, inspector, dock, status },
    undo: levels2dUndo,
  })
}
