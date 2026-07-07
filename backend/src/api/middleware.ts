import type { Context, Next } from 'hono'
import { getSupabase } from '../db/supabase'

// ─── Rate limiting ────────────────────────────────────────────────────────────
// Per-isolate sliding window. Not globally exact on Workers (each isolate has
// its own map), but bounds abuse per PoP; the AI quota below is the real
// cost control and is Supabase-backed (global).

const buckets = new Map<string, { windowStart: number; count: number }>()

export const rateLimiter = (max: number, windowMs = 60_000) =>
  async (c: Context, next: Next) => {
    const key = `${clientIp(c)}:${c.req.path}`
    const now = Date.now()
    const bucket = buckets.get(key)

    if (!bucket || now - bucket.windowStart >= windowMs) {
      buckets.set(key, { windowStart: now, count: 1 })
    } else if (bucket.count >= max) {
      return c.json({ error: 'Too many requests. Please wait a moment.' }, 429)
    } else {
      bucket.count += 1
    }

    if (buckets.size > 10_000) buckets.clear() // bound memory per isolate

    await next()
  }

// ─── Client identity ──────────────────────────────────────────────────────────

const clientIp = (c: Context): string =>
  c.req.header('cf-connecting-ip') ??
  c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ??
  'unknown'

const sha256Hex = async (value: string): Promise<string> => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

// ─── AI usage quota (3 free calls/day, BYO Groq key bypasses) ─────────────────

const FREE_DAILY_CALLS = 3

export const getRequestGroqApiKey = (c: Context): string | undefined =>
  c.req.header('x-groq-api-key')?.trim() || undefined

const todayKey = () => new Date().toISOString().slice(0, 10)

const useDatabaseLimit = async (clientKey: string, date: string) => {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('ai_usage_limits')
    .select('id, call_count')
    .eq('client_key', clientKey)
    .eq('usage_date', date)
    .maybeSingle()

  if (error) return null

  const currentCount = data?.call_count ?? 0
  if (currentCount >= FREE_DAILY_CALLS) {
    return { allowed: false, remaining: 0 }
  }

  if (data?.id) {
    const { error: updateError } = await supabase
      .from('ai_usage_limits')
      .update({ call_count: currentCount + 1, updated_at: new Date().toISOString() })
      .eq('id', data.id)
    if (updateError) return null
  } else {
    const { error: insertError } = await supabase
      .from('ai_usage_limits')
      .insert({ client_key: clientKey, usage_date: date, call_count: 1 })
    if (insertError) return null
  }

  return { allowed: true, remaining: Math.max(0, FREE_DAILY_CALLS - currentCount - 1) }
}

export const aiUsageLimiter = async (c: Context, next: Next) => {
  if (getRequestGroqApiKey(c)) {
    c.header('X-Clause-Forge-AI-Tier', 'bring-your-own-key')
    await next()
    return
  }

  const clientKey = await sha256Hex(clientIp(c))
  const quota = await useDatabaseLimit(clientKey, todayKey())

  // If Supabase is unreachable, fail open — better to serve than to block.
  if (quota && !quota.allowed) {
    return c.json(
      {
        error:
          'Free AI limit reached. Add your Groq API key for unlimited generation and debugging, or try again tomorrow.',
        limit: FREE_DAILY_CALLS,
        remaining: 0,
      },
      429
    )
  }

  c.header('X-Clause-Forge-AI-Tier', 'free')
  c.header('X-Clause-Forge-AI-Limit', String(FREE_DAILY_CALLS))
  c.header('X-Clause-Forge-AI-Remaining', String(quota?.remaining ?? FREE_DAILY_CALLS))
  await next()
}

