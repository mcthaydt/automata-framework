import type { Pixi3dRenderer, Pixi3dResult } from '../renderer/create-pixi3d-renderer.js'

/** The renderer a factory built; a refusal fails the test with its reason. The test disposes what it gets. */
export async function builtRenderer(made: Promise<Pixi3dResult>): Promise<Pixi3dRenderer> {
  const result = await made
  if (!result.ok) throw result.reason
  return result.value
}
