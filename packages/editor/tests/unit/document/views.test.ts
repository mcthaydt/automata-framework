// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { componentOf } from '#src/app/editor-2d/views.ts'
import EntitiesView from '#src/features/characters/EntitiesView.svelte'
import PendingView from '#src/features/document/PendingView.svelte'
import LevelView from '#src/features/level/LevelView.svelte'
import WorldView from '#src/features/map/WorldView.svelte'
import ChecksView from '#src/features/problems/ChecksView.svelte'
import TilesetsView from '#src/features/tiles/TilesetsView.svelte'

describe('the view components', () => {
  it('maps the Level view by its component name', () => {
    expect(componentOf('LevelView')).toBe(LevelView)
    expect(componentOf('ChecksView')).toBe(ChecksView)
  })

  it('maps the Tilesets view by its component name', () => {
    expect(componentOf('TilesetsView')).toBe(TilesetsView)
  })

  it('maps the Entities view by its component name', () => {
    expect(componentOf('EntitiesView')).toBe(EntitiesView)
  })

  it('maps the World view by its component name', () => {
    expect(componentOf('WorldView')).toBe(WorldView)
  })

  it('maps a view not built yet to the pending view', () => {
    expect(componentOf('ComposeView')).toBe(PendingView)
    expect(componentOf('')).toBe(PendingView)
  })
})
