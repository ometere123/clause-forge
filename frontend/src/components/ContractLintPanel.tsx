import { useEffect, useMemo, useState } from 'react'
import { validateContract } from '@/services/api'
import { cn } from '@/lib/utils'
import type { ValidationError, ValidationResult } from '@/types'

interface ContractLintPanelProps {
  code: string
  title?: string
  compact?: boolean
}

const getIssueCount = (result: ValidationResult | null) => {
  if (!result) return { critical: 0, warnings: 0, total: 0 }

  const critical = result.errors.filter((issue) => issue.severity === 'critical').length
  const warnings = result.warnings.length
  return { critical, warnings, total: critical + warnings }
}

const getHealthLabel = (result: ValidationResult | null) => {
  const counts = getIssueCount(result)

  if (!result) return { label: 'Not scanned', tone: 'muted' as const }
  if (counts.critical > 0) return { label: 'Needs fixes', tone: 'bad' as const }
  if (counts.warnings > 0) return { label: 'Deployable with warnings', tone: 'warn' as const }
  return { label: 'Looks clean', tone: 'good' as const }
}

function IssueList({ title, issues }: { title: string; issues: ValidationError[] }) {
  if (issues.length === 0) return null

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
        {title}
      </p>
      <div className="space-y-2">
        {issues.map((issue, index) => (
          <div key={`${issue.type}-${index}`} className="border border-border rounded-md px-3 py-2 text-xs">
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="font-semibold">{issue.type}</span>
              <span
                className={cn(
                  'px-2 py-0.5 rounded-full text-[10px] font-medium',
                  issue.severity === 'critical'
                    ? 'bg-red-50 text-red-700'
                    : issue.severity === 'warning'
                    ? 'bg-yellow-50 text-yellow-700'
                    : 'bg-muted text-muted-foreground'
                )}
              >
                {issue.severity}
              </span>
            </div>
            <p>{issue.message}</p>
            {issue.suggestion && (
              <p className="text-muted-foreground mt-1">Suggestion: {issue.suggestion}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export default function ContractLintPanel({
  code,
  title = 'Contract Health',
  compact = false,
}: ContractLintPanelProps) {
  const [result, setResult] = useState<ValidationResult | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const counts = useMemo(() => getIssueCount(result), [result])
  const health = useMemo(() => getHealthLabel(result), [result])

  const runScan = async () => {
    if (!code.trim()) return

    setIsLoading(true)
    setError(null)
    try {
      const data = await validateContract(code)
      setResult(data)
    } catch (err: any) {
      setError(err?.response?.data?.error ?? err?.message ?? 'Validation failed')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    runScan()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code])

  return (
    <div className="border border-border rounded-lg p-4 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">{title}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Lint scan for GenLayer structure, schema safety, and deployment risks.
          </p>
        </div>
        <button
          onClick={runScan}
          disabled={isLoading || !code.trim()}
          className="px-3 py-1.5 border border-border rounded text-xs font-medium hover:bg-accent transition disabled:opacity-50"
        >
          {isLoading ? 'Scanning...' : 'Rescan'}
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-muted/50 rounded-md px-2 py-2">
          <p className="text-lg font-bold">{counts.critical}</p>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Critical</p>
        </div>
        <div className="bg-muted/50 rounded-md px-2 py-2">
          <p className="text-lg font-bold">{counts.warnings}</p>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Warnings</p>
        </div>
        <div
          className={cn(
            'rounded-md px-2 py-2',
            health.tone === 'good' && 'bg-green-50 text-green-700',
            health.tone === 'warn' && 'bg-yellow-50 text-yellow-700',
            health.tone === 'bad' && 'bg-red-50 text-red-700',
            health.tone === 'muted' && 'bg-muted/50 text-muted-foreground'
          )}
        >
          <p className="text-xs font-bold leading-6">{health.label}</p>
          <p className="text-[10px] uppercase tracking-wide">Status</p>
        </div>
      </div>

      {error && (
        <p className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded px-3 py-2">
          {error}
        </p>
      )}

      {result && !compact && (
        <div className="space-y-4">
          <IssueList title="Critical Issues" issues={result.errors} />
          <IssueList title="Warnings" issues={result.warnings} />
          {counts.total === 0 && (
            <p className="text-xs text-muted-foreground">
              No lint issues found by the current validator.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
