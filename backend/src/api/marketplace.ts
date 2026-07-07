import { Hono } from 'hono'
import { z } from 'zod'
import { getSupabase } from '../db/supabase'

const marketplace = new Hono()

const toListing = (row: any) => ({
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
})

// ─── List Marketplace Listings ────────────────────────────────────────────────

marketplace.get('/', async (c) => {
  const { search, category, sort } = c.req.query()

  let query = getSupabase()
    .from('marketplace_listings')
    .select('*')
    .order('created_at', { ascending: false })

  if (search) {
    query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`)
  }
  if (category) {
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
    return c.json({ data: [] })
  }

  return c.json({ data: (data ?? []).map(toListing) })
})

// ─── Get Single Listing by Contract Address ───────────────────────────────────

marketplace.get('/:address', async (c) => {
  const { data, error } = await getSupabase()
    .from('marketplace_listings')
    .select('*')
    .eq('contract_address', c.req.param('address'))
    .maybeSingle()

  if (error || !data) {
    return c.json({ error: 'Listing not found' }, 404)
  }

  return c.json({
    data: { ...toListing(data), sourceCode: data.source_code ?? null },
  })
})

// ─── Submit to Marketplace ────────────────────────────────────────────────────

const SubmitSchema = z.object({
  contractAddress: z.string().min(1),
  name: z.string().min(1).max(100),
  description: z.string().min(1).max(1000),
  category: z.enum(['verification', 'scoring', 'voting', 'data-enrichment', 'custom']),
  tags: z.array(z.string()).max(10).default([]),
  walletAddress: z.string().min(1),
  network: z.enum(['studionet', 'asimov', 'bradbury']).default('studionet'),
  sourceCode: z.string().optional(),
})

marketplace.post('/submit', async (c) => {
  const payload = SubmitSchema.parse(await c.req.json())
  const supabase = getSupabase()

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
    return c.json({ error: 'Failed to submit listing', details: error.message }, 500)
  }

  return c.json({
    data: { ...toListing(data), network: data.network ?? payload.network },
  })
})

export default marketplace
