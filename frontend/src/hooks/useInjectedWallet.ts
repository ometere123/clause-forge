import { useState, useEffect } from 'react'
import { GENLAYER_NETWORKS, getNetworkConfig } from '@/config/networks'
import { switchInjectedWalletNetwork } from '@/services/genLayerClient'
import type { Network } from '@/types'

interface InjectedWalletState {
  address: string | null
  isConnected: boolean
  isAvailable: boolean
  isConnecting: boolean
  error: string | null
  chainId: string | null
  isOnStudionet: boolean
  isOnBradbury: boolean
  isOnNetwork: (network: Network) => boolean
  connect: (network?: Network) => Promise<void>
  switchNetwork: (network: Network) => Promise<void>
  disconnect: () => void
}

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>
      on: (event: string, handler: (...args: unknown[]) => void) => void
      removeListener: (event: string, handler: (...args: unknown[]) => void) => void
      isMetaMask?: boolean
    }
  }
}

export const useInjectedWallet = (): InjectedWalletState => {
  const [address, setAddress] = useState<string | null>(null)
  const [chainId, setChainId] = useState<string | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isAvailable = typeof window !== 'undefined' && !!window.ethereum
  const isOnStudionet = chainId === GENLAYER_NETWORKS.studionet.chainIdHex
  const isOnBradbury = chainId === GENLAYER_NETWORKS.bradbury.chainIdHex
  const isOnNetwork = (network: Network) => chainId === getNetworkConfig(network).chainIdHex

  useEffect(() => {
    if (!window.ethereum) return

    // Check if already connected
    Promise.all([
      window.ethereum.request({ method: 'eth_accounts' }),
      window.ethereum.request({ method: 'eth_chainId' }),
    ])
      .then(([accounts, cid]) => {
        const list = accounts as string[]
        if (list.length > 0) setAddress(list[0])
        setChainId(cid as string)
      })
      .catch(() => {})

    // Listen for account and chain changes
    const handleAccountsChanged = (accounts: unknown) => {
      const list = accounts as string[]
      setAddress(list.length > 0 ? list[0] : null)
    }

    const handleChainChanged = (cid: unknown) => {
      setChainId(cid as string)
    }

    window.ethereum.on('accountsChanged', handleAccountsChanged)
    window.ethereum.on('chainChanged', handleChainChanged)

    return () => {
      window.ethereum?.removeListener('accountsChanged', handleAccountsChanged)
      window.ethereum?.removeListener('chainChanged', handleChainChanged)
    }
  }, [])

  const switchNetwork = async (network: Network) => {
    await switchInjectedWalletNetwork(network)
    setChainId(getNetworkConfig(network).chainIdHex)
  }

  const connect = async (network: Network = 'studionet') => {
    if (!window.ethereum) return
    setIsConnecting(true)
    setError(null)

    try {
      // Request accounts
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' })
      const list = accounts as string[]
      if (list.length > 0) setAddress(list[0])

      await switchNetwork(network)
    } catch (err: any) {
      setError(err.message ?? 'Failed to connect wallet')
      setAddress(null)
    } finally {
      setIsConnecting(false)
    }
  }

  const disconnect = () => {
    setAddress(null)
    setChainId(null)
    setError(null)
  }

  return {
    address,
    isConnected: !!address,
    isAvailable,
    isConnecting,
    error,
    chainId,
    isOnStudionet,
    isOnBradbury,
    isOnNetwork,
    connect,
    switchNetwork,
    disconnect,
  }
}
