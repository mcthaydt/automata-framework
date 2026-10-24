// A scripted `AskProvider` for the Ask controller's tests: it records what it was asked and answers with whatever the
// script returns, a promise the test settles itself included.
import type { AskProvider, Proposal } from '../ports/ports'

export interface AskCall {
  readonly prompt: string
  readonly scope: readonly string[]
  readonly budget: number
  readonly document: string
}

export interface FakeAsk {
  readonly provider: AskProvider
  readonly calls: readonly AskCall[]
}

export function fakeAskProvider(respond: (call: AskCall) => Promise<Proposal> | Proposal): FakeAsk {
  const calls: AskCall[] = []
  return {
    calls,
    provider: {
      propose(prompt, scope, budget, document) {
        const call: AskCall = { prompt, scope: [...scope], budget, document }
        calls.push(call)
        // A throw in `respond` is a provider that throws before it returns a promise.
        return Promise.resolve(respond(call))
      },
    },
  }
}

/** A promise the test settles when it chooses: the proposal that is still on its way. */
export function deferred<T>(): {
  readonly promise: Promise<T>
  resolve(value: T): void
  reject(reason: unknown): void
} {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((done, fail) => {
    resolve = done
    reject = fail
  })
  return { promise, resolve, reject }
}
