import { tmpdir } from 'node:os'
import { describe, expect, test } from 'vitest'
import { OUTPUT_CAP, runArgv } from '#src/features/suite/node/run-argv.ts'

const node = (script: string): string[] => [process.execPath, '-e', script]
const cwd = tmpdir()

describe('runArgv', () => {
  test('gives the exit code and both outputs', async () => {
    const result = await runArgv(node('console.log("out"); console.error("err"); process.exit(3)'), { cwd })
    expect(result).toMatchObject({ code: 3, stdout: 'out\n', stderr: 'err\n', truncated: false })
    expect(result.error).toBeUndefined()
  })

  test('runs with no shell: a $ word reaches the command as written', async () => {
    const result = await runArgv([process.execPath, '-e', 'console.log(process.argv[1])', '$HOME'], { cwd })
    expect(result.stdout).toBe('$HOME\n')
  })

  test('a command that is not there is an error, not a throw', async () => {
    const result = await runArgv(['automata-no-such-command'], { cwd })
    expect(result.code).toBeUndefined()
    expect(result.error).toMatch(/ENOENT|not found/)
  })

  test(`output past ${OUTPUT_CAP} bytes is cut, and the result says so`, async () => {
    const result = await runArgv(node(`process.stdout.write("x".repeat(${OUTPUT_CAP + 5000}))`), { cwd })
    expect(result.code).toBe(0)
    expect(result.truncated).toBe(true)
    expect(result.stdout.length).toBeLessThanOrEqual(OUTPUT_CAP)
  })

  test('an abort stops the command and says why', async () => {
    const abort = new AbortController()
    const running = runArgv(node('setTimeout(() => {}, 60000)'), { cwd, signal: abort.signal })
    abort.abort('cancelled')
    const result = await running
    expect(result.code).toBeUndefined()
    expect(result.error).toBe('cancelled')
  })

  test('a command past its time is stopped', async () => {
    const result = await runArgv(node('setTimeout(() => {}, 60000)'), { cwd, timeoutMs: 200 })
    expect(result.error).toMatch(/timed out after 200 ms/)
  })

  test('an empty argv is an error', async () => {
    expect((await runArgv([], { cwd })).error).toMatch(/empty/)
  })
})
