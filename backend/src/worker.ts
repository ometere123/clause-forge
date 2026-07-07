import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { ZodError } from 'zod'
import contracts from './api/contracts'
import marketplace from './api/marketplace'
import { config } from './config'
import { rateLimiter } from './api/middleware'

// Clause Forge API on Cloudflare Workers.
// Frontend deploys separately to Vercel and calls this Worker through VITE_API_URL.

const app = new Hono().basePath('/api/v1')

const isAllowedOrigin = (origin?: string) => {
  if (!origin) return true
  if (origin.startsWith('http://localhost')) return true
  if (origin === config.cors.frontendUrl) return true
  if (config.cors.allowedOrigins.includes(origin)) return true
  if (/^https:\/\/[^/]+\.vercel\.app$/.test(origin)) return true
  return false
}

// CORS is required because Vercel frontend and Cloudflare backend are separate origins.
app.use(
  '*',
  cors({
    origin: (origin) => (isAllowedOrigin(origin) ? origin : ''),
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'x-groq-api-key', 'x-openai-api-key'],
    credentials: true,
  })
)

app.use('*', rateLimiter(100))

app.route('/contracts', contracts)
app.route('/marketplace', marketplace)

app.get('/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }))

app.onError((err, c) => {
  if (err instanceof ZodError) {
    return c.json({ error: err.issues[0]?.message ?? 'Invalid request', issues: err.issues }, 400)
  }

  const operational = err as Error & { statusCode?: number; isOperational?: boolean }
  const statusCode = operational.statusCode ?? 500
  const message = operational.isOperational ? operational.message : 'Internal server error'

  console.error(`[Error] ${err.message}`, { statusCode, stack: err.stack })

  return c.json({ error: message }, statusCode as 400)
})

app.notFound((c) => c.json({ error: 'Not found' }, 404))

export default app

