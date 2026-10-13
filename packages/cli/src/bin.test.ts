import { existsSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { parseArgs, runCli } from './bin.ts'

describe('bin cli', () => {
  const testDir = join(process.cwd(), 'scratch-cli-test-game')

  beforeEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true })
    }
  })

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true })
    }
  })

  describe('parseArgs', () => {
    it('parses target directory with default id and title', () => {
      const parsed = parseArgs(['my-test-game'])
      expect(parsed.targetDir).toBe('my-test-game')
      expect(parsed.id).toBeUndefined()
      expect(parsed.title).toBeUndefined()
      expect(parsed.help).toBe(false)
    })

    it('parses subcommand create-game and options', () => {
      const parsed = parseArgs(['create-game', 'my-dir', '--id', 'custom-id', '--title', 'Custom Title'])
      expect(parsed.targetDir).toBe('my-dir')
      expect(parsed.id).toBe('custom-id')
      expect(parsed.title).toBe('Custom Title')
    })

    it('detects help flags', () => {
      expect(parseArgs(['--help']).help).toBe(true)
      expect(parseArgs(['-h']).help).toBe(true)
    })
  })

  describe('runCli', () => {
    it('scaffolds game when given valid arguments', async () => {
      let stdout = ''
      let stderr = ''
      const code = await runCli(['create-game', testDir, '--id', 'my-cli-game', '--title', 'My CLI Game'], {
        stdout: (msg) => {
          stdout += msg
        },
        stderr: (msg) => {
          stderr += msg
        },
      })

      expect(code).toBe(0)
      expect(stderr).toBe('')
      expect(stdout).toContain('Created game "My CLI Game" (my-cli-game)')
      expect(existsSync(join(testDir, 'package.json'))).toBe(true)
    })

    it('returns exit code 1 on missing target dir', async () => {
      let stderr = ''
      const code = await runCli([], {
        stdout: () => {},
        stderr: (msg) => {
          stderr += msg
        },
      })

      expect(code).toBe(1)
      expect(stderr).toContain('target directory is required')
    })

    it('returns exit code 1 on invalid id', async () => {
      let stderr = ''
      const code = await runCli([testDir, '--id', 'INVALID_ID'], {
        stdout: () => {},
        stderr: (msg) => {
          stderr += msg
        },
      })

      expect(code).toBe(1)
      expect(stderr).toContain('Invalid game id')
    })
  })
})
