// What the pure layers must not use (ED3D-D1): UI and platform imports, DOM globals, the wall clock, timers, randomness.
const FORBIDDEN_IMPORT = /from\s+['"](svelte(?:\/[^'"]*)?|typescript|effect(?:\/[^'"]*)?|node:[^'"]*)['"]/
// A DOM global is a bare name: after a dot, in quotes or as a member key (`window?: WindowDef`) it is just a word.
const FORBIDDEN_NAME = new RegExp(
  [
    '\\b(?:Date|setTimeout|setInterval|clearTimeout|clearInterval|requestAnimationFrame|queueMicrotask)\\b',
    '(?<![.\\w\'"])(?:document|window|navigator|localStorage|sessionStorage|indexedDB)\\b(?!\\s*\\??:)',
    '\\bperformance\\.now\\b',
    '\\bMath\\.random\\b',
  ].join('|'),
)

/** The source without its comments, so a rule that names a global in a comment is not a finding. */
const withoutComments = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')

export function findImpurities(source: string): string[] {
  const findings: string[] = []
  for (const line of withoutComments(source).split('\n')) {
    const found = FORBIDDEN_IMPORT.exec(line) ?? FORBIDDEN_NAME.exec(line)
    if (found) findings.push(found[0])
  }
  return findings
}
