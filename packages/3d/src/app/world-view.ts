// Draws a level's world (features/world/build.ts) with `@pixi/3d`: one mesh per piece under a node, a swatch's colour on
// each, and the camera's occluder rule on the walls and the ceilings. It lives in `app/` because it reads the world's
// pieces and the renderer's occluders; the builder itself knows no renderer. Presentation only: the sim never reads it.
import { Box, Container3D, FlatMaterial, Geometry3D, Mesh3D, PhongMaterial, Vector3 } from '@pixi/3d'
import type { Occluders } from '../features/camera/occluders/occluders.ts'
import type { Look } from '../features/look/look.schema.ts'
import { markFloor, type TileImage, TileMaterial } from '../features/look/tile-material.ts'
import type { WorldPiece } from '../features/world/build.ts'
import type { WorldLamp } from '../features/world/place-props.ts'
import { tileName } from '../features/world/surface.ts'
import { uvMesh } from '../features/world/surface-uv.ts'
import type { LampState } from '../shared/level/piece-states.ts'
import type { SceneLight } from '../shared/render/light/scene-light.ts'
import type { Lamp } from '../shared/render/light/scene-lighting.schema.ts'

export interface WorldScene {
  /** Where the pieces are added. */
  readonly parent: Container3D
  /** Walls follow the wall rule and ceilings are never drawn in the angled view. Without it every piece just draws. */
  readonly occluders?: Occluders | undefined
  /** A swatch's colour (DUEL, `0xRRGGBB`). A name it does not know is drawn in `fallback`. */
  readonly colourOf: (swatch: string) => number | undefined
  /** Default: mid grey. */
  readonly fallback?: number | undefined
  /** With a look, every piece takes the tile material in place of plain Phong, under the look's haze and gain. */
  readonly look?: Look | undefined
  /** With a look, the tiles of a piece: a floor-like face's and a wall's, and whether it glows. None draws its swatch's colour. */
  readonly tiles?: ((piece: WorldPiece) => PieceTiles | undefined) | undefined
  /**
   * The room's light (`createPixi3dRenderer`'s `scene` hook gives it when `lighting` is set). A piece that never moves
   * (not a door, a prop or a swaying leaf) is drawn flat and has the light baked into its vertex colours, so a lamp's
   * level rebakes only what it reaches; the rest keeps its own material. It takes the place of `look`'s material on
   * the baked pieces.
   */
  readonly light?: SceneLight | undefined
}

/** The tiles a piece is drawn with, and whether its swatch is emissive (written as glowing and taking no light). */
export interface PieceTiles {
  readonly floor?: TileImage | undefined
  readonly wall?: TileImage | undefined
  readonly glowing?: boolean | undefined
}

export interface WorldView {
  /** Holds every piece's mesh. */
  readonly node: Container3D
  /** The pieces drawn, as the builder made them (a door's hinge, a prop's place), for the states that move them. */
  readonly pieces: readonly WorldPiece[]
  /** A piece's mesh by its id. */
  readonly mesh: (id: string) => Mesh3D | undefined
  /** Gives each piece the tiles `tiles` has for it now: one not given keeps the tile it shows, so a tile still being made leaves the old one up. */
  retile(tiles: (piece: WorldPiece) => PieceTiles | undefined): void
  /** Where the haze begins: the view depth (metres) of what the camera looks at. A no-op without a look. */
  setFocus(depth: number): void
  /** Takes the meshes down and frees their geometry and materials. */
  dispose(): void
}

const MISSING = 0x808080

/** A mesh's geometry from its arrays, and the box the engine culls it by. */
function geometryOf(
  positions: readonly number[],
  normals: readonly number[],
  indices: readonly number[],
  uvs?: readonly number[],
): Geometry3D {
  const low = [Infinity, Infinity, Infinity] as [number, number, number]
  const high = [-Infinity, -Infinity, -Infinity] as [number, number, number]
  for (let i = 0; i < positions.length; i += 3)
    for (let axis = 0; axis < 3; axis++) {
      low[axis] = Math.min(low[axis] as number, positions[i + axis] as number)
      high[axis] = Math.max(high[axis] as number, positions[i + axis] as number)
    }
  return new Geometry3D({
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    ...(uvs === undefined ? {} : { uvs: new Float32Array(uvs) }),
    indices: new Uint32Array(indices),
    bounds3D: new Box(new Vector3(...low), new Vector3(...high)),
  })
}

/** The mesh of a piece: its geometry from the piece's arrays, in the swatch's colour, with a material of its own. */
function meshOf(piece: WorldPiece, colour: number): Mesh3D {
  const { positions, normals, indices } = piece.mesh
  return new Mesh3D({
    geometry: geometryOf(positions, normals, indices),
    material: new PhongMaterial({ baseColor: colour }),
  })
}

/** A piece drawn as the look paints it: its tiles laid on its metres, each vertex told whether it is floor-like. */
function tiledMeshOf(
  piece: WorldPiece,
  colour: number,
  look: Look,
  tiles: PieceTiles | undefined,
): { mesh: Mesh3D; floor: readonly number[] } {
  const uv = uvMesh(piece.mesh, piece.tex?.frame)
  const geometry = geometryOf(uv.positions, uv.normals, uv.indices, uv.uvs)
  markFloor(geometry, uv.floor)
  const material = new TileMaterial({
    colour,
    floor: tiles?.floor,
    wall: tiles?.wall,
    glowing: tiles?.glowing,
    place: {
      repeat: piece.tex?.repeat,
      pan: piece.tex?.pan,
      anchored: piece.tex?.frame !== undefined,
    },
    haze: look.haze,
    gain: look.light.gain,
  })
  return { mesh: new Mesh3D({ geometry, material }), floor: uv.floor }
}

/** A piece a state can move (a door, a prop, a leaf in the wind) cannot hold baked light. */
const stays = (piece: WorldPiece): boolean =>
  piece.door === undefined && piece.prop === undefined && piece.sway === undefined

/** Draws `pieces` into `scene.parent`. */
export function drawWorld(scene: WorldScene, pieces: readonly WorldPiece[]): WorldView {
  const node = new Container3D()
  scene.parent.addChild(node)
  const meshes = new Map<string, Mesh3D>()
  for (const piece of pieces) {
    const colour = scene.colourOf(tileName(piece.surface)) ?? scene.fallback ?? MISSING
    const tiled =
      scene.look === undefined ? undefined : tiledMeshOf(piece, colour, scene.look, scene.tiles?.(piece))
    const mesh = tiled?.mesh ?? meshOf(piece, colour)
    node.addChild(mesh)
    meshes.set(piece.id, mesh)
    if (tiled !== undefined) {
      // Under a look every piece holds its light as vertex colours, a mover's from where it stands at rest: the tile
      // material reads no other light.
      if (scene.light !== undefined) {
        scene.light.bake(mesh)
        // The bake makes a new geometry that keeps positions, normals, UVs and indices; the floor flags go back on.
        markFloor(mesh.geometry, tiled.floor)
      }
    } else if (scene.light !== undefined && stays(piece)) {
      // Baked after it is placed under the node, so the light sees where it stands.
      mesh.material = new FlatMaterial({ baseColor: colour })
      scene.light.bake(mesh)
    }
    if (scene.occluders === undefined) continue
    if (piece.part === 'ceiling') scene.occluders.ceiling(mesh)
    else if (piece.part === 'wall' && piece.line !== undefined) {
      // The face’s height: the highest point of its mesh, from the floor at 0. A face that never rises above it (the
      // side of a pit) can hide nobody and follows no rule.
      let height = 0
      for (let i = 1; i < piece.mesh.positions.length; i += 3)
        height = Math.max(height, piece.mesh.positions[i] as number)
      if (height <= 0) continue
      const { a, b } = piece.line
      scene.occluders.face(mesh, { a: { x: a[0], z: a[1] }, b: { x: b[0], z: b[1] }, height }, piece.occlude)
    }
  }
  return {
    node,
    pieces,
    mesh: (id) => meshes.get(id),
    retile(tiles) {
      for (const piece of pieces) {
        const material = meshes.get(piece.id)?.material
        const next = tiles(piece)
        if (!(material instanceof TileMaterial) || next === undefined) continue
        material.setTiles(next.floor ?? material.floorTile, next.wall ?? material.wallTile)
      }
    },
    setFocus(depth) {
      for (const mesh of meshes.values())
        if (mesh.material instanceof TileMaterial) mesh.material.focus = depth
    },
    dispose() {
      for (const mesh of meshes.values()) mesh.destroy({ children: true })
      meshes.clear()
      node.destroy()
    },
  }
}

/**
 * The world's lamps as the scene light's: a lamp of the kit gives its colour, its reach and its level, at its place.
 * A lamp only a night lights (a street lamp on its photocell) is left out by day. A lamp's state (`PieceStates.lamps`)
 * scales its level and may change its colour.
 */
export function sceneLamps(
  lamps: readonly WorldLamp[],
  night = true,
  states: Readonly<Record<string, LampState>> = {},
): Lamp[] {
  return lamps
    .filter((lamp) => night || !lamp.dusk)
    .map((lamp) => {
      const state = states[lamp.id]
      return {
        id: lamp.id,
        x: lamp.at[0],
        y: lamp.at[1],
        z: lamp.at[2],
        color: state?.color ?? lamp.color,
        strength: 1,
        range: lamp.range,
        level: lamp.level * (state?.level ?? 1),
        ...(lamp.aim === undefined || lamp.cone === undefined ? {} : { aim: lamp.aim, cone: lamp.cone }),
      }
    })
}
