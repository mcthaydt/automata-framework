// Compiles the fixture content (testing/fixtures/content) with the figures' kinds, or a copy of it with some
// files replaced, for the content tests. Copies go to a fresh temp folder that the caller's test owns.

import { cpSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  type CompiledContent,
  compileContent,
  type Diagnostic,
  formatDiagnostic,
} from '@mcthaydt/automata-content'
import { Effect, Either } from 'effect'
import { FIGURE_CONTENT } from '../content/figures.content'

export const FIXTURE_ROOT: string = join(import.meta.dirname, 'fixtures')

/** The compiled content, or the diagnostics the compile failed with. */
export type FixtureCompile =
  | { readonly ok: true; readonly content: CompiledContent }
  | { readonly ok: false; readonly diagnostics: readonly Diagnostic[]; readonly message: string }

export async function compileFixture(
  replace: Readonly<Record<string, string>> = {},
): Promise<FixtureCompile> {
  let root = FIXTURE_ROOT
  if (Object.keys(replace).length > 0) {
    root = mkdtempSync(join(tmpdir(), 'figures-fixture-'))
    cpSync(FIXTURE_ROOT, root, { recursive: true })
    for (const [file, text] of Object.entries(replace)) writeFileSync(join(root, file), text)
  }
  const result = await Effect.runPromise(Effect.either(compileContent({ root, schemas: FIGURE_CONTENT })))
  if (Either.isRight(result)) return { ok: true, content: result.right }
  const error = result.left
  const diagnostics = error._tag === 'ContentCompileFailed' ? error.diagnostics : []
  const message =
    error._tag === 'ContentCompileFailed' ? diagnostics.map(formatDiagnostic).join('\n') : error.message
  return { ok: false, diagnostics, message }
}
