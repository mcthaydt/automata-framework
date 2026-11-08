import type { ContentLevel, ContentProject } from '@automata/content/level-2d'
import { placeholderColor } from '@automata/content/level-2d'
import { Container, Graphics, Sprite, TilingSprite } from 'pixi.js'
import type { DrawSim } from '../../../shared/draw/read-sim.ts'
import { clipSprite, clipTextures } from './clips.ts'
import { type DrawItem, levelDrawList } from './level-draw-list.ts'
import { picturesOf } from './pictures.ts'

// A 2D level in the game: the tiles, auto tiles, objects and placed characters a person painted in the editor,
// drawn under the entity views. It is presentation only (law 2): it reads the sim through the draw layer's `DrawSim`
// and the exported content, and it writes nothing back. The pure list of what to draw is `levelDrawList`; this file
// turns it into Pixi objects and keeps them until the level shown (or a picture) changes.

/** What `levelScene` needs: the exported content, the pictures the build gave the game, and where to start. */
export interface LevelSceneOptions {
  readonly project: ContentProject
  readonly levels: Readonly<Record<string, ContentLevel>>
  /** A workspace path (`assets/terrain.png`) to the url the build gave it. */
  readonly images: Readonly<Record<string, string>>
  /** The level shown first (its id). */
  readonly start: string
  /**
   * Characters (definition ids) the game spawns and draws itself, with `pictureView`. Core leaves out their placed
   * items, so one is not drawn twice. Also the way to keep a marker (an area, a spawn point) out of the picture.
   */
  readonly live?: readonly string[] | undefined
  /** The level to show now, read from the sim each frame. Default: always `start`. */
  readonly current?: ((sim: DrawSim) => string) | undefined
}

/**
 * What a hook draws in the scene: the sim now, the scene's container (under the game's own views), an overlay over
 * everything the world shows, and a way to hide one placed item's drawing.
 */
export interface LevelSceneHooks {
  draw(
    sim: DrawSim,
    scene: {
      readonly container: Container
      /**
       * A layer over the world and every view in it, in view coordinates (the camera does not move it): the place for a
       * fade or a flash, which must cover the game's own characters too.
       */
      readonly overlay: Container
      hide(itemId: string, hidden: boolean): void
    },
  ): void
}

/** A level the game shows, from `levelScene`; pass it as `defineGame({ level })`. */
export interface LevelScene {
  /** Adds a hook called each frame after the scene's own redraw check (the 2D cutscene stage is the first). */
  add(hooks: LevelSceneHooks): void
}

interface Internals {
  readonly container: Container
  readonly overlay: Container
  frame(sim: DrawSim | undefined): void
}

/** The parts `defineGame` and the draw layer drive; not part of the public surface. */
const internals = new WeakMap<LevelScene, Internals>()

/** Puts the scene under the entity views of `world`, and its overlay on `ui`, over everything the world shows. */
export function mountLevelScene(scene: LevelScene, world: Container, ui: Container): void {
  const found = internals.get(scene)
  if (found === undefined) return
  world.addChildAt(found.container, 0)
  ui.addChild(found.overlay)
}

/** Draws one display frame. With no sim (no game running) the scene is hidden. */
export function drawLevelScene(scene: LevelScene, sim: DrawSim | undefined): void {
  internals.get(scene)?.frame(sim)
}

const report = (message: string): void => globalThis.reportError?.(new Error(message))

function hexNumber(color: string): number {
  return Number.parseInt(color.slice(1), 16)
}

/** Validates the options now and returns the scene; the Pixi objects are made on the first frame. */
export function levelScene(options: LevelSceneOptions): LevelScene {
  const { project, levels, images } = options
  const start = levels[options.start]
  if (start === undefined)
    throw new Error(`There is no level "${options.start}". Open it in the editor and press Save.`)
  const live = options.live ?? []
  for (const id of live)
    if (!project.entities.some((def) => def.id === id))
      throw new Error(`There is no character "${id}" in the project. Check the \`live\` list.`)

  const container = new Container({ label: 'level' })
  const overlay = new Container({ label: 'level-overlay' })
  const hooks: LevelSceneHooks[] = []
  const imageSet = new Set(Object.keys(images))
  const pictures = picturesOf(images)
  const reported = new Set<string>()
  const hidden = new Set<string>()
  const itemViews = new Map<string, Container[]>()
  let shown: string | undefined
  let dirty = true
  pictures.onLoad(() => {
    dirty = true
  })

  const once = (message: string): void => {
    if (reported.has(message)) return
    reported.add(message)
    report(message)
  }

  function itemView(item: DrawItem): Container {
    if (item.kind === 'animation') {
      const clip = item.animation.clips[0]
      const textures =
        clip === undefined
          ? undefined
          : clipTextures(pictures, item.animation, clip, (frame, count) =>
              once(`The clip "${clip.id}" uses frame ${frame}, but the picture has ${count}.`),
            )
      if (clip !== undefined && textures !== undefined) {
        const sprite = clipSprite(textures, clip)
        sprite.anchor.set(0.5)
        sprite.position.set(item.x + item.w / 2, item.y + item.h / 2)
        sprite.width = item.w
        sprite.height = item.h
        return sprite
      }
      // The picture has not arrived yet: the character's own colour, as the editor shows it.
      return new Graphics().rect(item.x, item.y, item.w, item.h).fill(hexNumber(item.waiting))
    }
    if (item.kind === 'tile') {
      const f = item.frame
      const cut = pictures.cut(item.image, f)
      if (cut !== undefined) {
        const sprite = new Sprite(cut)
        sprite.anchor.set(0.5)
        sprite.position.set(item.x + item.w / 2, item.y + item.h / 2)
        // A flip is a negative scale about the tile's centre.
        sprite.scale.set((item.flipX ? -1 : 1) * (item.w / f.w), (item.flipY ? -1 : 1) * (item.h / f.h))
        return sprite
      }
      // The picture has not arrived yet: the tile's own colour, as the editor shows a tile with no picture.
      return new Graphics().rect(item.x, item.y, item.w, item.h).fill(hexNumber(placeholderColor(item.tile)))
    }
    const shape = new Graphics()
    if (item.ellipse) shape.ellipse(item.x + item.w / 2, item.y + item.h / 2, item.w / 2, item.h / 2)
    else shape.rect(item.x, item.y, item.w, item.h)
    return shape.fill(hexNumber(item.color))
  }

  function backdrop(
    level: ContentLevel,
    image: string | undefined,
    color: string,
    mode: ContentLevel['background']['mode'],
  ): void {
    container.addChild(new Graphics().rect(0, 0, level.size.w, level.size.h).fill(hexNumber(color)))
    if (image === undefined) return
    const texture = pictures.texture(image)
    if (texture === undefined) return
    if (mode === 'repeat' || mode === 'repeat-x') {
      container.addChild(
        new TilingSprite({
          texture,
          width: level.size.w,
          height: mode === 'repeat' ? level.size.h : Math.min(texture.height, level.size.h),
        }),
      )
      return
    }
    const scale = (mode === 'fit' ? Math.min : Math.max)(
      level.size.w / texture.width,
      level.size.h / texture.height,
    )
    const sprite = new Sprite(texture)
    sprite.scale.set(scale)
    sprite.position.set(
      (level.size.w - texture.width * scale) / 2,
      (level.size.h - texture.height * scale) / 2,
    )
    container.addChild(sprite)
  }

  function rebuild(id: string): void {
    for (const child of container.removeChildren()) child.destroy()
    itemViews.clear()
    const level = levels[id]
    if (level === undefined) {
      once(`There is no level "${id}". Open it in the editor and press Save.`)
      return
    }
    const draw = levelDrawList(project, level, imageSet, live)
    for (const problem of draw.problems) once(problem)
    backdrop(level, draw.background.image, draw.background.color, draw.background.mode)
    for (const item of draw.items) {
      const view = itemView(item)
      view.visible = item.itemId === undefined || !hidden.has(item.itemId)
      container.addChild(view)
      if (item.itemId !== undefined) itemViews.set(item.itemId, [...(itemViews.get(item.itemId) ?? []), view])
    }
  }

  const scene: LevelScene = {
    add(hook) {
      hooks.push(hook)
    },
  }
  const api = {
    hide(itemId: string, value: boolean): void {
      if (value) hidden.add(itemId)
      else hidden.delete(itemId)
      for (const view of itemViews.get(itemId) ?? []) view.visible = !value
    },
  }
  internals.set(scene, {
    container,
    overlay,
    frame(sim) {
      container.visible = sim !== undefined
      overlay.visible = sim !== undefined
      if (sim === undefined) return
      const id = options.current?.(sim) ?? start.id
      if (id !== shown || dirty) {
        shown = id
        dirty = false
        rebuild(id)
      }
      for (const hook of hooks) hook.draw(sim, { container, overlay, hide: api.hide })
    },
  })
  return scene
}
