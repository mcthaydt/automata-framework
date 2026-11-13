import { spawnSync } from 'node:child_process'
import { relative, resolve } from 'node:path'
import { expect, it } from 'vitest'
import { examplesIndexEvidenceDir } from '../../host/evidence-dir.ts'

const repoRoot = resolve(import.meta.dirname, '../../../..')

// The runner's e2e used to resolve `../../../evidence/` from its own folder, which is `tooling/evidence/`, inside the
// `@automata/evidence` package and outside .gitignore, so every run left untracked PNGs for the next `git add` to sweep up.
it('saves the index screenshots in the repository root evidence folder, which git ignores', () => {
  const ignored = spawnSync(
    'git',
    ['check-ignore', '--quiet', '--no-index', resolve(examplesIndexEvidenceDir, 'index-runner.png')],
    {
      cwd: repoRoot,
    },
  )
  expect(ignored.status, 'git check-ignore says the screenshots are not ignored').toBe(0)
  expect(relative(repoRoot, examplesIndexEvidenceDir)).toBe('evidence/examples-index')
})
