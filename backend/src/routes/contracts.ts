import { Router, Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { generateContract } from '../services/contractGenerator'
import { validateContract } from '../services/contractValidator'
import { deployContract } from '../services/contractDeployer'
import { simulateContractMethod } from '../services/contractSimulator'
import { getContractSource, getContractState } from '../services/contractIntrospection'
import { generateLimiter, deployLimiter } from '../middleware/rateLimiter'
import { supabase } from '../db/supabase'

const router = Router()

// ─── Generate ─────────────────────────────────────────────────────────────────

const GenerateSchema = z.object({
  description: z.string().min(20, 'Description must be at least 20 characters'),
  model: z.literal('groq').optional(),
})

router.post(
  '/generate',
  generateLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { description } = GenerateSchema.parse(req.body)

      const result = await generateContract(description)

      await supabase.from('contract_generations').insert({
        generation_id: result.generationId,
        description,
        generated_code: result.generatedCode,
        contract_name: result.contractName,
        methods: result.methods,
        state_variables: result.stateVariables,
        estimation: result.estimation,
        model_used: result.modelUsed,
      })

      res.json({ data: result })
    } catch (err) {
      next(err)
    }
  }
)

// ─── Validate ─────────────────────────────────────────────────────────────────

const ValidateSchema = z.object({
  code: z.string().min(1, 'Code is required'),
})

router.post(
  '/validate',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { code } = ValidateSchema.parse(req.body)
      const result = validateContract(code)
      res.json({ data: result })
    } catch (err) {
      next(err)
    }
  }
)

// ─── Simulate ─────────────────────────────────────────────────────────────────

const SimulateSchema = z.object({
  code: z.string().min(1, 'Code is required'),
  methodName: z.string().min(1, 'Method name is required'),
  inputs: z.record(z.string()),
})

router.post(
  '/simulate',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const payload = SimulateSchema.parse(req.body)
      const result = await simulateContractMethod(payload)
      res.json({ data: result })
    } catch (err) {
      next(err)
    }
  }
)

// ─── Deploy ───────────────────────────────────────────────────────────────────

const DeploySchema = z.object({
  generationId: z.string(),
  code: z.string().min(1),
  mode: z.enum(['system', 'wallet']),
  network: z.enum(['studionet', 'bradbury']),
  walletPrivateKey: z.string().optional(),
})

router.post(
  '/deploy',
  deployLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const payload = DeploySchema.parse(req.body)

      const validation = validateContract(payload.code)
      if (!validation.isValid) {
        res.status(400).json({ error: 'Validation failed', details: validation })
        return
      }

      const result = await deployContract(payload)

      await supabase.from('deployed_contracts').insert({
        transaction_hash: result.transactionHash,
        contract_address: result.contractAddress,
        generation_id: payload.generationId,
        network: result.network,
        mode: result.mode,
        deployed_by: result.deployedBy,
      })

      res.json({ data: result })
    } catch (err) {
      next(err)
    }
  }
)

// ─── Source only (used by frontend for non-marketplace contracts) ─────────────

router.get(
  '/source/:address',
  async (req: Request<{ address: string }>, res: Response, next: NextFunction) => {
    try {
      const { address } = req.params
      const source = await getContractSource(address).catch(() => null)
      if (!source) {
        res.status(404).json({ error: 'Source not found' })
        return
      }
      res.json({ data: source })
    } catch (err) {
      next(err)
    }
  }
)

// ─── Introspect by address ─────────────────────────────────────────────────────

router.get(
  '/address/:address',
  async (req: Request<{ address: string }>, res: Response, next: NextFunction) => {
    try {
      const { address } = req.params

      // Try to get source + state from GenLayer RPC — don't throw if unavailable
      const [sourceResult, stateResult] = await Promise.allSettled([
        getContractSource(address),
        getContractState(address),
      ])

      const source = sourceResult.status === 'fulfilled' ? sourceResult.value : null
      const state = stateResult.status === 'fulfilled' ? stateResult.value : null

      // If RPC gave us nothing, check marketplace_listings for stored source
      let resolvedSource = source
      if (!resolvedSource) {
        const { data: listing } = await supabase
          .from('marketplace_listings')
          .select('source_code')
          .eq('contract_address', address)
          .maybeSingle()
        resolvedSource = listing?.source_code ?? null
      }

      res.json({ data: { address, source: resolvedSource, state } })
    } catch (err) {
      next(err)
    }
  }
)

export default router
