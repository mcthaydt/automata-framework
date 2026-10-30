import type { AskRequest } from '@mcthaydt/automata-editor-kit/ports'
import { type AskScript, describeAskProvider } from '@mcthaydt/automata-editor-kit/ports/testing'
import { describe, expect, test } from 'vitest'
import { createClaudeAsk } from './claude-ask'

interface Sent {
  readonly url: string
  readonly headers: Record<string, string>
  readonly body: {
    readonly model: string
    readonly max_tokens: number
    readonly messages: readonly { readonly content: string }[]
  }
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

/** The Messages API as the script answers it: it reads the request back from the message the provider sent. */
function stubbedApi(script: AskScript, sent: Sent[] = []): typeof fetch {
  return async (input, init) => {
    const body = JSON.parse(String(init?.body)) as Sent['body']
    sent.push({ url: String(input), headers: init?.headers as Record<string, string>, body })
    const message = body.messages[0]?.content ?? ''
    const request = JSON.parse(/<request>([\s\S]*)<\/request>/.exec(message)?.[1] ?? 'null') as AskRequest
    const answer = script(request, { maxOutputTokens: body.max_tokens })
    if (answer instanceof Error)
      return json(529, { type: 'error', error: { type: 'overloaded_error', message: answer.message } })
    const input_tokens = Math.floor(answer.tokens / 2)
    return json(200, {
      type: 'message',
      stop_reason: 'tool_use',
      content: [
        {
          type: 'tool_use',
          id: 't1',
          name: 'propose',
          input: { summary: answer.summary, text: answer.text },
        },
      ],
      usage: { input_tokens, output_tokens: answer.tokens - input_tokens },
    })
  }
}

const REQUEST: AskRequest = {
  prompt: 'Faster',
  path: 'content/tuning.toml',
  scope: [],
  document: 'A = 1\n',
  budget: 900,
}

describeAskProvider('messages api', (script) =>
  createClaudeAsk({ apiKey: 'test-key', model: 'test-model', fetch: stubbedApi(script) }),
)

describe('Ask over the Messages API', () => {
  test("sends the developer's key, the API version and the model it was given", async () => {
    const sent: Sent[] = []
    const ask = createClaudeAsk({
      apiKey: 'test-key',
      model: 'test-model',
      fetch: stubbedApi(() => ({ summary: 's', text: 't', tokens: 1 }), sent),
    })
    await ask.propose(REQUEST)
    expect(sent[0]?.url).toBe('https://api.anthropic.com/v1/messages')
    expect(sent[0]?.headers).toMatchObject({ 'x-api-key': 'test-key', 'anthropic-version': '2023-06-01' })
    expect(sent[0]?.body.model).toBe('test-model')
  })

  test('a budget of nothing is refused before anything is sent', async () => {
    const sent: Sent[] = []
    const ask = createClaudeAsk({
      apiKey: 'k',
      model: 'm',
      fetch: stubbedApi(() => ({ summary: 's', text: 't', tokens: 1 }), sent),
    })
    await expect(ask.propose({ ...REQUEST, budget: 0 })).rejects.toThrow(/budget/)
    expect(sent).toEqual([])
  })

  test('a reply without the proposal rejects, and so does one cut off at the limit', async () => {
    const reply = (body: object) =>
      createClaudeAsk({ apiKey: 'k', model: 'm', fetch: async () => json(200, body) })
    const usage = { input_tokens: 1, output_tokens: 1 }
    await expect(
      reply({ stop_reason: 'end_turn', content: [{ type: 'text', text: 'no' }], usage }).propose(REQUEST),
    ).rejects.toThrow(/no proposal/)
    await expect(
      reply({
        stop_reason: 'max_tokens',
        content: [{ type: 'tool_use', name: 'propose', input: { summary: 's', text: 't' } }],
        usage,
      }).propose(REQUEST),
    ).rejects.toThrow(/budget/)
  })

  test('a network failure rejects with its reason', async () => {
    const ask = createClaudeAsk({
      apiKey: 'k',
      model: 'm',
      fetch: async () => {
        throw new TypeError('fetch failed')
      },
    })
    await expect(ask.propose(REQUEST)).rejects.toThrow(/fetch failed/)
  })
})
