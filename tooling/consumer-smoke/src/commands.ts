// What the consumer smoke and the stranger's journey share: running a command so that a failure carries everything it
// printed, and packing the workspace's published packages the way they are published.
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'
import { packPublished } from './pack.ts'
import type { ConsumerPackage } from './project.ts'

/** Runs a command in `cwd`; on failure the error carries everything it printed. */
export function sh(
  cwd: string,
  command: string,
  args: readonly string[],
  env: NodeJS.ProcessEnv = {},
): string {
  try {
    return execFileSync(command, args, {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, ...env },
    })
  } catch (error) {
    const failed = error as { status?: number; stdout?: string; stderr?: string }
    throw new Error(
      `${command} ${args.join(' ')} exited ${failed.status ?? '?'}\n${failed.stdout ?? ''}${failed.stderr ?? ''}`,
    )
  }
}

/** Packs the published packages into the project's `packs/` (publishConfig and workspace:* applied, as at publish). */
export function packAll(root: string, project: string): ConsumerPackage[] {
  return packPublished({ root, out: join(project, 'packs') }).map(({ name, file }) => ({
    name,
    tarball: `packs/${file}`,
  }))
}
