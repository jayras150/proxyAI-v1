// ProxyAI — Generic Pagination Types
// Shared keyset pagination contract (cursor-based, no offset).

export interface Cursor {
  createdAt: Date
  id: string
}

export interface Page<T> {
  items: T[]
  nextCursor: Cursor | null
  hasMore: boolean
}
