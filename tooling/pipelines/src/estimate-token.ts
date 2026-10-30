import { Clock, Effect } from 'effect'

// Estimate tokens (The Last Light's G-3 in scripts/mcp/tools.ts at 92e6704): an agent runs paid stages only after it
// has estimated them. `pipeline_estimate` issues a token for the plan it printed; `pipeline_run` accepts it only for
// the same pipeline, target, stages and input hashes, within 30 minutes. The source signed tokens with an HMAC under
// a per-process secret; here the server keeps them in memory (plan D4), which gives the same guarantee for one server
// process without `node:crypto`. A restarted server knows none, so the agent estimates again.

export const TOKEN_TTL_MS: number = 30 * 60 * 1000

/** What a token stands for: the plan an estimate printed. */
export interface EstimatedPlan {
  readonly pipeline: string
  /** Relative to the project root, as the tool was given it. */
  readonly target: string
  readonly stages: readonly string[]
  readonly inputHashes: readonly string[]
}

interface Issued extends EstimatedPlan {
  readonly at: number
}

const samePlan = (a: EstimatedPlan, b: EstimatedPlan): boolean =>
  a.pipeline === b.pipeline &&
  a.target === b.target &&
  JSON.stringify(a.stages) === JSON.stringify(b.stages) &&
  JSON.stringify(a.inputHashes) === JSON.stringify(b.inputHashes)

/** The tokens one server process has issued. */
export class EstimateTokens {
  readonly #issued = new Map<string, Issued>()

  /** A new token for `plan`, timed by Effect's Clock. */
  issue(plan: EstimatedPlan): Effect.Effect<string> {
    return Effect.map(Clock.currentTimeMillis, (at) => {
      const token = globalThis.crypto.randomUUID()
      this.#issued.set(token, { ...plan, at })
      return token
    })
  }

  /** Why `token` does not cover `plan`, whose `paid` stages need it (the refusal), or `undefined` when it does. */
  refusal(
    token: string | undefined,
    plan: EstimatedPlan,
    paid: readonly string[],
  ): Effect.Effect<string | undefined> {
    return Effect.map(Clock.currentTimeMillis, (now) => {
      if (token === undefined)
        return `refused: ${paid.join(', ')} ${paid.length > 1 ? 'are' : 'is'} paid; call pipeline_estimate first and pass its token`
      const issued = this.#issued.get(token)
      if (issued === undefined)
        return 'refused: the estimate token is not one this server issued; call pipeline_estimate'
      if (now - issued.at > TOKEN_TTL_MS)
        return 'refused: the estimate token is older than 30 minutes; estimate again'
      if (!samePlan(issued, plan))
        return 'refused: the estimate token does not match these stages or their inputs any more; estimate again'
      return undefined
    })
  }
}
