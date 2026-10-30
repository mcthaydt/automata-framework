// The part of a Messages API reply Ask reads: the stop reason, the content blocks (one `propose` tool call is the
// proposal) and the token use. Other fields are ignored.
import { z } from 'zod'

export interface AskReply {
  readonly stop_reason?: string | null | undefined
  readonly content: readonly {
    readonly type: string
    readonly name?: string | undefined
    readonly input?: unknown
  }[]
  readonly usage: { readonly input_tokens: number; readonly output_tokens: number }
}

export const askReplySchema: z.ZodType<AskReply> = z.object({
  stop_reason: z.string().nullish(),
  content: z.array(
    z.object({ type: z.string(), name: z.string().optional(), input: z.unknown().optional() }),
  ),
  usage: z.object({ input_tokens: z.number().int().min(0), output_tokens: z.number().int().min(0) }),
})

export const proposalInputSchema: z.ZodType<{ readonly summary: string; readonly text: string }> = z.object({
  summary: z.string().min(1),
  text: z.string(),
})

export const apiErrorSchema: z.ZodType<{ readonly error: { readonly message: string } }> = z.object({
  error: z.object({ message: z.string() }),
})
