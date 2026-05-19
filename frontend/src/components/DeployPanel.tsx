import { useState } from 'react'
import { useContractStore } from '@/store'
import { useContractDeployment } from '@/hooks/useContractDeployment'
import { useWallet } from '@/hooks/useWallet'
import { createGenLayerClient, createInjectedClient } from '@/services/genLayerClient'
import { cn } from '@/lib/utils'
import { getAddressExplorerUrl } from '@/utils/explorer'
import { normalizeContractCode } from '@/utils/contractCode'
import { GENLAYER_NETWORKS, getNetworkConfig } from '@/config/networks'
import type { DeploymentMode, DeploymentResult, Network } from '@/types'

interface DeployPanelProps {
  onDeployed: (address: string, network: Network) => void
}

type WalletMode = 'active' | 'system'

export default function DeployPanel({ onDeployed }: DeployPanelProps) {
  const { generatedContract, deploymentResult, setDeploymentResult } = useContractStore()
  const { deploy: deployViaBackend, isDeploying: isBackendDeploying, error: backendError } = useContractDeployment()
  const {
    wallet,
    shortAddress,
    activeWalletType,
    activeWalletLabel,
    isExternalActive,
  } = useWallet()

  const [mode, setMode] = useState<WalletMode>('active')
  const [selectedNetwork, setSelectedNetwork] = useState<Network>('studionet')
  const [isFrontendDeploying, setIsFrontendDeploying] = useState(false)
  const [frontendError, setFrontendError] = useState<string | null>(null)

  if (!generatedContract) return null

  const isDeploying = isBackendDeploying || isFrontendDeploying
  const error = frontendError ?? (backendError ? (backendError as Error).message : null)
  const selectedNetworkConfig = getNetworkConfig(selectedNetwork)

  const extractContractAddress = (receipt: any): string | undefined =>
    receipt?.txDataDecoded?.contractAddress ??
    receipt?.data?.contract_address ??
    receipt?.data?.contractAddress ??
    receipt?.contractAddress ??
    receipt?.to_address

  const formatDeploymentMode = (deploymentMode: DeploymentMode) => {
    if (deploymentMode === 'external-wallet') return 'External Wallet'
    if (deploymentMode === 'wallet') return 'Browser Wallet'
    return 'Clause Forge'
  }

  const deployFromClient = async (
    client: any,
    deployedBy: string,
    deploymentMode: DeploymentMode
  ) => {
    const code = normalizeContractCode(generatedContract.generatedCode)

    const hash: string = await client.deployContract({
      code,
      args: [],
      leaderOnly: false,
    })

    const receipt: any = await client.waitForTransactionReceipt({
      hash,
      status: 'FINALIZED',
      retries: selectedNetwork === 'bradbury' ? 100 : 60,
      interval: 3000,
    })

    const contractAddress = extractContractAddress(receipt)
    if (!contractAddress) {
      throw new Error('Deployment finalized, but no contract address was returned by GenLayer')
    }

    const result: DeploymentResult = {
      transactionHash: hash,
      contractAddress,
      network: selectedNetwork,
      deployedAt: new Date().toISOString(),
      deployedBy,
      mode: deploymentMode,
    }

    setDeploymentResult(result)
  }

  const handleDeploy = async () => {
    setFrontendError(null)

    if (mode === 'active') {
      setIsFrontendDeploying(true)
      try {
        if (!wallet) {
          throw new Error('Select a wallet first.')
        }

        if (activeWalletType === 'external' || wallet.isExternal) {
          const client = await createInjectedClient(selectedNetwork, wallet.address) as any
          await deployFromClient(client, wallet.address, 'external-wallet')
        } else {
          if (!wallet.privateKey) {
            throw new Error('Selected browser wallet has no private key.')
          }
          const client = createGenLayerClient(selectedNetwork, wallet.privateKey) as any
          await deployFromClient(client, wallet.address, 'wallet')
        }
      } catch (err: any) {
        setFrontendError(err?.message ?? 'Deployment failed')
      } finally {
        setIsFrontendDeploying(false)
      }
    } else {
      // Deploy via backend system wallet
      deployViaBackend(
        generatedContract.generationId,
        normalizeContractCode(generatedContract.generatedCode),
        'system',
        selectedNetwork
      )
    }
  }

  if (deploymentResult) {
    const networkConfig = getNetworkConfig(deploymentResult.network)
    const explorerUrl = getAddressExplorerUrl(deploymentResult.network, deploymentResult.contractAddress)

    return (
      <div className="max-w-2xl mx-auto space-y-5 sm:space-y-6">
        <div className="border border-green-200 bg-green-50 rounded-xl p-4 sm:p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-700 text-xl font-bold">✓</div>
            <div>
              <p className="font-semibold text-green-800">Contract Deployed</p>
              <p className="text-sm text-green-600">Finalized on {networkConfig.label}</p>
            </div>
          </div>
          <div className="space-y-3 pt-2 border-t border-green-200">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Contract Address</p>
              <a
                href={explorerUrl}
                target="_blank"
                rel="noreferrer"
                className="block font-mono text-sm bg-white border border-green-200 px-3 py-2 rounded break-all text-green-700 underline underline-offset-2 hover:text-green-800"
              >
                {deploymentResult.contractAddress}
              </a>
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Transaction Hash</p>
              <p className="font-mono text-sm bg-white border border-green-200 px-3 py-2 rounded break-all">{deploymentResult.transactionHash}</p>
            </div>
            <div className="grid grid-cols-1 sm:flex gap-3 sm:gap-6 text-sm">
              <div><p className="text-xs text-muted-foreground">Network</p><p className="font-medium capitalize">{deploymentResult.network}</p></div>
              <div><p className="text-xs text-muted-foreground">Deployed at</p><p className="font-medium">{new Date(deploymentResult.deployedAt).toLocaleTimeString()}</p></div>
              <div><p className="text-xs text-muted-foreground">Mode</p><p className="font-medium">{formatDeploymentMode(deploymentResult.mode)}</p></div>
            </div>
          </div>
        </div>
        <button
          onClick={() => onDeployed(deploymentResult.contractAddress, deploymentResult.network)}
          className="w-full py-3 bg-primary text-primary-foreground rounded-lg font-semibold hover:bg-primary/90 transition"
        >
          Simulate Contract Methods →
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-5 sm:space-y-6">
      {/* Contract summary */}
      <div className="border border-border rounded-xl p-4 sm:p-5 space-y-2">
        <p className="font-semibold">{generatedContract.contractName}</p>
        <div className="flex flex-wrap gap-3 sm:gap-4 text-sm text-muted-foreground">
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
      <div className="border border-border rounded-xl p-4 sm:p-5 space-y-3">
        <p className="text-sm font-semibold">Network</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {Object.values(GENLAYER_NETWORKS).map((network) => (
            <button
              key={network.id}
              onClick={() => setSelectedNetwork(network.id)}
              className={cn(
                'flex-1 border-2 rounded-lg px-4 py-3 text-sm text-left transition',
                selectedNetwork === network.id
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/40'
              )}
            >
              <p className={cn('font-semibold', selectedNetwork === network.id && 'text-primary')}>
                {network.label}
              </p>
              <p className="text-muted-foreground text-xs mt-0.5">
                {network.description}
              </p>
              {network.faucetUrl && (
                <a
                  href={network.faucetUrl}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(event) => event.stopPropagation()}
                  className="inline-flex text-xs text-primary hover:underline mt-2"
                >
                  Get test GEN
                </a>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Deployer mode */}
      <div className="border border-border rounded-xl p-4 sm:p-5 space-y-3">
        <p className="text-sm font-semibold">Deploy with</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            onClick={() => setMode('active')}
            className={cn(
              'border-2 rounded-lg px-4 py-3 text-sm text-left transition',
              mode === 'active' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'
            )}
          >
            <p className="font-semibold">Active Wallet</p>
            <p className="text-muted-foreground text-xs mt-0.5 font-mono">{shortAddress ?? 'select wallet'}</p>
            <p className="text-muted-foreground text-xs mt-1">
              {isExternalActive
                ? 'External wallet signs and becomes the deployer'
                : `${activeWalletLabel} signs locally and becomes the deployer`}
            </p>
          </button>

          <button
            onClick={() => setMode('system')}
            className={cn(
              'border-2 rounded-lg px-4 py-3 text-sm text-left transition',
              mode === 'system' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'
            )}
          >
            <p className="font-semibold">Clause Forge</p>
            <p className="text-muted-foreground text-xs mt-0.5">System wallet pays gas</p>
            <p className="text-muted-foreground text-xs mt-1">Deployed via backend</p>
          </button>
        </div>
        <p className="text-xs text-muted-foreground pt-1">
          Use the wallet menu in the header to pick a browser account or connect an external wallet. {selectedNetworkConfig.label} deployments need a funded wallet on that network.
        </p>
      </div>

      {/* Cost estimate */}
      <div className="border border-border rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between text-sm">
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
            Deploying to {selectedNetworkConfig.label}... (1-3 min)
          </span>
        ) : `Deploy to ${selectedNetworkConfig.label}`}
      </button>
    </div>
  )
}
