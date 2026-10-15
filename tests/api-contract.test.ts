import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import { CHEATSHEET_MODULES } from '../src/data/cheatsheet'
import { STARTER_CODE } from '../src/data/starter'

describe('Published code contracts', () => {
  it('typechecks the actual published starter against the current sim package', () => {
    const file = resolve('.svelte-kit/published-starter.ts')
    const options: ts.CompilerOptions = { strict: true, noEmit: true, skipLibCheck: true, target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler, allowImportingTsExtensions: true, types: [], paths: { '@mcthaydt/automata-sim': [resolve('../automata-framework/packages/sim/src/index.ts')] } }
    const host = ts.createCompilerHost(options)
    const original = host.getSourceFile.bind(host)
    host.getSourceFile = (name, version, onError, shouldCreate) => name === file ? ts.createSourceFile(file, STARTER_CODE, ts.ScriptTarget.ESNext, true) : original(name, version, onError, shouldCreate)
    const program = ts.createProgram([file], options, host)
    const errors = ts.getPreEmitDiagnostics(program).filter(d => d.category === ts.DiagnosticCategory.Error)
    expect(errors.map(d => ts.flattenDiagnosticMessageText(d.messageText, '\n'))).toEqual([])
  })

  it('only lists names exported by the documented entry point or actual Sim methods', () => {
    const entries = CHEATSHEET_MODULES.map(m => resolve('../automata-framework/packages', m.name.replace('@mcthaydt/automata-', ''), m.name.endsWith('-physics') ? 'src/2d.ts' : 'src/index.ts'))
    const program = ts.createProgram(entries, { allowJs: true, moduleResolution: ts.ModuleResolutionKind.Bundler, module: ts.ModuleKind.ESNext, skipLibCheck: true, noEmit: true })
    const checker = program.getTypeChecker()
    const sim = readFileSync(resolve('../automata-framework/packages/sim/src/world/sim.ts'), 'utf8')
    CHEATSHEET_MODULES.forEach((mod, i) => {
      const symbol = checker.getSymbolAtLocation(program.getSourceFile(entries[i])!)!
      const names = checker.getExportsOfModule(symbol).map(s => s.name)
      for (const entry of mod.entries) {
        if (entry.name === 'step' || entry.name === 'snapshot') expect(sim).toContain(entry.name + '(')
        else expect(names, mod.name + ': ' + entry.name).toContain(entry.name)
      }
    })
  })
})
