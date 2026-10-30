import type { RenderRow } from '@mcthaydt/automata-sim'
import { Mesh3D, PhongMaterial } from '@pixi/3d'
import { describe, expect, it } from 'vitest'
import type { LoadedModel, ModelLibrary } from '../model/load-models.js'
import { modelGeometry } from '../model/model-geometry.js'
import { parseGlb } from '../model/parse-glb.js'
import { encodeGlb, fixtureBox } from '../model/testing/model-fixtures.js'
import { mesh } from './mesh-view.js'

const row: RenderRow = { sid: 3, components: { prop: { x: 1, y: 0, z: 1 } } }

/** A library holding one fixture model, 0.5 m to 2.5 m tall, without a texture (Node has no image decoder). */
function libraryWith(file: string): ModelLibrary {
  const parsed = parseGlb(encodeGlb(fixtureBox([-1, 0.5, -1], [1, 2.5, 1])), file)
  const model: LoadedModel = { mesh: parsed, geometry: modelGeometry(parsed), material: new PhongMaterial() }
  return { get: (name) => (name === file ? model : undefined) }
}

describe('mesh', () => {
  it('names its file, so the renderer loads it before the first frame', () => {
    expect(mesh('models/desk.glb').models).toEqual(['models/desk.glb'])
  })

  it("draws the loaded model's geometry and material, placed by its component", () => {
    const models = libraryWith('models/desk.glb')
    const view = mesh('models/desk.glb')(row, 'prop', models)
    const drawn = view?.container.children[0] as Mesh3D
    expect(drawn).toBeInstanceOf(Mesh3D)
    expect(drawn.geometry).toBe(models.get('models/desk.glb')?.geometry)
    view?.update?.({ prop: { x: 1, y: 0, z: 1, yaw: 0 } })
    expect(view?.container.position.x).toBe(1)
  })

  it('with a height, scales the model to it and stands its lowest point on the position', () => {
    const view = mesh('m.glb', { height: 1 })(row, 'prop', libraryWith('m.glb'))
    const drawn = view?.container.children[0] as Mesh3D
    expect(drawn.scale.y).toBeCloseTo(0.5)
    expect(drawn.position.y).toBeCloseTo(-0.25)
  })

  it('throws for a file the renderer did not load (a renderer bug: it loads every named file first)', () => {
    expect(() => mesh('missing.glb')(row, 'prop', libraryWith('other.glb'))).toThrow(/missing\.glb/)
  })
})
