// What Places does to the scene's files: each action is one undo step, and a rename (which changes the places file and
// the behaviour file that names the place) is one step across both. The session hands itself in as the `host`.
import type { ContentEdit } from '@automata/editor/kit/documents'
import type { SuitePorts } from '@automata/editor/kit/ports'
import type { NavGraph } from '@automata/nav/sim'
import type { SystemsDef } from '@automata/systems/sim'
import { stringify } from 'smol-toml'
import type { Outcome, TomlSession } from '../../shared/toml-session.ts'
import {
  addPlaceEdits,
  connectEdits,
  disconnectEdits,
  removePlaceEdits,
  renamePlaceEdits,
} from './places-edits.ts'

/** The part of the session the actions use. */
export interface PlacesHost {
  readonly facts: { readonly listsNav: boolean }
  readonly ports: SuitePorts
  readonly files: { readonly nav: TomlSession<NavGraph>; readonly systems: TomlSession<SystemsDef> }
  readonly places: NavGraph | undefined
  readonly def: SystemsDef | undefined
  /** Says why a change was not made, and gives that back as the outcome. */
  refuse(message: string): Outcome
  /** Shows a change's outcome (a refusal is said, a success clears the last refusal) and gives it back. */
  settle(outcome: Outcome): Outcome
  /**
   * Records, before the write, that it changes these files together, so Undo takes them back together. Gives back what
   * takes the record away again when the write is refused.
   */
  jointStep(label: string, sessions: readonly TomlSession<unknown>[]): () => void
}

/** Runs a places edit: `edits` for the places file, or why not. */
async function run(
  host: PlacesHost,
  label: string,
  edits: readonly ContentEdit[] | { readonly refused: string },
): Promise<Outcome> {
  if ('refused' in edits) return host.refuse(edits.refused)
  return host.settle(await host.files.nav.edit(label, edits))
}

const NO_PLACES = 'There are no places yet.'

/** The first place makes the scene's places file (when the editor list lets Schematic write it). */
export async function addPlace(host: PlacesHost, name: string, x: number, z: number): Promise<Outcome> {
  if (!host.facts.listsNav)
    return host.refuse(
      'The editor list does not name the places files yet. Add the rows shown on the start page.',
    )
  const nav = host.places
  if (nav !== undefined) return run(host, 'Add a place', addPlaceEdits(nav, name, x, z))
  if (host.files.nav.exists())
    return host.refuse('The places file has a mistake, so it is read only until it is fixed.')
  const id = name.trim()
  if (id === '') return host.refuse('A place needs a name.')
  const text = `# The places in this scene that characters walk between.\n${stringify({ nodes: { [id]: { x, z } }, edges: [] })}`
  return host.settle(await host.files.nav.accept(text, 'Add the first place'))
}

export async function movePlace(
  host: PlacesHost,
  place: string,
  axis: 'x' | 'z',
  value: number,
): Promise<Outcome> {
  const at = host.places?.nodes[place]
  if (at === undefined) return host.refuse('That place is not in this scene any more.')
  return run(host, 'Move a place', [{ keyPath: ['nodes', place, axis], expected: at[axis], set: value }])
}

export async function connectPlaces(host: PlacesHost, a: string, b: string): Promise<Outcome> {
  const nav = host.places
  return nav === undefined ? host.refuse(NO_PLACES) : run(host, 'Join two places', connectEdits(nav, a, b))
}

export async function disconnectPlaces(host: PlacesHost, a: string, b: string): Promise<Outcome> {
  const nav = host.places
  return nav === undefined ? host.refuse(NO_PLACES) : run(host, 'Part two places', disconnectEdits(nav, a, b))
}

export async function removePlace(host: PlacesHost, place: string): Promise<Outcome> {
  const nav = host.places
  if (nav === undefined) return host.refuse(NO_PLACES)
  return run(host, 'Remove a place', removePlaceEdits(nav, host.def, place))
}

/**
 * The places file and the references in the behaviour file, written together as one step. A workspace that cannot write
 * several files at once (a bare adapter) gets them one after the other.
 */
export async function renamePlace(host: PlacesHost, from: string, to: string): Promise<Outcome> {
  const nav = host.places
  if (nav === undefined) return host.refuse(NO_PLACES)
  const edits = renamePlaceEdits(nav, host.def, from, to)
  if ('refused' in edits) return host.refuse(edits.refused)
  const label = `Rename ${from} to ${to}`
  const { nav: places, systems } = host.files
  const writeAll = host.ports.workspace.writeAll
  const navText = places.preview(edits.nav)
  const systemsText = edits.systems.length === 0 ? undefined : systems.preview(edits.systems)
  if (writeAll === undefined || systemsText === undefined || !navText.ok || !systemsText.ok) {
    const first = await run(host, label, edits.nav)
    if (!first.ok || edits.systems.length === 0) return first
    return host.settle(await systems.edit(label, edits.systems))
  }
  const files = [
    { path: places.path, text: navText.text, expected: { mtime: places.mtime() ?? 0 } },
    { path: systems.path, text: systemsText.text, expected: { mtime: systems.mtime() ?? 0 } },
  ]
  const retract = host.jointStep(label, [places, systems])
  const written = await writeAll.call(host.ports.workspace, files)
  if (!written.ok) {
    retract()
    return host.settle({ ok: false, message: written.message })
  }
  await Promise.all([places.adopt(label, navText.text), systems.adopt(label, systemsText.text)])
  return host.settle({ ok: true })
}
