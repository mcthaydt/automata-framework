// Ask over the developer's own Anthropic API key (editor suite spec §4.3, EDS-D9; 02's EDS.1d row). The provider only
// proposes: the request goes out as JSON in one user message, the model must answer with one `propose` tool call
// holding the whole document, and the budget is the call's output limit. Checking the proposal before it is written is
// the suite's (EDS.2b). The model id has no default here: `automata editor` passes it (EDS.1d-b).
import type { AskProvider, AskRequest, Proposal } from '../../../shared/kit/ports/suite-ports.ts'
import { apiErrorSchema, askReplySchema, proposalInputSchema } from './ask-reply.schema'

export interface ClaudeAskOptions {
  readonly apiKey: string
  readonly model: string
  /** The API's address (default `https://api.anthropic.com`). */
  readonly baseUrl?: string | undefined
  /** The most output one proposal may ask for, whatever the budget (default 16 000). */
  readonly maxOutputTokens?: number | undefined
  readonly fetch?: typeof fetch | undefined
}

const API_VERSION = '2023-06-01'

const SYSTEM = [
  'You edit one content file of a game for a person using its editor.',
  'The request is JSON: `prompt` is what they asked, `path` the file, `scope` the ids the prompt is about,',
  '`document` the whole file as they see it now, and `context` what the editor adds.',
  'Answer only by calling `propose` with the whole file as it should read after the change, changing nothing',
  'the prompt does not ask for and keeping its comments and layout, and one plain sentence saying what changed.',
].join(' ')

const PROPOSE_TOOL = {
  name: 'propose',
  description: 'Propose the whole file after the change, and one sentence saying what the change does.',
  input_schema: {
    type: 'object',
    properties: {
      summary: { type: 'string', description: 'One plain sentence: what the change does.' },
      text: { type: 'string', description: 'The whole file as it should read after the change.' },
    },
    required: ['summary', 'text'],
  },
}

export function createClaudeAsk(options: ClaudeAskOptions): AskProvider {
  const send = options.fetch ?? fetch
  const baseUrl = options.baseUrl ?? 'https://api.anthropic.com'
  const ceiling = options.maxOutputTokens ?? 16_000

  return {
    async propose(request: AskRequest): Promise<Proposal> {
      const limit = Math.min(Math.floor(request.budget), ceiling)
      if (limit < 1) throw new Error('the change set has no budget left: only the owner raises the cap')
      const response = await send(`${baseUrl}/v1/messages`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': options.apiKey,
          'anthropic-version': API_VERSION,
        },
        body: JSON.stringify({
          model: options.model,
          max_tokens: limit,
          system: SYSTEM,
          tools: [PROPOSE_TOOL],
          tool_choice: { type: 'tool', name: 'propose' },
          messages: [{ role: 'user', content: `<request>${JSON.stringify(request)}</request>` }],
        }),
      })
      const body: unknown = await response.json().catch(() => undefined)
      if (!response.ok) {
        const failure = apiErrorSchema.safeParse(body)
        throw new Error(
          failure.success ? failure.data.error.message : `the assistant answered ${response.status}`,
        )
      }
      const reply = askReplySchema.parse(body)
      if (reply.stop_reason === 'max_tokens')
        throw new Error('the proposal did not fit in the budget it was given; nothing was changed')
      const call = reply.content.find((block) => block.type === 'tool_use' && block.name === 'propose')
      const input = proposalInputSchema.safeParse(call?.input)
      if (!input.success) throw new Error('the assistant gave no proposal; nothing was changed')
      return {
        summary: input.data.summary,
        text: input.data.text,
        tokens: reply.usage.input_tokens + reply.usage.output_tokens,
      }
    },
  }
}
