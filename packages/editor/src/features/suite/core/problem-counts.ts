// How many problems each editor's files have, for the sidebar's counts: each check finding that names a file counts once,
// for the editor whose card holds that file. A finding with no file belongs to no editor.
import type { CheckFinding } from '../../../shared/kit/ports/suite-ports.ts'

export function problemCounts(
  findings: readonly CheckFinding[],
  cards: readonly { readonly editor: string; readonly files: readonly { readonly path: string }[] }[],
): Readonly<Record<string, number>> {
  const counts: Record<string, number> = {}
  for (const finding of findings) {
    if (finding.path === undefined) continue
    const owner = cards.find((card) => card.files.some((file) => file.path === finding.path))
    if (owner !== undefined) counts[owner.editor] = (counts[owner.editor] ?? 0) + 1
  }
  return counts
}
