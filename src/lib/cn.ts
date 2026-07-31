// ProxyAI — cn(): minimal className combiner (no dependencies)

export type ClassValue = string | number | null | undefined | false | Record<string, boolean> | ClassValue[]

function normalize(value: ClassValue): string {
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  if (Array.isArray(value)) return value.map(normalize).filter(Boolean).join(' ')
  if (value && typeof value === 'object') {
    return Object.entries(value)
      .filter(([, keep]) => keep)
      .map(([key]) => key)
      .join(' ')
  }
  return ''
}

/** Join class names, skipping falsy values and flattening arrays/objects. */
export function cn(...values: ClassValue[]): string {
  return values.map(normalize).filter(Boolean).join(' ')
}
