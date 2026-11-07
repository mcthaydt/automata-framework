import { describe, expect, it } from 'vitest'
import { hasPatternForm, keepsOldNames, renameScope } from '#src/rename-scope.ts'

// 2D editors and site plan, task 14.1: the scope codemod's table, one case per rule and per thing it must leave alone.

describe('renameScope', () => {
  it('moves the main package to @automata/framework, subpaths and all', () => {
    expect(renameScope("import { defineGame } from '@mcthaydt/automata'")).toBe(
      "import { defineGame } from '@automata/framework'",
    )
    expect(renameScope("from '@mcthaydt/automata/2d'")).toBe("from '@automata/framework/2d'")
    expect(renameScope('"@mcthaydt/automata#build"')).toBe('"@automata/framework#build"')
  })

  it('drops the automata- prefix from every other package', () => {
    expect(renameScope('"@mcthaydt/automata-sim": "workspace:*"')).toBe('"@automata/sim": "workspace:*"')
    expect(renameScope('pnpm dlx @mcthaydt/automata-tools create-game')).toBe(
      'pnpm dlx @automata/tools create-game',
    )
    expect(renameScope("'@mcthaydt/automata-editor-3d/kit'")).toBe("'@automata/editor-3d/kit'")
    // The `${name}` is the text of a template literal in someone's source, not a placeholder here.
    const source = ['`@mcthaydt/automata-<name>`', '`@mcthaydt/automata-$', '{name}`'].join('')
    expect(renameScope(source)).toBe(['`@automata/<name>`', '`@automata/$', '{name}`'].join(''))
  })

  it('moves the private tooling packages into the same scope', () => {
    expect(renameScope('"@mcthaydt/vitest-preset": "workspace:*"')).toBe(
      '"@automata/vitest-preset": "workspace:*"',
    )
    expect(renameScope("git tag --list '@mcthaydt/*'")).toBe("git tag --list '@automata/*'")
  })

  it('renames npm pack file names the way npm derives them from the new names', () => {
    expect(renameScope('packs/mcthaydt-automata-sim-0.0.1.tgz')).toBe('packs/automata-sim-0.0.1.tgz')
    expect(renameScope('mcthaydt-automata-0.0.5.tgz')).toBe('automata-framework-0.0.5.tgz')
  })

  it('keeps escaped slashes in regular expressions', () => {
    expect(renameScope('/^@mcthaydt\\/automata-content$/')).toBe('/^@automata\\/content$/')
  })

  it('leaves the registry scope, the GitHub owner and the repository slug alone', () => {
    const kept = [
      '@mcthaydt:registry=https://npm.pkg.github.com',
      'https://github.com/mcthaydt/automata-framework',
      'actions.runner.mcthaydt-automata-framework.owner-pc-wsl-af',
      '* @mcthaydt',
    ].join('\n')
    expect(renameScope(kept)).toBe(kept)
  })
})

describe('hasPatternForm', () => {
  it('flags a regular expression built on the old main-package prefix, for a person to check', () => {
    expect(hasPatternForm('/^@mcthaydt\\/automata(?:-([a-z0-9-]+))?$/')).toBe(true)
    expect(hasPatternForm('/^@mcthaydt\\/automata-content$/')).toBe(false)
    expect(hasPatternForm("'@mcthaydt/automata'")).toBe(false)
  })
})

describe('keepsOldNames', () => {
  it('keeps the history and the codemod itself', () => {
    expect(keepsOldNames('docs/archive/2026-10-01-master-spec.md')).toBe(true)
    expect(keepsOldNames('docs/refactor/progress.md')).toBe(true)
    expect(keepsOldNames('packages/sim/CHANGELOG.md')).toBe(true)
    expect(keepsOldNames('tooling/codemods/src/rename-scope.ts')).toBe(true)
    expect(keepsOldNames('tooling/release/tests/unit/scope.test.ts')).toBe(true)
  })

  it('rewrites everything else', () => {
    expect(keepsOldNames('packages/sim/package.json')).toBe(false)
    expect(keepsOldNames('docs/guides/quick-start.md')).toBe(false)
    expect(keepsOldNames('AGENTS.md')).toBe(false)
  })
})
