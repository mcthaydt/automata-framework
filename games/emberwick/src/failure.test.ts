import { describe, expect, it } from 'vitest'
import { createFailure } from './failure.ts'

function parts() {
  const calls: string[] = []
  const root = { textContent: 'game' }
  const html = { dataset: { state: 'ready' } as Record<string, string> }
  const failure = createFailure({
    root,
    html,
    stopLoop: () => calls.push('loop.stop'),
    endRound: (outcome) => calls.push(`round.end:${outcome}`),
    cleanups: [() => calls.push('input.dispose'), () => calls.push('resize.off')],
    log: () => calls.push('log'),
  })
  return { calls, root, html, failure }
}

describe('a failed round', () => {
  it('ends the host round as failed, stops everything and says so', () => {
    const { calls, root, html, failure } = parts()
    expect(failure.failed()).toBe(false)
    failure.fail(new Error('Too many worlds'))
    expect(failure.failed()).toBe(true)
    expect(calls).toEqual(['log', 'loop.stop', 'round.end:fail', 'input.dispose', 'resize.off'])
    expect(root.textContent).toBe("This device can't run the game.")
    expect(html.dataset.state).toBe('failed')
  })

  it('is terminal: failing again does nothing more', () => {
    const { calls, failure } = parts()
    failure.fail(new Error('first'))
    const after = calls.length
    failure.fail(new Error('second'))
    expect(calls).toHaveLength(after)
  })
})
