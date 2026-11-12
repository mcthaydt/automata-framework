// Which workspace packages own a set of files: the commit hook's answer to "which unit tests does this commit need".

/**
 * The folders of the packages that own `files`, sorted and without repeats. A file belongs to the deepest package
 * folder that holds it, so a file of a nested package (`examples/2d/content/hot-reload`) never selects the package
 * around it. A file in no package (the root's own, the docs) owns none.
 *
 * @param files Repository-relative paths with `/` separators.
 * @param packageDirs The workspace packages' folders, in the same form.
 */
export function owningPackages(files: readonly string[], packageDirs: readonly string[]): string[] {
  // Longest folder first, so the first match is the deepest.
  const deepestFirst = [...packageDirs].sort((a, b) => b.length - a.length)
  const owners = new Set<string>()
  for (const file of files) {
    const owner = deepestFirst.find((dir) => file.startsWith(`${dir}/`))
    if (owner !== undefined) owners.add(owner)
  }
  return [...owners].sort()
}
