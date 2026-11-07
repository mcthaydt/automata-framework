/**
 * What a command hands back to the runner before it is dressed as a result: the exit and the parts of the result.
 */

import { EXIT } from './exit.ts'
import type { ResultParts, Stop } from './run-state.ts'
import { stop } from './run-state.ts'
import type { PipelineResult } from './state.schema.ts'

export interface Done {
  readonly exit: PipelineResult['exit']
  readonly parts?: ResultParts
}

export const ok = (parts: ResultParts = {}): Done => ({ exit: EXIT.done, parts })
export const messageOf = (cause: unknown): string => (cause instanceof Error ? cause.message : String(cause))
export const asStop = (error: string | { readonly message: string }): Stop =>
  stop(EXIT.failed, typeof error === 'string' ? error : error.message)
