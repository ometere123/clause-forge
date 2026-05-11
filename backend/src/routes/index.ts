import { Router } from 'express'
import contractsRouter from './contracts'
import marketplaceRouter from './marketplace'

const router = Router()

router.use('/contracts', contractsRouter)
router.use('/marketplace', marketplaceRouter)

router.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

export default router
