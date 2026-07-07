import { useEffect } from 'react'
import { useContractStore } from '@/store'
import { switchInjectedWalletNetwork } from '@/services/genLayerClient'
import type { Network, WalletAccount } from '@/types'

// External-wallet-only. Clause Forge never holds keys - the user's own wallet
// (MetaMask, Rabby, etc.) is the single signing identity.

export const useWallet = () => {
  const { externalWallet, setExternalWallet } = useContractStore()

  useEffect(() => {
    if (!window.ethereum) return

    window.ethereum.request({ method: 'eth_accounts' })
      .then((accounts) => {
        const list = accounts as string[]
        if (list[0]) {
          setExternalWallet({ address: list[0], isGenerated: false, isExternal: true })
        } else {
          setExternalWallet(null)
        }
      })
      .catch(() => {})

    const handleAccountsChanged = (accounts: unknown) => {
      const list = accounts as string[]
      if (list[0]) {
        setExternalWallet({ address: list[0], isGenerated: false, isExternal: true })
      } else {
        setExternalWallet(null)
      }
    }

    window.ethereum.on('accountsChanged', handleAccountsChanged)
    return () => window.ethereum?.removeListener('accountsChanged', handleAccountsChanged)
  }, [setExternalWallet])

  const connectWallet = async (network?: Network) => {
    if (!window.ethereum) {
      throw new Error('No wallet found. Install MetaMask or Rabby to deploy contracts.')
    }
    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' }) as string[]
    if (!accounts[0]) throw new Error('No wallet account returned.')

    if (network) {
      await switchInjectedWalletNetwork(network)
    }

    const connected: WalletAccount = {
      address: accounts[0],
      isGenerated: false,
      isExternal: true,
    }
    setExternalWallet(connected)
    return connected
  }

  const disconnectWallet = () => {
    setExternalWallet(null)
  }

  return {
    wallet: externalWallet,
    address: externalWallet?.address ?? null,
    shortAddress: externalWallet?.address
      ? `${externalWallet.address.slice(0, 6)}...${externalWallet.address.slice(-4)}`
      : null,
    isConnected: !!externalWallet,
    hasInjectedProvider: typeof window !== 'undefined' && !!window.ethereum,
    connectWallet,
    disconnectWallet,
  }
}
