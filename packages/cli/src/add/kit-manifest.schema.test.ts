import { describe, expect, it } from 'vitest'
import { kitManifestSchema } from './kit-manifest.schema.ts'

const valid = {
  name: 'results-screen',
  requires: { core: '>=0.0.2' },
  files: [
    { from: 'src/results.screen.ts', to: 'src/ui/results.screen.ts' },
    { from: 'content/results.toml', to: 'content/ui/results.toml' },
  ],
}

const problems = (input: unknown): string[] => {
  const result = kitManifestSchema.safeParse(input)
  return result.success ? [] : result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`)
}

describe('kitManifestSchema', () => {
  it('reads a kit.json', () => {
    expect(kitManifestSchema.parse(valid)).toEqual(valid)
    expect(kitManifestSchema.parse({ ...valid, requires: { core: '^0.0.2 || >=1.0.0' } }).requires.core).toBe(
      '^0.0.2 || >=1.0.0',
    )
  })

  it('needs requires.core, as a semver range', () => {
    const { requires: _, ...withoutRequires } = valid
    expect(problems(withoutRequires)).toEqual([
      'requires: Invalid input: expected object, received undefined',
    ])
    expect(problems({ ...valid, requires: { core: 'latest' } })).toEqual([
      'requires.core: must be a semver range, such as >=0.0.2',
    ])
  })

  it('needs at least one file and a kit name', () => {
    expect(problems({ ...valid, files: [] })).toEqual(['files: a kit copies at least one file'])
    expect(problems({ ...valid, name: '../x' })).toEqual([
      'name: must be lowercase letters, digits and single hyphens',
    ])
  })

  it('refuses a path that is absolute, climbs out with .., or is not a plain relative path', () => {
    const badPaths = [
      '/etc/passwd',
      '../outside.ts',
      'src/../../outside.ts',
      'src/./a.ts',
      'src//a.ts',
      'src\\a.ts',
      'C:/game/a.ts',
      'src/a.ts/',
      '',
    ]
    for (const path of badPaths) {
      expect(problems({ ...valid, files: [{ from: path, to: 'src/a.ts' }] }), path).toEqual([
        'files.0.from: must be a relative path inside the folder, with / between names and no . or .. parts',
      ])
      expect(problems({ ...valid, files: [{ from: 'a.ts', to: path }] }), path).toEqual([
        'files.0.to: must be a relative path inside the folder, with / between names and no . or .. parts',
      ])
    }
  })

  it('refuses a destination in .git or node_modules, where a kit could plant code that runs', () => {
    for (const to of [
      '.git/hooks/pre-commit',
      'node_modules/.bin/tsc',
      'src/Node_Modules/a.ts',
      '.GIT/config',
    ]) {
      expect(problems({ ...valid, files: [{ from: 'a.ts', to }] }), to).toEqual([
        'files.0.to: may not write into .git or node_modules',
      ])
    }
  })

  it('refuses two files with one destination, including names that differ only in case', () => {
    expect(
      problems({
        ...valid,
        files: [
          { from: 'a.ts', to: 'src/a.ts' },
          { from: 'b.ts', to: 'src/a.ts' },
          { from: 'c.ts', to: 'src/A.ts' },
        ],
      }),
    ).toEqual([
      'files.1.to: src/a.ts is also the destination of files.0',
      'files.2.to: src/A.ts is also the destination of files.0',
    ])
  })
})
