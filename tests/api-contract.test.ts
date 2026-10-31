// @vitest-environment node
import { existsSync, readFileSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import ts from 'typescript'
import { beforeAll, describe, expect, it } from 'vitest'
import { CHEATSHEET_MODULES } from '../src/data/cheatsheet'
import sources from '../src/data/projects.json'

// The published project files are the framework's own files at `framework.ref`, copied by `pnpm sync`. The site once
// carried LICENSE, LICENSE-SCOPE.md and a `license` field the framework lacked (QB spec F-1), and this test allowed those
// three files to differ until DX.11. The sync now copies only what the framework has, so nothing may differ; after
// DX.11 adds the licence files, the next sync brings them in. The site's own MIT claim stays held by license-claim.test.ts.
function differing(): string[] {
  return sources.files.flatMap(file => {
    if (file.content === undefined) return []
    const framework = resolve('../automata-framework', file.path)
    return existsSync(framework) && readFileSync(framework, 'utf8') === file.content ? [] : [file.path]
  })
}

// The two checks below read the framework sources through one TypeScript program, built once. Built separately, each
// took about 2.5 s alone and 3.4 s in the full parallel suite on a 4-CPU Linux container, yet both passed 30 s on the
// shared af-mac runner (website#27's jobs 124432889162 and 124439260004). One program halves that work, and its build
// gets an explicit budget instead of the per-test default. The options are the union of what the two checks need:
// `allowJs` for entry points that resolve to JavaScript, `strict` and `allowImportingTsExtensions` for the examples.
// Neither changes the other check: exports and declared types do not depend on them, and only the example files are
// diagnosed.
const PROGRAM_BUDGET_MS = 120_000

/** Each documented module's entry point in the framework checkout, read from its package manifest. */
function entryPoint(mod: (typeof CHEATSHEET_MODULES)[number]): string {
  const [packageName, ...subpath] = mod.name.replace('@mcthaydt/automata-', '').split('/')
  const root = resolve('../automata-framework/packages', packageName)
  const manifest = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'))
  const entry = manifest.exports[subpath.length ? './' + subpath.join('/') : '.']
  return resolve(root, typeof entry === 'string' ? entry : entry.import ?? entry.default)
}

const entries = CHEATSHEET_MODULES.map(entryPoint)
const examples = new Map(CHEATSHEET_MODULES.map(mod => [
  resolve('../automata-framework', dirname(mod.sourcePath), `website-${mod.id}.ts`), mod.example,
]))
let program: ts.Program

beforeAll(() => {
  const options: ts.CompilerOptions = {
    target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler, strict: true, noEmit: true,
    skipLibCheck: true, allowImportingTsExtensions: true, allowJs: true,
  }
  const host = ts.createCompilerHost(options)
  const readFile = host.readFile.bind(host)
  const fileExists = host.fileExists.bind(host)
  const getSourceFile = host.getSourceFile.bind(host)
  host.readFile = path => examples.get(path) ?? readFile(path)
  host.fileExists = path => examples.has(path) || fileExists(path)
  host.getSourceFile = (path, languageVersion, onError, shouldCreateNewSourceFile) => examples.has(path)
    ? ts.createSourceFile(path, examples.get(path)!, languageVersion, true)
    : getSourceFile(path, languageVersion, onError, shouldCreateNewSourceFile)
  program = ts.createProgram([...entries, ...examples.keys()], options, host)
  program.getTypeChecker()
}, PROGRAM_BUDGET_MS)

describe('Published code contracts', () => {
  it('publishes the exact current project files instead of independently maintained snippets', () => {
    expect(differing()).toEqual([])
  })

  it('only lists names exported by the documented entry point or actual Sim methods', () => {
    CHEATSHEET_MODULES.forEach((mod, i) => expect(mod.sourcePath).toBe(relative(resolve('../automata-framework'), entries[i])))
    const checker = program.getTypeChecker()
    CHEATSHEET_MODULES.forEach((mod, i) => {
      const symbol = checker.getSymbolAtLocation(program.getSourceFile(entries[i])!)!
      const exports = checker.getExportsOfModule(symbol)
      for (const entry of mod.entries) {
        if (entry.receiver) {
          const owner = exports.find(symbol => symbol.name === entry.receiver)!
          const type = checker.getDeclaredTypeOfSymbol(checker.getAliasedSymbol(owner))
          expect(type.getProperties().map(property => property.name), entry.name).toContain(entry.name)
        } else expect(exports.map(symbol => symbol.name), mod.name + ': ' + entry.name).toContain(entry.name)
      }
    })
  })

  it('typechecks every published module example against the framework sources', () => {
    // Check the published examples directly; checking every imported dependency first
    // does unrelated work that was discarded by the previous diagnostic filter.
    const diagnostics = [...program.getOptionsDiagnostics(), ...[...examples.keys()].flatMap(path => {
      const file = program.getSourceFile(path)!
      return [...program.getSyntacticDiagnostics(file), ...program.getSemanticDiagnostics(file)]
    })]
    expect(ts.formatDiagnostics(diagnostics, { getCurrentDirectory: () => '', getCanonicalFileName: path => path, getNewLine: () => '\n' })).toBe('')
  })
})
