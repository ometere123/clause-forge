import { createClient, createAccount } from 'genlayer-js'
import type { DeploymentResult, DeploymentMode, Network } from '../types'
import { config } from '../config'
import { normalizeContractCode } from './contractCode'

// Import GenLayer chains (v1.1.8+)
let studionet: any = {
  id: 61999,
  name: 'Genlayer Studio Network',
  rpcUrls: { default: { http: ['https://studio.genlayer.com/api'] } },
  nativeCurrency: { name: 'GEN Token', symbol: 'GEN', decimals: 18 },
  testnet: true,
}

let testnetBradbury: any = {
  id: 4221,
  name: 'GenLayer Bradbury',
  rpcUrls: { default: { http: ['https://rpc-bradbury.genlayer.com'] } },
  nativeCurrency: { name: 'GEN Token', symbol: 'GEN', decimals: 18 },
  blockExplorers: { default: { name: 'GenLayer Bradbury Explorer', url: 'https://explorer-bradbury.genlayer.com' } },
  testnet: true,
}

// Try to import from genlayer-js if available
try {
  const chains = require('genlayer-js/chains')
  if (chains.studionet) {
    studionet = chains.studionet
  }
  if (chains.testnetBradbury) {
    testnetBradbury = chains.testnetBradbury
  }
} catch (e) {
  // Fall back to inlined config
}

const getChain = (network: Network) => {
  if (network === 'bradbury') return testnetBradbury
  return studionet
}

const buildClient = (privateKey: string, network: Network) => {
  const account = createAccount(privateKey as `0x${string}`)
  return createClient({ chain: getChain(network) as any, account })
}

export const deployContract = async (params: {
  generationId: string
  code: string
  mode: DeploymentMode
  network: Network
  walletPrivateKey?: string
}): Promise<DeploymentResult> => {
  const { mode, network, walletPrivateKey } = params
  const code = normalizeContractCode(params.code)

  const privateKey = mode === 'system'
    ? config.genLayer.systemPrivateKey
    : walletPrivateKey

  if (!privateKey) {
    throw new Error('No private key available for deployment')
  }

  const account = createAccount(privateKey as `0x${string}`)
  const client = buildClient(privateKey, network) as any

  try {
    const hash: string = await client.deployContract({
      code,
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

    return {
      transactionHash: hash,
      contractAddress,
      network,
      deployedAt: new Date().toISOString(),
      deployedBy: account.address,
      mode,
    }
  } catch (error: any) {
    console.error('Deployment error details:', error)
    throw error
  }
}
