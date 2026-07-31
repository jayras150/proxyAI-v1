// ProxyAI — Request ID
// Blueprint Reference: Sprint 9 §59 — Standard Response Contract (request_id)

import crypto from 'crypto'

const REQUEST_ID_PREFIX = 'req_'

/**
 * Generate a unique, correlatable request id.
 * Format: req_<uuid>
 */
export function generateRequestId(): string {
  return `${REQUEST_ID_PREFIX}${crypto.randomUUID()}`
}
