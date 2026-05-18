import { Request, Response, NextFunction } from 'express'
import { createHash } from 'crypto'
import { supabase } from '../db/supabase'

const FREE_DAILY_CALLS = 7
const usageByClient = new Map<string, { date: string; count: number }>()

const todayKey = () => new Date().toISOString().slice(0, 10)

const getClientKey = (req: Request) => {
  const forwarded = req.headers['x-forwarded-for']
  const ip = Array.isArray(forwarded)
    ? forwarded[0]
    : forwarded?.split(',')[0]?.trim() || req.ip || req.socket.remoteAddress || 'unknown'
  return createHash('sha256').update(ip).digest('hex')
}

export const getRequestGroqApiKey = (req: Request): string | undefined => {
  const raw = req.headers['x-groq-api-key']
  const value = Array.isArray(raw) ? raw[0] : raw
  return value?.trim() || undefined
}

const useMemoryLimit = (clientKey: string, date: string) => {
  const current = usageByClient.get(clientKey)
  const usage = current?.date === date ? current : { date, count: 0 }

  if (usage.count >= FREE_DAILY_CALLS) {
    return { allowed: false, remaining: 0 }
  }

  usage.count += 1
  usageByClient.set(clientKey, usage)
  return { allowed: true, remaining: Math.max(0, FREE_DAILY_CALLS - usage.count) }
}

const useDatabaseLimit = async (clientKey: string, date: string) => {
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

export const aiUsageLimiter = async (req: Request, res: Response, next: NextFunction) => {
  const userApiKey = getRequestGroqApiKey(req)

  if (userApiKey) {
    res.setHeader('X-Clause-Forge-AI-Tier', 'bring-your-own-key')
    next()
    return
  }

  const date = todayKey()
  const key = getClientKey(req)
  const quota = (await useDatabaseLimit(key, date)) ?? useMemoryLimit(key, date)

  if (!quota.allowed) {
    res.status(429).json({
      error: 'Free AI limit reached. Add your Groq API key for unlimited generation and debugging.',
      limit: FREE_DAILY_CALLS,
      remaining: 0,
    })
    return
  }

  res.setHeader('X-Clause-Forge-AI-Tier', 'free')
  res.setHeader('X-Clause-Forge-AI-Limit', String(FREE_DAILY_CALLS))
  res.setHeader('X-Clause-Forge-AI-Remaining', String(quota.remaining))
  next()
}
