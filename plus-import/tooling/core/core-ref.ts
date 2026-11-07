// core.ref pins the framework commit that Plus builds core from (PRODUCT.5, P5-D1). Only a full commit is a pin: a
// branch or a tag moves, and a short hash can become ambiguous, so either would let core change under Plus without a
// commit here. The file holds the commit and at most one final newline, so `git diff` shows every move plainly.

const CORE_REF = /^[0-9a-f]{40}\n?$/

/** The commit in core.ref's text; throws, quoting the text, when it is anything else. */
export function parseCoreRef(text: string): string {
  if (!CORE_REF.test(text))
    throw new Error(
      `core.ref must hold one full commit (40 lower-case hex characters) and nothing else; found ${JSON.stringify(text)}`,
    )
  return text.slice(0, 40)
}
