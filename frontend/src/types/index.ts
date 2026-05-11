// ─── Contract Generation ────────────────────────────────────────────────────

export interface ContractMethod {
  name: string
  inputs: Array<{ name: string; type: string }>
  outputs: Array<{ name: string; type: string }>
  isWrite: boolean
  docstring?: string
}

export interface ContractStructure {
  methods: ContractMethod[]
  stateVariables: Record<string, string>
}

export interface ContractCapabilities {
  needsLlm: boolean
  needsWebFetch: boolean
  needsDataAccess: boolean
  estimatedGasUsage: number
}

export interface ContractEstimation {
  tokensInput: number
  tokensOutput: number
  estimatedCostUsd: number
  generationTimeMs: number
  capabilities: ContractCapabilities
}

export interface GeneratedContract {
  generationId: string
  generatedCode: string
  contractName: string
  methods: ContractMethod[]
  stateVariables: Record<string, string>
  estimation: ContractEstimation
  originalDescription: string
  modelUsed: string
  generatedAt: string
}

// ─── Deployment ─────────────────────────────────────────────────────────────

export type DeploymentMode = 'system' | 'wallet'
export type Network = 'studionet' | 'bradbury'
export type DeploymentStatus = 'idle' | 'pending' | 'accepted' | 'finalized' | 'failed'

export interface DeploymentResult {
  transactionHash: string
  contractAddress: string
  network: Network
  deployedAt: string
  deployedBy: string
  mode: DeploymentMode
}

export interface DeploymentStep {
  step: number
  name: string
  status: 'pending' | 'in_progress' | 'completed' | 'failed'
  timestamp?: string
}

// ─── Validation ─────────────────────────────────────────────────────────────

export interface ValidationError {
  type: string
  severity: 'critical' | 'error' | 'warning'
  line?: number
  message: string
  suggestion?: string
}

export interface ValidationResult {
  isValid: boolean
  errors: ValidationError[]
  warnings: ValidationError[]
  summary: string
}

// ─── Marketplace ─────────────────────────────────────────────────────────────

export type ContractCategory =
  | 'verification'
  | 'scoring'
  | 'voting'
  | 'data-enrichment'
  | 'custom'

export interface MarketplaceListing {
  id: string
  contractAddress: string
  network: Network
  name: string
  description: string
  category: ContractCategory
  tags: string[]
  creatorWallet: string
  rating: number
  reviewCount: number
  forkedCount: number
  usageCount: number
  createdAt: string
}

// ─── Wallet ──────────────────────────────────────────────────────────────────

export interface WalletAccount {
  address: string
  privateKey?: string
  isGenerated: boolean
}

// ─── API ─────────────────────────────────────────────────────────────────────

export interface ApiResponse<T> {
  data: T
  error?: string
}

export interface GenerateRequest {
  description: string
  model?: 'groq'
}

export interface DeployRequest {
  generationId: string
  code: string
  mode: DeploymentMode
  network: Network
  walletPrivateKey?: string
}
