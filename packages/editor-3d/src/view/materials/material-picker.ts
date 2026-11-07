// The material sheet as plain TypeScript (ED3D.8a step 3, spec §5.3 flow 5 and §9): categories on the left, tiles in the
// middle, a preview with scale and brightness, the apply scope and Apply. The sheet reads `view` and calls the methods; the
// level stays in the editor's history and Apply is one `applyMaterial` edit there, so undo needs nothing from the sheet.
//
// What is offered is the profile's list (D10). A profile that has none (Last Light when the host could not read the
// renderer's materials) offers nothing, and Apply answers its refusal: a list is never guessed. Scale and brightness are
// the preview's, not the level's: neither format holds a texture scale or a brightness for a surface.
import { TRIM_PIECES } from '@automata/3d/level'
import type { EditResult } from '../../model/edit'
import type { LevelEditor } from '../../model/level-editor'
import {
  applyMaterial,
  type MaterialScope,
  type MaterialTarget,
  materialOf,
} from '../../model/material-edits'
import { sectorOf } from '../../model/sector-edit-support'
import { GeometryError } from '../../profile/level-profile'
import type { Material, MaterialList } from '../../profile/materials'

export interface MaterialCategory {
  readonly id: string
  /** How many of the offered materials it holds. */
  readonly count: number
}

export interface MaterialPickerView {
  readonly target: MaterialTarget
  /** Why nothing is offered: the profile's refusal of a list. */
  readonly unavailable: string | undefined
  /** In the order the list first names them. */
  readonly categories: readonly MaterialCategory[]
  readonly category: string | undefined
  /** As typed; it is matched trimmed and without case. */
  readonly search: string
  /** The open category's materials, or with a search, every match of it in any category. */
  readonly tiles: readonly Material[]
  /** A search that matches nothing. */
  readonly empty: boolean
  readonly selected: Material | undefined
  /** What the target is made of now. */
  readonly current: string | undefined
  /** The offered materials the level uses, in list order. */
  readonly used: readonly Material[]
  /** The preview's texture scale, 0.25 to 4. */
  readonly scale: number
  /** The preview's brightness, 0 to 1.5; it starts at the light of the target's sector. */
  readonly brightness: number
  readonly scope: MaterialScope
  /** The sentence the last Apply was refused with, until one is accepted. */
  readonly refusal: string | undefined
}

export interface MaterialPicker {
  readonly view: MaterialPickerView
  /** Called after `view` changes; returns a way to stop. */
  subscribe(run: () => void): () => void
  openCategory(id: string): void
  search(text: string): void
  /** Selects an offered material; any other id is ignored. */
  select(id: string): void
  setScale(scale: number): void
  setBrightness(brightness: number): void
  setScope(scope: MaterialScope): void
  /** The sheet is now about another wall or surface: it opens on what that is made of. */
  retarget(target: MaterialTarget): void
  /** Applies the selected material to the scope as one undo step, or refuses and changes nothing. */
  apply(): EditResult<unknown>
  /** Stops following the editor. */
  dispose(): void
}

export interface MaterialPickerOptions {
  readonly target: MaterialTarget
}

const SCALE = { min: 0.25, max: 4 } as const
const BRIGHTNESS = { min: 0, max: 1.5 } as const

const clamp = (value: number, range: { readonly min: number; readonly max: number }): number =>
  Math.min(range.max, Math.max(range.min, value))

/** Equal as data: the view is names, numbers and short lists. */
const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b)

const sectorIdOf = (target: MaterialTarget): string => ('wall' in target ? target.wall.sector : target.sector)

/** Whether the target is a floor or a ceiling, which a material for walls only may not cover. */
const isFlat = (target: MaterialTarget): boolean => !('wall' in target) && target.surface !== 'walls'

/** The categories of a list, in the order it first names them, with their counts. */
function categoriesOf(materials: readonly Material[]): MaterialCategory[] {
  const counts = new Map<string, number>()
  for (const material of materials) counts.set(material.category, (counts.get(material.category) ?? 0) + 1)
  return [...counts].map(([id, count]) => ({ id, count }))
}

export function createMaterialPicker<D>(
  editor: LevelEditor<D>,
  options: MaterialPickerOptions,
): MaterialPicker {
  const listeners = new Set<() => void>()
  let target = options.target
  let category: string | undefined
  let search = ''
  let selected: Material | undefined
  let scale = 1
  let brightness = 1
  let scope: MaterialScope = 'wall'
  let refusal: string | undefined

  /** The list for the live level, and what of it the target may take. */
  const listOf = (): MaterialList => editor.profile.materials(editor.level)
  const offered = (): readonly Material[] => {
    const list = listOf()
    if (!list.ok) return []
    return isFlat(target) ? list.materials.filter((material) => material.wallOnly !== true) : list.materials
  }

  /** Every material id the resolved level names: its sectors' floors, ceilings and walls, and its walls and trims. */
  const usedIds = (): Set<string> => {
    const used = new Set<string>()
    let layers: ReturnType<typeof editor.profile.geometry>['layers'] = []
    try {
      layers = editor.profile.geometry(editor.level).layers
    } catch (error) {
      if (!(error instanceof GeometryError)) throw error
    }
    const add = (id: string | undefined): void => {
      if (id !== undefined) used.add(id)
    }
    for (const layer of layers) {
      for (const sector of layer.map.sectors) {
        add(sector.floorTexture)
        add(sector.ceilingTexture)
        add(sector.wallTexture)
      }
      for (const edge of layer.map.edges) {
        add(edge.wall.texture)
        for (const piece of TRIM_PIECES) add(edge.wall.trimTexture?.[piece])
      }
    }
    return used
  }

  /** Opens on what the target is made of: its category, it selected, and the light of its sector. */
  const openOnTarget = (): void => {
    const materials = offered()
    const current = materialOf(editor.profile, editor.level, target)
    selected = materials.find((material) => material.id === current)
    category = selected?.category ?? materials[0]?.category
    brightness = clamp(sectorOf(editor.profile, editor.level, sectorIdOf(target))?.light ?? 1, BRIGHTNESS)
  }

  /**
   * What the live level says, built once for each level and target: a slider scrubbing the preview rebuilds no
   * geometry. An edit is a new level, so it is read again.
   */
  let facts: { level: D; target: MaterialTarget; current: string | undefined; used: Set<string> } | undefined
  const levelFacts = (): { current: string | undefined; used: Set<string> } => {
    if (facts?.level !== editor.level || facts.target !== target)
      facts = {
        level: editor.level,
        target,
        current: materialOf(editor.profile, editor.level, target),
        used: usedIds(),
      }
    return facts
  }

  /**
   * Holds the selection and the open category to what the list offers now: an edit of the table, or an undo past the
   * one that added a material, can take either away. The selection is the list's own entry, so a changed `wallOnly` shows.
   */
  const revalidate = (materials: readonly Material[]): void => {
    selected = selected === undefined ? undefined : materials.find((material) => material.id === selected?.id)
    if (!materials.some((material) => material.category === category)) category = materials[0]?.category
  }

  const compute = (): MaterialPickerView => {
    const list = listOf()
    const materials = offered()
    revalidate(materials)
    const needle = search.trim().toLowerCase()
    const tiles =
      needle === ''
        ? materials.filter((material) => material.category === category)
        : materials.filter(
            (material) =>
              material.id.toLowerCase().includes(needle) ||
              (material.label ?? '').toLowerCase().includes(needle),
          )
    const { current, used } = levelFacts()
    return {
      target,
      unavailable: list.ok ? undefined : list.reason,
      categories: categoriesOf(materials),
      category,
      search,
      tiles,
      empty: needle !== '' && tiles.length === 0,
      selected,
      current,
      used: materials.filter((material) => used.has(material.id)),
      scale,
      brightness,
      scope,
      refusal,
    }
  }

  openOnTarget()
  let view = compute()

  const refresh = (): void => {
    const next = compute()
    if (same(view, next)) return
    view = next
    for (const run of [...listeners]) run()
  }
  const stop = editor.history.subscribe(refresh)

  return {
    get view() {
      return view
    },
    subscribe(run) {
      listeners.add(run)
      return () => {
        listeners.delete(run)
      }
    },
    openCategory(id) {
      if (!offered().some((material) => material.category === id)) return
      category = id
      refresh()
    },
    search(text) {
      search = text
      refresh()
    },
    select(id) {
      const material = offered().find((each) => each.id === id)
      if (material === undefined) return
      selected = material
      refresh()
    },
    setScale(next) {
      if (!Number.isFinite(next)) return
      scale = clamp(next, SCALE)
      refresh()
    },
    setBrightness(next) {
      if (!Number.isFinite(next)) return
      brightness = clamp(next, BRIGHTNESS)
      refresh()
    },
    setScope(next) {
      scope = next
      refresh()
    },
    retarget(next) {
      target = next
      openOnTarget()
      refresh()
    },
    apply() {
      const list = listOf()
      revalidate(offered())
      const result: EditResult<D> = !list.ok
        ? { ok: false, reason: list.reason }
        : selected === undefined
          ? { ok: false, reason: 'pick a material' }
          : editor.run(applyMaterial<D>({ target, scope, material: selected }))
      refusal = result.ok ? undefined : result.reason
      refresh()
      return result
    },
    dispose() {
      stop()
      listeners.clear()
    },
  }
}
