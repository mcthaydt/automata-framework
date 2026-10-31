import type { Component } from 'svelte'
import ChecksView from '../checks/ChecksView.svelte'
import LevelView from '../level/LevelView.svelte'
import PendingView from './PendingView.svelte'
import type { ViewProps } from './view-props'

// The Svelte component for each `ViewDef.component` name a profile may list (plan ED2D.4c4a decision 1). A name that
// has no view yet gets the pending one, so a profile can list a destination before it is built.

const built: Readonly<Record<string, Component<ViewProps>>> = { ChecksView, LevelView }

export function componentOf(name: string): Component<ViewProps> {
  return Object.hasOwn(built, name) ? (built[name] as Component<ViewProps>) : PendingView
}
