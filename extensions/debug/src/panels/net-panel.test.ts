import { cleanup, render, screen } from '@testing-library/svelte'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { type DebugHost, HOST_CONTEXT } from '../host'
import NetPanel from './NetPanel.svelte'

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
    expect(screen.getByText('No net diagnostics installed.')).toBeInTheDocument()
  })
})
