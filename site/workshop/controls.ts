/** Native controls own key presses; key releases still reach the game to clear any previously held input. */
export function isolateControlKeys(controls: HTMLElement): () => void {
  const stopGameKeydown = (event: KeyboardEvent) => event.stopPropagation()
  controls.addEventListener('keydown', stopGameKeydown)
  return () => controls.removeEventListener('keydown', stopGameKeydown)
}
