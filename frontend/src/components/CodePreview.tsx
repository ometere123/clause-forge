import { useState } from 'react'
import Editor from '@monaco-editor/react'
import { useContractStore } from '@/store'
import { cn } from '@/lib/utils'
import ContractLintPanel from '@/components/ContractLintPanel'
import FrontendCallMapPanel from '@/components/FrontendCallMapPanel'
import { normalizeContractCode } from '@/utils/contractCode'

interface CodePreviewProps {
  onDeploy: () => void
  onCodeChanged?: () => void
}

type Tab = 'code' | 'structure'

export default function CodePreview({ onDeploy, onCodeChanged }: CodePreviewProps) {
  const { generatedContract, setGeneratedContract } = useContractStore()
  const [tab, setTab] = useState<Tab>('code')
  const [isEditing, setIsEditing] = useState(false)
  const [editedCode, setEditedCode] = useState(
    generatedContract?.generatedCode ?? ''
  )

  if (!generatedContract) return null

  const handleSave = () => {
    const normalizedCode = normalizeContractCode(editedCode)
    const currentCode = normalizeContractCode(generatedContract.generatedCode)
    const codeChanged = normalizedCode !== currentCode

    setEditedCode(normalizedCode)
    setGeneratedContract({ ...generatedContract, generatedCode: normalizedCode })
    if (codeChanged) {
      onCodeChanged?.()
    }
    setIsEditing(false)
  }

  const handleCancel = () => {
    setEditedCode(generatedContract.generatedCode)
    setIsEditing(false)
  }

  const handleStartEditing = () => {
    setEditedCode(generatedContract.generatedCode)
    setIsEditing(true)
  }

  const handleDownload = () => {
    const blob = new Blob([normalizeContractCode(generatedContract.generatedCode)], {
      type: 'text/plain',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${generatedContract.contractName.replace(/\s+/g, '_')}.py`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 sm:gap-6">
      {/* Code panel */}
      <div className="lg:col-span-2 space-y-3">
        {/* Tabs */}
        <div className="flex border-b border-border">
          {(['code', 'structure'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                'px-4 py-2 text-sm font-medium capitalize border-b-2 transition',
                tab === t
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground'
              )}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === 'code' ? (
          <div
            className={cn(
              'border border-border rounded-lg overflow-hidden',
              isEditing ? 'h-[68vh] min-h-[360px] lg:h-[420px]' : 'h-[54vh] min-h-[320px] lg:h-[420px]'
            )}
          >
            <Editor
              height="100%"
              defaultLanguage="python"
              value={isEditing ? editedCode : generatedContract.generatedCode}
              onChange={(v) => setEditedCode(v ?? '')}
              theme="vs-light"
              options={{
                minimap: { enabled: false },
                wordWrap: 'on',
                fontSize: 13,
                fontFamily: 'Fira Code, Cascadia Code, monospace',
                readOnly: !isEditing,
                scrollBeyondLastLine: false,
              }}
            />
          </div>
        ) : (
          <div className="border border-border rounded-lg p-4 space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                State Variables
              </p>
              <div className="space-y-1">
                {Object.entries(generatedContract.stateVariables).map(
                  ([name, type]) => (
                    <div
                      key={name}
                      className="flex flex-wrap gap-2 text-sm font-mono bg-muted px-3 py-1.5 rounded"
                    >
                      <span className="text-primary">{name}</span>
                      <span className="text-muted-foreground">: {type}</span>
                    </div>
                  )
                )}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                Methods
              </p>
              <div className="space-y-2">
                {generatedContract.methods.map((method) => (
                  <div
                    key={method.name}
                    className="flex items-center justify-between gap-3 border border-border px-3 py-2 rounded text-sm"
                  >
                    <span className="font-mono font-medium text-primary truncate">
                      {method.name}()
                    </span>
                    <span
                      className={cn(
                        'text-xs px-2 py-0.5 rounded-full font-medium',
                        method.isWrite
                          ? 'bg-red-50 text-red-600'
                          : 'bg-green-50 text-green-600'
                      )}
                    >
                      {method.isWrite ? 'write' : 'view'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <FrontendCallMapPanel items={generatedContract.frontendCallMap} />
          </div>
        )}

        {/* Actions */}
        <div className="grid grid-cols-1 sm:flex gap-2">
          {isEditing ? (
            <>
              <button
                onClick={handleSave}
                className="flex-1 py-2 bg-primary text-primary-foreground rounded font-medium text-sm"
              >
                Save Changes
              </button>
              <button
                onClick={handleCancel}
                className="flex-1 py-2 border border-border rounded font-medium text-sm"
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handleStartEditing}
                className="flex-1 py-2 border border-border rounded font-medium text-sm hover:bg-accent"
              >
                Edit
              </button>
              <button
                onClick={() =>
                  navigator.clipboard.writeText(
                    generatedContract.generatedCode
                  )
                }
                className="flex-1 py-2 border border-border rounded font-medium text-sm hover:bg-accent"
              >
                Copy
              </button>
              <button
                onClick={handleDownload}
                className="flex-1 py-2 border border-border rounded font-medium text-sm hover:bg-accent"
              >
                Download .py
              </button>
            </>
          )}
        </div>
      </div>

      {/* Sidebar */}
      <div className="space-y-4">
        {/* Cost estimate */}
        <div className="border border-border rounded-lg p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
            Estimation
          </p>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tokens in</span>
              <span className="font-mono">
                {generatedContract.estimation.tokensInput}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tokens out</span>
              <span className="font-mono">
                {generatedContract.estimation.tokensOutput}
              </span>
            </div>
            <div className="flex justify-between border-t border-border pt-2">
              <span className="font-medium">Cost</span>
              <span className="font-mono font-medium">
                ${generatedContract.estimation.estimatedCostUsd.toFixed(6)}
              </span>
            </div>
          </div>
        </div>

        {/* Capabilities */}
        <div className="border border-border rounded-lg p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
            Capabilities
          </p>
          <div className="space-y-2 text-sm">
            {[
              {
                label: 'AI / LLM Calls',
                active: generatedContract.estimation.capabilities.needsLlm,
              },
              {
                label: 'Web Fetch',
                active:
                  generatedContract.estimation.capabilities.needsWebFetch,
              },
              {
                label: 'Visual Web',
                active:
                  generatedContract.estimation.capabilities.needsDataAccess,
              },
            ].map((cap) => (
              <div key={cap.label} className="flex items-center gap-2">
                <span
                  className={cn(
                    'w-2 h-2 rounded-full',
                    cap.active ? 'bg-green-500' : 'bg-muted-foreground/30'
                  )}
                />
                <span
                  className={cap.active ? '' : 'text-muted-foreground'}
                >
                  {cap.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        <ContractLintPanel code={generatedContract.generatedCode} />

        {/* CTA Button */}
        <button
          onClick={onDeploy}
          className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg font-medium text-sm hover:bg-primary/90 transition"
        >
          Choose Network & Deploy →
        </button>
      </div>
    </div>
  )
}
