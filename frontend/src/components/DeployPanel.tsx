import { useState } from 'react'
import { useContractStore } from '@/store'
import { useContractDeployment } from '@/hooks/useContractDeployment'
import { useWallet } from '@/hooks/useWallet'
import { createStudionetClient } from '@/services/genLayerClient'
import { cn } from '@/lib/utils'
import type { DeploymentResult } from '@/types'

interface DeployPanelProps {
  onDeployed: (address: string) => void
}

type WalletMode = 'browser' | 'system'

export default function DeployPanel({ onDeployed }: DeployPanelProps) {
  const { generatedContract, deploymentResult, setDeploymentResult } = useContractStore()
  const { deploy: deployViaBackend, isDeploying: isBackendDeploying, error: backendError } = useContractDeployment()
  const { wallet, shortAddress } = useWallet()

  const [mode, setMode] = useState<WalletMode>('system')
  const [isFrontendDeploying, setIsFrontendDeploying] = useState(false)
  const [frontendError, setFrontendError] = useState<string | null>(null)

  if (!generatedContract) return null

  const isDeploying = isBackendDeploying || isFrontendDeploying
  const error = frontendError ?? (backendError ? (backendError as Error).message : null)

  const handleDeploy = async () => {
    setFrontendError(null)

    if (mode === 'browser') {
      // Deploy from frontend using the browser-generated wallet (localStorage)
      setIsFrontendDeploying(true)
      try {
        const client = createStudionetClient() as any
        const hash: string = await client.deployContract({
          code: generatedContract.generatedCode,
          args: [],
          leaderOnly: false,
        })
        const receipt: any = await client.waitForTransactionReceipt({
          hash,
          status: 'FINALIZED',
          retries: 60,
          interval: 3000,
        })
        const contractAddress: string | undefined =
          receipt?.txDataDecoded?.contractAddress ??
          receipt?.data?.contract_address ??
          receipt?.data?.contractAddress ??
          receipt?.contractAddress ??
          receipt?.to_address

        if (!contractAddress) {
          throw new Error('Deployment finalized, but no contract address was returned by GenLayer')
        }

        const result: DeploymentResult = {
          transactionHash: hash,
          contractAddress,
          network: 'studionet',
          deployedAt: new Date().toISOString(),
          deployedBy: wallet?.address ?? 'unknown',
          mode: 'wallet',
        }
        setDeploymentResult(result)
      } catch (err: any) {
        setFrontendError(err?.message ?? 'Deployment failed')
      } finally {
        setIsFrontendDeploying(false)
      }
    } else {
      // Deploy via backend system wallet
      deployViaBackend(generatedContract.generationId, generatedContract.generatedCode, 'system')
    }
  }

  if (deploymentResult) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="border border-green-200 bg-green-50 rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-700 text-xl font-bold">✓</div>
            <div>
              <p className="font-semibold text-green-800">Contract Deployed</p>
              <p className="text-sm text-green-600">Finalized on Studionet</p>
            </div>
          </div>
          <div className="space-y-3 pt-2 border-t border-green-200">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Contract Address</p>
              <p className="font-mono text-sm bg-white border border-green-200 px-3 py-2 rounded break-all">{deploymentResult.contractAddress}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Transaction Hash</p>
              <p className="font-mono text-sm bg-white border border-green-200 px-3 py-2 rounded break-all">{deploymentResult.transactionHash}</p>
            </div>
            <div className="flex gap-6 text-sm">
              <div><p className="text-xs text-muted-foreground">Network</p><p className="font-medium capitalize">{deploymentResult.network}</p></div>
              <div><p className="text-xs text-muted-foreground">Deployed at</p><p className="font-medium">{new Date(deploymentResult.deployedAt).toLocaleTimeString()}</p></div>
              <div><p className="text-xs text-muted-foreground">Mode</p><p className="font-medium capitalize">{deploymentResult.mode}</p></div>
            </div>
          </div>
        </div>
        <button
          onClick={() => onDeployed(deploymentResult.contractAddress)}
          className="w-full py-3 bg-primary text-primary-foreground rounded-lg font-semibold hover:bg-primary/90 transition"
        >
          Simulate Contract Methods →
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Contract summary */}
      <div className="border border-border rounded-xl p-5 space-y-2">
        <p className="font-semibold">{generatedContract.contractName}</p>
        <div className="flex gap-4 text-sm text-muted-foreground">
          <span>{generatedContract.methods.filter(m => !m.isWrite).length} view methods</span>
          <span>{generatedContract.methods.filter(m => m.isWrite).length} write methods</span>
        </div>
        <div className="flex flex-wrap gap-2 pt-1">
          {generatedContract.estimation.capabilities.needsLlm && (
            <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full">Uses AI</span>
          )}
          {generatedContract.estimation.capabilities.needsWebFetch && (
            <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">Fetches Web Data</span>
          )}
        </div>
      </div>

      {/* Network */}
      <div className="border border-border rounded-xl p-5 space-y-3">
        <p className="text-sm font-semibold">Network</p>
        <div className="flex gap-3">
          <div className="flex-1 border-2 border-primary bg-primary/5 rounded-lg px-4 py-3 text-sm">
            <p className="font-semibold text-primary">Studionet</p>
            <p className="text-muted-foreground text-xs mt-0.5">Hosted testnet — free, no setup</p>
          </div>
          <div className="flex-1 border border-border rounded-lg px-4 py-3 text-sm opacity-40 cursor-not-allowed">
            <p className="font-semibold">Bradbury</p>
            <p className="text-muted-foreground text-xs mt-0.5">Coming soon</p>
          </div>
        </div>
      </div>

      {/* Deployer mode */}
      <div className="border border-border rounded-xl p-5 space-y-3">
        <p className="text-sm font-semibold">Deploy with</p>
        <div className="flex gap-3">
          <button
            onClick={() => setMode('browser')}
            className={cn(
              'flex-1 border-2 rounded-lg px-4 py-3 text-sm text-left transition',
              mode === 'browser' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'
            )}
          >
            <p className="font-semibold">My Wallet</p>
            <p className="text-muted-foreground text-xs mt-0.5 font-mono">{shortAddress ?? 'generating...'}</p>
            <p className="text-muted-foreground text-xs mt-1">Browser-generated · signs locally</p>
          </button>

          <button
            onClick={() => setMode('system')}
            className={cn(
              'flex-1 border-2 rounded-lg px-4 py-3 text-sm text-left transition',
              mode === 'system' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'
            )}
          >
            <p className="font-semibold">Clause Forge</p>
            <p className="text-muted-foreground text-xs mt-0.5">System wallet pays gas</p>
            <p className="text-muted-foreground text-xs mt-1">Deployed via backend</p>
          </button>
        </div>
        <p className="text-xs text-muted-foreground pt-1">
          MetaMask/Rabby connect at the top is for marketplace identity. GenLayer's RPC doesn't yet
          support standard <code className="text-[10px]">eth_sendTransaction</code>, so deployments
          use a browser wallet or the system wallet.
        </p>
      </div>

      {/* Cost estimate */}
      <div className="border border-border rounded-xl p-5 flex justify-between items-center text-sm">
        <div>
          <p className="font-medium">Estimated generation cost</p>
          <p className="text-muted-foreground text-xs mt-0.5">Gas for deployment depends on contract size</p>
        </div>
        <p className="font-semibold">${generatedContract.estimation.estimatedCostUsd.toFixed(4)}</p>
      </div>

      {error && (
        <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-3">
          {error}
        </p>
      )}

      <button
        onClick={handleDeploy}
        disabled={isDeploying}
        className={cn(
          'w-full py-3.5 rounded-xl font-semibold text-sm transition',
          isDeploying ? 'bg-muted text-muted-foreground cursor-not-allowed' : 'bg-primary text-primary-foreground hover:bg-primary/90'
        )}
      >
        {isDeploying ? (
          <span className="flex items-center justify-center gap-2">
            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            Deploying to Studionet... (1–2 min)
          </span>
        ) : 'Deploy to Studionet'}
      </button>
    </div>
  )
}
