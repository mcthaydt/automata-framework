import { describe, expect, it } from 'vitest'
import { FILE_VERSION, MIGRATIONS, type Migration, migrate } from './migration'

const step = (from: number, tag: string): Migration => ({
  from,
  to: from + 1,
  run: (raw) => ({ ...raw, trail: `${String(raw.trail ?? '')}${tag}` }),
})

describe('migrate', () => {
  it('hands back a file already at the target version unchanged', () => {
    const raw = { version: 3, name: 'x' }
    expect(migrate(raw, 3, 3, [])).toEqual({ ok: true, raw })
  })

  it('runs each step once, in version order, however the chain is listed', () => {
    const chain = [step(3, 'c'), step(1, 'a'), step(2, 'b')]
    const result = migrate({ version: 1 }, 1, 4, chain)
    expect(result).toEqual({ ok: true, raw: { version: 4, trail: 'abc' } })
  })

  it('stops at the target, not at the end of the chain', () => {
    const result = migrate({ version: 1 }, 1, 2, [step(1, 'a'), step(2, 'b')])
    expect(result).toEqual({ ok: true, raw: { version: 2, trail: 'a' } })
  })

  it('stamps the new version itself, so a step cannot forget or lie', () => {
    const lying: Migration = { from: 1, to: 2, run: (raw) => ({ ...raw, version: 9 }) }
    expect(migrate({ version: 1 }, 1, 2, [lying])).toEqual({ ok: true, raw: { version: 2 } })
  })

  it('names the version a gap leaves without a step', () => {
    const result = migrate({ version: 1 }, 1, 4, [step(1, 'a'), step(3, 'c')])
    expect(result).toMatchObject({ ok: false })
    expect(result.ok ? '' : result.message).toMatch(/version 2/)
  })

  it('reports a step that throws, with the version it was upgrading', () => {
    const broken: Migration = {
      from: 1,
      to: 2,
      run: () => {
        throw new Error('no such field')
      },
    }
    const result = migrate({ version: 1 }, 1, 2, [broken])
    expect(result).toMatchObject({ ok: false })
    expect(result.ok ? '' : result.message).toMatch(/version 1.*no such field/)
  })

  it('refuses a chain with a step that does not advance by one, or two steps from one version', () => {
    const jump: Migration = { from: 1, to: 3, run: (raw) => raw }
    const stay: Migration = { from: 2, to: 2, run: (raw) => raw }
    expect(() => migrate({ version: 1 }, 1, 3, [jump])).toThrow(/advance by one/)
    expect(() => migrate({ version: 1 }, 1, 3, [stay])).toThrow(/advance by one/)
    expect(() => migrate({ version: 1 }, 1, 3, [step(1, 'a'), step(1, 'b')])).toThrow(/more than one/)
  })
})

describe('the real chain', () => {
  it('is empty at file version 1: there is nothing older to upgrade', () => {
    expect(FILE_VERSION).toBe(1)
    expect(MIGRATIONS).toEqual([])
    expect(migrate({ version: 1 }, 1, FILE_VERSION, MIGRATIONS)).toMatchObject({ ok: true })
  })
})
