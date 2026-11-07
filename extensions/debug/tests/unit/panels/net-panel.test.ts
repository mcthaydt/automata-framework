import { cleanup, render, screen } from '@testing-library/svelte'
import { afterEach, describe, expect, it, vi } from 'vitest'
import NetPanel from '#src/features/panels/NetPanel.svelte'
import { type DebugHost, HOST_CONTEXT } from '#src/shared/host.ts'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})
const mount = (host: Partial<DebugHost>) =>
  render(NetPanel, { context: new Map([[HOST_CONTEXT, { panels: [], ...host }]]) })

describe('NetPanel', () => {
  it('lists the diagnostics rows and follows them', async () => {
    vi.useFakeTimers()
    let count = 3
    mount({ net: { summary: () => ({ snapshots: { count }, degraded: false }) } })
    expect(screen.getByText('snapshots.count').nextElementSibling).toHaveTextContent('3')
    expect(screen.getByText('degraded').nextElementSibling).toHaveTextContent('false')
    count = 9
    await vi.advanceTimersByTimeAsync(300)
    expect(screen.getByText('snapshots.count').nextElementSibling).toHaveTextContent('9')
  })
  it('says so when no net diagnostics are installed', () => {
    mount({})
    expect(screen.getByText('This game has not turned on the network details.')).toBeInTheDocument()
  })
})
