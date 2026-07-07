// Works on both Node (local dev) and Cloudflare Workers (nodejs_compat).
// On Workers, process.env is populated from wrangler vars/secrets.
// Values are read lazily so the module can load before env is available.

const env = (key: string, fallback = ''): string => process.env[key] ?? fallback

const required = (key: string): string => {
  const value = process.env[key]
  if (!value) throw new Error(`Missing required env var: ${key}`)
  return value
}

export const config = {
  get port() {
    return parseInt(env('PORT', '3000'), 10)
  },
  get nodeEnv() {
    return env('NODE_ENV', 'development')
  },
  get isDev() {
    return env('NODE_ENV') !== 'production'
  },

  supabase: {
    get url() {
      return required('SUPABASE_URL')
    },
    get serviceKey() {
      return required('SUPABASE_SERVICE_KEY')
    },
  },

  groq: {
    get apiKey() {
      return required('GROQ_API_KEY')
    },
    model: 'llama-3.3-70b-versatile',
  },

  openai: {
    get apiKeyOptional() {
      return env('OPENAI_API_KEY')
    },
    get apiKey() {
      return required('OPENAI_API_KEY')
    },
    get model() {
      // Contract generation needs a strong model; mini-tier models produce
      // GenVM code with structural bugs (wrong ABI param types, ungated
      // nondet calls, storage-type instantiation).
      return env('OPENAI_MODEL', 'gpt-4.1')
    },
  },

  ai: {
    // Real-world GenLayer contracts routinely exceed 3000 tokens; a low cap
    // truncates methods mid-body. Groq TPM limits were the old reason for
    // 3000, so keep a smaller cap on the Groq path only.
    maxTokens: 8000,
    groqMaxTokens: 3000,
  },

  genLayer: {
    // All deployments/writes are signed in the user's browser wallet.
    // The backend holds no private keys; this RPC is used for reads only.
    get studionetRpc() {
      return env('STUDIONET_RPC', env('LOCALNET_RPC', 'https://studio.genlayer.com/api'))
    },
  },

  cors: {
    get frontendUrl() {
      return env('FRONTEND_URL', 'http://localhost:5173')
    },
    get allowedOrigins() {
      return env('ALLOWED_ORIGINS')
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean)
    },
  },
}


