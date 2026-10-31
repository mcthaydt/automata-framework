import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// M10.6: the releases page is the framework's package CHANGELOGs, read at framework.ref with `git show` so a checkout in
// another state cannot change what the site prints. Changesets writes them; the site adds no words of its own.

export interface ChangeItem { commit: string; text: string }
export interface ChangeGroup { kind: string; items: ChangeItem[] }
export interface VersionChanges { version: string; changes: ChangeGroup[] }
export interface PackageReleases { name: string; versions: VersionChanges[] }
export interface Releases { commit: string; packages: PackageReleases[] }

export function parseChangelog(markdown: string): PackageReleases {
  const name = /^# (\S+)/m.exec(markdown)?.[1]
  if (!name) throw new Error('a changelog starts with its package name')
  const versions: VersionChanges[] = []
  let version: VersionChanges | undefined
  let group: ChangeGroup | undefined
  let item: ChangeItem | undefined
  for (const line of markdown.split('\n').slice(1)) {
    const v = /^## (\S+)$/.exec(line)
    const g = /^### (.+)$/.exec(line)
    const bullet = /^- (.*)$/.exec(line)
    if (v) { version = { version: v[1], changes: [] }; versions.push(version); group = undefined; item = undefined }
    else if (g && version) { group = { kind: g[1], items: [] }; version.changes.push(group); item = undefined }
    else if (bullet && group) {
      // "Updated dependencies [..]" says which packages moved, not what changed.
      if (/^Updated dependencies/.test(bullet[1])) { item = undefined; continue }
      const withCommit = /^([0-9a-f]{7,40}): (.*)$/.exec(bullet[1])
      item = { commit: withCommit?.[1] ?? '', text: withCommit?.[2] ?? bullet[1] }
      group.items.push(item)
    } else if (item && /^ {2}\S/.test(line)) item.text += `\n${line.slice(2)}`
    else if (item && line.trim() === '') item = undefined
  }
  return { name, versions: versions.map((x) => ({ ...x, changes: x.changes.filter((c) => c.items.length) })).filter((x) => x.changes.length) }
}

const git = (dir: string, ...args: string[]): string => execFileSync('git', ['-C', dir, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 })

export function readReleases(frameworkDir: string, commit: string): Releases {
  const files = git(frameworkDir, 'ls-tree', '-r', '--name-only', commit, 'packages').split('\n').filter((path) => /^packages\/[^/]+\/CHANGELOG\.md$/.test(path)).sort()
  const packages = files.map((path) => parseChangelog(git(frameworkDir, 'show', `${commit}:${path}`))).filter((pkg) => pkg.versions.length)
  return { commit, packages }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const website = resolve(fileURLToPath(new URL('.', import.meta.url)), '..')
  const commit = readFileSync(join(website, 'framework.ref'), 'utf8').trim()
  const releases = readReleases(resolve(website, '../automata-framework'), commit)
  writeFileSync(join(website, 'src/data/releases.json'), `${JSON.stringify(releases, null, 2)}\n`)
  console.log(`Wrote releases for ${releases.packages.length} packages at ${commit.slice(0, 7)}.`)
}
