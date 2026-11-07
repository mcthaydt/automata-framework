// Code colouring for the site's code blocks, with Shiki. It loads on first use, with only the theme and the
// languages the site shows, so a page without code never downloads it.
import type { HighlighterCore } from 'shiki/core'

let highlighter: Promise<HighlighterCore> | undefined
function getHighlighter() {
  highlighter ??= Promise.all([
    import('shiki/core'),
    import('shiki/engine/javascript'),
    import('shiki/themes/github-light.mjs'),
    import('shiki/langs/typescript.mjs'),
    import('shiki/langs/javascript.mjs'),
    import('shiki/langs/json.mjs'),
    import('shiki/langs/toml.mjs'),
    import('shiki/langs/shellscript.mjs'),
    import('shiki/langs/svelte.mjs'),
    import('shiki/langs/html.mjs'),
    import('shiki/langs/css.mjs'),
    import('shiki/langs/yaml.mjs'),
    import('shiki/langs/markdown.mjs'),
    import('shiki/langs/xml.mjs'),
    import('shiki/langs/glsl.mjs'),
    import('shiki/langs/wgsl.mjs'),
  ]).then(([core, engine, theme, ...languages]) =>
    core.createHighlighterCore({
      engine: engine.createJavaScriptRegexEngine(),
      themes: [theme.default],
      langs: languages.map((l) => l.default),
    }),
  )
  return highlighter
}
export async function highlightCode(code: string, lang = 'typescript'): Promise<string> {
  const escaped = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  try {
    const instance = await getHighlighter()
    return instance.codeToHtml(code, { lang: lang === 'sh' ? 'shellscript' : lang, theme: 'github-light' })
  } catch {
    return `<pre><code>${escaped}</code></pre>`
  }
}
