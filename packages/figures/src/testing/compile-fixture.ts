// Compiles the fixture content (testing/fixtures/content) with the figures' kinds, or a copy of it with some
// files replaced (or, given null, removed), for the content tests. A copy goes to a fresh temp folder, removed after the compile.

import { cpSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  type CompiledContent,
  compileContent,
  type Diagnostic,
  formatDiagnostic,
} from '@automataframework/automata-content'
import { Effect, Either } from 'effect'
import { FIGURE_CONTENT } from '../content/figures.content'

export const FIXTURE_ROOT: string = join(import.meta.dirname, 'fixtures')

/** The compiled content, or the diagnostics the compile failed with. */
export type FixtureCompile =
  | { readonly ok: true; readonly content: CompiledContent }
  | { readonly ok: false; readonly diagnostics: readonly Diagnostic[]; readonly message: string }

export async function compileFixture(
  replace: Readonly<Record<string, string | null>> = {},
): Promise<FixtureCompile> {
  let root = FIXTURE_ROOT
  if (Object.keys(replace).length > 0) {
    root = mkdtempSync(join(tmpdir(), 'figures-fixture-'))
    cpSync(FIXTURE_ROOT, root, { recursive: true })
    for (const [file, text] of Object.entries(replace))
      if (text === null) rmSync(join(root, file))
      else writeFileSync(join(root, file), text)
  }
  const compiled = Effect.either(compileContent({ root, schemas: FIGURE_CONTENT }))
  // A copy is this call's own folder: removed once the compile has read it, whatever the result.
  const result = await Effect.runPromise(compiled).finally(() => {
    if (root !== FIXTURE_ROOT) rmSync(root, { recursive: true, force: true })
  })
  if (Either.isRight(result)) return { ok: true, content: result.right }
  const error = result.left
  const diagnostics = error._tag === 'ContentCompileFailed' ? error.diagnostics : []
  const message =
    error._tag === 'ContentCompileFailed' ? diagnostics.map(formatDiagnostic).join('\n') : error.message
  return { ok: false, diagnostics, message }
}
