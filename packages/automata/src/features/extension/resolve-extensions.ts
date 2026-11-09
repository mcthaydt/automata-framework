import type { ContentSchemaDef } from '@automataframework/automata-content'
import type { PluginDef } from '@automataframework/automata-sim'
import type { UiComponent, UiSlotName } from '../../shared/ui/slots/ui-slot.ts'
import type { ExtensionDef, GameConfig, RukenManifestContribution } from './define-extension'
import { ExtensionError } from './extension-error'

/** Everything the runtime and the build tools need from a game's extension list, in one fixed order. */
export interface ResolvedExtensions {
  /** Extension names: `requires` first, ties by name. */
  readonly order: readonly string[]
  /** In extension order; the game passes them to `createSim`. */
  readonly simPlugins: readonly PluginDef[]
  /** For the content Vite plugin's `schemas`. */
  readonly contentSchemas: readonly ContentSchemaDef[]
  /** Every extension's component for that slot, in order. */
  slots(name: UiSlotName): readonly UiComponent[]
  /** The contributions merged: preload lists concatenated, a repeated path keeps its first place. */
  manifest(config: GameConfig): RukenManifestContribution
}

// The only keys Ruken's manifest lets an extension add (see `RukenManifestContribution`).
const CONTRIBUTION_KEYS: readonly string[] = ['loading']
const LOADING_KEYS: readonly string[] = ['preload']

/**
 * Checks the list and puts it in a fixed order. Throws `ExtensionError`, synchronously, so a game's
 * Vite config fails the build with the message. At run time the build has already resolved the same
 * list, so a throw there is a defect.
 */
export function resolveExtensions(defs: readonly ExtensionDef[]): ResolvedExtensions {
  const byName = indexByName(defs)
  failOnMissingRequirement(byName)
  const ordered = orderByRequirements(byName).map((name) => byName.get(name) as ExtensionDef)

  return {
    order: ordered.map((def) => def.name),
    simPlugins: ordered.flatMap((def) => def.sim ?? []),
    contentSchemas: ordered.flatMap((def) => def.content ?? []),
    slots: (name) => ordered.flatMap((def) => slotComponent(def, name)),
    manifest: (config) => mergeManifests(ordered, config),
  }
}

function indexByName(defs: readonly ExtensionDef[]): Map<string, ExtensionDef> {
  const byName = new Map<string, ExtensionDef>()
  for (const def of defs) {
    if (byName.has(def.name)) throw new ExtensionError({ reason: 'duplicate', names: [def.name] })
    byName.set(def.name, def)
  }
  return byName
}

/** Looks at extensions in name order, so the same list always reports the same missing requirement. */
function failOnMissingRequirement(byName: ReadonlyMap<string, ExtensionDef>): void {
  for (const name of [...byName.keys()].sort()) {
    for (const required of byName.get(name)?.requires ?? []) {
      if (!byName.has(required)) throw new ExtensionError({ reason: 'missing', names: [name, required] })
    }
  }
}

/**
 * Kahn's algorithm: repeatedly take an extension whose requirements are all taken already. Taking the
 * smallest ready name each time makes the order independent of the array order.
 */
function orderByRequirements(byName: ReadonlyMap<string, ExtensionDef>): string[] {
  const taken = new Set<string>()
  const order: string[] = []
  const waiting = new Set(byName.keys())

  while (waiting.size > 0) {
    const ready = [...waiting]
      .filter((name) => (byName.get(name)?.requires ?? []).every((required) => taken.has(required)))
      .sort()[0]
    // Nothing is ready, yet extensions remain: they wait on each other.
    if (ready === undefined) throw new ExtensionError({ reason: 'cycle', names: findLoop(byName, waiting) })
    waiting.delete(ready)
    taken.add(ready)
    order.push(ready)
  }
  return order
}

/**
 * Names the loop among the extensions that never became ready. Some of them may only wait on the loop
 * without being in it, so: walk from the smallest name, always following its smallest unresolved
 * requirement, until a name repeats. The repeat is where the loop starts. The loop is then written
 * from its smallest name, following `requires`.
 */
function findLoop(byName: ReadonlyMap<string, ExtensionDef>, waiting: ReadonlySet<string>): string[] {
  const walk: string[] = []
  let current = [...waiting].sort()[0] as string
  while (!walk.includes(current)) {
    walk.push(current)
    // Every waiting extension has at least one waiting requirement, or it would have been ready.
    current = (byName.get(current)?.requires ?? [])
      .filter((required) => waiting.has(required))
      .sort()[0] as string
  }

  const loop = walk.slice(walk.indexOf(current))
  const smallest = [...loop].sort()[0] as string
  const start = loop.indexOf(smallest)
  return [...loop.slice(start), ...loop.slice(0, start)]
}

function slotComponent(def: ExtensionDef, name: UiSlotName): UiComponent[] {
  const component = def.ui?.slots?.[name]
  return component === undefined ? [] : [component]
}

function mergeManifests(ordered: readonly ExtensionDef[], config: GameConfig): RukenManifestContribution {
  const preload = new Set<string>()
  for (const def of ordered) {
    if (def.manifest === undefined) continue
    const contribution = def.manifest(config)
    rejectUnknownFields(def.name, contribution)
    // A Set keeps the first place of a repeated path.
    for (const path of contribution.loading?.preload ?? []) preload.add(path)
  }
  return preload.size === 0 ? {} : { loading: { preload: [...preload] } }
}

/** The type system already rejects these; this catches untyped JavaScript at build time. */
function rejectUnknownFields(extensionName: string, contribution: RukenManifestContribution): void {
  for (const key of Object.keys(contribution)) {
    if (!CONTRIBUTION_KEYS.includes(key))
      throw new ExtensionError({ reason: 'manifest-field', names: [extensionName, key] })
  }
  for (const key of Object.keys(contribution.loading ?? {})) {
    if (!LOADING_KEYS.includes(key))
      throw new ExtensionError({ reason: 'manifest-field', names: [extensionName, key] })
  }
}
