import { z } from 'zod'

// The messages between a playground frame and the page around it, used by both sides (the frame runtime in
// playground/src imports this file). Both sides parse every message they receive and drop what does not parse, so
// every object is strict.

export const PROTOCOL_VERSION = 1
/** The function the compile step calls at the top of every loop body, and the frame defines. */
export const LOOP_GUARD_NAME = '__afLoop'
/** The longest compiled module the frame accepts. */
export const MAX_CODE_CHARS = 262_144
/** The longest failure message the frame sends; longer ones are cut. */
export const MAX_FAILURE_CHARS = 2_000
/** How long `running` waits for an animation frame once the runtime is ready (an off-screen frame gets none). */
export const RUNNING_FRAME_WAIT_MS = 250
/** How long one stretch of synchronous work may run loops before the guard stops it. */
export const LOOP_GUARD_MS = 1_000

const v = z.literal(PROTOCOL_VERSION)
const runId = z.number().int().min(1)

export const bootedMessage = z.strictObject({
  v,
  type: z.literal('booted'),
  /** The framework commit the runtime was built from. */
  framework: z.string().regex(/^[0-9a-f]{40}$/),
})

export const runMessage = z.strictObject({
  v,
  type: z.literal('run'),
  runId,
  /** The compiled module: plain JavaScript whose default export is a `defineGame` result. */
  code: z.string().max(MAX_CODE_CHARS),
  determinism: z
    .strictObject({
      ticks: z.number().int().min(1),
      /** The golden to replay, present only when the code is the unedited original. */
      replay: z
        .string()
        .regex(/^\/playground\/goldens\/[a-z0-9-]+\.replay$/)
        .optional(),
    })
    .optional(),
})

export const runningMessage = z.strictObject({ v, type: z.literal('running'), runId })

export const failedMessage = z.strictObject({
  v,
  type: z.literal('failed'),
  runId,
  phase: z.enum(['import', 'boot', 'run']),
  message: z.string().max(MAX_FAILURE_CHARS),
  /** 1-based, in the reader's source. */
  line: z.number().int().min(1).optional(),
  column: z.number().int().min(1).optional(),
  /** The loop guard stopped it. */
  hung: z.literal(true).optional(),
})

export const determinismMessage = z.strictObject({
  v,
  type: z.literal('determinism'),
  runId,
  ticks: z.number().int().min(1),
  hash: z.string().regex(/^[0-9a-f]{16}$/),
  golden: z.enum(['pass', 'diverged', 'none']),
  /** Where the replay diverged from the golden. */
  tick: z.number().int().min(0).optional(),
})

/**
 * The determinism check could not run (its golden could not be fetched or read). The preview is unaffected: a check
 * that fails to run is never reported as the example failing.
 */
export const determinismUnavailableMessage = z.strictObject({
  v,
  type: z.literal('determinism-unavailable'),
  runId,
  message: z.string().max(MAX_FAILURE_CHARS),
})

/** What a frame sends its parent. */
export const frameMessage = z.discriminatedUnion('type', [
  bootedMessage,
  runningMessage,
  failedMessage,
  determinismMessage,
  determinismUnavailableMessage,
])
export type FrameMessage = z.infer<typeof frameMessage>

/** What a parent sends its frame: a run is the only message. */
export type RunMessage = z.infer<typeof runMessage>

/**
 * The URL path an example's module stands at in the playground: its `import.meta.url` is rewritten to this, so
 * `new URL('../resources/…', import.meta.url)` reaches /playground/examples/resources/, where the build publishes them.
 */
export function exampleModulePath(module: string, name: string): string {
  return `/playground/examples/${module}/${module}-${name}.ts`
}
