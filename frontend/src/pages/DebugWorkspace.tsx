import { useState } from 'react'
import { debugContract } from '@/services/api'
import ApiKeyPanel from '@/components/ApiKeyPanel'
import ContractLintPanel from '@/components/ContractLintPanel'
import FrontendCallMapPanel from '@/components/FrontendCallMapPanel'
import { cn } from '@/lib/utils'
import type { DebugContractResult } from '@/types'

const STARTER_CODE = `# v0.2.16
# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
from genlayer import *

class MyContract(gl.Contract):
    pass
`

export default function DebugWorkspace() {
  const [code, setCode] = useState(STARTER_CODE)
  const [errorMessage, setErrorMessage] = useState('')
  const [intent, setIntent] = useState('')
  const [previousFix, setPreviousFix] = useState('')
  const [result, setResult] = useState<DebugContractResult | null>(null)
  const [isFixing, setIsFixing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canSubmit = code.trim().length > 0 && errorMessage.trim().length > 0 && !isFixing

  const handleFix = async () => {
    if (!canSubmit) return
    setIsFixing(true)
    setError(null)

    try {
      const fixed = await debugContract({
        code,
        errorMessage,
        intent: intent.trim() || undefined,
        previousFix: previousFix.trim() || undefined,
      })
      setResult(fixed)
      setPreviousFix(fixed.fixedCode)
    } catch (err: any) {
      const detail = err?.response?.data?.error ?? err?.message ?? 'Debug request failed'
      setError(detail)
    } finally {
      setIsFixing(false)
    }
  }

  const handleRefix = () => {
    if (!result) return
    setCode(result.fixedCode)
    setErrorMessage('')
    setResult(null)
  }

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-4 py-5 sm:py-8 space-y-5 sm:space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold mb-2">Debug Workspace</h1>
        <p className="text-sm sm:text-base text-muted-foreground">
          Fix GenLayer Intelligent Contracts with side-by-side code and a clear repair explanation.
        </p>
      </div>

      <ApiKeyPanel />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold mb-2">Contract Code</label>
            <textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              spellCheck={false}
              className="w-full h-72 sm:h-96 px-4 py-3 border border-border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-ring font-mono text-xs"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2">Original Intent</label>
            <textarea
              value={intent}
              onChange={(e) => setIntent(e.target.value)}
              placeholder="What should this contract do?"
              className="w-full h-24 px-4 py-3 border border-border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-ring text-sm"
            />
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold mb-2">GenVM Error / Traceback</label>
            <textarea
              value={errorMessage}
              onChange={(e) => setErrorMessage(e.target.value)}
              placeholder="Paste the schema error, deploy error, traceback, or GenVM output here."
              spellCheck={false}
              className="w-full h-40 sm:h-48 px-4 py-3 border border-border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-ring font-mono text-xs"
            />
          </div>

          {error && (
            <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-3">
              {error}
            </p>
          )}

          <button
            onClick={handleFix}
            disabled={!canSubmit}
            className={cn(
              'w-full py-3 rounded-lg font-semibold text-sm transition',
              canSubmit
                ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                : 'bg-muted text-muted-foreground cursor-not-allowed'
            )}
          >
            {isFixing ? 'Fixing contract...' : 'Fix Contract'}
          </button>

          {result && (
            <div className="border border-border rounded-lg p-4 space-y-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                  Diagnosis
                </p>
                {result.issueCategory && (
                  <p className="text-xs text-muted-foreground mb-2">
                    Category: {result.issueCategory}
                  </p>
                )}
                <p className="text-sm">{result.diagnosis}</p>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                  Explanation
                </p>
                <p className="text-sm">{result.explanation}</p>
              </div>

              {result.changes.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                    Changes
                  </p>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    {result.changes.map((change, index) => (
                      <li key={index}>{change}</li>
                    ))}
                  </ul>
                </div>
              )}

              {result.warnings.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                    Warnings
                  </p>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    {result.warnings.map((warning, index) => (
                      <li key={index}>{warning}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {result && (
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h2 className="text-xl font-semibold">Side-by-Side Fix</h2>
            <div className="grid grid-cols-1 sm:flex gap-2">
              <button
                onClick={() => navigator.clipboard.writeText(result.fixedCode)}
                className="px-4 py-2 border border-border rounded text-sm font-medium hover:bg-accent transition"
              >
                Copy Fixed Code
              </button>
              <button
                onClick={handleRefix}
                className="px-4 py-2 bg-primary text-primary-foreground rounded text-sm font-medium hover:bg-primary/90 transition"
              >
                Refix New Error
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                Original
              </p>
              <pre className="h-[360px] sm:h-[520px] overflow-auto border border-border rounded-lg p-4 text-xs font-mono whitespace-pre-wrap bg-muted/20">
                {code}
              </pre>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                Fixed
              </p>
              <pre className="h-[360px] sm:h-[520px] overflow-auto border border-border rounded-lg p-4 text-xs font-mono whitespace-pre-wrap bg-green-50">
                {result.fixedCode}
              </pre>
            </div>
          </div>

          <ContractLintPanel code={result.fixedCode} title="Fixed Contract Health" />
          <FrontendCallMapPanel items={result.frontendCallMap} />
        </div>
      )}
    </div>
  )
}
