import { Hono } from 'hono'
import { z } from 'zod'
import { generateContract } from '../services/contractGenerator'
import { debugContract } from '../services/contractDebugger'
import { validateContract } from '../services/contractValidator'
import { getContractSource, getContractState } from '../services/contractIntrospection'
import { getSupabase } from '../db/supabase'
import { aiUsageLimiter, getRequestGroqApiKey, rateLimiter } from './middleware'

const contracts = new Hono()

// ─── Generate ─────────────────────────────────────────────────────────────────

const GenerateSchema = z.object({
  description: z.string().min(20, 'Description must be at least 20 characters'),
  model: z.enum(['groq', 'openai']).optional(),
})

contracts.post('/generate', rateLimiter(10), aiUsageLimiter, async (c) => {
  const { description } = GenerateSchema.parse(await c.req.json())

  const result = await generateContract(description, getRequestGroqApiKey(c))

  await getSupabase().from('contract_generations').insert({
    generation_id: result.generationId,
    description,
    generated_code: result.generatedCode,
    contract_name: result.contractName,
    methods: result.methods,
    state_variables: result.stateVariables,
    estimation: result.estimation,
    model_used: result.modelUsed,
  })

  return c.json({ data: result })
})

// ─── Debug / Fix ──────────────────────────────────────────────────────────────

const DebugSchema = z.object({
  code: z.string().min(1, 'Code is required'),
  errorMessage: z.string().min(1, 'Error message is required'),
  intent: z.string().optional(),
  previousFix: z.string().optional(),
})

contracts.post('/debug', rateLimiter(10), aiUsageLimiter, async (c) => {
  const payload = DebugSchema.parse(await c.req.json())
  const result = await debugContract(payload, getRequestGroqApiKey(c))
  return c.json({ data: result })
})

// ─── Validate ─────────────────────────────────────────────────────────────────

const ValidateSchema = z.object({
  code: z.string().min(1, 'Code is required'),
})

contracts.post('/validate', async (c) => {
  const { code } = ValidateSchema.parse(await c.req.json())
  return c.json({ data: validateContract(code) })
})

// ─── Record deployment ────────────────────────────────────────────────────────
// Deployments are signed entirely in the user's browser wallet. The backend
// never receives private keys — this endpoint only indexes completed deploys.

const DeploymentRecordSchema = z.object({
  generationId: z.string(),
  contractAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid contract address'),
  transactionHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/, 'Invalid transaction hash'),
  network: z.enum(['studionet', 'asimov', 'bradbury']),
  deployedBy: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid deployer address'),
})

contracts.post('/deployments', rateLimiter(5), async (c) => {
  const payload = DeploymentRecordSchema.parse(await c.req.json())

  await getSupabase().from('deployed_contracts').insert({
    transaction_hash: payload.transactionHash,
    contract_address: payload.contractAddress,
    generation_id: payload.generationId,
    network: payload.network,
    mode: 'external-wallet',
    deployed_by: payload.deployedBy,
  })

  return c.json({ data: { recorded: true } })
})

// ─── Source only ──────────────────────────────────────────────────────────────

contracts.get('/source/:address', async (c) => {
  const source = await getContractSource(c.req.param('address')).catch(() => null)
  if (!source) {
    return c.json({ error: 'Source not found' }, 404)
  }
  return c.json({ data: source })
})

// ─── Introspect by address ────────────────────────────────────────────────────

contracts.get('/address/:address', async (c) => {
  const address = c.req.param('address')

  const [sourceResult, stateResult] = await Promise.allSettled([
    getContractSource(address),
    getContractState(address),
  ])

  const source = sourceResult.status === 'fulfilled' ? sourceResult.value : null
  const state = stateResult.status === 'fulfilled' ? stateResult.value : null

  let resolvedSource = source
  if (!resolvedSource) {
    const { data: listing } = await getSupabase()
      .from('marketplace_listings')
      .select('source_code')
      .eq('contract_address', address)
      .maybeSingle()
    resolvedSource = listing?.source_code ?? null
  }

  return c.json({ data: { address, source: resolvedSource, state } })
})

export default contracts

