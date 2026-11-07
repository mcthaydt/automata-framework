// Cutscenes' state (M6 spec §4.8, M6-D7): which scripts the scene has (their length and the anchors they name; the rest of a
// script is presentation's), and the cutscene under way with the ticks it starts and ends on.
import { defineResource, type ResourceDef } from '@automata/sim'
import { z } from 'zod'

export interface SceneScript {
  readonly id: string
  /** Seconds. */
  readonly duration: number
  readonly anchors: readonly string[]
}
export interface CutsceneSceneValue {
  scripts: SceneScript[]
}
const sceneSchema: z.ZodType<CutsceneSceneValue> = z.strictObject({
  scripts: z.array(
    z.strictObject({ id: z.string(), duration: z.number().min(0), anchors: z.array(z.string()) }),
  ),
})
/** The scene's scripts; empty until the game loads them. */
export const CutsceneScene: ResourceDef<z.ZodType<CutsceneSceneValue>> = defineResource(
  'cutscene.scene',
  sceneSchema,
  () => ({ scripts: [] }),
)

export interface CutsceneStateValue {
  /** The cutscene under way, or null. */
  id: string | null
  /** The tick it started on, and the tick it ends on. */
  start: number
  end: number
}
const stateSchema: z.ZodType<CutsceneStateValue> = z.strictObject({
  id: z.string().nullable(),
  start: z.number().int().min(0),
  end: z.number().int().min(0),
})
export const CutsceneState: ResourceDef<z.ZodType<CutsceneStateValue>> = defineResource(
  'cutscene.state',
  stateSchema,
  () => ({ id: null, start: 0, end: 0 }),
)
