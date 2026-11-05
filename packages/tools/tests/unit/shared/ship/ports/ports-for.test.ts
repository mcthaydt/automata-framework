import { describe, expect, it } from 'vitest'
import { portsFor } from '#src/shared/ship/ports/ports-for.ts'

describe('portsFor', () => {
  it('gives a checkout the same ports every time', () => {
    expect(portsFor('/Users/me/af/.claude/worktrees/ship', {})).toEqual(
      portsFor('/Users/me/af/.claude/worktrees/ship', {}),
    )
  })

  it('gives different worktrees different ports, so they never test each other’s servers', () => {
    const a = portsFor('/Users/me/af/.claude/worktrees/ship', {})
    const b = portsFor('/Users/me/af/.claude/worktrees/host', {})
    expect(a).not.toEqual(b)
  })

  it('keeps AF in 4600–4699 (server) and 4700–4799 (preview), clear of FloorFifty’s 4400 and 4500 ranges', () => {
    for (const path of ['/a', '/b/c', '/Users/me/af', 'C:\\af\\checkout']) {
      const { server, preview } = portsFor(path, {})
      expect(server).toBeGreaterThanOrEqual(4600)
      expect(server).toBeLessThan(4700)
      expect(preview).toBe(server + 100)
    }
  })

  it('uses fixed ports in GitHub Actions and lets the environment override each port', () => {
    expect(portsFor('/x', { GITHUB_ACTIONS: 'true' })).toEqual({ server: 4600, preview: 4700 })
    expect(portsFor('/x', { AF_E2E_SERVER_PORT: '5001', AF_E2E_PREVIEW_PORT: '5002' })).toEqual({
      server: 5001,
      preview: 5002,
    })
  })
})
