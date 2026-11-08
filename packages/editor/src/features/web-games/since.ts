/** "just now", "5 minutes ago", "2 hours ago", "3 days ago": how long ago a game changed, in words. */
export function since(changed: number, now: number): string {
  const minutes = Math.max(0, Math.floor((now - changed) / 60_000))
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${String(minutes)} ${minutes === 1 ? 'minute' : 'minutes'} ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${String(hours)} ${hours === 1 ? 'hour' : 'hours'} ago`
  const days = Math.floor(hours / 24)
  return `${String(days)} ${days === 1 ? 'day' : 'days'} ago`
}
