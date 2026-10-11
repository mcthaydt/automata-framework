// The bodies, as a layer on base-2d's renderer: one 8 × 8 sprite per crate or stone, drawn from the sim's
// RenderDelta alone, the way render-pixi (M1.7) drives views. The layer never reads the sim: each step's delta
// says which bodies appeared, moved or went (`added`, `changed`, `removed`), and a `resync` delta lists every
// body afresh. Walls carry no `Prop`, so they draw nothing here (the room's tiles already show them). The
// layer sits under the room's light map, so Wick's lantern and the ember light the bodies like the room.

import type { RendererLayer } from '@af-examples/base-2d/render'
import { Transform2D } from '@mcthaydt/automata-physics/2d'
import type { RenderRow } from '@mcthaydt/automata-sim'
import { Container, Sprite, type Texture } from 'pixi.js'
import { Prop, PropKind, PX_PER_M } from './sim/bodies.plugin.ts'

export interface BodyTextures {
  readonly crate: Texture
  readonly stone: Texture
}

/** What the layer drew after a step, for the page's data attributes (the browser journeys read them). */
export interface Drawn {
  /** Sprites on screen. */
  readonly count: number
  /** The rightmost crate's x in room pixels, or -1 with no crate; a shove moves it. */
  readonly crateX: number
}

/** `roomHeightPx` flips physics' y (up) to the room's (down). `onDrawn` hears what is drawn after each step. */
export function bodiesLayer(
  roomHeightPx: number,
  textures: BodyTextures,
  onDrawn: (drawn: Drawn) => void = () => {},
): RendererLayer {
  const view = new Container()
  const sprites = new Map<number, Sprite>()

  const forget = (sid: number) => {
    sprites.get(sid)?.destroy()
    sprites.delete(sid)
  }
  const clear = () => {
    for (const sid of [...sprites.keys()]) forget(sid)
  }

  // A row carries the entity's whole render state, so a body without Prop or Transform2D is not ours to draw.
  const place = (row: RenderRow) => {
    const prop = row.components[Prop.id]
    const at = row.components[Transform2D.id]
    if (prop === undefined || at === undefined) return forget(row.sid)
    let sprite = sprites.get(row.sid)
    if (sprite === undefined) {
      sprite = new Sprite(prop.kind === PropKind.crate ? textures.crate : textures.stone)
      sprite.anchor.set(0.5)
      sprites.set(row.sid, sprite)
      view.addChild(sprite)
    }
    // Whole pixels, so the pixel art never lands between screen pixels. Rapier's angle is counter-clockwise
    // with y up; on screen y points down, so the sprite turns the other way.
    sprite.position.set(
      Math.round((at.x as number) * PX_PER_M),
      Math.round(roomHeightPx - (at.y as number) * PX_PER_M),
    )
    sprite.rotation = -(at.rotation as number)
  }

  return {
    view,
    apply(result) {
      const delta = result.render
      if (delta.resync) clear()
      for (const row of delta.added) place(row)
      for (const row of delta.changed) place(row)
      for (const sid of delta.removed) forget(sid)
      let crateX = -1
      for (const sprite of sprites.values())
        if (sprite.texture === textures.crate) crateX = Math.max(crateX, sprite.x)
      onDrawn({ count: sprites.size, crateX })
    },
    // A new round starts a fresh sim, whose first delta is a resync; drop the old round's sprites now.
    reset: clear,
  }
}
