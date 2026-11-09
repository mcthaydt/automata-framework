import type { FieldRecord, RenderDelta, RenderRow } from '@automata/sim'
import type { Container } from 'pixi.js'

/**
 * What the consumer needs of a scene node: Pixi's `Container`, or another scene graph's node with the same meaning
 * (`@pixi/3d`'s `Container3D`, which is not a Pixi `Container`).
 */
export interface SceneNode {
  readonly parent: unknown
  removeFromParent(): void
}

/** A scene node that holds other nodes: the world the consumer mounts views into. */
export interface SceneParent<C extends SceneNode> {
  addChild(child: C): unknown
}

/**
 * What an entity view factory returns: the container drawn for one entity, updated with its current and
 * previous component values and the interpolation alpha, and destroyed when the entity goes.
 */
export interface EntityView<C extends SceneNode = Container> {
  readonly container: C
  update?(
    curr: Readonly<Record<string, Readonly<FieldRecord>>>,
    prev?: Readonly<Record<string, Readonly<FieldRecord>>> | undefined,
    alpha?: number,
  ): void
  destroy?(): void
}

/**
 * Builds the view for one entity, or `undefined` to draw nothing. A record resolver passes the component id
 * the factory was registered under, so a view such as `rect()` knows which component holds its pose; a bare
 * function resolver passes no id.
 */
export type EntityViewFactory<C extends SceneNode = Container> = (
  row: RenderRow,
  componentId?: string,
) => EntityView<C> | undefined

/**
 * Which view an entity gets: one factory for every entity, or factories by component id (the first id, in the
 * record's own key order, whose component the entity has wins).
 */
export type EntityViewResolver<C extends SceneNode = Container> =
  | EntityViewFactory<C>
  | Readonly<Record<string, EntityViewFactory<C>>>

interface CachedEntity {
  curr: Readonly<Record<string, Readonly<FieldRecord>>>
  prev: Readonly<Record<string, Readonly<FieldRecord>>> | undefined
}

/**
 * Keeps one entity view per sim entity in the world from each step's render delta, and interpolates them between
 * ticks. `C` is the scene's node type: Pixi's `Container` by default.
 */
export class RenderDeltaConsumer<C extends SceneNode = Container> {
  private readonly world: SceneParent<C>
  private readonly resolver?: EntityViewResolver<C> | undefined
  private readonly views = new Map<number, EntityView<C>>()
  private readonly cache = new Map<number, CachedEntity>()

  constructor(world: SceneParent<C>, resolver?: EntityViewResolver<C>) {
    this.world = world
    this.resolver = resolver
  }

  private resolveView(row: RenderRow): EntityView<C> | undefined {
    if (!this.resolver) return undefined
    if (typeof this.resolver === 'function') {
      return this.resolver(row)
    }
    for (const key of Object.keys(this.resolver)) {
      if (key in row.components) {
        const factory = this.resolver[key]
        if (factory) {
          return factory(row, key)
        }
      }
    }
    return undefined
  }

  apply(delta: RenderDelta): void {
    if (delta.resync) {
      this.reset()
    } else {
      for (const sid of delta.removed) {
        this.removeEntity(sid)
      }

      const touchedSids = new Set<number>()
      for (const row of delta.changed) {
        touchedSids.add(row.sid)
      }
      for (const row of delta.added) {
        touchedSids.add(row.sid)
      }

      for (const [sid, entry] of this.cache.entries()) {
        if (!touchedSids.has(sid)) {
          entry.prev = entry.curr
        }
      }
    }

    for (const row of delta.added) {
      if (this.views.has(row.sid)) {
        this.removeEntity(row.sid)
      }
      const view = this.resolveView(row)
      if (view) {
        this.world.addChild(view.container)
        this.views.set(row.sid, view)
      }
      this.cache.set(row.sid, {
        curr: row.components,
        prev: undefined,
      })
      view?.update?.(row.components, undefined, 1)
    }

    for (const row of delta.changed) {
      const entry = this.cache.get(row.sid)
      const prev = entry ? entry.curr : row.components
      if (entry) {
        entry.prev = prev
        entry.curr = row.components
      } else {
        this.cache.set(row.sid, {
          curr: row.components,
          prev,
        })
      }
      let view = this.views.get(row.sid)
      if (!view) {
        view = this.resolveView(row)
        if (view) {
          this.world.addChild(view.container)
          this.views.set(row.sid, view)
        }
      }
      view?.update?.(row.components, prev, 1)
    }
  }

  interpolate(alpha: number): void {
    for (const [sid, entry] of this.cache.entries()) {
      const view = this.views.get(sid)
      if (view?.update) {
        view.update(entry.curr, entry.prev, alpha)
      }
    }
  }

  private removeEntity(sid: number): void {
    const view = this.views.get(sid)
    if (view) {
      try {
        view.destroy?.()
      } finally {
        if (view.container.parent) {
          view.container.removeFromParent()
        }
      }
      this.views.delete(sid)
    }
    this.cache.delete(sid)
  }

  reset(): void {
    for (const [_sid, view] of this.views.entries()) {
      try {
        view.destroy?.()
      } finally {
        if (view.container.parent) {
          view.container.removeFromParent()
        }
      }
    }
    this.views.clear()
    this.cache.clear()
  }

  destroy(): void {
    this.reset()
  }
}
