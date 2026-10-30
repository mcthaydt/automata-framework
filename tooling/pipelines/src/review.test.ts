import { rmSync } from 'node:fs'
import { afterEach, describe, expect, it } from 'vitest'
import { mcpProject, TOY } from './testing/mcp-client.ts'

// pipeline_request_review (M3 spec §4.8 and §7; The Last Light's tests/mcp-server.test.ts at 92e6704): a pending gate
// is put to the person through MCP elicitation, and only their answer decides it. The states: asked, approved,
// rejected, cancelled (declined, cancelled, no decision) and timed out, the last three "the owner did not decide".

const temps: string[] = []
afterEach(() => {
  for (const dir of temps.splice(0)) rmSync(dir, { recursive: true, force: true })
})
const review = { ...TOY, gate: 'T1' }

describe('pipeline_request_review', () => {
  it("without elicitation, records the request, names the person's command and decides nothing", async () => {
    const { call, gates } = await mcpProject(temps)
    await call('pipeline_run', TOY)
    const asked = await call('pipeline_request_review', review)
    expect(asked.error).toBe(false)
    expect(asked.data).toMatchObject({
      decision: 'pending',
      outcome: 'asked',
      ownerCommand: 'automata-pipe toy approve toy T1 --note "…"   (or reject)',
    })
    expect(asked.data.instructions).toMatch(/Only the person decides.*Do not run it yourself/)
    expect(gates().T1).toMatchObject({
      decision: 'pending',
      requestedAt: expect.any(String),
      summary: 'toy gate T1 (stage two) on toy: review two.txt',
    })
    expect((await call('pipeline_review_status', review)).data).toMatchObject({
      id: 'T1',
      decision: 'pending',
    })
  })

  it("with elicitation, records the person's approval and the next run goes on", async () => {
    const { call, gates, prompts, auditLines } = await mcpProject(temps, {
      answer: () => ({ action: 'accept', content: { decision: 'approve', note: 'looks right' } }),
    })
    await call('pipeline_run', TOY)
    const decided = await call('pipeline_request_review', review)
    expect(decided.data).toMatchObject({ decision: 'approved', outcome: 'approved' })
    expect(prompts).toEqual([
      "toy gate T1 (stage two) on toy: review two.txt\n\nApprove or reject gate T1? Your answer is recorded as the owner's decision.",
    ])
    expect(gates().T1).toMatchObject({ decision: 'approved', by: 'owner', note: 'looks right' })
    expect((await call('pipeline_review_status', review)).data).toMatchObject({ decision: 'approved' })
    expect(auditLines().find((line) => line.tool === 'pipeline_request_review')).toMatchObject({
      ok: true,
      summary: 'T1 approved by the owner',
    })
    // The paid stage still needs an estimate: the review approves the gate, never a spend.
    expect((await call('pipeline_run', TOY)).data.exit).toBe(4)
  })

  it('records a rejection, and the next run makes the stage again and asks again', async () => {
    const { call, gates } = await mcpProject(temps, {
      answer: () => ({ action: 'accept', content: { decision: 'reject', note: 'darker' } }),
    })
    await call('pipeline_run', TOY)
    expect((await call('pipeline_request_review', review)).data).toMatchObject({ decision: 'rejected' })
    expect(gates().T1).toMatchObject({ decision: 'rejected', note: 'darker' })
    const rerun = await call('pipeline_run', TOY)
    expect(rerun.data.exit).toBe(3)
    expect(gates().T1).toMatchObject({ decision: 'pending' })
  })

  it.each([
    ['decline', { action: 'decline' as const }, 'declined'],
    ['cancel', { action: 'cancel' as const }, 'cancelled'],
    ['accept without a decision', { action: 'accept' as const, content: { note: 'hmm' } }, 'no decision'],
  ])('leaves the gate pending on %s', async (_, answer, why) => {
    const { call, gates, auditLines } = await mcpProject(temps, { answer: () => answer })
    await call('pipeline_run', TOY)
    const undecided = await call('pipeline_request_review', review)
    expect(undecided.error).toBe(false)
    expect(undecided.data).toMatchObject({ decision: 'pending', outcome: why })
    expect(undecided.data.ownerCommand).toMatch(/approve toy T1/)
    expect(gates().T1?.decision).toBe('pending')
    expect(auditLines().at(-1)?.summary).toBe(`T1: the owner did not decide (${why})`)
  })

  it('times out when the form is left unanswered, and a late answer records nothing', async () => {
    const late = () =>
      new Promise<{ action: 'accept'; content: { decision: string } }>((done) =>
        setTimeout(() => done({ action: 'accept', content: { decision: 'approve' } }), 600),
      )
    const { call, gates } = await mcpProject(temps, { answer: late, reviewTimeoutMs: 100 })
    await call('pipeline_run', TOY)
    const timedOut = await call('pipeline_request_review', review)
    expect(timedOut.error).toBe(false)
    expect(timedOut.data).toMatchObject({ decision: 'pending', outcome: 'timed out' })
    await new Promise((done) => setTimeout(done, 800))
    expect(gates().T1?.decision).toBe('pending')
  })

  it('answers with the decision already made, and refuses an unknown gate', async () => {
    const { call, personApproves, prompts } = await mcpProject(temps, {
      answer: () => ({ action: 'accept', content: { decision: 'reject' } }),
    })
    await call('pipeline_run', TOY)
    await personApproves('T1')
    const already = await call('pipeline_request_review', review)
    expect(already.data).toMatchObject({ decision: 'approved', outcome: 'already decided' })
    expect(prompts).toEqual([])
    const unknown = await call('pipeline_request_review', { ...TOY, gate: 'G9' })
    expect([unknown.error, unknown.data.exit, unknown.data.error]).toEqual([
      true,
      1,
      "no gate 'G9' for this target",
    ])
    expect((await call('pipeline_review_status', { ...TOY, gate: 'G9' })).error).toBe(true)
  })
})
