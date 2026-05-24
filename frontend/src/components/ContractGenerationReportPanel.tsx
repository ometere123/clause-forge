import { cn } from '@/lib/utils'
import type { ContractGenerationReport } from '@/types'

interface ContractGenerationReportPanelProps {
  report?: ContractGenerationReport
}

const statusClass: Record<ContractGenerationReport['badPatternReport'][number]['status'], string> = {
  pass: 'bg-green-50 text-green-700',
  warning: 'bg-amber-50 text-amber-700',
  fail: 'bg-red-50 text-red-700',
}

export default function ContractGenerationReportPanel({
  report,
}: ContractGenerationReportPanelProps) {
  if (!report) return null

  const highlightedFindings = report.badPatternReport.filter((item) => item.status !== 'pass')
  const fitCheck = report.fitCheck ?? {
    genLayerDecision: 'No fit-check data available for this saved contract.',
    acceptedStateChange: 'No accepted state-change data available.',
    validatorEvidence: 'No validator evidence data available.',
    exactAgreementFields: [],
    semanticAgreementFields: [],
    uncertainRejectedAppealedPath: 'No uncertain-path data available.',
  }
  const stateTransitions = report.stateTransitions ?? []
  const consensusCriticalFields = report.consensusCriticalFields ?? { exact: [], semantic: [] }
  const sourceOfTruth = report.sourceOfTruth ?? { genLayer: [], offChain: [] }
  const frontendBackendCallTable = report.frontendBackendCallTable ?? { frontend: [], backend: [] }

  return (
    <div className="border border-border rounded-lg p-4 space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          GenLayer Readiness
        </p>
        <p className="mt-1 text-sm font-semibold capitalize">
          {report.contractKind.replace('-', ' ')}
        </p>
      </div>

      <div className="space-y-2 text-xs text-muted-foreground">
        <div>
          <p className="font-semibold text-foreground">Why GenLayer</p>
          <p>{report.whyGenLayer}</p>
        </div>

        <div>
          <p className="font-semibold text-foreground">Equivalence Strategy</p>
          <p>
            <span className="font-mono text-primary">{report.equivalenceStrategy.strategy}</span>{' '}
            {report.equivalenceStrategy.explanation}
          </p>
        </div>
      </div>

      <details>
        <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          GenLayer Fit Check
        </summary>
        <div className="mt-3 space-y-3 text-xs text-muted-foreground">
          <div>
            <p className="font-semibold text-foreground">Decision</p>
            <p>{fitCheck.genLayerDecision}</p>
          </div>
          <div>
            <p className="font-semibold text-foreground">Accepted State Change</p>
            <p>{fitCheck.acceptedStateChange}</p>
          </div>
          <div>
            <p className="font-semibold text-foreground">Validator Evidence</p>
            <p>{fitCheck.validatorEvidence}</p>
          </div>
          <div>
            <p className="font-semibold text-foreground">Exact Agreement Fields</p>
            <p>{fitCheck.exactAgreementFields.join(', ') || 'None detected'}</p>
          </div>
          <div>
            <p className="font-semibold text-foreground">Semantic Fields</p>
            <p>{fitCheck.semanticAgreementFields.join(', ') || 'None detected'}</p>
          </div>
          <div>
            <p className="font-semibold text-foreground">Uncertain Path</p>
            <p>{fitCheck.uncertainRejectedAppealedPath}</p>
          </div>
        </div>
      </details>

      <details>
        <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          State & Consensus
        </summary>
        <div className="mt-3 grid grid-cols-1 gap-3 text-xs text-muted-foreground">
          <div>
            <p className="font-semibold text-foreground mb-1">Allowed Transitions</p>
            <ul className="space-y-1">
              {stateTransitions.map((item) => (
                <li key={item}>- {item}</li>
              ))}
            </ul>
          </div>
          <div>
            <p className="font-semibold text-foreground mb-1">Validators Must Match Exactly</p>
            <p>{consensusCriticalFields.exact.join(', ') || 'None detected'}</p>
          </div>
          <div>
            <p className="font-semibold text-foreground mb-1">May Vary Semantically</p>
            <p>{consensusCriticalFields.semantic.join(', ') || 'None detected'}</p>
          </div>
        </div>
      </details>

      <details className="group">
        <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Responsibility Boundary
        </summary>
        <div className="mt-3 grid grid-cols-1 gap-3 text-xs text-muted-foreground">
          <div>
            <p className="font-semibold text-foreground mb-1">Inside Contract</p>
            <ul className="space-y-1">
              {report.responsibilityBoundary.insideContract.map((item) => (
                <li key={item}>- {item}</li>
              ))}
            </ul>
          </div>
          <div>
            <p className="font-semibold text-foreground mb-1">Off-chain</p>
            <ul className="space-y-1">
              {report.responsibilityBoundary.outsideContract.map((item) => (
                <li key={item}>- {item}</li>
              ))}
            </ul>
          </div>
        </div>
      </details>

      <details>
        <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Source Of Truth
        </summary>
        <div className="mt-3 grid grid-cols-1 gap-3 text-xs text-muted-foreground">
          <div>
            <p className="font-semibold text-foreground mb-1">GenLayer Contract</p>
            <ul className="space-y-1">
              {sourceOfTruth.genLayer.map((item) => (
                <li key={item}>- {item}</li>
              ))}
            </ul>
          </div>
          <div>
            <p className="font-semibold text-foreground mb-1">Off-chain Convenience</p>
            <ul className="space-y-1">
              {sourceOfTruth.offChain.map((item) => (
                <li key={item}>- {item}</li>
              ))}
            </ul>
          </div>
        </div>
      </details>

      <details>
        <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Frontend / Backend Calls
        </summary>
        <div className="mt-3 grid grid-cols-1 gap-3 text-xs text-muted-foreground">
          <div>
            <p className="font-semibold text-foreground mb-1">Frontend</p>
            <ul className="space-y-1">
              {frontendBackendCallTable.frontend.map((item) => (
                <li key={item}>- {item}</li>
              ))}
            </ul>
          </div>
          <div>
            <p className="font-semibold text-foreground mb-1">Backend</p>
            <ul className="space-y-1">
              {frontendBackendCallTable.backend.map((item) => (
                <li key={item}>- {item}</li>
              ))}
            </ul>
          </div>
        </div>
      </details>

      <details>
        <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Test Plan
        </summary>
        <ol className="mt-3 space-y-1 text-xs text-muted-foreground list-decimal list-inside">
          {report.testPlan.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ol>
      </details>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
          Bad Pattern Report
        </p>
        <div className="space-y-2">
          {(highlightedFindings.length ? highlightedFindings : report.badPatternReport.slice(0, 3)).map(
            (item) => (
              <div key={item.pattern} className="border border-border rounded p-2 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{item.pattern}</span>
                  <span className={cn('px-2 py-0.5 rounded-full text-[10px]', statusClass[item.status])}>
                    {item.status}
                  </span>
                </div>
                {item.status !== 'pass' && (
                  <p className="mt-1 text-muted-foreground">{item.detail}</p>
                )}
              </div>
            )
          )}
        </div>
      </div>
    </div>
  )
}
