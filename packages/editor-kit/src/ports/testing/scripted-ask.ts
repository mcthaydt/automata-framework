// A scripted `AskProvider` (editor suite spec §4.3): it records each request and answers with whatever the script
// returns, a promise the test settles itself included; a script that throws is an assistant that failed.
import type { AskProvider, AskRequest, Proposal } from '../suite-ports'

export interface ScriptedAsk {
  readonly provider: AskProvider
  /** The requests it was given, in order. */
  readonly calls: readonly AskRequest[]
}

export function createScriptedAsk(
  respond: (request: AskRequest) => Promise<Proposal> | Proposal,
  options: { readonly onTokens?: ((tokens: number) => void) | undefined } = {},
): ScriptedAsk {
  const calls: AskRequest[] = []
  return {
    calls,
    provider: {
      async propose(request) {
        calls.push(request)
        const proposal = await respond(request)
        options.onTokens?.(proposal.tokens)
        return proposal
      },
    },
  }
}
