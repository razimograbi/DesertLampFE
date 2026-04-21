/**
 * @param {(...args: unknown[]) => void} fn
 * @param {number} waitMs
 */
export function debounce(fn, waitMs) {
  let t = null;
  return (...args) => {
    if (t) clearTimeout(t);
    t = setTimeout(() => {
      t = null;
      fn(...args);
    }, waitMs);
  };
}
