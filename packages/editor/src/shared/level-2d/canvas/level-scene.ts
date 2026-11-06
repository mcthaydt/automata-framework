import { Container, Graphics } from 'pixi.js'
import type { ColorResolver } from './colors'
import type { LayerDraw, LevelDrawList } from './draw/draw-list-types'
import {
  backgroundView,
  drawLinks,
  drawOverlays,
  entityKey,
  entityView,
  type ItemContext,
  intChunkView,
  objectKey,
  objectView,
  tileChunkView,
} from './scene-items'
import type { TextureManager } from './textures.manager'

// A draw list as a Pixi scene. The draw list hands back
// the same chunk object for every chunk a stroke did not touch, so the scene keeps the Pixi container it built for each
// chunk object and builds only for the new ones; a chunk object that is not in the next list is destroyed with its
// container. Entities and objects are kept per instance id while what they draw is unchanged. The overlays (grid,
// footprint, selection) are one `Graphics` redrawn on each update: a few hundred lines at most. The links
// are rebuilt over them on each update too.

export interface LevelSceneOptions {
  readonly textures: TextureManager
  readonly colors: ColorResolver
}

export interface LevelScene {
  /** Level pixels at scale 1, top-left at the origin; the view or the thumbnail places and scales it. */
  readonly root: Container
  /** Draws `list`; `scale` is the screen pixels per level pixel the root will be drawn at (for line widths). */
  update(list: LevelDrawList, scale?: number): void
  /** The container drawn for a chunk object of the last list, if any: what the reuse tests compare. */
  chunkView(chunk: object): Container | undefined
  destroy(): void
}

interface Kept {
  readonly key: string
  readonly view: Container
}

interface LayerView {
  readonly kind: LayerDraw['kind']
  readonly container: Container
  /** Chunk layers: the view of each chunk object. */
  chunks: Map<object, Container>
  /** Entities and objects layers: each instance's view and what it was built from. */
  items: Map<string, Kept>
}

/** Replaces the children of `container` by `views`, in order, without destroying any. */
function setChildren(container: Container, views: readonly Container[]): void {
  container.removeChildren()
  if (views.length > 0) container.addChild(...views)
}

export function createLevelScene(options: LevelSceneOptions): LevelScene {
  const context: ItemContext = options
  const root = new Container()
  const backgroundSlot = new Container()
  const layersRoot = new Container()
  const overlay = new Graphics()
  const links = new Container()
  root.addChild(backgroundSlot, layersRoot, overlay, links)
  let background: Kept | undefined
  let layers = new Map<string, LayerView>()

  function updateBackground(list: LevelDrawList): void {
    const { image } = list.background
    const key = JSON.stringify([
      list.background,
      list.size,
      // The image's generation: a background image loaded again is a new texture, the old one destroyed.
      image === undefined ? 0 : (context.textures.generations.get(image) ?? 0),
    ])
    if (background?.key === key) return
    background?.view.destroy({ children: true })
    background = { key, view: backgroundView(list, context) }
    setChildren(backgroundSlot, [background.view])
  }

  function updateChunks(view: LayerView, layer: LayerDraw): void {
    if (layer.kind !== 'tiles' && layer.kind !== 'auto' && layer.kind !== 'intgrid') return
    const next = new Map<object, Container>()
    for (const chunk of layer.chunks) {
      const kept = view.chunks.get(chunk)
      next.set(
        chunk,
        kept ?? ('tiles' in chunk ? tileChunkView(chunk, context) : intChunkView(chunk, context)),
      )
    }
    for (const [chunk, old] of view.chunks) if (!next.has(chunk)) old.destroy({ children: true })
    view.chunks = next
    setChildren(view.container, [...next.values()])
  }

  function updateItems(view: LayerView, layer: LayerDraw, px: number): void {
    if (layer.kind !== 'entities' && layer.kind !== 'objects') return
    const built: [string, string, () => Container][] =
      layer.kind === 'entities'
        ? layer.entities.map((entity) => [
            entity.id,
            entityKey(entity, px, context),
            () => entityView(entity, context, px),
          ])
        : layer.objects.map((object) => [
            object.id,
            objectKey(object, context),
            () => objectView(object, context),
          ])
    const next = new Map<string, Kept>()
    for (const [id, key, build] of built) {
      const kept = view.items.get(id)
      next.set(id, kept?.key === key ? kept : { key, view: build() })
    }
    for (const [id, old] of view.items) if (next.get(id) !== old) old.view.destroy({ children: true })
    view.items = next
    setChildren(
      view.container,
      [...next.values()].map((kept) => kept.view),
    )
  }

  function destroyLayer(view: LayerView): void {
    view.container.destroy({ children: true })
  }

  return {
    root,
    update(list, scale = 1) {
      const px = 1 / scale
      updateBackground(list)
      const next = new Map<string, LayerView>()
      for (const layer of list.layers) {
        let view = layers.get(layer.def)
        if (view !== undefined && view.kind !== layer.kind) {
          destroyLayer(view)
          view = undefined
        }
        view ??= { kind: layer.kind, container: new Container(), chunks: new Map(), items: new Map() }
        view.container.alpha = layer.opacity
        // Each of these leaves a layer of the other family alone.
        updateChunks(view, layer)
        updateItems(view, layer, px)
        next.set(layer.def, view)
      }
      for (const [def, view] of layers) if (next.get(def) !== view) destroyLayer(view)
      layers = next
      setChildren(
        layersRoot,
        [...next.values()].map((view) => view.container),
      )
      drawOverlays(overlay, list, context, px)
      drawLinks(links, list.links, list.size, context, px)
    },
    chunkView(chunk) {
      for (const view of layers.values()) {
        const found = view.chunks.get(chunk)
        if (found !== undefined) return found
      }
      return undefined
    },
    destroy() {
      root.destroy({ children: true })
      layers = new Map()
      background = undefined
    },
  }
}
