import Groq from 'groq-sdk'
import { config } from '../config'
import { buildFrontendCallMap, extractContractStructure } from './contractAnalysis'
import { buildDebugSystemPrompt } from './genlayerKnowledge'
import { normalizeContractCode } from './contractCode'
import type { FrontendCallMapItem } from '../types'

const buildGroq = (apiKey?: string) => new Groq({ apiKey: apiKey || config.groq.apiKey })

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
    return {
      diagnosis: String(parsed.diagnosis ?? 'The error was analyzed and a fix was generated.'),
      fixedCode: String(parsed.fixedCode ?? ''),
      explanation: String(parsed.explanation ?? ''),
      changes: Array.isArray(parsed.changes) ? parsed.changes.map(String) : [],
      warnings: Array.isArray(parsed.warnings) ? parsed.warnings.map(String) : [],
      issueCategory: parsed.issueCategory ? String(parsed.issueCategory) : undefined,
    }
  } catch {
    return {
      diagnosis: 'The model returned non-JSON output. Review the fixed code manually.',
      fixedCode: content,
      explanation: 'Clause Forge could not parse a structured explanation from the model response.',
      changes: [],
      warnings: ['Structured debug response parsing failed.'],
      issueCategory: 'unknown',
    }
  }
}

export const debugContract = async (
  request: DebugContractRequest,
  apiKey?: string
): Promise<DebugContractResult> => {
  const groq = buildGroq(apiKey)

  const completion = await groq.chat.completions.create({
    model: config.groq.model,
    max_tokens: config.groq.maxTokens,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: buildDebugSystemPrompt() },
      {
        role: 'user',
        content: `Intent:
${request.intent || 'Not provided'}

Current code:
\`\`\`python
${request.code}
\`\`\`

Error / traceback / GenVM output:
\`\`\`txt
${request.errorMessage}
\`\`\`

Previous fix, if any:
\`\`\`python
${request.previousFix || ''}
\`\`\`

Return a complete fixed contract and explain the fix.`,
      },
    ],
  })

  const content = completion.choices[0]?.message?.content ?? ''
  const parsed = parseDebugResponse(content)
  const fixedCode = normalizeContractCode(parsed.fixedCode)
  const structure = extractContractStructure(fixedCode)
  const frontendCallMap = buildFrontendCallMap(structure)

  return {
    ...parsed,
    fixedCode,
    frontendCallMap,
    modelUsed: config.groq.model,
  }
}
