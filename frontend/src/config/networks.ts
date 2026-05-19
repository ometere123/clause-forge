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

export const getNetworkConfig = (network: Network) => GENLAYER_NETWORKS[network]
