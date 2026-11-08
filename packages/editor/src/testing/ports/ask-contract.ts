import { describe, expect, test } from 'vitest'
import type { AskProvider, AskRequest, Proposal } from '../../shared/kit/ports/suite-ports'

/**
 * What the assistant behind the provider answers: a proposal, or a failure. The Node adapter stubs its client with it,
 * passing the request it understood and the output limit it set on the call (`max_tokens`).
 */
export type AskScript = (
  request: AskRequest,
  client: { readonly maxOutputTokens: number },
) => Proposal | Error

const REQUEST: AskRequest = {
  prompt: 'Make the player a little faster',
  path: 'content/tuning.toml',
  scope: ['MAX_MOVE_SPEED'],
  document: 'MAX_MOVE_SPEED = 6.0 # m/s\n',
  budget: 4000,
  context: { tunable: 'MAX_MOVE_SPEED', fairness: ['0.5 of 0.4'] },
}

const PROPOSAL: Proposal = {
  summary: 'Raise MAX_MOVE_SPEED to 7.5',
  text: 'MAX_MOVE_SPEED = 7.5 # m/s\n',
  tokens: 312,
}

/**
 * What every `AskProvider` promises (editor suite spec §4.3, EDS-D9), against the scripted fake and, in EDS.1d, the
 * provider over the developer's credentials with a stubbed client. The provider only proposes: checking a proposal
 * before it is written (the `before` checks, the diff, Accept) is the suite's, EDS.2b, on ED3D.10a's controller.
 */
export function describeAskProvider(
  name: string,
  make: (script: AskScript) => Promise<AskProvider> | AskProvider,
): void {
  describe(`AskProvider contract: ${name}`, () => {
    test('the assistant gets the prompt, the path, the scope, the document as seen, the budget and the context', async () => {
      const seen: AskRequest[] = []
      const provider = await make((request) => {
        seen.push(request)
        return PROPOSAL
      })
      await provider.propose(REQUEST)
      expect(seen).toEqual([REQUEST])
    })

    test("gives the assistant's proposal: its summary, the whole document and the tokens it used", async () => {
      const provider = await make(() => PROPOSAL)
      expect(await provider.propose(REQUEST)).toEqual(PROPOSAL)
    })

    test("the budget reaches the assistant's client as its output limit, never more", async () => {
      const limits: number[] = []
      const provider = await make((_request, client) => {
        limits.push(client.maxOutputTokens)
        return PROPOSAL
      })
      await provider.propose(REQUEST)
      await provider.propose({ ...REQUEST, budget: 500 })
      expect(limits).toHaveLength(2)
      expect(limits[0]).toBeGreaterThan(0)
      expect(limits[0]).toBeLessThanOrEqual(REQUEST.budget)
      expect(limits[1]).toBeGreaterThan(0)
      expect(limits[1]).toBeLessThanOrEqual(500)
    })

    test('an assistant failure rejects with its reason', async () => {
      const provider = await make(() => new Error('the model is overloaded'))
      await expect(provider.propose(REQUEST)).rejects.toThrow('the model is overloaded')
    })
  })
}
