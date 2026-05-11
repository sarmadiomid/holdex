'use client'

import { useEffect } from 'react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 gap-4">
      <h2 className="text-xl font-bold text-foreground">Something went wrong</h2>
      <p className="text-sm text-muted-foreground text-center">
        {error.message || 'An unexpected error occurred'}
      </p>
      <button
        onClick={() => reset()}
        className="px-4 py-2 rounded-lg bg-neon-cyan text-background font-medium"
      >
        Try again
      </button>
    </div>
  )
}
