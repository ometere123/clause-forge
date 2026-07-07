import type { Network } from '@/types'

export interface GenLayerNetworkConfig {
  id: Network
  label: string
  description: string
  rpcUrl: string
  chainId: number
  chainIdHex: `0x${string}`
  explorerUrl: string
  faucetUrl?: string
  isProductionLike: boolean
}

// Verified against https://docs.genlayer.com/developers/networks
export const GENLAYER_NETWORKS: Record<Network, GenLayerNetworkConfig> = {
  studionet: {
    id: 'studionet',
    label: 'Studionet',
    description: 'Hosted dev network - fast iteration, built-in faucet.',
    rpcUrl: 'https://studio.genlayer.com/api',
    chainId: 61999,
    chainIdHex: '0xf22f',
    explorerUrl: 'https://explorer-studio.genlayer.com',
    isProductionLike: false,
  },
  asimov: {
    id: 'asimov',
    label: 'Asimov',
    description: 'Testnet for infrastructure and stress testing - requires test GEN.',
    rpcUrl: 'https://rpc-asimov.genlayer.com',
    chainId: 4221,
    chainIdHex: '0x107d',
    explorerUrl: 'https://explorer-asimov.genlayer.com',
    faucetUrl: 'https://testnet-faucet.genlayer.foundation',
    isProductionLike: true,
  },
  bradbury: {
    id: 'bradbury',
    label: 'Bradbury',
    description: 'Production-like testnet - real AI workloads, requires test GEN.',
    rpcUrl: 'https://rpc-bradbury.genlayer.com',
    chainId: 4221,
    chainIdHex: '0x107d',
    explorerUrl: 'https://explorer-bradbury.genlayer.com',
    faucetUrl: 'https://testnet-faucet.genlayer.foundation',
    isProductionLike: true,
  },
}

// Announced networks not yet deployable from Clause Forge.
export const UPCOMING_NETWORKS = [
  {
    id: 'clarke',
    label: 'Clarke',
    description: 'Next GenLayer testnet - support coming soon.',
  },
] as const

export const getNetworkConfig = (network: Network) => GENLAYER_NETWORKS[network]
