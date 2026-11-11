import { FlatMaterial, Sprite3D, type ShaderBit } from '@pixi/3d';
import { BufferImageSource, Texture } from 'pixi.js';
import type { Cell } from '../stage/cell';

/**
 * A painted `Cell` on a Pixi 3D quad: its texture is the cell's own `rgba`, nearest neighbour, non-premultiplied, cut
 * at alpha by `alphaMode: 'mask'` (a texel is wholly there or not), so the quad shows the painter's texels and no
 * colour the cell does not hold. The texture is re-uploaded only when `cell.key` changes and rebuilt when the cell's
 * size does. The caller places the quad: `sprite.position`, `sprite.quaternion` and `sprite.pixelSize` (the scene's
 * metres to one texel); the anchor is the cell's root texel.
 *
 * With `depth: true` the quad writes a depth per texel (a `StageView`'s: figures hide behind scene geometry and behind
 * each other texel by texel). Its fragment shader sets `gl_FragDepth` from a second, float texture of the camera-space
 * depth of every texel (`texelDepths`, set by `showDepths`) through the camera's own projection.
 */

/** The fragment shader bit of a depth-writing quad: reads the texel's depth along the view (metres) from the `cellDepth`
 * texture and writes the window depth the camera's projection gives it: with `depthProj = (perspective ? 1 : 0, P22,
 * P32, bias)` for the camera's projection P (its elements 10 and 14), `z_ndc = −P22 + P32 / d` (perspective) or `−P22 · d + P32` (orthographic),
 * window depth `z_ndc / 2 + 0.5` (OpenGL's clip space, the depth range its default). The depth is first moved `bias`
 * metres nearer (`TIE_BIAS` times the sprite's place in the frame, from 1: stage.ts), the rule `compose` tests with, so the
 * tie goes the same way on both sides whatever the camera's range; the depth test is `LESS`. WebGL only: under WebGPU this
 * bit adds nothing (see `StageView`). */
const cellDepthBit: ShaderBit = {
  name: 'cellDepth',
  textures: ['cellDepth'],
  bindings: { material: { depthProj: 'vec4<f32>' } },
  gl: { fragment: { material: `
  float cellD = sampleCellDepth(vUV).r - material.depthProj.w;
  float zNdc = material.depthProj.x > 0.5 ? (-material.depthProj.y + material.depthProj.z / cellD) : (-material.depthProj.y * cellD + material.depthProj.z);
  gl_FragDepth = zNdc * 0.5 + 0.5;
` } },
};

export class CellSprite {
  readonly sprite: Sprite3D;
  private colour: BufferImageSource | null = null;
  private depthSource: BufferImageSource | null = null;
  private material: FlatMaterial | null = null;
  private key = ''; private size = '';

  /** `depth`: write the per-texel depth (needs `showDepths` each frame). */
  constructor(private readonly depth = false) {
    this.sprite = depth
      ? new Sprite3D({ material: this.makeMaterial(Texture.EMPTY, Texture.EMPTY), billboardMode: 'none', label: 'CellSprite' })
      : new Sprite3D({ texture: Texture.EMPTY, billboardMode: 'none', alphaMode: 'mask', label: 'CellSprite' });
  }

  private makeMaterial(base: Texture, depth: Texture): FlatMaterial {
    return this.material = new FlatMaterial({ baseColorTexture: base, alphaMode: 'mask', extraBits: [cellDepthBit], textures: { cellDepth: depth } });
  }

  /** Shows `cell`: uploads its texels when they may have changed. The texture reads the cell's own buffer when the
   * renderer next draws, so render before the figure's next draw (`StageView` copies nothing and draws every frame). */
  show(cell: Cell): void {
    const [w, h] = cell.size, size = `${w}x${h}`;
    if (size !== this.size) {
      this.destroySources();
      this.colour = new BufferImageSource({ resource: new Uint8Array(w * h * 4), width: w, height: h, scaleMode: 'nearest', alphaMode: 'no-premultiply-alpha' });
      const tex = new Texture({ source: this.colour });
      if (this.depth) {
        this.depthSource = new BufferImageSource({ resource: new Float32Array(w * h), width: w, height: h, format: 'r32float', scaleMode: 'nearest' });
        this.material!.textures.cellDepth = new Texture({ source: this.depthSource });
      }
      this.sprite.texture = tex;
      this.size = size; this.key = '';
    }
    this.sprite.anchor = { x: cell.anchor[0] / w, y: cell.anchor[1] / h };
    if (cell.key === this.key) return;
    this.colour!.resource = new Uint8Array(cell.rgba.buffer, cell.rgba.byteOffset, cell.rgba.byteLength);
    this.colour!.update();
    this.key = cell.key;
  }

  /** Uploads the texels' camera-space depths (`texelDepths`, `Infinity` where empty) and the projection they are written
   * through: `perspective`, and the camera's projection matrix elements 10 and 14 (`Matrix4.elements`); `bias` is metres
   * to take off every depth (`(rank + 1) · TIE_BIAS`), which breaks a tie in the later sprite's favour. Call after `show`. */
  showDepths(depths: Float32Array, perspective: boolean, p22: number, p32: number, bias: number): void {
    if (!this.depth) throw new Error('CellSprite: not made with depth');
    this.depthSource!.resource = depths;
    this.depthSource!.update();
    this.material!.data.depthProj = [perspective ? 1 : 0, p22, p32, bias];
  }

  private destroySources(): void {
    if (!this.colour) return;
    if (this.depth) { this.material!.textures.baseColor!.destroy(true); this.material!.textures.cellDepth!.destroy(true); }
    else this.sprite.texture.destroy(true);
    this.colour = null; this.depthSource = null;
  }

  destroy(): void { this.sprite.destroy({ texture: !this.depth, textureSource: !this.depth }); this.destroySources(); this.material?.destroy(); }
}
