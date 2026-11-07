import type { Project } from '../../../model/project-types'
import type { TemplateDef } from '../../profile'
import { placeholderTileset } from './placeholder-tileset'
import { starterProject } from './starter'

// The smallest start: one tiles layer, one entities layer, one placeholder tileset and no entity
// definitions. Everything else, a puzzle's pieces or a shooter's waves, is defined in the editor (acceptance G-t).

export const blankTemplate: TemplateDef<Project> = {
  id: 'blank',
  label: 'Blank',
  hint: 'start from nothing',
  create: () =>
    starterProject(
      'Untitled project',
      'blank',
      {
        layers: [
          { id: 'entities', label: 'Characters', kind: 'entities', grid: 16, snap: true },
          { id: 'tiles', label: 'Tiles', kind: 'tiles', grid: 16, tileset: 'tiles', opacity: 1 },
        ],
        tilesets: [
          placeholderTileset({ id: 'tiles', label: 'Tiles', columns: 8, rows: 8, tile: 16, tags: [] }),
        ],
        entities: [],
        levelFields: [],
      },
      {
        id: 'level-1',
        name: 'Level 1',
        size: { w: 256, h: 256 },
        background: { color: '#1e293b', mode: 'fit' },
      },
    ),
}
