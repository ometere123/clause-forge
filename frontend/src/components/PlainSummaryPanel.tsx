import { useState } from 'react'
import { CheckCircle2, AlertTriangle, Wrench, ChevronDown, ChevronUp, BookOpen } from 'lucide-react'
import type { AutoFixInfo, ContractPlainSummary, ValidationResult } from '@/types'
import { cn } from '@/lib/utils'

interface PlainSummaryPanelProps {
  summary?: ContractPlainSummary
  validation?: ValidationResult
  autoFix?: AutoFixInfo
}

const Section = ({ title, items }: { title: string; items: string[] }) => {
  if (!items.length) return null
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
        {title}
      </p>
      <ul className="space-y-1 text-sm">
        {items.map((item, i) => (
          <li key={i} className="flex gap-2">
            <span className="text-primary mt-0.5">•</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function PlainSummaryPanel({ summary, validation, autoFix }: PlainSummaryPanelProps) {
  const [expanded, setExpanded] = useState(true)

  if (!summary) return null

  const criticalCount = validation
    ? validation.errors.filter((e) => e.severity === 'critical').length
    : 0

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      {/* Status strip */}
      {validation && (
        <div
          className={cn(
            'flex items-center gap-2 px-4 py-2 text-sm font-medium',
            validation.isValid
              ? 'bg-green-50 text-green-700'
              : 'bg-amber-50 text-amber-700'
          )}
        >
          {validation.isValid ? (
            <>
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>
                Checks passed — ready to deploy
                {validation.warnings.length > 0 && ` (${validation.warnings.length} advisory note${validation.warnings.length > 1 ? 's' : ''})`}
              </span>
            </>
          ) : (
            <>
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>
                {criticalCount} issue{criticalCount !== 1 ? 's' : ''} found — use the Debug workspace or regenerate before deploying
              </span>
            </>
          )}
        </div>
      )}

      {autoFix?.succeeded && (
        <div className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-50 text-blue-700 border-t border-blue-100">
          <Wrench className="w-4 h-4 shrink-0" />
          <span>
            Clause Forge automatically repaired {autoFix.issuesFixed.length} issue
            {autoFix.issuesFixed.length !== 1 ? 's' : ''} in the first draft for you.
          </span>
        </div>
      )}

      {/* Plain-English summary */}
      <div className="p-4 space-y-4">
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-between gap-2 text-left"
        >
          <span className="flex items-center gap-2 font-semibold text-sm">
            <BookOpen className="w-4 h-4 text-primary" />
            What your contract does — in plain English
          </span>
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          )}
        </button>

        {expanded && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{summary.headline}</p>
            <p className="text-sm">{summary.whatItDoes}</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Section title="Actions people can take" items={summary.actions} />
              <Section title="Information anyone can read" items={summary.reads} />
            </div>

            <Section title="What it keeps track of" items={summary.whatItStores} />
            <Section title="Good to know" items={summary.notes} />
          </div>
        )}
      </div>
    </div>
  )
}
