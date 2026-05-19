import cors from 'cors'
import { config } from '../config'

export const corsMiddleware = cors({
  origin: [config.cors.frontendUrl, 'http://localhost:5173'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-groq-api-key'],
  credentials: true,
})
