/**
 * Debounce utility
 *
 * Delays execution of a function until after a specified delay has elapsed
 * since the last time it was invoked. Useful for performance optimization
 * of frequent events like input changes, window resize, etc.
 */

export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout

  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId)
    timeoutId = setTimeout(() => fn(...args), delay)
  }
}
