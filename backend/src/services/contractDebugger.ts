import { completeAi } from './aiProvider'
import { buildFrontendCallMap, extractContractStructure } from './contractAnalysis'
import { buildCompactDebugSystemPrompt } from './genlayerKnowledge'
import { normalizeContractCode } from './contractCode'
import type { FrontendCallMapItem } from '../types'


interface OperationalError extends Error {
  statusCode?: number
  isOperational?: boolean
}

const createOperationalError = (message: string, statusCode = 502): OperationalError => {
  const error: OperationalError = new Error(message)
  error.statusCode = statusCode
  error.isOperational = true
  return error
}

const toAiDebugError = (err: unknown): OperationalError => {
  const candidate = err as {
    status?: number
    statusCode?: number
    code?: string
    error?: { message?: string; code?: string; type?: string }
    message?: string
  }

  const status = candidate?.status ?? candidate?.statusCode ?? 502
  const code = candidate?.error?.code ?? candidate?.code ?? ''
  const upstreamMessage = candidate?.error?.message ?? candidate?.message ?? ''
  const text = `${code} ${upstreamMessage}`.toLowerCase()

  if (status === 401 || status === 403 || /invalid.*api.*key|unauthorized|forbidden/.test(text)) {
    return createOperationalError(
      'The AI provider rejected the API key. Check your key, remove extra spaces, or try the system free tier.',
      401
    )
  }

  if (status === 429 || /rate.*limit|quota|too many/.test(text)) {
    const detail = upstreamMessage ? ` Provider said: ${upstreamMessage}` : ''
    return createOperationalError(
      `AI provider rate limit or quota was reached. This can happen when one debug request is too large for the key's token-per-minute limit.${detail}`,
      429
    )
  }

  if (/context|token|too large|maximum/.test(text)) {
    return createOperationalError(
      'The contract, traceback, or previous fix is too large for this debug request. Remove unrelated code/logs and try again with the exact failing traceback.',
      413
    )
  }

  if (/json_validate_failed|failed to generate json/.test(text)) {
    return createOperationalError(
      'The AI provider failed while formatting the debug response. Try again once; if it repeats, shorten the traceback and keep only the exact GenVM error.',
      502
    )
  }

  return createOperationalError(
    upstreamMessage
      ? `The AI provider could not complete the debug request: ${upstreamMessage}`
      : 'The AI provider could not complete the debug request. Check Worker logs for the upstream error.',
    status >= 400 && status < 600 ? status : 502
  )
}

const DEBUG_SECTIONS = [
  'DIAGNOSIS',
  'ISSUE_CATEGORY',
  'FIXED_CODE',
  'EXPLANATION',
  'CHANGES',
  'WARNINGS',
] as const

const MAX_DEBUG_CODE_CHARS = 12000
const MAX_DEBUG_ERROR_CHARS = 5000
const MAX_DEBUG_INTENT_CHARS = 1500
const MAX_PREVIOUS_FIX_CHARS = 8000

const truncateMiddle = (value: string, maxChars: number) => {
  const normalized = value.trim()
  if (normalized.length <= maxChars) return normalized

  const headLength = Math.floor(maxChars * 0.6)
  const tailLength = maxChars - headLength
  return `${normalized.slice(0, headLength)}

# ... Clause Forge trimmed the middle of this input to fit AI provider rate limits ...

${normalized.slice(-tailLength)}`
}

const compactDebugRequest = (request: DebugContractRequest) => ({
  code: truncateMiddle(request.code, MAX_DEBUG_CODE_CHARS),
  errorMessage: truncateMiddle(request.errorMessage, MAX_DEBUG_ERROR_CHARS),
  intent: request.intent ? truncateMiddle(request.intent, MAX_DEBUG_INTENT_CHARS) : '',
  previousFix: request.previousFix
    ? truncateMiddle(request.previousFix, MAX_PREVIOUS_FIX_CHARS)
    : '',
})

export interface DebugContractRequest {
  code: string
  errorMessage: string
  intent?: string
  previousFix?: string
}

export interface DebugContractResult {
  diagnosis: string
  fixedCode: string
  explanation: string
  changes: string[]
  warnings: string[]
  issueCategory?: string
  frontendCallMap?: FrontendCallMapItem[]
  modelUsed: string
}

const parseDebugResponse = (content: string): Omit<DebugContractResult, 'modelUsed'> => {
  const cleaned = content
    .replace(/^```json\n?/m, '')
    .replace(/^```\n?/m, '')
    .replace(/```$/m, '')
    .trim()

  try {
    const parsed = JSON.parse(cleaned)
    const fixedCode = Array.isArray(parsed.fixedCodeLines)
      ? parsed.fixedCodeLines.join('\n')
      : String(parsed.fixedCode ?? '')

    return {
      diagnosis: String(parsed.diagnosis ?? 'The error was analyzed and a fix was generated.'),
      fixedCode,
      explanation: String(parsed.explanation ?? ''),
      changes: Array.isArray(parsed.changes) ? parsed.changes.map(String) : [],
      warnings: Array.isArray(parsed.warnings) ? parsed.warnings.map(String) : [],
      issueCategory: parsed.issueCategory ? String(parsed.issueCategory) : undefined,
    }
  } catch {
    const sectionAlternation = DEBUG_SECTIONS.join('|')
    const getSection = (name: typeof DEBUG_SECTIONS[number]) => {
      const re = new RegExp(
        `(?:^|\\n)${name}:\\s*([\\s\\S]*?)(?=\\n(?:${sectionAlternation}):|$)`,
        'i'
      )
      return cleaned.match(re)?.[1]?.trim() ?? ''
    }

    const stripCodeFence = (value: string) =>
      value
        .replace(/^\s*```(?:python|py)?\s*/i, '')
        .replace(/\s*```\s*$/i, '')
        .trim()

    const parseList = (value: string) =>
      value
        .split('\n')
        .map((line) => line.replace(/^\s*[-*]\s*/, '').trim())
        .filter(Boolean)

    const fixedCodeSection = stripCodeFence(getSection('FIXED_CODE'))
    const fallbackCodeBlock =
      cleaned.match(/```(?:python|py)?\s*([\s\S]*?)```/i)?.[1]?.trim() ?? cleaned

    return {
      diagnosis: getSection('DIAGNOSIS') || 'The error was analyzed and a fix was generated.',
      fixedCode: fixedCodeSection || fallbackCodeBlock,
      explanation: getSection('EXPLANATION') || 'Clause Forge generated a corrected contract.',
      changes: parseList(getSection('CHANGES')),
      warnings: parseList(getSection('WARNINGS')),
      issueCategory: getSection('ISSUE_CATEGORY') || 'unknown',
    }
  }
}

export const debugContract = async (
  request: DebugContractRequest,
  apiKey?: string
): Promise<DebugContractResult> => {
  const compactRequest = compactDebugRequest(request)

  const completion = await completeAi([
        { role: 'system', content: buildCompactDebugSystemPrompt() },
        {
          role: 'user',
          content: `Intent:
${compactRequest.intent || 'Not provided'}

Current code:
\`\`\`python
${compactRequest.code}
\`\`\`

Error / traceback / GenVM output:
\`\`\`txt
${compactRequest.errorMessage}
\`\`\`

Previous fix, if any:
\`\`\`python
${compactRequest.previousFix || ''}
\`\`\`

Return a complete fixed contract and explain the fix.`,
        },
  ], { apiKey }).catch((err: unknown) => {
    if ((err as { isOperational?: boolean }).isOperational) throw err
    throw toAiDebugError(err)
  })

  const content = completion.content
  if (!content.trim()) {
    throw createOperationalError(
      'The AI provider returned an empty debug response. Try again with the exact traceback and a shorter contract.',
      502
    )
  }

  const parsed = parseDebugResponse(content)
  const fixedCode = normalizeContractCode(parsed.fixedCode)

  if (!/class\s+\w+\s*\(\s*gl\.Contract\s*\)\s*:/.test(fixedCode)) {
    throw createOperationalError(
      'The AI debug response did not contain a complete GenLayer contract. Try again with the exact error and the full contract code.',
      502
    )
  }

  const structure = extractContractStructure(fixedCode)
  const frontendCallMap = buildFrontendCallMap(structure)

  return {
    ...parsed,
    fixedCode,
    frontendCallMap,
    modelUsed: completion.provider + ':' + completion.model,
  }
}



