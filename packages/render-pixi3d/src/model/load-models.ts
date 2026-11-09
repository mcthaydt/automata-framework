import { ModelInvalid, type RenderTarget } from '@automataframework/automata'
import { type Geometry3D, PhongMaterial } from '@pixi/3d'
import { Effect } from 'effect'
import { Texture } from 'pixi.js'
import { shareMaterial } from '../views/shared-material.js'
import { modelGeometry } from './model-geometry.js'
import { type ModelMesh, parseGlb, parsePack } from './parse-glb.js'

/** A model file read and ready to draw: shared by every view of it. */
export interface LoadedModel {
  readonly mesh: ModelMesh
  readonly geometry: Geometry3D
  readonly material: PhongMaterial
  /** The base-colour texture `material` draws, decoded from the file's image. */
  readonly texture: Texture
}

/** The model files a renderer loaded, by the name its views gave. */
export interface ModelLibrary {
  get(file: string): LoadedModel | undefined
}

/** The models one renderer loaded, which it frees when its scope closes. */
export interface ModelStore extends ModelLibrary {
  /** Destroys every model's geometry, material and texture and closes its decoded image. The store is then empty. */
  dispose(): void
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
    if (parse === undefined) return yield* Effect.fail(new ModelInvalid({ file, reason: 'unsupported type' }))
    // The runtime fetched the file with byte progress under the 30 s stall rule (M1.5) because the game listed it
    // in its preload; a file it did not fetch is a game bug, named here.
    const blob = assets.get(file)
    if (blob === undefined) return yield* Effect.fail(new ModelInvalid({ file, reason: 'not loaded' }))
    const buffer = yield* Effect.tryPromise({
      try: () => blob.arrayBuffer(),
      catch: () => new ModelInvalid({ file, reason: 'malformed: unreadable bytes' }),
    })
    const mesh = yield* Effect.try({
      try: () => parse(buffer, file),
      catch: (error) =>
        error instanceof ModelInvalid ? error : new ModelInvalid({ file, reason: 'malformed' }),
    })
    const texture = yield* Effect.tryPromise({
      try: () => decode(mesh.image, mesh.mime),
      catch: () => new ModelInvalid({ file, reason: 'malformed: unreadable texture' }),
    })
    return {
      mesh,
      geometry: modelGeometry(mesh),
      // Every mesh of the model shares it; a prop the occluder rule fades gets its own copy.
      material: shareMaterial(
        new PhongMaterial({ baseColorTexture: texture }),
        () => new PhongMaterial({ baseColorTexture: texture }),
      ),
      texture,
    }
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
): Effect.Effect<ModelStore, ModelInvalid> {
  return Effect.gen(function* () {
    const loaded = new Map<string, LoadedModel>()
    // A failure part way frees what was already loaded.
    yield* Effect.forEach(new Set(files), (file) =>
      Effect.map(loadModel(file, assets, decode), (model) => void loaded.set(file, model)),
    ).pipe(Effect.onError(() => Effect.sync(() => disposeAll(loaded))))
    return { get: (file) => loaded.get(file), dispose: () => disposeAll(loaded) }
  })
}

function disposeModel(model: LoadedModel): void {
  // The decoded image: an ImageBitmap holds memory until it is closed, which destroying its texture does not do.
  const resource = model.texture.source.resource as { close?: () => void } | undefined
  model.geometry.destroy(true)
  model.material.destroy()
  model.texture.destroy(true)
  resource?.close?.()
}

function disposeAll(loaded: Map<string, LoadedModel>): void {
  for (const model of loaded.values()) disposeModel(model)
  loaded.clear()
}
