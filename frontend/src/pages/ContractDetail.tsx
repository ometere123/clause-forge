import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { getMarketplaceListing } from '@/services/api'
import { parseContractMethods } from '@/utils/parseContractMethods'
import { createStudionetClient, getContractSource } from '@/services/genLayerClient'
import { cn } from '@/lib/utils'
import CopyButton from '@/components/CopyButton'
import type { ContractMethod } from '@/types'

interface CallLog {
  timestamp: string
  method: string
  inputs: Record<string, string>
  result: string
  isError: boolean
}

export default function ContractDetail() {
  const { address } = useParams<{ address: string }>()
  const [selectedMethod, setSelectedMethod] = useState<ContractMethod | null>(null)
  const [inputs, setInputs] = useState<Record<string, string>>({})
  const [logs, setLogs] = useState<CallLog[]>([])
  const [isRunning, setIsRunning] = useState(false)

  const { data: listing, isLoading: listingLoading } = useQuery({
    queryKey: ['marketplace-listing', address],
    queryFn: () => getMarketplaceListing(address!),
    enabled: !!address,
    retry: 0,
  })

  // Fallback: fetch source directly from GenLayer RPC if not in marketplace
  const { data: rpcSource, isLoading: rpcLoading } = useQuery({
    queryKey: ['rpc-source', address],
    queryFn: () => getContractSource(address!),
    enabled: !!address && !listingLoading && !listing,
    retry: 0,
  })

  const isLoading = listingLoading || (!listing && rpcLoading)
  const sourceCode = listing?.sourceCode ?? rpcSource ?? null
  const data = listing ?? (rpcSource ? { sourceCode: rpcSource, name: null } : null)
  const error = !isLoading && !data

  const methods = sourceCode ? parseContractMethods(sourceCode) : []
  const viewMethods = methods.filter((m) => !m.isWrite)
  const writeMethods = methods.filter((m) => m.isWrite)

  const handleSelectMethod = (m: ContractMethod) => {
    setSelectedMethod(m)
    setInputs({})
  }

  const handleCall = async () => {
    if (!selectedMethod || !address) return
    setIsRunning(true)

    try {
      const client = createStudionetClient() as any

      const parsedArgs = selectedMethod.inputs.map((input) => {
        const raw = inputs[input.name] ?? ''
        if (input.type === 'int' || input.type === 'float') return Number(raw)
        if (input.type === 'bool') return raw.toLowerCase() === 'true'
        return raw
      })

      let result: unknown

      if (selectedMethod.isWrite) {
        const hash = await client.writeContract({
          account: client.account,
          address: address as `0x${string}`,
          functionName: selectedMethod.name,
          args: parsedArgs,
          value: BigInt(0),
        })
        result = `Transaction sent: ${hash}`
      } else {
        result = await client.readContract({
          account: client.account,
          address: address as `0x${string}`,
          functionName: selectedMethod.name,
          args: parsedArgs,
        })
      }

      setLogs((prev) => [
        {
          timestamp: new Date().toLocaleTimeString(),
          method: selectedMethod.name,
          inputs,
          result:
            typeof result === 'object'
              ? JSON.stringify(result, null, 2)
              : String(result),
          isError: false,
        },
        ...prev,
      ])
    } catch (err: any) {
      setLogs((prev) => [
        {
          timestamp: new Date().toLocaleTimeString(),
          method: selectedMethod.name,
          inputs,
          result: err?.message ?? 'Unknown error',
          isError: true,
        },
        ...prev,
      ])
    } finally {
      setIsRunning(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center space-y-4">
        <p className="text-destructive font-medium">Contract not found.</p>
        <p className="text-sm text-muted-foreground">
          This address is not in the marketplace and could not be fetched from Studionet.
        </p>
        <Link to="/marketplace" className="text-sm text-primary hover:underline">
          ← Back to Marketplace
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Link to="/marketplace" className="text-xs text-muted-foreground hover:text-primary transition">
              ← Marketplace
            </Link>
          </div>
          <h1 className="text-2xl font-bold">Contract Dashboard</h1>
          <div className="flex items-center gap-1.5 mt-1">
            <p className="font-mono text-sm text-muted-foreground break-all">{address}</p>
            <CopyButton text={address ?? ''} />
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="w-2 h-2 rounded-full bg-green-500" />
          <span className="text-xs text-green-700 font-medium">Studionet</span>
        </div>
      </div>

      {methods.length === 0 ? (
        <div className="border border-border rounded-lg p-10 text-center space-y-2">
          <p className="font-medium">No methods found</p>
          <p className="text-sm text-muted-foreground">
            Could not parse contract methods from source. The contract may use an unsupported format.
          </p>
        </div>
      ) : (
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
                      onClick={() => handleSelectMethod(m)}
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
                      onClick={() => handleSelectMethod(m)}
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

            {/* Source code toggle */}
            {data?.sourceCode && (
              <details className="mt-4">
                <summary className="text-xs text-muted-foreground cursor-pointer hover:text-primary transition select-none flex items-center gap-2">
                  <span>View source code</span>
                  <CopyButton text={data.sourceCode} />
                </summary>
                <pre className="mt-2 text-[10px] bg-muted rounded p-3 overflow-x-auto whitespace-pre-wrap break-all max-h-96 overflow-y-auto">
                  {data?.sourceCode}
                </pre>
              </details>
            )}
          </div>

          {/* Input form */}
          <div className="space-y-4">
            {selectedMethod ? (
              <>
                <p className="text-sm font-semibold font-mono">
                  {selectedMethod.name}({selectedMethod.inputs.map((i) => i.name).join(', ')})
                </p>

                {selectedMethod.inputs.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No parameters required</p>
                ) : (
                  <div className="space-y-3">
                    {selectedMethod.inputs.map((input) => (
                      <div key={input.name}>
                        <label className="block text-xs font-medium mb-1">
                          {input.name}
                          <span className="text-muted-foreground ml-1">({input.type})</span>
                        </label>
                        <input
                          type={input.type === 'int' || input.type === 'float' ? 'number' : 'text'}
                          value={inputs[input.name] ?? ''}
                          onChange={(e) =>
                            setInputs((p) => ({ ...p, [input.name]: e.target.value }))
                          }
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
                    selectedMethod.isWrite
                      ? 'bg-red-600 text-white hover:bg-red-700'
                      : 'bg-green-600 text-white hover:bg-green-700',
                    isRunning && 'opacity-60 cursor-not-allowed'
                  )}
                >
                  {isRunning ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Calling on Studionet...
                    </span>
                  ) : (
                    `Call ${selectedMethod.name}()`
                  )}
                </button>
              </>
            ) : (
              <p className="text-sm text-muted-foreground pt-2">
                Select a method from the left to interact with this contract.
              </p>
            )}
          </div>

          {/* Call history */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              Call History
            </p>
            <div className="border border-border rounded-lg h-80 overflow-y-auto p-3 space-y-2 bg-muted/20">
              {logs.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No calls yet — select a method and call it
                </p>
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
                    <pre
                      className={cn(
                        'mt-1 whitespace-pre-wrap break-all',
                        log.isError ? 'text-destructive' : 'text-green-700'
                      )}
                    >
                      {log.result}
                    </pre>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
