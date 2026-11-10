import { Sprite3D } from '@pixi/3d';
import { BufferImageSource, Texture } from 'pixi.js';
import type { Cell } from '../stage/cell';

/**
 * A painted `Cell` on a Pixi 3D quad: its texture is the cell's own `rgba`, nearest neighbour, non-premultiplied, cut
 * at alpha by `alphaMode: 'mask'` (a texel is wholly there or not), so the quad shows the painter's texels and no
 * colour the cell does not hold. The texture is re-uploaded only when `cell.key` changes and rebuilt when the cell's
 * size does. The caller places the quad: `sprite.position`, `sprite.quaternion` and `sprite.pixelSize` (the scene's
 * metres to one texel); the anchor is the cell's root texel.
 */
export class CellSprite {
  readonly sprite: Sprite3D;
  private source: BufferImageSource | null = null;
  private key = ''; private size = '';

  constructor() {
    this.sprite = new Sprite3D({ texture: Texture.EMPTY, billboardMode: 'none', alphaMode: 'mask', label: 'CellSprite' });
  }

  /** Shows `cell`: uploads its texels when they may have changed. */
  show(cell: Cell): void {
    const [w, h] = cell.size, size = `${w}x${h}`;
    if (size !== this.size) {
      this.destroySource();
      this.source = new BufferImageSource({ resource: new Uint8Array(w * h * 4), width: w, height: h, scaleMode: 'nearest', alphaMode: 'no-premultiply-alpha' });
      this.sprite.texture = new Texture({ source: this.source });
      this.size = size; this.key = '';
    }
    this.sprite.anchor = { x: cell.anchor[0] / w, y: cell.anchor[1] / h };
    if (cell.key === this.key) return;
    this.source!.resource = new Uint8Array(cell.rgba.buffer, cell.rgba.byteOffset, cell.rgba.byteLength);
    this.source!.update();
    this.key = cell.key;
  }

  private destroySource(): void {
    if (!this.source) return;
    this.sprite.texture.destroy(true);
    this.source = null;
  }

  destroy(): void { this.sprite.destroy({ texture: true, textureSource: true }); }
}
