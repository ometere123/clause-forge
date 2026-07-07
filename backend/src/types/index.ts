// ─── Contract Generation ──────────────────────────────────────────────────────

export interface ContractMethod {
  name: string
  inputs: Array<{ name: string; type: string }>
  outputs: Array<{ name: string; type: string }>
  isWrite: boolean
  isPayable?: boolean
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

export type ContractKind = 'deterministic' | 'web-aware' | 'ai-judgement'

export interface ContractGenerationReport {
  contractKind: ContractKind
  whatThisContractDoes: string
  whyGenLayer: string
  fitCheck: {
    genLayerDecision: string
    acceptedStateChange: string
    validatorEvidence: string
    exactAgreementFields: string[]
    semanticAgreementFields: string[]
    uncertainRejectedAppealedPath: string
  }
  stateTransitions: string[]
  consensusCriticalFields: {
    exact: string[]
    semantic: string[]
  }
  responsibilityBoundary: {
    insideContract: string[]
    outsideContract: string[]
  }
  equivalenceStrategy: {
    strategy: string
    explanation: string
  }
  sourceOfTruth: {
    genLayer: string[]
    offChain: string[]
  }
  frontendBackendCallTable: {
    frontend: string[]
    backend: string[]
  }
  integrationNotes: string[]
  testPlan: string[]
  badPatternReport: Array<{
    pattern: string
    status: 'pass' | 'warning' | 'fail'
    detail: string
  }>
}

export interface ContractPlainSummary {
  headline: string
  whatItDoes: string
  whatItStores: string[]
  actions: string[]
  reads: string[]
  notes: string[]
}

export interface AutoFixInfo {
  attempted: boolean
  succeeded: boolean
  issuesFixed: string[]
}

export interface GeneratedContract {
  generationId: string
  generatedCode: string
  contractName: string
  methods: ContractMethod[]
  stateVariables: Record<string, string>
  frontendCallMap?: FrontendCallMapItem[]
  generationReport?: ContractGenerationReport
  plainSummary?: ContractPlainSummary
  validation?: ValidationResult
  autoFix?: AutoFixInfo
  estimation: ContractEstimation
  originalDescription: string
  modelUsed: string
  generatedAt: string
}

export interface FrontendCallMapItem {
  action: string
  method: string
  type: 'view' | 'write' | 'payable'
  args: string[]
  valueRequired: boolean
  display: string
}

// ─── Validation ───────────────────────────────────────────────────────────────

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

// ─── Deployment ───────────────────────────────────────────────────────────────

export type DeploymentMode = 'external-wallet'
export type Network = 'studionet' | 'asimov' | 'bradbury'

export interface DeploymentResult {
  transactionHash: string
  contractAddress: string
  network: Network
  deployedAt: string
  deployedBy: string
  mode: DeploymentMode
}

// ─── API Requests ─────────────────────────────────────────────────────────────

export interface GenerateRequest {
  description: string
  model?: 'groq' | 'openai'
}

export interface ValidateRequest {
  code: string
}

// Deployments are signed in the user's browser wallet; the backend only
// indexes completed deploys and never receives code-signing keys.
export interface DeploymentRecord {
  generationId: string
  contractAddress: string
  transactionHash: string
  network: Network
  deployedBy: string
}

export interface ForkRequest {
  baseAddress: string
  modifications: string
}

export interface ComposeRequest {
  baseAddress: string
  wrapperLogic: string
}

// ─── Simulation ───────────────────────────────────────────────────────────────

export interface SimulationRequest {
  code: string
  methodName: string
  inputs: Record<string, string>
}

export interface SimulationResult {
  success: boolean
  output: string
  error: string | null
  executionTimeMs: number
}

