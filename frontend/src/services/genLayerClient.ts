import { createClient, createAccount, generatePrivateKey } from 'genlayer-js'
import { studionet } from 'genlayer-js/chains'
import { createWalletClient, custom } from 'viem'
import type { CalldataEncodable } from 'genlayer-js/types'
import type { WalletAccount } from '@/types'

// Studionet chain ID in hex format (61999 decimal = 0xf22f hex)
export const STUDIONET_CHAIN_ID = '0xf22f'

// ─── Multi-Wallet Management ─────────────────────────────────────────────────

const WALLETS_KEY = 'clause-forge-wallets'
const ACTIVE_IDX_KEY = 'clause-forge-active-wallet'
const LEGACY_KEY = 'clause-forge-wallet-pk'

const loadWalletPKs = (): string[] => {
  // Migrate legacy single-wallet on first load
  const legacy = localStorage.getItem(LEGACY_KEY)
  const stored = localStorage.getItem(WALLETS_KEY)

  if (!stored) {
    const pk = legacy ?? generatePrivateKey()
    const wallets = [pk]
    localStorage.setItem(WALLETS_KEY, JSON.stringify(wallets))
    if (legacy) localStorage.removeItem(LEGACY_KEY)
    return wallets
  }

  return JSON.parse(stored) as string[]
}

const saveWalletPKs = (pks: string[]) => {
  localStorage.setItem(WALLETS_KEY, JSON.stringify(pks))
}

const pkToAccount = (pk: string): WalletAccount => {
  const account = createAccount(pk as `0x${string}`)
  return { address: account.address, privateKey: pk, isGenerated: true }
}

export const getActiveWalletIndex = (): number => {
  const idx = parseInt(localStorage.getItem(ACTIVE_IDX_KEY) ?? '0', 10)
  const pks = loadWalletPKs()
  return Math.min(idx, pks.length - 1)
}

export const setActiveWalletIndex = (index: number) => {
  localStorage.setItem(ACTIVE_IDX_KEY, String(index))
}

export const getAllWallets = (): WalletAccount[] => {
  return loadWalletPKs().map(pkToAccount)
}

export const getOrCreateWallet = (): WalletAccount => {
  const pks = loadWalletPKs()
  const idx = getActiveWalletIndex()
  return pkToAccount(pks[idx])
}

export const addNewWallet = (): { wallets: WalletAccount[]; newIndex: number } => {
  const pks = loadWalletPKs()
  const newPk = generatePrivateKey()
  pks.push(newPk)
  saveWalletPKs(pks)
  const newIndex = pks.length - 1
  setActiveWalletIndex(newIndex)
  return { wallets: pks.map(pkToAccount), newIndex }
}

export const clearWallet = () => {
  localStorage.removeItem(WALLETS_KEY)
  localStorage.removeItem(ACTIVE_IDX_KEY)
  localStorage.removeItem(LEGACY_KEY)
}

// ─── Client Factory ──────────────────────────────────────────────────────────

export const createStudionetClient = (privateKey?: string) => {
  const key = privateKey ?? getOrCreateWallet().privateKey

  if (!key) {
    throw new Error('No wallet found.')
  }

  const account = createAccount(key as `0x${string}`)

  return createClient({
    chain: studionet,
    account,
  })
}

// ─── Injected Wallet Client (MetaMask, Rabby, etc.) ─────────────────────────

export const createInjectedClient = async (userAddress?: string) => {
  if (!window.ethereum) throw new Error('No injected wallet found. Install MetaMask or Rabby.')

  const viemWallet = createWalletClient({
    chain: studionet,
    transport: custom(window.ethereum),
  })

  // Get address from wallet if not provided
  let address = userAddress as `0x${string}`
  if (!address) {
    const addresses = await viemWallet.getAddresses()
    if (!addresses[0]) throw new Error('No addresses found in wallet')
    address = addresses[0]
  }

  // Create a custom account that uses the injected wallet for signing
  const account = {
    address,
    type: 'json-rpc' as const,
    signTransaction: async (tx: any) => {
      // viem's WalletClient handles signing via the ethereum transport
      // Remove account from tx if present, as viemWallet is already bound to it
      const { account: _, ...txWithoutAccount } = tx
      return await viemWallet.signTransaction(txWithoutAccount as any)
    },
    signMessage: async ({ message }: any) => {
      return await viemWallet.signMessage({ account: address, message })
    },
    signTypedData: async (data: any) => {
      const { account: _, ...dataWithoutAccount } = data
      return await viemWallet.signTypedData(dataWithoutAccount as any)
    },
  }

  return createClient({ chain: studionet, account: account as any })
}

// ─── Source / State Fetch ────────────────────────────────────────────────────

export const getContractSource = async (address: string): Promise<string | null> => {
  try {
    const res = await fetch(`/api/v1/contracts/source/${address}`)
    if (!res.ok) return null
    const json = await res.json() as { data?: string }
    return json.data ?? null
  } catch {
    return null
  }
}

// ─── Contract Interaction ────────────────────────────────────────────────────

export const readContractState = async (contractAddress: string) => {
  const client = createStudionetClient()
  return client.getContractSchema(contractAddress as `0x${string}`)
}

export const callContractMethod = async (
  contractAddress: string,
  method: string,
  args: CalldataEncodable[]
) => {
  const client = createStudionetClient()
  return client.readContract({
    address: contractAddress as `0x${string}`,
    functionName: method,
    args,
  })
}
