import { ModelInvalid, type RenderTarget } from '@mcthaydt/automata-runtime'
import { type Geometry3D, PhongMaterial } from '@pixi/3d'
import { Effect } from 'effect'
import { Texture } from 'pixi.js'
import { modelGeometry } from './model-geometry.js'
import { type ModelMesh, parseGlb, parsePack } from './parse-glb.js'

/** A model file read and ready to draw: shared by every view of it. */
export interface LoadedModel {
  readonly mesh: ModelMesh
  readonly geometry: Geometry3D
  readonly material: PhongMaterial
}

/** The model files a renderer loaded, by the name its views gave. */
export interface ModelLibrary {
  get(file: string): LoadedModel | undefined
}

/** A library with no models. */
export const emptyModels: ModelLibrary = { get: () => undefined }

/** Turns a model's base-colour image into a texture; throws when the bytes are not an image. */
export type DecodeTexture = (image: Uint8Array, mime: string) => Promise<Texture>

const decodeWithBitmap: DecodeTexture = async (image, mime) =>
  Texture.from(await createImageBitmap(new Blob([image as BlobPart], { type: mime })))

const parserFor = (file: string): ((buffer: ArrayBuffer, file: string) => ModelMesh) | undefined => {
  const path = file.split(/[?#]/)[0] ?? file
  if (path.endsWith('.glb')) return parseGlb
  if (path.endsWith('.bin')) return parsePack
  return undefined
}

function loadModel(
  file: string,
  assets: RenderTarget['assets'],
  decode: DecodeTexture,
): Effect.Effect<LoadedModel, ModelInvalid> {
  return Effect.gen(function* () {
    const parse = parserFor(file)
    if (parse === undefined) return yield* new ModelInvalid({ file, reason: 'unsupported type' })
    // The runtime fetched the file with byte progress under the 30 s stall rule (M1.5) because the game listed it
    // in its preload; a file it did not fetch is a game bug, named here.
    const blob = assets.get(file)
    if (blob === undefined) return yield* new ModelInvalid({ file, reason: 'not loaded' })
    const buffer = yield* Effect.promise(() => blob.arrayBuffer())
    const mesh = yield* Effect.try({
      try: () => parse(buffer, file),
      catch: (error) =>
        error instanceof ModelInvalid ? error : new ModelInvalid({ file, reason: 'malformed' }),
    })
    const texture = yield* Effect.tryPromise({
      try: () => decode(mesh.image, mesh.mime),
      catch: () => new ModelInvalid({ file, reason: 'malformed: unreadable texture' }),
    })
    return { mesh, geometry: modelGeometry(mesh), material: new PhongMaterial({ baseColorTexture: texture }) }
  })
}

/**
 * Reads every named model file from the runtime's loaded assets: `.glb` (`parseGlb`) or packed `.bin`
 * (`parsePack`). Fails with the first `ModelInvalid`, so a bad model stops boot before anything is drawn.
 */
export function loadModels(
  files: readonly string[],
  assets: RenderTarget['assets'],
  decode: DecodeTexture = decodeWithBitmap,
): Effect.Effect<ModelLibrary, ModelInvalid> {
  return Effect.gen(function* () {
    const loaded = new Map<string, LoadedModel>()
    for (const file of new Set(files)) loaded.set(file, yield* loadModel(file, assets, decode))
    return { get: (file) => loaded.get(file) }
  })
}
