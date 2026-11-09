import type { GitEngine, PullOutcome, PushResult } from '#src/shared/kit/sync/git-engine.ts'
import { OfflineError } from '#src/shared/kit/sync/git-engine.ts'
import type { Timers, Visibility } from '#src/shared/kit/sync/sync-loop.ts'

/** Timers the test moves by hand. */
export class FakeTimers implements Timers {
  now = 0
  private next = 1
  private readonly pending = new Map<number, { at: number; every?: number; run: () => void }>()

  after(ms: number, run: () => void): () => void {
    const id = this.next++
    this.pending.set(id, { at: this.now + ms, run })
    return () => this.pending.delete(id)
  }

  every(ms: number, run: () => void): () => void {
    const id = this.next++
    this.pending.set(id, { at: this.now + ms, every: ms, run })
    return () => this.pending.delete(id)
  }

  /** Moves time forward, running what comes due in order, and lets the promises it started settle. */
  async advance(ms: number): Promise<void> {
    const end = this.now + ms
    for (;;) {
      const due = [...this.pending]
        .filter(([, timer]) => timer.at <= end)
        .sort(([, a], [, b]) => a.at - b.at)[0]
      if (due === undefined) break
      const [id, timer] = due
      this.now = timer.at
      if (timer.every === undefined) this.pending.delete(id)
      else timer.at += timer.every
      timer.run()
      await settle()
    }
    this.now = end
    await settle()
  }
}

/** Lets every promise already started run to its end. */
export async function settle(): Promise<void> {
  for (let i = 0; i < 20; i++) await Promise.resolve()
  await new Promise((resolve) => setTimeout(resolve, 0))
}

export class FakeVisibility implements Visibility {
  visible = true
  private readonly listeners = new Set<() => void>()
  isVisible = (): boolean => this.visible
  onChange(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }
  set(visible: boolean): void {
    this.visible = visible
    for (const listener of this.listeners) listener()
  }
}

/** A git engine that records what it was asked and answers from fields the test sets. */
export class FakeEngine implements GitEngine {
  readonly calls: string[] = []
  commits: string[] = []
  unpushedShas: string[] = []
  remoteChanged = false
  online = true
  pushAnswers: PushResult[] = []
  pull: PullOutcome = { changed: [], asks: [], generated: [] }

  async fetchMain(): Promise<'unchanged' | 'changed'> {
    this.calls.push('fetch')
    if (!this.online) throw new OfflineError()
    return this.remoteChanged ? 'changed' : 'unchanged'
  }

  async mergeMain(): Promise<PullOutcome> {
    this.calls.push('merge')
    this.remoteChanged = false
    return this.pull
  }

  async commitAll(message: string): Promise<string | undefined> {
    this.calls.push('commit')
    this.commits.push(message)
    const sha = `sha${this.commits.length}`
    this.unpushedShas.push(sha)
    return sha
  }

  async hasUnpushed(): Promise<boolean> {
    return this.unpushedShas.length > 0
  }

  async push(): Promise<PushResult> {
    this.calls.push('push')
    const answer = this.pushAnswers.shift() ?? (this.online ? 'pushed' : 'offline')
    if (answer === 'pushed') this.unpushedShas = []
    return answer
  }
}
