'use client'

// ProxyAI — Landing Page

import Link from 'next/link'

export default function HomePage() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="border-b border-zinc-200 dark:border-zinc-800">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="text-xl font-bold">ProxyAI</div>
          <nav className="flex items-center gap-4">
            <Link
              href="/login"
              className="text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
            >
              Login
            </Link>
            <Link
              href="/register"
              className="text-sm px-4 py-2 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200"
            >
              Get Started
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1 flex items-center justify-center px-4">
        <div className="max-w-2xl text-center space-y-6">
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">
            OpenAI-Compatible{' '}
            <span className="text-blue-600 dark:text-blue-400">AI Gateway</span>
          </h1>
          <p className="text-lg text-zinc-600 dark:text-zinc-400">
            Deploy powerful AI models through a simple, secure API.
            Wallet-based billing, API key management, and real-time monitoring.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link
              href="/register"
              className="px-6 py-3 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200"
            >
              Start Building
            </Link>
            <Link
              href="/login"
              className="px-6 py-3 rounded-lg border border-zinc-300 dark:border-zinc-700 font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              Sign In
            </Link>
          </div>

          {/* Features */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-16 text-left">
            <div className="space-y-2 p-4 rounded-lg border border-zinc-200 dark:border-zinc-800">
              <h3 className="font-semibold">OpenAI Compatible</h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Drop-in replacement for OpenAI SDKs. No code changes needed.
              </p>
            </div>
            <div className="space-y-2 p-4 rounded-lg border border-zinc-200 dark:border-zinc-800">
              <h3 className="font-semibold">Wallet-Based Billing</h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Top up once. Pay per token. No surprises.
              </p>
            </div>
            <div className="space-y-2 p-4 rounded-lg border border-zinc-200 dark:border-zinc-800">
              <h3 className="font-semibold">Secure by Default</h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                API key authentication. JWT sessions. RBAC. TOTP for admin.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-200 dark:border-zinc-800 py-6 text-center text-sm text-zinc-500">
        ProxyAI &copy; {new Date().getFullYear()}
      </footer>
    </div>
  )
}
