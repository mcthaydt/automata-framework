// A scripted `AskProvider`: it records each request and answers with whatever the script
// returns, a promise the test settles itself included; a script that throws is an assistant that failed. The script
// is the assistant's client: it is given the request and the output limit the provider sets, which is the budget.
// With a change set, each proposal's tokens are spent through `ChangeSet.spend` while one is open, as the suite does.
import type { AskProvider, AskRequest, ChangeSet, Proposal } from '../../../shared/kit/ports/suite-ports'

/** What the provider tells the assistant's client besides the request: at most this many output tokens. */
export interface AskClientLimits {
  readonly maxOutputTokens: number
}

export interface ScriptedAsk {
  readonly provider: AskProvider
  /** The requests it was given, in order. */
  readonly calls: readonly AskRequest[]
}

export function createScriptedAsk(
  respond: (request: AskRequest, limits: AskClientLimits) => Promise<Proposal> | Proposal,
  options: { readonly changeSet?: Pick<ChangeSet, 'current' | 'spend'> | undefined } = {},
): ScriptedAsk {
  const calls: AskRequest[] = []
  const { changeSet } = options
  return {
    calls,
    provider: {
      async propose(request) {
        calls.push(request)
        const proposal = await respond(request, { maxOutputTokens: request.budget })
        if (changeSet !== undefined && (await changeSet.current()) !== undefined)
          await changeSet.spend(proposal.tokens)
        return proposal
      },
    },
  }
}
