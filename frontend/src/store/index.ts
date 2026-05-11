import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  GeneratedContract,
  DeploymentResult,
  ValidationResult,
  WalletAccount,
  DeploymentStatus,
  DeploymentStep,
} from '@/types'

interface ContractStore {
  // ─── Generation ────────────────────────────────────────────────────
  description: string
  generatedContract: GeneratedContract | null
  isGenerating: boolean
  generationError: string | null

  setDescription: (description: string) => void
  setGeneratedContract: (contract: GeneratedContract | null) => void
  setIsGenerating: (loading: boolean) => void
  setGenerationError: (error: string | null) => void

  // ─── Validation ────────────────────────────────────────────────────
  validationResult: ValidationResult | null
  isValidating: boolean

  setValidationResult: (result: ValidationResult | null) => void
  setIsValidating: (loading: boolean) => void

  // ─── Deployment ────────────────────────────────────────────────────
  deploymentStatus: DeploymentStatus
  deploymentSteps: DeploymentStep[]
  deploymentResult: DeploymentResult | null
  isDeploying: boolean

  setDeploymentStatus: (status: DeploymentStatus) => void
  setDeploymentSteps: (steps: DeploymentStep[]) => void
  setDeploymentResult: (result: DeploymentResult | null) => void
  setIsDeploying: (loading: boolean) => void

  // ─── Wallet ────────────────────────────────────────────────────────
  wallet: WalletAccount | null
  wallets: WalletAccount[]
  activeWalletIndex: number
  setWallet: (wallet: WalletAccount | null) => void
  setWallets: (wallets: WalletAccount[], activeIndex: number) => void

  // ─── History ───────────────────────────────────────────────────────
  contractHistory: DeploymentResult[]
  addToHistory: (result: DeploymentResult) => void
  clearHistory: () => void

  // ─── Reset ─────────────────────────────────────────────────────────
  resetEditor: () => void
}

export const useContractStore = create<ContractStore>()(
  persist(
    (set) => ({
      // Generation
      description: '',
      generatedContract: null,
      isGenerating: false,
      generationError: null,

      setDescription: (description) => set({ description }),
      setGeneratedContract: (contract) => set({ generatedContract: contract }),
      setIsGenerating: (loading) => set({ isGenerating: loading }),
      setGenerationError: (error) => set({ generationError: error }),

      // Validation
      validationResult: null,
      isValidating: false,

      setValidationResult: (result) => set({ validationResult: result }),
      setIsValidating: (loading) => set({ isValidating: loading }),

      // Deployment
      deploymentStatus: 'idle',
      deploymentSteps: [],
      deploymentResult: null,
      isDeploying: false,

      setDeploymentStatus: (status) => set({ deploymentStatus: status }),
      setDeploymentSteps: (steps) => set({ deploymentSteps: steps }),
      setDeploymentResult: (result) => set({ deploymentResult: result }),
      setIsDeploying: (loading) => set({ isDeploying: loading }),

      // Wallet
      wallet: null,
      wallets: [],
      activeWalletIndex: 0,
      setWallet: (wallet) => set({ wallet }),
      setWallets: (wallets, activeIndex) =>
        set({ wallets, activeWalletIndex: activeIndex, wallet: wallets[activeIndex] ?? null }),

      // History
      contractHistory: [],
      addToHistory: (result) =>
        set((state) => ({
          contractHistory: [result, ...state.contractHistory].slice(0, 50),
        })),
      clearHistory: () => set({ contractHistory: [] }),

      // Reset editor state (keep wallet + history)
      resetEditor: () =>
        set({
          description: '',
          generatedContract: null,
          isGenerating: false,
          generationError: null,
          validationResult: null,
          isValidating: false,
          deploymentStatus: 'idle',
          deploymentSteps: [],
          deploymentResult: null,
          isDeploying: false,
        }),
    }),
    {
      name: 'clause-forge-store',
      // Only persist wallet and history across sessions
      partialize: (state) => ({
        wallet: state.wallet,
        contractHistory: state.contractHistory,
      }),
    }
  )
)
