import type { Component } from 'svelte'
import EntitiesView from '../../features/characters/EntitiesView.svelte'
import PendingView from '../../features/document/PendingView.svelte'
import LevelView from '../../features/level/LevelView.svelte'
import type { ViewProps } from '../../shared/level-2d/documents/view-props'

// The Svelte component for each `ViewDef.component` name a profile may list. A name that
// has no view yet gets the pending one, so a profile can list a destination before it is built.

const built: Readonly<Record<string, Component<ViewProps>>> = {
  EntitiesView,
  LevelView,
}

export function componentOf(name: string): Component<ViewProps> {
  return Object.hasOwn(built, name) ? (built[name] as Component<ViewProps>) : PendingView
}
