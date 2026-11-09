// What the consumer smoke and the stranger's journey share: running a command so that a failure carries everything it
// printed, and packing the workspace's published packages the way they are published.
import { execFileSync } from 'node:child_process'
import { mkdirSync, readdirSync } from 'node:fs'
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

/**
 * Packs `@automata/3d`, which is private until Pixi 3D is public and so is not among the published packages, and says
 * where each of its two kinds of dependency comes from instead of a registry: itself, and the vendored Pixi 3D
 * tarball. Only the 3D stranger's journey (AF_BETA_3D=1) uses it.
 */
export function pack3d(root: string, project: string): Record<string, string> {
  const out = join(project, 'packs-3d')
  mkdirSync(out, { recursive: true })
  sh(join(root, 'packages/3d'), 'pnpm', ['pack', '--pack-destination', out])
  const [file] = readdirSync(out)
  if (file === undefined) throw new Error('pnpm pack wrote nothing for @automata/3d')
  return {
    '@automata/3d': `file:${join(out, file)}`,
    '@pixi/3d': `file:${join(root, 'vendor/pixi-3d/pixi-3d-0.1.0-beta.2.tgz')}`,
  }
}
