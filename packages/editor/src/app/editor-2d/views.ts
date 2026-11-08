import type { Component } from 'svelte'
import EntitiesView from '../../features/characters/EntitiesView.svelte'
import PendingView from '../../features/document/PendingView.svelte'
import LevelView from '../../features/level/LevelView.svelte'
import WorldView from '../../features/map/WorldView.svelte'
import ChecksView from '../../features/problems/ChecksView.svelte'
import ExportView from '../../features/share/ExportView.svelte'
import TilesetsView from '../../features/tiles/TilesetsView.svelte'
import type { ViewProps } from '../../shared/level-2d/session/view-props'

// The Svelte component for each `ViewDef.component` name a profile may list (plan ED2D.4c4a decision 1). A name that
// has no view yet gets the pending one, so a profile can list a destination before it is built.

const built: Readonly<Record<string, Component<ViewProps>>> = {
  ChecksView,
  EntitiesView,
  ExportView,
  LevelView,
  TilesetsView,
  WorldView,
}

export function componentOf(name: string): Component<ViewProps> {
  return Object.hasOwn(built, name) ? (built[name] as Component<ViewProps>) : PendingView
}
