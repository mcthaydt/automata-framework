import { Effect, Exit } from 'effect'
import { Texture, TextureSource } from 'pixi.js'
import { describe, expect, it } from 'vitest'
import { type DecodeTexture, loadModels } from './load-models.js'
import { encodeGlb, encodePack, fixtureBox } from './testing/model-fixtures.js'

const decode: DecodeTexture = async () => Texture.WHITE
const assetsOf = (files: Record<string, ArrayBuffer>) => ({
  get: (path: string) => (files[path] === undefined ? undefined : new Blob([files[path]])),
})
const failureOf = async (files: readonly string[], assets: ReturnType<typeof assetsOf>, using = decode) => {
  const exit = await Effect.runPromiseExit(loadModels(files, assets, using))
  if (Exit.isSuccess(exit)) throw new Error('expected a failure')
  return exit.cause.toJSON()
}

describe('loadModels', () => {
  it('reads .glb and .bin files from the loaded assets, once each', async () => {
    const assets = assetsOf({ 'm/a.glb': encodeGlb(fixtureBox()), 'm/b.bin': encodePack(fixtureBox()) })
    const models = await Effect.runPromise(loadModels(['m/a.glb', 'm/b.bin', 'm/a.glb'], assets, decode))
    expect(models.get('m/a.glb')?.geometry.vertexCount).toBe(24)
    expect(models.get('m/b.bin')?.mesh.indices.length).toBe(36)
    expect(models.get('m/c.glb')).toBeUndefined()
  })

  it('disposes what it loaded: geometry, material, texture and the decoded bitmap (review of #241)', async () => {
    const closed: string[] = []
    const bitmapDecode: DecodeTexture = async () => {
      const bitmap = { width: 1, height: 1, close: () => void closed.push('bitmap') }
      return new Texture({ source: new TextureSource({ resource: bitmap, width: 1, height: 1 }) })
    }
    const models = await Effect.runPromise(
      loadModels(['m/a.glb'], assetsOf({ 'm/a.glb': encodeGlb(fixtureBox()) }), bitmapDecode),
    )
    const model = models.get('m/a.glb')
    if (model === undefined) throw new Error('not loaded')
    models.dispose()
    expect(model.material.destroyed).toBe(true)
    expect(model.texture.destroyed).toBe(true)
    expect(closed).toEqual(['bitmap'])
    expect(models.get('m/a.glb')).toBeUndefined()
  })

  it.each([
    ['a file the runtime did not load', ['m/none.glb'], {}, 'not loaded'],
    ['a type it cannot read', ['m/a.obj'], { 'm/a.obj': new ArrayBuffer(8) }, 'unsupported type'],
    ['a skinned GLB', ['m/s.glb'], { 'm/s.glb': encodeGlb(fixtureBox(), { skinned: true }) }, 'skinned'],
    ['a malformed GLB', ['m/x.glb'], { 'm/x.glb': new ArrayBuffer(40) }, 'malformed: not a GLB file'],
  ])('fails with ModelInvalid for %s', async (_case, files, contents, reason) => {
    const cause = JSON.stringify(await failureOf(files, assetsOf(contents)))
    expect(cause).toContain('"_tag":"ModelInvalid"')
    expect(cause).toContain(`"file":"${files[0]}"`)
    expect(cause).toContain(`"reason":"${reason}"`)
  })

  it('fails with ModelInvalid, not a defect, when the loaded bytes cannot be read', async () => {
    const unreadable = {
      get: () => ({ arrayBuffer: () => Promise.reject(new Error('gone')) }) as unknown as Blob,
    }
    const cause = JSON.stringify(await failureOf(['m/a.glb'], unreadable as never))
    expect(cause).toContain('"_tag":"ModelInvalid"')
    expect(cause).toContain('"reason":"malformed: unreadable bytes"')
  })

  it('fails with ModelInvalid when the texture is not an image', async () => {
    const cause = JSON.stringify(
      await failureOf(['t.glb'], assetsOf({ 't.glb': encodeGlb(fixtureBox()) }), () =>
        Promise.reject(new Error('bad')),
      ),
    )
    expect(cause).toContain('"reason":"malformed: unreadable texture"')
  })
})
