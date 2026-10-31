// A resolve hook for the one-off converter: the adventure source imports its TypeScript files without an extension,
// which Node's type stripping does not resolve on its own. Relative specifiers without one get `.ts`.
export async function resolve(specifier, context, next) {
  if (/^\.\.?\//.test(specifier) && !/\.[cm]?[jt]s$/.test(specifier)) {
    try {
      return await next(`${specifier}.ts`, context)
    } catch {}
  }
  return next(specifier, context)
}
