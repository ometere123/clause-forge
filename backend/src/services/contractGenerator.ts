import { completeAi, type AiCompletion } from './aiProvider'
import type { GeneratedContract, ContractStructure, ContractEstimation } from '../types'
import { buildFrontendCallMap, extractContractStructure } from './contractAnalysis'
import { buildGenerationSystemPrompt, buildGenerationUserPrompt } from './genlayerKnowledge'
import { normalizeContractCode } from './contractCode'
import { buildContractGenerationReport, classifyContractKind } from './contractReport'
import { buildPlainSummary } from './contractSummary'
import { validateContract } from './contractValidator'
import { debugContract } from './contractDebugger'
import type { AutoFixInfo, ValidationResult } from '../types'


export const generateContract = async (
  description: string,
  apiKey?: string
): Promise<GeneratedContract> => {
  const startTime = Date.now()
  const completion = await completeAi([
    { role: 'system', content: buildGenerationSystemPrompt(description, '') },
    { role: 'user', content: buildGenerationUserPrompt(description) },
  ], { apiKey })

  const rawCode = completion.content
  let generatedCode = normalizeContractCode(rawCode)

  // Self-healing pass: validate immediately; if the generated contract has
  // critical errors, run one automatic repair through the debugger before the
  // user ever sees it. Non-developers should not receive broken code.
  let validation: ValidationResult = validateContract(generatedCode)
  const autoFix: AutoFixInfo = { attempted: false, succeeded: false, issuesFixed: [] }

  if (!validation.isValid) {
    autoFix.attempted = true
    const criticalIssues = validation.errors
      .filter((e) => e.severity === 'critical')
      .map((e) => `${e.message}${e.suggestion ? ` Fix: ${e.suggestion}` : ''}`)

    try {
      const repair = await debugContract(
        {
          code: generatedCode,
          errorMessage: `Static validation found these problems:\n- ${criticalIssues.join('\n- ')}`,
          intent: description,
        },
        apiKey
      )
      const repairedValidation = validateContract(repair.fixedCode)
      if (repairedValidation.isValid) {
        generatedCode = repair.fixedCode
        validation = repairedValidation
        autoFix.succeeded = true
        autoFix.issuesFixed = criticalIssues
      }
    } catch {
      // Repair is best-effort; fall back to the original code + its validation report
    }
  }

  const structure = extractContractStructure(generatedCode)
  const frontendCallMap = buildFrontendCallMap(structure)
  const generationReport = buildContractGenerationReport({
    description,
    code: generatedCode,
    structure,
    frontendCallMap,
  })
  const estimation = buildEstimation(completion, Date.now() - startTime)
  const contractName = inferName(description)
  const plainSummary = buildPlainSummary({
    description,
    code: generatedCode,
    structure,
    kind: classifyContractKind(description, generatedCode),
  })

  return {
    generationId: crypto.randomUUID(),
    generatedCode,
    contractName,
    methods: structure.methods,
    stateVariables: structure.stateVariables,
    frontendCallMap,
    generationReport,
    plainSummary,
    validation,
    autoFix,
    estimation,
    originalDescription: description,
    modelUsed: completion.provider + ':' + completion.model,
    generatedAt: new Date().toISOString(),
  }
}



const buildEstimation = (
  completion: AiCompletion,
  generationTimeMs: number
): ContractEstimation => {
  const tokensInput = completion.usage.promptTokens
  const tokensOutput = completion.usage.completionTokens
  const code = completion.content

  return {
    tokensInput,
    tokensOutput,
    estimatedCostUsd: (tokensInput / 1_000_000) * 0.05 + (tokensOutput / 1_000_000) * 0.08,
    generationTimeMs,
    capabilities: {
      needsLlm: code.includes('gl.nondet.exec_prompt'),
      needsWebFetch:
        code.includes('gl.nondet.web.get') ||
        code.includes('gl.nondet.web.request') ||
        code.includes('gl.nondet.web.post') ||
        code.includes('gl.nondet.web.patch') ||
        code.includes('gl.nondet.web.delete') ||
        code.includes('gl.nondet.web.head'),
      needsDataAccess: code.includes('gl.nondet.web.render') || code.includes('images='),
      estimatedGasUsage: Math.ceil(code.length / 100),
    },
  }
}

const inferName = (description: string): string => {
  const words = description.trim().split(/\s+/).slice(0, 5)
  return words
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
    .replace(/[^a-zA-Z0-9\s]/g, '')
}


