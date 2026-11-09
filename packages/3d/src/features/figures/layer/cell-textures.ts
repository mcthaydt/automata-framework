// The textures a frame's cells are drawn from. A cell is a few thousand texels and a frame shows a handful, so the
// textures are leased by size and kept: a figure that stands in one pose and one light finds its texture as it left it
// and uploads nothing.

import type { Texture } from 'pixi.js'
import type { PaintedCell } from '../paint/paint-cell.ts'
import { cellTexture } from './cell-composite-pass.ts'
import { depthBytes } from './cell-depth.ts'

interface Slot {
  readonly colours: Texture
  readonly depth: Texture
  readonly coloursBytes: Uint8Array<ArrayBuffer>
  readonly depthBytes: Uint8Array<ArrayBuffer>
  /** What the textures hold now. */
  shown: Uint8ClampedArray | undefined
  shownDepth: PaintedCell | undefined
}

export class CellTextures {
  private readonly slots = new Map<string, Slot[]>()
  private readonly next = new Map<string, number>()

  /** Starts a frame: every slot is free to lease again, in the order it was first leased. */
  begin(): void {
    this.next.clear()
  }

  /** A colour and a depth texture holding `colours` (the finished colours of `cell`) and the depth of `cell`. */
  lease(cell: PaintedCell, colours: Uint8ClampedArray): { colours: Texture; depth: Texture } {
    const size = `${cell.width}x${cell.height}`
    const list = this.slots.get(size) ?? []
    this.slots.set(size, list)
    const at = this.next.get(size) ?? 0
    this.next.set(size, at + 1)
    let slot = list[at]
    if (slot === undefined) {
      const bytes = new Uint8Array(cell.width * cell.height * 4)
      const depth = new Uint8Array(cell.width * cell.height * 4)
      slot = {
        colours: cellTexture(bytes, cell.width, cell.height),
        depth: cellTexture(depth, cell.width, cell.height),
        coloursBytes: bytes,
        depthBytes: depth,
        shown: undefined,
        shownDepth: undefined,
      }
      list[at] = slot
    }
    if (slot.shown !== colours) {
      slot.coloursBytes.set(colours)
      slot.colours.source.update()
      slot.shown = colours
    }
    if (slot.shownDepth !== cell) {
      depthBytes(cell, slot.depthBytes)
      slot.depth.source.update()
      slot.shownDepth = cell
    }
    return { colours: slot.colours, depth: slot.depth }
  }

  dispose(): void {
    for (const list of this.slots.values())
      for (const slot of list) {
        slot.colours.destroy(true)
        slot.depth.destroy(true)
      }
    this.slots.clear()
    this.next.clear()
  }
}
