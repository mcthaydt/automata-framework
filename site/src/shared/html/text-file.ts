/** A prerendered plain-text file, such as /llms.txt. */
export function textFile(text: string): Response {
  return new Response(text, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
}
