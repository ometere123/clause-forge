import axios from 'axios'
import type {
  GeneratedContract,
  GenerateRequest,
  DeploymentRecord,
  Network,
  ValidationResult,
  MarketplaceListing,
  ApiResponse,
  DebugContractRequest,
  DebugContractResult,
} from '@/types'
import { getGroqApiHeaders } from '@/utils/apiKey'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: { 'Content-Type': 'application/json' },
  timeout: 60000,
})

// ─── Contracts ───────────────────────────────────────────────────────────────

export const generateContract = async (
  payload: GenerateRequest
): Promise<GeneratedContract> => {
  const { data } = await api.post<ApiResponse<GeneratedContract>>(
    '/v1/contracts/generate',
    payload,
    { headers: getGroqApiHeaders() }
  )
  return data.data
}

export const debugContract = async (
  payload: DebugContractRequest
): Promise<DebugContractResult> => {
  const { data } = await api.post<ApiResponse<DebugContractResult>>(
    '/v1/contracts/debug',
    payload,
    { headers: getGroqApiHeaders(), timeout: 120000 }
  )
  return data.data
}

export const validateContract = async (
  code: string
): Promise<ValidationResult> => {
  const { data } = await api.post<ApiResponse<ValidationResult>>(
    '/v1/contracts/validate',
    { code }
  )
  return data.data
}

// Called after a successful in-browser deploy so the backend can index it.
// Fire-and-forget: indexing failure must never break a completed deployment.
export const recordDeployment = async (payload: DeploymentRecord): Promise<void> => {
  try {
    await api.post('/v1/contracts/deployments', payload)
  } catch {
    // Deployment already succeeded on-chain; indexing is best-effort.
  }
}

// ─── Introspection ───────────────────────────────────────────────────────────

export const getContractByAddress = async (address: string) => {
  const { data } = await api.get(`/v1/contracts/address/${address}`)
  return data.data
}

export const forkContract = async (
  baseAddress: string,
  modifications: string
): Promise<GeneratedContract> => {
  const { data } = await api.post<ApiResponse<GeneratedContract>>(
    '/v1/contracts/fork',
    { baseAddress, modifications }
  )
  return data.data
}

export const composeContract = async (
  baseAddress: string,
  wrapperLogic: string
): Promise<GeneratedContract> => {
  const { data } = await api.post<ApiResponse<GeneratedContract>>(
    '/v1/contracts/compose',
    { baseAddress, wrapperLogic }
  )
  return data.data
}

// ─── Marketplace ─────────────────────────────────────────────────────────────

export const getMarketplaceListing = async (contractAddress: string) => {
  const { data } = await api.get(`/v1/marketplace/${contractAddress}`)
  return data.data as {
    id: string
    contractAddress: string
    network?: Network
    name: string
    description: string
    category: string
    tags: string[]
    rating: number
    forkedCount: number
    createdAt: string
    submittedBy: string
    sourceCode: string | null
  }
}

export const getMarketplaceListings = async (params?: {
  search?: string
  category?: string
  sort?: 'rating' | 'forked' | 'recent'
}): Promise<MarketplaceListing[]> => {
  const { data } = await api.get('/v1/marketplace', { params })
  return data.data
}

export const submitToMarketplace = async (payload: {
  contractAddress: string
  name: string
  description: string
  category: string
  tags: string[]
  walletAddress: string
  network?: Network
  sourceCode?: string
}): Promise<MarketplaceListing> => {
  const { data } = await api.post('/v1/marketplace/submit', payload)
  return data.data
}

export default api
