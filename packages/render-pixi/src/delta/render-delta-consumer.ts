import type { FieldRecord, RenderDelta, RenderRow } from '@mcthaydt/automata-sim'
import type { Container } from 'pixi.js'

export interface EntityView {
  readonly container: Container
  update?(
    curr: Readonly<Record<string, Readonly<FieldRecord>>>,
    prev?: Readonly<Record<string, Readonly<FieldRecord>>> | undefined,
    alpha?: number,
  ): void
  destroy?(): void
}

export type EntityViewFactory = (row: RenderRow) => EntityView | undefined

export type EntityViewResolver = EntityViewFactory | Readonly<Record<string, EntityViewFactory>>

interface CachedEntity {
  curr: Readonly<Record<string, Readonly<FieldRecord>>>
  prev: Readonly<Record<string, Readonly<FieldRecord>>> | undefined
}

export class RenderDeltaConsumer {
  private readonly world: Container
  private readonly resolver?: EntityViewResolver | undefined
  private readonly views = new Map<number, EntityView>()
  private readonly cache = new Map<number, CachedEntity>()

  constructor(world: Container, resolver?: EntityViewResolver) {
    this.world = world
    this.resolver = resolver
  }

  private resolveView(row: RenderRow): EntityView | undefined {
    if (!this.resolver) return undefined
    if (typeof this.resolver === 'function') {
      return this.resolver(row)
    }
    for (const key of Object.keys(this.resolver)) {
      if (key in row.components) {
        const factory = this.resolver[key]
        if (factory) {
          return factory(row)
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
