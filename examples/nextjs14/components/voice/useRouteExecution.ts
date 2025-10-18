'use client'

import { useCallback, useRef, useState } from 'react'
import type { Route } from '@lifi/sdk'
import { executeRoute } from '@lifi/sdk'

export type ExecutionStatus = 'idle' | 'executing' | 'success' | 'failed'

type UseRouteExecutionOptions = {
  onUpdate?: (route: Route) => void
}

export function useRouteExecution(options?: UseRouteExecutionOptions) {
  const [status, setStatus] = useState<ExecutionStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const currentRouteRef = useRef<Route | null>(null)

  const execute = useCallback(async (route: Route) => {
    if (!route) return
    setStatus('executing')
    setError(null)
    currentRouteRef.current = route
    try {
      const result = await executeRoute(route, {
        updateRouteHook: (updated) => {
          options?.onUpdate?.(updated)
        },
        // Let the widget config define these; we only set safe defaults here
        infiniteApproval: false,
      })
      setStatus('success')
      return result
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Failed to execute route.'
      setError(message)
      setStatus('failed')
      throw e
    } finally {
      currentRouteRef.current = null
    }
  }, [options])

  const reset = useCallback(() => {
    setStatus('idle')
    setError(null)
  }, [])

  return {
    status,
    error,
    execute,
    reset,
  }
}
