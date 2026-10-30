// The editor's plan as a paint list (ED3D.5d): the live level's geometry, things and links, the view's hidden layers and
// camera, and the selection, handed to `planPaint` for a canvas of a given size. The geometry is the controllers' cache
// (one build per level), and the things are read once per level too, so a pointer move that only changes the camera or
// the hover costs a paint, not a rebuild.
import type { Size } from '@mcthaydt/automata-editor-kit/core'
import type { EntityKit } from '../entities/things'
import type { LevelEditor } from '../model/level-editor'
import type { ThingLink } from '../profile/thing-links'
import { type PlanPaint, planPaint } from '../view/plan/plan-paint'
import { planScene } from '../view/plan/plan-scene'
import { planViewport } from '../view/plan/plan-viewport'
import { createGeometryCache } from './geometry-cache'

export function createPlanPicture<D>(editor: LevelEditor<D>): (size: Size) => PlanPaint {
  const geometry = createGeometryCache(editor)
  let things: { readonly level: D; readonly kit: EntityKit; readonly links: readonly ThingLink[] } | undefined

  const thingsOf = (level: D) => {
    if (things?.level !== level)
      things = { level, kit: editor.profile.entities(level), links: editor.profile.links?.list(level) ?? [] }
    return things
  }

  return (size) => {
    const { layers, select, level } = geometry()
    const { hidden, camera, grid } = editor.view.state
    const { kit, links } = thingsOf(level)
    return planPaint({
      scene: planScene(layers, select, { hidden }),
      kit,
      links,
      linkDef: editor.profile.links?.def,
      viewport: planViewport(camera, size),
      grid: grid.step,
      hidden,
      selected: new Set(editor.selection.ids),
    })
  }
}
