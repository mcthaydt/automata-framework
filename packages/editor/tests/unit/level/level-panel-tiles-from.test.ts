// @vitest-environment jsdom
import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import LevelPanel from '#src/features/level/LevelPanel.svelte'
import { createLevelSession } from '#src/features/level/level-session.ts'
import { createHistory } from '#src/shared/kit/history/history.ts'
import { addTileset } from '#src/shared/level-2d/model/commands/tileset-edits.ts'
import { counterIds } from '#src/shared/level-2d/model/ids.ts'
import type { Project } from '#src/shared/level-2d/model/project-types.ts'
import { platformerTemplate } from '#src/shared/level-2d/profiles/level-project/templates/platformer.ts'

// A game that has added a picture of tiles has two tilesets, and a tile layer paints with one of them. The panel says
// which, and choosing another is one step Undo takes back.

const KIT = {
  id: 'kit',
  label: 'Kit',
  imageSize: { w: 64, h: 32 },
  tile: { w: 16, h: 16 },
  spacing: 0,
  padding: 0,
  tags: [],
}

function open(project: Project) {
  const history = createHistory<unknown>(project)
  const ids = counterIds()
  const session = createLevelSession({ history, ids })
  if (session === undefined) throw new Error('no level')
  session.editor.setLayer('decor')
  render(LevelPanel, { session, history, read: async () => undefined })
  return history
}

const decorTileset = (history: { state: unknown }): string | undefined => {
  const def = (history.state as Project).defs.layers.find((layer) => layer.id === 'decor')
  return def !== undefined && 'tileset' in def ? def.tileset : undefined
}

describe('the Level panel’s Tiles from', () => {
  it('is not shown while the game has one tileset', () => {
    open(platformerTemplate.create(counterIds()))
    expect(screen.queryByRole('button', { name: /^Tiles from/ })).not.toBeInTheDocument()
  })

  it('points the layer at the tileset the person picks, and Undo takes it back', async () => {
    const history = open(addTileset(platformerTemplate.create(counterIds()), KIT))
    await userEvent.click(screen.getByRole('button', { name: /^Tiles from/ }))
    await userEvent.click(await screen.findByRole('option', { name: 'Kit' }))
    expect(decorTileset(history)).toBe('kit')
    expect(history.undoLabel).toBe('Use kit for Decor')
    history.undo()
    expect(decorTileset(history)).toBe('terrain')
  })
})
