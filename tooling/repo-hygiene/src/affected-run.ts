// A pull request runs a task only in the packages its change affects, dependents included (turbo --affected). The pure
// parts of that, for `affected-run-cli.ts`: which packages a dry run says would run the task, what to say when none
// would, and the arguments of the real run.

/** The part of `turbo run … --dry=json` this reads: one entry per task turbo would run. */
export interface DryRun {
  readonly tasks: readonly { readonly package: string; readonly task: string; readonly command: string }[]
}

/**
 * The packages in which `task` would really run, sorted. A dependency's `build` is a task turbo runs first and is not
 * the task asked for; a package with no script of that name is listed by turbo as `<NONEXISTENT>` and runs nothing.
 */
export function affectedPackages(dry: DryRun, task: string): string[] {
  const names = dry.tasks.filter((entry) => entry.task === task && entry.command !== '<NONEXISTENT>')
  return [...new Set(names.map((entry) => entry.package))].sort()
}

/**
 * What the step prints when nothing is affected. Turbo says almost nothing then and exits 0, which a reader takes for a
 * pass; this says nothing ran.
 */
export function skipNotice(task: string): string {
  return `SKIPPED ${task}: no package it runs in is affected by this pull request. Nothing was run, so nothing passed.`
}

/**
 * The arguments of `turbo`, for the dry run and the real one alike: the same selection both times, so the list printed
 * is the list run.
 *
 * @param filters Turbo's own flags (`--filter x`, `--log-order stream`), kept as given.
 * @param runnerArgs What follows `--`, for the task's own runner (vitest's `--testTimeout`).
 */
export function turboArgs(task: string, filters: readonly string[], runnerArgs: readonly string[]): string[] {
  return ['run', task, '--affected', ...filters, ...(runnerArgs.length === 0 ? [] : ['--', ...runnerArgs])]
}
