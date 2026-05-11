import dotenv from 'dotenv'
dotenv.config()

const required = (key: string): string => {
  const value = process.env[key]
  if (!value) throw new Error(`Missing required env var: ${key}`)
  return value
}

export const config = {
  port: parseInt(process.env.PORT ?? '3000', 10),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  isDev: process.env.NODE_ENV !== 'production',

  supabase: {
    url: required('SUPABASE_URL'),
    serviceKey: required('SUPABASE_SERVICE_KEY'),
  },

  groq: {
    apiKey: required('GROQ_API_KEY'),
    model: 'llama-3.3-70b-versatile',
    maxTokens: 3000,
  },

  genLayer: {
    studionetRpc: process.env.STUDIONET_RPC ?? process.env.LOCALNET_RPC ?? 'https://studio.genlayer.com/api',
    systemPrivateKey: process.env.SYSTEM_PRIVATE_KEY ?? '',
  },

  cors: {
    frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:5173',
  },

  sentry: {
    dsn: process.env.SENTRY_DSN ?? '',
  },
}
