import { z } from 'zod'

/** How the player is playing right now. */
export type InputMode = 'touch' | 'keyboard-mouse' | 'gamepad'

/** The current input mode, and the gamepad when one is in use. */
export interface InputModePayload {
  mode: InputMode
  gamepad?: { layout: 'xbox' | 'other'; connected: boolean } | undefined
}

/** Checks an input mode change. */
export const InputModePayloadSchema: z.ZodType<InputModePayload> = z.object({
  mode: z.enum(['touch', 'keyboard-mouse', 'gamepad']),
  gamepad: z.object({ layout: z.enum(['xbox', 'other']), connected: z.boolean() }).optional(),
})
