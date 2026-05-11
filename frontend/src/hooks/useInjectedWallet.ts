import { useState, useEffect } from 'react'

interface InjectedWalletState {
  address: string | null
  isConnected: boolean
  isAvailable: boolean
  isConnecting: boolean
  error: string | null
  chainId: string | null
  isOnStudionet: boolean
  connect: () => Promise<void>
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

const STUDIONET_CHAIN = {
  chainId: '0xf22f', // 61999 in hex
  chainName: 'Genlayer Studio Network',
  rpcUrls: ['https://studio.genlayer.com/api'],
  blockExplorerUrls: ['https://explorer-studio.genlayer.com'],
  nativeCurrency: {
    name: 'GEN Token',
    symbol: 'GEN',
    decimals: 18,
  },
}

export const useInjectedWallet = (): InjectedWalletState => {
  const [address, setAddress] = useState<string | null>(null)
  const [chainId, setChainId] = useState<string | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isAvailable = typeof window !== 'undefined' && !!window.ethereum
  const isOnStudionet = chainId === STUDIONET_CHAIN.chainId

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

  const connect = async () => {
    if (!window.ethereum) return
    setIsConnecting(true)
    setError(null)

    try {
      // Request accounts
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' })
      const list = accounts as string[]
      if (list.length > 0) setAddress(list[0])

      // Auto-add and switch to Studionet
      try {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [STUDIONET_CHAIN],
        })
        setChainId(STUDIONET_CHAIN.chainId)
      } catch (addError: any) {
        // If already added, switch to it
        if (addError.code === 4902) {
          try {
            await window.ethereum.request({
              method: 'wallet_switchEthereumChain',
              params: [{ chainId: STUDIONET_CHAIN.chainId }],
            })
            setChainId(STUDIONET_CHAIN.chainId)
          } catch (switchError: any) {
            setError(`Failed to switch to Studionet: ${switchError.message}`)
          }
        } else {
          setError(`Failed to add Studionet: ${addError.message}`)
        }
      }
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
    connect,
    disconnect,
  }
}
