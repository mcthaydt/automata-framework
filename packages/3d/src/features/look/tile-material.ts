// The material a piece of the world is drawn with when the look paints it: a photo's tile read texel by texel, times the
// light baked into the piece's vertex colours, hazed by how far it is past the focus, and written as it is, for the snap pass
// to take to DUEL (`worldTexel` is the same rule on the CPU). It works on the tile's bytes and the light as drawn (sRGB, 0 to
// 1 and over), not through the engine's linear lighting, so it asks for neither lighting nor tone mapping and is not fogged
// by the view: the haze is its own. A floor-like face reads the floor's tile and a wall the wall's, picked by an attribute
// the mesh carries, as the tiles are laid in the surface's own metres (`surface-uv.ts`). WGSL and GLSL twins.

import type { Geometry3D } from '@pixi/3d'
import { BaseMaterial3D, type BaseMaterial3DOptions, type ShaderBit, uvTransformBit } from '@pixi/3d'
import { Buffer, BufferImageSource, BufferUsage, Texture } from 'pixi.js'
import { ALPHA } from '../../shared/render/alpha/alpha-codes.ts'
import type { Haze } from '../../shared/render/texel.ts'
import { rgb01 } from '../../shared/render/texel.ts'

type V3 = readonly [number, number, number]

/** A tile as the material reads it: its palette colours as RGBA bytes, the texels a metre it was made at, and the texel the
 * surface's seed starts it at (the photo feature's `TileImage` is one). */
export interface TileImage {
  readonly width: number
  readonly height: number
  readonly rgba: Uint8Array
  readonly texels: readonly [number, number]
  readonly offset: readonly [number, number]
}

/** How the surface places its tile: spread over `repeat` metres, moved by `pan` metres, starting at the origin when anchored. */
export interface TilePlace {
  readonly repeat?: readonly [number, number] | undefined
  readonly pan?: readonly [number, number] | undefined
  readonly anchored?: boolean | undefined
}

/** The mesh attribute that says a vertex is floor-like (1) or a wall's (0). */
export const TILE_FLOOR_ATTRIBUTE = 'aTileFloor'

/** Gives a mesh's geometry the per-vertex floor flags (`1` floor-like, `0` a wall) its tile material reads. */
export function markFloor(geometry: Geometry3D, floor: readonly number[]): void {
  geometry.addAttribute(TILE_FLOOR_ATTRIBUTE, {
    buffer: new Buffer({
      data: Float32Array.from(floor),
      label: 'attribute-mesh-tilefloor',
      usage: BufferUsage.VERTEX | BufferUsage.COPY_DST,
    }),
    format: 'float32',
    stride: 4,
    offset: 0,
  })
}

/** Half a hair into a texel, so a texel edge that lands exactly on a pixel's centre does not flicker between two. */
const EDGE = 0.001

// What both shaders compute. The surface's metres `m` become a tile cell (`floor(m × scale) + shift`, a wall's rows running
// down it), wrapped to the tile's size; the cell's colour times the light (`albedo` arrives as the vertex colour times a
// white base) times the gain is clamped to 1, hazed toward the veil by the share the view depth gives, and divided by the
// piece's alpha code, since the template multiplies the colour by alpha again.
const gl = (code: string, light: string): string => `
  alpha *= material.baseColor.a;
  bool isFloor = vTileFloor > 0.5;
  vec2 scale = isFloor ? material.floorScale : material.wallScale;
  vec2 shift = isFloor ? material.floorShift : material.wallShift;
  vec2 size = isFloor ? material.floorSize : material.wallSize;
  vec2 cell = vec2(floor(vUV.x * scale.x + ${EDGE}) + shift.x, (isFloor ? 1.0 : -1.0) * floor(vUV.y * scale.y + ${EDGE}) + shift.y);
  cell = mod(cell, size);
  vec2 at = (cell + 0.5) / size;
  vec3 floorTexel = sampleFloorTile(at).rgb;
  vec3 wallTexel = sampleWallTile(at).rgb;
  bool hasTile = isFloor ? material.tiles.x > 0.5 : material.tiles.y > 0.5;
  vec3 texel = hasTile ? (isFloor ? floorTexel : wallTexel) : material.flatColour;
  vec3 light = ${light};
  vec3 colour = min(vec3(1.0), texel * light * material.tiles.w);
  float behind = max(0.0, vTileDepth - material.tiles.z);
  float share = clamp((behind - material.haze.x) / (material.haze.y - material.haze.x), 0.0, 1.0) * material.haze.z;
  vec3 veil = min(vec3(1.0), material.hazeColour + material.haze.w * light);
  colour = mix(colour, veil, share);
  albedo = colour / ${code};
  alpha *= ${code};
`

const gpu = (code: string, light: string): string => `
  alpha *= material.baseColor.a;
  let isFloor = input.vTileFloor > 0.5;
  let scale = select(material.wallScale, material.floorScale, isFloor);
  let shift = select(material.wallShift, material.floorShift, isFloor);
  let size = select(material.wallSize, material.floorSize, isFloor);
  var cell = vec2<f32>(floor(input.vUV.x * scale.x + ${EDGE}) + shift.x, select(-1.0, 1.0, isFloor) * floor(input.vUV.y * scale.y + ${EDGE}) + shift.y);
  cell = cell - size * floor(cell / size);
  let at = (cell + 0.5) / size;
  let floorTexel = sampleFloorTile(at).rgb;
  let wallTexel = sampleWallTile(at).rgb;
  let hasTile = select(material.tiles.y > 0.5, material.tiles.x > 0.5, isFloor);
  let texel = select(material.flatColour, select(wallTexel, floorTexel, isFloor), hasTile);
  let light = ${light};
  var colour = min(vec3<f32>(1.0), texel * light * material.tiles.w);
  let behind = max(0.0, input.vTileDepth - material.tiles.z);
  let share = clamp((behind - material.haze.x) / (material.haze.y - material.haze.x), 0.0, 1.0) * material.haze.z;
  let veil = min(vec3<f32>(1.0), material.hazeColour + material.haze.w * light);
  colour = mix(colour, veil, share);
  albedo = colour / ${code};
  alpha *= ${code};
`

/**
 * The shader of a piece that writes `code` as its alpha (world, or glowing), lit by its vertex colours or, when it glows, by
 * nothing. In `blend` mode the alpha is the fade and the code leaves it as it is.
 */
function tileBit(code: number, lit: boolean): ShaderBit {
  const written = code.toFixed(6)
  return {
    name: `afTile${Math.round(code * 255)}`,
    attributes: { [TILE_FLOOR_ATTRIBUTE]: 'float32' },
    interStage: { vTileFloor: 'f32', vTileDepth: 'f32' },
    textures: ['floorTile', 'wallTile'],
    bindings: {
      material: {
        floorScale: 'vec2<f32>',
        floorShift: 'vec2<f32>',
        floorSize: 'vec2<f32>',
        wallScale: 'vec2<f32>',
        wallShift: 'vec2<f32>',
        wallSize: 'vec2<f32>',
        flatColour: 'vec3<f32>',
        hazeColour: 'vec3<f32>',
        /** near, far, amount, glow. */
        haze: 'vec4<f32>',
        /** a floor tile is set, a wall tile is set, the focus depth, the gain. */
        tiles: 'vec4<f32>',
        /** The base colour: white, its alpha the piece's fade. */
        baseColor: 'vec4<f32>',
        alphaCutoff: 'f32',
      },
    },
    gpu: {
      vertex: {
        afterTransform: 'output.vTileDepth = -(camera.uViewMatrix * worldPosition).z;',
        end: `output.vTileFloor = input.${TILE_FLOOR_ATTRIBUTE};`,
      },
      fragment: { material: gpu(written, lit ? 'albedo' : 'vec3<f32>(1.0)') },
    },
    gl: {
      vertex: {
        afterTransform: 'vTileDepth = -(uViewMatrix * worldPosition).z;',
        end: `vTileFloor = ${TILE_FLOOR_ATTRIBUTE};`,
      },
      fragment: { material: gl(written, lit ? 'albedo' : 'vec3(1.0)') },
    },
  }
}

const BITS = { world: tileBit(ALPHA.world, true), glowing: tileBit(ALPHA.glowing, false) } as const

/** A tile as a texture: its bytes as they are, nearest, wrapped. */
function textureOf(tile: TileImage): Texture {
  const source = new BufferImageSource({
    resource: tile.rgba,
    width: tile.width,
    height: tile.height,
    format: 'rgba8unorm',
    alphaMode: 'no-premultiply-alpha',
    scaleMode: 'nearest',
    addressMode: 'repeat',
    autoGenerateMipmaps: false,
  })
  return new Texture({ source })
}

export interface TileMaterialOptions
  extends Omit<BaseMaterial3DOptions, 'baseColor' | 'baseColorTexture' | 'fog'> {
  /** The swatch's own colour (`0xRRGGBB`), drawn where the surface has no tile. */
  readonly colour: number
  /** The tile of a floor-like face and of a wall, each with how the surface places it. */
  readonly floor?: TileImage | undefined
  readonly wall?: TileImage | undefined
  readonly place?: TilePlace | undefined
  /** An emissive swatch writes the glowing code and is not lit. */
  readonly glowing?: boolean | undefined
  readonly haze: Haze
  readonly gain: number
}

/** The cell shift, scale and size of one tile as the surface places it (`tileTexel`'s arithmetic, folded to a few numbers). */
function placement(
  tile: TileImage | undefined,
  place: TilePlace | undefined,
  down: boolean,
): { scale: [number, number]; shift: [number, number]; size: [number, number] } {
  if (tile === undefined) return { scale: [1, 1], shift: [0, 0], size: [1, 1] }
  const [r0, r1] = place?.repeat ?? [1, 1]
  const [p0, p1] = place?.pan ?? [0, 0]
  const [lu, lv] = tile.texels
  const du = Math.round((p0 / r0) * lu)
  const dv = Math.round((p1 / r1) * lv)
  const [ox, oy] = place?.anchored === true ? [0, 0] : tile.offset
  return {
    scale: [lu / r0, lv / r1],
    shift: [ox - du, down ? oy + dv - 1 : oy - dv],
    size: [tile.width, tile.height],
  }
}

export class TileMaterial extends BaseMaterial3D {
  /** The engine's lighting and tone mapping play no part: the light is baked, and the snap pass is the grade. */
  override toneMapped = false
  override lit = false
  readonly glowing: boolean
  private readonly place: TilePlace | undefined
  private readonly colour: V3
  private readonly gain: number
  private depth = 0
  private floor: TileImage | undefined
  private wall: TileImage | undefined
  private readonly owned: { floorTile?: Texture | undefined; wallTile?: Texture | undefined } = {}

  constructor(options: TileMaterialOptions) {
    const { colour, floor, wall, place, glowing, haze, gain, ...rest } = options
    const bit = glowing === true ? BITS.glowing : BITS.world
    super({
      ...rest,
      baseColor: 0xffffff,
      fog: false,
      textures: { floorTile: undefined, wallTile: undefined },
      descriptor: { bitsGpu: [bit, uvTransformBit], bitsGl: [bit, uvTransformBit] },
    })
    this.glowing = glowing === true
    this.place = place
    this.colour = rgb01(`#${colour.toString(16).padStart(6, '0')}`)
    const veil = rgb01(haze.colour)
    this.data.flatColour = this.colour
    this.data.hazeColour = veil
    this.data.haze = [haze.near, haze.far, haze.amount, haze.glow]
    this.gain = gain
    this.setTiles(floor, wall)
  }

  get focus(): number {
    return this.depth
  }

  /** The focus: the view depth (metres) past which the haze begins. */
  set focus(depth: number) {
    this.depth = depth
    this.writeTiles()
  }

  private writeTiles(): void {
    this.data.tiles = [
      this.floor === undefined ? 0 : 1,
      this.wall === undefined ? 0 : 1,
      this.depth,
      this.gain,
    ]
  }

  /** The floor-like tile now drawn, and the wall's. */
  get floorTile(): TileImage | undefined {
    return this.floor
  }

  get wallTile(): TileImage | undefined {
    return this.wall
  }

  /** The tiles drawn from now: a floor-like face's and a wall's. A tile not given draws the swatch's colour; one already drawn is kept as it is. */
  setTiles(floor: TileImage | undefined, wall: TileImage | undefined): void {
    if (floor !== this.floor) this.put('floorTile', floor)
    if (wall !== this.wall) this.put('wallTile', wall)
    this.floor = floor
    this.wall = wall
    const f = placement(floor, this.place, false)
    const w = placement(wall, this.place, true)
    this.data.floorScale = f.scale
    this.data.floorShift = f.shift
    this.data.floorSize = f.size
    this.data.wallScale = w.scale
    this.data.wallShift = w.shift
    this.data.wallSize = w.size
    this.writeTiles()
  }

  private put(slot: 'floorTile' | 'wallTile', tile: TileImage | undefined): void {
    this.owned[slot]?.destroy(true)
    this.owned[slot] = undefined
    if (tile === undefined) return
    const texture = textureOf(tile)
    this.owned[slot] = texture
    this.textures[slot] = texture
  }

  override destroy(options?: Parameters<BaseMaterial3D['destroy']>[0]): void {
    this.owned.floorTile?.destroy(true)
    this.owned.wallTile?.destroy(true)
    super.destroy(options)
  }
}
