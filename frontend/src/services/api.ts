import axios from 'axios'
import type {
  GeneratedContract,
  GenerateRequest,
  DeployRequest,
  DeploymentResult,
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

export const simulateContract = async (payload: {
  code: string
  methodName: string
  inputs: Record<string, string>
}): Promise<{ success: boolean; output: string; error: string | null }> => {
  const { data } = await api.post(
    '/v1/contracts/simulate',
    payload
  )
  return data.data
}

export const deployContract = async (
  payload: DeployRequest
): Promise<DeploymentResult> => {
  const { data } = await api.post<ApiResponse<DeploymentResult>>(
    '/v1/contracts/deploy',
    payload,
    { timeout: 240000 } // 4 minutes — deployment can take up to 3 min on Studionet
  )
  return data.data
}

export const getDeploymentStatus = async (
  txHash: string
): Promise<{ status: string; contractAddress?: string }> => {
  const { data } = await api.get(`/api/v1/contracts/deploy-status/${txHash}`)
  return data.data
}

// ─── Introspection ───────────────────────────────────────────────────────────

export const getContractByAddress = async (address: string) => {
  const { data } = await api.get(`/api/v1/contracts/address/${address}`)
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
  sourceCode?: string
}): Promise<MarketplaceListing> => {
  const { data } = await api.post('/v1/marketplace/submit', payload)
  return data.data
}

export default api
