import { useEffect } from 'react'
import { useContractStore } from '@/store'
import {
  getAllWallets,
  getActiveWalletIndex,
  setActiveWalletIndex,
  addNewWallet,
  clearWallet,
  switchInjectedWalletNetwork,
} from '@/services/genLayerClient'
import type { Network, WalletAccount } from '@/types'

export const useWallet = () => {
  const {
    wallet,
    wallets,
    activeWalletIndex,
    activeWalletType,
    externalWallet,
    setWallets,
    setActiveWalletType,
    setExternalWallet,
  } = useContractStore()

  useEffect(() => {
    if (wallets.length === 0) {
      const all = getAllWallets()
      const idx = getActiveWalletIndex()
      setWallets(all, idx)
    }
  }, [wallets.length, setWallets])

  useEffect(() => {
    if (!window.ethereum) return

    window.ethereum.request({ method: 'eth_accounts' })
      .then((accounts) => {
        const list = accounts as string[]
        if (list[0]) {
          setExternalWallet({
            address: list[0],
            isGenerated: false,
            isExternal: true,
          })
        } else if (activeWalletType === 'external') {
          setActiveWalletType('browser')
          setExternalWallet(null)
        }
      })
      .catch(() => {})

    const handleAccountsChanged = (accounts: unknown) => {
      const list = accounts as string[]
      if (list[0]) {
        setExternalWallet({
          address: list[0],
          isGenerated: false,
          isExternal: true,
        })
      } else {
        setExternalWallet(null)
        setActiveWalletType('browser')
      }
    }

    window.ethereum.on('accountsChanged', handleAccountsChanged)
    return () => window.ethereum?.removeListener('accountsChanged', handleAccountsChanged)
  }, [activeWalletType, setActiveWalletType, setExternalWallet])

  const switchWallet = (index: number) => {
    setActiveWalletIndex(index)
    const all = getAllWallets()
    setWallets(all, index)
    setActiveWalletType('browser')
  }

  const createWallet = () => {
    const { wallets: all, newIndex } = addNewWallet()
    setWallets(all, newIndex)
    setActiveWalletType('browser')
  }

  const resetWallet = () => {
    clearWallet()
    const all = getAllWallets()
    setWallets(all, 0)
    setActiveWalletType('browser')
  }

  const connectExternalWallet = async (network?: Network) => {
    if (!window.ethereum) throw new Error('No external wallet found. Install MetaMask or Rabby.')
    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' }) as string[]
    if (!accounts[0]) throw new Error('No external wallet account returned.')

    if (network) {
      await switchInjectedWalletNetwork(network)
    }

    const connected: WalletAccount = {
      address: accounts[0],
      isGenerated: false,
      isExternal: true,
    }
    setExternalWallet(connected)
    setActiveWalletType('external')
    return connected
  }

  const selectExternalWallet = async () => {
    if (externalWallet) {
      setActiveWalletType('external')
      return externalWallet
    }
    return connectExternalWallet()
  }

  const disconnectExternalWallet = () => {
    setExternalWallet(null)
    setActiveWalletType('browser')
  }

  const browserWallet = wallet ?? wallets[activeWalletIndex] ?? null
  const resolvedActiveWalletType = activeWalletType === 'external' && externalWallet
    ? 'external'
    : 'browser'

  const active = resolvedActiveWalletType === 'external' && externalWallet
    ? externalWallet
    : browserWallet

  const activeWalletLabel = resolvedActiveWalletType === 'external' && externalWallet
    ? 'External Wallet'
    : wallets.length > 1
      ? `Browser Wallet #${activeWalletIndex + 1}`
      : 'Browser Wallet'

  return {
    wallet: active,
    browserWallet,
    externalWallet,
    wallets,
    activeWalletIndex,
    activeWalletType: resolvedActiveWalletType,
    activeWalletLabel,
    isExternalActive: resolvedActiveWalletType === 'external' && !!externalWallet,
    isBrowserActive: resolvedActiveWalletType === 'browser',
    address: active?.address ?? null,
    shortAddress: active?.address
      ? `${active.address.slice(0, 6)}...${active.address.slice(-4)}`
      : null,
    switchWallet,
    createWallet,
    resetWallet,
    connectExternalWallet,
    selectExternalWallet,
    disconnectExternalWallet,
  }
}
