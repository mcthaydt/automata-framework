// Vite's `?raw` imports: a file's text, so a browser test can read a fixture without `node:fs`.
declare module '*?raw' {
  const text: string
  export default text
}
