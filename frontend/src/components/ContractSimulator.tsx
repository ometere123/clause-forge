import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useContractStore } from '@/store'
import { useWallet } from '@/hooks/useWallet'
import { createGenLayerClient } from '@/services/genLayerClient'
import { submitToMarketplace } from '@/services/api'
import { cn } from '@/lib/utils'
import { getAddressExplorerUrl } from '@/utils/explorer'
import { normalizeContractCode } from '@/utils/contractCode'
import { getNetworkConfig } from '@/config/networks'
import CopyButton from '@/components/CopyButton'
import type { ContractMethod, Network } from '@/types'

type ContractCategory = 'verification' | 'scoring' | 'voting' | 'data-enrichment' | 'custom'

const CATEGORIES: { id: ContractCategory; label: string }[] = [
  { id: 'verification', label: 'Verification' },
  { id: 'scoring', label: 'Scoring' },
  { id: 'voting', label: 'Voting' },
  { id: 'data-enrichment', label: 'Data Enrichment' },
  { id: 'custom', label: 'Custom' },
]

interface SimulatorLog {
  timestamp: string
  method: string
  inputs: Record<string, string>
  result: string
  isError: boolean
}

interface ContractSimulatorProps {
  contractAddress: string
  network?: Network
}

export default function ContractSimulator({
  contractAddress,
  network = 'studionet',
}: ContractSimulatorProps) {
  const { generatedContract } = useContractStore()
  const { address: walletAddress } = useWallet()

  const [selectedMethod, setSelectedMethod] = useState<ContractMethod | null>(
    generatedContract?.methods[0] ?? null
  )
  const [inputs, setInputs] = useState<Record<string, string>>({})
  const [logs, setLogs] = useState<SimulatorLog[]>([])
  const [isRunning, setIsRunning] = useState(false)

  // ── Submit to Marketplace ──────────────────────────────────────────────────
  const [showSubmit, setShowSubmit] = useState(false)
  const [submitName, setSubmitName] = useState(generatedContract?.contractName ?? '')
  const [submitDesc, setSubmitDesc] = useState(
    (generatedContract?.originalDescription ?? '').slice(0, 1000)
  )
  const [submitCategory, setSubmitCategory] = useState<ContractCategory>('custom')
  const [submitTags, setSubmitTags] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitSuccess, setSubmitSuccess] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const handleSubmit = async () => {
    if (!walletAddress || !generatedContract) return
    setIsSubmitting(true)
    setSubmitError(null)
    try {
      await submitToMarketplace({
        contractAddress,
        name: submitName.trim(),
        description: submitDesc.trim(),
        category: submitCategory,
        tags: submitTags.split(',').map((t) => t.trim()).filter(Boolean),
        walletAddress,
        network,
        sourceCode: normalizeContractCode(generatedContract.generatedCode),
      })
      setSubmitSuccess(true)
    } catch (err: any) {
      const detail = err?.response?.data?.details ?? err?.response?.data?.error ?? err?.message ?? 'Submission failed'
      setSubmitError(detail)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!generatedContract) return null

  const viewMethods = generatedContract.methods.filter((m) => !m.isWrite)
  const writeMethods = generatedContract.methods.filter((m) => m.isWrite)
  const networkConfig = getNetworkConfig(network)
  const explorerUrl = getAddressExplorerUrl(network, contractAddress)

  const handleCall = async () => {
    if (!selectedMethod) return
    setIsRunning(true)

    try {
      const client = createGenLayerClient(network)

      // Parse inputs into correct types
      const parsedArgs = selectedMethod.inputs.map((input) => {
        const raw = inputs[input.name] ?? ''
        if (input.type === 'int' || input.type === 'float') return Number(raw)
        if (input.type === 'bool') return raw.toLowerCase() === 'true'
        return raw
      })

      let result: unknown

      if (selectedMethod.isWrite) {
        const hash = await client.writeContract({
          account: client.account!,
          address: contractAddress as `0x${string}`,
          functionName: selectedMethod.name,
          args: parsedArgs,
          value: BigInt(0),
        })
        result = `Transaction sent: ${hash}`
      } else {
        result = await client.readContract({
          account: client.account!,
          address: contractAddress as `0x${string}`,
          functionName: selectedMethod.name,
          args: parsedArgs,
        })
      }

      setLogs((prev) => [
        {
          timestamp: new Date().toLocaleTimeString(),
          method: selectedMethod.name,
          inputs,
          result: typeof result === 'object' ? JSON.stringify(result, null, 2) : String(result),
          isError: false,
        },
        ...prev,
      ])
    } catch (error: any) {
      setLogs((prev) => [
        {
          timestamp: new Date().toLocaleTimeString(),
          method: selectedMethod.name,
          inputs,
          result: error?.message ?? 'Unknown error',
          isError: true,
        },
        ...prev,
      ])
    } finally {
      setIsRunning(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Contract address banner */}
      <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 flex items-center gap-3 text-sm">
        <span className="w-2 h-2 bg-green-500 rounded-full shrink-0" />
        <div className="min-w-0">
          <span className="text-green-700 font-medium">Deployed on {networkConfig.label} · </span>
          <a
            href={explorerUrl}
            target="_blank"
            rel="noreferrer"
            className="font-mono text-green-700 text-xs break-all underline underline-offset-2 hover:text-green-800"
          >
            {contractAddress}
          </a>
          <CopyButton text={contractAddress} className="text-green-600 hover:bg-green-100" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Method list */}
        <div className="space-y-4">
          {viewMethods.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-green-600 mb-2">View</p>
              <div className="space-y-1">
                {viewMethods.map((m) => (
                  <button
                    key={m.name}
                    onClick={() => { setSelectedMethod(m); setInputs({}) }}
                    className={cn(
                      'w-full text-left px-3 py-2 rounded border text-sm font-mono transition',
                      selectedMethod?.name === m.name
                        ? 'border-green-400 bg-green-50 text-green-700'
                        : 'border-border hover:border-green-300'
                    )}
                  >
                    {m.name}()
                  </button>
                ))}
              </div>
            </div>
          )}

          {writeMethods.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-red-600 mb-2">Write</p>
              <div className="space-y-1">
                {writeMethods.map((m) => (
                  <button
                    key={m.name}
                    onClick={() => { setSelectedMethod(m); setInputs({}) }}
                    className={cn(
                      'w-full text-left px-3 py-2 rounded border text-sm font-mono transition',
                      selectedMethod?.name === m.name
                        ? 'border-red-400 bg-red-50 text-red-700'
                        : 'border-border hover:border-red-300'
                    )}
                  >
                    {m.name}()
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Input form */}
        <div className="space-y-4">
          <p className="text-sm font-semibold font-mono">
            {selectedMethod?.name}({selectedMethod?.inputs.map((i) => i.name).join(', ')})
          </p>

          {selectedMethod?.inputs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No parameters required</p>
          ) : (
            <div className="space-y-3">
              {selectedMethod?.inputs.map((input) => (
                <div key={input.name}>
                  <label className="block text-xs font-medium mb-1">
                    {input.name}
                    <span className="text-muted-foreground ml-1">({input.type})</span>
                  </label>
                  <input
                    type={input.type === 'int' || input.type === 'float' ? 'number' : 'text'}
                    value={inputs[input.name] ?? ''}
                    onChange={(e) => setInputs((p) => ({ ...p, [input.name]: e.target.value }))}
                    placeholder={`Enter ${input.name}`}
                    className="w-full px-3 py-1.5 border border-border rounded text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              ))}
            </div>
          )}

          <button
            onClick={handleCall}
            disabled={isRunning}
            className={cn(
              'w-full py-2 rounded font-medium text-sm transition',
              selectedMethod?.isWrite
                ? 'bg-red-600 text-white hover:bg-red-700'
                : 'bg-green-600 text-white hover:bg-green-700',
              isRunning && 'opacity-60 cursor-not-allowed'
            )}
          >
            {isRunning
              ? <span className="flex items-center justify-center gap-2">
                  <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Calling on {networkConfig.label}...
                </span>
              : `Call ${selectedMethod?.name}()`
            }
          </button>
        </div>

        {/* Logs */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Call History</p>
          <div className="border border-border rounded-lg h-72 overflow-y-auto p-3 space-y-2 bg-muted/20">
            {logs.length === 0 ? (
              <p className="text-xs text-muted-foreground">No calls yet — select a method and call it</p>
            ) : (
              logs.map((log, i) => (
                <div
                  key={i}
                  className={cn(
                    'text-xs border-l-2 pl-2 py-1',
                    log.isError ? 'border-destructive' : 'border-green-500'
                  )}
                >
                  <p className="font-mono font-semibold">{log.method}()</p>
                  <p className="text-muted-foreground">{log.timestamp}</p>
                  <pre className={cn(
                    'mt-1 whitespace-pre-wrap break-all',
                    log.isError ? 'text-destructive' : 'text-green-700'
                  )}>
                    {log.result}
                  </pre>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ── Submit to Marketplace ─────────────────────────────────────────── */}
      <div className="border border-border rounded-lg p-5 mt-2">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-sm">Submit to Marketplace</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Share this contract with the community
            </p>
          </div>
          {!submitSuccess && (
            <button
              onClick={() => setShowSubmit((p) => !p)}
              className="text-xs px-3 py-1.5 border border-border rounded hover:border-primary/50 transition"
            >
              {showSubmit ? 'Cancel' : 'Submit →'}
            </button>
          )}
        </div>

        {submitSuccess ? (
          <div className="mt-4 bg-green-50 border border-green-200 rounded px-4 py-3 text-sm text-green-700 flex items-center justify-between">
            <span>✓ Submitted successfully!</span>
            <Link to="/marketplace" className="text-primary text-xs hover:underline">
              View in Marketplace →
            </Link>
          </div>
        ) : showSubmit && (
          <div className="mt-4 space-y-3">
            {/* Name */}
            <div>
              <label className="block text-xs font-medium mb-1">Name</label>
              <input
                type="text"
                value={submitName}
                onChange={(e) => setSubmitName(e.target.value)}
                maxLength={100}
                className="w-full px-3 py-1.5 border border-border rounded text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-medium mb-1">Description</label>
              <textarea
                value={submitDesc}
                onChange={(e) => setSubmitDesc(e.target.value)}
                maxLength={1000}
                rows={3}
                className="w-full px-3 py-1.5 border border-border rounded text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              />
            </div>

            {/* Category + Tags */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1">Category</label>
                <select
                  value={submitCategory}
                  onChange={(e) => setSubmitCategory(e.target.value as ContractCategory)}
                  className="w-full px-3 py-1.5 border border-border rounded text-sm focus:outline-none focus:ring-2 focus:ring-ring bg-background"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">
                  Tags <span className="text-muted-foreground">(comma separated)</span>
                </label>
                <input
                  type="text"
                  value={submitTags}
                  onChange={(e) => setSubmitTags(e.target.value)}
                  placeholder="defi, insurance, nft"
                  className="w-full px-3 py-1.5 border border-border rounded text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>

            {submitError && (
              <p className="text-xs text-destructive">{submitError}</p>
            )}

            <button
              onClick={handleSubmit}
              disabled={isSubmitting || !submitName.trim() || !submitDesc.trim()}
              className="w-full py-2 bg-primary text-primary-foreground rounded font-medium text-sm hover:bg-primary/90 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Submitting...
                </span>
              ) : (
                'Submit to Marketplace'
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
