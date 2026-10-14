import { codeToHtml } from 'shiki'

export async function highlightCode(code: string, lang = 'typescript'): Promise<string> {
  try {
    return await codeToHtml(code, {
      lang,
      theme: 'vitesse-dark',
    })
  } catch (_e) {
    // Fallback safe pre/code
    const escaped = code
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
    return `<pre class="shiki vitesse-dark font-mono text-sm leading-relaxed p-4 overflow-x-auto"><code>${escaped}</code></pre>`
  }
}
