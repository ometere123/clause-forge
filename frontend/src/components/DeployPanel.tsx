import { useState } from 'react'
import { ShieldCheck, Wallet } from 'lucide-react'
import { useContractStore } from '@/store'
import { useWallet } from '@/hooks/useWallet'
import { createInjectedClient } from '@/services/genLayerClient'
import { recordDeployment } from '@/services/api'
import { cn } from '@/lib/utils'
import { getAddressExplorerUrl } from '@/utils/explorer'
import { normalizeContractCode } from '@/utils/contractCode'
import { GENLAYER_NETWORKS, UPCOMING_NETWORKS, getNetworkConfig } from '@/config/networks'
import type { DeploymentResult, Network } from '@/types'

interface DeployPanelProps {
  onDeployed: (address: string, network: Network) => void
}

export default function DeployPanel({ onDeployed }: DeployPanelProps) {
  const { generatedContract, deploymentResult, setDeploymentResult, addToHistory } = useContractStore()
  const { wallet, shortAddress, isConnected, hasInjectedProvider, connectWallet } = useWallet()

  const [selectedNetwork, setSelectedNetwork] = useState<Network>('studionet')
  const [isDeploying, setIsDeploying] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!generatedContract) return null

  const selectedNetworkConfig = getNetworkConfig(selectedNetwork)

  const extractContractAddress = (receipt: any): string | undefined =>
    receipt?.txDataDecoded?.contractAddress ??
    receipt?.data?.contract_address ??
    receipt?.data?.contractAddress ??
    receipt?.contractAddress ??
    receipt?.to_address

  const handleConnect = async () => {
    setError(null)
    setIsConnecting(true)
    try {
      await connectWallet(selectedNetwork)
    } catch (err: any) {
      setError(err?.message ?? 'Could not connect wallet')
    } finally {
      setIsConnecting(false)
    }
  }

  const handleDeploy = async () => {
    setError(null)

    if (!wallet) {
      await handleConnect()
      return
    }

    setIsDeploying(true)
    try {
      const client = await createInjectedClient(selectedNetwork, wallet.address) as any
      const code = normalizeContractCode(generatedContract.generatedCode)

      // Required by GenLayer before deploys/writes; safe to call repeatedly.
      await client.initializeConsensusSmartContract?.()

      const hash: string = await client.deployContract({
        code,
        args: [],
        leaderOnly: false,
      })

      const receipt: any = await client.waitForTransactionReceipt({
        hash,
        status: 'FINALIZED',
        retries: selectedNetwork === 'studionet' ? 60 : 100,
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
        deployedBy: wallet.address,
        mode: 'external-wallet',
      }

      setDeploymentResult(result)
      addToHistory(result)

      // Index the deployment (best-effort, never blocks the success path)
      void recordDeployment({
        generationId: generatedContract.generationId,
        contractAddress,
        transactionHash: hash,
        network: selectedNetwork,
        deployedBy: wallet.address,
      })
    } catch (err: any) {
      setError(err?.message ?? 'Deployment failed')
    } finally {
      setIsDeploying(false)
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
              <div><p className="text-xs text-muted-foreground">Deployer</p><p className="font-medium font-mono">{`${deploymentResult.deployedBy.slice(0, 6)}...${deploymentResult.deployedBy.slice(-4)}`}</p></div>
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
          {UPCOMING_NETWORKS.map((network) => (
            <div
              key={network.id}
              className="flex-1 border-2 border-dashed border-border rounded-lg px-4 py-3 text-sm text-left opacity-60 cursor-not-allowed select-none"
            >
              <p className="font-semibold flex items-center gap-2">
                {network.label}
                <span className="text-[10px] font-medium uppercase tracking-wide bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">
                  Coming soon
                </span>
              </p>
              <p className="text-muted-foreground text-xs mt-0.5">{network.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Wallet — the only signing path */}
      <div className="border border-border rounded-xl p-4 sm:p-5 space-y-3">
        <p className="text-sm font-semibold flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-primary" />
          Your wallet signs the deployment
        </p>
        {isConnected && wallet ? (
          <div className="flex items-center gap-2 text-sm">
            <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
            <span className="font-mono">{shortAddress}</span>
            <span className="text-muted-foreground text-xs">will be the contract deployer/owner</span>
          </div>
        ) : (
          <button
            onClick={handleConnect}
            disabled={isConnecting}
            className="flex items-center gap-2 text-sm font-medium bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:bg-primary/90 transition disabled:opacity-60"
          >
            <Wallet className="w-4 h-4" />
            {isConnecting ? 'Connecting...' : 'Connect Wallet'}
          </button>
        )}
        <p className="text-xs text-muted-foreground">
          Clause Forge never sees or stores your keys — deployment is signed in your own wallet
          (MetaMask, Rabby, ...). {selectedNetworkConfig.isProductionLike
            ? `You need test GEN on ${selectedNetworkConfig.label} to pay for deployment.`
            : ''}
          {!hasInjectedProvider && ' No wallet detected: install MetaMask or Rabby, then reload.'}
        </p>
      </div>

      {error && (
        <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-3">
          {error}
        </p>
      )}

      <button
        onClick={handleDeploy}
        disabled={isDeploying || isConnecting}
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
        ) : isConnected
          ? `Deploy to ${selectedNetworkConfig.label}`
          : 'Connect Wallet to Deploy'}
      </button>
    </div>
  )
}
