// @vitest-environment node
import { readFileSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import { CHEATSHEET_MODULES } from '../src/data/cheatsheet'
import sources from '../src/data/projects.json'

describe('Published code contracts', () => {
  it('publishes the exact current project files instead of independently maintained snippets', () => {
    for (const file of sources.files) {
      if (file.content !== undefined) expect(file.content, file.path).toBe(readFileSync(resolve('../automata-framework', file.path), 'utf8'))
    }
  })

  it('only lists names exported by the documented entry point or actual Sim methods', () => {
    const entries = CHEATSHEET_MODULES.map(mod => {
      const [packageName, ...subpath] = mod.name.replace('@mcthaydt/automata-', '').split('/')
      const root = resolve('../automata-framework/packages', packageName)
      const manifest = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'))
      const entry = manifest.exports[subpath.length ? './' + subpath.join('/') : '.']
      const source = resolve(root, typeof entry === 'string' ? entry : entry.import ?? entry.default)
      expect(mod.sourcePath).toBe(relative(resolve('../automata-framework'), source))
      return source
    })
    const program = ts.createProgram(entries, { allowJs: true, moduleResolution: ts.ModuleResolutionKind.Bundler, module: ts.ModuleKind.ESNext, skipLibCheck: true, noEmit: true })
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
    const examples = new Map(CHEATSHEET_MODULES.map(mod => [
      resolve('../automata-framework', dirname(mod.sourcePath), `website-${mod.id}.ts`), mod.example,
    ]))
    const options: ts.CompilerOptions = {
      target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler, strict: true, noEmit: true,
      skipLibCheck: true, allowImportingTsExtensions: true,
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
    const program = ts.createProgram([...examples.keys()], options, host)
    // Check the published examples directly; checking every imported dependency first
    // does unrelated work that was discarded by the previous diagnostic filter.
    const diagnostics = [...program.getOptionsDiagnostics(), ...[...examples.keys()].flatMap(path => {
      const file = program.getSourceFile(path)!
      return [...program.getSyntacticDiagnostics(file), ...program.getSemanticDiagnostics(file)]
    })]
    expect(ts.formatDiagnostics(diagnostics, { getCurrentDirectory: () => '', getCanonicalFileName: path => path, getNewLine: () => '\n' })).toBe('')
  })
})
