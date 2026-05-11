import { useEffect } from 'react'
import { useContractStore } from '@/store'
import {
  getAllWallets,
  getActiveWalletIndex,
  setActiveWalletIndex,
  addNewWallet,
  clearWallet,
} from '@/services/genLayerClient'

export const useWallet = () => {
  const { wallet, wallets, activeWalletIndex, setWallets } = useContractStore()

  useEffect(() => {
    if (wallets.length === 0) {
      const all = getAllWallets()
      const idx = getActiveWalletIndex()
      setWallets(all, idx)
    }
  }, [wallets.length, setWallets])

  const switchWallet = (index: number) => {
    setActiveWalletIndex(index)
    const all = getAllWallets()
    setWallets(all, index)
  }

  const createWallet = () => {
    const { wallets: all, newIndex } = addNewWallet()
    setWallets(all, newIndex)
  }

  const resetWallet = () => {
    clearWallet()
    const all = getAllWallets()
    setWallets(all, 0)
  }

  const active = wallet ?? wallets[activeWalletIndex] ?? null

  return {
    wallet: active,
    wallets,
    activeWalletIndex,
    address: active?.address ?? null,
    shortAddress: active?.address
      ? `${active.address.slice(0, 6)}...${active.address.slice(-4)}`
      : null,
    switchWallet,
    createWallet,
    resetWallet,
  }
}
