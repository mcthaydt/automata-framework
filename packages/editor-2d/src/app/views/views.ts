import type { Component } from 'svelte'
import ChecksView from '../checks/ChecksView.svelte'
import EntitiesView from '../entities/EntitiesView.svelte'
import LevelView from '../level/LevelView.svelte'
import { profileViews } from '../profile-views'
import TilesetsView from '../tilesets/TilesetsView.svelte'
import PendingView from './PendingView.svelte'
import type { ViewProps } from './view-props'

// The Svelte component for each `ViewDef.component` name a profile may list (plan ED2D.4c4a decision 1). A name that
// has no view yet gets the pending one, so a profile can list a destination before it is built.

const built: Readonly<Record<string, Component<ViewProps>>> = {
  ChecksView,
  EntitiesView,
  LevelView,
  TilesetsView,
}

/** The views the registered profiles bring (`app/profile-views.ts`), looked up after the editor's own. */
const fromProfiles = profileViews()

export function componentOf(name: string): Component<ViewProps> {
  if (Object.hasOwn(built, name)) return built[name] as Component<ViewProps>
  return Object.hasOwn(fromProfiles, name) ? (fromProfiles[name] as Component<ViewProps>) : PendingView
}
