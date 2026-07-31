// ProxyAI — Structured Logger
// Blueprint Reference: Sprint 14 §108 — Structured Logging
// Abstraction: swap implementation (pino/bunyan) later without touching callers.
// Sensitive data must never be logged.

type LogLevel = 'info' | 'warn' | 'error'

export interface LogContext {
  request_id?: string
  transaction_id?: string
  wallet_id?: string
  user_id?: string
  provider?: string
  provider_reference?: string
  [key: string]: unknown
}

function write(level: LogLevel, msg: string, ctx?: LogContext): void {
  const line = JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    msg,
    ...ctx,
  })

  // console is the underlying sink; swap via logger abstraction later.
  console[level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log'](line)
}

export const logger = {
  info(msg: string, ctx?: LogContext): void {
    write('info', msg, ctx)
  },
  warn(msg: string, ctx?: LogContext): void {
    write('warn', msg, ctx)
  },
  error(msg: string, ctx?: LogContext): void {
    write('error', msg, ctx)
  },
}
