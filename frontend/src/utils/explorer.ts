import { getNetworkConfig } from '@/config/networks'
import type { Network } from '@/types'

export const getAddressExplorerUrl = (network: Network, address: string) =>
  `${getNetworkConfig(network).explorerUrl}/transactions?address=${encodeURIComponent(address)}`

export const getStudionetAddressUrl = (address: string) =>
  getAddressExplorerUrl('studionet', address)
