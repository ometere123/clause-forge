import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { config } from '../config'

// Lazy singleton so the module can load before env vars are available
// (required on Cloudflare Workers, harmless on Node).
let client: SupabaseClient | null = null

export const getSupabase = (): SupabaseClient => {
  if (!client) {
    client = createClient(config.supabase.url, config.supabase.serviceKey, {
      auth: { persistSession: false },
    })
  }
  return client
}
