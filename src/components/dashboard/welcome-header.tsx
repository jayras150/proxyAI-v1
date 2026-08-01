// ProxyAI — Dashboard Welcome Header (Milestone 2)
// Greeting (client-local time) + user name + current date.

import { formatLongDate, greetingForHour } from '@/lib/format'

export interface WelcomeHeaderProps {
  /** Display name — falls back to a greeting without a name. */
  name?: string | null
  /** Test/SSR hook: default is the client's current hour. */
  hour?: number
}

export function WelcomeHeader({ name, hour }: WelcomeHeaderProps) {
  const greeting = greetingForHour(hour ?? new Date().getHours())

  return (
    <header className="flex flex-col gap-1">
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
        {greeting}
        {name ? `, ${name}` : ''}
      </h1>
      <p className="text-sm text-zinc-500 dark:text-zinc-400">{formatLongDate()}</p>
    </header>
  )
}
