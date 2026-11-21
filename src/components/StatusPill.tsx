import type { ReactNode } from 'react'
import type { Severity } from '../types'

export function StatusPill({
  severity,
  children,
  dot = false,
}: {
  severity: Severity | 'neutral'
  children: ReactNode
  dot?: boolean
}) {
  return (
    <span className={`status-pill status-${severity}`}>
      {dot && <span className="status-dot" aria-hidden="true" />}
      {children}
    </span>
  )
}
