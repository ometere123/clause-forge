import rateLimit from 'express-rate-limit'

export const generateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'Too many generation requests. Please wait a moment.' },
  standardHeaders: true,
  legacyHeaders: false,
})

export const deployLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { error: 'Too many deployment requests. Please wait a moment.' },
  standardHeaders: true,
  legacyHeaders: false,
})

export const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: { error: 'Too many requests.' },
  standardHeaders: true,
  legacyHeaders: false,
})
