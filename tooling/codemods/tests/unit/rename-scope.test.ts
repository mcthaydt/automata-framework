import { describe, expect, it } from 'vitest'
import { keepsOldNames, needsALook, oldNameCount, renameScope } from '#src/rename-scope.ts'

// The scope codemod's table: one case per form the old scope is written in, and one per look-alike it must leave alone.

describe('renameScope', () => {
  it('moves every package name and subpath into the new scope', () => {
    expect(renameScope("import { defineGame } from '@automata/framework'")).toBe(
      "import { defineGame } from '@automataframework/framework'",
    )
    expect(renameScope("from '@automata/framework/2d'")).toBe("from '@automataframework/framework/2d'")
    expect(renameScope('"@automata/sim": "workspace:*"')).toBe('"@automataframework/sim": "workspace:*"')
    expect(renameScope('pnpm --filter @automata/site check:launch')).toBe(
      'pnpm --filter @automataframework/site check:launch',
    )
    expect(renameScope('"@automata/framework#build"')).toBe('"@automataframework/framework#build"')
    expect(renameScope("'@automata/framework': minor")).toBe("'@automataframework/framework': minor")
  })

  it('moves the bare scope: a folder, a quoted scope, a registry scope and prose', () => {
    expect(renameScope("join(project, 'node_modules/@automata')")).toBe(
      "join(project, 'node_modules/@automataframework')",
    )
    expect(renameScope("{ '@automata': 'https://npm.pkg.github.com' }")).toBe(
      "{ '@automataframework': 'https://npm.pkg.github.com' }",
    )
    expect(renameScope('scope: "@automata"')).toBe('scope: "@automataframework"')
    expect(renameScope('the `@automata` organisation')).toBe('the `@automataframework` organisation')
    expect(renameScope("git tag --list '@automata/*'")).toBe("git tag --list '@automataframework/*'")
  })

  it('keeps escaped slashes in regular expressions', () => {
    expect(renameScope('/^@automata\\/content$/')).toBe('/^@automataframework\\/content$/')
  })

  it('renames npm pack file names the way npm derives them from the new names', () => {
    expect(renameScope('packs/automata-sim-0.0.1.tgz')).toBe('packs/automataframework-sim-0.0.1.tgz')
    expect(renameScope("file: 'automata-editor-0.0.0.tgz'")).toBe(
      "file: 'automataframework-editor-0.0.0.tgz'",
    )
    expect(renameScope('/automata-tools-.*\\.tgz$/')).toBe('/automataframework-tools-.*\\.tgz$/')
  })

  it('leaves the look-alikes that are not the npm scope alone', () => {
    const kept = [
      'hello@automataframework.com',
      'claude plugin install automata@automata-framework',
      'https://github.com/mcthaydt/automata-framework',
      'https://github.com/mcthaydt/automata-skills.git',
      '"name": "automata-framework"',
      'automata-check-boundaries --features site',
      'pnpm exec automata editor',
      '"@af-games/emberwick": "workspace:*"',
      'the-automata-key-123',
      '@mcthaydt/*',
    ].join('\n')
    expect(renameScope(kept)).toBe(kept)
  })

  it('changes nothing on a second run', () => {
    const once = renameScope(
      "'@automata/framework' node_modules/@automata /^@automata\\/x$/ packs/automata-sim-0.0.1.tgz",
    )
    expect(renameScope(once)).toBe(once)
  })
})

describe('oldNameCount', () => {
  it('counts each old name the rules would rewrite, so the CLI can report how many it changed', () => {
    expect(oldNameCount("'@automata/sim' '@automata/tools' packs/automata-sim-0.0.1.tgz")).toBe(3)
    expect(oldNameCount("'@automataframework/sim' hello@automataframework.com")).toBe(0)
  })
})

describe('needsALook', () => {
  it('flags regular expressions and pack-name patterns, which a person checks by eye', () => {
    expect(needsALook('/^@automata\\/content$/')).toBe(true)
    expect(needsALook('/automata-tools-.*\\.tgz$/')).toBe(true)
    expect(needsALook("'@automata/framework'")).toBe(false)
  })
})

describe('keepsOldNames', () => {
  it('keeps the dated records, the changelogs, the lockfile and the codemod itself', () => {
    expect(keepsOldNames('docs/archive/2026-10-01-master-spec.md')).toBe(true)
    expect(keepsOldNames('docs/refactor/progress.md')).toBe(true)
    expect(keepsOldNames('docs/superpowers/audits/2026-11-12-ship-readiness.md')).toBe(true)
    expect(keepsOldNames('packages/sim/CHANGELOG.md')).toBe(true)
    expect(keepsOldNames('pnpm-lock.yaml')).toBe(true)
    expect(keepsOldNames('tooling/codemods/src/rename-scope.ts')).toBe(true)
    expect(keepsOldNames('tooling/codemods/tests/unit/rename-scope.test.ts')).toBe(true)
    expect(keepsOldNames('tooling/codemods/tests/unit/scope-hygiene.test.ts')).toBe(true)
  })

  it('rewrites everything else, changesets and workflows included', () => {
    expect(keepsOldNames('packages/sim/package.json')).toBe(false)
    expect(keepsOldNames('docs/guides/quick-start.md')).toBe(false)
    expect(keepsOldNames('.changeset/first-public-release.md')).toBe(false)
    expect(keepsOldNames('.github/workflows/ci.yml')).toBe(false)
    expect(keepsOldNames('AGENTS.md')).toBe(false)
  })
})
