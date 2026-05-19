import Groq from 'groq-sdk'
import { config } from '../config'
import { buildFrontendCallMap, extractContractStructure } from './contractAnalysis'
import { buildDebugSystemPrompt } from './genlayerKnowledge'
import { normalizeContractCode } from './contractCode'
import type { FrontendCallMapItem } from '../types'

const buildGroq = (apiKey?: string) => new Groq({ apiKey: apiKey || config.groq.apiKey })

const DEBUG_SECTIONS = [
  'DIAGNOSIS',
  'ISSUE_CATEGORY',
  'FIXED_CODE',
  'EXPLANATION',
  'CHANGES',
  'WARNINGS',
] as const

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
  const groq = buildGroq(apiKey)

  const completion = await groq.chat.completions.create({
    model: config.groq.model,
    max_tokens: config.groq.maxTokens,
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
