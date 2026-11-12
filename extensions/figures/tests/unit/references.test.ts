import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * What the painter's comments and docs point at stays true. The package moved from FigureBuilder, and its comments kept
 * the old repository's commands, documents and file paths; a reader who follows one finds nothing. So this test reads
 * every `.ts` and `.md` file of the package and holds each pointer to the code: the commands it names are scripts of
 * `package.json`, the documents and `src/` files it cites exist, and no `.ts` file calls the package by its old name.
 * (`pnpm style --docs` already follows the Markdown links; this reads the prose and the comments around them.)
 */
const ROOT = resolve(import.meta.dirname, '../..')
const REPOSITORY = resolve(ROOT, '../..')
const SELF = relative(ROOT, import.meta.filename)
// `pnpm --filter … exec` runs a binary of the package (`tsx`) rather than a script.
const SCRIPTS = Object.keys(
  (JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as { scripts: object }).scripts,
)

/** Generated declarations and installed packages are nobody's words. */
const SKIPPED = new Set(['node_modules', 'types'])
const walk = (dir: string): string[] =>
  readdirSync(join(ROOT, dir)).flatMap((name) => {
    const path = join(dir, name)
    if (SKIPPED.has(name)) return []
    return statSync(join(ROOT, path)).isDirectory() ? walk(path) : /\.(ts|md)$/.test(name) ? [path] : []
  })
const FILES = [...walk('.')]
  .filter((file) => file !== SELF)
  .map((file) => ({ file, text: readFileSync(join(ROOT, file), 'utf8') }))

/** Every match of `pattern` in the files, as `file:line  match`. */
function found(pattern: RegExp, where: (file: string) => boolean = () => true): string[] {
  return FILES.filter(({ file }) => where(file)).flatMap(({ file, text }) =>
    [...text.matchAll(pattern)].map((match) => {
      const line = text.slice(0, match.index).split('\n').length
      return `${file}:${line}  ${match[0].replace(/\s+/g, ' ')}`
    }),
  )
}

describe('the painter points at what is there', () => {
  it('names no command of another package manager or runner', () => {
    // The package is run with `pnpm --filter @automataframework/figures <script>` and its TypeScript with `tsx`.
    expect(found(/\bnpm run\b|\bnpx\b|\bvite-node\b/g)).toEqual([])
  })

  it('names only scripts that package.json has', () => {
    const named = found(/pnpm\s+--filter\s+@automataframework\/figures\s+[\w:-]+/g)
    expect(named.length).toBeGreaterThan(0)
    const missing = named.filter((hit) => ![...SCRIPTS, 'exec'].includes(hit.split(' ').pop() ?? ''))
    expect(missing).toEqual([])
  })

  it('cites only documents that exist', () => {
    // `docs/…` is the package's own folder (its contract and actors' guide) or the repository's.
    const missing = found(/(?<![\w/.-])docs\/[\w./-]+\.md/g).filter((hit) => {
      const path = hit.split('  ')[1] ?? ''
      return !existsSync(join(ROOT, path)) && !existsSync(join(REPOSITORY, path))
    })
    expect(missing).toEqual([])
  })

  it('cites only src/ files that exist', () => {
    // In code and its comments; the contract's changelog records paths as they were when each version came.
    const missing = found(/(?<![\w/#.-])src\/[\w/.-]+\.ts\b/g, (file) => file.endsWith('.ts')).filter(
      (hit) => !existsSync(join(ROOT, hit.split('  ')[1] ?? '')),
    )
    expect(missing).toEqual([])
  })

  it('cites only test and script files that exist', () => {
    // `tests/…` and `scripts/…` paths in code, comments and docs (a data file or a folder is not a file of code).
    const missing = found(/(?<![\w/#.-])(?:tests|scripts)\/[\w/.-]+\.ts\b/g).filter(
      (hit) => !existsSync(join(ROOT, hit.split('  ')[1] ?? '')),
    )
    expect(missing).toEqual([])
  })

  it('calls the package the painter, not by its old name', () => {
    expect(found(/Figure ?Builder/gi, (file) => file.endsWith('.ts'))).toEqual([])
  })

  it("puts each name of the contract's breaking-change list in the file the table gives", () => {
    // The table says where a name is defined, not where it is re-exported: a name that moved is a row to fix.
    const section =
      (FILES.find(({ file }) => file === 'docs/contract.md')?.text ?? '')
        .split('## 5.')[1]
        ?.split('## 6.')[0] ?? ''
    const rows = section.split('\n').filter((line) => /^\| .* \| `src\//.test(line))
    expect(rows.length).toBeGreaterThan(0)
    const misplaced = rows.flatMap((row) => {
      const [names = '', where = ''] = row.split('|').slice(1, 3)
      const path = /`(src\/[^`]+)`/.exec(where)?.[1] ?? ''
      const source = readFileSync(join(ROOT, path), 'utf8')
      return [...names.matchAll(/`(\w+)`/g)]
        .map((match) => match[1] ?? '')
        .filter(
          (name) =>
            !new RegExp(
              `\\b(?:function|const|let|class|type|interface|enum)\\s+${name}\\b|,\\s*${name}\\s*=`,
            ).test(source),
        )
        .map((name) => `${name} is not defined in ${path}`)
    })
    expect(misplaced).toEqual([])
  })
})
