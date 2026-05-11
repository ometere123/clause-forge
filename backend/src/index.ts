import express from 'express'
import helmet from 'helmet'
import { config } from './config'
import { corsMiddleware } from './middleware/cors'
import { globalLimiter } from './middleware/rateLimiter'
import { errorHandler } from './middleware/errorHandler'
import apiRouter from './routes'

const app = express()

app.use(helmet())
app.use(corsMiddleware)
app.use(express.json({ limit: '1mb' }))
app.use(globalLimiter)

app.use('/api/v1', apiRouter)

app.use(errorHandler)

app.listen(config.port, () => {
  console.log(`Clause Forge backend running on port ${config.port}`)
  console.log(`Environment: ${config.nodeEnv}`)
  console.log(`Studionet RPC: ${config.genLayer.studionetRpc}`)
})

export default app
