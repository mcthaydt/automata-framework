// Build - Main Entry Point
import { boot } from './boot.ts'

const root = document.querySelector<HTMLElement>('#game')
if (!root) throw new Error('#game element not found')

boot(root).catch((err) => {
  console.error('Failed to boot game', err)
})
