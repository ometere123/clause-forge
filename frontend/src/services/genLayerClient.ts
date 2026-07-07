import { createClient } from 'genlayer-js'
import { studionet, testnetAsimov, testnetBradbury } from 'genlayer-js/chains'
import type { CalldataEncodable } from 'genlayer-js/types'
import { getNetworkConfig } from '@/config/networks'
import type { Network } from '@/types'

// Clause Forge never generates, stores, or transmits private keys.
// All signing (deploys and write calls) happens in the user's own wallet
// (MetaMask, Rabby, etc.). Reads use a keyless client.

// ─── Client Factory ──────────────────────────────────────────────────────────

const chainByNetwork = {
  studionet,
  asimov: testnetAsimov,
  bradbury: testnetBradbury,
} as const

export const getGenLayerChain = (network: Network = 'studionet') => chainByNetwork[network]

// Keyless client — safe for view/read calls only. Cannot sign anything.
export const createReadClient = (network: Network = 'studionet') =>
  createClient({ chain: getGenLayerChain(network) })

export const switchInjectedWalletNetwork = async (network: Network) => {
  if (!window.ethereum) throw new Error('No wallet found. Install MetaMask or Rabby.')

  const config = getNetworkConfig(network)

  try {
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: config.chainIdHex }],
    })
  } catch (switchError: any) {
    if (switchError?.code !== 4902) throw switchError

    await window.ethereum.request({
      method: 'wallet_addEthereumChain',
      params: [{
        chainId: config.chainIdHex,
        chainName: `GenLayer ${config.label}`,
        rpcUrls: [config.rpcUrl],
        blockExplorerUrls: [config.explorerUrl],
        nativeCurrency: {
          name: 'GEN Token',
          symbol: 'GEN',
          decimals: 18,
        },
      }],
    })

    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: config.chainIdHex }],
    })
  }
}

// ─── Injected Wallet Client (MetaMask, Rabby, etc.) ─────────────────────────
// The only signing path in Clause Forge.

export const createInjectedClient = async (
  network: Network = 'studionet',
  userAddress?: string
) => {
  if (!window.ethereum) throw new Error('No wallet found. Install MetaMask or Rabby.')

  await switchInjectedWalletNetwork(network)
  await window.ethereum.request({ method: 'eth_requestAccounts' })

  let address = userAddress as `0x${string}`
  if (!address) {
    const addresses = await window.ethereum.request({ method: 'eth_accounts' }) as string[]
    if (!addresses[0]) throw new Error('No addresses found in wallet')
    address = addresses[0] as `0x${string}`
  }

  return createClient({
    chain: getGenLayerChain(network),
    account: address,
    provider: window.ethereum,
  })
}

// ─── Source / State Fetch ────────────────────────────────────────────────────

export const getContractSource = async (address: string): Promise<string | null> => {
  try {
    const apiBase = import.meta.env.VITE_API_URL || '/api'
    const res = await fetch(`${apiBase}/v1/contracts/source/${address}`)
    if (!res.ok) return null
    const json = await res.json() as { data?: string }
    return json.data ?? null
  } catch {
    return null
  }
}

// ─── Contract Interaction (read-only) ────────────────────────────────────────

export const readContractState = async (
  contractAddress: string,
  network: Network = 'studionet'
) => {
  const client = createReadClient(network)
  return client.getContractSchema(contractAddress as `0x${string}`)
}

export const callContractMethod = async (
  contractAddress: string,
  method: string,
  args: CalldataEncodable[],
  network: Network = 'studionet'
) => {
  const client = createReadClient(network)
  return client.readContract({
    address: contractAddress as `0x${string}`,
    functionName: method,
    args,
  })
}
