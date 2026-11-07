import { execFileSync } from 'node:child_process'
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { parse } from 'yaml'
import type { DistTarget } from '#src/shared/create-game/create-game-targets.ts'
import { TEMPLATE_FILES } from '#src/shared/create-game/template.ts'

// A new game carries its own release workflow (`.github/workflows/release.yml`): on a version tag it checks and builds
// the game on GitHub's own runner and, for a game that builds for itch.io, pushes it there once BUTLER_API_KEY is set.

interface Step {
  readonly run?: string
  readonly if?: string
  readonly uses?: string
}
interface Job {
  readonly 'runs-on': string
  readonly needs?: string
  readonly steps: readonly Step[]
}
interface Workflow {
  readonly on: { readonly push: { readonly tags: readonly string[] } }
  readonly permissions: Record<string, string>
  readonly jobs: Record<string, Job>
}

const releaseText = (targets?: readonly DistTarget[]): string => {
  const file = TEMPLATE_FILES.find((tpl) => tpl.path === '.github/workflows/release.yml')
  if (file === undefined) throw new Error('create-game writes no .github/workflows/release.yml')
  return file.content({ id: 'my-game', title: 'My Game', targets })
}
const release = (targets?: readonly DistTarget[]): Workflow => parse(releaseText(targets)) as Workflow
const runs = (job: Job | undefined): readonly string[] => (job?.steps ?? []).flatMap((step) => step.run ?? [])

const scratch: string[] = []
afterAll(() => {
  for (const dir of scratch) rmSync(dir, { recursive: true, force: true })
})

describe("a new game's release workflow", () => {
  it('runs on a version tag, on GitHub’s own runner, reading nothing but the code', () => {
    const workflow = release()
    expect(workflow.on).toEqual({ push: { tags: ['v*'] } })
    expect(workflow.permissions).toEqual({ contents: 'read' })
    for (const job of Object.values(workflow.jobs)) expect(job['runs-on']).toBe('ubuntu-latest')
  })

  it('checks the game and builds it for the web', () => {
    expect(runs(release().jobs.build)).toEqual([
      'pnpm install --frozen-lockfile',
      'pnpm check',
      'pnpm build:web',
    ])
  })

  it('pushes to itch.io after the build, only when BUTLER_API_KEY is set', () => {
    const itch = release().jobs.itch
    expect(itch?.needs).toBe('build')
    const publish = itch?.steps.find((step) => step.run?.includes('ship publish --target itch'))
    expect(publish?.if).toBe("steps.key.outputs.present == 'true'")
    expect(runs(itch).join('\n')).toContain('pnpm build:itch')
    // Its secret stays in the one step that needs it (the repository's workflow rule).
    expect(releaseText().match(/secrets\.BUTLER_API_KEY/g)).toHaveLength(2)
  })

  it('has no itch.io job in a game that does not build for itch.io, and no web build in one without the web', () => {
    expect(Object.keys(release(['web']).jobs)).toEqual(['build'])
    expect(runs(release(['itch', 'ruken']).jobs.build)).toEqual([
      'pnpm install --frozen-lockfile',
      'pnpm check',
    ])
    expect(releaseText(['web'])).not.toMatch(/:begin|:end/)
  })

  // actionlint runs in Docker, which a session may not have; the YAML parse above is the check then.
  it.skipIf(!hasDocker())('passes actionlint', () => {
    const dir = mkdtempSync(join(tmpdir(), 'af-release-'))
    scratch.push(dir)
    // mkdtemp makes the folder readable by its owner only, and actionlint's image runs as another user: open it up.
    chmodSync(dir, 0o755)
    writeFileSync(join(dir, 'release.yml'), releaseText(), { mode: 0o644 })
    execFileSync('docker', [
      'run',
      '--rm',
      '-v',
      `${dir}:/repo`,
      '-w',
      '/repo',
      'rhysd/actionlint:1.7.12@sha256:b1934ee5f1c509618f2508e6eb47ee0d3520686341fec936f3b79331f9315667',
      'release.yml',
    ])
  })
})

function hasDocker(): boolean {
  try {
    execFileSync('docker', ['info'], { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}
