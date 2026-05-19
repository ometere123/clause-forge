import { Router, Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { supabase } from '../db/supabase'

const router = Router()

// ─── List Marketplace Listings ────────────────────────────────────────────────

router.get(
  '/',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { search, category, sort } = req.query

      let query = supabase
        .from('marketplace_listings')
        .select('*')
        .order('created_at', { ascending: false })

      if (search && typeof search === 'string') {
        query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`)
      }

      if (category && typeof category === 'string') {
        query = query.eq('category', category)
      }

      if (sort === 'rating') {
        query = query.order('rating', { ascending: false })
      } else if (sort === 'forked') {
        query = query.order('forked_count', { ascending: false })
      }

      const { data, error } = await query

      if (error) {
        // Table might not exist yet — return empty list gracefully
        res.json({ data: [] })
        return
      }

      const listings = (data ?? []).map((row: any) => ({
        id: row.id,
        contractAddress: row.contract_address,
        network: row.network ?? 'studionet',
        name: row.name,
        description: row.description,
        category: row.category,
        tags: row.tags ?? [],
        rating: row.rating ?? 0,
        forkedCount: row.forked_count ?? 0,
        createdAt: row.created_at,
        submittedBy: row.submitted_by,
      }))

      res.json({ data: listings })
    } catch (err) {
      next(err)
    }
  }
)

// ─── Get Single Listing by Contract Address ───────────────────────────────────

router.get(
  '/:address',
  async (req: Request<{ address: string }>, res: Response, next: NextFunction) => {
    try {
      const { address } = req.params

      const { data, error } = await supabase
        .from('marketplace_listings')
        .select('*')
        .eq('contract_address', address)
        .maybeSingle()

      if (error || !data) {
        res.status(404).json({ error: 'Listing not found' })
        return
      }

      res.json({
        data: {
          id: data.id,
          contractAddress: data.contract_address,
          network: data.network ?? 'studionet',
          name: data.name,
          description: data.description,
          category: data.category,
          tags: data.tags ?? [],
          rating: data.rating ?? 0,
          forkedCount: data.forked_count ?? 0,
          createdAt: data.created_at,
          submittedBy: data.submitted_by,
          sourceCode: data.source_code ?? null,
        },
      })
    } catch (err) {
      next(err)
    }
  }
)

// ─── Submit to Marketplace ────────────────────────────────────────────────────

const SubmitSchema = z.object({
  contractAddress: z.string().min(1),
  name: z.string().min(1).max(100),
  description: z.string().min(1).max(1000),
  category: z.enum(['verification', 'scoring', 'voting', 'data-enrichment', 'custom']),
  tags: z.array(z.string()).max(10).default([]),
  walletAddress: z.string().min(1),
  network: z.enum(['studionet', 'bradbury']).default('studionet'),
  sourceCode: z.string().optional(),
})

router.post(
  '/submit',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const payload = SubmitSchema.parse(req.body)

      const insertPayload = {
        contract_address: payload.contractAddress,
        network: payload.network,
        name: payload.name,
        description: payload.description,
        category: payload.category,
        tags: payload.tags,
        submitted_by: payload.walletAddress,
        source_code: payload.sourceCode ?? null,
        rating: 0,
        forked_count: 0,
      }

      let { data, error } = await supabase
        .from('marketplace_listings')
        .insert(insertPayload)
        .select()
        .single()

      if (error && error.message.toLowerCase().includes('network')) {
        const { network: _network, ...legacyPayload } = insertPayload
        const retry = await supabase
          .from('marketplace_listings')
          .insert(legacyPayload)
          .select()
          .single()
        data = retry.data
        error = retry.error
      }

      if (error) {
        res.status(500).json({ error: 'Failed to submit listing', details: error.message })
        return
      }

      res.json({
        data: {
          id: data.id,
          contractAddress: data.contract_address,
          network: data.network ?? payload.network,
          name: data.name,
          description: data.description,
          category: data.category,
          tags: data.tags,
          rating: data.rating,
          forkedCount: data.forked_count,
          createdAt: data.created_at,
          submittedBy: data.submitted_by,
        },
      })
    } catch (err) {
      next(err)
    }
  }
)

export default router
