// Reopened gates (editor suite spec §9, EDS-i): a gate an owner decided is reopened while the change set holds a
// written file whose editor-list row names it. "Written" means the file's text now differs from its text before the
// change set first wrote it, so undoing every write to a file stops it reopening anything.
import type { ChangeSetWrite, WorkspaceFile } from '../../../shared/kit/ports/suite-ports.ts'

/** The gate ids the `written` paths' rows name, sorted, each once. */
export function reopenedGates(files: readonly WorkspaceFile[], written: readonly string[]): string[] {
  const writtenPaths = new Set(written)
  const gates = new Set<string>()
  for (const file of files) if (writtenPaths.has(file.path)) for (const gate of file.gates) gates.add(gate)
  return [...gates].sort()
}

/** The paths whose latest text differs from their text before their first write, sorted. */
export function changedPaths(writes: readonly ChangeSetWrite[]): string[] {
  const first = new Map<string, string | undefined>()
  const latest = new Map<string, string>()
  for (const write of writes) {
    if (!first.has(write.path)) first.set(write.path, write.before)
    latest.set(write.path, write.after)
  }
  return [...latest]
    .filter(([path, text]) => first.get(path) !== text)
    .map(([path]) => path)
    .sort()
}
