import { describe, expect, test } from 'vitest'
import type { AskProvider, AskRequest, Proposal } from '../suite-ports'

/** What the assistant behind the provider answers: a proposal, or a failure. The Node adapter stubs its client with it. */
export type AskScript = (request: AskRequest) => Proposal | Error

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

/** What every `AskProvider` promises (editor suite spec §4.3, EDS-D9), against the scripted fake and, in EDS.1d, the
 * provider over the developer's credentials with a stubbed client. */
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

    test('an assistant failure rejects with its reason', async () => {
      const provider = await make(() => new Error('the model is overloaded'))
      await expect(provider.propose(REQUEST)).rejects.toThrow('the model is overloaded')
    })
  })
}
