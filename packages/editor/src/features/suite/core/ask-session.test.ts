import { describe, expect, test, vi } from 'vitest'
import { createWritePath } from '../../../shared/editor-list/write-path'
import type { SuiteAskTarget } from '../../../shared/kit/ports/suite-editor.ts'
import type { Proposal, UnlistedFile, WorkspaceFile } from '../../../shared/kit/ports/suite-ports.ts'
import type { MemoryCheck } from '../../../testing/ports/memory-checks.ts'
import { createMemoryPorts } from '../../../testing/ports/memory-ports.ts'
import { type AskSession, createAskSession } from './ask-session'

const TUNING = 'content/tuning.toml'
const NEVER = 'content/secrets.toml'
const START = '# speeds\nMAX_MOVE_SPEED = 7\nJUMP = 3\n'

const classify = (path: string): WorkspaceFile | UnlistedFile => {
  if (path === TUNING)
    return { path, editor: 'tuner', gates: [], checks: ['speed'], modes: ['edit', 'ask'], writable: true }
  if (path === NEVER)
    return {
      path,
      editor: 'tuner',
      gates: [],
      checks: [],
      modes: ['ask'],
      writable: false,
      why: 'a never path',
    }
  return { path, writable: false, why: 'no row' }
}

const SPEED: MemoryCheck = {
  id: 'speed',
  when: 'before',
  run: ['speed'],
  joins: [],
  measure: false,
  respond: ({ candidates }) =>
    /MAX_MOVE_SPEED = 1\d/.test(candidates[0]?.text ?? '')
      ? {
          status: 'fail',
          findings: [{ path: TUNING, line: 2, severity: 'error', message: 'too fast' }],
          output: '',
        }
      : { status: 'pass', findings: [], output: '' },
}

/** A session over an editor holding `TUNING`; `reply` answers each request, or a promise the test settles. */
async function setup(
  reply: (prompt: string) => Promise<Proposal> | Proposal,
  options: { path?: string; locked?: string[]; ask?: false; cap?: number } = {},
) {
  const memory = await createMemoryPorts({
    files: { [TUNING]: START, [NEVER]: 'key = 1\n' },
    classify,
    checks: [SPEED],
    ...(options.ask === false ? {} : { ask: (request) => reply(request.prompt) }),
    changeSet: { tokenCap: options.cap ?? 1000 },
  })
  await memory.ports.changeSet?.begin('Faster')
  const editor = { text: START, accepted: [] as string[] }
  const target: SuiteAskTarget = {
    path: options.path ?? TUNING,
    text: () => editor.text,
    scope: () => ['MAX_MOVE_SPEED'],
    locked: () => options.locked ?? [],
    accept: (text, summary) => {
      editor.text = text
      editor.accepted.push(summary)
    },
  }
  const writePath = createWritePath({ ports: memory.ports, title: async () => 'Faster' })
  const session = createAskSession({ target, ports: memory.ports, writePath })
  return { ...memory, editor, writePath, session }
}

const proposal = (text: string, tokens = 100): Proposal => ({ summary: 'Raise the speed', text, tokens })
const used = async (changeSet: { list(): Promise<readonly { tokens: { used: number } }[]> } | undefined) =>
  (await changeSet?.list())?.[0]?.tokens.used

function shown(session: AskSession | undefined) {
  const state = session?.state()
  if (state?.kind !== 'shown') throw new Error(`expected a shown proposal, got ${state?.kind}`)
  return state
}

describe('the Ask session (flow 5)', () => {
  test('no provider: no session, so no Ask button', async () => {
    const { session } = await setup(() => proposal(START), { ask: false })
    expect(session).toBeUndefined()
  })

  test('a passing proposal shows its diff and checks; Accept writes once as one step and undo restores it (EDS-f)', async () => {
    const { session, ports, editor, writePath, changeSet } = await setup(() =>
      proposal(START.replace('= 7', '= 8')),
    )
    await session?.ask('a bit faster')
    const state = shown(session)
    expect(state.refusal).toBeUndefined()
    expect(state.tokens).toBe(100)
    expect(state.hunks[0]?.lines.filter((line) => line.kind !== 'same').map((line) => line.text)).toEqual([
      'MAX_MOVE_SPEED = 7\n',
      'MAX_MOVE_SPEED = 8\n',
    ])
    expect(state.results.map((result) => result.status)).toEqual(['pass'])
    expect(await session?.accept()).toMatchObject({ written: true })
    expect(session?.state().kind).toBe('idle')
    expect(editor.accepted).toEqual(['Raise the speed'])
    expect((await ports.workspace.read(TUNING))?.text).toBe(START.replace('= 7', '= 8'))
    expect((await changeSet?.list())?.[0]?.writes).toHaveLength(1)
    expect(writePath.undoLabel()).toBe('Raise the speed')
    await writePath.undo()
    expect((await ports.workspace.read(TUNING))?.text).toBe(START)
  })

  test('a proposal changing a locked value is refused with the key, and Accept writes nothing (EDS-d)', async () => {
    const { session, ports } = await setup(() => proposal(START.replace('JUMP = 3', 'JUMP = 4')), {
      locked: ['MAX_MOVE_SPEED', 'JUMP'],
    })
    await session?.ask('jump higher')
    expect(shown(session).refusal).toEqual({ kind: 'locked', key: 'JUMP' })
    expect(await session?.accept()).toBeUndefined()
    expect((await ports.workspace.read(TUNING))?.text).toBe(START)
  })

  test('a failing before check shows its finding at its line with Accept off; Rewrite sends the findings (EDS-e)', async () => {
    const prompts: string[] = []
    const { session, ports } = await setup((prompt) => {
      prompts.push(prompt)
      return proposal(START.replace('= 7', prompts.length === 1 ? '= 12' : '= 9'))
    })
    await session?.ask('much faster')
    const state = shown(session)
    expect(state.refusal).toEqual({ kind: 'checks' })
    expect(state.findings).toMatchObject([{ line: 2, message: 'too fast' }])
    expect(await session?.accept()).toBeUndefined()
    expect((await ports.workspace.read(TUNING))?.text).toBe(START)
    await session?.rewrite()
    expect(prompts[1]).toContain('much faster')
    expect(prompts[1]).toContain('too fast')
    expect(shown(session).refusal).toBeUndefined()
  })

  test('a target on a never path is refused with the path, and nothing is written (EDS-n)', async () => {
    const { session, ports } = await setup(() => proposal('key = 2\n'), { path: NEVER })
    await session?.ask('change it')
    expect(shown(session).refusal).toEqual({ kind: 'policy', path: NEVER, why: 'a never path' })
    expect(await session?.accept()).toBeUndefined()
    expect((await ports.workspace.read(NEVER))?.text).toBe('key = 1\n')
  })

  test('a proposal over the budget is refused before it is shown, and its tokens stay spent', async () => {
    const { session, changeSet } = await setup(() => proposal(START, 1500), { cap: 1000 })
    await session?.ask('rewrite it all')
    expect(session?.state()).toEqual({ kind: 'over-budget', tokens: 1500, budget: 1000 })
    expect(await used(changeSet)).toBe(1500)
  })

  test('with nothing left of the cap, nothing is sent', async () => {
    const { session, ask, changeSet } = await setup(() => proposal(START, 10), { cap: 1000 })
    await changeSet?.spend(1000)
    await session?.ask('one more')
    expect(session?.state()).toEqual({ kind: 'over-budget', tokens: 0, budget: 0 })
    expect(ask?.calls).toEqual([])
  })

  test('an edit while asking drops the reply; Reject leaves the document and keeps the tokens', async () => {
    let settle: (value: Proposal) => void = () => undefined
    const { session, editor, changeSet, ports, ask } = await setup(
      () =>
        new Promise<Proposal>((resolve) => {
          settle = resolve
        }),
    )
    const asking = session?.ask('faster')
    expect(session?.state().kind).toBe('asking')
    await vi.waitFor(() => expect(ask?.calls).toHaveLength(1))
    editor.text = START.replace('JUMP = 3', 'JUMP = 5')
    session?.drop()
    settle(proposal(START.replace('= 7', '= 8')))
    await asking
    expect(session?.state().kind).toBe('idle')

    const second = session?.ask('faster')
    await vi.waitFor(() => expect(ask?.calls).toHaveLength(2))
    settle(proposal(START.replace('= 7', '= 8'), 50))
    await second
    session?.reject()
    expect(session?.state().kind).toBe('idle')
    expect((await ports.workspace.read(TUNING))?.text).toBe(START)
    expect((await changeSet?.list())?.[0]?.writes).toEqual([])
    expect(await used(changeSet)).toBe(150)
  })

  test('the provider failing shows its reason, and the document is untouched', async () => {
    const { session, editor } = await setup(() => {
      throw new Error('the assistant is unreachable')
    })
    await session?.ask('faster')
    expect(session?.state()).toEqual({ kind: 'failed', reason: 'the assistant is unreachable' })
    expect(editor.text).toBe(START)
  })

  test('listeners hear each change of state', async () => {
    const { session } = await setup(() => proposal(START.replace('= 7', '= 8')))
    const kinds: string[] = []
    session?.subscribe(() => kinds.push(session.state().kind))
    await session?.ask('faster')
    expect(kinds).toEqual(['asking', 'shown'])
  })
})
