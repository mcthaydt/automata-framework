// Draws a level's world (features/world/build.ts) with `@pixi/3d`: one mesh per piece under a node, a swatch's colour on
// each, and the camera's occluder rule on the walls and the ceilings. It lives in `app/` because it reads the world's
// pieces and the renderer's occluders; the builder itself knows no renderer. Presentation only: the sim never reads it.
import { ModelInvalid } from '@automata/framework'
import { Box, Container3D, FlatMaterial, Geometry3D, Mesh3D, PhongMaterial, Vector3 } from '@pixi/3d'
import { BufferImageSource, Texture } from 'pixi.js'
import { type Box3, propOcclude, type WallSpan } from '../features/camera/occluders/occluder-rule.ts'
import type { Occluders } from '../features/camera/occluders/occluders.ts'
import type { Look } from '../features/look/look.schema.ts'
import { RampMaterial } from '../features/look/ramp-light-material.ts'
import { type GlowSwatch, lampsOfProp } from '../features/world/albedo/glow.ts'
import { windowTile } from '../features/world/albedo/interior.ts'
import { ladderOf } from '../features/world/albedo/ladder.ts'
import { type AlbedoTile, tileUvs } from '../features/world/albedo/place.ts'
import type { WorldPiece, WorldProp } from '../features/world/build.ts'
import { fitModel, fitPoint } from '../features/world/model-fit.ts'
import type { WorldLamp } from '../features/world/place-props.ts'
import { tileName } from '../features/world/surface.ts'
import type { Occlude } from '../shared/level/occlude.ts'
import type { LampState } from '../shared/level/piece-states.ts'
import type { SceneLight } from '../shared/render/light/scene-light.ts'
import type { Lamp } from '../shared/render/light/scene-lighting.schema.ts'
import { toSrgb } from '../shared/render/light/vertex-light.ts'
import type { LoadedModel, ModelLibrary } from '../shared/render/model/load-models.ts'

export interface WorldScene {
  /** Where the pieces are added. */
  readonly parent: Container3D
  /** Walls follow the wall rule and ceilings are never drawn in the angled view. Without it every piece just draws. */
  readonly occluders?: Occluders | undefined
  /** A swatch's colour (DUEL, `0xRRGGBB`). A name it does not know is drawn in `fallback`. */
  readonly colourOf: (swatch: string) => number | undefined
  /** Default: mid grey. */
  readonly fallback?: number | undefined
  /** With a look, every piece takes the stepped-light material (the look's `steps`) in place of plain Phong. */
  readonly look?: Look | undefined
  /**
   * A swatch's photo tile (DUEL colours a texel), by swatch name: a piece whose surface has one is drawn with it,
   * nearest-sampled, placed as the surface says (repeat, pan, turn, and the wall's, the world's or the prop's frame), in
   * place of the swatch's flat colour. The light multiplies the texel, so a lit texel is albedo × light.
   */
  readonly tiles?: ((swatch: string) => AlbedoTile | undefined) | undefined
  /**
   * A swatch's glow: a bulb, a neon, a lit window (`emit` in the library) gives its ladder. A piece of such a swatch is
   * drawn at its own step whatever the light, and dims, a step or two, with the lamps of its prop.
   */
  readonly glow?: ((swatch: string) => GlowSwatch | undefined) | undefined
  /**
   * The room's light (`createPixi3dRenderer`'s `scene` hook gives it when `lighting` is set). A piece that never moves
   * (not a door, a prop or a swaying leaf) is drawn flat and has the light baked into its vertex colours, so a lamp's
   * level rebakes only what it reaches; the rest keeps its own material. It takes the place of `look`'s material on
   * the baked pieces.
   */
  readonly light?: SceneLight | undefined
}

/** What `drawWorld` draws beside the pieces: the props that name a model, and the models the game loaded. */
export interface DrawWorldOptions {
  /** The world's props (`World.props`): each that names a model is drawn as that model in place of its blockout's pieces. */
  readonly props?: readonly WorldProp[] | undefined
  /** The loaded models (the renderer's `scene` hook gives them). A prop that names one that is not here fails with its file's name. */
  readonly models?: ModelLibrary | undefined
  /** Draws every prop's generated blockout and no model: for a game's blockout view while it is made, never a shipped build's fallback. */
  readonly blockout?: boolean | undefined
}

/** A prop drawn as a model: its mesh's id in `WorldView.mesh` (`model:<prop id>`) and the prop it stands for. */
export interface ModelledProp {
  readonly id: string
  readonly prop: WorldProp
}

export interface WorldView {
  /** Holds every piece's mesh. */
  readonly node: Container3D
  /**
   * The pieces drawn, as the builder made them (a door's hinge, a prop's place), for the states that move them. A prop drawn
   * as a model keeps its generated pieces here (the blockout: its footprint and its collider) but they have no mesh.
   */
  readonly pieces: readonly WorldPiece[]
  /** The props drawn as a model in place of their blockout, with the id of each model's mesh. */
  readonly models: readonly ModelledProp[]
  /** A piece's mesh by its id. */
  readonly mesh: (id: string) => Mesh3D | undefined
  /**
   * Takes the baked light of a piece again where its mesh now stands: call it after a state has moved a prop. A piece
   * with no baked light (a door, a leaf, or any piece in a room with no `light`) is left alone.
   */
  relight(id: string): void
  /**
   * Draws only the pieces of these rooms (sector ids); `undefined` draws every room. `@pixi/3d` hides a node and its
   * descendants together and has no other flag, so the first call moves each room's meshes under a node of their own (an
   * identity transform, so nothing moves and the baked light stays true) and hiding a room hides that node. A mesh's own
   * `visible` is left to the occluder rule and a prop's state, so a wall the rule hid stays hidden in a room that is shown.
   * A world never asked to show rooms keeps its meshes directly under `node`. Baked light is unaffected: a hidden room
   * still lights the rooms beside it.
   */
  showRooms(rooms: ReadonlySet<string> | undefined): void
  /** Takes the meshes down and frees their geometry and materials. */
  dispose(): void
}

const MISSING = 0x808080

const textures = new WeakMap<AlbedoTile, Texture>()
const plainTextures = new WeakMap<AlbedoTile, Texture>()

/**
 * A tile as a texture: nearest-sampled, repeating, no mips, so every texel stays one DUEL colour. A lit material wants the
 * sRGB format (the sampler decodes it, the view's encode brings it back); an unlit one is not encoded, so it shows the
 * texture as the sampler gives it, and wants the plain format (`plain`), which gives each texel as it is.
 */
function textureOf(tile: AlbedoTile, plain = false): Texture {
  const made = plain ? plainTextures : textures
  let texture = made.get(tile)
  if (texture === undefined) {
    texture = new Texture({
      source: new BufferImageSource({
        resource: tile.rgba,
        width: tile.width,
        height: tile.height,
        format: plain ? 'rgba8unorm' : 'rgba8unorm-srgb',
        scaleMode: 'nearest',
        addressMode: 'repeat',
        autoGenerateMipmaps: false,
      }),
    })
    made.set(tile, texture)
  }
  return texture
}

/**
 * A colour for an unlit material to show as it is. The material takes its base colour as sRGB, decodes it and does not
 * encode it again, so the colour to give is the one whose decoded value is the colour wanted.
 */
const shownAs = (colour: number): [number, number, number] => [
  toSrgb(((colour >> 16) & 255) / 255),
  toSrgb(((colour >> 8) & 255) / 255),
  toSrgb((colour & 255) / 255),
]

/** The mesh of a piece: its geometry from the piece's arrays, in the swatch's colour (or its tile), with a material of its own. */
function meshOf(
  piece: WorldPiece,
  colour: number,
  look: Look | undefined,
  tile?: AlbedoTile,
  uvs?: Float32Array,
): Mesh3D {
  const { positions, normals, indices } = piece.mesh
  const low = [Infinity, Infinity, Infinity] as [number, number, number]
  const high = [-Infinity, -Infinity, -Infinity] as [number, number, number]
  for (let i = 0; i < positions.length; i += 3)
    for (let axis = 0; axis < 3; axis++) {
      low[axis] = Math.min(low[axis] as number, positions[i + axis] as number)
      high[axis] = Math.max(high[axis] as number, positions[i + axis] as number)
    }
  const geometry = new Geometry3D({
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    indices: new Uint32Array(indices),
    ...(tile === undefined
      ? {}
      : { uvs: uvs ?? tileUvs(piece.mesh, tile, piece.tex, piece.tex?.frame !== undefined) }),
    bounds3D: new Box(new Vector3(...low), new Vector3(...high)),
  })
  const base =
    tile === undefined ? { baseColor: colour } : { baseColor: 0xffffff, baseColorTexture: textureOf(tile) }
  const material =
    look === undefined ? new PhongMaterial(base) : new RampMaterial({ ...base, steps: look.steps })
  return new Mesh3D({ geometry, material })
}

/**
 * A piece that can hold baked light: not a door, which turns about its hinge, nor a leaf that sways. A prop can: a state
 * that moves it has its light taken again (`WorldView.relight`).
 */
const stays = (piece: WorldPiece): boolean => piece.door === undefined && piece.sway === undefined

/**
 * A wall face's line on the plan and the heights it spans, for the occluder rule: from the lowest point of its mesh (a bulkhead
 * over a portal starts at the lower ceiling, so a line through the opening under it keeps it) to the highest. A face that never
 * rises above the floor at 0 (the side of a pit) can hide nobody and follows no rule.
 */
function wallSpan(piece: WorldPiece): WallSpan | undefined {
  if (piece.line === undefined) return undefined
  let base = Infinity
  let height = 0
  for (let i = 1; i < piece.mesh.positions.length; i += 3) {
    base = Math.min(base, piece.mesh.positions[i] as number)
    height = Math.max(height, piece.mesh.positions[i] as number)
  }
  if (height <= 0) return undefined
  const { a, b } = piece.line
  return { a: { x: a[0], z: a[1] }, b: { x: b[0], z: b[1] }, ...(base > 0 ? { base } : {}), height }
}

/** Registers `mesh` as a prop with the occluder rule, unless the rule would never take it away (it keeps its material then). */
function registerProp(occluders: Occluders, mesh: Mesh3D, bounds: Box3, occlude?: Occlude): void {
  if (propOcclude(bounds, occlude) !== 'never') occluders.prop(mesh, { bounds, occlude })
}

/** A mesh's bounds in world metres (the pieces are built in world space), for the occluder rule's props. */
function boundsOfMesh(positions: ArrayLike<number>): Box3 {
  const min: [number, number, number] = [Infinity, Infinity, Infinity]
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity]
  for (let i = 0; i < positions.length; i++) {
    const axis = i % 3
    min[axis] = Math.min(min[axis] as number, positions[i] as number)
    max[axis] = Math.max(max[axis] as number, positions[i] as number)
  }
  return { min, max }
}

/**
 * A prop's model as a mesh of its own, in world space like a piece: the model's vertices moved by the fit of its box to the
 * prop's blockout (`fitModel`), so the mesh stands where the blockout stood and takes the model's material.
 */
function modelMesh(prop: WorldProp, model: LoadedModel): Mesh3D {
  const { mesh } = model
  const fit = fitModel({ min: prop.min, max: prop.max, turn: prop.turn }, mesh, prop.fit)
  const positions = new Float32Array(mesh.positions.length)
  const normals = new Float32Array(mesh.normals.length)
  const low = [Infinity, Infinity, Infinity] as [number, number, number]
  const high = [-Infinity, -Infinity, -Infinity] as [number, number, number]
  const c = Math.cos((fit.turn * Math.PI) / 180)
  const s = Math.sin((fit.turn * Math.PI) / 180)
  for (let i = 0; i < mesh.positions.length; i += 3) {
    const moved = fitPoint(fit, [
      mesh.positions[i] as number,
      mesh.positions[i + 1] as number,
      mesh.positions[i + 2] as number,
    ])
    const [nx, ny, nz] = [
      mesh.normals[i] as number,
      mesh.normals[i + 1] as number,
      mesh.normals[i + 2] as number,
    ]
    for (const axis of [0, 1, 2] as const) {
      positions[i + axis] = moved[axis]
      low[axis] = Math.min(low[axis], moved[axis])
      high[axis] = Math.max(high[axis], moved[axis])
    }
    normals[i] = c * nx + s * nz
    normals[i + 1] = ny
    normals[i + 2] = -s * nx + c * nz
  }
  const geometry = new Geometry3D({
    positions,
    normals,
    uvs: new Float32Array(mesh.uvs),
    indices: Uint32Array.from(mesh.indices),
    bounds3D: new Box(new Vector3(...low), new Vector3(...high)),
  })
  return new Mesh3D({ geometry, material: model.material })
}

/** Draws `pieces` into `scene.parent`, and the props that name a model as that model in place of their pieces. */
export function drawWorld(
  scene: WorldScene,
  pieces: readonly WorldPiece[],
  options: DrawWorldOptions = {},
): WorldView {
  const node = new Container3D()
  scene.parent.addChild(node)
  const meshes = new Map<string, Mesh3D>()
  // A prop that names a model draws it and not its blockout; one that names a model nobody loaded is a game's bug, told with the
  // file's name, because a shipped build must never quietly show the blockout.
  const replaced = new Set<string>()
  const drawn: { id: string; prop: WorldProp; model: LoadedModel }[] = []
  if (options.blockout !== true)
    for (const prop of options.props ?? []) {
      if (prop.model === undefined) continue
      const model = options.models?.get(prop.model)
      if (model === undefined)
        throw new ModelInvalid({
          file: prop.model,
          reason: `not loaded, and the prop "${prop.id}" names it (list the level's models in the renderer: modelsOf(level))`,
        })
      replaced.add(prop.id)
      drawn.push({ id: `model:${prop.id}`, prop, model })
    }
  // The wall pieces by id, for what hangs on them.
  const walls = new Map(pieces.filter((piece) => piece.part === 'wall').map((piece) => [piece.id, piece]))
  // The room nodes `showRooms` makes the first time it is asked, by sector.
  let groups: Map<string, Container3D> | undefined
  for (const piece of pieces) {
    if (piece.prop !== undefined && replaced.has(piece.prop.id)) continue
    const colour = scene.colourOf(tileName(piece.surface)) ?? scene.fallback ?? MISSING
    const glows = scene.glow?.(tileName(piece.surface))
    // A lit window is its room: a tile laid across the glass, drawn as it is whatever the light.
    const room = glows?.interior === true ? windowTile(piece.mesh, ladderOf(glows)) : undefined
    const tile = room?.tile ?? scene.tiles?.(tileName(piece.surface))
    const mesh = meshOf(piece, colour, scene.look, tile, room?.uvs)
    node.addChild(mesh)
    meshes.set(piece.id, mesh)
    if (room !== undefined) {
      mesh.material = new FlatMaterial({ baseColor: 0xffffff, baseColorTexture: textureOf(room.tile, true) })
    } else if (glows !== undefined) {
      // A glow takes no light, so a moving piece may carry it baked: where it goes does not change what it shows.
      const ladder = ladderOf(glows)
      if (scene.light === undefined)
        mesh.material = new FlatMaterial({ baseColor: shownAs(ladder.steps[ladder.base] ?? colour) })
      else {
        mesh.material = new FlatMaterial({ baseColor: 0xffffff })
        const lamps = piece.prop === undefined ? [] : lampsOfProp(scene.light.lighting.lamps, piece.prop.id)
        scene.light.bake(mesh, { glow: { steps: ladder.steps, base: ladder.base, lamps } })
      }
    } else if (scene.light !== undefined && stays(piece)) {
      // Baked after it is placed under the node, so the light sees where it stands. A prop's own box never shadows it.
      const ignore = piece.part === 'prop' ? [piece.id] : []
      // A room's `light` is 1 when normal; each 1 less is a whole step darker.
      if (tile === undefined) {
        mesh.material = new FlatMaterial({ baseColor: 0xffffff })
        scene.light.bake(mesh, { albedo: colour, shadeSteps: 1 - piece.light, ignore })
      } else {
        mesh.material = new FlatMaterial({ baseColor: 0xffffff, baseColorTexture: textureOf(tile, true) })
        // A texture's colours are not known here, so the swatch's own colour stands for them in `SceneLight.groundLuma` (the bake
        // writes the light alone, as the texture multiplies it).
        scene.light.bake(mesh, { textured: true, albedo: colour, shadeSteps: 1 - piece.light, ignore })
      }
    }
    if (scene.occluders === undefined) continue
    if (piece.part === 'ceiling') scene.occluders.ceiling(mesh)
    else if (piece.part === 'wall') {
      const span = wallSpan(piece)
      if (span !== undefined) scene.occluders.face(mesh, span, piece.occlude)
    } else if (piece.onWall !== undefined) {
      // Hung on a wall: it follows that wall's rule and span, so the wall takes it away and brings it back (a thin box's
      // back would otherwise draw behind a culled wall as a flat slab).
      const wall = walls.get(piece.onWall)
      const span = wall === undefined ? undefined : wallSpan(wall)
      if (span !== undefined) scene.occluders.face(mesh, span, piece.occlude ?? wall?.occlude)
    } else if (piece.part === 'prop' && piece.door === undefined)
      // A prop standing free or hanging from the ceiling: it fades when it stands on the line to the figure, if it is tall or
      // hangs (`propOcclude`); a door turns about its hinge, so the bounds it was built with are not where it stands.
      registerProp(scene.occluders, mesh, boundsOfMesh(piece.mesh.positions), piece.occlude)
  }
  for (const { id, prop, model } of drawn) {
    const mesh = modelMesh(prop, model)
    node.addChild(mesh)
    meshes.set(id, mesh)
    // In a lit room a model takes the room's light as a tiled piece does: an unlit material on the model's own texture, the baked
    // light alone in its vertices, so the screen shows texel x light (the shared Phong material stays for a scene with no baked
    // light). Its blockout stands for it: the same room shade, its own pieces never shadowing it, its swatch the albedo the floor
    // probe reads (the texture's colours stay the model's own; the bake never touches them).
    const blockout = pieces.filter((piece) => piece.prop?.id === prop.id)
    if (scene.light !== undefined) {
      mesh.material = new FlatMaterial({ baseColor: 0xffffff, baseColorTexture: model.texture })
      const first = blockout[0]
      const albedo =
        first === undefined ? MISSING : (scene.colourOf(tileName(first.surface)) ?? scene.fallback ?? MISSING)
      scene.light.bake(mesh, {
        textured: true,
        albedo,
        shadeSteps: 1 - (first?.light ?? 1),
        ignore: blockout.map((piece) => piece.id),
      })
    }
    // A model on a wall follows that wall as the prop's own pieces would: the wall its blockout hangs on takes it away and brings it back.
    const hung = pieces.find((piece) => piece.prop?.id === prop.id && piece.onWall !== undefined)
    const wall = hung?.onWall === undefined ? undefined : walls.get(hung.onWall)
    const span = wall === undefined ? undefined : wallSpan(wall)
    if (span !== undefined) scene.occluders?.face(mesh, span, hung?.occlude)
    // A model standing free stands where its blockout stood (`fitModel`), so the blockout's bounds are the rule's.
    else if (scene.occluders !== undefined && blockout.length > 0)
      registerProp(
        scene.occluders,
        mesh,
        boundsOfMesh(blockout.flatMap((piece) => [...piece.mesh.positions])),
      )
  }
  return {
    node,
    pieces,
    models: drawn.map(({ id, prop }) => ({ id, prop })),
    mesh: (id) => meshes.get(id),
    relight(id) {
      const mesh = meshes.get(id)
      if (mesh !== undefined) scene.light?.rebake(mesh)
    },
    showRooms(rooms) {
      if (groups === undefined) {
        const made = new Map<string, Container3D>()
        const rooms = [
          ...pieces.map(({ id, sector }) => ({ id, sector })),
          ...drawn.map(({ id, prop }) => ({ id, sector: prop.sector })),
        ]
        for (const { id, sector } of rooms) {
          const mesh = meshes.get(id)
          if (mesh === undefined) continue
          let group = made.get(sector)
          if (group === undefined) {
            group = new Container3D()
            node.addChild(group)
            made.set(sector, group)
          }
          group.addChild(mesh)
        }
        groups = made
      }
      for (const [sector, group] of groups) group.visible = rooms === undefined || rooms.has(sector)
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
      }
    })
}
