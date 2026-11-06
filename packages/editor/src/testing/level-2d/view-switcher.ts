// The view switcher, as the browser layout tests reach it: the segmented control from an iPad up, the menu on a phone.

/** The switcher's controls a person can press now: the four options, or the one menu button on a phone. */
export function switcherControls(): HTMLElement[] {
  const options = [
    ...document.querySelectorAll<HTMLElement>('[role="radiogroup"][aria-label="Views"] [role="radio"]'),
  ]
  if (options.length > 0) return options
  const bar = document.querySelector('[data-testid="document-bar"] .switch')
  return [...(bar?.querySelectorAll<HTMLElement>('button[aria-haspopup]') ?? [])]
}

/** Opens a view by its name ("Map"), through the menu on a phone. Waits for the menu to appear when there is one. */
export async function openView(name: string): Promise<void> {
  const option = switcherControls().find(
    (each) => each.getAttribute('role') === 'radio' && each.textContent?.trim() === name,
  )
  if (option !== undefined) {
    option.click()
    return
  }
  const [menuButton] = switcherControls()
  if (menuButton === undefined) throw new Error('no view switcher')
  menuButton.click()
  for (let tries = 0; tries < 50; tries += 1) {
    const item = [...document.querySelectorAll<HTMLElement>('[role="menu"] [role="menuitem"]')].find(
      (each) => each.textContent?.trim() === name,
    )
    if (item !== undefined) {
      item.click()
      return
    }
    await new Promise((resolve) => requestAnimationFrame(resolve))
  }
  throw new Error(`no view named ${name}`)
}
