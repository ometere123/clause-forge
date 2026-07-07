import Groq from 'groq-sdk'
import { config } from '../config'

export interface AiMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface AiCompletion {
  content: string
  model: string
  provider: 'groq' | 'openai'
  usage: {
    promptTokens: number
    completionTokens: number
  }
}

interface OperationalError extends Error {
  statusCode?: number
  isOperational?: boolean
}

export const createAiError = (message: string, statusCode = 502): OperationalError => {
  const error: OperationalError = new Error(message)
  error.statusCode = statusCode
  error.isOperational = true
  return error
}

const readErrorBody = async (response: Response) => {
  try {
    const body = (await response.json()) as { error?: { message?: string } }
    return body.error?.message ?? response.statusText
  } catch {
    return response.statusText
  }
}

const shouldUseOpenAi = (apiKey?: string) =>
  !apiKey && Boolean(config.openai.apiKeyOptional)

const completeWithOpenAi = async (
  messages: AiMessage[],
  maxTokens: number
): Promise<AiCompletion> => {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.openai.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: config.openai.model,
      max_tokens: maxTokens,
      messages,
    }),
  })

  if (!response.ok) {
    const message = await readErrorBody(response)
    throw createAiError(`OpenAI could not complete the request: ${message}`, response.status)
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>
    usage?: { prompt_tokens?: number; completion_tokens?: number }
  }

  return {
    content: data.choices?.[0]?.message?.content ?? '',
    model: config.openai.model,
    provider: 'openai',
    usage: {
      promptTokens: data.usage?.prompt_tokens ?? 0,
      completionTokens: data.usage?.completion_tokens ?? 0,
    },
  }
}

const completeWithGroq = async (
  messages: AiMessage[],
  maxTokens: number,
  apiKey?: string
): Promise<AiCompletion> => {
  const groq = new Groq({ apiKey: apiKey || config.groq.apiKey })
  const completion = await groq.chat.completions.create({
    model: config.groq.model,
    max_tokens: maxTokens,
    messages,
  })

  return {
    content: completion.choices[0]?.message?.content ?? '',
    model: config.groq.model,
    provider: 'groq',
    usage: {
      promptTokens: completion.usage?.prompt_tokens ?? 0,
      completionTokens: completion.usage?.completion_tokens ?? 0,
    },
  }
}

export const completeAi = async (
  messages: AiMessage[],
  options: { maxTokens?: number; apiKey?: string } = {}
): Promise<AiCompletion> => {
  if (shouldUseOpenAi(options.apiKey)) {
    return completeWithOpenAi(messages, options.maxTokens ?? config.ai.maxTokens)
  }

  // Groq keys hit tokens-per-minute limits quickly; keep its cap lower.
  return completeWithGroq(messages, options.maxTokens ?? config.ai.groqMaxTokens, options.apiKey)
}
